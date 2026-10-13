const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');
const { AxiosError } = require('axios');

// Exercise real event handlers with deterministic hook state, without a browser or database writes.
let states, refs, stateIndex, refIndex, effects, authState, toastErrors;
let effectCleanups = [];
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useId() { return `test-tooltip-${refIndex++}`; },
  useEffect(effect) { effects.push(() => { const cleanup = effect(); if (typeof cleanup === 'function') effectCleanups.push(cleanup); return cleanup; }); }, useLayoutEffect() {},
  useContext() { return { theme: 'light', ...authState }; },
  useMemo: fn => fn(), useCallback: fn => fn,
};
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { default as http } from './src/lib/api';
    export { ProductTable } from './src/features/inventory/components/ProductTable';
    export { Card } from './src/components/data-display/Card';
    export { FEFOMonitor } from './src/features/dashboard/components/admin/FEFOMonitor';
    export { QueryErrorMessage } from './src/components/feedback/QueryErrorMessage';
    export { BatchDetailsFields } from './src/features/inventory/components/BatchDetailsFields';
    export { ExpiredBatchTable } from './src/features/inventory/components/ExpiredBatchTable';
    export { AdminLayout } from './src/app/layouts/AdminLayout';
    export { StaffLayout } from './src/app/layouts/StaffLayout';
    export { NotificationBell } from './src/components/navigation/NotificationBell';
    export { ConfirmDialog } from './src/components/feedback/ConfirmDialog';
    export { AdminReports } from './src/features/reports/pages/AdminReports';
    export { CreateOrderModal } from './src/features/orders/components/CreateOrderModal';
    export { MobileOrderCard } from './src/features/orders/components/MobileOrderCard';
    export { MobileCustomerCard } from './src/features/customers/components/MobileCustomerCard';
    export { MobileSaleCard } from './src/features/sales/components/MobileSaleCard';
    export { MobileUserCard } from './src/features/users/components/MobileUserCard';
    export { AdminSalesHistory } from './src/features/sales/pages/AdminSalesHistory';
    export { StaffSalesHistory } from './src/features/sales/pages/StaffSalesHistory';
    export { AdminOrders } from './src/features/orders/pages/AdminOrders';
    export { OrdersTable } from './src/features/orders/components/OrdersTable';
    export { CustomerTable } from './src/features/customers/components/CustomerTable';
    export { StaffOrders } from './src/features/orders/pages/StaffOrders';
    export { StaffPOS } from './src/features/pos/pages/StaffPOS';
    export { StaffKPICards } from './src/features/dashboard/components/staff/StaffKPICards';
    export { MobileCategoryCard } from './src/features/inventory/components/MobileCategoryCard';
    export { MobileInventoryCard } from './src/features/inventory/components/MobileInventoryCard';
    export { EnhancedTable } from './src/components/data-display/EnhancedTable';
    export * from './src/features/inventory/components/InventoryWarnings';
    export { AdminInventory } from './src/features/inventory/pages/AdminInventory';
    export { StaffInventory } from './src/features/inventory/pages/StaffInventory';
    export { AdminCategories } from './src/features/inventory/pages/AdminCategories';
    export { AdminCustomers } from './src/features/customers/pages/AdminCustomers';
    export { AdminUserManagement } from './src/features/users/pages/AdminUserManagement';
    export { AdminSettings } from './src/features/settings/pages/AdminSettings';
    export { SETTINGS_UPDATED } from './src/features/settings/api/settings.service';
    export { useReportVersion } from './src/features/reports/hooks/useReportPreview';
    export { InventoryAlert } from './src/features/dashboard/components/staff/InventoryAlert';
    export * from './src/lib/dataCache';
    export { useCachedQuery } from './src/hooks/useCachedQuery';
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  loader: { '.jpg': 'dataurl' },
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
afterEach(() => { effectCleanups.forEach(cleanup => cleanup()); effectCleanups = []; });
const render = (component, props = {}) => { stateIndex = refIndex = 0; return component(props); };
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  if (tree.type === ui.CustomerTable || tree.type === ui.OrdersTable) {
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.type(tree.props), predicate)];
  }
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
beforeEach(() => {
  effectCleanups.forEach(cleanup => cleanup()); effectCleanups = [];
  ui.clearDataCache();
  states = []; refs = []; effects = []; stateIndex = refIndex = 0;
  authState = { user: { username: 'audit' }, loading: false };
  toastErrors = [];
  const token = `header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`;
  global.localStorage = { getItem: key => key === 'rosario_access_token' ? token : null, setItem() {}, removeItem() {} };
  global.window = new EventTarget();
  global.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

test('mobile order cards preserve details and enforce cancellation availability', () => {
  const order = { id: 7, invoiceNumber: 'INV-000007', customer: 'A very long customer name', staff: 'Staff member', date: '2026-10-11', total: 120, status: 'Fulfilled', isHistorical: false };
  let viewed, cancelled;
  const props = { order, onView: value => { viewed = value; }, onCancel: value => { cancelled = value; } };
  let tree = render(ui.MobileOrderCard, props);
  assert.equal(elements(tree, node => node.type === 'dd').length, 4);
  elements(tree, node => node.props['aria-label'] === 'View details')[0].props.onClick();
  elements(tree, node => node.props['aria-label'] === 'Cancel order')[0].props.onClick();
  assert.equal(viewed, order);
  assert.equal(cancelled, order);
  assert.equal(elements(render(ui.MobileOrderCard, { ...props, busy: true }), node => node.props['aria-label'] === 'Cancel order')[0].props.disabled, true);
  for (const changes of [{ isHistorical: true }, { status: 'Cancelled' }]) {
    tree = render(ui.MobileOrderCard, { ...props, order: { ...order, ...changes } });
    assert.equal(elements(tree, node => node.props['aria-label'] === 'Cancel order').length, 0);
  }
  assert.equal(elements(render(ui.MobileOrderCard, { order, onView: props.onView }), node => node.type === 'button').length, 1);
});

test('admin and staff Orders use five mobile cards without the default sort selector', () => {
  const orders = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, invoiceNumber: `INV-${index}`, customer: 'Customer', staff: 'Staff', date: '2026-10-11', total: 120, status: 'Fulfilled', isHistorical: false }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:orders:list`, orders, ['orders']);
  for (const Page of [ui.AdminOrders, ui.StaffOrders]) {
    states = []; refs = [];
    const table = elements(render(Page), node => node.type === ui.EnhancedTable)[0];
    assert.equal(table.props.pageSize, 5);
    assert.equal(table.props.renderMobileRow(orders[0]).type, ui.MobileOrderCard);
    states = []; refs = [];
    const tree = render(ui.EnhancedTable, table.props);
    assert.equal(elements(tree, node => node.type === ui.MobileOrderCard).length, 5);
    assert.equal(elements(tree, node => node.props['aria-label'] === 'Sort records').length, 0);
    assert.ok(elements(tree, node => node.props.children === 'Page 1 of 2').length > 0);
  }
});

test('mobile customer cards preserve record details and active/inactive actions', () => {
  const customer = { id: 9, name: 'Customer with a long name', email: 'long.email@example.com', phone: '09171234567', orders: 2, last: '2026-10-11', isActive: true };
  const actions = [];
  const props = { customer, onView: value => actions.push(['view', value]), onEdit: value => actions.push(['edit', value]),
    onDelete: value => actions.push(['delete', value]), onReactivate: value => actions.push(['reactivate', value]) };
  let tree = render(ui.MobileCustomerCard, props);
  assert.deepEqual(elements(tree, node => node.type === 'dd').map(node => node.props.children), [customer.email, customer.phone, '2', customer.last]);
  const buttons = elements(tree, node => node.type === 'button');
  assert.deepEqual(buttons.map(node => node.props['aria-label']), ['View details', 'Edit', 'Delete']);
  buttons.forEach(node => node.props.onClick());
  assert.deepEqual(actions, [['view', customer], ['edit', customer], ['delete', customer]]);
  const inactive = { ...customer, isActive: false };
  tree = render(ui.MobileCustomerCard, { ...props, customer: inactive, busy: true });
  assert.deepEqual(elements(tree, node => node.type === 'button').map(node => node.props['aria-label']), ['View details', 'Reactivate customer']);
  assert.equal(elements(tree, node => node.props['aria-label'] === 'Reactivate customer')[0].props.disabled, true);
  tree = render(ui.MobileCustomerCard, { ...props, customer: inactive });
  elements(tree, node => node.props['aria-label'] === 'Reactivate customer')[0].props.onClick();
  assert.deepEqual(actions.at(-1), ['reactivate', inactive]);
});

test('Customers shares five-record pagination between mobile cards and the desktop table', () => {
  const customers = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Customer ${index + 1}`, isActive: true, email: '', phone: '', address: '', orders: 1, last: '', createdAt: '' }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:customers:list:all`, customers, ['customers']);
  const table = elements(render(ui.AdminCustomers), node => node.type === ui.EnhancedTable)[0];
  assert.equal(table.props.pageSize, 5);
  assert.equal(table.props.reserveTableHeight, false);
  assert.equal(table.props.renderMobileRow(customers[0]).type, ui.MobileCustomerCard);
  states = []; refs = [];
  const tree = render(ui.EnhancedTable, table.props);
  assert.equal(elements(tree, node => node.type === ui.MobileCustomerCard).length, 5);
  assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 5);
  assert.ok(elements(tree, node => node.props.children === 'Page 1 of 2').length > 0);
});

test('mobile sales cards keep full transaction details available and open the selected sale', () => {
  const sale = { receipt: 'TXN-038118', customer: 'A very long customer name', cashier: 'Cashier', date: '2026-10-11', payment: 'Cash', total: 120 };
  let selected;
  const tree = render(ui.MobileSaleCard, { sale, onView: value => { selected = value; } });
  const values = elements(tree, node => node.type === 'dd');
  assert.deepEqual(values.map(node => node.props.children), [sale.receipt, sale.customer, sale.cashier, sale.date, sale.payment, '₱120']);
  assert.equal(values[1].props.title, sale.customer);
  elements(tree, node => node.props['aria-label'] === 'View Details')[0].props.onClick();
  assert.equal(selected, sale);
});

test('admin and staff Sales History use mobile cards without a sort selector and preserve five-item pagination', () => {
  const sales = Array.from({ length: 6 }, (_, index) => ({ receipt: `TXN-${index}`, customer: 'Customer', cashier: 'Cashier', date: '2026-10-11', payment: 'Cash', total: 120 }));
  for (const [Page, key] of [[ui.AdminSalesHistory, 'sales:history:'], [ui.StaffSalesHistory, 'sales:mine:7']]) {
    ui.writeDataCache(`${ui.dataCacheEpoch()}:${key}`, sales, ['sales']);
    states = []; refs = [];
    const table = elements(render(Page), node => node.type === ui.EnhancedTable)[0];
    assert.equal(table.props.pageSize, 5);
    assert.equal(table.props.renderMobileRow(sales[0]).type, ui.MobileSaleCard);
    const controls = table.props.extraControls;
    assert.equal(elements(controls, node => node.type === 'select').length, 1);
    assert.equal(elements(controls, node => node.type === 'input' && node.props.type === 'date').length, 1);
    states = []; refs = [];
    const tree = render(ui.EnhancedTable, table.props);
    assert.equal(elements(tree, node => node.type === ui.MobileSaleCard).length, 5);
    assert.equal(elements(tree, node => node.props['aria-label'] === 'Sort records').length, 0);
    assert.ok(elements(tree, node => node.props.children === 'Page 1 of 2').length > 0);
  }
});

test('mobile user cards share existing account actions and keep five records with single-page pagination', () => {
  authState = { user: { username: 'audit', email: 'audit@example.com' }, loading: false };
  const users = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, name: `Staff ${index + 1}`, username: `staff${index}`, email: `staff${index}@example.com`, role: 'Staff', status: index === 4 ? 'Inactive' : 'Active', last: 'Oct 11, 2026, 10:30 AM', lastLogin: null, phone: '', address: '', deactivationReason: 'none' }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:users:list`, users, ['users']);
  const table = elements(render(ui.AdminUserManagement), node => node.type === ui.EnhancedTable)[0];
  const mobile = table.props.renderMobileRow(users[0], 0);
  assert.equal(mobile.type, ui.MobileUserCard);
  const card = render(ui.MobileUserCard, mobile.props);
  assert.equal(elements(card, node => node.props.title === users[0].email).length, 1);
  assert.equal(elements(card, node => node.type === 'dd').at(-1).props.children, users[0].last);
  assert.deepEqual(elements(card, node => node.props.label).map(node => node.props.label), ['View details', 'Edit', 'Reset password', 'Deactivate']);
  const inactive = table.props.renderMobileRow(users[4], 4);
  assert.deepEqual(elements(render(ui.MobileUserCard, inactive.props), node => node.props.label).map(node => node.props.label), ['View details', 'Edit', 'Reset password', 'Reactivate Account']);
  states = []; refs = [];
  const tree = render(ui.EnhancedTable, table.props);
  assert.equal(elements(tree, node => node.type === ui.MobileUserCard).length, 5);
  assert.equal(elements(tree, node => node.props['aria-label'] === 'Sort records').length, 0);
  assert.ok(elements(tree, node => node.props.children === 'Page 1 of 1').length > 0);
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

const settingsFixture = () => ({
  system: { system_name: 'Rosario Dairy', business_name: 'Saved name', business_type: '', business_address: '', business_contact: '', business_email: '', tin: '' },
  notifications: { low_stock_alerts: true, near_expiry_alerts: true, new_order_alerts: true },
  inventory: { id: 1, low_stock_threshold: 20, near_expiry_threshold: 7, critical_expiry_threshold: 3, updated_at: '' },
  permissions: { can_manage_settings: true },
});
const inputById = (tree, id) => elements(tree, node => node.type === 'input' && node.props.id === id)[0];
const inventoryForm = tree => elements(tree, node => node.type === 'form')[1];

test('inventory settings save changed fields, reload canonical values and preserve other drafts', async () => {
  let saved = settingsFixture();
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    if (config.method === 'patch') saved = { ...saved, inventory: { ...saved.inventory, ...JSON.parse(config.data) } };
    return { status: 200, config, headers: {}, data: config.method === 'patch' ? saved.inventory : saved };
  };
  render(ui.AdminSettings); effects.at(-1)(); await settle();
  let tree = render(ui.AdminSettings);
  inputById(tree, 'business_name').props.onChange({ target: { value: 'Unsaved business name' } });
  tree = render(ui.AdminSettings);
  elements(tree, node => node.props.role === 'switch')[0].props.onChange({ target: { checked: false } });
  tree = render(ui.AdminSettings);
  inputById(tree, 'near_expiry_threshold').props.onChange({ target: { value: '2' } });
  tree = render(ui.AdminSettings);
  inputById(tree, 'critical_expiry_threshold').props.onChange({ target: { value: '0' } });
  tree = render(ui.AdminSettings);
  let refreshed = 0;
  window.addEventListener(ui.SETTINGS_UPDATED, () => refreshed++);
  await inventoryForm(tree).props.onSubmit({ preventDefault() {} });
  tree = render(ui.AdminSettings);
  const patch = requests.find(request => request.method === 'patch');
  assert.equal(patch.url, '/settings/inventory/');
  assert.deepEqual(JSON.parse(patch.data), { near_expiry_threshold: 2, critical_expiry_threshold: 0 });
  assert.ok(requests.filter(request => request.url === '/settings/' && request.method === 'get').length >= 2);
  assert.equal(inputById(tree, 'business_name').props.value, 'Unsaved business name');
  assert.equal(elements(tree, node => node.props.role === 'switch')[0].props.checked, false);
  assert.equal(inputById(tree, 'critical_expiry_threshold').props.value, '0');
  assert.equal(refreshed, 1);
  assert.equal(elements(inventoryForm(tree), node => node.type === 'button')[0].props.disabled, true);
});

