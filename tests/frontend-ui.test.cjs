const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');
const { AxiosError } = require('axios');

// Exercise real event handlers with deterministic hook state, without a browser or database writes.
let states, refs, stateIndex, refIndex, effects, authState, toastErrors, toastMessages;
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
    export { default as App, AppShell } from './src/app/App';
    export { Login } from './src/app/Login';
    export { AppErrorBoundary } from './src/components/feedback/AppErrorBoundary';
    export { EmptyState } from './src/components/EmptyState';
    export { ProductTable } from './src/features/inventory/components/ProductTable';
    export { Card } from './src/components/data-display/Card';
    export { Modal } from './src/components/overlays/Modal';
    export { Drawer } from './src/components/overlays/Drawer';
    export { trapOverlayFocus } from './src/components/overlays/useOverlayFocus';
    export { useAutoPageSize, calculatePageSize, calculateViewportPageSize, calculateFittedPageSize, calculateNaturalPageSize } from './src/hooks/useAutoPageSize';
    export { TableCard, TABLE_CARD_CLASS_NAME } from './src/components/data-display/TableCard';
    export { FEFOMonitor } from './src/features/dashboard/components/admin/FEFOMonitor';
    export { ForecastChart, ForecastGraphTooltip } from './src/features/dashboard/components/admin/ForecastChart';
    export { ForecastMetadata, ForecastAnnualDetails } from './src/features/dashboard/components/admin/ForecastMetadata';
    export * from './src/features/dashboard/utils/forecastV6';
    export { useForecastRefresh } from './src/features/dashboard/hooks/useForecastRefresh';
    export { QueryErrorMessage } from './src/components/feedback/QueryErrorMessage';
    export { BatchDetailsFields } from './src/features/inventory/components/BatchDetailsFields';
    export { ExpiredBatchTable } from './src/features/inventory/components/ExpiredBatchTable';
    export { AdminLayout } from './src/app/layouts/AdminLayout';
    export { StaffLayout } from './src/app/layouts/StaffLayout';
    export { AdminSidebar } from './src/app/navigation/AdminSidebar';
    export { StaffSidebar } from './src/app/navigation/StaffSidebar';
    export { NotificationBell } from './src/components/navigation/NotificationBell';
    export { TopBar } from './src/components/navigation/TopBar';
    export { ModuleSubheading } from './src/components/navigation/ModuleSubheading';
    export { AdminDashboard } from './src/features/dashboard/pages/AdminDashboard';
    export { StaffDashboard } from './src/features/dashboard/pages/StaffDashboard';
    export { StaffSettings } from './src/features/settings/pages/StaffSettings';
    export { SectionHeader } from './src/components/data-display/SectionHeader';
    export { Btn } from './src/components/buttons/Btn';
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
    export { encodingService } from './src/features/sales/api/encoding.service';
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
    export { userService } from './src/features/users/api/user.service';
    export { normalizeRegistrationUsername, validateRegistration } from './src/features/users/utils/registration';
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
  ...require(id), toast: Object.assign((...args) => toastMessages.push(args), { error: (...args) => toastErrors.push(args), success() {}, warning() {} }),
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
  global.document = undefined;
  captureLayoutEffects = false; layoutEffects = [];
  effectCleanups.forEach(cleanup => cleanup()); effectCleanups = [];
  ui.clearDataCache();
  states = []; refs = []; effects = []; stateIndex = refIndex = 0;
  authState = { user: { username: 'audit' }, loading: false };
  toastErrors = [];
  toastMessages = [];
  const token = `header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`;
  global.localStorage = { getItem: key => key === 'rosario_access_token' ? token : null, setItem() {}, removeItem() {} };
  global.window = new EventTarget();
  global.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

function loginValidationFixture({ username = '', password = '', agreed = false } = {}, signIn = async () => ({ username: 'cashier' })) {
  authState = { ...authState, login: signIn };
  const tree = () => render(ui.Login);
  const field = id => elements(tree(), node => node.type === 'input' && node.props.id === id)[0];
  const terms = () => elements(tree(), node => node.type === 'input' && node.props.type === 'checkbox')[0];
  const wrapper = id => elements(tree(), node => node.type === 'div' && node.props.style?.borderColor
    && elements(node, child => child.props.id === id).length)[0];
  const normalBorder = wrapper('rd-username').props.style.borderColor;
  field('rd-username').props.onChange({ target: { value: username } });
  field('rd-password').props.onChange({ target: { value: password } });
  terms().props.onChange({ target: { checked: agreed } });
  return { tree, field, terms, wrapper, normalBorder,
    submit: () => elements(tree(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }) };
}

for (const username of ['', 'cashier']) for (const password of ['', 'password']) for (const agreed of [false, true]) {
  if (username && password && agreed) continue;
  test(`login validation targets only missing requirements: username=${!!username}, password=${!!password}, terms=${agreed}`, () => {
    let requests = 0;
    const form = loginValidationFixture({ username, password, agreed }, async () => { requests++; return { username: 'cashier' }; });
    form.submit();
    for (const [id, invalid] of [['rd-username', !username], ['rd-password', !password]]) {
      assert.equal(form.field(id).props['aria-invalid'], invalid);
      assert.equal(form.wrapper(id).props.style.borderColor === form.normalBorder, !invalid);
      assert.equal(elements(form.tree(), node => node.props.id === `${id}-error`).length, invalid ? 1 : 0);
    }
    assert.equal(form.terms().props['aria-invalid'], !agreed);
    assert.equal(!!form.terms().props.style.outline, !agreed);
    assert.equal(elements(form.tree(), node => node.props.id === 'rd-terms-error').length, agreed ? 0 : 1);
    if (!agreed) assert.equal(elements(form.tree(), node => node.props.id === 'rd-terms-error')[0].props.children,
      'Please agree to the Terms & Conditions to continue.');
    assert.equal(requests, 0, 'Incomplete validation must not call authentication');
  });
}

test('checking login terms immediately clears its error and allows the next sign-in without changing credentials', async () => {
  const requests = [];
  const form = loginValidationFixture({ username: ' cashier ', password: ' keep password spaces ' }, async (...credentials) => {
    requests.push(credentials); return { username: 'cashier' };
  });
  form.submit();
  assert.equal(form.field('rd-username').props['aria-invalid'], false);
  assert.equal(form.field('rd-password').props['aria-invalid'], false);
  form.terms().props.onChange({ target: { checked: true } });
  assert.equal(form.terms().props['aria-invalid'], false);
  assert.equal(form.terms().props.style.outline, undefined);
  assert.equal(elements(form.tree(), node => node.props.id === 'rd-terms-error').length, 0);
  assert.equal(elements(form.tree(), node => node.props.role === 'alert').length, 0);
  assert.equal(requests.length, 0, 'Checking terms clears validation without submitting credentials');
  form.submit(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [['cashier', ' keep password spaces ']]);
});

test('agreeing through the login terms modal immediately clears only the terms error', () => {
  const form = loginValidationFixture({ username: 'cashier', password: 'password' });
  form.submit();
  elements(form.tree(), node => node.type === 'button' && node.props.children === 'Terms & Conditions')[0].props.onClick();
  const modal = elements(form.tree(), node => typeof node.type === 'function' && node.type.name === 'TermsModal')[0];
  modal.props.onAgree();
  assert.equal(form.terms().props.checked, true);
  assert.equal(form.terms().props['aria-invalid'], false);
  assert.equal(elements(form.tree(), node => node.props.role === 'alert').length, 0);
});

test('correcting login requirements clears only their own validation state', () => {
  const form = loginValidationFixture(); form.submit();
  form.terms().props.onChange({ target: { checked: true } });
  assert.equal(form.field('rd-username').props['aria-invalid'], true);
  assert.equal(form.field('rd-password').props['aria-invalid'], true);
  assert.equal(form.terms().props['aria-invalid'], false);
  form.field('rd-username').props.onChange({ target: { value: 'cashier' } });
  assert.equal(form.field('rd-username').props['aria-invalid'], false);
  assert.equal(form.field('rd-password').props['aria-invalid'], true);
  form.field('rd-password').props.onChange({ target: { value: 'password' } });
  assert.equal(form.field('rd-password').props['aria-invalid'], false);
  assert.equal(elements(form.tree(), node => node.props.role === 'alert').length, 0);
});

test('whitespace-only login usernames are invalid without marking a filled password or accepted terms', () => {
  let requests = 0;
  const form = loginValidationFixture({ username: '   ', password: 'password', agreed: true }, async () => { requests++; return { username: '' }; });
  form.submit();
  assert.equal(form.field('rd-username').props['aria-invalid'], true);
  assert.equal(form.field('rd-password').props['aria-invalid'], false);
  assert.equal(form.terms().props['aria-invalid'], false);
  assert.equal(requests, 0);
});

