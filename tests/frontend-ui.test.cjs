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
let captureLayoutEffects = false, layoutEffects = [];
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useId() { return `test-tooltip-${refIndex++}`; },
  useEffect(effect) { effects.push(() => { const cleanup = effect(); if (typeof cleanup === 'function') effectCleanups.push(cleanup); return cleanup; }); }, useLayoutEffect(effect) { if (captureLayoutEffects) layoutEffects.push(effect); },
  useContext() { return { theme: 'light', ...authState }; },
  useMemo: fn => fn(), useCallback: fn => fn,
};
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { default as http } from './src/lib/api';
    export { AuthProvider } from './src/features/auth/context/AuthContext';
    export { AppShell } from './src/app/App';
    export { EmptyState } from './src/components/EmptyState';
    export { ProductTable } from './src/features/inventory/components/ProductTable';
    export { Card } from './src/components/data-display/Card';
    export { Modal } from './src/components/overlays/Modal';
    export { useAutoPageSize, calculatePageSize, calculateViewportPageSize, calculateFittedPageSize, calculateNaturalPageSize } from './src/hooks/useAutoPageSize';
    export { TableCard, TABLE_CARD_CLASS_NAME } from './src/components/data-display/TableCard';
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
    export { SaleComposer } from './src/features/sales/components/SaleComposer';
    export { SaleLineEditor } from './src/features/sales/components/SaleLineEditor';
    export { CustomerHistory } from './src/features/customers/components/CustomerHistory';
    export { PaymentUpdateControl } from './src/features/sales/components/PaymentUpdateControl';
    export { InventoryOutflows } from './src/features/inventory/components/InventoryOutflows';
    export { SalesEncoding } from './src/features/sales/pages/SalesEncoding';
    export * from './src/features/sales/utils/manualPricing';
    export { StaffKPICards } from './src/features/dashboard/components/staff/StaffKPICards';
    export { KPICards } from './src/features/dashboard/components/admin/KPICards';
    export { StaffRecentOrders } from './src/features/dashboard/components/staff/StaffRecentOrders';
    export * from './src/lib/saleSubmission';
    export { MobileCategoryCard } from './src/features/inventory/components/MobileCategoryCard';
    export { MobileInventoryCard } from './src/features/inventory/components/MobileInventoryCard';
    export { EnhancedTable } from './src/components/data-display/EnhancedTable';
    export * from './src/features/inventory/components/InventoryWarnings';
    export { AdminInventory } from './src/features/inventory/pages/AdminInventory';
    export { StaffInventoryTable } from './src/features/inventory/components/StaffInventoryTable';
    export { StaffOrdersTable } from './src/features/orders/components/StaffOrdersTable';
    export { StaffInventory } from './src/features/inventory/pages/StaffInventory';
    export { AdminCategories } from './src/features/inventory/pages/AdminCategories';
    export { AdminCustomers } from './src/features/customers/pages/AdminCustomers';
    export { AdminUserManagement } from './src/features/users/pages/AdminUserManagement';
    export { AdminSettings } from './src/features/settings/pages/AdminSettings';
    export { PersonalProfileSettings } from './src/features/settings/components/PersonalProfileSettings';
    export { SETTINGS_UPDATED } from './src/features/settings/api/settings.service';
    export { useReportVersion, useReportPreview } from './src/features/reports/hooks/useReportPreview';
    export { ReportDateRangeControl } from './src/features/reports/components/ReportDateRangeControl';
    export * from './src/features/reports/utils/reportDateRange';
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
  if (tree.type === ui.CustomerTable || tree.type === ui.OrdersTable || tree.type === ui.StaffOrdersTable) {
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.type(tree.props), predicate)];
  }
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
beforeEach(() => {
  captureLayoutEffects = false; layoutEffects = [];
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
  const orders = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, invoiceNumber: `INV-${index}`, customer: 'Customer', staff: 'Staff', staffId: 7, date: '2026-10-11', total: 120, status: 'Fulfilled', isHistorical: false }));
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

test('Staff Orders scopes its table and all summary cards by staff ID while Admin Orders stays store-wide', () => {
  authState = { user: { id: 7, username: 'audit' }, loading: false };
  const mine = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1, customer: 'Customer', invoiceNumber: '', staff: 'Previous username', staffId: 7,
    date: '2026-10-19', total: 10, status: index < 4 ? 'Fulfilled' : 'Cancelled', isHistorical: false,
  }));
  const other = [
    { ...mine[0], id: 7, staffId: 8, staff: 'audit' },
    { ...mine[5], id: 8, staffId: 8, staff: 'audit' },
    { ...mine[0], id: 9, staffId: null, staff: 'Not recorded', isHistorical: true },
  ];
  const all = Object.freeze([...mine, ...other]);
  const key = `${ui.dataCacheEpoch()}:orders:list`;
  ui.writeDataCache(key, all, ['orders']);
  const summary = tree => elements(tree, node => ['Total', 'Fulfilled', 'Cancelled'].includes(node.props.label)).map(node => node.props.value);
  const table = tree => elements(tree, node => node.type === ui.EnhancedTable)[0];
  let tree = render(ui.StaffOrders);
  assert.deepEqual(table(tree).props.data, mine);
  assert.deepEqual(summary(tree), [6, 4, 2]);
  assert.equal(table(tree).props.pageSize, 5);
  assert.equal(table(tree).props.reserveTableHeight, false);
  assert.ok(elements(tree, node => node.type === 'div' && node.props.className?.includes('table-card')).length > 0);
  table(tree).props.extraControls.props.onChange({ target: { value: 'Fulfilled' } });
  tree = render(ui.StaffOrders);
  assert.deepEqual(table(tree).props.data, mine.slice(0, 4));
  assert.deepEqual(summary(tree), [6, 4, 2], 'Status filtering does not change the staff totals');
  assert.equal(ui.readDataCache(key).data, all, 'The shared store-wide cache is not filtered in place');
  states = []; refs = []; effects = [];
  tree = render(ui.AdminOrders);
  assert.deepEqual(table(tree).props.data, all);
  assert.deepEqual(summary(tree), [9, 6, 3]);
});

test('Staff Orders waits for initialized identity and never exposes cached orders for an unknown account', async () => {
  const orders = [
    { id: 1, staffId: 7, staff: 'audit', status: 'Fulfilled', isHistorical: false },
    { id: 2, staffId: 8, staff: 'other', status: 'Cancelled', isHistorical: false },
  ];
  ui.writeDataCache(`${ui.dataCacheEpoch()}:orders:list`, orders, ['orders']);
  let requests = 0;
  ui.http.defaults.adapter = async () => { requests++; throw new Error('Unexpected unscoped request'); };
  for (const context of [{ user: { id: 7, username: 'audit' }, loading: true }, { user: null, loading: false }]) {
    authState = context;
    const tree = render(ui.StaffOrders);
    effects.at(-1)(); await settle();
    assert.deepEqual(elements(tree, node => node.type === ui.EnhancedTable)[0].props.data, []);
    assert.deepEqual(elements(tree, node => ['Total', 'Fulfilled', 'Cancelled'].includes(node.props.label)).map(node => node.props.value), [0, 0, 0]);
  }
  assert.equal(requests, 0);
  authState = { user: { id: 8, username: 'other' }, loading: false };
  const tree = render(ui.StaffOrders);
  assert.deepEqual(elements(tree, node => node.type === ui.EnhancedTable)[0].props.data, [orders[1]]);
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
  const sales = Array.from({ length: 6 }, (_, index) => ({ transaction: { id: index + 1 }, receipt: `SI-${index}`, customer: 'Customer', cashier: 'Cashier', date: '2026-10-11', payment: 'Cash', total: 120 }));
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

test('profile username changes require and forward the current password without email', async () => {
  authState = { user: { id: 7, username: 'staff', email: 'old@example.com', first_name: 'Old', last_name: 'Name' }, setCurrentUser: value => { authState.user = value; } };
  render(ui.PersonalProfileSettings); effects[0]();
  let tree = render(ui.PersonalProfileSettings);
  const field = (tree, id) => elements(tree, node => node.type === 'input' && node.props.id === id)[0];
  field(tree, 'profile-username').props.onChange({ target: { value: 'new-name' } });
  tree = render(ui.PersonalProfileSettings);
  let requests = [];
  ui.http.defaults.adapter = async config => { requests.push(config); return { status: 200, config, headers: {}, data: { ...authState.user, username: 'new-name' } }; };
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(requests.length, 0);
  field(tree, 'profile-current-password').props.onChange({ target: { value: ' password ' } });
  tree = render(ui.PersonalProfileSettings);
  const submit = elements(tree, node => node.type === 'form')[0].props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  await pending;
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].data), { username: 'new-name', current_password: ' password ' });
  assert.equal(authState.user.username, 'new-name');
  assert.equal(elements(render(ui.PersonalProfileSettings), node => node.type === 'input' && node.props.type === 'password').length, 0);
});