test('inventory settings reject invalid drafts, preserve failed saves and respect server permission errors', async () => {
  const saved = settingsFixture();
  let status = 400, patches = 0, events = 0;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'patch') {
      patches++;
      const response = { status, config, headers: {}, data: status === 400 ? { near_expiry_threshold: ['Server validation error.'] } : { detail: 'Permission denied.' } };
      throw new AxiosError('Rejected', undefined, config, undefined, response);
    }
    return { status: 200, config, headers: {}, data: saved };
  };
  window.addEventListener(ui.SETTINGS_UPDATED, () => events++);
  render(ui.AdminSettings); effects.at(-1)(); await settle();
  let tree = render(ui.AdminSettings);
  inputById(tree, 'near_expiry_threshold').props.onChange({ target: { value: '2' } });
  tree = render(ui.AdminSettings);
  await inventoryForm(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(patches, 0);
  tree = render(ui.AdminSettings);
  assert.equal(inputById(tree, 'critical_expiry_threshold').props['aria-invalid'], true);
  inputById(tree, 'critical_expiry_threshold').props.onChange({ target: { value: '1' } });
  tree = render(ui.AdminSettings);
  await inventoryForm(tree).props.onSubmit({ preventDefault() {} });
  tree = render(ui.AdminSettings);
  assert.equal(inputById(tree, 'near_expiry_threshold').props.value, '2');
  assert.equal(inputById(tree, 'near_expiry_threshold').props['aria-invalid'], true);
  assert.equal(events, 0);
  status = 403;
  await inventoryForm(tree).props.onSubmit({ preventDefault() {} });
  tree = render(ui.AdminSettings);
  assert.equal(inputById(tree, 'low_stock_threshold').props.disabled, true);
  assert.equal(elements(inventoryForm(tree), node => node.type === 'button').length, 0);
});

