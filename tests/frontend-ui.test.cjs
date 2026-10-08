const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');

// Exercise real event handlers with deterministic hook state, without a browser or database writes.
let states, refs, stateIndex, refIndex;
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useEffect() {}, useLayoutEffect() {},
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
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'ui-in-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'ui-in-memory.cjs');
loaded.paths = module.paths;
loaded.require = id => id === 'react' ? hooks : require(id);
loaded._compile(compiled, loaded.filename);
const ui = loaded.exports;
const render = (component, props = {}) => { stateIndex = refIndex = 0; return component(props); };
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
beforeEach(() => {
  states = []; refs = []; stateIndex = refIndex = 0;
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.window = new EventTarget();
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
