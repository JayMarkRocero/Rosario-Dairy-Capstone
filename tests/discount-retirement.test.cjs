const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { default as http } from './src/lib/api';
  export * from './src/lib/saleSubmission';
  export * from './src/features/pos/api/checkout.service';
  export * from './src/features/orders/api/orders.service';
  export * from './src/features/sales/api/encoding.service';
  export * from './src/features/sales/api/pendingRequest';
  export * from './src/features/sales/utils/manualPricing';
  export * from './src/features/sales/utils/retiredPricing';
`, resolveDir: root }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const load = () => {
  const mod = new Module(path.join(root, 'tests', 'retirement-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'retirement-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); return mod.exports;
};
let api, session, local;
beforeEach(() => {
  session = new Map(); local = new Map([['rosario_access_token', `header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.sig`]]);
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  Object.defineProperty(global, 'sessionStorage', { configurable: true, writable: true, value: storage(session) });
  global.localStorage = storage(local); global.window = new EventTarget(); api = load();
});
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const requestId = '550e8400-e29b-41d4-a716-446655440099';
const item = { product_id: 4, quantity: '2.00', unit_price: '50.00' };
const sale = { id: 77, subtotal: '100.00', total_amount: '100.00', change_due: null };
const payload = { customer_id: 3, payment_method: 'online', amount_tendered: null, items: [item] };
const encoded = { ...payload, request_id: requestId, transaction_date: '2026-10-01', payment_status: 'pending', si_number: 'SI-RETRY', note: '' };
const reply = (config, data, status = 200) => ({ config, data, status, headers: {}, statusText: 'OK' });
function saveSale(operation, body) {
  const serialized = canonical(body), record = { version: 1, operation, requestId, payload: serialized, fingerprint: `${operation}:${serialized}` };
  session.set('rosario:unconfirmed-sale:7', JSON.stringify(record));
}
function saveEncoding(body, lines = []) {
  const fingerprint = JSON.stringify({ transaction_date: body.transaction_date, customer_id: body.customer_id, si_number: body.si_number,
    note: body.note, payment_method: body.payment_method, payment_status: body.payment_status, amount_tendered: body.amount_tendered, items: body.items });
  return api.storePendingRequest('encoding', body.request_id, fingerprint, { payload: body, lines });
}

test('final prices use decimal half-up line rounding and bare required request fields', () => {
  const priced = api.priceSale([{ productId: 4, name: 'Milk', stock: 5, quantity: '0.33', unitPrice: '1.99' }]);
  assert.equal(priced.total, 66n); assert.equal(priced.subtotal, 66n); assert.equal('discount' in priced, false);
  assert.deepEqual(priced.items, [{ product_id: 4, quantity: '0.33', unit_price: '1.99' }]);
});

test('active or malformed legacy pricing is rejected before every new sale endpoint without mutating the input', async () => {
  let writes = 0; api.http.defaults.adapter = async config => { writes++; return reply(config, sale); };
  for (const retired of [{ discount_type: 'percent', discount_value: '0' }, { discount_type: 'fixed', discount_value: '10' },
    { discount_value: '1' }, { discount_amount: '1' }, { discount: 0 }, { discounts: [] }, { discount_value: 'NaN' }]) {
    for (const atHeader of [true, false]) {
      const body = atHeader ? { ...payload, ...retired } : { ...payload, items: [{ ...item, ...retired }] };
      const before = JSON.stringify(body);
      await assert.rejects(api.checkoutService.submit(body), /final selling price|retired pricing/i);
      await assert.rejects(api.ordersService.createOrder(body), /final selling price|retired pricing/i);
      await assert.rejects(api.encodingService.create({ ...encoded, ...body }), /final selling price|retired pricing/i);
      assert.equal(JSON.stringify(body), before);
    }
  }
  assert.equal(writes, 0);
});

for (const operation of ['checkout', 'order']) {
  test(`${operation} legacy active attempts require history acknowledgement and never POST or rewrite their UUID`, async () => {
    const body = { ...payload, items: [{ ...item, discount_type: 'fixed', discount_value: '10.00' }] };
    saveSale(operation, body); const before = session.get('rosario:unconfirmed-sale:7');
    let writes = 0;
    api.http.defaults.adapter = async config => { writes++; return reply(config, operation === 'order' ? { id: 4, transaction: sale } : sale); };
    assert.equal(api.hasUnconfirmedSale(operation), true); assert.equal(api.pendingSale(operation), null);
    await assert.rejects(operation === 'order' ? api.ordersService.retryPending() : api.checkoutService.retryPending(), api.UnconfirmedSaleError);
    await assert.rejects(operation === 'order' ? api.ordersService.createOrder(payload) : api.checkoutService.submit(payload), api.UnconfirmedSaleError);
    assert.equal(writes, 0); assert.equal(session.get('rosario:unconfirmed-sale:7'), before);
    assert.equal(api.acknowledgeUnconfirmedSale(operation), true);
    let sent;
    api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); return reply(config, operation === 'order' ? { id: 4, transaction: sale } : sale, 201); };
    await (operation === 'order' ? api.ordersService.createOrder(payload) : api.checkoutService.submit(payload));
    assert.notEqual(sent.request_id, requestId); assert.deepEqual(sent.items, [item]);
  });

  test(`${operation} ordinary pre-retirement defaults replay their exact saved body and UUID`, async () => {
    const body = { ...payload, items: [{ ...item, discount_type: 'none', discount_value: '0.00' }] };
    saveSale(operation, body); api = load(); let sent;
    api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); return reply(config, operation === 'order' ? { id: 4, transaction: sale } : sale); };
    await (operation === 'order' ? api.ordersService.retryPending() : api.checkoutService.retryPending());
    assert.deepEqual(sent, { ...body, request_id: requestId }); assert.equal(api.hasUnconfirmedSale(operation), false);
  });
}

test('legacy active encoding remains discoverable after reload and cannot be replaced with a no-discount payload', async () => {
  const legacy = { ...encoded, items: [{ ...item, discount_type: 'fixed', discount_value: '10.00' }] };
  const pending = saveEncoding(legacy, [{ productId: 4, name: 'Milk', stock: 5, quantity: '2', unitPrice: '50', discountType: 'fixed', discountValue: '10' }]);
  const before = local.get(pending.key); api = load(); let writes = 0;
  api.http.defaults.adapter = async config => { writes++; return reply(config, sale); };
  assert.equal(api.encodingService.pending().id, requestId);
  await assert.rejects(api.encodingService.create(legacy), { status: 409 });
  await assert.rejects(api.encodingService.create({ ...encoded, request_id: crypto.randomUUID() }), { status: 409 });
  assert.equal(writes, 0); assert.equal(local.get(pending.key), before);
  api.encodingService.clearPending(); assert.equal(api.encodingService.pending(), null);
});

test('ordinary legacy encoding preserves exact payload and UUID across reload and failed recovery', async () => {
  const legacy = { ...encoded, items: [{ ...item, discount_type: 'none', discount_value: '0.00' }] };
  const pending = saveEncoding(legacy), before = local.get(pending.key); api = load(); let sent;
  api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); throw new AxiosError('Rejected', undefined, config, undefined, reply(config, { error: 'Customer unavailable' }, 400)); };
  await assert.rejects(api.encodingService.create(encoded), { status: 400 });
  assert.deepEqual(sent, legacy); assert.equal(local.get(pending.key), before);
  api = load();
  api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); return reply(config, sale); };
  const result = await api.encodingService.create(encoded);
  assert.equal(result.id, 77); assert.deepEqual(sent, legacy); assert.equal(api.encodingService.pending(), null);
});

test('new encoding omits neutral fields and retains its saved payload through ambiguous errors', async () => {
  const neutral = { ...encoded, items: [{ ...item, discount_type: 'none', discount_value: '0.00' }] };
  let sent;
  api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); throw new AxiosError('Timeout', AxiosError.ECONNABORTED); };
  await assert.rejects(api.encodingService.create(neutral));
  assert.deepEqual(sent.items, [item]); const saved = api.encodingService.pending();
  api = load(); assert.deepEqual(api.encodingService.pending().payload.payload, saved.payload.payload);
  let writes = 0; api.http.defaults.adapter = async () => { writes++; throw new Error('Unexpected'); };
  await assert.rejects(api.encodingService.create({ ...encoded, amount_tendered: '999' }), { status: 409 });
  assert.equal(writes, 0); assert.equal(api.encodingService.pending().id, requestId);
});