test('staff settings bootstrap omits admin sections and never requests global inventory settings', async () => {
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config.url);
    return { status: 200, config, headers: {}, data: { notifications: {}, permissions: { can_manage_settings: false } } };
  };
  render(ui.AdminSettings); effects.at(-1)(); await settle();
  const tree = render(ui.AdminSettings);
  assert.equal(inputById(tree, 'low_stock_threshold'), undefined);
  assert.deepEqual(requests, ['/settings/']);
});

test('mounted inventory and dashboard version updates on global settings saves', () => {
  assert.equal(render(ui.useReportVersion), 0);
  const cleanup = effects.at(-1)();
  window.dispatchEvent(new Event(ui.SETTINGS_UPDATED));
  assert.equal(render(ui.useReportVersion), 1);
  cleanup();
  window.dispatchEvent(new Event(ui.SETTINGS_UPDATED));
  assert.equal(render(ui.useReportVersion), 1);
});

test('cached navigation renders data immediately and stale refresh stays silent', async () => {
  let calls = 0, resolveRefresh;
  const fetcher = () => { calls++; return calls === 1 ? Promise.resolve([1]) : new Promise(resolve => resolveRefresh = resolve); };
  const props = () => ui.useCachedQuery('navigation:test', fetcher, ['dashboard']);
  let result = render(props);
  assert.equal(result.loading, true);
  let cleanup = effects.at(-1)(); await settle();
  assert.deepEqual(render(props).data, [1]);
  cleanup(); states = []; refs = []; effects = [];
  result = render(props);
  assert.deepEqual(result.data, [1]); assert.equal(result.loading, false);
  cleanup = effects.at(-1)(); await settle();
  assert.equal(calls, 1);
  cleanup(); states = []; refs = []; effects = [];
  const originalNow = Date.now;
  const future = Date.now() + ui.DEFAULT_STALE_TIME + 1;
  try {
    Date.now = () => future;
    result = render(props);
    assert.deepEqual(result.data, [1]); assert.equal(result.loading, false);
    cleanup = effects.at(-1)(); await settle();
    assert.equal(calls, 2);
    assert.deepEqual(render(props).data, [1]); assert.equal(render(props).loading, false);
    resolveRefresh([2]); await settle();
    assert.deepEqual(render(props).data, [2]);
  } finally { Date.now = originalNow; cleanup(); }
});