test('login network failures preserve the existing error message without applying field-validation styling', async () => {
  const form = loginValidationFixture({ username: 'cashier', password: 'password', agreed: true }, async () => {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK);
  });
  form.submit(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(JSON.stringify(form.tree()).includes('Unable to connect to the server. Please try again.'));
  assert.equal(form.field('rd-username').props['aria-invalid'], false);
  assert.equal(form.field('rd-password').props['aria-invalid'], false);
  assert.equal(form.terms().props['aria-invalid'], false);
  assert.equal(form.wrapper('rd-username').props.style.borderColor, form.normalBorder);
  assert.equal(form.wrapper('rd-password').props.style.borderColor, form.normalBorder);
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

test('the shared top bar owns the page heading and date in both portals while section actions remain accessible', () => {
  for (const role of ['Administrator', 'Staff']) {
    states = []; refs = []; effects = [];
    let menuOpened = false;
    const tree = render(ui.TopBar, { title: 'Inventory', userName: 'Demo User', role, onMenuClick: () => { menuOpened = true; } });
    const headings = elements(tree, node => node.type === 'h1');
    assert.equal(headings.length, 1);
    assert.equal(headings[0].props.children, 'Inventory');
    assert.match(headings[0].props.className, /text-xl font-bold text-slate-800/);
    const date = elements(tree, node => node.type === 'p')[0];
    assert.ok(date.props.children);
    assert.match(date.props.className, /text-xs font-normal text-slate-400/);
    elements(tree, node => node.type === 'button')[0].props.onClick();
    assert.equal(menuOpened, true);
  }
  const action = React.createElement(ui.Btn, { onClick() {} }, 'Refresh Data');
  const section = render(ui.SectionHeader, { title: 'Revenue Analytics', subtitle: 'Current period', action });
  assert.equal(elements(section, node => node.type === 'h2')[0].props.className, 'text-base font-semibold text-slate-800');
  assert.equal(elements(section, node => node.type === ui.Btn)[0], action);
  const primary = render(ui.Btn, { children: 'Refresh Data' });
  assert.match(primary.props.className, /bg-blue-600 hover:bg-blue-700 text-white/);
  assert.match(primary.props.className, /rounded-lg/);
});

test('feature pages omit repeated page headings and retain their create, restock and export actions', () => {
  authState = { user: { id: 7, username: 'demo', email: 'demo@example.test', role: 'admin' }, loading: false };
  const pages = [
    [ui.AdminInventory, 'Restock'], [ui.AdminOrders, 'Create Order'], [ui.StaffOrders, 'Create Order'],
    [ui.SalesEncoding, 'New sales entry'], [ui.AdminCategories, 'Add Category'],
    [ui.AdminCustomers, 'Add Customer'], [ui.AdminUserManagement, 'Add User'],
    [ui.StaffInventory], [ui.AdminSalesHistory], [ui.StaffSalesHistory], [ui.StaffPOS], [ui.AdminReports],
  ];
  for (const [Page, label] of pages) {
    states = []; refs = []; effects = [];
    const tree = render(Page);
    assert.equal(elements(tree, node => node.type === 'h1' || node.type === 'h2').length, 0, Page.name);
    if (label) {
      const action = elements(tree, node => node.type === ui.Btn && node.props.children === label)[0];
      assert.ok(action, `${Page.name} retains ${label}`);
      action.props.onClick();
      assert.ok(elements(render(Page), node => node.props.open === true).length, `${label} still opens its form`);
    }
    if (Page === ui.AdminReports) {
      assert.equal(elements(tree, node => node.type === 'button' && typeof node.props.onClick === 'function').length, 6);
      assert.ok(elements(tree, node => node.type === ui.Btn && node.props.children === 'Refresh Data').length);
    }
    if (Page === ui.StaffPOS) assert.equal(elements(tree, node => node.type === ui.SaleComposer).length, 1);
  }
});

test('only spacious modules add single-paragraph subheadings and retain their existing action rows', () => {
  authState = { user: { id: 7, username: 'demo', email: 'demo@example.test', role: 'admin' }, loading: false };
  const pages = [
    [ui.AdminInventory, 'Track real-time stock levels, monitor batch expirations, and process inventory outflows.', 'block shrink-0 min-h-10 md:flex md:items-center md:justify-end md:gap-3'],
    [ui.StaffInventory, 'Track real-time stock levels, monitor batch expirations, and process inventory outflows.', 'shrink-0 flex flex-wrap items-center justify-end gap-2'],
    [ui.AdminOrders, 'Monitor, track, and manage customer order fulfillments.', 'flex shrink-0 min-h-10 items-start justify-end gap-3 sm:items-center'],
    [ui.StaffOrders, 'Monitor, track, and manage customer order fulfillments.', 'flex shrink-0 justify-end gap-2'],
    [ui.AdminCategories, 'Organize products into manageable categories to streamline inventory tracking.', 'flex shrink-0 min-h-10 flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center'],
    [ui.AdminCustomers, 'View registered customer profiles, transaction histories, and contact information.', 'flex flex-wrap shrink-0 min-h-10 justify-end items-center gap-2'],
    [ui.SalesEncoding, 'Record manual offline sales invoices and manage pending payment statuses.', 'flex shrink-0 flex-wrap items-center justify-end gap-3'],
    [ui.AdminReports, 'Generate real-time business intelligence reports and export downloadable PDF analytics.', 'flex flex-col sm:flex-row sm:items-center justify-end gap-3 shrink-0'],
    [ui.AdminUserManagement, /^Manage system accounts, assign roles(?: \(Admin vs\. Staff\))?,? and control user access\.$/, 'flex flex-wrap shrink-0 min-h-10 items-center justify-end gap-2'],
  ];
  for (const [Page, description, rowClass] of pages) {
    states = []; refs = []; effects = [];
    const page = render(Page);
    const row = elements(page, node => node.type === 'div' && React.Children.toArray(node.props.children).some(child => child?.type === ui.ModuleSubheading))[0];
    assert.ok(row, Page.name);
    assert.equal(row.props.className, rowClass);
    const subheading = elements(row, node => node.type === ui.ModuleSubheading)[0];
    const paragraph = render(ui.ModuleSubheading, subheading.props);
    assert.equal(paragraph.type, 'p');
    if (description instanceof RegExp) assert.match(paragraph.props.children, description);
    else assert.equal(paragraph.props.children, description);
    assert.equal(paragraph.props.title, paragraph.props.children);
    assert.match(paragraph.props.className, /text-xs text-slate-500 font-normal mt-1 mb-3/);
    assert.match(paragraph.props.className, /hidden md:block/);
    assert.match(paragraph.props.className, /truncate/);
    assert.equal(elements(paragraph, node => ['h1', 'h2', 'h3', 'strong', 'b'].includes(node.type)).length, 0);
    assert.equal(elements(page, node => node.type === 'h1' || node.type === 'h2').length, 0);
  }
  for (const Page of [ui.AdminSalesHistory, ui.StaffSalesHistory, ui.StaffPOS, ui.AdminDashboard, ui.StaffDashboard, ui.AdminSettings, ui.StaffSettings]) {
    states = []; refs = []; effects = [];
    assert.equal(elements(render(Page), node => node.type === ui.ModuleSubheading).length, 0, Page.name);
  }
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


async function composerFixture(mode = 'checkout', role = 'staff', productCount = 1) {
  authState.user = { id: 7, username: 'audit', email: 'audit@example.com', role };
  const product = { id: 385, name: 'Milk', unit: 'unit', is_active: true, total_stock: '19', low_stock_threshold: 0, category: { name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  const products = Array.from({ length: productCount }, (_, index) => ({ ...product, id: 385 + index, name: index ? `Milk ${index}` : 'Milk' }));
  ui.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data:
    config.url === '/inventory/products/' ? products : config.url === '/inventory/product-batches/' ? products.map((product, index) => ({ id: index + 1, product, status: 'available', remaining_quantity: '19', expiration_date: '2099-10-17', unit_price: null, batch_number: `B${index + 1}` })) : config.url === '/sales/customers/' ? [{ id: 906, name: 'Customer', is_active: true, created_at: '2026-10-01' }] : [] });
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

test('order form hides discounts, charges the full manual subtotal and blocks duplicate pending submissions', async () => {
  const form = await composerFixture('order', 'admin');
  const picker = elements(render(ui.SaleComposer, form.props), node => node.type?.name === 'CustomerPicker')[0];
  picker.props.onChange('906');
  form.changeLine({ quantity: '2', unitPrice: '50', discountType: 'fixed', discountValue: '60' });
  const tree = render(ui.SaleComposer, form.props);
  const line = elements(tree, node => node.type === ui.SaleLineEditor)[0];
  assert.equal(line.props.canDiscount, false);
  const fields = render(ui.SaleLineEditor, line.props);
  assert.deepEqual(elements(fields, node => node.type === 'input').map(node => node.props['aria-label']), ['Quantity for Milk', 'Selling price for Milk']);
  assert.equal(elements(fields, node => node.type === 'select').length, 0);
  assert.equal(elements(tree, node => node.props.children === 'Item discounts').length, 0);
  for (const label of ['Subtotal', 'Total']) {
    const row = elements(tree, node => node.type === 'div' && node.props.className?.startsWith('flex justify-between gap-2') && elements(node, child => child.type === 'span' && child.props.children === label).length)[0];
    assert.equal(React.Children.toArray(row.props.children)[1].props.children, '\u20b1100.00');
  }
  form.field('Amount tendered').props.onChange({ target: { value: '50' } });
  let requests = 0, reject, payload;
  ui.http.defaults.adapter = config => { requests++; payload = JSON.parse(config.data); return new Promise((_, fail) => { reject = fail; }); };
  await form.submit(); assert.equal(requests, 0);
  form.field('Amount tendered').props.onChange({ target: { value: '100' } });
  const first = form.submit(); await settle();
  assert.deepEqual(payload.items, [{ product_id: 385, quantity: '2.00', unit_price: '50.00', discount_type: 'none', discount_value: '0.00' }]);
  assert.equal(payload.amount_tendered, '100.00');
  assert.equal('discount_type' in payload, false);
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

for (const [role, Layout, Sidebar, Inventory, Wrapper] of [
  ['Administrator', ui.AdminLayout, ui.AdminSidebar, ui.AdminInventory, ui.ProductTable],
  ['Staff', ui.StaffLayout, ui.StaffSidebar, ui.StaffInventory, ui.StaffInventoryTable],
]) {
  test(`${role} desktop sidebar toggles repeatedly without replacing the active Inventory page or changing main geometry`, () => {
    const props = { onLogout() {} };
    const sidebar = tree => elements(tree, node => node.type === Sidebar)[0];
    let tree = render(Layout, props);
    sidebar(tree).props.onChange('inventory');
    tree = render(Layout, props);
    const originalPage = elements(tree, node => node.type === Inventory)[0];
    const mainClass = elements(tree, node => node.type === 'main')[0].props.className;
    const contentClass = elements(tree, node => node.props.className === 'h-dvh flex-1 flex flex-col overflow-hidden min-w-0')[0].props.className;
    assert.equal(sidebar(tree).props.collapsed, false);
    for (let i = 0; i < 8; i++) {
      const logo = elements(Sidebar(sidebar(tree).props), node => node.type === 'button' && node.props['aria-controls'])[0];
      assert.equal(logo.props.children.props.size, 36);
      logo.props.onClick();
      tree = render(Layout, props);
      assert.equal(sidebar(tree).props.collapsed, i % 2 === 0);
      assert.equal(sidebar(tree).props.isOpen, false, 'Desktop toggles do not open the mobile overlay');
      assert.equal(sidebar(tree).props.active, 'inventory');
      const page = elements(tree, node => node.type === Inventory)[0];
      assert.equal(page.type, originalPage.type);
      assert.equal(page.key, originalPage.key, 'Unchanged page type/key keeps existing child state mounted');
      assert.deepEqual(page.props, originalPage.props);
      assert.equal(elements(tree, node => node.type === 'main')[0].props.className, mainClass);
      assert.equal(elements(tree, node => node.props.className === contentClass).length, 1);
      assert.equal(elements(tree, node => node.type === ui.TopBar)[0].props.role, role);
    }
    assert.equal(effects.length, 0, 'Collapsing introduces no scroll-reset or resize effects in the layouts');
  });

  test(`${role} mobile overlay state remains independent of desktop collapsed preference`, () => {
    const props = { onLogout() {} };
    const sidebar = tree => elements(tree, node => node.type === Sidebar)[0];
    let tree = render(Layout, props);
    sidebar(tree).props.onToggleCollapsed();
    tree = render(Layout, props);
    elements(tree, node => node.type === ui.TopBar)[0].props.onMenuClick();
    tree = render(Layout, props);
    assert.equal(sidebar(tree).props.collapsed, true);
    assert.equal(sidebar(tree).props.isOpen, true);
    sidebar(tree).props.onChange('orders');
    sidebar(tree).props.onClose();
    tree = render(Layout, props);
    assert.equal(sidebar(tree).props.active, 'orders');
    assert.equal(sidebar(tree).props.isOpen, false);
    assert.equal(sidebar(tree).props.collapsed, true);
  });

  test(`${role} sidebar keeps full mobile labels, accessible desktop icons, active indicators and logout`, () => {
    let closed = 0, toggled = 0, loggedOut = 0, destination;
    for (const collapsed of [false, true]) for (const isOpen of [false, true]) {
      const tree = render(Sidebar, { active: 'inventory', collapsed, isOpen,
        onChange: page => { destination = page; }, onClose: () => closed++,
        onToggleCollapsed: () => toggled++, onLogout: () => loggedOut++ });
      const aside = elements(tree, node => node.type === 'aside')[0];
      assert.ok(aside.props.className.includes('w-[240px]'));
      assert.ok(aside.props.className.includes(collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'));
      assert.equal(aside.props.style.width, undefined, 'Inline widths cannot override the mobile width');
      assert.ok(aside.props.className.includes('fixed lg:static'));
      assert.ok(aside.props.className.includes('lg:translate-x-0'));
      assert.ok(!/transition-(?:all|\[width\])/.test(aside.props.className));
      const toggle = elements(tree, node => node.type === 'button' && node.props['aria-controls'])[0];
      assert.ok(toggle.props.className.includes('hidden lg:flex'));
      assert.equal(toggle.props['aria-expanded'], !collapsed);
      assert.equal(toggle.props['aria-label'], collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      assert.equal(toggle.props.title, toggle.props['aria-label']);
      assert.equal(toggle.props.type, 'button', 'Native buttons support Enter and Space activation');
      assert.equal(typeof toggle.props.children.type, 'function');
      assert.equal(toggle.props.children.props.size, 36);
      assert.ok(toggle.props.className.includes('hover:ring-2'));
      assert.ok(toggle.props.className.includes('focus-visible:ring-2'));
      const mobileLogo = elements(tree, node => node.props.className === 'shrink-0 lg:hidden')[0];
      assert.equal(mobileLogo.props.children.type, toggle.props.children.type);
      assert.equal(mobileLogo.props.children.props.size, 36);
      assert.equal(mobileLogo.props.onClick, undefined, 'The mobile logo is static; hamburger navigation is unchanged');
      const header = elements(tree, node => node.props.style?.borderBottom)[0];
      assert.equal(elements(header, node => node.type === 'button').length, 1, 'There is no separate toggle icon');
      assert.ok(header.props.className.includes('py-5'), 'Header height is preserved in both states');
      assert.equal(header.props.className.includes('lg:justify-center'), collapsed);
      assert.equal(elements(tree, node => node.type === 'nav' && node.props.id === toggle.props['aria-controls']).length, 1);
      toggle.props.onClick();
      const inventory = elements(tree, node => node.type === 'button' && node.props['aria-label'] === 'Inventory')[0];
      assert.equal(inventory.props['aria-current'], 'page');
      assert.ok(inventory.props.style.borderLeft.startsWith('3px solid'));
      for (const button of elements(tree, node => node.type === 'nav')[0].props.children) {
        assert.equal(button.props.title, button.props['aria-label']);
        const label = elements(button, node => node.type === 'span')[0];
        assert.equal(label.props.className, collapsed ? 'lg:hidden' : undefined,
          'Labels are never hidden below the existing lg breakpoint');
        assert.equal(button.props.className.includes('lg:justify-center'), collapsed);
      }
      inventory.props.onClick();
      assert.equal(destination, 'inventory');
      const logout = elements(tree, node => node.type === 'button' && node.props['aria-label'] === 'Logout')[0];
      assert.equal(logout.props.title, 'Logout'); logout.props.onClick();
      const backdrop = elements(tree, node => node.props.className === 'fixed inset-0 bg-black/40 z-40 lg:hidden')[0];
      assert.equal(!!backdrop, isOpen);
      if (backdrop) backdrop.props.onClick();
    }
    assert.equal(toggled, 4); assert.equal(loggedOut, 4); assert.equal(closed, 6);
  });

  test(`${role} Inventory retains search, pagination and complete measured rows across repeated sidebar-width changes`, () => {
    const originalObserver = global.ResizeObserver, originalStyle = global.getComputedStyle;
    let resized, cleanup, rowHeight = 53;
    const observed = [];
    global.ResizeObserver = class { constructor(callback) { resized = callback; } observe(node) { observed.push(node); } disconnect() {} };
    global.getComputedStyle = () => ({ lineHeight: '20px', paddingTop: '8px', paddingBottom: '8px' });
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    window.innerHeight = 768;
    captureLayoutEffects = true;
    try {
      const data = Array.from({ length: 40 }, (_, id) => ({ id, name: `Milk ${id}` }));
      const wrapper = render(Wrapper, { columns: [{ key: 'name', header: 'Product' }], data, rowKey: row => row.id, searchKeys: row => [row.name], showExport: false });
      const props = elements(wrapper, node => node.type === ui.EnhancedTable)[0].props;
      assert.equal(props.responsivePageSize, true); assert.equal(props.measureRenderedRows, true);
      states = []; refs = []; layoutEffects = []; effects = [];
      const renderTable = () => render(ui.EnhancedTable, props);
      let tree = renderTable();
      const surface = { clientHeight: 309, clientWidth: 1000,
        querySelectorAll: selector => selector === 'tbody tr' ? [{ getBoundingClientRect: () => ({ height: rowHeight }) }] : [] };
      elements(tree, node => node.props['data-table-surface'] !== undefined)[0].ref(surface);
      elements(tree, node => node.type === 'thead')[0].ref({ getBoundingClientRect: () => ({ height: 44 }) });
      renderTable(); cleanup = layoutEffects.at(-2)();
      assert.ok(observed.includes(surface));
      tree = renderTable();
      elements(tree, node => node.type === 'input')[0].props.onChange({ target: { value: 'Milk' } });
      tree = renderTable();
      elements(tree, node => node.type === 'button').at(-1).props.onClick();
      for (const width of [1168, 1000, 1168, 1000]) {
        surface.clientWidth = width; resized(); tree = renderTable();
        assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 5);
        assert.equal(elements(tree, node => node.type === 'input')[0].props.value, 'Milk');
        assert.ok(elements(tree, node => node.props.children === 'Page 2 of 8').length);
      }
      surface.clientWidth = 900; rowHeight = 70; resized(); tree = renderTable();
      assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 3,
        'Wrapping reduces capacity before a row can overlap pagination');
      surface.clientWidth = 1168; rowHeight = 53; resized(); tree = renderTable();
      assert.equal(elements(tree, node => node.type === 'tbody')[0].props.children.length, 5);
      assert.ok(elements(tree, node => node.props.children === 'Page 2 of 8').length);
    } finally {
      cleanup?.(); captureLayoutEffects = false;
      global.ResizeObserver = originalObserver; global.getComputedStyle = originalStyle;
    }
  });
}


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
  const expired = elements(column.render({ ...batch, status: 'expired' }), node => !!node.props.label)[1];
  assert.equal(expired.props.disabled, false);
  const blocked = elements(column.render({ ...batch, status: 'disposed' }), node => !!node.props.label)[1];
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

for (const role of ['admin', 'staff']) {
  test(`${role} encoding hides discounts and submits final manual prices with unchanged invoice details`, async () => {
    const form = await composerFixture('encoding', role, 2);
    let tree = render(ui.SaleComposer, form.props);
    elements(tree, node => node.type === 'button' && elements(node, child => child.props.children === 'Milk 1').length)[0].props.onClick();
    const drafts = [{ quantity: '3', unitPrice: '0.10', discountType: 'percent', discountValue: '100' },
      { quantity: '0.33', unitPrice: '1.99', discountType: 'fixed', discountValue: '999' }];
    elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).forEach((node, i) => node.props.onChange({ ...node.props.line, ...drafts[i] }));
    tree = render(ui.SaleComposer, form.props);
    for (const node of elements(tree, node => node.type === ui.SaleLineEditor)) {
      assert.equal(node.props.canDiscount, false);
      const editor = render(ui.SaleLineEditor, node.props);
      const controls = elements(editor, item => ['input', 'select'].includes(item.type));
      assert.deepEqual(controls.map(item => item.props['aria-label']), [`Quantity for ${node.props.line.name}`, `Selling price for ${node.props.line.name}`]);
      assert.ok(elements(editor, item => item.props.className === 'grid grid-cols-2 gap-2').length, 'Quantity and final unit price retain their compact two-column row');
    }
    assert.equal(elements(tree, node => node.props.children === 'Item discounts').length, 0);
    assert.equal(elements(tree, node => node.props.children === 'Gross subtotal').length, 0);
    assert.ok(elements(tree, node => node.props.children === 'Subtotal').length);
    assert.equal(elements(tree, node => node.props.children === ui.formatCents(96n)).length, 2, 'Subtotal and total equal the sum of rounded quantity-times-price lines');
    elements(tree, node => node.type?.name === 'CustomerPicker')[0].props.onChange('906');
    form.field('Sales date').props.onChange({ target: { value: '2000-09-15' } });
    form.field('SI number').props.onChange({ target: { value: 'SI-FINAL-PRICE' } });
    form.field('Encoding notes').props.onChange({ target: { value: 'Original invoice note' } });
    form.field('Payment method').props.onChange({ target: { value: 'online' } });
    let payload, result;
    form.props.onSuccess = transaction => { result = transaction; };
    const returned = { id: 91, subtotal: '0.96', discount_amount: '0.00', total_amount: '0.96', payment_status: 'pending', items: [] };
    ui.http.defaults.adapter = async config => { payload = JSON.parse(config.data); return { status: 201, config, headers: {}, data: returned }; };
    await form.submit();
    assert.deepEqual(payload.items, [
      { product_id: 385, quantity: '3.00', unit_price: '0.10', discount_type: 'none', discount_value: '0.00' },
      { product_id: 386, quantity: '0.33', unit_price: '1.99', discount_type: 'none', discount_value: '0.00' },
    ]);
    assert.equal(payload.customer_id, 906); assert.equal(payload.transaction_date, '2000-09-15');
    assert.equal(payload.si_number, 'SI-FINAL-PRICE'); assert.equal(payload.note, 'Original invoice note');
    assert.equal(payload.payment_method, 'online'); assert.equal(payload.payment_status, 'pending'); assert.equal(payload.amount_tendered, null);
    assert.equal('discount_type' in payload, false); assert.equal('discount_value' in payload, false);
    assert.match(payload.request_id, /^[0-9a-f-]{36}$/); assert.equal(result, returned);
  });

  test(`${role} encoded cash payment validates the full final-price total without hidden discounts`, async () => {
    const form = await composerFixture('encoding', role);
    form.changeLine({ quantity: '2', unitPrice: '50', discountType: 'fixed', discountValue: '60' });
    form.field('Payment status').props.onChange({ target: { value: 'paid' } });
    form.field('Amount tendered').props.onChange({ target: { value: '70' } });
    const payloads = [];
    ui.http.defaults.adapter = async config => { payloads.push(JSON.parse(config.data)); return { status: 201, config, headers: {}, data: { id: 92 } }; };
    await form.submit();
    assert.equal(payloads.length, 0, 'A stale discount cannot make insufficient cash pass validation');
    assert.match(toastErrors.at(-1)[0], /cover the total/);
    form.field('Amount tendered').props.onChange({ target: { value: '100' } });
    await form.submit();
    assert.equal(payloads.length, 1); assert.equal(payloads[0].amount_tendered, '100.00');
    assert.equal(payloads[0].payment_status, 'paid'); assert.equal(payloads[0].payment_method, 'cash');
    assert.deepEqual(payloads[0].items[0], { product_id: 385, quantity: '2.00', unit_price: '50.00', discount_type: 'none', discount_value: '0.00' });
  });
}

test('a restored discounted encoding cannot be silently repriced or resubmitted under its old request ID', async () => {
  retainBrowserStorage();
  const form = await composerFixture('encoding', 'admin');
  const lines = [{ productId: 385, name: 'Milk', stock: 19, quantity: '2', unitPrice: '100', discountType: 'fixed', discountValue: '25' }];
  const payload = { request_id: '550e8400-e29b-41d4-a716-446655440017', transaction_date: '2000-09-15', customer_id: null,
    payment_method: 'online', payment_status: 'pending', amount_tendered: null, si_number: 'SI-OLD-DISCOUNT',
    items: [{ product_id: 385, quantity: '2.00', unit_price: '100.00', discount_type: 'fixed', discount_value: '25.00' }] };
  let writes = 0;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'post') { writes++; throw new AxiosError('Timed out', AxiosError.ECONNABORTED); }
    return { status: 200, config, headers: {}, data: [] };
  };
  await assert.rejects(ui.encodingService.create(payload, lines));
  const original = JSON.stringify(ui.encodingService.pending());
  effectCleanups.forEach(cleanup => cleanup()); effectCleanups = [];
  states = []; refs = []; effects = [];
  render(ui.SaleComposer, form.props); effects[0](); await settle();
  let tree = render(ui.SaleComposer, form.props);
  assert.match(JSON.stringify(tree), /earlier discounted entry is unconfirmed/i);
  assert.equal(elements(tree, node => node.type === ui.Btn && node.props.children === 'Save sales entry')[0].props.disabled, true);
  await form.submit();
  assert.equal(writes, 1); assert.equal(JSON.stringify(ui.encodingService.pending()), original);
  elements(render(ui.SaleComposer, form.props), node => node.props.children === 'Start a new entry')[0].props.onClick();
  tree = render(ui.SaleComposer, form.props);
  const confirmation = elements(tree, node => node.type === ui.ConfirmDialog)[0];
  assert.equal(confirmation.props.open, true);
  confirmation.props.onConfirm();
  assert.equal(ui.encodingService.pending(), null);
  assert.equal(elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).length, 0);
  assert.equal(writes, 1, 'History acknowledgement never submits the legacy invoice');
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

function focusDocument() {
  const doc = new EventTarget();
  doc.defaultView = { getComputedStyle: element => ({ visibility: element.visible ? 'visible' : 'hidden', display: 'block' }) };
  const node = (options = {}) => ({
    ownerDocument: doc, isConnected: true, visible: true, disabled: false, tabIndex: 0, children: [], ...options,
    matches() { return this.disabled; }, closest() { return this.hidden ? this : null; },
    getClientRects() { return this.visible ? [{}] : []; },
    contains(other) { return this === other || this.children.some(child => child.contains(other)); },
    querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); },
    focus(options) { if (!this.disabled && this.isConnected) { this.focusOptions = options; doc.activeElement = this; doc.dispatchEvent(new Event('focusin')); } },
  });
  const opener = node(); doc.activeElement = opener;
  const key = (value, shiftKey = false) => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperties(event, { key: { value }, shiftKey: { value: shiftKey } });
    doc.dispatchEvent(event); return event;
  };
  return { doc, node, opener, key };
}

test('overlay keyboard trapping excludes hidden and disabled controls and restores the opener without scrolling', () => {
  const { doc, node, opener, key } = focusDocument();
  const first = node(), last = node();
  const panel = node({ tabIndex: -1, children: [node({ disabled: true }), node({ hidden: true }), first, node({ visible: false }), last] });
  const cleanup = ui.trapOverlayFocus(panel, () => {});
  try {
    assert.equal(doc.activeElement, first);
    assert.equal(key('Tab', true).defaultPrevented, true); assert.equal(doc.activeElement, last);
    assert.equal(key('Tab').defaultPrevented, true); assert.equal(doc.activeElement, first);
    opener.focus(); assert.equal(doc.activeElement, first, 'Programmatic focus cannot escape an open overlay');
  } finally { cleanup(); }
  assert.equal(doc.activeElement, opener);
  assert.deepEqual(opener.focusOptions, { preventScroll: true });
});

test('Escape closes only the topmost modal or drawer and respects a busy child', () => {
  const { doc, node, opener, key } = focusDocument();
  const parentButton = node(), childButton = node();
  let parentClosed = 0, childClosed = 0, busy = true;
  const releaseParent = ui.trapOverlayFocus(node({ children: [parentButton] }), () => parentClosed++);
  const releaseChild = ui.trapOverlayFocus(node({ children: [childButton] }), () => childClosed++, () => !busy);
  try {
    key('Escape'); assert.equal(childClosed, 0); assert.equal(parentClosed, 0);
    busy = false; key('Escape'); assert.equal(childClosed, 1); assert.equal(parentClosed, 0);
    releaseChild(); assert.equal(doc.activeElement, parentButton);
    key('Escape'); assert.equal(parentClosed, 1);
  } finally { releaseChild(); releaseParent(); }
  assert.equal(doc.activeElement, opener);
});

test('empty overlays retain keyboard focus and a child can restore focus after its parent unmounts', () => {
  const { doc, node, opener, key } = focusDocument();
  const parentButton = node();
  const releaseParent = ui.trapOverlayFocus(node({ children: [parentButton] }), () => {});
  const child = node({ tabIndex: -1 });
  const releaseChild = ui.trapOverlayFocus(child, () => {});
  try {
    assert.equal(doc.activeElement, child);
    assert.equal(key('Tab').defaultPrevented, true); assert.equal(doc.activeElement, child);
    releaseParent(); parentButton.isConnected = false;
    assert.equal(doc.activeElement, child);
  } finally { releaseChild(); releaseParent(); }
  assert.equal(doc.activeElement, opener);
});

test('both shared overlay components attach focus handling and expose named close controls', () => {
  for (const Component of [ui.Modal, ui.Drawer]) {
    states = [true, true]; refs = []; effects = [];
    const { doc, node, opener, key } = focusDocument();
    const control = node(), panel = node({ tabIndex: -1, children: [control] });
    let closed = 0;
    const props = { open: true, title: 'Details', children: null, onClose: () => closed++ };
    const tree = render(Component, props);
    const dialog = elements(tree, element => element.props.role === 'dialog')[0];
    assert.equal(dialog.props.tabIndex, -1);
    assert.ok(elements(tree, element => element.type === 'button' && element.props['aria-label']).length > 0);
    dialog.ref.current = panel;
    const cleanup = effects[1]();
    try {
      assert.equal(doc.activeElement, control);
      if (Component === ui.Modal) {
        render(Component, { ...props, busy: true }); key('Escape'); assert.equal(closed, 0);
        render(Component, props);
      }
      key('Escape'); assert.equal(closed, 1);
    } finally { cleanup(); }
    assert.equal(doc.activeElement, opener);
  }
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

test('report cooldown keeps saved metrics visible and an explicit retry works only after the delay', async () => {
  const originalNow = Date.now;
  let now = Date.UTC(2026, 9, 29, 1), requests = 0, limited = true;
  Date.now = () => now;
  const summary = elements(render(ui.AdminReports), node => node.type?.name === 'ReportSummary' && node.props.type === 'daily_sales')[0];
  states = []; refs = []; effects = [];
  const key = `${ui.dataCacheEpoch()}:${ui.reportCacheKey('preview', 'daily_sales')}`;
  const saved = { date: '2000-09-01', total_revenue: '123.45', transaction_count: 2 };
  ui.writeDataCache(key, saved, ['reports', 'dashboard']);
  ui.http.defaults.adapter = async config => {
    requests++;
    if (limited) throw new AxiosError('Throttled', undefined, config, undefined,
      { status: 429, config, headers: { 'retry-after': '2' }, data: { detail: 'Wait' } });
    return { status: 200, config, headers: {}, data: { data: { ...saved, total_revenue: '200.00' } } };
  };
  const tree = () => render(summary.type, summary.props);
  let cleanup;
  try {
    tree(); cleanup = effects.at(-1)(); await settle(); assert.equal(requests, 0);
    ui.invalidateDataCache(['reports']); await settle();
    let content = tree();
    assert.ok(JSON.stringify(content).includes('123.45'));
    assert.deepEqual(ui.readDataCache(key).data, saved);
    assert.equal(elements(content, node => node.props.role === 'alert').length, 0);
    assert.match(elements(content, node => node.props.role === 'status')[0].props.children[0], /Try again in 2 seconds/);
    elements(content, node => node.props.children === 'Retry')[0].props.onClick(); await settle();
    window.dispatchEvent(new Event('focus')); await settle();
    assert.equal(requests, 1, 'Retry clicks and window focus cannot bypass the cooldown');
    now += 2000; limited = false;
    assert.equal(requests, 1, 'No automatic request is scheduled at cooldown expiry');
    elements(tree(), node => node.props.children === 'Retry')[0].props.onClick(); await settle();
    content = tree(); assert.equal(requests, 2);
    assert.ok(JSON.stringify(content).includes('200.00'));
    assert.equal(elements(content, node => node.props.children === 'Retry').length, 0);
    assert.equal(elements(content, node => node.props.role === 'status').length, 0);
  } finally { cleanup?.(); Date.now = originalNow; }
});

test('an initially throttled report shows a compact retry notice instead of an empty-data fallback', async () => {
  const summary = elements(render(ui.AdminReports), node => node.type?.name === 'ReportSummary' && node.props.type === 'customer')[0];
  states = []; refs = []; effects = [];
  ui.http.defaults.adapter = async config => { throw new AxiosError('Throttled', undefined, config, undefined,
    { status: 429, config, headers: { 'retry-after': '60' }, data: { detail: 'Wait' } }); };
  render(summary.type, summary.props); const cleanup = effects.at(-1)(); await settle();
  const content = render(summary.type, summary.props);
  assert.equal(elements(content, node => node.props.role === 'status').length, 1);
  assert.equal(elements(content, node => node.props.children === 'Retry').length, 1);
  assert.ok(!JSON.stringify(content).includes('Report data unavailable.'));
  cleanup();
});

test('PDF throttling uses a quiet reusable notice and leaves report controls usable', async () => {
  let requests = 0;
  ui.http.defaults.adapter = async config => {
    requests++;
    throw new AxiosError('Throttled', undefined, config, undefined, { status: 429, config,
      headers: { 'retry-after': '60' }, data: new Blob([JSON.stringify({ detail: 'Wait' })], { type: 'application/json' }) });
  };
  let tree = render(ui.AdminReports);
  const button = elements(tree, node => node.type === 'button')[0];
  await button.props.onClick();
  tree = render(ui.AdminReports);
  const buttons = elements(tree, node => node.type === 'button');
  assert.equal(buttons.length, 6); assert.ok(buttons.every(node => !node.props.disabled));
  await buttons[1].props.onClick();
  assert.equal(requests, 1, 'A different PDF button shares the active export budget');
  assert.equal(toastErrors.length, 0);
  assert.equal(toastMessages.length, 2);
  for (const [message, options] of toastMessages) {
    assert.match(message, /PDF exports are temporarily limited/);
    assert.equal(options.id, 'report-pdf-cooldown', 'Repeated clicks replace the same notification');
  }
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

test('Reports applies identical custom dates to all six previews and PDF exports', async () => {
  let tree = render(ui.AdminReports);
  const control = elements(tree, node => node.type === ui.ReportDateRangeControl)[0];
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  control.props.onApply(range);
  tree = render(ui.AdminReports);
  const summaries = elements(tree, node => typeof node.type === 'function' && node.type.name === 'ReportSummary');
  assert.equal(summaries.length, 6);
  for (const summary of summaries) assert.deepEqual(summary.props.range, range);
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
  for (const request of requests) assert.deepEqual(request.params, { type: request.params.type, ...range });
  assert.equal(elements(tree, node => node.type === 'p' && node.props.children === 'Stock movements and current inventory health').length, 1);
  assert.equal(elements(tree, node => node.type === 'p' && node.props.children === 'Available predictions for the selected dates').length, 1);
});

test('Reports resets every preview and export to backend defaults without retaining custom dates', async () => {
  let tree = render(ui.AdminReports);
  elements(tree, node => node.type === ui.ReportDateRangeControl)[0].props.onApply({ start_date: '2000-09-01', end_date: '2000-09-30' });
  tree = render(ui.AdminReports);
  elements(tree, node => node.type === ui.ReportDateRangeControl)[0].props.onApply(undefined);
  tree = render(ui.AdminReports);
  const summaries = elements(tree, node => typeof node.type === 'function' && node.type.name === 'ReportSummary');
  assert.equal(summaries.length, 6);
  for (const summary of summaries) assert.equal(summary.props.range, undefined);
  const requests = [];
  global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  ui.http.defaults.adapter = async config => { requests.push(config); return { status: 200, config, headers: {}, data: new Blob(['%PDF-1.4']) }; };
  for (const button of elements(tree, node => node.type === 'button')) await button.props.onClick();
  assert.equal(requests.length, 6);
  for (const request of requests) assert.deepEqual(request.params, { type: request.params.type });
});

test('Reports cards size from their content and align footers within each responsive grid row', () => {
  const tree = render(ui.AdminReports);
  assert.ok(tree.props.className.includes('h-auto'));
  assert.ok(!/lg:h-|overflow-hidden/.test(tree.props.className));
  const grid = elements(tree, node => node.props.className?.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3'))[0];
  assert.ok(grid.props.className.includes('items-stretch'));
  assert.ok(!/h-full|grid-rows-|auto-rows-fr|min-h-0|flex-1/.test(grid.props.className));
  const cards = React.Children.toArray(grid.props.children);
  assert.equal(cards.length, 6);
  for (const card of cards) {
    assert.equal(card.type, ui.Card);
    assert.ok(!/h-full|min-h-0|overflow-hidden/.test(card.props.className));
    const footer = elements(card, node => node.props.className?.includes('mt-auto shrink-0 pt-3'))[0];
    assert.ok(footer, 'The fixed-size footer remains inside a naturally growing card');
    assert.equal(elements(footer, node => node.type === 'button' && node.props.className.includes('w-full min-h-10')).length, 1);
  }
});

for (const message of ['No published forecasts overlap the selected dates.',
  'Saved forecasts are unavailable for this range. Missing observations and quality checks prevent publication. '.repeat(60)]) {
  test(`Forecast report preserves the complete ${message.length > 100 ? 'long' : 'short'} warning without clipping or collapsing details`, () => {
    const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
    const data = Object.freeze({ ...range, status: 'no_forecasts_in_range', status_message: message,
      range_note: 'Available predictions retain their full period values.', forecast: [] });
    const tree = reportSummaryFixture('sarima_forecast', data, range);
    const lines = elements(tree, node => node.type === 'p').map(node => node.props.children);
    assert.ok(lines.includes(message)); assert.ok(lines.includes(data.range_note));
    assert.ok(tree.props.className.includes('[overflow-wrap:anywhere]'));
    assert.equal(elements(tree, node => /line-clamp|overflow-hidden|max-h-/.test(node.props.className ?? '')).length, 0);
    assert.equal(elements(tree, node => node.type === 'details').length, 0, 'The full warning remains visible');
    assert.equal(data.status_message, message);
  });
}

function reportSummaryFixture(type, data, range) {
  const page = render(ui.AdminReports);
  const summary = elements(page, node => typeof node.type === 'function' && node.type.name === 'ReportSummary' && node.props.type === type)[0];
  states = []; refs = []; effects = [];
  ui.writeDataCache(`${ui.dataCacheEpoch()}:${ui.reportCacheKey('preview', type, undefined, range)}`, data, ['reports']);
  return render(summary.type, { type, range });
}

test('Inventory report summary separates selected movement dates from timestamped current stock health', () => {
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  const data = Object.freeze({ ...range, is_custom_range: true, as_of: '2000-10-01T00:05:00Z', low_stock_count: 2, expiring_soon_batch_count: 3,
    ledger: { ...range, date: range.end_date, columns: [], rows: [] } });
  const tree = reportSummaryFixture('inventory', data, range);
  const lines = elements(tree, node => node.type === 'p').map(node => React.Children.toArray(node.props.children).join(''));
  assert.equal(lines[0], 'Stock movements: 2000-09-01 to 2000-09-30');
  assert.match(lines[1], /Current health as of .*Oct.*1.*2000.*8:05.*Asia\/Manila.*Low stock: 2.*Expiring batches: 3/);
  assert.equal(data.as_of, '2000-10-01T00:05:00Z');
  assert.equal(tree.props.className, 'min-w-0 text-xs leading-relaxed space-y-1 [overflow-wrap:anywhere]');
});

test('Forecast report summary preserves no-overlap status and explains full-period prediction basis', () => {
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  const data = Object.freeze({ ...range, is_custom_range: true, status: 'no_forecasts_in_range', is_placeholder: false, forecast: [],
    status_message: 'No published forecasts overlap the selected dates.',
    range_note: 'Available predictions keep their full period values; amounts are not prorated.' });
  const tree = reportSummaryFixture('sarima_forecast', data, range);
  const lines = elements(tree, node => node.type === 'p').map(node => React.Children.toArray(node.props.children).join(''));
  assert.equal(lines[0], '2000-09-01 to 2000-09-30');
  assert.equal(lines[1], data.status_message);
  assert.equal(lines[2], data.range_note);
  assert.doesNotMatch(lines.join(' '), /₱0|approved live forecast/i);
});

test('Report date dialog explains the all-report date contract without changing control classes', () => {
  const tree = render(ui.ReportDateRangeControl, { onApply() {} });
  const modal = elements(tree, node => node.type === ui.Modal)[0];
  assert.match(modal.props.subtitle, /all six reports/);
  const help = elements(tree, node => node.props.id === 'report-date-help')[0];
  assert.match(help.props.children, /stock health remains current/);
  assert.match(help.props.children, /without prorating or fitting a new model/);
  assert.equal(help.props.className, 'text-xs leading-relaxed text-slate-500');
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

test('POS keeps 60 cart lines separate from checkout and confirms bulk clearing without recording a sale', async () => {
  const form = await composerFixture('checkout', 'staff', 60);
  let tree = render(ui.SaleComposer, form.props);
  const catalog = elements(tree, node => node.props['data-pos-catalog'] !== undefined)[0];
  const additions = elements(catalog, node => node.type === 'button' && !node.props.disabled &&
    elements(node, child => typeof child.props.children === 'string' && child.props.children.includes('enter price')).length);
  assert.equal(additions.length, 59);
  additions.forEach(button => button.props.onClick());
  tree = render(ui.SaleComposer, form.props);
  let list = elements(tree, node => node.props['data-pos-cart-items'] !== undefined)[0];
  const lines = elements(list, node => node.type === ui.SaleLineEditor);
  assert.equal(lines.length, 60);
  assert.ok(lines.every(node => node.props.compact));
  assert.deepEqual(lines.filter(node => node.props.focusPrice).map(node => node.props.line.productId), [444]);
  assert.equal(elements(list, node => node.props['aria-label'] === 'Amount tendered').length, 0);
  const checkout = elements(tree, node => node.props['data-pos-checkout'] !== undefined)[0];
  assert.equal(elements(checkout, node => node.props['aria-label'] === 'Amount tendered').length, 1);
  assert.equal(elements(checkout, node => node.props.children === 'Item discounts').length, 0);
  assert.ok(elements(checkout, node => node.props.children === 'Total').length);
  assert.ok(elements(checkout, node => node.props.children === 'Complete Transaction').length);
  assert.equal(elements(tree, node => node.type === 'button' && React.Children.toArray(node.props.children).join('') === 'Cart (60)')[0].props['aria-pressed'], true);
  lines.forEach(node => node.props.onChange({ ...node.props.line, quantity: '2', unitPrice: '1.25' }));
  form.field('Amount tendered').props.onChange({ target: { value: '150' } });
  tree = render(ui.SaleComposer, form.props);
  assert.equal(elements(tree, node => node.props.children === 'Complete Transaction')[0].props.disabled, false);
  let writes = 0;
  ui.http.defaults.adapter = async () => { writes++; throw new Error('Clearing must not write stock or sales'); };
  const openClear = () => {
    elements(render(ui.SaleComposer, form.props), node => node.type === 'button' && node.props.children === 'Clear All')[0].props.onClick();
    return elements(render(ui.SaleComposer, form.props), node => node.type === ui.ConfirmDialog && node.props.title === 'Clear all cart items?')[0];
  };
  const cancelled = openClear();
  assert.equal(cancelled.props.open, true);
  assert.equal(elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).length, 60);
  cancelled.props.onClose();
  assert.equal(elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).length, 60);
  assert.equal(form.field('Amount tendered').props.value, '150');
  openClear().props.onConfirm();
  tree = render(ui.SaleComposer, form.props);
  list = elements(tree, node => node.props['data-pos-cart-items'] !== undefined)[0];
  assert.equal(elements(list, node => node.type === ui.SaleLineEditor).length, 0);
  assert.ok(elements(list, node => node.props.children === 'Cart is empty. Click products on the left to add items.').length);
  assert.equal(form.field('Amount tendered').props.value, '');
  assert.equal(elements(tree, node => node.props.children === 'Complete Transaction')[0].props.disabled, true);
  assert.equal(writes, 0);
});

test('POS checkout readiness rejects invalid prices and Enter submits exact tender once without key-repeat or composition duplicates', async () => {
  const form = await composerFixture();
  const complete = () => elements(render(ui.SaleComposer, form.props), node => node.props.children === 'Complete Transaction' || node.props.children === 'Saving...')[0];
  form.field('Amount tendered').props.onChange({ target: { value: '100' } });
  let requests = 0, reject, payload;
  ui.http.defaults.adapter = config => { requests++; payload = JSON.parse(config.data); return new Promise((_, fail) => { reject = () => fail(new AxiosError('Invalid request', undefined, config, undefined, { status: 400, data: { detail: 'Test rejection' }, config, headers: {} })); }); };
  for (const unitPrice of ['', '0', '-1', 'NaN', 'Infinity', '1.001']) {
    form.changeLine({ unitPrice });
    assert.equal(complete().props.disabled, true, unitPrice);
    await form.submit();
    assert.equal(requests, 0, unitPrice);
  }
  form.changeLine({ quantity: '3', unitPrice: '1.99' });
  form.field('Amount tendered').props.onChange({ target: { value: '5.96' } });
  let prevented = 0;
  const key = (changes = {}) => ({ key: 'Enter', repeat: false, nativeEvent: { isComposing: false }, preventDefault() { prevented++; }, ...changes });
  assert.equal(complete().props.disabled, true);
  form.field('Amount tendered').props.onKeyDown(key());
  await settle(); assert.equal(requests, 0);
  form.field('Amount tendered').props.onChange({ target: { value: '5.97' } });
  assert.equal(complete().props.disabled, false);
  const tender = form.field('Amount tendered');
  tender.props.onKeyDown(key({ key: 'Escape' }));
  tender.props.onKeyDown(key({ repeat: true }));
  tender.props.onKeyDown(key({ nativeEvent: { isComposing: true } }));
  await settle(); assert.equal(requests, 0);
  tender.props.onKeyDown(key());
  tender.props.onKeyDown(key());
  await settle();
  assert.equal(requests, 1);
  assert.equal(payload.amount_tendered, '5.97');
  assert.deepEqual(payload.items, [{ product_id: 385, quantity: '3.00', unit_price: '1.99', discount_type: 'none', discount_value: '0.00' }]);
  assert.equal(complete().props.disabled, true);
  assert.equal(prevented, 3);
  reject(); await settle();
  assert.equal(complete().props.disabled, false, 'A confirmed validation rejection permits correction and retry');
});

test('new POS price fields focus without scrolling the page and reveal their row only inside the cart list', () => {
  const name = 'A very long product name that must keep the bulk cart row predictable';
  const tree = render(ui.SaleLineEditor, {
    line: { productId: 1, name, stock: 999999, quantity: '1', unitPrice: '', discountType: 'none', discountValue: '0' },
    canDiscount: false, compact: true, focusPrice: true, onChange() {}, onRemove() {},
  });
  const field = elements(tree, node => node.props['aria-label'] === `Selling price for ${name}`)[0];
  const list = { scrollTop: 0, getBoundingClientRect: () => ({ top: 0, bottom: 100 }) };
  const row = { getBoundingClientRect: () => ({ top: 150, bottom: 286 }) };
  let focused;
  field.ref.current = { closest: selector => selector === '[data-pos-cart-items]' ? list : row, focus: options => { focused = options; } };
  effects.at(-1)();
  assert.deepEqual(focused, { preventScroll: true });
  assert.equal(list.scrollTop, 186);
  const heading = elements(tree, node => node.type === 'h4')[0];
  assert.equal(heading.props.title, name);
  assert.match(heading.props.className, /truncate/);
  assert.equal(field.props.min, '0.01');
});

function retainBrowserStorage() {
  const token = global.localStorage.getItem('rosario_access_token');
  const values = new Map([['rosario_access_token', token]]);
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  return values;
}

test('encoding restores its saved draft after modal remount and requires history confirmation before discarding its retry identity', async () => {
  retainBrowserStorage();
  const form = await composerFixture('encoding');
  form.changeLine({ unitPrice: '12', quantity: '2' });
  form.field('SI number').props.onChange({ target: { value: 'SI-RESTORE' } });
  const payloads = [];
  ui.http.defaults.adapter = async config => {
    if (config.method === 'post') { payloads.push(JSON.parse(config.data)); throw new AxiosError('Timed out', AxiosError.ECONNABORTED); }
    return { status: 200, config, headers: {}, data: [] };
  };
  await form.submit();
  effectCleanups.forEach(cleanup => cleanup()); effectCleanups = [];
  states = []; refs = []; effects = [];
  render(ui.SaleComposer, form.props); effects[0](); await settle();
  let tree = render(ui.SaleComposer, form.props);
  let line = elements(tree, node => node.type === ui.SaleLineEditor)[0];
  assert.equal(line.props.line.name, 'Milk'); assert.equal(line.props.line.quantity, '2'); assert.equal(line.props.line.unitPrice, '12');
  assert.equal(form.field('SI number').props.value, 'SI-RESTORE');
  await form.submit();
  assert.equal(payloads.length, 2); assert.equal(payloads[0].request_id, payloads[1].request_id);
  elements(render(ui.SaleComposer, form.props), node => node.props.children === 'Start a new entry')[0].props.onClick();
  tree = render(ui.SaleComposer, form.props);
  const confirmation = elements(tree, node => node.type === ui.ConfirmDialog)[0];
  assert.equal(confirmation.props.open, true);
  confirmation.props.onClose();
  assert.equal(elements(render(ui.SaleComposer, form.props), node => node.type === ui.SaleLineEditor).length, 1);
  elements(render(ui.SaleComposer, form.props), node => node.props.children === 'Start a new entry')[0].props.onClick();
  elements(render(ui.SaleComposer, form.props), node => node.type === ui.ConfirmDialog)[0].props.onConfirm();
  tree = render(ui.SaleComposer, form.props);
  assert.equal(elements(tree, node => node.type === ui.SaleLineEditor).length, 0);
  assert.equal(elements(tree, node => node.props.children === 'Start a new entry').length, 0);
  assert.equal(payloads.length, 2, 'Acknowledging history never resubmits the old invoice');
});

test('outflow uncertainty remains visible after remount and cannot be cleared without history review', async () => {
  retainBrowserStorage();
  const batch = { id: 1, key: 'product-1', kind: 'product', name: 'Milk', batch: 'B1', stock: 5, unit: 'unit', cost: '0.00', expiry: '2099-01-01' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:outflow-batches`, [batch], ['inventory']);
  const field = label => elements(render(ui.InventoryOutflows), node => node.props['aria-label'] === label)[0];
  elements(render(ui.InventoryOutflows), node => node.props.children === 'Stock outflows')[0].props.onClick();
  field('Outflow batch').props.onChange({ target: { value: 'product-1' } });
  field('Outflow quantity').props.onChange({ target: { value: '1' } });
  let posts = 0;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'post') { posts++; throw new AxiosError('Timed out', AxiosError.ECONNABORTED); }
    return { status: 200, config, headers: {}, data: [] };
  };
  await elements(render(ui.InventoryOutflows), node => node.props.children === 'Record and deduct stock')[0].props.onClick();
  states = []; refs = []; effects = [];
  elements(render(ui.InventoryOutflows), node => node.props.children === 'Stock outflows')[0].props.onClick();
  let tree = render(ui.InventoryOutflows);
  assert.equal(elements(tree, node => node.props.children === 'Record and deduct stock')[0].props.disabled, true);
  assert.ok(elements(tree, node => node.props.role === 'alert').length);
  await elements(tree, node => node.props.children === 'Record and deduct stock')[0].props.onClick();
  assert.equal(posts, 1);
  elements(render(ui.InventoryOutflows), node => node.props.children === 'Review history')[0].props.onClick();
  render(ui.InventoryOutflows); effects.at(-1)(); await settle();
  tree = render(ui.InventoryOutflows);
  elements(tree, node => node.props.children === 'History checked — start a new outflow')[0].props.onClick();
  const confirmation = elements(render(ui.InventoryOutflows), node => node.type === ui.ConfirmDialog)[0];
  assert.equal(confirmation.props.open, true);
  confirmation.props.onConfirm();
  tree = render(ui.InventoryOutflows);
  assert.equal(elements(tree, node => node.props.children === 'Review history').length, 0);
  assert.equal(field('Outflow quantity').props.value, '');
  assert.equal(posts, 1);
});

test('User Management edits preserve backend multi-word name fields while changing another field', async () => {
  authState.user = { id: 7, username: 'admin', email: 'admin@example.com', role: 'admin' };
  const user = { id: 8, username: 'juan', name: 'Juan Miguel Dela Cruz', firstName: 'Juan Miguel', lastName: 'Dela Cruz', email: 'juan@example.com', role: 'Staff', status: 'Active', deactivationReason: 'none', last: 'Never', lastLogin: null, phone: '', address: '' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:users:list`, [user], ['users']);
  let tree = render(ui.AdminUserManagement);
  const table = elements(tree, node => node.type === ui.EnhancedTable)[0];
  const actions = table.props.columns.find(column => column.key === 'actions').render(user);
  elements(actions, node => node.props.label === 'Edit')[0].props.onClick();
  tree = render(ui.AdminUserManagement);
  const form = elements(tree, node => node.type?.name === 'UserForm' && node.props.title === 'Edit User')[0];
  assert.equal(form.props.form.firstName, 'Juan Miguel'); assert.equal(form.props.form.lastName, 'Dela Cruz');
  form.props.onChange({ ...form.props.form, email: 'new@example.com' });
  let updated;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'patch') updated = JSON.parse(config.data);
    return { status: 200, config, headers: {}, data: config.method === 'get' ? [] : {} };
  };
  tree = render(ui.AdminUserManagement);
  const modal = elements(tree, node => node.type === ui.Modal && node.props.title === 'Edit User')[0];
  elements(modal.props.footer, node => node.props.children === 'Save Changes')[0].props.onClick();
  await settle();
  assert.equal(updated.email, 'new@example.com'); assert.equal(updated.first_name, 'Juan Miguel'); assert.equal(updated.last_name, 'Dela Cruz');
});

test('staff inventory counts unique products separately from expired product and ingredient batches', () => {
  const product = { id: 1, name: 'Milk', cat: 'Dairy', stock: 5, expiry: '2099-01-01', low: true };
  const expired = (kind, id) => ({ ...product, catalogKey: `${kind}-${id}`, stock: 1, low: false, expiry: '2000-01-01', expiredBatch: { kind, id, key: `${kind}-${id}` } });
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:staff`, [product, { ...product, id: 2, low: false }, expired('product', 10), expired('product', 11), expired('ingredient', 10)], ['inventory']);
  const cards = elements(render(ui.StaffInventory), node => node.type?.name === 'SummaryCard');
  assert.deepEqual(cards.map(card => [card.props.label, card.props.value]), [['Products', 2], ['Low stock', 1], ['Near expiry', 0], ['Expired', 3]]);
});

test('staff inventory metrics use loading and failure placeholders and the dashboard recovers through retry', async () => {
  let tree = render(ui.InventoryAlert);
  assert.equal(elements(tree, node => node.type === 'span' && node.props.children === 0).length, 0);
  await assert.rejects(ui.fetchDataCache(`${ui.dataCacheEpoch()}:dashboard:staff-inventory-alerts`, () => Promise.reject(new Error('Offline')), ['dashboard', 'inventory']));
  states = []; refs = []; effects = [];
  tree = render(ui.InventoryAlert);
  const retry = elements(tree, node => node.type === ui.QueryErrorMessage)[0];
  assert.ok(retry); assert.equal(elements(tree, node => node.type === 'span' && node.props.children === 0).length, 0);
  const cleanup = effects.at(-1)();
  ui.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data: [] });
  await retry.props.onRetry(); await settle();
  tree = render(ui.InventoryAlert);
  assert.equal(elements(tree, node => node.type === ui.QueryErrorMessage).length, 0);
  assert.equal(elements(tree, node => node.type === 'span' && node.props.children === 0).length, 3);
  cleanup();
  await assert.rejects(ui.fetchDataCache(`${ui.dataCacheEpoch()}:inventory:staff`, () => Promise.reject(new Error('Offline')), ['inventory']));
  states = []; refs = []; effects = [];
  const cards = elements(render(ui.StaffInventory), node => node.type?.name === 'SummaryCard');
  assert.ok(cards.every(card => card.props.value === 'Unavailable'));
});

test('staff dashboard available products include sellable low-stock products without counting duplicates', () => {
  ui.writeDataCache(`${ui.dataCacheEpoch()}:dashboard:staff-inventory-alerts`, {
    items: [{ id: 1, stock: 2, low: true }, { id: 1, stock: 2, low: true }, { id: 2, stock: 0, low: true }], lowStock: 2, nearExpiry: 0,
  }, ['dashboard', 'inventory']);
  const tree = render(ui.InventoryAlert);
  const available = elements(tree, node => node.type === 'div' && node.props.className === 'flex items-center justify-between rounded-xl px-3 py-2.5' && elements(node, child => child.props.children === 'Available').length)[0];
  assert.equal(elements(available, node => node.type === 'span' && node.props.className === 'text-base font-bold tabular-nums')[0].props.children, 1);
});

function forecastFixture(period = 'monthly') {
  const dates = period === 'yearly' ? ['2024-01-01', '2025-01-01', '2026-01-01', '2027-01-01', '2028-01-01']
    : period === 'weekly' ? ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']
      : ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'];
  const middle = period === 'yearly' ? 2 : 3;
  const endDate = value => {
    const date = new Date(`${value}T00:00:00Z`);
    if (period === 'weekly') date.setUTCDate(date.getUTCDate() + 6);
    else if (period === 'monthly') { date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); }
    else { date.setUTCMonth(11); date.setUTCDate(31); }
    return date.toISOString().slice(0, 10);
  };
  return { period, scope: 'real', is_demo: false, training_scope: 'real', as_of: '2026-10-26', status: 'ready', model_id: 7,
    range: { start_date: dates[0], end_date: endDate(dates.at(-1)), past_periods: middle, future_periods: middle },
    available_periods: ['weekly', 'monthly', 'yearly'], available_views: ['combined', 'regular', 'feeding'],
    views: Object.fromEntries(['combined', 'regular', 'feeding'].map(key => [key, {
      label: key, message: null,
      evaluation: { issued_forecast: { periods: 1, wape_percent: 20, mae: 20, bias: -20 },
        historical_test: { periods: 2, wape_percent: key === 'regular' ? 10.6433 : null, mae: 10, bias: 0 } },
      points: dates.map((date, index) => ({ date, end_date: endDate(date), actual: index > middle ? null : index === 1 ? null : key === 'feeding' ? 15 : 100,
        past_prediction: index < middle ? 90 : null, future_prediction: index >= middle ? 120 : null,
        prediction_basis: index < middle ? index === 0 ? 'issued_forecast' : 'historical_test' : 'forecast',
        is_current: index === middle, is_partial_period: index === middle })),
    }])) };
}

test('centered forecast tabs preserve the full calendar and show separate basis evaluations in the compact toolbar', () => {
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, forecastFixture(), ['dashboard', 'reports']);
  let tree = render(ui.ForecastChart);
  const buttons = () => elements(tree, node => node.type === 'button');
  assert.equal(buttons().find(node => node.props.children === 'Combined').props['aria-pressed'], true);
  assert.equal(buttons().length, 5);
  const toolbar = elements(tree, node => node.props['aria-label'] === 'Forecast controls')[0];
  assert.match(toolbar.props.className, /flex-wrap/);
  assert.doesNotMatch(toolbar.props.className, /sm:flex-nowrap/);
  const segments = elements(toolbar, node => node.props['aria-label'] === 'Forecast sales view')[0];
  assert.match(segments.props.className, /bg-slate-100/);
  assert.match(buttons().find(node => node.props.children === 'Combined').props.className, /bg-white text-blue-600 shadow-sm/);
  const periodSelect = () => elements(tree, node => node.type === 'select' && node.props['aria-label'] === 'Forecast period')[0];
  assert.equal(periodSelect().props.value, 'monthly');
  assert.deepEqual(elements(periodSelect(), node => node.type === 'option').map(node => [node.props.value, node.props.children]),
    [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]);
  const refreshButton = buttons().find(node => node.props.title === 'Refresh using the latest completed weeks and months.');
  assert.ok(refreshButton);
  assert.equal(elements(refreshButton, node => node.props['aria-hidden'] === 'true').length, 1);
  const line = elements(tree, node => node.props.dataKey === 'actual')[0];
  assert.equal(line.props.connectNulls, false);
  const series = elements(tree, node => ['actual', 'past_prediction', 'future_prediction'].includes(node.props.dataKey));
  assert.equal(series.length, 3);
  assert.ok(series.every(node => node.props.connectNulls === false));
  assert.equal(elements(tree, node => ['predicted', 'provisional', 'approved'].includes(node.props.dataKey)).length, 0);
  const xAxis = elements(tree, node => node.props.dataKey === 'date')[0];
  assert.equal(xAxis.props.padding.right, 44);
  assert.equal(xAxis.props.tickFormatter('2025-12-01'), 'Dec 2025');
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.margin.right, 40);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data[0].actual, 100);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data.length, 7);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data[1].actual, null);
  assert.ok(!JSON.stringify(tree).includes('10.6% WAPE'));
  assert.match(JSON.stringify(tree), /Not yet available/);
  assert.ok(!JSON.stringify(tree).includes('Approved live forecast currently unavailable'));
  buttons().find(node => node.props.children === 'Regular Sales').props.onClick();
  tree = render(ui.ForecastChart);
  assert.match(JSON.stringify(tree), /10.6% WAPE/);
  assert.match(JSON.stringify(tree), /20.0% WAPE/);
  assert.match(JSON.stringify(tree), /Original issued forecast/);
  assert.match(JSON.stringify(tree), /Reconstructed historical test/);
  assert.ok(elements(tree, node => node.type === 'p' && Array.isArray(node.props.children) && node.props.children.includes(' completed '))
    .some(node => node.props.children.join('').includes('2 completed periods')));
  buttons().find(node => node.props.children === 'Milk Feeding').props.onClick();
  tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data[0].actual, 15);
  assert.equal(elements(tree, node => node.props.dataKey === 'actual')[0].props.name, 'Recorded sales');
  assert.equal(elements(tree, node => node.props.width === 72 && typeof node.props.tickFormatter === 'function')[0].props.tickFormatter(1500000), '₱1.5M');
  assert.equal(elements(tree, node => node.props.content?.type === ui.ForecastGraphTooltip)[0].props.filterNull, false);
  assert.ok(!JSON.stringify(tree).includes('10.6% WAPE'));
  periodSelect().props.onChange({ target: { value: 'weekly' } });
  tree = render(ui.ForecastChart);
  assert.equal(buttons().find(node => node.props.children === 'Milk Feeding').props['aria-pressed'], true);
  assert.equal(periodSelect().props.value, 'weekly');
});

function forecastV6Fixture(period = 'monthly') {
  const graph = forecastFixture(period);
  const source = { status: 'stale_data', latest_observed_period: '2025-12-01', expected_latest_closed_period: '2026-09-01', missing_observation_periods: 9, period: 'monthly', coverage_verified: false };
  const model = { name: 'ar1', display_label: 'Nonseasonal ARIMA(1,0,0)', family: 'ARIMA', order: [1, 0, 0], seasonal_order: [0, 0, 0, 0], seasonal_terms_enabled: false,
    training_start: '2024-01-01', trained_through: '2025-12-01', training_period: 'monthly', observed_periods: 24, missing_periods: 0,
    forecast_origin: '2026-10-01', projection_steps: 10, projection_step_unit: 'monthly', production_approved: false,
    validation: { wape_percent: 0, periods: 3, basis: 'validation_only' }, test: null,
    primary_backtest: { basis: 'rolling_one_period', metrics: { wape: 20, sample_count: 6 }, test_start: '2025-07-01', test_end: '2025-12-01' },
    baseline_comparison: { result: 'worse', selected_baseline: 'last_value', model_wape_percent: 20, baseline_wape_percent: 15 }, source_freshness: source };
  graph.readiness = { status: 'partially_available', production_approved: false, publication_status: 'research_only', source_freshness: { status: 'stale_data', coverage_verified: false, components: { regular: source, feeding: source } }, limitations: ['Server limitation: research evidence only.'] };
  for (const [key, view] of Object.entries(graph.views)) {
    view.readiness = { ...graph.readiness, available_prediction_points: 6, expected_prediction_points: 7 };
    view.model_details = key === 'combined' ? { name: 'sum_of_component_predictions', components: { regular: model, feeding: { ...model, name: 'local_level', display_label: 'Local level — nonseasonal ARIMA(0,1,0)' } } } : model;
    view.points = view.points.map(point => ({ ...point, forecast_origin: point.is_current || point.future_prediction !== null ? '2026-10-01' : point.date,
      horizon: period === 'yearly' ? Number(point.date.slice(0, 4)) - 2026 : 1, horizon_unit: period === 'yearly' ? 'year_offset' : period,
      outlook_basis: point.future_prediction !== null ? 'latest_closed_period_forecast' : null, issued_prediction: point.is_current ? 0 : null,
      issued_provenance: point.is_current ? { prediction_id: 41, run_id: 7, engine_version: 'original-engine', issued_at: '2026-09-30T12:00:00Z', run_as_of: '2026-09-30', forecast_origin: '2026-09-01', cutoff_basis: 'issuing_run_calendar', source_revision: 'original-revision', revision_kind: 'graph_input_revision', horizon: 2, horizon_unit: period } : null,
      model_details: point.prediction_basis === 'issued_forecast' ? null : view.model_details, is_nowcast: period === 'yearly' && point.is_current, annual_outlook: null }));
  }
  if (period !== 'yearly') {
    const length = period === 'weekly' ? 52 : 12;
    graph.seasonal_outlook = { period, as_of: graph.as_of, basis: 'single_origin_component_forecasts', production_approved: false, readiness: graph.readiness,
      views: Object.fromEntries(Object.entries(graph.views).map(([key, view]) => [key, { ...view, points: Array.from({ length }, (_, index) => {
        const date = new Date(period === 'weekly' ? '2026-10-26T00:00:00Z' : '2026-10-01T00:00:00Z');
        if (period === 'weekly') date.setUTCDate(date.getUTCDate() + index * 7); else date.setUTCMonth(date.getUTCMonth() + index);
        const end = new Date(date); if (period === 'weekly') end.setUTCDate(end.getUTCDate() + 6); else { end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0); }
        return { ...view.points.find(point => point.is_current), date: date.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10),
          is_current: index === 0, actual: index === 0 ? 0 : null, future_prediction: index === 4 ? null : 120, issued_prediction: index === 0 ? 0 : null, horizon: index + 1 };
      }) }])) };
    const points = graph.seasonal_outlook.views.regular.points;
    graph.seasonal_outlook.range = { start_date: points[0].date, end_date: points.at(-1).end_date, periods: length };
  } else graph.seasonal_outlook = null;
  return graph;
}

test('v6 model metadata separates saved availability approval stale sources and component evidence', () => {
  const graph = forecastV6Fixture();
  const text = JSON.stringify(ui.ForecastMetadata({ view: graph.views.combined, graphReadiness: graph.readiness, savedStatus: graph.status, current: graph.views.combined.points[3] }));
  for (const phrase of ['research only', 'Not production approved', 'stale data', 'Nonseasonal ARIMA(1,0,0)', 'Local level', 'worse than the reported baseline', 'Sep 2026', 'Dec 2025', '0.0% WAPE', '3 periods', '20.0% WAPE', '6 periods', 'Server limitation', 'separate from approval', 'not one fitted model']) assert.ok(text.includes(phrase), phrase);
  assert.match(text, /Steps from last fitted bucket/);
  assert.match(text, /These differ from the extraction-relative horizon/);
  assert.match(text, /not establish accuracy at|do not validate the entire seasonal path/);
});

test('v6 missing metadata evidence and components remain explicitly unavailable rather than zero or approved', () => {
  const view = forecastFixture().views.regular;
  const text = JSON.stringify(ui.ForecastMetadata({ view }));
  assert.match(text, /Model details unavailable/); assert.match(text, /Approval not supplied/);
  assert.equal(ui.forecastEvidence(null), 'Not available');
  assert.match(ui.forecastEvidence({ wape_percent: null, periods: 0 }), /WAPE unavailable.*0 periods/);
  assert.match(ui.forecastEvidence({ wape_percent: 0, periods: 1 }), /0.0% WAPE.*1 periods/);
  assert.equal(ui.forecastModelParts({ components: { regular: null } })[1].model, null);
  assert.equal(ui.forecastDate('2026-02-30'), 'Unavailable');
  assert.equal(ui.forecastHorizon(0, 'year_offset'), 'Year offset 0');
  assert.match(ui.forecastHorizon(1, 'weekly'), /current bucket counts as 1/);
});

test('v6 display safety preserves finite values provenance nulls and backend object immutability', () => {
  const view = forecastV6Fixture().views.regular, snapshot = structuredClone(view);
  const points = ui.forecastV6Points(view);
  assert.deepEqual(points, view.points); assert.deepEqual(view, snapshot);
  assert.notEqual(points[0], view.points[0]);
  assert.equal(points.find(point => point.is_current).issued_prediction, 0);
  assert.deepEqual(ui.forecastV6Points(undefined), []);
  assert.equal(ui.forecastV6Points({ points: [{ date: '2026-01-01', end_date: '2026-01-31', actual: NaN, past_prediction: undefined, future_prediction: Infinity }] })[0].actual, null);
});

test('v6 all nine centered views retain server values null gaps current membership and neutral boundary', () => {
  for (const period of ['weekly', 'monthly', 'yearly']) {
    const graph = forecastV6Fixture(period); ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`, graph, ['dashboard', 'reports']);
    states = []; refs = []; effects = [];
    let tree = render(ui.ForecastChart);
    elements(tree, node => node.props['aria-label'] === 'Forecast period')[0].props.onChange({ target: { value: period } });
    for (const [key, label] of [['combined', 'Combined'], ['regular', 'Regular Sales'], ['feeding', 'Milk Feeding']]) {
      tree = render(ui.ForecastChart); elements(tree, node => node.type === 'button' && node.props.children === label)[0].props.onClick(); tree = render(ui.ForecastChart);
      assert.deepEqual(elements(tree, node => Array.isArray(node.props.data))[0].props.data, graph.views[key].points);
      assert.ok(elements(tree, node => ['actual', 'past_prediction', 'future_prediction'].includes(node.props.dataKey)).every(line => !line.props.connectNulls));
      const bridge = elements(tree, node => node.props.className === 'forecast-boundary-connector')[0];
      assert.ok(bridge); assert.notEqual(bridge.props.stroke, elements(tree, node => node.props.dataKey === 'future_prediction')[0].props.stroke);
    }
  }
});

test('v6 seasonal displays retain full 12-month and 52-week horizons for all three views', () => {
  for (const period of ['monthly', 'weekly']) {
    const graph = forecastV6Fixture(period); ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`, graph, ['dashboard', 'reports']);
    states = []; refs = []; effects = [];
    let tree = render(ui.ForecastChart);
    elements(tree, node => node.props['aria-label'] === 'Forecast period')[0].props.onChange({ target: { value: period } }); tree = render(ui.ForecastChart);
    elements(tree, node => node.props['aria-label'] === 'Forecast display')[0].props.onChange({ target: { value: 'seasonal' } });
    for (const [key, label] of [['combined', 'Combined'], ['regular', 'Regular Sales'], ['feeding', 'Milk Feeding']]) {
      tree = render(ui.ForecastChart); elements(tree, node => node.type === 'button' && node.props.children === label)[0].props.onClick(); tree = render(ui.ForecastChart);
      const points = elements(tree, node => Array.isArray(node.props.data))[0].props.data;
      assert.equal(points.length, period === 'weekly' ? 52 : 12); assert.deepEqual(points, graph.seasonal_outlook.views[key].points);
      assert.equal(points[4].future_prediction, null); assert.match(JSON.stringify(tree), /No long-horizon score is inferred/);
      assert.equal(new Set(points.map(point => point.forecast_origin)).size, 1);
    }
  }
});

test('v6 comparison toggle uses immutable original issues including zero without replacing latest outlook', () => {
  const graph = forecastV6Fixture(); ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, graph, ['dashboard', 'reports']);
  let tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.props.dataKey === 'issued_prediction').length, 0);
  elements(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }); tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.props.dataKey === 'issued_prediction')[0].props.connectNulls, false);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data[3].future_prediction, 120);
  const point = graph.views.regular.points[3];
  const text = JSON.stringify(ui.ForecastGraphTooltip({ active: true, payload: [{ payload: point }] }));
  for (const phrase of ['Original issued comparison', '₱0', 'original-engine', 'original-revision', 'issuing run calendar', 'graph input revision', 'does not inherit', 'exclusive cutoff', 'current bucket counts as 1']) assert.ok(text.includes(phrase), phrase);
  assert.equal(point.issued_provenance.run_id, 7);
});

test('v6 unavailable seasonal components and missing issues never fall back to another view or fabricate predictions', () => {
  const graph = forecastV6Fixture(); graph.seasonal_outlook.views.combined.points = graph.seasonal_outlook.views.combined.points.map(point => ({ ...point, future_prediction: null, issued_prediction: null, model_details: null }));
  graph.seasonal_outlook.views.combined.model_details = null;
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, graph, ['dashboard', 'reports']);
  let tree = render(ui.ForecastChart); elements(tree, node => node.props['aria-label'] === 'Forecast display')[0].props.onChange({ target: { value: 'seasonal' } });
  tree = render(ui.ForecastChart); elements(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }); tree = render(ui.ForecastChart);
  assert.ok(elements(tree, node => Array.isArray(node.props.data))[0].props.data.every(point => point.future_prediction === null));
  assert.equal(elements(tree, node => node.props.dataKey === 'issued_prediction').length, 0); assert.match(JSON.stringify(tree), /No original issued comparisons/);
  graph.seasonal_outlook = null; ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, graph, ['dashboard', 'reports']); tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.type === ui.EmptyState)[0].props.title, 'Seasonal outlook unavailable');
});

test('v6 switching to yearly restores centered display and keeps existing refresh dates and view controls', () => {
  for (const period of ['monthly', 'yearly']) ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`, forecastV6Fixture(period), ['dashboard', 'reports']);
  let tree = render(ui.ForecastChart); elements(tree, node => node.props['aria-label'] === 'Forecast display')[0].props.onChange({ target: { value: 'seasonal' } }); tree = render(ui.ForecastChart);
  elements(tree, node => node.props['aria-label'] === 'Forecast period')[0].props.onChange({ target: { value: 'yearly' } }); tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.props['aria-label'] === 'Forecast display')[0].props.value, 'centered');
  assert.equal(elements(tree, node => node.type === 'option' && node.props.value === 'seasonal')[0].props.disabled, true);
  assert.equal(elements(tree, node => Array.isArray(node.props.data))[0].props.data.length, 5);
  assert.equal(elements(tree, node => node.props['aria-label'] === 'Forecast date range').length, 1);
  assert.equal(elements(tree, node => node.type === 'button' && node.props.title === 'Refresh using the latest completed weeks and months.').length, 1);
});

test('v6 annual explanations disclose January December missing months and actual floors without recalculation', () => {
  for (const month of ['01', '12']) {
    const point = { ...forecastV6Fixture('yearly').views.regular.points[2], future_prediction: 777, annual_outlook: {
      completed_months: month === '01' ? 0 : 11, observed_revenue: 42, forecast_months: month === '01' ? 12 : 1, forecast_revenue: 735,
      current_month: `2026-${month}-01`, current_month_actual: 100, current_month_model_prediction: 50, current_month_estimate: 100, current_month_floor_applied: true, prediction: 777, missing_completed_months: [] } };
    let text = JSON.stringify(ui.ForecastAnnualDetails({ point }));
    for (const phrase of ['Current-year outlook (actuals + estimates)', 'not a forecast issued in January', 'Actual floor applied', '₱777', 'Partial recorded sales', 'do not establish annual or Combined']) assert.ok(text.includes(phrase), phrase);
    point.future_prediction = null; point.annual_outlook.prediction = null; point.annual_outlook.missing_completed_months = ['2026-02-01'];
    text = JSON.stringify(ui.ForecastAnnualDetails({ point })); assert.match(text, /Missing completed months/); assert.match(text, /Feb 2026/); assert.match(text, /Full-year estimate unavailable/);
    assert.equal(point.annual_outlook.observed_revenue, 42);
  }
});

test('v6 Combined annual explanation shows server component breakdowns without inferring a missing component total', () => {
  const point = { ...forecastV6Fixture('yearly').views.combined.points[2], future_prediction: null, annual_outlook: { components: { regular: { prediction: 99, observed_revenue: 70, forecast_revenue: 29, completed_months: 9 }, feeding: null } } };
  const text = JSON.stringify(ui.ForecastAnnualDetails({ point }));
  assert.match(text, /Regular sales/); assert.match(text, /Milk feeding/); assert.match(text, /Calculation details unavailable/);
  assert.match(text, /Unavailable/); assert.equal(point.future_prediction, null);
  assert.equal(ui.ForecastAnnualDetails({ point: { ...point, is_nowcast: false } }), null);
});

function forecastCalendar() {
  const tree = () => render(ui.ForecastChart);
  const open = () => elements(tree(), node => node.props['aria-label'] === 'Forecast date range')[0].props.onClick();
  const modal = () => elements(tree(), node => node.type === ui.Modal && node.props.title === 'Forecast date range')[0];
  const field = label => elements(tree(), node => node.type === 'input' && node.props['aria-label'] === `Forecast ${label} date`)[0];
  const action = label => elements(modal().props.footer, node => node.props.children === label)[0].props.onClick();
  return { tree, open, modal, field, action };
}

function historicalForecastFixture(period = 'monthly') {
  return JSON.parse(JSON.stringify(forecastFixture(period)).replace(/2024/g, '1998').replace(/2025/g, '1999').replace(/2026/g, '2000').replace(/2027/g, '2001').replace(/2028/g, '2002'));
}

test('v6 historical date selection anchors the seasonal path without trimming or relabeling saved future buckets', () => {
  const graph = JSON.parse(JSON.stringify(forecastV6Fixture()).replace(/2024/g, '1998').replace(/2025/g, '1999').replace(/2026/g, '2000').replace(/2027/g, '2001'));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, forecastV6Fixture(), ['dashboard', 'reports']);
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly:2000-10-26`, graph, ['dashboard', 'reports']);
  const form = forecastCalendar(); form.open();
  form.field('from').props.onChange({ target: { value: '2000-09-01' } });
  form.field('to').props.onChange({ target: { value: '2000-10-26' } }); form.action('Apply dates');
  assert.equal(elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data.length, 2);
  elements(form.tree(), node => node.props['aria-label'] === 'Forecast display')[0].props.onChange({ target: { value: 'seasonal' } });
  const tree = form.tree(), points = elements(tree, node => Array.isArray(node.props.data))[0].props.data;
  assert.deepEqual(points, graph.seasonal_outlook.views.combined.points); assert.equal(points.length, 12);
  assert.match(JSON.stringify(tree), /no predictions are relabeled as historical issues/);
  form.open(); form.action('Clear dates');
  assert.deepEqual(elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data, forecastV6Fixture().seasonal_outlook.views.combined.points);
});

test('forecast calendar validates drafts cancels changes and clears dates back to the unchanged default view', () => {
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, forecastFixture(), ['dashboard', 'reports']);
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly:2000-10-26`, historicalForecastFixture(), ['dashboard', 'reports']);
  const form = forecastCalendar(); form.open();
  assert.equal(form.modal().props.open, true);
  assert.equal(form.field('from').props.type, 'date');
  assert.match(form.field('from').props.className, /w-full/);
  form.field('from').props.onChange({ target: { value: '2000-08-15' } });
  form.action('Apply dates');
  assert.match(elements(form.tree(), node => node.props.id === 'forecast-date-error')[0].props.children, /both From and To/);
  assert.equal(elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data.length, 7);
  form.field('to').props.onChange({ target: { value: '2000-08-01' } });
  form.action('Apply dates');
  assert.match(elements(form.tree(), node => node.props.id === 'forecast-date-error')[0].props.children, /on or after/);
  form.field('to').props.onChange({ target: { value: '2000-10-26' } });
  form.action('Apply dates');
  assert.equal(form.modal().props.open, false);
  const rows = elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data;
  assert.equal(rows.length, 3); assert.equal(rows[0].date, '2000-08-01'); assert.equal(rows[2].end_date, '2000-10-31');
  form.open(); form.field('from').props.onChange({ target: { value: '2000-09-01' } });
  form.modal().props.onClose(); form.open();
  assert.equal(form.field('from').props.value, '2000-08-15', 'Closing must discard uncommitted dates');
  form.action('Clear dates');
  assert.equal(elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data.length, 7);
  assert.equal(elements(form.tree(), node => node.props.label?.value === 'Current period').length, 1);
  assert.equal(form.modal().props.open, false);
});

