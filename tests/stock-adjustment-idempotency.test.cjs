const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const { createBrowserLocks } = require('./browser-locks.cjs');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export {default as http, setAccessToken, setRefreshToken, ApiError} from './src/lib/api';
  export {outflowsService} from './src/features/inventory/api/outflows.service';
  export {inventoryService} from './src/features/inventory/api/inventory.service';
  export * from './src/features/sales/api/pendingRequest';
  export * from './src/lib/dataCache';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
const token = id => `h.${Buffer.from(JSON.stringify({user_id: id})).toString('base64url')}.s`;
let api, values, storage, supported, stock, submissions, requests, attempts, lost, forced, nextId, batchReads;
const body = { product_batch_id: 1, adjustment_type: 'complimentary', quantity: '5.00', unit_cost: '0.00', reason: 'Courtesy' };
const expired = { kind: 'product', id: 1, quantity: 100, name: 'Milk', batch: 'B1' };
function load() {
  const mod = new Module(path.join(root, 'tests', 'stock-adjustment-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'stock-adjustment-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); mod.exports.http.defaults.adapter = adapter; return mod.exports;
}
const response = (config, data, status = 200) => ({ config, data, status, headers: {}, statusText: '' });
const reject = (config, status, data) => { throw new AxiosError('Rejected', undefined, config, undefined, response(config, data, status)); };
async function adapter(config) {
  const payload = config.data ? JSON.parse(config.data) : null;
  requests.push({ method: config.method, payload, url: config.url });
  if (config.method === 'get' && config.url.startsWith('/inventory/product-batches/')) {
    batchReads++; if (stock === 0) reject(config, 404, { detail: 'Batch no longer available' });
    return response(config, { id: 1, status: 'expired', remaining_quantity: String(stock), expiration_date: '2000-01-01', unit_price: null, batch_number: 'B1' });
  }
  if (config.method === 'get' && config.url === '/inventory/stock-adjustments/') return response(config, [...submissions.values()].map(saved => saved.data));
  assert.equal(config.url, '/inventory/stock-adjustments/');
  if (payload.request_id === '' && payload.product_batch_id === 0) {
    assert.equal(payload.quantity, '0');
    reject(config, 400, supported ? { request_id: ['Must be a valid UUID.'] } : { error: 'product_batch_id must be positive' });
  }
  attempts.push(payload);
  if (forced) reject(config, forced.status, forced.data);
  const key = `${JSON.parse(Buffer.from(values.get('rosario_access_token').split('.')[1], 'base64url')).user_id}:${payload.request_id}`;
  const fingerprint = JSON.stringify(payload);
  if (supported && submissions.has(key)) {
    const previous = submissions.get(key);
    if (previous.fingerprint !== fingerprint) reject(config, 409, { detail: 'This request ID was already used for a different stock adjustment.' });
    return response(config, previous.data, 200);
  }
  const quantity = Number(payload.quantity);
  if (quantity > stock) reject(config, 400, { error: 'Insufficient stock' });
  stock -= quantity;
  const data = { id: ++nextId, ...payload, product_batch: { id: 1, remaining_quantity: String(stock) } };
  if (supported) submissions.set(key, { fingerprint, data });
  if (lost) { lost = false; throw new AxiosError('Response lost', AxiosError.ETIMEDOUT, config); }
  return response(config, data, 201);
}
beforeEach(() => {
  values = new Map([['rosario_access_token', token(7)]]); supported = true; stock = 100; submissions = new Map();
  requests = []; attempts = []; lost = false; forced = null; nextId = 0; batchReads = 0;
  storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  global.localStorage = storage; global.window = new EventTarget();
  Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: createBrowserLocks() } });
  api = load();
});
afterEach(() => { if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator); else delete global.navigator; });