test('settings events refresh mounted dashboard cache while keeping previous data visible', async () => {
  let calls = 0;
  const props = () => ui.useCachedQuery('settings-event:test', () => Promise.resolve(++calls), ['dashboard', 'inventory']);
  render(props); const cleanup = effects.at(-1)(); await settle();
  assert.equal(render(props).data, 1);
  window.dispatchEvent(new Event(ui.SETTINGS_UPDATED));
  assert.equal(render(props).data, 1); assert.equal(render(props).loading, false);
  await settle();
  assert.equal(render(props).data, 2);
  cleanup();
});

test('staff dashboard navigation shows cached KPI values without Updating badges or fresh requests', async () => {
  let requests = 0;
  ui.http.defaults.adapter = async config => { requests++; return { status: 200, config, headers: {}, data: [] }; };
  render(ui.StaffKPICards);
  let cleanup = effects.at(-1)(); await settle();
  assert.equal(render(ui.StaffKPICards).props['aria-busy'], false);
  cleanup(); states = []; refs = []; effects = [];
  const count = requests;
  const cached = render(ui.StaffKPICards);
  assert.equal(cached.props['aria-busy'], false);
  assert.ok(staffCards(cached).every(card => card.props.trendLabel !== 'Updating'));
  cleanup = effects.at(-1)(); await settle();
  assert.equal(requests, count);
  cleanup();
});

test('staff dashboard uses permitted alert feeds and honors disabled notification feeds', async () => {
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config.url);
    return { status: 200, config, headers: {}, data: [] };
  };
  render(ui.InventoryAlert); effects.at(-1)(); await settle();
  const tree = render(ui.InventoryAlert);
  assert.equal(tree.props['aria-busy'], false);
  assert.ok(requests.includes('/inventory/low-stock/products/'));
  assert.ok(requests.includes('/inventory/expiring/products/'));
  assert.ok(requests.every(url => !url.startsWith('/settings/')));
  const counts = elements(tree, node => node.type === 'span' && typeof node.props.children === 'number').map(node => node.props.children);
  assert.deepEqual(counts, [0, 0, 0]);
});

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
  await settle();
  await button.props.onClick();
  assert.equal(requests, 1);
  reject(new Error('Simulated download outage'));
  await first;
  const second = button.props.onClick();
  await settle();
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


test('categories, customers and users render cached lists before effects and refresh silently after invalidation', async () => {
  authState.user.email = 'audit@example.com';
  for (const [component, key, group, record] of [
    [ui.AdminCategories, 'categories:list', 'categories', { id: 1, name: 'Milk', products: 1, is_active: true }],
    [ui.AdminCustomers, 'customers:list:all', 'customers', { id: 1, name: 'Customer', isActive: true, phone: '', email: '', address: '', orders: 1, last: '', createdAt: '' }],
    [ui.AdminUserManagement, 'users:list', 'users', { id: 1, name: 'Staff', username: 'staff', email: 'staff@example.com', role: 'Staff', status: 'Active', lastLogin: null }],
  ]) {
    effectCleanups.forEach(cleanup => cleanup()); effectCleanups = [];
    states = []; refs = []; effects = [];
    ui.writeDataCache(`${ui.dataCacheEpoch()}:${key}`, [record], [group]);
    ui.writeDataCache(`${ui.dataCacheEpoch()}:categories:icons`, [], ['categories']);
    let requests = 0;
    ui.http.defaults.adapter = async config => { requests++; return { status: 200, config, headers: {}, data: [] }; };
    const table = tree => elements(tree, node => Array.isArray(node.props.columns) && Array.isArray(node.props.data))[0];
    let tree = render(component);
    assert.deepEqual(table(tree).props.data, [record]);
    assert.equal(table(tree).props.loading, false);
    effects.forEach(effect => effect()); await settle();
    assert.equal(requests, 0);
    ui.invalidateDataCache([group]);
    tree = render(component);
    assert.equal(table(tree).props.loading, false);
    assert.deepEqual(table(tree).props.data, [record]);
    await settle();
    assert.ok(requests > 0);
    assert.deepEqual(table(render(component)).props.data, []);
  }
});

test('settings navigation renders cached fields immediately and stale background sync preserves dirty fields', async () => {
  const cached = settingsFixture();
  const key = `${ui.dataCacheEpoch()}:settings:bootstrap`;
  ui.writeDataCache(key, cached, ['settings']);
  let requests = 0, resolveRefresh;
  ui.http.defaults.adapter = config => {
    requests++;
    return new Promise(resolve => { resolveRefresh = data => resolve({ status: 200, config, headers: {}, data }); });
  };
  let tree = render(ui.AdminSettings);
  assert.equal(inputById(tree, 'business_name').props.value, 'Saved name');
  const cleanup = effects.at(-1)(); await settle();
  assert.equal(requests, 0);
  cleanup(); states = []; refs = []; effects = [];
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + ui.DEFAULT_STALE_TIME;
    tree = render(ui.AdminSettings);
    assert.equal(inputById(tree, 'low_stock_threshold').props.value, '20');
    effects.at(-1)(); await settle();
    assert.equal(requests, 1);
    inputById(tree, 'business_name').props.onChange({ target: { value: 'Unsaved business' } });
    tree = render(ui.AdminSettings);
    inputById(tree, 'low_stock_threshold').props.onChange({ target: { value: '24' } });
    resolveRefresh({ ...cached, system: { ...cached.system, business_name: 'Server name', business_address: 'Updated address' },
      inventory: { ...cached.inventory, low_stock_threshold: 30, near_expiry_threshold: 9 } });
    await settle(); tree = render(ui.AdminSettings);
    assert.equal(inputById(tree, 'business_name').props.value, 'Unsaved business');
    assert.equal(inputById(tree, 'business_address').props.value, 'Updated address');
    assert.equal(inputById(tree, 'low_stock_threshold').props.value, '24');
    assert.equal(inputById(tree, 'near_expiry_threshold').props.value, '9');
    assert.equal(toastErrors.length, 0);
  } finally { Date.now = originalNow; }
});