test('historical forecast range preserves all view period controls original series gaps and full-window evaluations', () => {
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, forecastFixture(), ['dashboard', 'reports']);
  for (const period of ['weekly', 'monthly', 'yearly']) ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}:2000-10-26`, historicalForecastFixture(period), ['dashboard', 'reports']);
  const form = forecastCalendar(); form.open();
  form.field('from').props.onChange({ target: { value: '1990-01-01' } });
  form.field('to').props.onChange({ target: { value: '2000-10-26' } }); form.action('Apply dates');
  for (const period of ['weekly', 'monthly', 'yearly']) {
    elements(form.tree(), node => node.props['aria-label'] === 'Forecast period')[0].props.onChange({ target: { value: period } });
    for (const [view, label] of [['combined', 'Combined'], ['regular', 'Regular Sales'], ['feeding', 'Milk Feeding']]) {
      elements(form.tree(), node => node.type === 'button' && node.props.children === label)[0].props.onClick();
      const tree = form.tree();
      const points = elements(tree, node => Array.isArray(node.props.data))[0].props.data;
      const expected = historicalForecastFixture(period).views[view].points.filter(point => point.date <= '2000-10-26');
      assert.deepEqual(points, expected);
      assert.match(JSON.stringify(tree), /Earlier periods outside the server window/);
      assert.match(JSON.stringify(tree), /Server evaluations cover the full centered window/);
      assert.equal(elements(tree, node => node.props.label?.value === 'As-of period').length, 1);
      assert.ok(elements(tree, node => ['actual', 'past_prediction', 'future_prediction'].includes(node.props.dataKey)).every(line => line.props.connectNulls === false));
    }
  }
  form.open(); form.action('Clear dates');
  const tree = form.tree();
  assert.equal(elements(tree, node => node.props['aria-label'] === 'Forecast period')[0].props.value, 'yearly');
  assert.equal(elements(tree, node => node.type === 'button' && node.props.children === 'Milk Feeding')[0].props['aria-pressed'], true);
});

test('historical missing predictions remain unavailable and errors never fall back to current predictions', async () => {
  const key = `${ui.dataCacheEpoch()}:forecast-graph:real:monthly:2000-10-26`;
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, forecastFixture(), ['dashboard', 'reports']);
  const graph = historicalForecastFixture(); graph.status = 'refresh_required';
  for (const view of Object.values(graph.views)) {
    view.message = 'Refresh saved forecasts to make predictions available.';
    view.points = view.points.map(point => ({ ...point, past_prediction: null, future_prediction: null }));
  }
  ui.writeDataCache(key, graph, ['dashboard', 'reports']);
  const form = forecastCalendar(); form.open();
  form.field('from').props.onChange({ target: { value: '2000-09-01' } });
  form.field('to').props.onChange({ target: { value: '2000-10-26' } }); form.action('Apply dates');
  assert.match(JSON.stringify(form.tree()), /Refresh forecast updates the current window only/);
  assert.ok(elements(form.tree(), node => Array.isArray(node.props.data))[0].props.data.every(point => point.past_prediction === null && point.future_prediction === null));
  assert.equal(elements(form.tree(), node => node.props.className === 'forecast-boundary-connector').length, 0);
  form.open(); form.field('to').props.onChange({ target: { value: '2000-10-25' } }); form.action('Apply dates');
  const errorKey = `${ui.dataCacheEpoch()}:forecast-graph:real:monthly:2000-10-25`;
  await ui.fetchDataCache(errorKey, () => Promise.reject(new Error('Historical graph unavailable.')), ['dashboard', 'reports']).catch(() => {});
  const tree = form.tree();
  assert.equal(elements(tree, node => node.type === ui.EmptyState)[0].props.description, 'Historical graph unavailable.');
  assert.equal(elements(tree, node => Array.isArray(node.props.data)).length, 0);
  assert.equal(elements(tree, node => node.type === 'button' && node.props.children === 'Retry forecast').length, 1);
});

test('centered forecast renders all nine view/period combinations with the server calendar and current marker', () => {
  for (const period of ['weekly', 'monthly', 'yearly']) ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`, forecastFixture(period), ['dashboard', 'reports']);
  for (const period of ['weekly', 'monthly', 'yearly']) {
    states = []; refs = []; effects = [];
    let tree = render(ui.ForecastChart);
    elements(tree, node => node.type === 'select' && node.props['aria-label'] === 'Forecast period')[0].props.onChange({ target: { value: period } });
    tree = render(ui.ForecastChart);
    for (const [view, label] of [['combined', 'Combined'], ['regular', 'Regular Sales'], ['feeding', 'Milk Feeding']]) {
      elements(tree, node => node.type === 'button' && node.props.children === label)[0].props.onClick();
      tree = render(ui.ForecastChart);
      const points = elements(tree, node => Array.isArray(node.props.data))[0].props.data;
      assert.deepEqual(points, forecastFixture(period).views[view].points);
      assert.equal(points.length, period === 'yearly' ? 5 : 7);
      assert.equal(elements(tree, node => node.props.label?.value === 'Current period')[0].props.x, points.find(point => point.is_current).date);
    }
  }
});

