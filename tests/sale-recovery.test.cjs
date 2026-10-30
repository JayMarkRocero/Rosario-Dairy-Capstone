const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { default as http, ApiError, setAccessToken } from './src/lib/api';
  export * from './src/lib/saleSubmission';
  export * from './src/lib/dataCache';
  export { checkoutService } from './src/features/pos/api/checkout.service';
  export { ordersService } from './src/features/orders/api/orders.service';
`, resolveDir: root }, bundle: true, write: false, packages: 'external', platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
function load() {
  const mod = new Module(path.join(root, 'tests', 'recovery-in-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'recovery-in-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); return mod.exports;
}
let api, storage;
const token = id => `header.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.signature`;
beforeEach(() => {
  storage = new Map();
  Object.defineProperty(global, 'sessionStorage', { configurable: true, writable: true, value: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key),
  } });
  const tokens = new Map([['rosario_access_token', token(7)]]);
  global.localStorage = { getItem: key => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: key => tokens.delete(key) };
  global.window = new EventTarget(); api = load();
});
const payload = { customer_id: 1, payment_method: 'cash', amount_tendered: '100.00', items: [{ product_id: 4, quantity: '2', unit_price: '10', discount_type: 'none', discount_value: '0' }] };
const transaction = { id: 44, subtotal: '20.00', total_amount: '20.00', change_due: '80.00' };
const response = (config, data, status = 201) => ({ config, data, status, headers: {}, statusText: '' });

for (const operation of ['checkout', 'order']) test(`${operation} recovers the saved UUID/payload after timeout and reload; new sales use a new UUID`, async () => {
  const recorded = new Map(), calls = [];
  // This HTTP double models backend 201/200/409 semantics; it is not a live stock test.
  const adapter = async config => {
    const body = JSON.parse(config.data), id = body.request_id; calls.push({ body, id });
    assert.match(id, /^[0-9a-f-]{36}$/); assert.equal(config.headers['Idempotency-Key'], undefined);
    const prior = recorded.get(id);
    if (!prior) {
      recorded.set(id, body);
      if (calls.length === 1) throw new AxiosError('timeout after commit', AxiosError.ECONNABORTED);
    } else assert.deepEqual(body, prior);
    return response(config, operation === 'order' ? { id: 8, transaction } : transaction, prior ? 200 : 201);
  };
  const send = () => operation === 'checkout' ? api.checkoutService.submit(payload) : api.ordersService.createOrder(payload);
  const retry = () => operation === 'checkout' ? api.checkoutService.retryPending() : api.ordersService.retryPending();
  api.http.defaults.adapter = adapter;
  await assert.rejects(send(), api.UnconfirmedSaleError);
  const saved = api.pendingSale(operation); assert.equal(saved.requestId, calls[0].id);
  assert.deepEqual({ ...saved.payload, request_id: saved.requestId }, calls[0].body);
  api = load(); api.http.defaults.adapter = adapter;
  assert.equal(api.hasUnconfirmedSale(operation), true);
  await assert.rejects(send(), api.UnconfirmedSaleError); assert.equal(calls.length, 1);
  const result = await retry(); assert.equal(result.transaction.id, 44);
  assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0]); assert.equal(recorded.size, 1);
  assert.equal(api.hasUnconfirmedSale(operation), false); assert.equal(storage.size, 0);
  await send(); assert.notEqual(calls[2].id, calls[0].id); assert.equal(recorded.size, 2);
});

test('concurrent identical submissions share one write; changed payload and cross-endpoint recovery stay blocked', async () => {
  let finish, writes = 0;
  api.http.defaults.adapter = config => { writes++; return new Promise(resolve => { finish = () => resolve(response(config, transaction)); }); };
  const first = api.checkoutService.submit(payload), second = api.checkoutService.submit(payload);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(api.checkoutService.submit({ ...payload, amount_tendered: '200' }), { status: 409 });
  assert.equal(writes, 1); finish(); assert.deepEqual(await first, await second);
  api.http.defaults.adapter = async () => { writes++; throw new AxiosError('timeout'); };
  await assert.rejects(api.checkoutService.submit(payload), api.UnconfirmedSaleError);
  await assert.rejects(api.submitSaleOnce('checkout', { ...api.pendingSale('checkout').payload, amount_tendered: '200' }, async () => { writes++; }, true), api.UnconfirmedSaleError);
  await assert.rejects(api.ordersService.retryPending(), api.UnconfirmedSaleError);
  assert.equal(writes, 2);
});

test('409 replay conflict remains guarded across reload and cannot silently obtain a new key', async () => {
  let writes = 0;
  api.http.defaults.adapter = async config => { writes++; throw new AxiosError('conflict', undefined, config, undefined, response(config, { detail: 'Request ID already used for another sale.' }, 409)); };
  await assert.rejects(api.checkoutService.submit(payload), api.UnconfirmedSaleError);
  api = load();
  assert.equal(api.hasUnconfirmedSale('checkout'), true); assert.equal(api.pendingSale('checkout'), null);
  await assert.rejects(api.checkoutService.retryPending(), api.UnconfirmedSaleError); assert.equal(writes, 1);
});

test('a recovery 400 cannot erase a previously ambiguous outcome; initial 400 remains correctable', async () => {
  api.http.defaults.adapter = async () => { throw new AxiosError('timeout'); };
  await assert.rejects(api.checkoutService.submit(payload), api.UnconfirmedSaleError);
  const id = api.pendingSale('checkout').requestId;
  api.http.defaults.adapter = async config => { throw new AxiosError('validation', undefined, config, undefined, response(config, { error: 'Customer inactive.' }, 400)); };
  await assert.rejects(api.checkoutService.retryPending(), api.UnconfirmedSaleError);
  assert.equal(api.pendingSale('checkout').requestId, id); assert.equal(api.hasUnconfirmedSale('checkout'), true);
  assert.equal(api.acknowledgeUnconfirmedSale('checkout'), true);
  await assert.rejects(api.checkoutService.submit(payload), { status: 400 });
  assert.equal(api.hasUnconfirmedSale('checkout'), false);
});

test('blocked, full or corrupt storage never causes an untracked new write or an unsafe recovery', async () => {
  let writes = 0; api.http.defaults.adapter = async config => { writes++; return response(config, transaction); };
  const working = global.sessionStorage;
  for (const blocked of [
    { getItem() { throw new Error('blocked'); }, setItem() {}, removeItem() {} },
    { getItem: () => null, setItem() { throw new Error('full'); }, removeItem() {} },
  ]) {
    global.sessionStorage = blocked;
    await assert.rejects(api.checkoutService.submit(payload), /Browser storage is unavailable/);
    assert.equal(writes, 0);
  }
  global.sessionStorage = working;
  for (const value of ['unconfirmed', '{broken', '{"version":1,"requestId":"invalid"}']) {
    storage.set('rosario:unconfirmed-sale:7', value); api = load();
    assert.equal(api.hasUnconfirmedSale('checkout'), true); assert.equal(api.pendingSale('checkout'), null);
    await assert.rejects(api.checkoutService.retryPending(), api.UnconfirmedSaleError);
  }
  assert.equal(writes, 0);
});

test('account changes isolate recovery and a late response never becomes the new account receipt', async () => {
  let finish;
  api.http.defaults.adapter = config => new Promise(resolve => { finish = () => resolve(response(config, transaction)); });
  const first = api.checkoutService.submit(payload);
  await new Promise(resolve => setImmediate(resolve));
  api.setAccessToken(token(8));
  assert.equal(api.pendingSale('checkout'), null);
  finish(); await assert.rejects(first, api.UnconfirmedSaleError);
  assert.ok(storage.has('rosario:unconfirmed-sale:7'));
  assert.equal(storage.has('rosario:unconfirmed-sale:8'), false);
});