test('mobile category menu preserves actions and closes after selection or Escape', () => {
  const category = { id: 1, name: 'Milk and dairy drinks', icon: '', products: 290, is_active: true, is_visible_to_staff: true };
  const calls = [];
  const props = { category, onView: value => calls.push(['view', value]), onEdit: value => calls.push(['edit', value]),
    onDelete: value => calls.push(['delete', value]), onReactivate: value => calls.push(['reactivate', value]), onVisibility: value => calls.push(['visibility', value]) };
  const buttons = tree => elements(tree, node => node.type === 'button');
  const openMenu = overrides => {
    const tree = render(ui.MobileCategoryCard, { ...props, ...overrides });
    buttons(tree)[0].props.onClick();
    return render(ui.MobileCategoryCard, { ...props, ...overrides });
  };
  let tree = render(ui.MobileCategoryCard, props);
  assert.equal(buttons(tree)[0].props['aria-expanded'], false);
  for (const [label, action] of [['View details', 'view'], ['Edit category', 'edit'], ['Hide from staff', 'visibility'], ['Delete category', 'delete']]) {
    tree = openMenu();
    const button = buttons(tree).find(node => React.Children.toArray(node.props.children).includes(label));
    button.props.onClick();
    assert.deepEqual(calls.at(-1), [action, category]);
    assert.equal(buttons(render(ui.MobileCategoryCard, props))[0].props['aria-expanded'], false);
  }
  tree = openMenu();
  elements(tree, node => typeof node.props.onKeyDown === 'function')[0].props.onKeyDown({ key: 'Escape' });
  assert.equal(buttons(render(ui.MobileCategoryCard, props))[0].props['aria-expanded'], false);
  const inactive = { ...category, is_active: false };
  tree = openMenu({ category: inactive });
  assert.equal(buttons(tree).some(node => React.Children.toArray(node.props.children).includes('Delete category')), false);
  buttons(tree).find(node => React.Children.toArray(node.props.children).includes('Reactivate category')).props.onClick();
  assert.deepEqual(calls.at(-1), ['reactivate', inactive]);
  tree = openMenu();
  tree = render(ui.MobileCategoryCard, { ...props, busy: true });
  assert.ok(buttons(tree).every(node => node.props.disabled));
});