test('centered graph tooltips distinguish partial actuals, full estimates and original versus reconstructed forecasts', () => {
  const point = { ...forecastFixture().views.regular.points[3], actual: 0, future_prediction: 1500, prediction_basis: 'issued_forecast' };
  let tooltip = ui.ForecastGraphTooltip({ active: true, payload: [{ payload: point }] });
  let text = JSON.stringify(tooltip);
  assert.match(text, /partial period/); assert.match(text, /full-period estimate/);
  assert.match(text, /₱0/); assert.match(text, /₱1,500/); assert.match(text, /Original issued forecast/);
  assert.ok(!text.includes('Reconstructed historical test'));
  tooltip = ui.ForecastGraphTooltip({ active: true, payload: [{ payload: { ...point, prediction_basis: 'historical_test', is_current: false } }] });
  text = JSON.stringify(tooltip);
  assert.match(text, /Reconstructed historical test/); assert.match(text, /not a forecast issued before the period/);
  assert.equal(ui.ForecastGraphTooltip({ active: false, payload: [{ payload: point }] }), null);
});

test('refresh-required graph retains recorded points and issued predictions and distinguishes missing data from zero', () => {
  const fixture = forecastFixture(); fixture.status = 'refresh_required';
  fixture.views.combined.message = 'Not enough sales history yet.';
  fixture.views.combined.evaluation = {};
  fixture.views.combined.points = fixture.views.combined.points.map((point, index) => ({ ...point, actual: index === 0 ? 0 : null, past_prediction: index === 0 ? 90 : null, future_prediction: null }));
  ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:monthly`, fixture, ['dashboard', 'reports']);
  let tree = render(ui.ForecastChart);
  assert.match(JSON.stringify(tree), /Saved forecasts need refreshing/);
  assert.match(JSON.stringify(tree), /Not enough sales history yet/);
  assert.match(JSON.stringify(tree), /No completed-period evaluation/);
  const points = elements(tree, node => Array.isArray(node.props.data))[0].props.data;
  assert.equal(points[0].actual, 0); assert.equal(points[0].past_prediction, 90); assert.equal(points[1].actual, null);
  assert.equal(points.length, 7);
  assert.ok(!JSON.stringify(tree).includes('No recorded sales in this range'));
});

test('centered forecast distinguishes initial loading and request errors with a retry action', async () => {
  let tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.type === ui.EmptyState)[0].props.title, 'Loading forecast graph');
  const key = `${ui.dataCacheEpoch()}:forecast-graph:real:monthly`;
  await ui.fetchDataCache(key, () => Promise.reject(new Error('Graph service unavailable.')), ['dashboard', 'reports']).catch(() => {});
  states = []; refs = []; effects = [];
  tree = render(ui.ForecastChart);
  assert.equal(elements(tree, node => node.type === ui.EmptyState)[0].props.description, 'Graph service unavailable.');
  assert.ok(elements(tree, node => node.type === 'button' && node.props.children === 'Retry forecast')[0]);
});

async function withForecastTimers(run) {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout;
  const timers = new Map(); let sequence = 0;
  global.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  global.clearTimeout = id => timers.delete(id);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const tick = async delay => {
    const [id, timer] = [...timers].find(([, timer]) => timer.delay === delay) ?? [];
    assert.ok(timer, `Missing timer for ${delay}ms`); timers.delete(id); timer.callback(); await settle();
  };
  try { await run({ timers, settle, tick }); }
  finally { effectCleanups.splice(0).forEach(cleanup => cleanup()); global.setTimeout = originalSet; global.clearTimeout = originalClear; }
}

test('forecast refresh recovers active jobs, polls every five seconds and invalidates every cached period on success', async () => {
  await withForecastTimers(async ({ timers, settle, tick }) => {
    const requests = []; let status = 'running';
    ui.http.defaults.adapter = async config => { requests.push(config); return { status: 200, config, headers: {}, data: { job_id: 12, status, stage: status === 'running' ? 'refresh_forecast_models' : 'complete', status_url: '/api/forecasting/refresh/12/' } }; };
    for (const period of ['weekly', 'monthly', 'yearly']) ui.writeDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`, forecastFixture(period), ['dashboard', 'reports']);
    render(ui.useForecastRefresh); effects.splice(0).forEach(effect => effect()); await settle();
    assert.equal(render(ui.useForecastRefresh).busy, true);
    assert.equal(requests[0].url, '/api/forecasting/refresh/');
    await tick(5000);
    assert.equal(requests.at(-1).url, '/api/forecasting/refresh/12/');
    status = 'succeeded'; await tick(5000);
    const state = render(ui.useForecastRefresh);
    assert.equal(state.busy, false); assert.equal(state.message, 'Forecast refreshed');
    for (const period of ['weekly', 'monthly', 'yearly']) assert.equal(ui.readDataCache(`${ui.dataCacheEpoch()}:forecast-graph:real:${period}`).updatedAt, 0);
    assert.equal(timers.size, 0);
  });
});

