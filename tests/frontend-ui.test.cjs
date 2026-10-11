const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');

// Exercise real event handlers with deterministic hook state, without a browser or database writes.
let states, refs, stateIndex, refIndex, effects, authState, toastErrors;
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useId() { return `test-tooltip-${refIndex++}`; },
  useEffect(effect) { effects.push(effect); }, useLayoutEffect() {},
  useContext() { return { theme: 'light', ...authState }; },
  useMemo: fn => fn(), useCallback: fn => fn,
};
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { default as http } from './src/lib/api';
    export { ConfirmDialog } from './src/components/feedback/ConfirmDialog';
    export { AdminReports } from './src/features/reports/pages/AdminReports';
    export { CreateOrderModal } from './src/features/orders/components/CreateOrderModal';
    export { StaffPOS } from './src/features/pos/pages/StaffPOS';
    export { StaffKPICards } from './src/features/dashboard/components/staff/StaffKPICards';
    export { MobileInventoryCard } from './src/features/inventory/components/MobileInventoryCard';
    export { EnhancedTable } from './src/components/data-display/EnhancedTable';
    export * from './src/features/inventory/components/InventoryWarnings';
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'ui-in-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'ui-in-memory.cjs');
loaded.paths = module.paths;
loaded.require = id => id === 'react' ? hooks : id === 'react-dom' ? { ...require(id), createPortal: children => children } : id === 'sonner' ? {
  ...require(id), toast: Object.assign(() => {}, { error: (...args) => toastErrors.push(args), success() {}, warning() {} }),
} : require(id);
loaded._compile(compiled, loaded.filename);
const ui = loaded.exports;
const render = (component, props = {}) => { stateIndex = refIndex = 0; return component(props); };
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
beforeEach(() => {
  states = []; refs = []; effects = []; stateIndex = refIndex = 0;
  authState = { user: { username: 'audit' }, loading: false };
  toastErrors = [];
  const token = `header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`;
  global.localStorage = { getItem: key => key === 'rosario_access_token' ? token : null, setItem() {}, removeItem() {} };
  global.window = new EventTarget();
  global.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

test('mobile inventory cards toggle metadata and preserve edit and delete actions', () => {
  const product = { id: 385, name: 'Milk with a long product name', cat: 'Milk and dairy drinks', price: 120, stock: 19, expiry: '2099-10-17', low: false, reorderThreshold: 5, nearestBatch: { number: 'BATCH-01', quantity: 19 } };
  let edited, deleted;
  const props = { product, status: 'Active', onEdit: value => edited = value, onDelete: value => deleted = value };
  let tree = render(ui.MobileInventoryCard, props);
  let buttons = elements(tree, node => node.type === 'button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props['aria-expanded'], false);
  assert.equal(elements(tree, node => node.type === 'dl').length, 0);
  buttons[0].props.onClick();
  tree = render(ui.MobileInventoryCard, props);
  buttons = elements(tree, node => node.type === 'button');
  assert.equal(buttons[0].props['aria-expanded'], true);
  assert.equal(elements(tree, node => node.type === 'dd').length, 5);
  assert.ok(elements(tree, node => node.type === 'dd').some(node => node.props.children === 'PRD-385'));
  assert.ok(elements(tree, node => node.type === 'dd').some(node => String(node.props.children).includes('BATCH-01')));
  buttons[1].props.onClick(); buttons[2].props.onClick();
  assert.equal(edited, product); assert.equal(deleted, product);
  tree = render(ui.MobileInventoryCard, { ...props, busy: true });
  assert.ok(elements(tree, node => node.type === 'button').slice(1).every(node => node.props.disabled));
  buttons[0].props.onClick();
  assert.equal(elements(render(ui.MobileInventoryCard, props), node => node.type === 'dl').length, 0);
});

test('inventory mobile renderer shares search, sorting and pagination with the desktop table', () => {
  const props = {
    columns: [{ key: 'name', header: 'Product', sortKey: row => row.name }, { key: 'price', header: 'Price', sortKey: row => row.price }],
    data: Array.from({ length: 6 }, (_, id) => ({ id, name: id % 2 ? 'Cheese' : 'Milk', price: id })),
    rowKey: row => row.id, pageSize: 2, searchKeys: row => [row.name], showExport: false,
    renderMobileRow: row => React.createElement('span', { 'data-mobile-id': row.id }, row.name),
  };
  const ids = tree => elements(tree, node => node.props['data-mobile-id'] !== undefined).map(node => node.props['data-mobile-id']);
  let tree = render(ui.EnhancedTable, props);
  assert.deepEqual(ids(tree), [0, 1]);
  assert.ok(elements(tree, node => node.type === 'table')[0].props.className.includes('hidden md:table'));
  assert.equal(elements(tree, node => node.type === 'select').length, 0);
  elements(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'milk' } });
  tree = render(ui.EnhancedTable, props);
  assert.deepEqual(ids(tree), [0, 2]);
  elements(tree, node => node.type === 'th' && node.props['aria-sort'] !== undefined)[1].props.onClick();
  tree = render(ui.EnhancedTable, props);
  elements(tree, node => node.type === 'th' && node.props['aria-sort'] !== undefined)[1].props.onClick();
  tree = render(ui.EnhancedTable, props);
  assert.deepEqual(ids(tree), [4, 2]);
  elements(tree, node => node.type === 'button').at(-1).props.onClick();
  assert.deepEqual(ids(render(ui.EnhancedTable, props)), [0]);
});

test('inventory tooltip supports tap toggling, dismissal and prevents product row clicks', () => {
  global.document = { body: {} };
  window.innerWidth = 375; window.innerHeight = 800;
  const props = { message: 'Stock level (5) is at or below the reorder threshold (5).' };
  const event = { stopPropagation() { this.stopped = true; }, currentTarget: { getBoundingClientRect: () => ({ left: 350, top: 300, bottom: 328 }) } };
  try {
    let tree = render(ui.InventoryWarningTooltip, props);
    let button = elements(tree, node => node.type === 'button')[0];
    assert.equal(button.props.title, props.message);
    button.props.onClick(event);
    assert.equal(event.stopped, true);
    tree = render(ui.InventoryWarningTooltip, props);
    const tooltip = elements(tree, node => node.props.role === 'tooltip')[0];
    assert.equal(tooltip.props.children, props.message);
    assert.equal(tooltip.props.style.left, 127);
    button = elements(tree, node => node.type === 'button')[0];
    assert.equal(button.props['aria-expanded'], true);
    assert.equal(button.props['aria-describedby'], tooltip.props.id);
    button.props.onClick(event);
    assert.equal(elements(render(ui.InventoryWarningTooltip, props), node => node.props.role === 'tooltip').length, 0);
    button = elements(render(ui.InventoryWarningTooltip, props), node => node.type === 'button')[0];
    button.props.onClick(event);
    assert.equal(elements(render(ui.InventoryWarningTooltip, props), node => node.props.role === 'tooltip').length, 1);
    elements(render(ui.InventoryWarningTooltip, props), node => node.type === 'button')[0].props.onKeyDown({ key: 'Escape', stopPropagation() {} });
    assert.equal(elements(render(ui.InventoryWarningTooltip, props), node => node.props.role === 'tooltip').length, 0);
    button = elements(render(ui.InventoryWarningTooltip, props), node => node.type === 'button')[0];
    button.props.onClick(event);
    assert.equal(elements(render(ui.InventoryWarningTooltip, props), node => node.props.role === 'tooltip').length, 1);
    elements(render(ui.InventoryWarningTooltip, props), node => node.type === 'button')[0].props.onBlur();
    assert.equal(elements(render(ui.InventoryWarningTooltip, props), node => node.props.role === 'tooltip').length, 0);
  } finally { delete global.document; }
});

test('stock warning icon is independent of expiry and mobile metadata uses shared warning displays', () => {
  const product = { id: 1, name: 'Milk', stock: 20, reorderThreshold: 5, low: false, expiry: '2000-01-01', cat: 'Dairy', price: 120 };
  assert.equal(elements(render(ui.InventoryStockValue, { product }), node => node.type === ui.InventoryWarningTooltip).length, 0);
  assert.equal(elements(render(ui.InventoryExpiryValue, { product }), node => node.type === ui.InventoryWarningTooltip).length, 1);
  const props = { product, onEdit() {}, onDelete() {} };
  states = [];
  let tree = render(ui.MobileInventoryCard, props);
  assert.equal(elements(tree, node => node.type === ui.InventoryStatusBadge).length, 1);
  elements(tree, node => node.type === 'button')[0].props.onClick();
  tree = render(ui.MobileInventoryCard, props);
  assert.equal(elements(tree, node => node.type === ui.InventoryStockValue).length, 1);
  assert.equal(elements(tree, node => node.type === ui.InventoryExpiryValue).length, 1);
});

test('stretched desktop inventory rows fill both full and partial pages', () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const props = {
    columns: [{ key: 'name', header: 'Product' }],
    data: Array.from({ length: 7 }, (_, id) => ({ id, name: `Product ${id}` })),
    rowKey: row => row.id, stretchRows: true, rowHeight: 56,
    pageCapacity: { pageSize: 5, containerRef() {}, headerRef() {} },
    showExport: false,
  };
  let tree = render(ui.EnhancedTable, props);
  let body = elements(tree, node => node.type === 'tbody')[0];
  assert.equal(elements(body, node => node.type === 'tr').length, 5);
  assert.equal(body.props.style.gridTemplateRows, 'repeat(5, minmax(0, 1fr))');
  elements(tree, node => node.type === 'button').at(-1).props.onClick();
  body = elements(render(ui.EnhancedTable, props), node => node.type === 'tbody')[0];
  assert.equal(elements(body, node => node.type === 'tr').length, 2);
  assert.equal(body.props.style.gridTemplateRows, 'repeat(2, minmax(0, 1fr))');
});