test('Categories mobile renderer shares filtered records and opens existing edit and delete dialogs', () => {
  const category = { id: 1, name: 'Milk', icon: '', products: 290, is_active: true, is_visible_to_staff: true };
  const inactive = { ...category, id: 2, name: 'Other', is_active: false };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:categories:list`, [category, inactive], ['categories']);
  let tree = render(ui.AdminCategories);
  const table = root => elements(root, node => Array.isArray(node.props.columns) && Array.isArray(node.props.data))[0];
  assert.deepEqual(table(tree).props.data, [category]);
  const mobile = table(tree).props.renderMobileRow(category);
  mobile.props.onEdit(category);
  tree = render(ui.AdminCategories);
  assert.equal(elements(tree, node => node.props.title === 'Edit Category')[0].props.open, true);
  mobile.props.onDelete(category);
  tree = render(ui.AdminCategories);
  assert.equal(elements(tree, node => node.props.title === 'Delete Category')[0].props.open, true);
  const status = elements(table(tree).props.extraControls, node => node.type === 'select')[0];
  status.props.onChange({ target: { value: 'Inactive' } });
  tree = render(ui.AdminCategories);
  assert.deepEqual(table(tree).props.data, [inactive]);
  assert.equal(table(tree).props.renderMobileRow(inactive).props.category, inactive);
});


test('admin and staff inventory filters expose alert statuses and retain compound warnings', () => {
  const nearDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const base = { cat: 'Milk', price: 100, stock: 20, reorderThreshold: 5, low: false, expiry: '', nearExpiryThreshold: 7 };
  const products = [
    { ...base, id: 1, name: 'Normal' },
    { ...base, id: 2, name: 'Low', stock: 5 },
    { ...base, id: 3, name: 'Near', expiry: nearDate },
    { ...base, id: 4, name: 'Dual', stock: 2, expiry: nearDate },
    { ...base, id: 5, name: 'Expired', expiry: '2000-01-01' },
  ];
  for (const [component, key, label] of [[ui.AdminInventory, 'inventory:admin', 'Filter by status'], [ui.StaffInventory, 'inventory:staff', 'Status']]) {
    states = []; refs = []; effects = [];
    ui.writeDataCache(`${ui.dataCacheEpoch()}:${key}`, products, ['inventory']);
    ui.writeDataCache(`${ui.dataCacheEpoch()}:categories:active`, [], ['categories']);
    const table = tree => elements(tree, node => Array.isArray(node.props.columns) && Array.isArray(node.props.data))[0];
    let tree = render(component);
    const dropdown = elements(table(tree).props.extraControls, node => node.type === 'select' && node.props['aria-label'] === label)[0];
    assert.deepEqual(elements(dropdown, node => node.type === 'option').map(node => node.props.children),
      ['All Statuses', 'Low Stock', 'Near Expiry', 'Expired']);
    for (const [status, ids] of [['Low Stock', [2, 4]], ['Near Expiry', [3, 4]], ['Expired', [5]], ['All', [1, 2, 3, 4, 5]]]) {
      dropdown.props.onChange({ target: { value: status } });
      tree = render(component);
      assert.ok(elements(tree, node => node.type === ui.ProductTable).length > 0);
      assert.deepEqual(table(tree).props.data.map(row => row.id).sort((a, b) => a - b), ids, `${key}: ${status}`);
    }
  }
});


test('five-row content tables paginate and attach a valid footer after searches shrink the results', () => {
  const props = {
    contentHeight: true, pageSize: 5, rowHeight: 56, showExport: false,
    columns: [{ key: 'name', header: 'Name' }],
    data: Array.from({ length: 12 }, (_, id) => ({ id, name: `Record ${id}` })),
    rowKey: row => row.id, searchKeys: row => [row.name],
  };
  const rows = tree => elements(elements(tree, node => node.type === 'tbody')[0], node => node.type === 'tr');
  const footer = (tree, text) => elements(tree, node => node.type === 'span' && node.props.children === text);
  let tree = render(ui.EnhancedTable, props);
  assert.equal(rows(tree).length, 5);
  assert.equal(footer(tree, 'Page 1 of 3').length, 1);
  elements(tree, node => node.type === 'button').at(-1).props.onClick();
  tree = render(ui.EnhancedTable, props);
  assert.equal(rows(tree).length, 5);
  assert.equal(footer(tree, 'Page 2 of 3').length, 1);
  elements(tree, node => node.type === 'button').at(-1).props.onClick();
  tree = render(ui.EnhancedTable, props);
  assert.equal(rows(tree).length, 2);
  assert.equal(footer(tree, 'Page 3 of 3').length, 1);
  elements(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'Record 11' } });
  tree = render(ui.EnhancedTable, props);
  assert.equal(rows(tree).length, 1);
  assert.equal(footer(tree, 'Page 1 of 1').length, 1);
  assert.ok(elements(tree, node => node.type === 'button').filter(node => node.props.onClick && node.props.children?.type).every(node => node.props.disabled));
  elements(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'Missing record' } });
  tree = render(ui.EnhancedTable, props);
  assert.equal(footer(tree, 'Page 1 of 1').length, 0);
  assert.ok(elements(tree, node => node.props.title === 'No records found').length > 0);
});


test('notification inbox prioritizes critical expiry and differentiates urgency without changing acknowledgements', () => {
  render(ui.NotificationBell);
  states[0] = true;
  states[2] = [
    { id: 'expiry-product-1', title: 'Near batch', body: 'Milk batch', time: 'Live', type: 'danger', unread: true, dismissed: false, expiry: { status: 'near_expiry', daysLeft: 5 } },
    { id: 'expiry-ingredient-2', title: 'Critical batch', body: 'Ingredient batch', time: 'Live', type: 'danger', unread: false, dismissed: false, expiry: { status: 'critical', daysLeft: 0 } },
    { id: 'low-stock-products', title: 'Low stock', body: 'Milk stock', time: 'Live', type: 'warning', unread: true, dismissed: false },
  ];
  states[3] = false;
  const tree = render(ui.NotificationBell);
  const cards = elements(tree, node => !!node.props['data-notification-id']);
  assert.deepEqual(cards.map(card => card.props['data-notification-id']), ['expiry-ingredient-2', 'expiry-product-1', 'low-stock-products']);
  assert.ok(cards[0].props.className.includes('border-l-red-500'));
  assert.equal(cards[0].props.style.backgroundColor, undefined);
  const badge = card => elements(card, node => node.type === 'span' && node.props.className?.includes('font-semibold') && node.props.className.includes('rounded-md'))[0];
  assert.ok(badge(cards[0]).props.className.includes('bg-red-100'));
  assert.equal(React.Children.toArray(badge(cards[0]).props.children).join(''), 'CRITICAL EXPIRY \u2022 0 days left');
  assert.ok(badge(cards[1]).props.className.includes('bg-amber-100'));
  assert.equal(React.Children.toArray(badge(cards[1]).props.children).join(''), 'Near Expiry \u2022 5 days left');
  const urgent = elements(tree, node => node.type === 'p' && node.props.children === 'Urgent action required: Discount or prioritize batch for immediate dispatch via FEFO.');
  assert.equal(urgent.length, 1);
  assert.ok(elements(cards[0], node => node.type === 'span' && node.props.children === 'Read').length > 0);
});


test('expired notifications keep their styling and removal message without navigation', () => {
  let navigated = 0;
  const props = { onExpiredInventory: () => navigated++ };
  render(ui.NotificationBell, props);
  states[0] = true; states[3] = false;
  states[2] = [
    { id: 'expiry-product-1', title: 'Critical batch', body: 'Milk', type: 'danger', expiry: { status: 'critical', daysLeft: 1 } },
    { id: 'expiry-ingredient-2', title: 'Expired batch', body: 'Cream', type: 'danger', expiry: { status: 'expired', daysLeft: -2 } },
  ];
  const tree = render(ui.NotificationBell, props);
  const cards = elements(tree, node => !!node.props['data-notification-id']);
  assert.equal(cards[0].props['data-notification-id'], 'expiry-ingredient-2');
  const badge = elements(cards[0], node => node.type === 'span' && node.props.className?.includes('bg-red-600'))[0];
  assert.ok(badge.props.className.includes('text-white font-bold px-2 py-0.5 text-xs rounded'));
  assert.equal(elements(cards[0], node => node.props.children === 'EXPIRED \u2022 Action Required').length, 1);
  assert.equal(React.Children.toArray(badge.props.children).join(''), 'EXPIRED');
  assert.equal(elements(cards[0], node => node.props.children === 'Product has expired! Remove batch from active stock immediately.').length, 1);
  assert.equal(elements(cards[0], node => node.props.children === 'Urgent action required: Discount or prioritize batch for immediate dispatch via FEFO.').length, 0);
  assert.equal(elements(cards[0], node => node.type === 'button' && node.props['aria-label']?.startsWith('View expired inventory:')).length, 0);
  assert.equal(navigated, 0); assert.equal(states[0], true);
});

test('layout notification headers do not expose inventory navigation callbacks', () => {
  for (const layout of [ui.AdminLayout, ui.StaffLayout]) {
    states = []; refs = []; effects = [];
    const tree = render(layout, { onLogout() {} });
    assert.equal(elements(tree, node => typeof node.props.onExpiredInventory === 'function').length, 0);
  }
});


test('expired batch actions open details and a confirmation without writing stock on click', () => {
  const batch = { id: 7, key: 'product-7', kind: 'product', name: 'Milk', category: 'Dairy', batch: 'EX-01',
    quantity: 5, unit: 'liter', expiry: '2000-01-01', status: 'available', initialQuantity: 8, unitCost: '12.34' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:expired-batches:false`, [batch], ['inventory']);
  let requests = 0;
  ui.http.defaults.adapter = async () => { requests++; throw new Error('Unexpected write'); };
  let tree = render(ui.ExpiredBatchTable, { extraControls: null });
  const table = root => elements(root, node => Array.isArray(node.props.columns) && Array.isArray(node.props.data))[0];
  const column = table(tree).props.columns.at(-1);
  assert.equal(column.header, 'Actions'); assert.equal(column.align, 'center');
  const buttons = elements(column.render(batch), node => !!node.props.label);
  buttons[0].props.onClick();
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  assert.equal(elements(tree, node => node.props.title === 'Expired batch details')[0].props.open, true);
  buttons[1].props.onClick();
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  const confirm = elements(tree, node => node.type === ui.ConfirmDialog)[0];
  assert.equal(confirm.props.open, true);
  assert.match(confirm.props.description, /all 5 liter.*EX-01.*remaining stock to 0/);
  assert.equal(requests, 0);
  const mobile = table(tree).props.renderMobileRow(batch);
  assert.equal(elements(mobile, node => !!node.props.label).length, 2);
  const blocked = elements(column.render({ ...batch, status: 'expired' }), node => !!node.props.label)[1];
  assert.equal(blocked.props.disabled, true);
  confirm.props.onClose();
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  assert.equal(elements(tree, node => node.type === ui.ConfirmDialog)[0].props.open, false);
});

