const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { StaffKPICards } from './src/features/dashboard/components/staff/StaffKPICards';
  export { default as http, ApiError } from './src/lib/api';
  export * from './src/lib/dataCache';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
let api, states, refs, stateIndex, refIndex, effects, cleanups, context;
const hooks = { ...React,
  useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useContext() { return context; }, useMemo: fn => fn(),
  useEffect(effect) { effects.push(effect); },
};
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function render() { stateIndex = refIndex = 0; effects = []; return api.StaffKPICards(); }
function cards(tree = render()) { return tree.props.children; }
function mount() { render(); cleanups.push(...effects.map(effect => effect()).filter(Boolean)); }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const sale = () => ({ id: 1, created_at: `${today()}T12:00:00+08:00`, total_amount: '123.45', payment_method: 'cash', handled_by: { id: 7, username: 'cashier' } });
const order = (id, staffId) => ({ id, status: 'fulfilled', customer: { id: 1, name: 'Customer' }, handled_by: { id: staffId, username: `staff-${staffId}` }, transaction: { total_amount: '123.45' }, items: [], created_at: `${today()}T12:00:00+08:00` });
beforeEach(() => {
  states = []; refs = []; stateIndex = refIndex = 0; effects = []; cleanups = [];
  context = { theme: 'light', user: { id: 7, username: 'cashier', role: 'staff' }, loading: false };
  global.document = undefined; global.window = new EventTarget();
  const tokens = new Map(); global.localStorage = { getItem: key => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: key => tokens.delete(key) };
  const loaded = new Module(path.join(root, 'tests', 'staff-kpi-memory.cjs'), module);
  loaded.filename = path.join(root, 'tests', 'staff-kpi-memory.cjs'); loaded.paths = module.paths;
  loaded.require = id => id === 'react' ? hooks : id === 'sonner' ? { toast: { error() {} } } : require(id);
  loaded._compile(compiled, loaded.filename); api = loaded.exports;
});
afterEach(() => { cleanups.reverse().forEach(cleanup => cleanup()); api.clearDataCache(); });

test('staff sales resolve independently of complete order history and inventory without zero flashes', async () => {
  const sales = deferred(), orders = deferred(), inventory = deferred(), calls = [];
  api.http.defaults.adapter = async config => {
    calls.push(config);
    let data;
    if (config.url === '/sales/transactions/') data = await sales.promise;
    else if (config.url === '/sales/orders/') { await orders.promise; data = { count: 2, next: config.params.page === 1 ? 'next' : null,
      results: [order(config.params.page, config.params.page === 1 ? 8 : 7)] }; }
    else { await inventory.promise; data = []; }
    return { data, status: 200, headers: {}, config };
  };
  mount(); await settle();
  assert.ok(cards().every(card => card.props.value === '—' && card.props.trendLabel === 'Updating'));
  sales.resolve([sale()]); await settle();
  const loadedSales = cards();
  assert.equal(loadedSales[0].props.value, '₱123.45'); assert.equal(loadedSales[1].props.value, '1');
  assert.equal(loadedSales[0].props.trendLabel, 'Today'); assert.equal(loadedSales[2].props.value, '—'); assert.equal(loadedSales[3].props.value, '—');
  const request = calls.find(call => call.url === '/sales/transactions/');
  assert.equal(request.params.handled_by, 7); assert.equal(request.params.start_date, today()); assert.equal(request.params.end_date, today());
  orders.resolve(); await settle();
  assert.deepEqual(calls.filter(call => call.url === '/sales/orders/').map(call => call.params.page), [1, 2]);
  assert.equal(cards()[2].props.value, '1', 'Fulfilled count uses every order page and the current staff ID');
  inventory.resolve(); await settle();
  assert.equal(cards()[3].props.value, '0 / 0'); assert.equal(render().props['aria-busy'], false);
});

test('a staff order failure does not suppress successful sales or inventory metrics', async () => {
  api.http.defaults.adapter = async config => {
    if (config.url === '/sales/orders/') throw new api.ApiError(503, 'Orders unavailable');
    return { data: config.url === '/sales/transactions/' ? [sale()] : [], status: 200, headers: {}, config };
  };
  mount(); await settle(); const result = cards();
  assert.equal(result[0].props.value, '₱123.45'); assert.equal(result[1].props.value, '1');
  assert.equal(result[2].props.value, '—'); assert.equal(result[2].props.trendLabel, 'Unavailable');
  assert.equal(result[3].props.value, '0 / 0');
});

test('staff KPI reads stay disabled until identity initialization completes', async () => {
  context = { ...context, user: null, loading: true };
  let requests = 0; api.http.defaults.adapter = async () => { requests++; throw new Error('Unexpected request'); };
  mount(); await settle();
  assert.equal(requests, 0); assert.ok(cards().every(card => card.props.value === '—' && card.props.trendLabel === 'Loading account'));
});

test('leaving staff KPI groups cancels sales/order reads and all group deadlines', async () => {
  const finish = deferred(), requests = [];
  api.http.defaults.adapter = async config => { requests.push(config); await finish.promise; return { data: [], status: 200, headers: {}, config }; };
  mount(); await settle();
  const getSales = requests.find(call => call.url === '/sales/transactions/'), getOrders = requests.find(call => call.url === '/sales/orders/');
  assert.equal(getSales.signal.aborted, false); assert.equal(getOrders.signal.aborted, false);
  cleanups.reverse().forEach(cleanup => cleanup()); cleanups = [];
  assert.equal(getSales.signal.aborted, true); assert.equal(getOrders.signal.aborted, true);
  finish.resolve(); await settle();
  assert.equal(requests.filter(call => call.url === '/sales/orders/').length, 1);
  assert.equal(api.readDataCache(`${api.dataCacheEpoch()}:dashboard:staff-sales:7:${today()}`).error, undefined);
});