const staffCards = tree => elements(tree, node => typeof node.props.trendLabel === 'string');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('staff KPI requests wait for auth initialization then use the token identity', async () => {
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  };
  authState = { user: null, loading: true };
  const waiting = render(ui.StaffKPICards);
  effects.at(-1)();
  await settle();
  assert.equal(requests.length, 0);
  assert.ok(staffCards(waiting).every(card => card.props.trendLabel === 'Loading account'));
  authState = { user: { username: 'audit' }, loading: false };
  render(ui.StaffKPICards);
  const cleanup = effects.at(-1)();
  try {
    await settle();
    assert.equal(requests.find(request => request.url === '/sales/transactions/').params.handled_by, 7);
    assert.equal(render(ui.StaffKPICards).props['aria-busy'], false);
    assert.equal(toastErrors.length, 0);
  } finally { cleanup(); }
});

test('staff KPI missing identity shows inline fallback without requests or error toasts', async () => {
  let requests = 0;
  ui.http.defaults.adapter = async () => { requests++; throw new Error('Unexpected unscoped call'); };
  for (const user of [null, { username: 'audit' }]) {
    authState = { user, loading: false };
    global.localStorage.getItem = () => 'invalid-token';
    render(ui.StaffKPICards);
    effects.at(-1)();
    await settle();
    const unavailable = render(ui.StaffKPICards);
    assert.equal(unavailable.props['aria-busy'], false);
    assert.ok(staffCards(unavailable).every(card => card.props.value === '—' && card.props.trendLabel === 'Unavailable' && card.props.detail.includes('Please sign in again')));
  }
  assert.equal(requests, 0);
  assert.equal(toastErrors.length, 0);
});