test('a failed email request preserves its draft after other profile changes save and can retry or resend', async () => {
  authState = { user: { id: 7, username: 'staff', email: 'old@example.com', first_name: 'Old', last_name: 'Name' }, setCurrentUser: value => { authState.user = value; } };
  render(ui.PersonalProfileSettings); effects[0]();
  const input = (tree, id) => elements(tree, node => node.type === 'input' && node.props.id === id)[0];
  let tree = render(ui.PersonalProfileSettings);
  input(tree, 'profile-first_name').props.onChange({ target: { value: 'Updated' } });
  input(tree, 'profile-email').props.onChange({ target: { value: 'new@example.com' } });
  tree = render(ui.PersonalProfileSettings);
  input(tree, 'profile-current-password').props.onChange({ target: { value: 'password' } });
  const requests = [];
  let failEmail = true;
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    if (config.url === '/accounts/user/') return { status: 200, config, headers: {}, data: { ...authState.user, first_name: 'Updated' } };
    if (failEmail) throw new AxiosError('Throttled', undefined, config, undefined, { status: 429, data: { detail: 'Wait before requesting another code.' }, config });
    return { status: 200, config, headers: {}, data: {} };
  };
  tree = render(ui.PersonalProfileSettings);
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  render(ui.PersonalProfileSettings); effects.at(-1)();
  tree = render(ui.PersonalProfileSettings);
  assert.equal(input(tree, 'profile-email').props.value, 'new@example.com');
  assert.equal(input(tree, 'profile-first_name').props.value, 'Updated');
  assert.match(toastErrors.at(-1)[0], /Other profile changes were saved/);
  assert.ok(!toastErrors.at(-1)[0].includes('Profile changes are limited'));
  assert.deepEqual(JSON.parse(requests[0].data), { first_name: 'Updated' });
  failEmail = false;
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = render(ui.PersonalProfileSettings);
  input(tree, 'profile-email-otp').props.onChange({ target: { value: '12' } });
  tree = render(ui.PersonalProfileSettings);
  elements(tree, node => node.type === 'button' && node.props.children === 'Resend code')[0].props.onClick({ preventDefault() {} });
  await settle();
  assert.deepEqual(requests.map(call => [call.method, call.url]), [
    ['patch', '/accounts/user/'], ['post', '/accounts/email-change/'], ['post', '/accounts/email-change/'], ['post', '/accounts/email-change/'],
  ]);
  assert.equal(input(render(ui.PersonalProfileSettings), 'profile-email-otp').props.value, '');
});

test('profile email verification preserves drafts on failure and signs out only after successful confirmation', async () => {
  authState = { user: { id: 7, username: 'staff', email: 'old@example.com', first_name: 'Old', last_name: 'Name' }, setCurrentUser: value => { authState.user = value; } };
  const storage = new Map([['rosario_access_token', 'access'], ['rosario_refresh_token', 'refresh']]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  let redirected = '';
  window.location = { replace: value => { redirected = value; } };
  render(ui.PersonalProfileSettings); effects[0]();
  const input = (tree, id) => elements(tree, node => node.type === 'input' && node.props.id === id)[0];
  let tree = render(ui.PersonalProfileSettings);
  input(tree, 'profile-email').props.onChange({ target: { value: 'new@example.com' } });
  tree = render(ui.PersonalProfileSettings);
  input(tree, 'profile-current-password').props.onChange({ target: { value: 'password' } });
  const requests = [];
  let rejectCode = true;
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    if (config.method === 'patch' && rejectCode) throw new AxiosError('Invalid code', undefined, config, undefined, { status: 400, data: { detail: 'Invalid or expired verification code.' }, config });
    return { status: 200, config, headers: {}, data: {} };
  };
  tree = render(ui.PersonalProfileSettings);
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(requests[0].method, 'post');
  assert.equal(requests[0].url, '/accounts/email-change/');
  assert.equal(redirected, '');
  assert.equal(authState.user.email, 'old@example.com');
  tree = render(ui.PersonalProfileSettings);
  assert.ok(input(tree, 'profile-email-otp'));
  input(tree, 'profile-email-otp').props.onChange({ target: { value: '012345' } });
  tree = render(ui.PersonalProfileSettings);
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = render(ui.PersonalProfileSettings);
  assert.equal(input(tree, 'profile-email').props.value, 'new@example.com');
  assert.equal(input(tree, 'profile-email-otp').props.value, '012345');
  assert.equal(redirected, '');
  assert.equal(storage.get('rosario_access_token'), 'access');
  rejectCode = false;
  await elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.ok(requests.every(call => call.url === '/accounts/email-change/'));
  assert.deepEqual(JSON.parse(requests.at(-1).data), { email: 'new@example.com', current_password: 'password', otp: '012345' });
  assert.equal(storage.size, 0);
  assert.equal(redirected, '/');
});

for (const [label, failure, expected] of [
  ['network failure', config => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config), 'Unable to connect to the server'],
  ['server failure', config => new AxiosError('Server error', undefined, config, undefined, { status: 500, data: { detail: 'Server temporarily unavailable.' }, config }), 'Server temporarily unavailable.'],
  ['timeout', config => new AxiosError('timeout', AxiosError.ECONNABORTED, config), 'The request timed out'],
]) {
  test(`session initialization exposes ${label} and recovers on retry without discarding credentials`, async () => {
    const storage = new Map([['rosario_access_token', 'session-access'], ['rosario_refresh_token', 'session-refresh']]);
    global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    let requests = 0;
    const currentUser = { id: 7, username: 'staff', role: 'staff', email: 'staff@example.com' };
    ui.http.defaults.adapter = async config => {
      requests++;
      if (requests === 1) throw failure(config);
      return { status: 200, config, headers: {}, data: currentUser };
    };
    assert.equal(render(ui.AuthProvider).props.value.loading, true);
    const cleanup = effects[0](); effects[1]();
    await settle();
    const failed = render(ui.AuthProvider).props.value;
    assert.equal(failed.loading, false);
    assert.equal(failed.user, null);
    assert.ok(failed.authError.includes(expected));
    assert.equal(storage.get('rosario_access_token'), 'session-access');
    assert.equal(storage.get('rosario_refresh_token'), 'session-refresh');
    cleanup();
    failed.retrySession();
    const retrying = render(ui.AuthProvider).props.value;
    assert.equal(retrying.loading, true);
    assert.equal(retrying.authError, null);
    retrying.retrySession();
    assert.equal(states[4], 1, 'A pending retry cannot queue another check');
    effects.at(-2)();
    await settle();
    const recovered = render(ui.AuthProvider).props.value;
    assert.deepEqual(recovered.user, currentUser);
    assert.equal(recovered.loading, false);
    assert.equal(recovered.authError, null);
    assert.equal(requests, 2);
  });
}