test('expired batch confirmation blocks duplicate submissions and preserves failures for retry', async () => {
  const batch = { id: 7, key: 'product-7', kind: 'product', name: 'Milk', category: 'Dairy', batch: 'EX-01',
    quantity: 5, unit: 'liter', expiry: '2000-01-01', status: 'available' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:expired-batches:false`, [batch], ['inventory']);
  let tree = render(ui.ExpiredBatchTable, { extraControls: null });
  const table = elements(tree, node => Array.isArray(node.props.columns) && Array.isArray(node.props.data))[0];
  elements(table.props.columns.at(-1).render(batch), node => !!node.props.label)[1].props.onClick();
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  const confirm = elements(tree, node => node.type === ui.ConfirmDialog)[0];
  confirm.props.onConfirm(); confirm.props.onConfirm();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  assert.equal(elements(tree, node => node.type === ui.ConfirmDialog)[0].props.loading, true);
  reject(new Error('Simulated disposal outage'));
  await new Promise(resolve => setImmediate(resolve));
  tree = render(ui.ExpiredBatchTable, { extraControls: null });
  const retry = elements(tree, node => node.type === ui.ConfirmDialog)[0];
  assert.equal(retry.props.open, true); assert.equal(retry.props.loading, false);
  assert.equal(toastErrors.length, 1);
});


test('batch details use serializer values, preserve zero, and omit null and placeholder rows', () => {
  const source = { product: { name: 'Milk', unit: 'liter', category: { name: 'Dairy' } }, batch_number: 'B-1', expiration_date: '2026-01-01', remaining_quantity: '0.00', initial_quantity: '10.00', unit_price: null, date_received: null, status: 'expired', notes: '  ', grade: 'A' };
  const batch = { source, kind: 'product', unitCost: '999.00', dateReceived: 'invented', notes: 'fallback', grade: 'A' };
  const rows = tree => Object.fromEntries(elements(tree, node => node.type === 'div').map(row => [elements(row, node => node.type === 'dt')[0].props.children, elements(row, node => node.type === 'dd')[0].props.children]));
  let values = rows(render(ui.BatchDetailsFields, { batch }));
  assert.equal(values['Product name'], 'Milk');
  assert.equal(values['Remaining stock'], '0.00 liter');
  assert.equal(values.Category, 'Dairy');
  for (const label of ['Type', 'Grade', 'Unit cost', 'Date received', 'Notes']) assert.equal(label in values, false);
  values = rows(render(ui.BatchDetailsFields, { batch: { ...batch, source: { ...source, unit_price: '0.00', notes: 'Keep refrigerated' } } }));
  assert.equal(values['Unit cost'], '0.00');
  assert.equal(values.Notes, 'Keep refrigerated');
  const ingredient = { ...source, ingredient: { name: 'Cream', unit: 'liter' } };
  delete ingredient.product;
  values = rows(render(ui.BatchDetailsFields, { batch: { ...batch, kind: 'ingredient', category: 'Ingredients', source: ingredient } }));
  assert.equal(values['Product name'], 'Cream');
  assert.equal('Category' in values, false);
});

test('staff inventory keeps expired batch actions view-only on mobile and desktop', () => {
  const row = { id: 1, name: 'Milk', cat: 'Dairy', price: 120, stock: 5, expiry: '2000-01-01', low: false,
    expiredBatch: { id: 7, key: 'product-7', kind: 'product', name: 'Milk', batch: 'EX-7', quantity: 5, status: 'available' } };
  const props = { readOnly: true, data: [row], rowKey: item => item.id, columns: [{ key: 'name', header: 'Product' }, { key: 'actions', header: 'Actions' }] };
  let tree = render(ui.ProductTable, props);
  const table = elements(tree, node => node.type === ui.EnhancedTable)[0];
  assert.equal(table.props.pageSize, 5);
  const buttons = elements(table.props.columns.at(-1).render(row, 0), node => node.props.label);
  assert.deepEqual(buttons.map(node => node.props.label), ['View details']);
  const mobile = table.props.renderMobileRow(row, 0);
  const card = mobile.type(mobile.props);
  const mobileButtons = elements(card, node => node.type === 'button');
  assert.equal(mobileButtons.length, 1);
  assert.equal(mobileButtons[0].props['aria-label'], 'View details');
  mobileButtons[0].props.onClick();
  tree = render(ui.ProductTable, props);
  assert.equal(elements(tree, node => node.props.title === 'Expired batch details')[0].props.open, true);
});

test('mobile ProductTable keeps five products per page despite a legacy one-row capacity', () => {
  const products = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Product ${index + 1}`, cat: 'Dairy', price: 120, stock: 30, expiry: '', low: false }));
  const tree = render(ui.ProductTable, {
    data: products, columns: [{ key: 'name', header: 'Product' }], rowKey: item => item.id,
    pageSize: 1, autoPageSize: true, pageCapacity: { pageSize: 1 },
    renderMobileRow: product => React.createElement(ui.MobileInventoryCard, { product, onEdit() {}, onDelete() {} }),
  });
  const table = elements(tree, node => node.type === ui.EnhancedTable)[0];
  assert.equal(table.props.pageSize, 5);
  assert.equal(table.props.autoPageSize, false);
  assert.equal(table.props.pageCapacity, undefined);
  states = []; refs = [];
  const page = render(ui.EnhancedTable, table.props);
  assert.equal(elements(page, node => node.type === ui.MobileInventoryCard).length, 5);
  assert.ok(elements(page, node => node.props.children === 'Page 1 of 2').length > 0);
});

test('shared ProductTable keeps batch edits scoped to batches and uses five-row catalog pagination', async () => {
  const batch = { id: 7, itemId: 1, key: 'ingredient-7', kind: 'ingredient', name: 'Cream', batch: 'EX-7',
    quantity: 5, unit: 'liter', expiry: '2000-01-01', status: 'available', unitCost: '10.00' };
  const row = { id: 1, catalogKey: 'expired-ingredient-7', name: 'Cream', cat: 'Ingredients', price: 10, stock: 5,
    expiry: batch.expiry, low: false, expiredBatch: batch };
  const props = { data: [row], rowKey: item => item.id, columns: [
    { key: 'name', header: 'Product' }, { key: 'cat', header: 'Category' }, { key: 'price', header: 'Price' },
    { key: 'stock', header: 'Stock' }, { key: 'expiry', header: 'Expiry' }, { key: 'status', header: 'Status' },
    { key: 'actions', header: 'Actions', render: () => null },
  ] };
  let tree = render(ui.ProductTable, props);
  const table = elements(tree, node => Array.isArray(node.props.columns))[0];
  assert.equal(table.props.pageSize, 5); assert.equal(table.props.rowHeight, 56);
  assert.equal(table.props.rowKey(row), row.catalogKey);
  const buttons = elements(table.props.columns.at(-1).render(row), node => !!node.props.label);
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every(button => button.props.className.includes('border-slate-200')));
  buttons[1].props.onClick();
  tree = render(ui.ProductTable, props);
  const edit = elements(tree, node => node.props.title === 'Edit batch')[0];
  assert.equal(edit.props.open, true);
  const input = elements(edit, node => node.type === 'input')[0];
  input.props.onChange({ target: { value: '12.50' } });
  tree = render(ui.ProductTable, props);
  const requests = [];
  ui.http.defaults.adapter = async config => { requests.push(config); return { status: 200, config, headers: {}, data: {} }; };
  await elements(elements(tree, node => node.props.title === 'Edit batch')[0], node => node.type === 'button')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].url, '/inventory/ingredient-batches/7/');
  assert.deepEqual(JSON.parse(requests[0].data), { unit_price: 12.5, notes: '' });
});