test('staff KPI accepts an explicit context ID when a token ID is unavailable', async () => {
  const requests = [];
  authState = { user: { id: 12, username: 'audit' }, loading: false };
  global.localStorage.getItem = () => null;
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  };
  render(ui.StaffKPICards);
  const cleanup = effects.at(-1)();
  try {
    await settle();
    assert.equal(requests.find(request => request.url === '/sales/transactions/').params.handled_by, 12);
    assert.equal(render(ui.StaffKPICards).props['aria-busy'], false);
  } finally { cleanup(); }
});

test('staff KPI loading clears for empty responses and uses scoped sales requests', async () => {
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  };
  const initial = render(ui.StaffKPICards);
  assert.equal(initial.props['aria-busy'], true);
  assert.ok(staffCards(initial).every(card => card.props.trendLabel === 'Updating'));
  const cleanup = effects.at(-1)();
  try {
    await settle();
    const loaded = render(ui.StaffKPICards);
    assert.equal(loaded.props['aria-busy'], false);
    assert.deepEqual(staffCards(loaded).map(card => card.props.trendLabel), ['Today', 'Today', 'All time', 'In stock']);
    assert.deepEqual(staffCards(loaded).map(card => card.props.value), ['₱0', '0', '0', '0 / 0']);
    const sales = requests.find(request => request.url === '/sales/transactions/');
    assert.equal(sales.params.handled_by, 7);
    assert.equal(sales.params.start_date, sales.params.end_date);
    assert.equal(requests.some(request => request.url === '/accounts/user/'), false);
  } finally { cleanup(); }
});

test('staff KPI loading clears and displays the returned metrics', async () => {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  ui.http.defaults.adapter = async config => ({
    data: config.url === '/sales/transactions/' ? [{ id: 1, handled_by: { id: 7, username: 'audit' }, created_at: `${date}T12:00:00+08:00`, total_amount: '50.00', payment_method: 'cash' }] : [],
    status: 200, statusText: 'OK', headers: {}, config,
  });
  render(ui.StaffKPICards);
  const cleanup = effects.at(-1)();
  try {
    await settle();
    const loaded = render(ui.StaffKPICards);
    assert.equal(loaded.props['aria-busy'], false);
    assert.deepEqual(staffCards(loaded).slice(0, 2).map(card => card.props.value), ['₱50', '1']);
    assert.ok(staffCards(loaded).every(card => card.props.trendLabel !== 'Updating'));
  } finally { cleanup(); }
});