test('initial session 401 still signs out rather than showing a connection retry', async () => {
  const storage = new Map([['rosario_access_token', 'expired']]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  ui.http.defaults.adapter = async config => { throw new AxiosError('Unauthorized', undefined, config, undefined, { status: 401, data: {}, config }); };
  render(ui.AuthProvider); effects[0](); effects[1]();
  await settle();
  const result = render(ui.AuthProvider).props.value;
  assert.equal(result.loading, false);
  assert.equal(result.user, null);
  assert.equal(result.authError, null);
  assert.equal(result.sessionExpired, true);
  assert.equal(storage.size, 0);
});

for (const action of ['logout', 'unmount']) {
  test(`a delayed session check cannot update auth after ${action}`, async () => {
    const storage = new Map([['rosario_access_token', 'session-access']]);
    global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    let resolve;
    ui.http.defaults.adapter = config => new Promise(done => { resolve = () => done({ status: 200, config, headers: {}, data: { id: 7, username: 'staff' } }); });
    const initial = render(ui.AuthProvider).props.value;
    const cleanup = effects[0]();
    await settle();
    if (action === 'logout') initial.logout();
    else cleanup();
    const before = [...states];
    resolve(); await settle();
    assert.deepEqual(states, before);
    assert.equal(render(ui.AuthProvider).props.value.user, null);
  });
}

test('session connection failures present an accessible Retry connection action', () => {
  let retried = 0;
  authState = { user: null, loading: false, authError: 'Server temporarily unavailable.', retrySession: () => { retried++; } };
  const tree = render(ui.AppShell);
  assert.equal(tree.props.role, 'alert');
  const error = elements(tree, node => node.type === ui.EmptyState)[0];
  assert.equal(error.props.description, authState.authError);
  assert.equal(error.props.action.props.children, 'Retry connection');
  error.props.action.props.onClick();
  assert.equal(retried, 1);
  authState.loading = true;
  const pending = render(ui.AppShell);
  assert.equal(pending.props['aria-busy'], 'true');
  assert.equal(elements(pending, node => node.type === ui.EmptyState).length, 0);
});

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

test('staff fulfilled KPI counts only fulfilled orders processed by the logged-in staff member', async () => {
  authState = { user: { id: 7, username: 'audit' }, loading: false };
  const order = (id, status, username, historical = false) => ({
    id, status, customer: { id: 1, name: 'Customer' }, handled_by: { id: username === 'audit' ? 7 : 8, username },
    created_at: '2020-01-01T12:00:00+08:00', items: [],
    transaction: { id, total_amount: '10.00', subtotal: '10.00', discount_amount: '0.00', payment_method: 'cash', amount_tendered: '10.00', change_due: '0.00', source_reference: historical ? 'imported' : null },
  });
  const orders = [
    order(1, 'fulfilled', 'audit'), order(2, 'fulfilled', 'audit'),
    order(3, 'cancelled', 'audit'), order(4, 'fulfilled', 'other'), order(5, 'fulfilled', 'audit', true),
  ];
  orders[0].handled_by.username = 'previous-username';
  orders[3].handled_by.username = 'audit';
  ui.http.defaults.adapter = async config => ({
    status: 200, config, headers: {},
    data: config.url === '/sales/orders/' ? { count: orders.length, next: null, results: orders } : [],
  });
  render(ui.StaffKPICards);
  const cleanup = effects.at(-1)();
  try {
    await settle();
    const cards = staffCards(render(ui.StaffKPICards));
    const fulfilled = cards.find(card => card.props.title === 'Fulfilled Orders');
    assert.equal(fulfilled.props.value, '2');
    assert.equal(fulfilled.props.detail, 'Completed orders you processed');
    assert.equal(fulfilled.props.trendLabel, 'All time');
    assert.deepEqual(cards.map(card => card.props.value), ['\u20b10', '0', '2', '0 / 0']);
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


async function composerFixture(mode = 'checkout', role = 'staff') {
  authState.user = { id: 7, username: 'audit', email: 'audit@example.com', role };
  const product = { id: 385, name: 'Milk', unit: 'unit', is_active: true, total_stock: '19', low_stock_threshold: 0, category: { name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  ui.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data:
    config.url === '/inventory/products/' ? [product] : config.url === '/inventory/product-batches/' ? [{ id: 1, product, status: 'available', remaining_quantity: '19', expiration_date: '2099-10-17', unit_price: null, batch_number: 'B1' }] : config.url === '/sales/customers/' ? [{ id: 906, name: 'Customer', is_active: true, created_at: '2026-10-01' }] : [] });
  render(ui.SaleComposer, { mode, onSuccess() {} });
  effects[0](); await settle();
  const props = { mode, onSuccess() {} };
  let tree = render(ui.SaleComposer, props);
  const add = elements(tree, node => node.type === 'button' && elements(node, child => child.props.children === 'Milk').length)[0];
  add.props.onClick();
  tree = render(ui.SaleComposer, props);
  const line = elements(tree, node => node.type === ui.SaleLineEditor)[0];
  assert.equal(line.props.line.unitPrice, '', 'New sale prices always start blank');
  const changeLine = changes => {
    const current = elements(render(ui.SaleComposer, props), node => node.type === ui.SaleLineEditor)[0];
    current.props.onChange({ ...current.props.line, ...changes });
  };
  const field = label => elements(render(ui.SaleComposer, props), node => node.props['aria-label'] === label)[0];
  const submit = () => elements(render(ui.SaleComposer, props), node => node.type?.name === 'Btn' && ['Complete Transaction', 'Submit & Fulfill', 'Save sales entry', 'Saving...'].includes(node.props.children))[0].props.onClick();
  return { props, changeLine, field, submit };
}

test('order form validates per-line discounts and blocks duplicate pending submissions', async () => {
  const form = await composerFixture('order', 'admin');
  const picker = elements(render(ui.SaleComposer, form.props), node => node.type?.name === 'CustomerPicker')[0];
  picker.props.onChange('906');
  form.changeLine({ unitPrice: '50', discountType: 'fixed', discountValue: '60' });
  form.field('Amount tendered').props.onChange({ target: { value: '100' } });
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  await form.submit(); assert.equal(requests, 0);
  form.changeLine({ discountValue: '0' });
  const first = form.submit(); await settle();
  await form.submit(); assert.equal(requests, 1);
  reject(new Error('Simulated outage')); await first;
  assert.equal(refs[0].current, false);
});

test('manual line totals and item discounts use decimal half-up rounding', () => {
  const line = (price, quantity, discountType = 'none', discountValue = '0') => ({ productId: 1, name: 'Milk', stock: 20, unitPrice: price, quantity, discountType, discountValue });
  assert.equal(ui.priceSale([line('0.1', '3')], false).total, 30n);
  assert.equal(ui.priceSale([line('2.99', '3', 'percent', '12.5')], true).total, 785n);
  assert.equal(ui.priceSale([line('1.99', '0.33')], false).total, 66n);
  assert.equal(ui.validateTender('0.30', 30n), '0.30');
});

test('POS blocks underpayment and nonfinite cash without sending requests', async () => {
  const form = await composerFixture(); form.changeLine({ unitPrice: '0.10', quantity: '3' });
  let requests = 0; ui.http.defaults.adapter = async () => { requests++; throw new Error('Should not reach network'); };
  for (const value of ['0.29', '', 'NaN', 'Infinity']) {
    form.field('Amount tendered').props.onChange({ target: { value } });
    await form.submit();
    assert.equal(requests, 0);
  }
});

test('POS sends explicit canonical prices, quantities and tender without invoice discounts', async () => {
  const form = await composerFixture(); form.changeLine({ unitPrice: '0.10', quantity: '3' });
  form.field('Amount tendered').props.onChange({ target: { value: '0.30' } });
  let payload; ui.http.defaults.adapter = async config => { payload = JSON.parse(config.data); throw new AxiosError('Simulated outage'); };
  await form.submit();
  assert.equal(payload.amount_tendered, '0.30');
  assert.deepEqual(payload.items, [{ product_id: 385, quantity: '3.00', unit_price: '0.10', discount_type: 'none', discount_value: '0.00' }]);
  assert.equal('discount_type' in payload, false);
});

for (const role of ['staff', 'admin']) {
  test(`shared sale editor enforces ${role} line-discount permissions and payloads`, async () => {
    const form = await composerFixture('checkout', role);
    form.changeLine({ unitPrice: '100', discountType: 'percent', discountValue: '25' });
    const node = elements(render(ui.SaleComposer, form.props), item => item.type === ui.SaleLineEditor)[0];
    assert.equal(node.props.canDiscount, role === 'admin');
    const fields = render(ui.SaleLineEditor, node.props);
    assert.equal(elements(fields, item => item.props['aria-label'] === 'Discount type for Milk').length, role === 'admin' ? 1 : 0);
    form.field('Amount tendered').props.onChange({ target: { value: role === 'admin' ? '75' : '100' } });
    let payload; ui.http.defaults.adapter = async config => { payload = JSON.parse(config.data); throw new AxiosError('Simulated outage'); };
    await form.submit();
    assert.equal(payload.items[0].discount_type, role === 'admin' ? 'percent' : 'none');
    assert.equal(payload.items[0].discount_value, role === 'admin' ? '25.00' : '0.00');
    assert.equal('discount_value' in payload, false);
  });
}

test('POS keeps a synchronous submission lock and unlocks after a network failure', async () => {
  const form = await composerFixture(); form.changeLine({ unitPrice: '50' });
  form.field('Amount tendered').props.onChange({ target: { value: '100' } });
  let requests = 0, reject;
  ui.http.defaults.adapter = () => { requests++; return new Promise((_, fail) => { reject = fail; }); };
  const first = form.submit(); await settle(); await form.submit(); assert.equal(requests, 1);
  reject(new Error('Simulated outage')); await first;
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
      assert.ok(elements(tree, node => node.type === (component === ui.StaffInventory ? ui.StaffInventoryTable : ui.ProductTable)).length > 0);
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
  assert.ok(cards[0].props.className.includes('bg-white'));
  assert.ok(cards.slice(1).every(card => card.props.className.includes('bg-slate-50/60')));
  assert.ok(cards.every(card => !card.props.className.includes('border-l-') && card.props.className.includes('border-b border-slate-100 last:border-b-0')));
  const badge = card => elements(card, node => node.type === 'span' && node.props.className?.includes('text-[10px]') && node.props.className.includes('rounded'))[0];
  assert.ok(badge(cards[0]).props.className.includes('bg-slate-100 text-slate-500'));
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
  const badge = elements(cards[0], node => node.type === 'span' && node.props.className?.includes('rounded px-1 text-[10px] font-medium'))[0];
  assert.ok(badge.props.className.includes('bg-slate-100 text-slate-500'));
  assert.ok(cards[0].props.className.includes('bg-white'));
  assert.ok(!cards[0].props.className.includes('border-l-'));
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
  let tree = render(ui.StaffInventoryTable, props);
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
  tree = render(ui.StaffInventoryTable, props);
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
  assert.ok(!main.props.className.split(/\s+/).includes('overflow-hidden'));
  states[0] = 'orders';
  const recordsMain = elements(render(ui.AdminLayout, { onLogout() {} }), node => node.type === 'main')[0];
  assert.ok(recordsMain.props.className.includes('md:overflow-hidden'));
  assert.ok(recordsMain.props.className.includes('overflow-y-auto'));
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


test('Staff Inventory uses five cards or rows consistently across mobile and desktop', () => {
  const products = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, name: `Product ${index + 1}`, cat: 'Dairy', price: 120, stock: 30, expiry: '', low: false }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:staff`, products, ['inventory']);
  const wrapper = elements(render(ui.StaffInventory), node => node.type === ui.StaffInventoryTable)[0];
  assert.equal(wrapper.props.pageSize, 5);
  states = []; refs = [];
  const tree = render(ui.StaffInventoryTable, { ...wrapper.props, pageSize: 1, autoPageSize: true, pageCapacity: { pageSize: 1 } });
  const table = elements(tree, node => node.type === ui.EnhancedTable)[0];
  assert.equal(table.props.pageSize, 5);
  assert.equal(table.props.autoPageSize, false);
  assert.equal(table.props.pageCapacity, undefined);
  for (const desktop of [false, true]) {
    states = []; refs = [];
    window.matchMedia = () => ({ matches: desktop, addEventListener() {}, removeEventListener() {} });
    const page = render(ui.EnhancedTable, table.props);
    assert.equal(elements(page, node => node.type === 'tbody')[0].props.children.length, 5);
    assert.equal(elements(page, node => node.type === table.props.renderMobileRow(products[0]).type).length, 5);
    assert.ok(elements(page, node => node.props.children === 'Page 1 of 2').length > 0);
    elements(page, node => node.type === 'button').at(-1).props.onClick();
    const next = render(ui.EnhancedTable, table.props);
    assert.equal(elements(next, node => node.type === 'tbody')[0].props.children.length, 2);
    assert.ok(elements(next, node => node.props.children === 'Page 2 of 2').length > 0);
  }
});


test('Staff Orders and Inventory preserve card styling while showing fetch errors and force-retrying', async () => {
  authState = { user: { id: 7, username: 'audit', role: 'staff' }, loading: false };
  const requests = [];
  ui.http.defaults.adapter = async config => {
    requests.push(config.url);
    return { config, status: 200, headers: {}, data: [] };
  };
  for (const [Page, Wrapper, key, group] of [
    [ui.StaffOrders, ui.StaffOrdersTable, 'orders:list', 'orders'],
    [ui.StaffInventory, ui.StaffInventoryTable, 'inventory:staff', 'inventory'],
  ]) {
    states = []; refs = []; effects = [];
    const cacheKey = `${ui.dataCacheEpoch()}:${key}`;
    await assert.rejects(ui.fetchDataCache(cacheKey, async () => { throw new Error('Service unavailable'); }, [group]));
    const page = render(Page);
    const wrapper = elements(page, node => node.type === Wrapper)[0];
    const failed = render(Wrapper, wrapper.props);
    const error = elements(failed, node => node.type === ui.QueryErrorMessage)[0];
    assert.equal(error.props.error.message, 'Service unavailable');
    assert.equal(elements(failed, node => node.type === ui.EnhancedTable).length, 0);
    const frame = elements(failed, node => node.type === 'div' && node.props.className?.includes('bg-white rounded-xl'))[0].props.className;
    error.props.onRetry(); await settle();
    assert.deepEqual(ui.readDataCache(cacheKey).data, []);
    assert.equal(ui.readDataCache(cacheKey).error, undefined);
    states = []; refs = []; effects = [];
    const recovered = elements(render(Page), node => node.type === Wrapper)[0];
    const success = render(Wrapper, recovered.props);
    assert.equal(elements(success, node => node.type === ui.QueryErrorMessage).length, 0);
    assert.equal(elements(success, node => node.type === ui.EnhancedTable).length, 1);
    assert.equal(elements(success, node => node.type === 'div' && node.props.className?.includes('bg-white rounded-xl'))[0].props.className, frame);
  }
  assert.ok(requests.includes('/sales/orders/'));
  assert.ok(requests.includes('/inventory/products/'));
});

test('auth startup handles a blocked browser storage getter without throwing or staying loading', async () => {
  const original = global.localStorage;
  try {
    Object.defineProperty(global, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    render(ui.AuthProvider);
    assert.doesNotThrow(() => effects[0]());
    await settle();
    const auth = render(ui.AuthProvider).props.value;
    assert.equal(auth.loading, false);
    assert.equal(auth.user, null);
    assert.equal(auth.authError, null);
  } finally {
    Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: original });
    // Clear the in-memory tombstone from the failed refresh-token removal.
    const auth = render(ui.AuthProvider).props.value;
    auth.logout();
  }
});


test('all table card variants use natural height and content-height footers follow the last row', () => {
  const props = { data: [], columns: [{ key: 'name', header: 'Name' }], rowKey: row => row.id };
  for (const Wrapper of [ui.TableCard, ui.OrdersTable, ui.CustomerTable, ui.StaffOrdersTable, ui.StaffInventoryTable]) {
    states = []; refs = [];
    const tree = render(Wrapper, props);
    const frame = elements(tree, node => node.type === 'div' && node.props.className?.includes('bg-white rounded-xl'))[0];
    assert.ok(frame.props.className.includes('p-4 sm:p-5 shadow-sm h-auto shrink-0'));
    const classes = frame.props.className.split(/\s+/);
    assert.ok(!classes.some(value => value === 'flex-1' || value === 'h-full' || /^min-h-\[/.test(value)));
    assert.ok(classes.includes('md:flex-1'));
    assert.ok(!classes.includes('overflow-hidden'));
    assert.ok(!classes.includes('min-h-0'));
  }
  for (const count of [1, 2, 5, 6]) {
    states = []; refs = [];
    const tree = render(ui.EnhancedTable, { ...props, contentHeight: true, reserveTableHeight: false,
      data: Array.from({ length: count }, (_, id) => ({ id, name: `Record ${id}` })), pageSize: 6 });
    const rows = elements(tree, node => node.type === 'tbody')[0].props.children;
    assert.equal(rows.length, count);
    assert.ok(rows.every(row => row.props.className.includes('h-auto')));
    assert.ok(elements(tree, node => node.type === 'td').every(cell => cell.props.className.includes('py-3')));
    const footer = elements(tree, node => node.type === 'div' && node.props.className?.includes('border-t border-slate-100'))[0];
    assert.ok(footer.props.className.includes('mt-4 pt-3'));
    assert.ok(!footer.props.className.includes('mt-auto'));
    assert.ok(elements(footer, node => node.props.children === 'Page 1 of 1').length > 0);
  }
});


test('adaptive table observer measures available space and intrinsic contents, clamps 4?10, and disconnects', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let resized, disconnected = false, contentHeight = 32;
  const observed = [];
  global.ResizeObserver = class { constructor(callback) { resized = callback; } observe(node) { observed.push(node); } disconnect() { disconnected = true; } };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' });
  let cleanup;
  try {
    const surface = { clientHeight: 340, querySelectorAll: () => [{ children: [{ getBoundingClientRect: () => ({ height: contentHeight }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 4, maxPageSize: 10, measureRows: true });
    let capacity = render(Hook);
    capacity.containerRef(surface); capacity.headerRef(header);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 5);
    assert.deepEqual(observed, [surface, header]);
    surface.clientHeight = 620; resized();
    assert.equal(render(Hook).pageSize, 10);
    surface.clientHeight = 240; resized();
    assert.equal(render(Hook).pageSize, 4);
    surface.clientHeight = 900; contentHeight = 100;
    render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 6, 'Wrapped content reduces capacity without measuring stretched row height');
    assert.equal(ui.calculatePageSize(500, 44, 48, 56, { minPageSize: 4, maxPageSize: 10 }), 7);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
  assert.equal(disconnected, true);
});

test('adaptive desktop tables resize, paginate and search while mobile retains its card capacity', () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const props = { contentHeight: true, responsivePageSize: true, pageSize: 5, showExport: false,
    columns: [{ key: 'name', header: 'Name', sortKey: row => row.name }],
    data: Array.from({ length: 30 }, (_, id) => ({ id, name: `Record ${id}` })), rowKey: row => row.id, searchKeys: row => [row.name] };
  let tree = render(ui.EnhancedTable, props);
  assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 5);
  states[3] = 8;
  tree = render(ui.EnhancedTable, props);
  assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 8);
  assert.ok(elements(tree, node => node.props.children === 'Page 1 of 4').length > 0);
  elements(tree, node => node.type === 'button').at(-1).props.onClick();
  tree = render(ui.EnhancedTable, props);
  assert.ok(elements(tree, node => node.props.children === 'Page 2 of 4').length > 0);
  states[3] = 5;
  render(ui.EnhancedTable, props); effects.at(-1)();
  tree = render(ui.EnhancedTable, props);
  assert.ok(elements(tree, node => node.props.children === 'Page 2 of 6').length > 0);
  const footer = elements(tree, node => node.type === 'div' && node.props.className?.includes('border-t border-slate-100'))[0];
  assert.ok(footer.props.className.includes('mt-auto pt-3'));
  elements(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'Record 29' } });
  tree = render(ui.EnhancedTable, props);
  assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 1);
  assert.ok(elements(tree, node => node.props.children === 'Page 1 of 1').length > 0);
});


test('every active data view enables natural desktop fitting with five mobile records', () => {
  authState = { user: { id: 7, username: 'audit', email: 'audit@example.com', role: 'admin' }, loading: false };
  for (const [Page, key, Wrapper] of [
    [ui.AdminOrders, 'orders:list', null], [ui.StaffOrders, 'orders:list', null],
    [ui.AdminCustomers, 'customers:list:all', null], [ui.AdminCategories, 'categories:list', null],
    [ui.AdminSalesHistory, 'sales:history:', null], [ui.StaffSalesHistory, 'sales:mine:7', null],
    [ui.AdminUserManagement, 'users:list', null], [ui.AdminInventory, 'inventory:admin', ui.ProductTable],
    [ui.StaffInventory, 'inventory:staff', ui.StaffInventoryTable],
  ]) {
    states = []; refs = []; effects = [];
    ui.writeDataCache(`${ui.dataCacheEpoch()}:${key}`, [], ['orders', 'inventory', 'sales', 'users', 'categories', 'customers']);
    let tree = render(Page);
    if (Wrapper) { const node = elements(tree, item => item.type === Wrapper)[0]; tree = render(Wrapper, node.props); }
    const table = elements(tree, item => item.type === ui.EnhancedTable)[0];
    assert.ok(table, Page.name);
    assert.equal(table.props.responsivePageSize, true, Page.name);
    assert.equal(table.props.pageSize, 5, Page.name);
    assert.equal(table.props.autoPageSize, false, Page.name);
    assert.equal(table.props.pageCapacity, undefined, Page.name);
  }
});


test('natural-height responsive tables budget from the viewport and use five rows below 768px', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let cleanup;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ marginTop: '16px' });
  try {
    window.innerHeight = 900;
    const surface = { clientHeight: 10000, getBoundingClientRect: () => ({ top: 320 }), closest: () => null, querySelectorAll: () => [] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const footer = { getBoundingClientRect: () => ({ height: 45 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 4, maxPageSize: 10, measureRows: true, viewportBased: true });
    let capacity = render(Hook);
    capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 8);
    surface.clientHeight = 100;
    render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 8, 'The natural height of rendered rows cannot shrink the capacity');
    window.innerHeight = 767; window.dispatchEvent(new Event('resize'));
    assert.equal(render(Hook).pageSize, 5);
    window.innerHeight = 1080; window.dispatchEvent(new Event('resize'));
    assert.equal(render(Hook).pageSize, 10);
    assert.equal(ui.calculateViewportPageSize(767, 320, 44, 45, 56, 32), 5);
    assert.equal(ui.calculateViewportPageSize(768, 320, 44, 45, 56, 32), 5);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});

test('adaptive table markup keeps headers and rows in native flow without forced full heights', () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const tree = render(ui.EnhancedTable, { contentHeight: true, responsivePageSize: true, showExport: false,
    columns: [{ key: 'name', header: 'Name', sortKey: row => row.name }], data: [{ id: 1, name: 'Milk' }], rowKey: row => row.id });
  const table = elements(tree, node => node.type === 'table')[0];
  assert.ok(table.props.className.includes('border-collapse'));
  assert.ok(!table.props.className.includes('h-full'));
  const header = elements(table, node => node.type === 'thead')[0];
  assert.ok(header.props.className.includes('bg-slate-50'));
  assert.ok(header.props.className.includes('border-slate-200'));
  assert.ok(!header.props.className.includes('h-px'));
  assert.equal(elements(header, node => node.props.className?.includes('absolute')).length, 0);
  assert.ok(elements(header, node => node.type === 'th').every(node => node.props.className.includes('py-3 px-4')));
  const body = elements(table, node => node.type === 'tbody')[0];
  assert.equal(body.props.style, undefined);
  assert.ok(body.props.children[0].props.className.includes('h-auto'));
});


test('desktop fit capacity measures the allocated surface, has no small hardcoded cap', () => {
  assert.equal(ui.calculateFittedPageSize(767, 360, 44, 56), 5);
  assert.equal(ui.calculateFittedPageSize(900, 436, 44, 56), 7);
  assert.equal(ui.calculateFittedPageSize(1080, 600, 44, 56), 9);
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let resized, cleanup;
  global.ResizeObserver = class { constructor(callback) { resized = callback; } observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' });
  try {
    window.innerHeight = 900;
    const surface = { clientHeight: 436, querySelectorAll: () => [] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const footer = { getBoundingClientRect: () => ({ height: 45 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 5, maxPageSize: 8, measureRows: true, fitContainer: true });
    const capacity = render(Hook);
    capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 7, 'Footer space is already outside the observed surface');
    surface.clientHeight = 600; resized();
    assert.equal(render(Hook).pageSize, 9);
    surface.clientHeight = 330; window.innerHeight = 720; window.dispatchEvent(new Event('resize'));
    assert.equal(render(Hook).pageSize, 5);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('mobile fallback keeps five cards while desktop capacity is measured separately', () => {
  const products = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, name: `Product ${index + 1}`, cat: 'Dairy', price: 120, stock: 30, expiry: '', low: false }));
  for (const height of [640, 768, 1080, 1440]) {
    states = []; refs = []; effects = [];
    window.innerHeight = height;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const wrapper = render(ui.StaffInventoryTable, { data: products, columns: [{ key: 'name', header: 'Product' }], rowKey: row => row.id });
    const table = elements(wrapper, node => node.type === ui.EnhancedTable)[0];
    states = []; refs = [];
    let page = render(ui.EnhancedTable, table.props);
    assert.equal(elements(page, node => node.type === 'tbody')[0].props.children.length, 5);
    const surface = elements(page, node => node.props['data-table-surface'] !== undefined)[0];
    assert.ok(surface.props.className.includes('h-auto'));
    assert.ok(!surface.props.className.includes('overflow-hidden'));
    const footer = elements(page, node => node.type === 'div' && node.props.className?.includes('border-t border-slate-100'))[0];
    assert.ok(footer.props.className.includes('mt-4 pt-3'));
    assert.ok(!footer.props.className.includes('mt-auto'));
    elements(page, node => node.type === 'button').at(-1).props.onClick();
    page = render(ui.EnhancedTable, table.props);
    assert.ok(elements(page, node => node.props.children === 'Page 2 of 3').length > 0);
    elements(page, node => node.type === 'button').at(-1).props.onClick();
    page = render(ui.EnhancedTable, table.props);
    assert.equal(elements(page, node => node.type === 'tbody')[0].props.children.length, 1);
    assert.ok(elements(page, node => node.props.children === 'Page 3 of 3').length > 0);
  }
});


test('natural desktop fitting reduces page capacity before a row would cross the footer or viewport', () => {
  for (const height of [480, 540, 640, 720, 768, 900, 1080, 1440]) {
    const count = ui.calculateNaturalPageSize(height, 300, 44, 45, 56, 32);
    assert.ok(count >= 1 && count <= 5);
    assert.ok(300 + 44 + count * 56 + 45 + 32 <= height, `Complete rows and footer fit at ${height}px`);
  }
  assert.equal(ui.calculateNaturalPageSize(768, 320, 44, 45, 57, 77), 4);
  assert.equal(ui.calculateNaturalPageSize(1080, 320, 44, 45, 57, 77), 5);
});

test('natural fitting observes chrome and wrapped content without stretching or row-height feedback', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let resized, cleanup, contentHeight = 32;
  const observed = [];
  const main = { tagName: 'MAIN', scrollTop: 120 };
  const card = {}, page = { children: [{}, {}] }, footer = { getBoundingClientRect: () => ({ height: 45 }) };
  global.ResizeObserver = class { constructor(callback) { resized = callback; } observe(node) { observed.push(node); } disconnect() {} };
  global.getComputedStyle = node => node === card ? { paddingBottom: '20px', borderBottomWidth: '1px' }
    : node === page ? { paddingBottom: '24px' } : node === footer ? { marginTop: '16px' }
    : { lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' };
  try {
    window.innerHeight = 768;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const viewport = { offsetHeight: 100, clientHeight: 100 };
    const surface = { clientHeight: 10000, getBoundingClientRect: () => ({ top: 320 }),
      closest: name => name === '.table-card' ? card : name === 'main' ? main : page,
      querySelector: () => ({ parentElement: viewport }),
      querySelectorAll: () => [{ children: [{ getBoundingClientRect: () => ({ height: contentHeight }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 1, maxPageSize: 5, measureRows: true, viewportBased: true, naturalFit: true });
    const capacity = render(Hook);
    capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 4);
    assert.equal(main.scrollTop, 0, 'Desktop navigation does not retain a clipped mobile scroll offset');
    main.scrollTop = 120;
    window.matchMedia = () => ({ matches: false });
    render(Hook).remeasure();
    assert.equal(main.scrollTop, 120, 'Mobile scrolling remains available');
    window.matchMedia = () => ({ matches: true });
    surface.clientHeight = 80; resized();
    assert.equal(render(Hook).pageSize, 4, 'Intrinsic card size does not feed into the row limit');
    assert.ok(page.children.every(node => observed.includes(node)), 'Summary and header changes trigger remeasurement');
    contentHeight = 64; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 3);
    window.innerHeight = 1080; window.dispatchEvent(new Event('resize'));
    assert.equal(render(Hook).pageSize, 5);
    // Horizontal scrollbar space is reserved as well as footer and padding.
    contentHeight = 32; viewport.offsetHeight = 117;
    window.innerHeight = 785; window.dispatchEvent(new Event('resize'));
    assert.equal(render(Hook).pageSize, 4);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('desktop capacity fills surfaces with six through nine complete rows and reserves scrollbar space', () => {
  for (const count of [6, 7, 8, 9, 12]) {
    const header = 44, row = 61, surface = header + count * row + 20;
    const capacity = ui.calculateFittedPageSize(900, surface, header, row);
    assert.equal(capacity, count);
    assert.ok(header + capacity * row <= surface);
    assert.ok(surface - header - capacity * row < row, 'Unused body space is less than one complete row');
  }
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let resized, cleanup;
  global.ResizeObserver = class { constructor(callback) { resized = callback; } observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' });
  try {
    window.innerHeight = 900;
    const viewport = { offsetHeight: 200, clientHeight: 183 };
    const surface = { clientHeight: 44 + 8 * 57 + 10,
      querySelector: () => ({ parentElement: viewport }),
      querySelectorAll: () => [{ children: [{ getBoundingClientRect: () => ({ height: 32 }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const footer = { getBoundingClientRect: () => ({ height: 45 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 1, measureRows: true, fitContainer: true });
    const capacity = render(Hook);
    capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 7, 'A horizontal scrollbar cannot hide the eighth row');
    viewport.offsetHeight = viewport.clientHeight;
    resized();
    assert.equal(render(Hook).pageSize, 8, 'The footer is not subtracted twice');
    surface.clientHeight = 44 + 9 * 57 + 10; resized();
    assert.equal(render(Hook).pageSize, 9);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('desktop row measurements remain stable across pages and reset for width or filter changes', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let cleanup, contentHeight = 32;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' });
  try {
    const surface = { clientHeight: 600, clientWidth: 1000,
      querySelectorAll: () => [{ children: [{ getBoundingClientRect: () => ({ height: contentHeight }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { minPageSize: 1, measureRows: true, fitContainer: true });
    const capacity = render(Hook); capacity.containerRef(surface); capacity.headerRef(header);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 9);
    contentHeight = 70; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 5);
    contentHeight = 32; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 5, 'Returning to shorter rows cannot create a sizing loop');
    render(Hook).resetMeasurement(); render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 9);
    contentHeight = 70; render(Hook).remeasure();
    surface.clientWidth = 1200; contentHeight = 32; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 9);
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('all active data modules explicitly enable the same natural row measurement without changing mobile size', () => {
  authState = { user: { id: 7, username: 'audit', email: 'audit@example.com', role: 'admin' }, loading: false };
  for (const Component of [ui.OrdersTable, ui.StaffOrdersTable, ui.CustomerTable, ui.AdminSalesHistory, ui.StaffSalesHistory, ui.ProductTable, ui.StaffInventoryTable, ui.AdminCategories, ui.AdminUserManagement]) {
    states = []; refs = [];
    const table = elements(render(Component, { data: [], columns: [], rowKey: row => row.id }), node => node.type === ui.EnhancedTable)[0];
    assert.equal(table.props.measureRenderedRows, true, Component.name);
    assert.equal(table.props.responsivePageSize, true, Component.name);
    assert.equal(table.props.pageSize, 5, 'Mobile fallback remains unchanged');
  }
});

test('natural row measurement recovers an extra complete row without borrowing footer or scrollbar space', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let cleanup, rowHeight = 52, hasRows = false;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  // Cell estimates can exceed the actual native table row; use its border box.
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '12px', paddingBottom: '12px' });
  try {
    window.innerHeight = 768;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const viewport = { offsetHeight: 304, clientHeight: 304 };
    const surface = { clientHeight: 304, clientWidth: 1000,
      querySelector: () => ({ parentElement: viewport }),
      querySelectorAll: selector => selector === 'tbody tr'
        ? hasRows ? [{ getBoundingClientRect: () => ({ height: rowHeight }) }] : []
        : [{ children: [{ getBoundingClientRect: () => ({ height: 36 }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const footer = { getBoundingClientRect: () => ({ height: 45 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { measureRows: true, fitContainer: true, measureRenderedRows: true });
    const capacity = render(Hook); capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 4, 'The estimate is used only until rows mount');
    hasRows = true; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 5, 'Five actual 52px rows fit after the 44px header');
    surface.clientHeight = 303; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 4, 'A row that would clip by 1px is excluded');
    surface.clientHeight = 304; viewport.offsetHeight = 321; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 4, 'Horizontal scrollbar clearance is retained');
    viewport.offsetHeight = 304; surface.clientHeight = 44 + 9 * 52; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 9, 'Capacity remains dynamic on larger surfaces');
    surface.clientHeight = 304; rowHeight = 70; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 3, 'Wrapped or taller action rows remain fully visible');
    rowHeight = 52; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 3, 'Page changes cannot cause repeated capacity oscillation');
    render(Hook).resetMeasurement(); render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 5, 'Filtering can reclaim the shorter row height');
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('compact measured rows fit dynamically without positive tolerance or a fixed desktop row limit', () => {
  for (const count of [4, 5, 6, 8, 10, 14]) {
    const header = 44, row = 53, surface = header + count * row;
    assert.equal(ui.calculateFittedPageSize(768, surface, header, row), count);
    assert.equal(ui.calculateFittedPageSize(1080, surface - 1, header, row), count - 1,
      'Capacity drops before even 1px of the last row could be clipped');
  }
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let cleanup, rowHeight = 53;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '10px', paddingBottom: '10px' });
  try {
    window.innerHeight = 768;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const viewport = { offsetHeight: 309, clientHeight: 309 };
    const surface = { clientHeight: 309, clientWidth: 1000,
      querySelector: () => ({ parentElement: viewport }),
      querySelectorAll: selector => selector === 'tbody tr'
        ? [{ getBoundingClientRect: () => ({ height: rowHeight }) }] : [] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { measureRows: true, fitContainer: true, measureRenderedRows: true });
    const capacity = render(Hook); capacity.containerRef(surface); capacity.headerRef(header);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 5, 'Reducing each row by 4px frees the required 20px across five rows');
    assert.ok(44 + render(Hook).pageSize * rowHeight <= surface.clientHeight);
    viewport.offsetHeight += 17; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 4, 'Horizontal scrollbar height is still reserved');
    viewport.offsetHeight -= 17;
    for (const count of [4, 6, 8, 10, 14]) {
      surface.clientHeight = 44 + count * rowHeight; render(Hook).remeasure();
      assert.equal(render(Hook).pageSize, count);
    }
    surface.clientHeight = 309; rowHeight = 80; render(Hook).remeasure();
    assert.equal(render(Hook).pageSize, 3, 'Wrapped rows still fit without slicing content');
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});

test('compact desktop tables prevent inner vertical scrolling and retain mobile flow', () => {
  const props = { responsivePageSize: true, measureRenderedRows: true, contentHeight: true, pageSize: 5,
    columns: [{ key: 'name', header: 'Name' }], data: Array.from({ length: 12 }, (_, id) => ({ id, name: `Row ${id}` })), rowKey: row => row.id,
    renderMobileRow: row => React.createElement('article', null, row.name), showExport: false };
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  let tree = render(ui.EnhancedTable, props);
  let viewport = elements(tree, node => node.type === 'div' && node.props.className?.includes('hidden md:block overflow-x-auto'))[0];
  assert.ok(viewport.props.className.includes('flex-1 min-h-0 overflow-y-hidden'));
  assert.ok(!viewport.props.className.includes('overflow-y-auto'));
  assert.ok(elements(tree, node => node.type === 'td').every(cell => cell.props.className.includes('py-3 md:py-2.5')));
  let footer = elements(tree, node => node.props.className?.includes('border-t border-slate-100'))[0];
  assert.ok(footer.props.className.includes('mt-auto pt-3'));
  states = []; refs = [];
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  tree = render(ui.EnhancedTable, props);
  viewport = elements(tree, node => node.type === 'div' && node.props.className?.includes('hidden md:block overflow-x-auto'))[0];
  assert.ok(!viewport.props.className.includes('overflow-y-auto'));
  footer = elements(tree, node => node.props.className?.includes('border-t border-slate-100'))[0];
  assert.ok(footer.props.className.includes('mt-4 pt-3'));
  assert.equal(elements(tree, node => node.type === 'article').length, 5);
});


test('every responsive native table measures compact rows instead of the estimated minimum', () => {
  const originalObserver = global.ResizeObserver;
  const originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '10px', paddingBottom: '10px' });
  const data = Array.from({ length: 20 }, (_, id) => ({ id, name: `Row ${id}` }));
  const baseProps = { responsivePageSize: true, contentHeight: true, pageSize: 5,
    columns: [{ key: 'name', header: 'Name' }], data, rowKey: row => row.id,
    renderMobileRow: row => React.createElement('article', null, row.name), showExport: false };
  try {
    window.innerHeight = 900;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    // The default covers Inventory, Categories and Users; explicit true covers
    // Orders, Customers and Sales History, including their staff counterparts.
    for (const measureRenderedRows of [undefined, true]) {
      states = []; refs = []; layoutEffects = [];
      let cleanup;
      try {
        const props = { ...baseProps, measureRenderedRows };
        const tree = render(ui.EnhancedTable, props);
        const surface = elements(tree, node => node.props['data-table-surface'] !== undefined)[0];
        const header = elements(tree, node => node.type === 'thead')[0];
        surface.ref({ clientHeight: 309, clientWidth: 1000,
          querySelectorAll: selector => selector === 'tbody tr'
            ? [{ getBoundingClientRect: () => ({ height: 53 }) }] : [] });
        header.ref({ getBoundingClientRect: () => ({ height: 44 }) });
        render(ui.EnhancedTable, props);
        // The hook registers the first layout effect; the table remeasures later.
        cleanup = layoutEffects.at(-2)();
        const measured = render(ui.EnhancedTable, props);
        assert.equal(elements(measured, node => node.type === 'tbody')[0].props.children.length, 5);
        assert.ok(elements(measured, node => node.type === 'td').every(cell => cell.props.className.includes('md:py-2.5')));
      } finally { cleanup?.(); }
    }
  } finally {
    captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('catalog density changes discard stale tall-row measurements and reclaim a fifth row immediately', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  let cleanup, padding = 10, height = 57, resized;
  global.ResizeObserver = class { constructor(callback) { resized = callback; } observe() {} disconnect() {} };
  global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: `${padding}px`, paddingBottom: `${padding}px` });
  try {
    window.innerHeight = 768;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const surface = { clientHeight: 309, clientWidth: 1000,
      querySelectorAll: selector => selector === 'tbody tr'
        ? [{ getBoundingClientRect: () => ({ height }) }]
        : [{ children: [{ getBoundingClientRect: () => ({ height: 36 }) }] }] };
    const header = { getBoundingClientRect: () => ({ height: 44 }) };
    const Hook = () => ui.useAutoPageSize(56, 320, { measureRows: true, fitContainer: true, measureRenderedRows: true });
    const capacity = render(Hook); capacity.containerRef(surface); capacity.headerRef(header);
    render(Hook); cleanup = layoutEffects.at(-1)();
    assert.equal(render(Hook).pageSize, 4);
    padding = 8; height = 53; resized();
    assert.equal(render(Hook).pageSize, 5, 'CSS padding updates reclaim capacity without a reload or data change');
    assert.ok(44 + 5 * height <= surface.clientHeight);
    surface.clientHeight = 44 + 8 * height; resized();
    assert.equal(render(Hook).pageSize, 8, 'The same catalog sizing remains dynamic on larger monitors');
    padding = 10; height = 57; surface.clientHeight = 309; resized();
    assert.equal(render(Hook).pageSize, 4, 'Larger density still reduces capacity before content can clip');
  } finally {
    cleanup?.(); captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});


test('inventory and user tables reclaim desktop chrome space without borrowing pagination clearance', () => {
  const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
  captureLayoutEffects = true;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    window.innerHeight = 768;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    for (const [initialRowHeight, compactRowHeight, initialPadding] of [[53, 53, 8], [49, 49, 8], [57, 53, 10]]) {
      states = []; refs = []; layoutEffects = [];
      let cleanup, rowHeight = initialRowHeight, padding = initialPadding, headerHeight = 44;
      global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: `${padding}px`, paddingBottom: `${padding}px` });
      // Card allocation already excludes filters and the fixed pagination footer.
      const surface = { clientHeight: 44 + 5 * compactRowHeight - 16, clientWidth: 1000,
        querySelectorAll: selector => selector === 'tbody tr'
          ? [{ getBoundingClientRect: () => ({ height: rowHeight }) }]
          : [{ children: [{ getBoundingClientRect: () => ({ height: 36 }) }] }] };
      const header = { getBoundingClientRect: () => ({ height: headerHeight }) };
      const footer = { getBoundingClientRect: () => ({ height: 45 }) };
      const Hook = () => ui.useAutoPageSize(56, 320, { measureRows: true, fitContainer: true, measureRenderedRows: true });
      try {
        const capacity = render(Hook); capacity.containerRef(surface); capacity.headerRef(header); capacity.footerRef(footer);
        render(Hook); cleanup = layoutEffects.at(-1)();
        assert.equal(render(Hook).pageSize, 4);
        surface.clientHeight += 8; headerHeight -= 8; rowHeight = compactRowHeight; padding = 8;
        render(Hook).remeasure();
        assert.equal(render(Hook).pageSize, 5);
        assert.equal(headerHeight + render(Hook).pageSize * rowHeight, surface.clientHeight);
        surface.clientHeight -= 1; render(Hook).remeasure();
        assert.equal(render(Hook).pageSize, 4, 'Never count a partially visible fifth row');
        surface.clientHeight = headerHeight + 9 * rowHeight; render(Hook).remeasure();
        assert.equal(render(Hook).pageSize, 9, 'Larger desktops remain dynamically sized');
      } finally { cleanup?.(); }
    }
  } finally {
    captureLayoutEffects = false;
    global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
  }
});

test('encoding reuses its UUID on network retries and blocks changed ambiguous submissions', async () => {
  const form = await composerFixture('encoding'); form.changeLine({ unitPrice: '12' });
  const payloads = [];
  ui.http.defaults.adapter = async config => { payloads.push(JSON.parse(config.data)); throw new AxiosError('Timed out', 'ECONNABORTED'); };
  await form.submit(); await form.submit();
  assert.equal(payloads.length, 2); assert.equal(payloads[0].request_id, payloads[1].request_id);
  assert.match(payloads[0].request_id, /^[0-9a-f-]{36}$/);
  assert.equal(payloads[0].payment_status, 'pending'); assert.equal(payloads[0].amount_tendered, null);
  assert.equal('handled_by' in payloads[0], false, 'The handler always comes from server authentication');
  form.changeLine({ quantity: '2' }); await form.submit();
  assert.equal(payloads.length, 2, 'An ambiguous previous request cannot silently become a different transaction');
  assert.match(toastErrors.at(-1)[0], /already attempted/i);
});

test('encoding allows corrections after a definite HTTP 400 and generates a new UUID for the corrected entry', async () => {
  const form = await composerFixture('encoding'); form.changeLine({ unitPrice: '12' });
  const payloads = [];
  ui.http.defaults.adapter = async config => {
    payloads.push(JSON.parse(config.data));
    throw new AxiosError('Invalid', undefined, config, undefined, { status: 400, data: { error: 'Stock changed' }, config, headers: {} });
  };
  await form.submit(); form.changeLine({ quantity: '2' }); await form.submit();
  assert.equal(payloads.length, 2); assert.notEqual(payloads[0].request_id, payloads[1].request_id);
  assert.equal(payloads[1].items[0].quantity, '2.00');
});

test('customer history resets pagination for a different customer and never renders another customer cache', () => {
  const customer = id => ({ id, name: `Customer ${id}` });
  const transaction = id => ({ id, transaction_number: `SI${id}`, created_at: '2026-10-01T04:00:00Z', payment_method: 'cash', payment_status: 'paid', total_amount: '10', handled_by: { id: 7, username: 'staff' } });
  const put = (id, page, rows, count) => ui.writeDataCache(`${ui.dataCacheEpoch()}:customers:history:${id}:${page}:false`, { count, results: rows }, ['customers', 'sales']);
  put(1, 1, [transaction(11)], 21); put(1, 2, [transaction(12)], 21); put(2, 1, [transaction(21)], 1);
  let tree = render(ui.CustomerHistory, { customer: customer(1), onClose() {} });
  elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Next')[0].props.onClick();
  tree = render(ui.CustomerHistory, { customer: customer(1), onClose() {} });
  assert.ok(elements(tree, node => node.props.children === 'SI12').length || JSON.stringify(tree).includes('SI12'));
  tree = render(ui.CustomerHistory, { customer: customer(2), onClose() {} });
  assert.ok(JSON.stringify(tree).includes('SI21')); assert.ok(!JSON.stringify(tree).includes('SI12'));
  assert.ok(JSON.stringify(tree).includes('Page '));
  put(1, 2, [transaction(99)], 21);
  assert.ok(!JSON.stringify(render(ui.CustomerHistory, { customer: customer(2), onClose() {} })).includes('SI99'));
});

test('outflows require an explicit cost and distinguish expired stock from promotional samples', async () => {
  const batch = { id: 1, key: 'product-1', kind: 'product', name: 'Milk', batch: 'B1', stock: 2, unit: 'unit', cost: null, expiry: '2000-01-01' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:outflow-batches`, [batch], ['inventory']);
  let tree = render(ui.InventoryOutflows);
  elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Stock outflows')[0].props.onClick();
  const field = label => elements(render(ui.InventoryOutflows), node => node.props['aria-label'] === label)[0];
  field('Outflow batch').props.onChange({ target: { value: 'product-1' } });
  assert.equal(field('Outflow unit cost').props.value, '', 'An unknown cost never defaults to zero');
  field('Outflow reason').props.onChange({ target: { value: 'free_taste' } });
  field('Outflow quantity').props.onChange({ target: { value: '1' } });
  field('Outflow unit cost').props.onChange({ target: { value: '0' } });
  let requests = 0; ui.http.defaults.adapter = async () => { requests++; throw new Error('Should not submit'); };
  tree = render(ui.InventoryOutflows);
  await elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Record and deduct stock')[0].props.onClick();
  assert.equal(requests, 0); assert.match(toastErrors.at(-1)[0], /Expired stock/);
});


test('payment controls validate tender, persist only payment fields and prevent duplicate PATCH requests', async () => {
  const transaction = { id: 31, is_manually_encoded: true, is_voided: false, payment_status: 'pending', payment_method: 'cash', total_amount: '12.00', amount_tendered: null };
  let updated, calls = 0, complete;
  const props = { transaction, onUpdated: value => { updated = value; } };
  let tree = render(ui.PaymentUpdateControl, props);
  elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Update payment')[0].props.onClick();
  const field = label => elements(render(ui.PaymentUpdateControl, props), node => node.props['aria-label'] === label)[0];
  field('Updated payment status').props.onChange({ target: { value: 'paid' } });
  field('Updated amount tendered').props.onChange({ target: { value: '11.99' } });
  const save = () => elements(render(ui.PaymentUpdateControl, props), node => node.props.title === 'Update payment')[0].props.footer.props.onClick();
  ui.http.defaults.adapter = config => {
    calls++; assert.equal(config.method, 'patch'); assert.equal(config.url, '/sales/encoding/31/payment/');
    assert.deepEqual(JSON.parse(config.data), { payment_status: 'paid', payment_method: 'cash', amount_tendered: '12.00' });
    return new Promise(resolve => { complete = () => resolve({ status: 200, config, headers: {}, data: { ...transaction, payment_status: 'paid', amount_tendered: '12.00' } }); });
  };
  await save(); assert.equal(calls, 0);
  field('Updated amount tendered').props.onChange({ target: { value: '12' } });
  const pending = save(); await settle(); await save(); assert.equal(calls, 1);
  complete(); await pending; assert.equal(updated.payment_status, 'paid');
});

test('Escape dismisses only the topmost nested modal without altering its visual classes', () => {
  const originalDocument = global.document;
  let closed = 0;
  try {
    const ownDialog = {}, nestedDialog = {};
    let dialogs = [ownDialog, nestedDialog];
    global.document = { querySelectorAll: () => dialogs };
    render(ui.Modal, { open: true, title: 'Parent', children: null, onClose: () => closed++ });
    refs[0].current = ownDialog;
    const cleanup = effects[1]();
    const escape = new Event('keydown'); Object.defineProperty(escape, 'key', { value: 'Escape' });
    window.dispatchEvent(escape); assert.equal(closed, 0);
    dialogs = [ownDialog]; window.dispatchEvent(escape); assert.equal(closed, 1);
    cleanup?.();
  } finally { global.document = originalDocument; }
});

test('staff sales and recent orders keep persistent retry states on failed initial requests', async () => {
  authState = { user: { id: 7, username: 'staff' }, loading: false };
  for (const [Page, key] of [[ui.StaffSalesHistory, 'sales:mine:7'], [ui.StaffRecentOrders, 'dashboard:recent-orders:5']]) {
    states = []; refs = []; effects = [];
    await ui.fetchDataCache(`${ui.dataCacheEpoch()}:${key}`, () => Promise.reject(new Error('Server offline')), ['sales', 'orders', 'dashboard']).catch(() => {});
    ui.http.defaults.adapter = async () => { throw new Error('Server offline'); };
    const failed = render(Page);
    const cleanup = effects[0]();
    try {
    await settle();
    const error = elements(failed, node => node.type === ui.QueryErrorMessage)[0];
    assert.ok(error, Page.name);
    assert.equal(elements(failed, node => node.props.title === 'No recent orders' || node.props.emptyTitle === 'No transactions found').length, 0);
    let requests = 0;
    ui.http.defaults.adapter = async config => { requests++; return { status: 200, config, headers: {}, data: { count: 0, next: null, results: [] } }; };
    await error.props.onRetry(); await settle();
    assert.ok(requests > 0, 'Retry forces an active request');
    assert.equal(elements(render(Page), node => node.type === ui.QueryErrorMessage).length, 0);
    } finally { cleanup?.(); }
  }
});

test('staff sales metrics retain their values after a username change by matching immutable account IDs', () => {
  const today = ui.businessDate();
  ui.writeDataCache(`${ui.dataCacheEpoch()}:dashboard:staff-kpis:7:${today}`, [[
    { date: today, total: 125, cashier: 'previous-name', transaction: { handled_by: { id: 7 } } },
    { date: today, total: 999, cashier: 'new-name', transaction: { handled_by: { id: 8 } } },
  ], [], []], ['dashboard']);
  authState = { user: { id: 7, username: 'new-name' }, loading: false };
  const cards = staffCards(render(ui.StaffKPICards));
  assert.ok(cards.find(card => card.props.title === 'My Sales Today').props.value.includes('125'));
  assert.equal(cards.find(card => card.props.title === 'My Transactions Today').props.value, '1');
});

test('pending orders KPI counts fulfilled orders awaiting payment and excludes cancelled or unlinked orders', async () => {
  ui.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data: config.url === '/sales/orders/' ? [
    { status: 'fulfilled', transaction: { payment_status: 'pending' } },
    { status: 'fulfilled', transaction: { payment_status: 'paid' } },
    { status: 'cancelled', transaction: { payment_status: 'pending' } },
    { status: 'fulfilled', transaction: null },
    { status: 'fulfilled', transaction: { payment_status: 'unknown' } },
  ] : [] });
  render(ui.KPICards);
  const cleanup = effects.at(-1)();
  try {
    await settle();
    const pending = elements(render(ui.KPICards), node => node.props['aria-label'] === 'Pending Orders')[0];
    assert.ok(elements(pending, node => node.props.children === '1').length);
    assert.ok(elements(pending, node => node.props.children === 'Fulfilled orders awaiting payment').length);
  } finally { cleanup?.(); }
});

test('cross-tab login and logout replace auth state without writing or blacklisting the other account credentials', async () => {
  const storage = new Map([['rosario_access_token', 'account-A'], ['rosario_refresh_token', 'refresh-A']]);
  let writes = 0;
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes++; storage.set(key, value); }, removeItem: key => { writes++; storage.delete(key); } };
  const users = { 'Bearer account-A': { id: 7, username: 'A', role: 'admin' }, 'Bearer account-B': { id: 8, username: 'B', role: 'staff' } };
  const requests = [];
  ui.http.defaults.adapter = async config => { requests.push(config.url); return { status: 200, config, headers: {}, data: users[config.headers.Authorization] }; };
  render(ui.AuthProvider); const initCleanup = effects[0](), subscriptionCleanup = effects[1]();
  try {
    await settle();
    assert.equal(render(ui.AuthProvider).props.value.user.id, 7);
    storage.set('rosario_access_token', 'account-B'); storage.set('rosario_refresh_token', 'refresh-B');
    const event = new Event('storage'); Object.defineProperty(event, 'key', { value: 'rosario_access_token' });
    window.dispatchEvent(event);
    const switching = render(ui.AuthProvider).props.value;
    assert.equal(switching.user, null); assert.equal(switching.loading, true);
    effects.at(-2)(); await settle();
    assert.equal(render(ui.AuthProvider).props.value.user.id, 8);
    assert.equal(writes, 0);
    storage.clear(); window.dispatchEvent(event);
    assert.equal(render(ui.AuthProvider).props.value.user, null);
    assert.equal(render(ui.AuthProvider).props.value.loading, false);
    assert.ok(requests.every(url => url === '/accounts/user/'));
  } finally { initCleanup?.(); subscriptionCleanup?.(); }
});