test('forecast refresh deduplicates starts, reports failed jobs and stops timers and requests on unmount', async () => {
  await withForecastTimers(async ({ timers, settle, tick }) => {
    const requests = []; let failed = false;
    ui.http.defaults.adapter = async config => {
      requests.push(config);
      const data = config.method === 'post' ? { job_id: 9, status: 'queued', status_url: '/api/forecasting/refresh/9/' }
        : config.url.endsWith('/9/') ? { job_id: 9, status: failed ? 'failed' : 'running', message: 'Refresh interrupted safely.', status_url: '/api/forecasting/refresh/9/' } : { status: 'idle', job_id: null };
      return { status: config.method === 'post' ? 202 : 200, data, config, headers: {} };
    };
    let state = render(ui.useForecastRefresh); effects.splice(0).forEach(effect => effect()); await settle();
    await Promise.all([state.refresh(), state.refresh()]);
    assert.equal(requests.filter(request => request.method === 'post').length, 1);
    failed = true; await tick(5000);
    state = render(ui.useForecastRefresh); assert.equal(state.busy, false); assert.match(state.error, /interrupted safely/);
    await state.refresh(); assert.equal(timers.size, 1);
    effectCleanups.splice(0).forEach(cleanup => cleanup());
    assert.equal(timers.size, 0); assert.equal(requests.at(-1).signal.aborted, true);
  });
});

