const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError, isCancel } = require('axios');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { default as http } from './src/lib/api';
  export * from './src/lib/api';
  export * from './src/lib/dataCache';
  export * from './src/features/sales/api/sales.service';
  export * from './src/features/sales/api/encoding.service';
  export * from './src/features/orders/api/orders.service';
  export * from './src/features/customers/api/customers.service';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
let api;
const settle = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const reply = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data });
beforeEach(() => {
  const loaded = new Module(path.join(root, 'tests', 'cancel-memory.cjs'), module);
  loaded.filename = path.join(root, 'tests', 'cancel-memory.cjs'); loaded.paths = module.paths;
  loaded._compile(compiled, loaded.filename); api = loaded.exports;
  const storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
});

test('full-history reads preserve every page, query parameter and existing page sizes', async () => {
  const calls = [];
  api.http.defaults.adapter = async config => {
    calls.push(config);
    return reply(config, { count: 3, results: config.params.page === 1 ? [1, 2] : [3], next: config.params.page === 1 ? 'next' : null });
  };
  const controller = new AbortController();
  assert.deepEqual(await api.getAllPages('/sales/transactions/', { page_size: 200, start_date: '2026-10-01' }, controller.signal), [1, 2, 3]);
  assert.deepEqual(calls.map(call => call.params), [
    { page_size: 200, start_date: '2026-10-01', page: 1 }, { page_size: 200, start_date: '2026-10-01', page: 2 },
  ]);
  assert.ok(calls.every(call => call.signal === controller.signal));
});

test('an aborted full-history read stops its active GET and never requests another page', async () => {
  const controller = new AbortController(), second = deferred(), calls = [];
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.params.page === 2) await second.promise;
    return reply(config, { count: 100, results: [config.params.page], next: 'next' });
  };
  const request = api.getAllPages('/sales/orders/', { page_size: 500 }, controller.signal);
  const rejected = assert.rejects(request, isCancel);
  await settle(); assert.equal(calls.length, 2);
  controller.abort(); assert.equal(calls[1].signal.aborted, true);
  second.resolve(); await rejected; assert.equal(calls.length, 2);
  await assert.rejects(api.getAllPages('/sales/orders/', undefined, controller.signal), isCancel);
  assert.equal(calls.length, 2, 'An already aborted read must not dispatch');
});

test('account changes stop old page chains even when the caller has no signal', async () => {
  const first = deferred(), calls = [];
  api.http.defaults.adapter = async config => { calls.push(config); await first.promise; return reply(config, { count: 2, results: [1], next: 'next' }); };
  const request = api.getAllPages('/sales/orders/');
  const rejected = assert.rejects(request, error => isCancel(error) || error.status === 409);
  await settle(); api.setAccessToken('different-user'); first.resolve(); await rejected;
  assert.equal(calls.length, 1);
});

test('cancellable shared cache reads abort only when the last consumer leaves', async () => {
  const result = deferred(); let signal, loads = 0;
  const leaveFirst = api.subscribeDataCache('orders', () => {}), leaveSecond = api.subscribeDataCache('orders', () => {});
  const fetcher = input => { signal = input; loads++; return result.promise; };
  const first = api.fetchDataCache('orders', fetcher, ['orders'], false, { cancelable: true });
  const second = api.fetchDataCache('orders', fetcher, ['orders'], false, { cancelable: true });
  const rejected = Promise.all([assert.rejects(first, { name: 'AbortError' }), assert.rejects(second, { name: 'AbortError' })]);
  await settle(); assert.equal(loads, 1); leaveFirst(); assert.equal(signal.aborted, false);
  leaveSecond(); assert.equal(signal.aborted, true); result.resolve('old'); await rejected;
  assert.deepEqual(api.readDataCache('orders'), { updatedAt: 0 });
  await api.fetchDataCache('orders', async () => 'new', ['orders'], false, { cancelable: true });
  assert.equal(api.readDataCache('orders').data, 'new');
});

