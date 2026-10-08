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
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'ui-in-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'ui-in-memory.cjs');
loaded.paths = module.paths;
loaded.require = id => id === 'react' ? hooks : id === 'sonner' ? {
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