test('forecast refresh respects Retry-After and recovers existing work without repeating the POST', async () => {
  await withForecastTimers(async ({ timers, settle, tick }) => {
    const requests = [];
    ui.http.defaults.adapter = async config => {
      requests.push(config);
      if (config.method === 'post') throw new AxiosError('Rate limited', undefined, config, undefined, { status: 429, config, headers: { 'retry-after': '17' }, data: { detail: 'Wait before refreshing.' } });
      return { status: 200, config, headers: {}, data: { status: 'idle', job_id: null } };
    };
    let state = render(ui.useForecastRefresh); effects.splice(0).forEach(effect => effect()); await settle();
    await state.refresh(); assert.ok([...timers.values()].some(timer => timer.delay === 17000));
    await tick(5000); assert.equal(render(ui.useForecastRefresh).busy, true);
    await render(ui.useForecastRefresh).refresh(); // The handler also guards the cooldown before a rerender.
    await tick(17000); assert.equal(render(ui.useForecastRefresh).busy, false);
    assert.equal(requests.filter(request => request.method === 'post').length, 1);
  });
});

test('forecast refresh ignores a late initial status response after a manual start', async () => {
  await withForecastTimers(async ({ settle }) => {
    let resolveInitial;
    ui.http.defaults.adapter = config => {
      if (config.method === 'get') return new Promise(resolve => { resolveInitial = () => resolve({ status: 200, config, headers: {}, data: { status: 'idle', job_id: null } }); });
      return Promise.resolve({ status: 202, config, headers: {}, data: { status: 'queued', job_id: 8, status_url: '/api/forecasting/refresh/8/' } });
    };
    const state = render(ui.useForecastRefresh); effects.splice(0).forEach(effect => effect()); await settle();
    await state.refresh(); resolveInitial(); await settle();
    assert.equal(render(ui.useForecastRefresh).job.job_id, 8);
    assert.equal(render(ui.useForecastRefresh).busy, true);
  });
});