test('live invalidation cancels obsolete reads immediately, keeps loaded data and ignores late results', async () => {
  api.writeDataCache('sales', ['existing'], ['sales']);
  const result = deferred(); let oldSignal;
  const old = api.fetchDataCache('sales', signal => { oldSignal = signal; return result.promise; }, ['sales'], true, { cancelable: true });
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await settle(); api.invalidateDataCache(['sales'], { deferPending: true });
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(api.readDataCache('sales').data, ['existing']);
  await api.fetchDataCache('sales', async () => ['latest'], ['sales'], false, { cancelable: true });
  result.resolve(['obsolete']); await rejected;
  assert.deepEqual(api.readDataCache('sales').data, ['latest']);
  assert.equal(api.readDataCache('sales').error, undefined);
});

test('cache writes and session clearing abort obsolete GETs without deleting replacement data', async () => {
  for (const action of ['write', 'clear']) {
    const result = deferred(); let signal;
    const read = api.fetchDataCache(action, input => { signal = input; return result.promise; }, ['orders'], false, { cancelable: true });
    const rejected = assert.rejects(read, { name: 'AbortError' });
    await settle();
    if (action === 'write') api.writeDataCache(action, ['replacement'], ['orders']); else api.clearDataCache();
    assert.equal(signal.aborted, true); result.resolve(['old']); await rejected;
    assert.deepEqual(api.readDataCache(action).data, action === 'write' ? ['replacement'] : undefined);
    assert.equal(api.readDataCache(action).error, undefined);
  }
});

test('a failed parallel loader cancels remaining reads and preserves the real error', async () => {
  let signal;
  const error = new api.ApiError(503, 'Unavailable');
  await assert.rejects(api.fetchDataCache('kpis', input => { signal = input; return Promise.reject(error); }, ['dashboard'], false, { cancelable: true }), error);
  assert.equal(signal.aborted, true); assert.equal(api.readDataCache('kpis').error, error);
});

test('history, orders, encoding, recent orders and customer-history services forward cancellation without changing contracts', async () => {
  const calls = [], controller = new AbortController();
  api.http.defaults.adapter = async config => { calls.push(config); return reply(config, { results: [], count: 0, next: null }); };
  await api.salesService.getAll({ startDate: '2026-10-01', handledBy: 7 }, controller.signal);
  await api.salesService.getMine(7, controller.signal);
  await api.ordersService.getAll(controller.signal);
  await api.ordersService.getRecent(5, controller.signal);
  await api.encodingService.list({ payment_status: 'pending' }, controller.signal);
  await api.customersService.getTransactions(3, 2, true, controller.signal);
  assert.ok(calls.every(call => call.method === 'get' && call.signal === controller.signal));
  assert.equal(calls[0].params.start_date, '2026-10-01'); assert.equal(calls[0].params.page_size, 200);
  assert.equal(calls[1].params.handled_by, 7);
  assert.deepEqual(calls[2].params, { page_size: 500, page: 1 });
  assert.deepEqual(calls[3].params, { page: 1, page_size: 5 });
  assert.deepEqual(calls[4].params, { page_size: 200, payment_status: 'pending', page: 1 });
  assert.deepEqual(calls[5].params, { page: 2, page_size: 10, include_voided: true });
});

test('an obsolete 401 does not trigger JWT refresh or clear the active session', async () => {
  api.setAccessToken('valid-access'); api.setRefreshToken('valid-refresh');
  const controller = new AbortController(), response = deferred(), calls = [];
  api.http.defaults.adapter = async config => {
    calls.push(config); await response.promise;
    throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { ...reply(config, {}), status: 401 });
  };
  const read = api.http.get('/sales/orders/', { signal: controller.signal });
  const rejected = assert.rejects(read, isCancel);
  await settle(); controller.abort(); response.resolve(); await rejected;
  assert.equal(calls.length, 1); assert.equal(api.getAccessToken(), 'valid-access'); assert.equal(api.getRefreshToken(), 'valid-refresh');
});