test('report date drafts apply only after validation, retain applied dates on cancel, and reset explicitly', () => {
  let applied = { start_date: '2000-09-01', end_date: '2000-09-30' }, changes = 0;
  const props = () => ({ range: applied, onApply: value => { applied = value; changes++; } });
  let tree = render(ui.ReportDateRangeControl, props());
  elements(tree, node => node.props.children === 'Custom dates')[0].props.onClick();
  tree = render(ui.ReportDateRangeControl, props());
  const input = label => elements(tree, node => node.type === 'input' && node.props['aria-label'] === label)[0];
  assert.equal(input('Report from date').props.value, '2000-09-01');
  assert.equal(input('Report to date').props.value, '2000-09-30');
  input('Report to date').props.onChange({ target: { value: '' } });
  tree = render(ui.ReportDateRangeControl, props());
  elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = render(ui.ReportDateRangeControl, props());
  assert.match(elements(tree, node => node.props.role === 'alert')[0].props.children, /both From and To/);
  assert.equal(changes, 0);
  assert.equal(elements(tree, node => node.type === ui.Modal)[0].props.open, true);
  input('Report to date').props.onChange({ target: { value: '2000-09-01' } });
  assert.equal(changes, 0, 'Typing must not commit or refetch a partial draft');
  tree = render(ui.ReportDateRangeControl, props());
  elements(tree, node => node.type === ui.Modal)[0].props.onClose();
  assert.equal(changes, 0);
  tree = render(ui.ReportDateRangeControl, props());
  elements(tree, node => node.props.children === 'Custom dates')[0].props.onClick();
  tree = render(ui.ReportDateRangeControl, props());
  assert.equal(input('Report to date').props.value, '2000-09-30');
  input('Report to date').props.onChange({ target: { value: '2000-09-01' } });
  tree = render(ui.ReportDateRangeControl, props());
  elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(applied, { start_date: '2000-09-01', end_date: '2000-09-01' });
  assert.equal(changes, 1);
  tree = render(ui.ReportDateRangeControl, props());
  assert.equal(elements(tree, node => node.type === ui.Modal)[0].props.open, false);
  const modal = elements(tree, node => node.type === ui.Modal)[0];
  elements(modal.props.footer, node => node.props.children === 'Use report defaults')[0].props.onClick();
  assert.equal(applied, undefined); assert.equal(changes, 2);
});