test('forecast refresh recovers from a transient polling failure and clears busy state on a missing job', async () => {
  await withForecastTimers(async ({ settle, tick }) => {
    let response = 'active';
    ui.http.defaults.adapter = async config => {
      if (response !== 'active') throw new AxiosError('Unavailable', undefined, config, undefined, { status: response === 'network' ? 503 : 404, config, headers: {}, data: { detail: response === 'network' ? 'Temporarily unavailable.' : 'Job not found.' } });
      return { status: 200, config, headers: {}, data: { status: 'running', job_id: 8, status_url: '/api/forecasting/refresh/8/' } };
    };
    render(ui.useForecastRefresh); effects.splice(0).forEach(effect => effect()); await settle();
    response = 'network'; await tick(5000);
    assert.equal(render(ui.useForecastRefresh).busy, true);
    assert.match(render(ui.useForecastRefresh).error, /Temporarily unavailable/);
    response = 'active'; await tick(5000); assert.equal(render(ui.useForecastRefresh).error, '');
    response = 'missing'; await tick(5000); assert.equal(render(ui.useForecastRefresh).busy, false);
  });
});

test('the global render boundary retains healthy children and offers safe recovery without exposing exception details', () => {
  assert.equal(render(ui.App).type, ui.AppErrorBoundary);
  const content = React.createElement('p', null, 'Application');
  const boundary = new ui.AppErrorBoundary({ children: content });
  assert.equal(boundary.render(), content);
  boundary.state = ui.AppErrorBoundary.getDerivedStateFromError(new Error('Sensitive internal stack'));
  boundary.setState = update => { boundary.state = { ...boundary.state, ...update }; };
  const fallback = boundary.render();
  assert.equal(fallback.props.role, 'alert');
  const empty = elements(fallback, node => node.type === ui.EmptyState)[0];
  assert.ok(empty); assert.ok(!JSON.stringify(empty.props).includes('Sensitive internal stack'));
  elements(empty.props.action, node => node.props.children === 'Try again')[0].props.onClick();
  assert.equal(boundary.render(), content);
});

test('expired-status disposal is enabled on desktop and mobile while staff table actions stay read-only', () => {
  const batch = { id: 7, itemId: 1, key: 'product-7', kind: 'product', name: 'Milk', batch: 'EX-7',
    quantity: 5, unit: 'L', expiry: '2000-01-01', status: 'expired', dateReceived: '2000-01-01', unitCost: null };
  const item = { id: 1, name: 'Milk', cat: 'Dairy', stock: 5, expiry: batch.expiry, low: false, expiredBatch: batch };
  const props = { data: [item], columns: [{ key: 'name', header: 'Product' }, { key: 'actions', header: 'Actions' }],
    renderMobileRow: () => null };
  const table = elements(render(ui.ProductTable, props), node => Array.isArray(node.props.columns))[0];
  const actions = elements(table.props.columns.at(-1).render(item), node => !!node.props.label);
  assert.equal(actions[2].props.disabled, false);
  assert.equal(table.props.renderMobileRow(item).props.deleteDisabled, false);
  actions[2].props.onClick();
  assert.equal(elements(render(ui.ProductTable, props), node => node.props.title === 'Dispose expired batch?')[0].props.open, true);
  const readOnly = elements(render(ui.ProductTable, { ...props, readOnly: true }), node => Array.isArray(node.props.columns))[0];
  const staffActions = elements(readOnly.props.columns.at(-1).render(item), node => !!node.props.label);
  assert.deepEqual(staffActions.map(action => action.props.label), ['View details']);
});

test('customer history does not display the encoder as an unknown original cashier', () => {
  const customer = { id: 9, name: 'Customer' };
  const transaction = { id: 11, transaction_number: 'SI-11', created_at: '2026-10-01T00:00:00Z',
    total_amount: '10.00', payment_method: 'cash', payment_status: 'paid', recorded_cashier: null,
    is_manually_encoded: true, handled_by: { id: 7, username: 'ENTRY-OWNER' } };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:customers:history:9:1:false`, { count: 1, results: [transaction] }, ['customers', 'sales']);
  const content = JSON.stringify(render(ui.CustomerHistory, { customer, onClose() {} }));
  assert.ok(content.includes('Not recorded'));
  assert.ok(!content.includes('ENTRY-OWNER'));
});

test('expired status cannot be used for promotional outflows even when its expiry date is not past', async () => {
  const batch = { id: 1, key: 'product-1', kind: 'product', name: 'Milk', batch: 'B1', stock: 2,
    unit: 'L', cost: '0.00', expiry: '2099-01-01', status: 'expired' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:inventory:outflow-batches`, [batch], ['inventory']);
  elements(render(ui.InventoryOutflows), node => node.props.children === 'Stock outflows')[0].props.onClick();
  const field = label => elements(render(ui.InventoryOutflows), node => node.props['aria-label'] === label)[0];
  field('Outflow batch').props.onChange({ target: { value: batch.key } });
  field('Outflow quantity').props.onChange({ target: { value: '1' } });
  for (const reason of ['complimentary', 'free_taste']) {
    field('Outflow reason').props.onChange({ target: { value: reason } });
    let requests = 0; ui.http.defaults.adapter = async () => { requests++; throw new Error('Must not submit'); };
    await elements(render(ui.InventoryOutflows), node => node.props.children === 'Record and deduct stock')[0].props.onClick();
    assert.equal(requests, 0);
    assert.match(toastErrors.at(-1)[0], /Expired stock/);
  }
});

const registrationDraft = () => ({ username: 'new-user', firstName: '', lastName: '', email: 'new@example.test', password: 'StrongPass!92', phoneNumber: '', address: '' });

for (const [field, apiField, label] of [
  ['username', 'username', 'Username'], ['firstName', 'first_name', 'First name'], ['lastName', 'last_name', 'Last name'],
]) {
  for (const length of [50, 51]) test(`registration ${field} enforces the ${length}-code-point boundary`, async () => {
    const input = { ...registrationDraft(), [field]: (field === 'username' ? 'a' : '😀').repeat(length) };
    const errors = ui.validateRegistration(input).errors;
    assert.equal(errors[apiField], length > 50 ? `${label} must be at most 50 characters.` : undefined);
    let requests = 0;
    ui.http.defaults.adapter = async config => { requests++; return { status: 201, config, headers: {}, data: {} }; };
    if (length > 50) await assert.rejects(ui.userService.createUser({ ...input, role: 'Staff' }), error =>
      error.status === 400 && error.fieldErrors[apiField][0] === errors[apiField]);
    else await ui.userService.createUser({ ...input, role: 'Staff' });
    assert.equal(requests, length > 50 ? 0 : 1);
  });
}

for (const length of [7, 8, 25, 26]) test(`registration password enforces the ${length}-code-point boundary`, async () => {
  const input = { ...registrationDraft(), password: '😀'.repeat(length) };
  const invalid = length < 8 || length > 25;
  assert.equal(ui.validateRegistration(input).errors.password, invalid ? 'Password must be between 8 and 25 characters.' : undefined);
  let requests = 0;
  ui.http.defaults.adapter = async config => { requests++; return { status: 201, config, headers: {}, data: {} }; };
  if (invalid) await assert.rejects(ui.userService.createUser({ ...input, role: 'Staff' }), error => error.status === 400 && !!error.fieldErrors.password);
  else await ui.userService.createUser({ ...input, role: 'Staff' });
  assert.equal(requests, invalid ? 0 : 1);
});

