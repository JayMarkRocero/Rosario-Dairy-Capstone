const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
let states, refs, effects, effectSlots, stateIndex, refIndex, effectIndex, reads, snapshots, capacity, capacityOptions;
const hooks = {
  ...React,
  useState(initial) {
    const i = stateIndex++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  },
  useRef(initial) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); },
  useMemo: fn => fn(), useCallback: fn => fn,
  useLayoutEffect() {},
  useEffect(effect, dependencies) {
    const i = effectIndex++, previous = effectSlots[i];
    if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) {
      effectSlots[i] = dependencies; effects.push(effect);
    }
  },
};
const source = buildSync({ stdin: { contents: `
  export * from './src/features/sales/hooks/useHistoryPage';
  export { EnhancedTable } from './src/components/data-display/EnhancedTable';
  export { clearDataCache } from './src/lib/dataCache';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  alias: { '@': path.join(root, 'src'), '@/hooks/useCachedQuery': 'history-test-query', '@/hooks/useAutoPageSize': 'history-test-capacity' },
  external: ['history-test-query', 'history-test-capacity'] }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests/history-pagination-memory.cjs'), module);
loaded.filename = path.join(root, 'tests/history-pagination-memory.cjs'); loaded.paths = module.paths;
loaded.require = name => name === 'react' ? hooks : name === 'history-test-capacity' ? { useAutoPageSize: (_height, _offset, options) => { capacityOptions = options; return capacity; } }
  : name === 'history-test-query' ? { useCachedQuery: (key, fetcher, groups, enabled, options) => {
    reads.push({ key, fetcher, groups, enabled, options });
    const snapshot = snapshots.get(key) || {};
    return { ...snapshot, loading: !!enabled && !snapshot.data && !snapshot.error, refresh() {} };
  } } : require(name);
loaded._compile(source, loaded.filename);
const api = loaded.exports;
const render = fn => { stateIndex = refIndex = effectIndex = 0; reads = []; const result = fn(); effects.splice(0).forEach(effect => effect()); return result; };
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : React.Children.toArray(node?.props?.children).map(text).join('');
const columns = [{ key: 'name', header: 'Name', sortKey: row => row.name, render: row => row.name }];
const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 6, name: `Row ${i + 6}` }));
const request = (overrides = {}) => ({ page: 1, pageSize: 5, search: '', sortCol: null, sortDir: null, ...overrides });
beforeEach(() => {
  states = []; refs = []; effects = []; effectSlots = []; snapshots = new Map();
  capacity = { pageSize: 8, containerRef() {}, headerRef() {}, footerRef() {} };
  capacityOptions = undefined;
  global.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
});

test('remote page uses the server count and does not slice page-two rows again', () => {
  let changed;
  const props = { columns, data: rows, rowKey: row => row.id, pageSize: 5, contentHeight: true,
    remote: { active: true, count: 22, onChange: value => { changed = value; }, resetKey: 'scope' } };
  let tree = render(() => api.EnhancedTable(props));
  nodes(tree).find(node => node.type === 'button' && node.props.children === 2).props.onClick();
  tree = render(() => api.EnhancedTable(props));
  assert.match(text(tree), /Page 2 of 5/);
  assert.equal(nodes(tree).filter(node => node.type === 'tbody').flatMap(node => React.Children.toArray(node.props.children)).length, 5);
  assert.deepEqual(changed, request({ page: 2 }));
});

test('Sales History requests the measured capacity and derives 4840-record pagination from the server count', async () => {
  capacity.pageSize = 6;
  let requested;
  const props = { columns, data: rows, rowKey: row => row.id, responsivePageSize: true, contentHeight: true,
    remote: { active: true, count: 4840, pageSize: 6, onChange: value => { requested = value; }, resetKey: 'all' }, fitActualRows: true,
    measurementKey: 'sales-history:single-payment-placeholder:all' };
  const tree = render(() => api.EnhancedTable(props));
  assert.equal(requested.pageSize, 6); assert.match(text(tree), /Page 1 of 807/);
  assert.equal(capacityOptions.requestedPageSize, 6); assert.equal(capacityOptions.fitActualRows, true);
  assert.equal(Math.ceil(4840 / 4), 1210, 'The observed old count follows a four-row capacity, not a backend record-count error');
  states = []; refs = []; effectSlots = [];
  const calls = [];
  const view = () => api.useHistoryPage('sales:history', ':All', async (page, pageSize) => { calls.push({ page, pageSize }); return { count: 4840, results: rows }; }, async () => [], ['sales']);
  let page = render(view); page.controls.onChange(requested); render(view);
  assert.equal(reads[0].key, 'sales:history::All:page:1:6');
  await reads[0].fetcher(); assert.deepEqual(calls, [{ page: 1, pageSize: 6 }]);
  snapshots.set('sales:history::All:page:1:6', { data: { count: 4840, results: rows } });
  page = render(view); assert.equal(page.controls.count, 4840);
  for (let i = 0; i < 4; i++) { page.controls.onChange(requested); page = render(view); }
  assert.equal(calls.length, 1, 'Unchanged measured capacity does not require another page request');
});

test('a newly measured smaller Sales History capacity hides only the excess prefix while its replacement page loads', () => {
  capacity.pageSize = 4;
  const props = { columns, data: rows, rowKey: row => row.id, responsivePageSize: true, contentHeight: true, fitActualRows: true,
    remote: { active: true, count: 4840, pageSize: 5, onChange() {}, resetKey: 'all' } };
  const tree = render(() => api.EnhancedTable(props));
  const body = nodes(tree).find(node => node.type === 'tbody');
  assert.equal(React.Children.toArray(body.props.children).length, 4);
  assert.match(text(tree), /Row 6/); assert.doesNotMatch(text(tree), /Row 10/);
  assert.equal(nodes(tree).filter(node => node.props['aria-label'] === 'Loading records').length, 0);
});

test('tables without remote mode retain local slicing and their original page size', () => {
  const props = { columns, data: [...rows, ...rows.map(row => ({ ...row, id: row.id + 5 }))], rowKey: row => row.id, pageSize: 5, contentHeight: true };
  let tree = render(() => api.EnhancedTable(props));
  assert.match(text(tree), /Page 1 of 2/);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 2).props.onClick();
  tree = render(() => api.EnhancedTable(props));
  assert.match(text(tree), /Page 2 of 2/);
  assert.equal(nodes(tree).filter(node => node.type === 'tbody').flatMap(node => React.Children.toArray(node.props.children)).length, 5);
});

test('remote requests retain responsive measured capacity and reset the page on scope changes', () => {
  let changed;
  const props = { columns, data: rows, rowKey: row => row.id, responsivePageSize: true, contentHeight: true,
    remote: { active: true, count: 40, onChange: value => { changed = value; }, resetKey: 'cash' } };
  let tree = render(() => api.EnhancedTable(props));
  assert.equal(changed.pageSize, 8);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 2).props.onClick();
  render(() => api.EnhancedTable(props));
  assert.equal(changed.page, 2);
  props.remote.resetKey = 'online'; render(() => api.EnhancedTable(props));
  tree = render(() => api.EnhancedTable(props));
  assert.match(text(tree), /Page 1 of 5/); assert.equal(changed.page, 1);
});

test('payment refreshes and partial final pages retain one measurement scope; local Inventory keeps its existing reset key', () => {
  const props = { columns, data: rows, rowKey: row => row.id, responsivePageSize: true, contentHeight: true,
    remote: { active: true, count: 17, onChange() {}, resetKey: 'sales:all:0' } };
  render(() => api.EnhancedTable(props));
  const measurement = capacityOptions.measurementKey;
  assert.equal(measurement, 'sales:all:0');
  props.data = [rows[0]];
  let tree = render(() => api.EnhancedTable(props));
  assert.equal(capacityOptions.measurementKey, measurement, 'A shorter final page cannot reset the tallest measured row');
  props.data = [{ ...rows[0], payment_status: 'paid' }];
  for (let i = 0; i < 4; i++) {
    tree = render(() => api.EnhancedTable(props));
    assert.equal(capacityOptions.measurementKey, measurement);
    assert.equal(nodes(tree).filter(node => node.props['aria-label'] === 'Loading records').length, 0);
    assert.match(text(tree), /Row 6/);
  }
  props.remote.resetKey = 'sales:cash:0'; render(() => api.EnhancedTable(props));
  assert.equal(capacityOptions.measurementKey, 'sales:cash:0', 'Explicit filters can remeasure density');
  delete props.remote; render(() => api.EnhancedTable(props));
  assert.equal(capacityOptions.measurementKey, props.data, 'Inventory/default table behavior is untouched');
  props.measurementKey = 'staff:7:All'; render(() => api.EnhancedTable(props));
  assert.equal(capacityOptions.measurementKey, 'staff:7:All', 'Staff history can keep its local array refreshes stable too');
});

test('history hook pages default views and uses complete data for display-label search and manual sorting', async () => {
  const calls = [], getPage = async (page, size, signal) => { calls.push({ page, size, signal }); return { count: 22, results: rows }; };
  const getAll = async () => rows;
  const view = () => api.useHistoryPage('sales:history', 'cash', getPage, getAll, ['sales']);
  let result = render(view);
  assert.equal(reads[0].enabled, true); assert.equal(reads[1].enabled, false);
  const signal = new AbortController().signal; await reads[0].fetcher(signal);
  assert.deepEqual(calls, [{ page: 1, size: 5, signal }]);
  result.controls.onChange(request({ search: 'Walk-in' })); result = render(view);
  assert.equal(result.controls.active, false); assert.equal(reads[0].enabled, false); assert.equal(reads[1].enabled, true);
  assert.equal(await reads[1].fetcher(), rows);
  result.controls.onChange(request({ sortCol: 'cashier', sortDir: 'asc' })); result = render(view);
  assert.equal(result.controls.active, false);
  result.controls.onChange(request({ page: 2, pageSize: 8 })); render(view);
  assert.equal(reads[0].key, 'sales:history:cash:page:2:8');
  assert.deepEqual(reads[0].options, { cancelable: true });
});

test('history cache keys isolate filters and preserve server count while a new page is loading', () => {
  const view = scope => api.useHistoryPage('sales:history', scope, async () => ({}), async () => [], ['sales']);
  snapshots.set('sales:history:cash:page:1:5', { data: { count: 42, results: rows } });
  let result = render(() => view('cash'));
  assert.equal(result.controls.count, 42); assert.equal(result.data, rows);
  result.controls.onChange(request({ page: 2 })); result = render(() => view('cash'));
  assert.equal(result.controls.count, 42); assert.equal(result.loading, false);
  assert.equal(result.refreshing, true); assert.equal(result.data, rows);
  result = render(() => view('online'));
  assert.equal(reads[0].key, 'sales:history:online:page:1:5');
  assert.equal(result.data, undefined); assert.notEqual(result.controls.resetKey, 'cash:0');
});

test('a measured-capacity handoff keeps usable rows and the table surface mounted instead of cycling to skeleton estimates', () => {
  const view = () => api.useHistoryPage('sales:history', 'all', async () => ({}), async () => [], ['sales']);
  snapshots.set('sales:history:all:page:1:5', { data: { count: 42, results: rows } });
  let result = render(view);
  result.controls.onChange(request({ pageSize: 8 }));
  result = render(view);
  assert.equal(reads[0].key, 'sales:history:all:page:1:8');
  assert.equal(result.loading, false); assert.equal(result.refreshing, true);
  assert.equal(result.data, rows);
  const parentState = states, parentRefs = refs, parentEffects = effectSlots;
  states = []; refs = []; effectSlots = [];
  const tree = render(() => api.EnhancedTable({ columns, rowKey: row => row.id, data: result.data,
    loading: result.loading, responsivePageSize: true, remote: { ...result.controls, onChange() {} }, contentHeight: true }));
  assert.equal(nodes(tree).filter(node => node.props['aria-label'] === 'Loading records').length, 0);
  assert.equal(nodes(tree).filter(node => node.props['data-table-surface'] === true).length, 1);
  states = parentState; refs = parentRefs; effectSlots = parentEffects;
  snapshots.set('sales:history:all:page:1:8', { data: { count: 42, results: [...rows, ...rows.slice(0, 3)] } });
  result = render(view); assert.equal(result.refreshing, false); assert.equal(result.data.length, 8);
  result.controls.onChange(request({ pageSize: 4 })); result = render(view);
  assert.equal(result.data.length, 4, 'Retained rows cannot overflow the newly measured capacity');
  assert.equal(result.loading, false);
});

test('retained rows never cross account/filter/mode boundaries and real refresh errors remain retryable', () => {
  const view = scope => api.useHistoryPage('encoding', scope, async () => ({}), async () => [], ['sales']);
  snapshots.set('encoding:paid:page:1:5', { data: { count: 42, results: rows } });
  let result = render(() => view('paid'));
  result.controls.onChange(request({ page: 2 }));
  snapshots.set('encoding:paid:page:2:5', { error: { status: 503, message: 'Offline' } });
  result = render(() => view('paid'));
  assert.equal(result.data, rows); assert.equal(result.refreshError.status, 503);
  assert.equal(result.error, undefined); assert.equal(result.loading, false);
  snapshots.set('encoding:paid:page:2:5', { error: { status: 403 } });
  result = render(() => view('paid'));
  assert.equal(result.data, undefined); assert.equal(result.error.status, 403);
  snapshots.delete('encoding:paid:page:2:5');
  result.controls.onChange(request()); result = render(() => view('paid'));
  api.clearDataCache(); snapshots.clear();
  result = render(() => view('paid'));
  assert.equal(result.data, undefined); assert.equal(result.loading, true);
  snapshots.set('encoding:paid:page:1:5', { data: { count: 42, results: rows } });
  result = render(() => view('paid'));
  result.controls.onChange(request({ search: 'Walk-in' })); result = render(() => view('paid'));
  assert.equal(result.data, undefined, 'A partial server page cannot stand in for complete search results');
  assert.equal(result.loading, true);
});

test('loaded table rows remain mounted when a background loader reports busy', () => {
  const tree = render(() => api.EnhancedTable({ columns, rowKey: row => row.id, data: rows,
    loading: true, contentHeight: true }));
  assert.equal(nodes(tree).filter(node => node.props['aria-label'] === 'Loading records').length, 0);
  assert.equal(React.Children.toArray(nodes(tree).find(node => node.type === 'tbody').props.children).length, 5);
  assert.match(text(tree), /Row 6/);
  assert.equal(nodes(tree).filter(node => node.props['data-table-surface'] === true).length, 1);
});

test('deleted last pages recover through page one; cancellation and other errors are never retried', async () => {
  const calls = [], signal = new AbortController().signal;
  const getPage = async (page, size, passedSignal) => { calls.push([page, size, passedSignal]); if (page > 1) throw { status: 404 }; return { count: 2, results: rows.slice(0, 2) }; };
  const view = () => api.useHistoryPage('encoding', 'paid', getPage, async () => [], ['sales']);
  let result = render(view); result.controls.onChange(request({ page: 4 })); render(view);
  const recovered = await reads[0].fetcher(signal);
  assert.equal(recovered.count, 2); assert.deepEqual(calls.map(call => call[0]), [4, 1]);
  assert.ok(calls.every(call => call[2] === signal)); result = render(view);
  assert.equal(reads[0].key, 'encoding:paid:page:1:5'); assert.equal(result.controls.resetKey, 'paid:1');
  result.controls.onChange(request({ page: 3 })); render(view);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(reads[0].fetcher(controller.signal), error => error.status === 404);
  assert.deepEqual(calls.map(call => call[0]), [4, 1, 3]);
});