test('report preview hooks isolate ranges, reuse cached navigation, and refresh applied ranges silently', async () => {
  let range = { start_date: '2000-09-01', end_date: '2000-09-30' }, requests = [], version = 1;
  const first = { ...range };
  const second = { ...range, end_date: '2000-10-01' };
  ui.http.defaults.adapter = async config => {
    requests.push({ ...config.params });
    return { status: 200, config, headers: {}, data: { report_type: 'customer', generated_at: '', data: { ...config.params, version } } };
  };
  const Preview = () => ui.useReportPreview('customer', undefined, range);
  assert.equal(render(Preview).loading, true);
  let cleanup = effects.at(-1)(); await settle();
  assert.equal(render(Preview).data.end_date, first.end_date);
  cleanup(); range = second;
  let result = render(Preview);
  assert.equal(result.data, null); assert.equal(result.loading, true, 'Never display a previous range as the newly applied preview');
  cleanup = effects.at(-1)(); await settle();
  assert.equal(render(Preview).data.end_date, second.end_date);
  cleanup(); range = first;
  result = render(Preview);
  assert.equal(result.data.end_date, first.end_date); assert.equal(result.loading, false);
  cleanup = effects.at(-1)(); await settle();
  assert.equal(requests.length, 2);
  version = 2;
  window.dispatchEvent(new Event('rosario:reports-updated'));
  assert.equal(render(Preview).loading, false);
  await settle();
  assert.equal(render(Preview).data.version, 2); assert.equal(requests.length, 3);
  cleanup(); range = second;
  render(Preview); cleanup = effects.at(-1)(); await settle();
  assert.equal(render(Preview).data.version, 2); assert.equal(requests.length, 4);
  cleanup();
});