test('registration username normalization matches Python stripping and NFKC without changing names or passwords', async () => {
  const whitespaces = '\u0009\u000a\u000b\u000c\u000d\u001c\u001d\u001e\u001f \u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000';
  for (const space of whitespaces) assert.equal(ui.normalizeRegistrationUsername(`${space}Ａｄｍｉｎ${space}`), 'Admin');
  assert.equal(ui.normalizeRegistrationUsername('\ufeffAdmin\ufeff'), '\ufeffAdmin\ufeff');
  assert.equal(ui.validateRegistration({ ...registrationDraft(), username: '\ufeff' + 'a'.repeat(50) }).errors.username, 'Username must be at most 50 characters.');
  assert.equal(ui.validateRegistration({ ...registrationDraft(), username: '\u001c\u0085 ' }).errors.username, 'Username is required.');
  assert.equal(ui.validateRegistration({ ...registrationDraft(), username: '㍿'.repeat(12) }).errors.username, undefined);
  assert.equal(ui.validateRegistration({ ...registrationDraft(), username: '㍿'.repeat(13) }).errors.username, 'Username must be at most 50 characters.');
  assert.equal(ui.validateRegistration({ ...registrationDraft(), firstName: ' ' + 'a'.repeat(50) }).errors.first_name, 'First name must be at most 50 characters.');
  const input = { ...registrationDraft(), username: '\u001cＡｄｍｉｎ\u0085', firstName: ' First ', lastName: ' Last ', password: '  StrongPass!92  ', role: 'Staff' };
  const snapshot = structuredClone(input);
  let payload;
  ui.http.defaults.adapter = async config => { payload = JSON.parse(config.data); return { status: 201, config, headers: {}, data: {} }; };
  await ui.userService.createUser(input);
  assert.deepEqual(input, snapshot);
  assert.equal(payload.username, 'Admin'); assert.equal(payload.first_name, ' First '); assert.equal(payload.last_name, ' Last '); assert.equal(payload.password, '  StrongPass!92  ');
});

for (const role of ['Staff', 'Administrator']) {
  test(`Add User submits ${role} contact details and reloads them into Edit User without changing other fields`, async () => {
    ui.writeDataCache(`${ui.dataCacheEpoch()}:users:list`, [], ['users']);
    const draft = { ...registrationDraft(), firstName: 'Juan Miguel', lastName: 'Dela Cruz',
      password: '  StrongPass!92  ', phoneNumber: '09123456789', address: '  Barangay 1, Rosario  ' };
    const fixture = registrationFixture(draft);
    fixture.form().props.onRoleChange(role);
    let posted, stored, listRequests = 0;
    ui.http.defaults.adapter = async config => {
      if (config.method === 'post' && config.url === '/accounts/register/') {
        posted = JSON.parse(config.data);
        stored = { id: 8, username: posted.username, email: posted.email, role: posted.role,
          first_name: posted.first_name, last_name: posted.last_name, phone_number: posted.phone_number,
          address: posted.address, is_active: true, deactivation_reason: 'none', last_login: null };
        return { status: 201, config, headers: {}, data: { message: 'User registered successfully' } };
      }
      assert.equal(config.url, '/accounts/users/'); assert.equal(config.method, 'get');
      listRequests++;
      return { status: 200, config, headers: {}, data: stored ? [stored] : [] };
    };
    effects[0](); // Subscribe the real query to mutation invalidation and list refresh.
    fixture.submit(); await settle();
    assert.deepEqual(posted, { username: draft.username, email: draft.email, password: draft.password,
      role: role === 'Staff' ? 'staff' : 'admin', first_name: draft.firstName, last_name: draft.lastName,
      phone_number: draft.phoneNumber, address: draft.address });
    assert.ok(listRequests > 0, 'Successful registration fetches the updated user list');
    const page = render(ui.AdminUserManagement);
    assert.equal(elements(page, node => node.type === ui.Modal && node.props.title === 'Add User')[0].props.open, false);
    const table = elements(page, node => node.type === ui.EnhancedTable)[0];
    assert.equal(table.props.data.length, 1);
    const created = table.props.data[0];
    assert.equal(created.phone, draft.phoneNumber); assert.equal(created.address, draft.address);
    elements(table.props.columns.find(column => column.key === 'actions').render(created), node => node.props.label === 'Edit')[0].props.onClick();
    const edit = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Edit User')[0];
    assert.equal(edit.props.open, true);
    assert.equal(edit.props.children.props.form.phoneNumber, draft.phoneNumber);
    assert.equal(edit.props.children.props.form.address, draft.address);
    assert.equal(edit.props.children.props.role, role);
    assert.equal(toastErrors.length, 0);
  });
}

test('Add User submits blank optional phone/address as accepted blank strings', async () => {
  const fixture = registrationFixture(registrationDraft());
  let posted;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'post') posted = JSON.parse(config.data);
    return { status: config.method === 'post' ? 201 : 200, config, headers: {}, data: config.method === 'get' ? [] : {} };
  };
  fixture.submit(); await settle();
  assert.equal(posted.phone_number, ''); assert.equal(posted.address, '');
  assert.equal(toastErrors.length, 0);
});

test('registration service keeps optional contact fields optional for existing callers', async () => {
  let posted;
  ui.http.defaults.adapter = async config => { posted = JSON.parse(config.data); return { status: 201, config, headers: {}, data: {} }; };
  const input = registrationDraft(); delete input.phoneNumber; delete input.address;
  await ui.userService.createUser({ ...input, role: 'Staff' });
  assert.equal('phone_number' in posted, false); assert.equal('address' in posted, false);
  assert.equal(posted.username, input.username); assert.equal(posted.password, input.password);
});

test('registration contact validation errors preserve the Add User draft and existing retry flow', async () => {
  const draft = { ...registrationDraft(), phoneNumber: '09123456789', address: 'Rosario' };
  const fixture = registrationFixture(draft);
  let requests = 0;
  ui.http.defaults.adapter = async config => {
    requests++;
    throw new AxiosError('Bad Request', undefined, config, undefined, { status: 400, config, headers: {},
      data: { phone_number: ['Contact details were rejected.'] } });
  };
  fixture.submit(); await settle();
  const modal = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Add User')[0];
  assert.equal(modal.props.open, true); assert.equal(modal.props.busy, false);
  assert.deepEqual(modal.props.children.props.form, draft);
  assert.match(toastErrors.at(-1)[0], /Contact details were rejected/);
  fixture.submit(); await settle(); assert.equal(requests, 2, 'Validation failures release the submission lock for correction/retry');
});

function registrationFixture(draft) {
  authState.user = { id: 7, username: 'admin', email: 'admin@example.test', role: 'admin' };
  elements(render(ui.AdminUserManagement), node => node.type === ui.Btn && node.props.children === 'Add User')[0].props.onClick();
  const form = elements(render(ui.AdminUserManagement), node => node.type?.name === 'UserForm' && node.props.title === 'Add User')[0];
  form.props.onChange({ ...form.props.form, ...draft });
  return {
    form: () => elements(render(ui.AdminUserManagement), node => node.type?.name === 'UserForm' && node.props.title === 'Add User')[0],
    submit() {
      const modal = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Add User')[0];
      elements(modal.props.footer, node => node.type === ui.Btn && node.props.children === 'Add User')[0].props.onClick();
    },
  };
}

for (const patch of [{ username: 'a'.repeat(51) }, { username: '㍿'.repeat(13) }, { firstName: '😀'.repeat(51) }, { lastName: 'a'.repeat(51) }, { password: 'a'.repeat(7) }, { password: 'a'.repeat(26) }]) {
  test(`registration form shows validation before submission for ${Object.keys(patch)[0]} ${Array.from(Object.values(patch)[0]).length}`, async () => {
    let requests = 0;
    ui.http.defaults.adapter = async () => { requests++; throw new Error('Invalid registration must not reach the API'); };
    const form = registrationFixture({ ...registrationDraft(), ...patch });
    form.submit(); await settle();
    assert.equal(requests, 0);
    assert.match(toastErrors.at(-1)[0], /must be (?:at most 50|between 8 and 25) characters/);
  });
}

test('registration form accepts Unicode boundaries without native UTF-16 limits and forwards unchanged password spaces', async () => {
  const draft = { ...registrationDraft(), username: '\u001c' + 'Ａ'.repeat(50) + '\u0085', firstName: '😀'.repeat(50), lastName: 'é'.repeat(50), password: '  StrongPass!92  ' };
  const form = registrationFixture(draft);
  const component = form.form();
  const controls = elements(render(component.type, component.props), node => node.type === 'input');
  assert.equal(controls.find(node => node.props.placeholder === 'jdelacruz').props.maxLength, undefined);
  for (const placeholder of ['Juan', 'dela Cruz']) assert.equal(controls.find(node => node.props.placeholder === placeholder).props.maxLength, undefined);
  const password = controls.find(node => node.props.type === 'password');
  assert.equal(password.props.minLength, undefined); assert.equal(password.props.maxLength, undefined);
  let payload;
  ui.http.defaults.adapter = async config => {
    if (config.method === 'post') payload = JSON.parse(config.data);
    return { status: config.method === 'post' ? 201 : 200, config, headers: {}, data: config.method === 'get' ? [] : {} };
  };
  form.submit(); await settle();
  assert.equal(payload.username, 'A'.repeat(50)); assert.equal(payload.first_name, draft.firstName); assert.equal(payload.last_name, draft.lastName); assert.equal(payload.password, draft.password);
});

test('Add User uses the compact six-row desktop layout with associated labels and mobile stacking', () => {
  const fixture = registrationFixture(registrationDraft());
  const component = fixture.form();
  const tree = render(component.type, component.props);
  const ids = ['add-user-username', 'add-user-phone', 'add-user-first-name', 'add-user-last-name', 'add-user-email', 'add-user-address', 'add-user-password'];
  assert.deepEqual(elements(tree, node => node.type === 'input').map(node => node.props.id), ids);
  assert.deepEqual(elements(tree, node => node.type === 'label' && node.props.htmlFor).map(node => node.props.htmlFor), ids);
  assert.match(tree.props.className, /grid-cols-1 sm:grid-cols-2/);
  const cells = React.Children.toArray(tree.props.children).flatMap(child => child.props.className === 'contents' ? React.Children.toArray(child.props.children) : [child]);
  assert.equal(cells.length, 8);
  for (const cell of cells.slice(0, 4)) assert.ok(!cell.props.className?.includes('col-span-2'));
  for (const cell of cells.slice(4)) assert.match(cell.props.className, /sm:col-span-2/);
  assert.deepEqual(elements(cells.at(-1), node => node.type === 'button').map(node => node.props.children), ['Staff', 'Administrator']);
  const modal = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Add User')[0];
  assert.equal(modal.props.size, 'md');
  assert.deepEqual(elements(modal.props.footer, node => node.type === ui.Btn).map(node => node.props.children), ['Cancel', 'Add User']);
  assert.equal(typeof modal.props.onClose, 'function');
});

test('Add User password visibility toggles without changing its value and resets when reopened', () => {
  const draft = registrationDraft();
  const fixture = registrationFixture(draft);
  const body = () => { const form = fixture.form(); return render(form.type, form.props); };
  const password = () => elements(body(), node => node.props.id === 'add-user-password')[0];
  assert.equal(password().props.type, 'password');
  const toggle = elements(body(), node => node.props['aria-label'] === 'Show temporary password')[0];
  assert.equal(toggle.props.type, 'button'); assert.equal(toggle.props['aria-controls'], 'add-user-password');
  toggle.props.onClick();
  assert.equal(password().props.type, 'text'); assert.equal(password().props.value, draft.password);
  assert.equal(elements(body(), node => node.props['aria-label'] === 'Hide temporary password')[0].props['aria-pressed'], true);
  const modal = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Add User')[0];
  elements(modal.props.footer, node => node.props.children === 'Cancel')[0].props.onClick();
  elements(render(ui.AdminUserManagement), node => node.type === ui.Btn && node.props.children === 'Add User')[0].props.onClick();
  assert.equal(password().props.type, 'password');
});

test('Edit User matches Add User spacing and five-row layout without reserving a password row', () => {
  authState.user = { id: 7, username: 'admin', email: 'admin@example.com', role: 'admin' };
  const user = { id: 8, username: 'juan', name: 'Juan Miguel Dela Cruz', firstName: 'Juan Miguel', lastName: 'Dela Cruz',
    email: 'juan@example.test', phone: '09123456789', address: 'Rosario', role: 'Staff', status: 'Active', last: 'Never' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:users:list`, [user], ['users']);
  const table = elements(render(ui.AdminUserManagement), node => node.type === ui.EnhancedTable)[0];
  elements(table.props.columns.find(column => column.key === 'actions').render(user), node => node.props.label === 'Edit')[0].props.onClick();
  const page = render(ui.AdminUserManagement);
  const editModal = elements(page, node => node.type === ui.Modal && node.props.title === 'Edit User')[0];
  const addModal = elements(page, node => node.type === ui.Modal && node.props.title === 'Add User')[0];
  const resetModal = elements(page, node => node.type === ui.Modal && node.props.title === 'Reset Password')[0];
  assert.equal(editModal.props.open, true);
  assert.equal(editModal.props.size, addModal.props.size);
  assert.equal(editModal.props.size, 'md');
  assert.equal(editModal.props.subtitle, user.name);
  assert.deepEqual(elements(editModal.props.footer, node => node.type === ui.Btn).map(node => node.props.children), ['Cancel', 'Save Changes']);
  assert.deepEqual(elements(editModal.props.footer, node => node.type === ui.Btn).map(node => node.props.variant),
    elements(addModal.props.footer, node => node.type === ui.Btn).map(node => node.props.variant));
  const form = editModal.props.children;
  const tree = render(form.type, form.props);
  const addTree = render(addModal.props.children.type, addModal.props.children.props);
  assert.equal(tree.props.className, addTree.props.className);
  const cells = React.Children.toArray(tree.props.children).flatMap(child => child.props.className === 'contents' ? React.Children.toArray(child.props.children) : [child]);
  assert.equal(cells.length, 7, 'Two paired rows followed by Email, Address and Role; no password placeholder');
  assert.deepEqual(cells.map(cell => elements(cell, node => node.type === 'label')[0].props.children),
    [['Username', false], 'Phone Number', ['First Name', false], ['Last Name', false], 'Email', 'Address', 'Role']);
  for (const cell of cells.slice(0, 4)) assert.ok(!cell.props.className?.includes('col-span-2'));
  for (const cell of cells.slice(4)) assert.equal(cell.props.className, 'sm:col-span-2');
  const inputs = elements(tree, node => node.type === 'input');
  assert.deepEqual(inputs.map(node => node.props.value), [user.username, user.phone, user.firstName, user.lastName, user.email, user.address]);
  assert.ok(inputs.every(node => node.props.className === elements(addTree, element => element.type === 'input')[0].props.className));
  assert.ok(inputs.every(node => node.props.type !== 'password'));
  assert.equal(elements(tree, node => node.props['aria-controls'] === 'add-user-password').length, 0);
  assert.deepEqual(elements(cells.at(-1), node => node.type === 'button').map(node => node.props.children), ['Staff', 'Administrator']);
  assert.equal(resetModal.props.size, 'sm', 'Reset Password retains its original modal frame');
  assert.equal(elements(resetModal.props.children, node => node.type === 'input' && node.props.type === 'password').length, 1);
});

test('registration limits do not constrain existing account editing', async () => {
  authState.user = { id: 7, username: 'admin', email: 'admin@example.com', role: 'admin' };
  const user = { id: 8, username: 'a'.repeat(80), name: 'Long existing name', firstName: 'f'.repeat(80), lastName: 'l'.repeat(80), email: 'old@example.test', role: 'Staff', status: 'Active', last: 'Never', phone: '', address: '' };
  ui.writeDataCache(`${ui.dataCacheEpoch()}:users:list`, [user], ['users']);
  const table = elements(render(ui.AdminUserManagement), node => node.type === ui.EnhancedTable)[0];
  elements(table.props.columns.find(column => column.key === 'actions').render(user), node => node.props.label === 'Edit')[0].props.onClick();
  const form = elements(render(ui.AdminUserManagement), node => node.type?.name === 'UserForm' && node.props.title === 'Edit User')[0];
  const controls = elements(render(form.type, form.props), node => node.type === 'input');
  assert.equal(controls.find(node => node.props.placeholder === 'jdelacruz').props.maxLength, 150);
  assert.equal(controls.filter(node => node.props.type === 'password').length, 0);
  let payload;
  ui.http.defaults.adapter = async config => { if (config.method === 'patch') payload = JSON.parse(config.data); return { status: 200, config, headers: {}, data: config.method === 'get' ? [] : {} }; };
  const modal = elements(render(ui.AdminUserManagement), node => node.type === ui.Modal && node.props.title === 'Edit User')[0];
  elements(modal.props.footer, node => node.props.children === 'Save Changes')[0].props.onClick(); await settle();
  assert.equal(payload.username, user.username); assert.equal(payload.first_name, user.firstName); assert.equal(payload.last_name, user.lastName);
});