test('staff KPI loading clears after a failed API call and can recover on refresh', async () => {
  ui.http.defaults.adapter = async () => { throw new Error('Simulated metrics outage'); };
  render(ui.StaffKPICards);
  const cleanup = effects.at(-1)();
  await settle();
  const failed = render(ui.StaffKPICards);
  assert.equal(failed.props['aria-busy'], false);
  assert.ok(staffCards(failed).every(card => card.props.trendLabel === 'Unavailable' && card.props.value === '—'));
  cleanup();
  ui.http.defaults.adapter = async config => ({ data: [], status: 200, statusText: 'OK', headers: {}, config });
  const refreshedCleanup = effects.at(-1)();
  try {
    await settle();
    const recovered = render(ui.StaffKPICards);
    assert.equal(recovered.props['aria-busy'], false);
    assert.ok(staffCards(recovered).every(card => card.props.trendLabel !== 'Unavailable' && card.props.trendLabel !== 'Updating'));
  } finally { refreshedCleanup(); }
});

test('staff KPI loading clears when a request remains pending past the deadline', async () => {
  const realSetTimeout = global.setTimeout;
  let expire, cleanup;
  global.setTimeout = (callback, delay, ...args) => {
    if (delay === 30000) { expire = callback; return 0; }
    return realSetTimeout(callback, delay, ...args);
  };
  try {
    ui.http.defaults.adapter = () => new Promise(() => {});
    render(ui.StaffKPICards);
    cleanup = effects.at(-1)();
    await settle();
    assert.equal(render(ui.StaffKPICards).props['aria-busy'], true);
    expire();
    await settle();
    const timedOut = render(ui.StaffKPICards);
    assert.equal(timedOut.props['aria-busy'], false);
    assert.ok(staffCards(timedOut).every(card => card.props.trendLabel === 'Unavailable'));
  } finally { cleanup?.(); global.setTimeout = realSetTimeout; }
});

test('confirmation renders its icon and blocks dismissal while processing', () => {
  let dismissed = 0;
  const tree = render(ui.ConfirmDialog, { open:true, loading:true, title:'Cancel Order', description:'Confirm cancellation', onClose:()=>dismissed++, onConfirm() {} });
  assert.equal(tree.props.busy, true);
  tree.props.onClose();
  assert.equal(dismissed, 0);
  assert.equal(elements(tree, node => node.type === 'button').every(node => node.props.disabled), true);
});

test('report download blocks double clicks and permits retry after failure', async () => {
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  const tree = render(ui.AdminReports);
  const button = elements(tree, node => node.type === 'button')[0];
  const first = button.props.onClick();
  await Promise.resolve(); await Promise.resolve();
  await button.props.onClick();
  assert.equal(requests, 1);
  reject(new Error('Simulated download outage'));
  await first;
  const second = button.props.onClick();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(requests, 2);
  reject(new Error('Simulated download outage'));
  await second;
});

test('order form blocks excessive discounts and duplicate submissions', async () => {
  const product = { id:385, name:'Milk', price:50, stock:19, expiry:'2099-10-17', low:false };
  render(ui.CreateOrderModal, {open:true,onClose(){},onCreated(){}});
  states[0] = [{id:906,name:'Audit'}]; states[1] = [product]; states[2] = '906'; states[3] = {385:1}; states[5] = '100';
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  states[11] = 'fixed'; states[12] = '60';
  let tree = render(ui.CreateOrderModal, {open:true,onClose(){},onCreated(){}});
  const submit = root => elements(root.props.footer, node => typeof node.props.onClick === 'function').at(-1);
  await submit(tree).props.onClick();
  assert.equal(requests, 0);
  states[12] = '0';
  tree = render(ui.CreateOrderModal, {open:true,onClose(){},onCreated(){}});
  const first = submit(tree).props.onClick();
  await Promise.resolve(); await Promise.resolve();
  await submit(tree).props.onClick();
  assert.equal(requests, 1);
  reject(new Error('Simulated order outage')); await first;
  assert.equal(refs[0].current, false);
});

test('POS confirmation sends only one request while checkout is pending', async () => {
  render(ui.StaffPOS);
  states[0] = [{id:385,name:'Milk',price:50,stock:19,expiry:'2099-10-17',low:false,cat:'Dairy'}];
  states[2] = false;
  states[3] = [{id:385,name:'Milk',price:50,stock:19,qty:1}];
  let tree = render(ui.StaffPOS);
  // Locate the actual confirmation handler through the preview after opening it.
  states[7] = '100';
  states[12] = true;
  tree = render(ui.StaffPOS);
  const preview = elements(tree, node => typeof node.props.onConfirm === 'function')[0];
  assert.ok(preview, 'Checkout preview is open');
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  preview.props.onConfirm(); preview.props.onConfirm();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(requests, 1);
  reject(new Error('Simulated checkout outage'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refs[0].current, false);
});