test('first keyed POST uses verified durable UUID/body, accepts 201 and never caches its response snapshot', async () => {
  api.writeDataCache('inventory-now', ['old rows'], ['inventory']);
  const result = await api.outflowsService.create(body);
  assert.equal(result.id, 1); assert.equal(stock, 95); assert.equal(attempts.length, 1);
  assert.match(attempts[0].request_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...attempts[0], request_id: undefined }, { ...body, request_id: undefined });
  assert.equal(api.outflowsService.pending(), null);
  assert.deepEqual(api.readDataCache('inventory-now').data, ['old rows']); assert.equal(api.readDataCache('inventory-now').updatedAt, 0);
});
test('lost response/reload replays the exact original UUID and body with 200 and one deduction', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body));
  const original = api.outflowsService.pending(); assert.equal(api.outflowsService.canRecover(original), true);
  api = load(); assert.deepEqual(api.outflowsService.pending(), original);
  const result = await api.outflowsService.recover();
  assert.equal(result.id, 1); assert.equal(stock, 95); assert.equal(submissions.size, 1); assert.deepEqual(attempts[1], attempts[0]);
  assert.equal(api.outflowsService.pending(), null);
});
test('replay invalidation refetches current stock/history instead of installing its stale batch snapshot', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body)); stock = 90; // A later independent adjustment.
  api.writeDataCache('current-stock', '90', ['inventory']); api.writeDataCache('current-history', [], ['inventory']);
  const reads = [];
  const watch = (key, fetcher) => api.subscribeDataCache(key, () => {
    if (api.readDataCache(key).updatedAt === 0) reads.push(api.fetchDataCache(key, fetcher, ['inventory'], true));
  });
  const stopStock = watch('current-stock', async () => (await api.http.get('/inventory/product-batches/1/')).data.remaining_quantity);
  const stopHistory = watch('current-history', async () => (await api.outflowsService.list({})));
  try {
    const replay = await api.outflowsService.recover(); await Promise.all(reads);
    assert.equal(replay.product_batch.remaining_quantity, '95');
    assert.equal(api.readDataCache('current-stock').data, '90');
    assert.equal(api.readDataCache('current-history').data[0].id, replay.id);
    assert.equal(stock, 90);
  } finally { stopStock(); stopHistory(); }
});
test('conflicting backend UUID payload returns 409 and retains the saved request', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body)); const pending = api.outflowsService.pending();
  submissions.get(`7:${pending.id}`).fingerprint = 'different recorded payload';
  await assert.rejects(api.outflowsService.recover(), error => error.status === 409 && error.message.includes('different stock adjustment'));
  assert.deepEqual(api.outflowsService.pending(), pending); assert.equal(stock, 95);
  await assert.rejects(api.outflowsService.create({ ...body, quantity: '1' }), /unconfirmed/); assert.equal(attempts.length, 2);
});
test('first 400 UUID validation is clear; a recovery 400 never discards an uncertain request', async () => {
  forced = { status: 400, data: { request_id: ['Must be a valid UUID.'] } };
  await assert.rejects(api.outflowsService.create(body), error => error.status === 400 && error.fieldErrors.request_id[0] === 'Must be a valid UUID.');
  assert.equal(api.outflowsService.pending(), null); assert.equal(stock, 100);
  forced = null; lost = true; await assert.rejects(api.outflowsService.create(body)); const pending = api.outflowsService.pending();
  forced = { status: 400, data: { error: 'Batch unavailable for current permissions' } };
  await assert.rejects(api.outflowsService.recover(), { status: 400 }); assert.deepEqual(api.outflowsService.pending(), pending);
});
test('full expired disposal recovers without rereading its unavailable batch or deducting twice', async () => {
  lost = true; await assert.rejects(api.inventoryService.disposeExpiredBatch(expired));
  assert.equal(stock, 0); const saved = api.outflowsService.pending(); assert.equal(saved.context, 'expired-disposal');
  assert.equal(saved.payload.unit_cost, '0.00'); assert.equal(batchReads, 1);
  api = load(); await api.inventoryService.disposeExpiredBatch(expired);
  assert.equal(batchReads, 1); assert.equal(stock, 0); assert.deepEqual(attempts[1], attempts[0]); assert.equal(submissions.size, 1);
});
test('outflow recovery also restores a full disposal when no batch action remains visible', async () => {
  lost = true; await assert.rejects(api.inventoryService.disposeExpiredBatch(expired)); api = load();
  await api.outflowsService.recover(); assert.equal(batchReads, 1); assert.equal(stock, 0); assert.equal(api.outflowsService.pending(), null);
});
test('a pending ordinary outflow cannot be mistaken for a full-disposal retry', async () => {
  lost = true; await assert.rejects(api.outflowsService.create({ ...body, adjustment_type: 'expired' }));
  await assert.rejects(api.inventoryService.disposeExpiredBatch({ ...expired, quantity: 95 }), /unconfirmed/);
  assert.equal(attempts.length, 1); assert.equal(stock, 95); assert.equal(batchReads, 0);
});
test('tampered saved payload/UUID cannot be replayed or silently rewritten', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body)); const original = api.outflowsService.pending();
  const changed = { ...original, payload: { ...original.payload, quantity: '10.00' } };
  values.set(original.key, JSON.stringify(changed));
  await assert.rejects(api.outflowsService.recover(), /legacy or unverified/);
  assert.equal(attempts.length, 1); assert.deepEqual(JSON.parse(values.get(original.key)), changed);
});
test('legacy pending UUIDs that were never sent remain history-only even on the new backend', async () => {
  const legacy = api.storePendingRequest('outflow', '11111111-1111-4111-8111-111111111111', JSON.stringify(body), body, { durable: true });
  assert.equal(api.outflowsService.canRecover(legacy), false);
  await assert.rejects(api.outflowsService.recover(), /legacy or unverified/); assert.equal(requests.length, 0);
  await assert.rejects(api.outflowsService.create(body), /unconfirmed/);
  assert.deepEqual(api.outflowsService.pending(), legacy); assert.equal(await api.outflowsService.clearPending(), true);
});
test('older backend initial writes stay usable but never gain replay eligibility after an upgrade', async () => {
  supported = false; lost = true; await assert.rejects(api.outflowsService.create(body));
  const pending = api.outflowsService.pending(); assert.ok(pending.payload.request_id); assert.equal(api.outflowsService.canRecover(pending), false);
  supported = true; api = load(); await assert.rejects(api.outflowsService.recover(), /legacy or unverified/);
  assert.equal(attempts.length, 1); assert.equal(stock, 95);
});
test('backend downgrade blocks recovery before another stock deduction', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body)); const original = api.outflowsService.pending();
  supported = false; await assert.rejects(api.outflowsService.recover(), /Deploy df6f732/);
  assert.equal(attempts.length, 1); assert.equal(stock, 95); assert.deepEqual(api.outflowsService.pending(), original);
});
for (const issue of ['blocked', 'full', 'silent', 'readback', 'protocol-full']) test(`${issue} durable storage prevents any real adjustment POST`, async () => {
  let written = false;
  global.localStorage = { ...storage,
    getItem(key) { if (key.startsWith('rosario:pending-') && (issue === 'blocked' || issue === 'readback' && written)) throw Error('Blocked'); return storage.getItem(key); },
    setItem(key, value) { if (key.startsWith('rosario:pending-')) {
      if (issue === 'full' || issue === 'protocol-full' && JSON.parse(value).protocol) throw Error('Full');
      written = true; if (issue === 'silent') return;
    } storage.setItem(key, value); },
  };
  await assert.rejects(api.outflowsService.create(body), /storage/i); assert.equal(attempts.length, 0); assert.equal(stock, 100);
});
test('same-tab clicks share one write and concurrent tabs cannot queue an independent deduction', async () => {
  let finish;
  const real = api.http.defaults.adapter;
  api.http.defaults.adapter = config => {
    if (JSON.parse(config.data).product_batch_id === 0) return real(config);
    return new Promise(resolve => { finish = async () => resolve(await real(config)); });
  };
  const first = api.outflowsService.create(body), duplicate = api.outflowsService.create(body); assert.equal(first, duplicate);
  for (let n = 0; n < 50 && !finish; n++) await new Promise(setImmediate);
  assert.equal(typeof finish, 'function');
  const tab = load(); await assert.rejects(tab.outflowsService.create(body), /active in another tab/);
  assert.equal(await tab.outflowsService.clearPending(), false);
  await finish(); await first; assert.equal(attempts.length, 1); assert.equal(stock, 95);
});
test('account switching keeps recovery with the originating account', async () => {
  lost = true; await assert.rejects(api.outflowsService.create(body)); const original = api.outflowsService.pending();
  api.setAccessToken(token(8)); assert.equal(api.outflowsService.pending(), null);
  await assert.rejects(api.outflowsService.recover(), /No saved/); assert.equal(attempts.length, 1);
  api.setAccessToken(token(7)); assert.deepEqual(api.outflowsService.pending(), original);
  await api.outflowsService.recover(); assert.equal(stock, 95);
});
test('missing browser locks fail closed and do not dispatch a request', async () => {
  delete navigator.locks; await assert.rejects(api.outflowsService.create(body), /browser coordination/);
  assert.equal(requests.length, 0); assert.equal(stock, 100);
});
