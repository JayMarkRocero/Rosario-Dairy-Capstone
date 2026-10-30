const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { default as http } from './src/lib/api';
  export * from './src/features/sales/api/encoding.service';
  export * from './src/features/sales/api/pendingRequest';
`, resolveDir: root }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
function load() {
  const mod = new Module(path.join(root, 'tests', 'encoding-durable-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'encoding-durable-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); return mod.exports;
}
let api, values, storage, writes;
const payload = { request_id: '550e8400-e29b-41d4-a716-446655440099', transaction_date: '2026-10-01',
  customer_id: null, si_number: 'SI-SAVED', note: '', payment_method: 'online', payment_status: 'pending',
  amount_tendered: null, items: [{ product_id: 4, quantity: '2.00', unit_price: '50.00' }] };
const reply = (config, data = { id: 77 }, status = 200) => ({ config, data, status, headers: {}, statusText: 'OK' });
beforeEach(() => {
  writes = [];
  values = new Map([['rosario_access_token', `header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.sig`]]);
  storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  global.localStorage = storage; global.window = new EventTarget(); api = load();
  api.http.defaults.adapter = async config => { writes.push(JSON.parse(config.data)); return reply(config); };
});

for (const failure of ['get', 'set', 'silent-set', 'readback']) test(`encoding never POSTs with ${failure} storage failure`, async () => {
  let stored = false;
  global.localStorage = { ...storage,
    getItem(key) {
      if (key.startsWith('rosario:pending-') && (failure === 'get' || failure === 'readback' && stored)) throw new Error('Blocked');
      return storage.getItem(key);
    },
    setItem(key, value) {
      if (failure === 'set') throw new Error('Full');
      if (failure !== 'silent-set') storage.setItem(key, value);
      stored = true;
    },
  };
  const before = JSON.stringify(payload);
  await assert.rejects(api.encodingService.create(payload), /storage.*unavailable|could not be verified/i);
  assert.equal(writes.length, 0); assert.equal(JSON.stringify(payload), before);
});

test('a failed readback leaves the original stored request available for safe recovery', async () => {
  let stored = false;
  global.localStorage = { ...storage,
    getItem(key) { if (stored && key.startsWith('rosario:pending-')) throw new Error('Readback blocked'); return storage.getItem(key); },
    setItem(key, value) { storage.setItem(key, value); stored = true; },
  };
  await assert.rejects(api.encodingService.create(payload), /storage/i); assert.equal(writes.length, 0);
  global.localStorage = storage; api = load();
  assert.equal(api.encodingService.pending().id, payload.request_id);
  let sent;
  api.http.defaults.adapter = async config => { sent = JSON.parse(config.data); return reply(config); };
  await api.encodingService.create(payload);
  assert.equal(sent.request_id, payload.request_id); assert.deepEqual(sent.items, payload.items);
});

test('timeout, reload and unavailable retry storage retain the exact original UUID and payload', async () => {
  api.http.defaults.adapter = async config => { writes.push(JSON.parse(config.data)); throw new AxiosError('Timeout', AxiosError.ECONNABORTED); };
  await assert.rejects(api.encodingService.create(payload));
  const pending = api.encodingService.pending(), original = values.get(pending.key);
  api = load();
  global.localStorage = { ...storage, getItem(key) { if (key.startsWith('rosario:pending-')) throw new Error('Blocked'); return storage.getItem(key); } };
  api.http.defaults.adapter = async config => { writes.push(JSON.parse(config.data)); return reply(config); };
  await assert.rejects(api.encodingService.create(payload), /storage/i);
  assert.equal(writes.length, 1); assert.equal(values.get(pending.key), original);
  global.localStorage = storage;
  await api.encodingService.create(payload);
  assert.equal(writes.length, 2); assert.deepEqual(writes[1], writes[0]); assert.equal(api.encodingService.pending(), null);
});

test('an already persisted retry does not need to rewrite storage or normalize its legacy neutral payload', async () => {
  const legacy = { ...payload, items: [{ ...payload.items[0], discount_type: 'none', discount_value: '0.00' }] };
  const fields = { transaction_date: legacy.transaction_date, customer_id: legacy.customer_id, si_number: legacy.si_number,
    note: legacy.note, payment_method: legacy.payment_method, payment_status: legacy.payment_status, amount_tendered: legacy.amount_tendered, items: legacy.items };
  api.storePendingRequest('encoding', legacy.request_id, JSON.stringify(fields), { payload: legacy, lines: [] });
  global.localStorage = { ...storage, setItem() { throw new Error('Writes now blocked'); } };
  await api.encodingService.create(payload);
  assert.deepEqual(writes, [legacy]);
});

test('history acknowledgement cannot hide a saved request when durable removal fails', async () => {
  api.http.defaults.adapter = async () => { throw new AxiosError('Timeout'); };
  await assert.rejects(api.encodingService.create(payload));
  const pending = api.encodingService.pending(), original = values.get(pending.key);
  for (const blocked of [
    { ...storage, removeItem() { throw new Error('Blocked'); } },
    { ...storage, removeItem() {} },
  ]) {
    global.localStorage = blocked;
    assert.equal(api.encodingService.clearPending(), false);
    assert.equal(api.encodingService.pending().id, payload.request_id); assert.equal(values.get(pending.key), original);
  }
  global.localStorage = storage;
  assert.equal(api.encodingService.clearPending(), true); assert.equal(api.encodingService.pending(), null);
});

test('durable verification and clearing never overwrite or delete a different stored submission', () => {
  const saved = api.storePendingRequest('encoding', payload.request_id, 'fingerprint', { payload }, { durable: true });
  const replacement = { ...saved, id: '550e8400-e29b-41d4-a716-446655440088', payload: { payload: { ...payload, note: 'Different' } } };
  values.set(saved.key, JSON.stringify(replacement));
  assert.throws(() => api.verifyDurablePendingRequest(saved), /storage/i);
  assert.equal(api.clearPendingRequest(saved, { durable: true }), false);
  assert.throws(() => api.storePendingRequest('encoding', payload.request_id, 'fingerprint', { payload }, { durable: true }), /storage/i);
  assert.deepEqual(JSON.parse(values.get(saved.key)), replacement);
});

test('default pending-request storage remains compatible for non-encoding consumers', () => {
  global.localStorage = { ...storage, setItem() { throw new Error('Full'); } };
  const pending = api.storePendingRequest('outflow', payload.request_id, 'outflow', { quantity: '1' });
  assert.equal(api.readPendingRequest('outflow').id, pending.id);
  assert.equal(api.clearPendingRequest(pending), true); assert.equal(api.readPendingRequest('outflow'), null);
});