test('report preview validation and backend field errors produce visible errors instead of unhandled requests', async () => {
  let requests = 0;
  ui.http.defaults.adapter = async config => {
    requests++;
    throw new AxiosError('Bad report range', undefined, config, undefined, { status: 400, data: { end_date: ['Must not be in the future.'] }, headers: {}, config });
  };
  const invalid = () => ui.useReportPreview('customer', undefined, { start_date: '2000-01-01', end_date: '' });
  let result = render(invalid);
  effects.at(-1)(); await settle();
  assert.equal(requests, 0); assert.equal(result.data, null); assert.equal(result.loading, false);
  assert.match(result.error, /both From and To/);
  states = []; refs = []; effects = [];
  const valid = () => ui.useReportPreview('customer', undefined, { start_date: '2000-01-01', end_date: '2000-01-01' });
  render(valid); const cleanup = effects.at(-1)(); await settle();
  result = render(valid);
  assert.equal(result.loading, false); assert.equal(result.data, null);
  assert.match(result.error, /Must not be in the future/);
  assert.equal(requests, 1);
  cleanup();
});

test('Reports applies identical dates to previews and exports while preserving Inventory and Forecast defaults', async () => {
  let tree = render(ui.AdminReports);
  const control = elements(tree, node => node.type === ui.ReportDateRangeControl)[0];
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  control.props.onApply(range);
  tree = render(ui.AdminReports);
  const summaries = elements(tree, node => typeof node.type === 'function' && node.type.name === 'ReportSummary');
  assert.equal(summaries.length, 6);
  for (const summary of summaries) assert.deepEqual(summary.props.range, ['inventory', 'sarima_forecast'].includes(summary.props.type) ? undefined : range);
  const requests = [];
  global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  ui.http.defaults.adapter = async config => {
    requests.push(config);
    return { status: 200, config, headers: {}, data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) };
  };
  const buttons = elements(tree, node => node.type === 'button');
  assert.equal(buttons.length, 6);
  for (const button of buttons) await button.props.onClick();
  assert.equal(requests.length, 6);
  for (const request of requests) assert.deepEqual(request.params, ['inventory', 'sarima_forecast'].includes(request.params.type) ? { type: request.params.type } : { type: request.params.type, ...range });
});