test('forced query refresh bypasses fresh nested caches and retains visible data', async () => {
  let calls = 0;
  const nestedKey = `${ui.dataCacheEpoch()}:forced:nested`;
  const Component = () => ui.useCachedQuery('forced:outer', () => ui.fetchDataCache(nestedKey, async () => ++calls, ['inventory']), ['inventory']);
  render(Component); effects.at(-1)(); await settle();
  assert.equal(render(Component).data, 1);
  await render(Component).refresh();
  assert.equal(calls, 1);
  const pending = render(Component).refresh({ force: true });
  assert.equal(render(Component).data, 1);
  assert.equal(render(Component).loading, false);
  await pending; await settle();
  assert.equal(calls, 2);
  assert.equal(render(Component).data, 2);
});

test('Card forwards HTML attributes and events without changing its classes', () => {
  const onClick = () => {};
  const tree = render(ui.Card, { children: 'Contents', className: 'p-5', 'aria-busy': true, id: 'metrics', onClick });
  assert.equal(tree.props['aria-busy'], true);
  assert.equal(tree.props.id, 'metrics');
  assert.equal(tree.props.onClick, onClick);
  assert.equal(tree.props.className, 'bg-white border border-slate-100 rounded-xl shadow-sm p-5');
});

test('FEFO monitor displays five items while summary totals cover the whole feed', () => {
  const batches = Array.from({ length: 7 }, (_, index) => ({ id: index, product: `Milk ${index}`, batch: `B-${index}`, qty: 5, expiry: '2000-01-01', days: -1, st: 'red', priority: 'Critical' }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:dashboard:fefo-monitor`, [[], batches], ['inventory', 'dashboard']);
  const tree = render(ui.FEFOMonitor);
  assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 5);
  assert.equal(elements(tree, node => node.type === 'p' && /^Milk /.test(node.props.children ?? '')).length, 5);
  assert.ok(elements(tree, node => node.props.children === '7').length > 0);
});

test('admin data views show retry errors rather than empty data after initial failure', async () => {
  authState = { user: { username: 'audit', email: 'audit@example.com' }, loading: false };
  for (const [Page, key, groups] of [
    [ui.AdminCustomers, 'customers:list:all', ['customers']],
    [ui.AdminUserManagement, 'users:list', ['users']],
    [ui.FEFOMonitor, 'dashboard:fefo-monitor', ['dashboard', 'inventory']],
    [ui.AdminOrders, 'orders:list', ['orders']],
    [ui.AdminSalesHistory, 'sales:history:', ['sales']],
    [ui.AdminInventory, 'inventory:admin', ['inventory']],
  ]) {
    states = []; refs = []; effects = [];
    await assert.rejects(ui.fetchDataCache(`${ui.dataCacheEpoch()}:${key}`, async () => { throw new Error('Service unavailable'); }, groups));
    const tree = render(Page);
    const error = elements(tree, node => node.type === ui.QueryErrorMessage)[0];
    assert.ok(error);
    assert.equal(error.props.error.message, 'Service unavailable');
    assert.equal(elements(tree, node => node.type === ui.EnhancedTable).length, 0);
    const message = render(ui.QueryErrorMessage, error.props);
    assert.equal(message.props.role, 'alert');
    assert.equal(elements(message, node => node.type === 'button')[0].props.children, 'Retry');
  }
});

test('Orders, Sales and Inventory retries recover into a valid empty state only after a successful response', async () => {
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config.url);
    return { config, status: 200, headers: {}, data: config.url === '/settings/inventory/'
      ? { low_stock_threshold: 20, near_expiry_threshold: 7, critical_expiry_threshold: 3 } : [] };
  };
  for (const [Page, key, group] of [
    [ui.AdminOrders, 'orders:list', 'orders'],
    [ui.AdminSalesHistory, 'sales:history:', 'sales'],
    [ui.AdminInventory, 'inventory:admin', 'inventory'],
  ]) {
    states = []; refs = []; effects = [];
    const cacheKey = `${ui.dataCacheEpoch()}:${key}`;
    await assert.rejects(ui.fetchDataCache(cacheKey, async () => { throw new Error('Service unavailable'); }, [group]));
    const failed = render(Page);
    const error = elements(failed, node => node.type === ui.QueryErrorMessage)[0];
    assert.ok(error);
    error.props.onRetry();
    await settle();
    assert.deepEqual(ui.readDataCache(cacheKey).data, []);
    assert.equal(ui.readDataCache(cacheKey).error, undefined);
    states = []; refs = []; effects = [];
    assert.equal(elements(render(Page), node => node.type === ui.QueryErrorMessage).length, 0);
  }
  assert.ok(requests.includes('/sales/orders/'));
  assert.ok(requests.includes('/sales/transactions/'));
  assert.ok(requests.includes('/inventory/products/'));
});

test('admin content permits vertical scrolling and email titles use the actual email field', () => {
  authState = { user: { username: 'audit', email: 'audit@example.com' }, loading: false };
  const main = elements(render(ui.AdminLayout, { onLogout() {} }), node => node.type === 'main')[0];
  assert.ok(main.props.className.includes('overflow-y-auto'));
  assert.ok(!main.props.className.includes('overflow-hidden'));
  const user = { name: 'Staff', email: 'a.long.email@example.com', role: 'Staff', status: 'Active', last: 'Never' };
  const card = render(ui.MobileUserCard, { user, actions: null });
  const email = elements(card, node => node.type === 'p')[0];
  assert.equal(email.props.title, user.email);
  assert.equal(email.props.children, user.email);
  assert.equal(email.props.className, 'w-full truncate max-w-[180px] sm:max-w-none text-xs text-slate-500');
});

test('expired mobile batch cards label batch operations while normal products retain their labels', () => {
  const product = { id: 1, name: 'Milk', cat: 'Dairy', price: 120, stock: 5, expiry: '2000-01-01', low: false };
  const props = { product: { ...product, expiredBatch: { batch: 'B-1' } }, onEdit() {}, onDelete() {} };
  let tree = render(ui.MobileInventoryCard, props);
  elements(tree, node => node.type === 'button')[0].props.onClick();
  tree = render(ui.MobileInventoryCard, props);
  assert.ok(elements(tree, node => node.type === 'button' && node.props.children.includes('Edit Batch')).length);
  assert.ok(elements(tree, node => node.type === 'button' && node.props.children.includes('Dispose Batch')).length);
  tree = render(ui.MobileInventoryCard, { ...props, product });
  assert.ok(elements(tree, node => node.type === 'button' && node.props.children.includes('Edit Product')).length);
});