test('POS blocks blind retries after an interrupted write and requires history review before a new transaction', async () => {
  const form = await composerFixture(); form.changeLine({ unitPrice: '50' });
  form.field('Amount tendered').props.onChange({ target: { value: '100' } });
  let writes = 0;
  ui.http.defaults.adapter = async () => { writes++; throw new AxiosError('Request timed out', AxiosError.ECONNABORTED); };
  await form.submit(); await form.submit();
  assert.equal(writes, 1);
  let tree = render(ui.SaleComposer, form.props);
  const submit = elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Complete Transaction')[0];
  assert.equal(submit.props.disabled, true);
  elements(tree, node => node.type?.name === 'Btn' && node.props.children === 'Review previous submission')[0].props.onClick();
  tree = render(ui.SaleComposer, form.props);
  const confirmation = elements(tree, node => node.type?.name === 'ConfirmDialog')[0];
  assert.equal(confirmation.props.open, true);
  confirmation.props.onConfirm();
  assert.equal(ui.hasUnconfirmedSale('checkout'), false);
  assert.equal(elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).length, 0, 'The old cart cannot be accidentally resent');
});

test('logout from stale account UI does not clear or blacklist a newer cross-tab login', async () => {
  const storage = new Map([['rosario_access_token', 'account-A'], ['rosario_refresh_token', 'refresh-A']]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const requests = [];
  ui.http.defaults.adapter = async config => { requests.push(config.url); return { status: 200, config, headers: {}, data: { id: 7, username: 'A', role: 'admin' } }; };
  render(ui.AuthProvider); const initCleanup = effects[0](), subscriptionCleanup = effects[1]();
  try {
    await settle();
    const oldAccount = render(ui.AuthProvider).props.value;
    storage.set('rosario_access_token', 'account-B'); storage.set('rosario_refresh_token', 'refresh-B');
    oldAccount.logout(); await settle();
    assert.equal(storage.get('rosario_access_token'), 'account-B');
    assert.equal(storage.get('rosario_refresh_token'), 'refresh-B');
    assert.equal(requests.includes('/accounts/logout/'), false);
    assert.equal(render(ui.AuthProvider).props.value.user, null);
    assert.equal(render(ui.AuthProvider).props.value.loading, true);
  } finally { initCleanup?.(); subscriptionCleanup?.(); }
});
