const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');

// Compile the real services in memory; no server or emitted build files required.
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { default as http } from './src/lib/api';
    export * from './src/lib/api';
    export * from './src/hooks/useAutoPageSize';
    export * from './src/features/pos/api/checkout.service';
    export * from './src/features/orders/api/orders.service';
    export * from './src/features/sales/api/sales.service';
    export * from './src/features/inventory/utils/expiry';
    export * from './src/features/auth/api/auth.service';
    export * from './src/features/settings/api/settings.service';
    export * from './src/features/inventory/api/inventory.service';
    export * from './src/features/reports/api/reports.service';
    export * from './src/lib/notifications.service';
    export * from './src/features/dashboard/components/admin/RevenueChart';
    export * from './src/features/dashboard/components/admin/ForecastChart';
    export * from './src/features/reports/utils/revenueWindow';
    export * from './src/features/users/api/user.service';
    export * from './src/features/users/types/user';
    export * from './src/features/sales/utils/receiptDetails';
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const servicesModule = new Module(path.join(root, 'tests', 'services.cjs'), module);
servicesModule.filename = path.join(root, 'tests', 'services.cjs');
servicesModule.paths = module.paths;
servicesModule._compile(compiled, servicesModule.filename);
const api = servicesModule.exports;
let calls;
let responseData;
let responseStatus;
beforeEach(() => {
  const storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
  calls = [];
  responseData = {};
  responseStatus = 200;
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const response = { data: responseData, status: responseStatus, statusText: '', headers: {}, config };
    if (responseStatus >= 400) throw new AxiosError('Request failed', undefined, config, undefined, response);
    return response;
  };
});

test('protected calls use bearer tokens; login uses exact credentials and returns both tokens', async () => {
  api.setAccessToken('access');
  api.setRefreshToken('refresh');
  await api.authService.getCurrentUser();
  assert.equal(calls[0].headers.Authorization, 'Bearer access');
  responseData = { access: 'new-access', refresh: 'new-refresh' };
  assert.deepEqual(await api.authService.login({ username: 'staff', password: 'secret' }), responseData);
  assert.equal(calls[1].url, '/accounts/login/');
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].data), { username: 'staff', password: 'secret' });
  assert.equal(api.getRefreshToken(), 'refresh');
});

test('logout sends refresh_token and retains captured authorization after local cleanup', async () => {
  api.setAccessToken('access');
  const pending = api.authService.logout('refresh');
  api.setAccessToken(null);
  api.setRefreshToken(null);
  await pending;
  assert.equal(calls[0].url, '/accounts/logout/');
  assert.equal(calls[0].headers.Authorization, 'Bearer access');
  assert.deepEqual(JSON.parse(calls[0].data), { refresh_token: 'refresh' });
  assert.equal(api.getAccessToken(), null);
  assert.equal(api.getRefreshToken(), null);
});

test('login 401 detail and throttle errors are preserved without session expiration', async () => {
  let expired = false;
  const remove = api.onUnauthorized(() => { expired = true; });
  try {
    responseStatus = 401;
    responseData = { detail: 'Invalid credentials.' };
    await assert.rejects(api.authService.login({ username: 'staff', password: 'bad' }), { status: 401, message: 'Invalid credentials.' });
    responseStatus = 429;
    responseData = {};
    await assert.rejects(api.authService.login({ username: 'staff', password: 'bad' }), { status: 429, message: 'Too many attempts. Please wait before trying again.' });
    assert.equal(expired, false);
  } finally { remove(); }
});

test('protected 401 clears both tokens and notifies auth state', async () => {
  api.setAccessToken('access');
  api.setRefreshToken('refresh');
  let expired = false;
  const remove = api.onUnauthorized(() => { expired = true; });
  try {
    responseStatus = 401;
    await assert.rejects(api.settingsService.get(), { status: 401 });
    assert.equal(api.getAccessToken(), null);
    assert.equal(api.getRefreshToken(), null);
    assert.equal(expired, true);
  } finally { remove(); }
});

test('OTP requests and resets preserve leading zeroes and reject invalid codes', async () => {
  const identity = { username: 'staff', email: 'staff@example.com' };
  await api.authService.requestPasswordOTP(identity);
  assert.equal(calls[0].url, '/accounts/forgot-password/');
  assert.deepEqual(JSON.parse(calls[0].data), identity);
  for (const otp of ['12345', '1234567', 'abcdef', ' 12345']) {
    await assert.rejects(api.authService.resetPassword({ ...identity, otp, new_password: 'secret' }), { status: 400 });
  }
  assert.equal(calls.length, 1);
  const payload = { ...identity, otp: '012345', new_password: 'secret' };
  await api.authService.resetPassword(payload);
  assert.equal(calls[1].url, '/accounts/reset-password/');
  assert.deepEqual(JSON.parse(calls[1].data), payload);
  responseStatus = 400;
  responseData = { error: 'Invalid or expired code.' };
  await assert.rejects(api.authService.resetPassword(payload), { message: 'Invalid or expired code.' });
});

test('settings PATCH sends only supplied fields and retains field validation', async () => {
  await api.settingsService.updateSystem({ business_name: 'Dairy' });
  assert.equal(calls[0].method, 'patch');
  assert.equal(calls[0].url, '/settings/system/');
  assert.deepEqual(JSON.parse(calls[0].data), { business_name: 'Dairy' });
  let refreshed = false;
  window.addEventListener(api.SETTINGS_UPDATED, () => { refreshed = true; });
  await api.settingsService.updateNotifications({ low_stock_alerts: false });
  assert.equal(calls[1].url, '/settings/notifications/');
  assert.deepEqual(JSON.parse(calls[1].data), { low_stock_alerts: false });
  assert.equal(refreshed, true);
  responseStatus = 400;
  responseData = { business_email: ['Enter a valid email address.'] };
  await assert.rejects(api.settingsService.updateSystem({ business_email: 'bad' }), error => {
    assert.deepEqual(error.fieldErrors, responseData);
    return true;
  });
});

test('all inventory alert endpoints accept empty arrays with no inventory fallback', async () => {
  responseData = [];
  for (const method of ['getLowStockProducts', 'getLowStockIngredients', 'getExpiringProducts', 'getExpiringIngredients', 'getLowStock', 'getNearExpiry']) {
    assert.deepEqual(await api.inventoryService[method](), []);
  }
  assert.deepEqual(calls.slice(0, 4).map(call => call.url), [
    '/inventory/low-stock/products/', '/inventory/low-stock/ingredients/',
    '/inventory/expiring/products/', '/inventory/expiring/ingredients/',
  ]);
  assert.equal(calls.length, 6);
});

test('notification feed trusts backend unread and dismissed state without reconstructing alerts', async () => {
  responseData = [{ id: 'low-stock-products', revision: 'a'.repeat(64), unread: false, dismissed: true }];
  assert.deepEqual(await api.notificationsService.getAll(), responseData);
  assert.equal(calls[0].url, '/settings/inbox/');
  responseData = [];
  assert.deepEqual(await api.notificationsService.getAll(), []);
  assert.equal(calls.length, 2);
});

test('notification actions send only stable references and support read, dismiss and restore', async () => {
  const item = { id: 'expiry-product-1', revision: 'b'.repeat(64), body: 'Private alert text', unread: true };
  for (const action of ['read', 'dismiss', 'restore']) {
    await api.notificationsService.update(action, [item]);
    assert.equal(calls.at(-1).url, '/settings/inbox/');
    assert.equal(calls.at(-1).method, 'post');
    assert.deepEqual(JSON.parse(calls.at(-1).data), { action, notifications: [{ id: item.id, revision: item.revision }] });
  }
  await api.notificationsService.update('read', []);
  assert.equal(calls.length, 3);
});

test('notification save failures remain errors instead of pretending an alert was acknowledged', async () => {
  responseStatus = 409; responseData = { detail: 'Alert changed. Refresh and try again.' };
  await assert.rejects(api.notificationsService.update('read', [{ id: 'low-stock-products', revision: 'c'.repeat(64) }]), { status: 409, message: responseData.detail });
});


test('PDF download requests a blob and converts JSON blob errors to useful messages', async () => {
  responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  let clicked = false;
  let removed = false;
  const link = { click: () => { clicked = true; }, remove: () => { removed = true; } };
  global.document = { createElement: () => link, body: { appendChild: () => {} } };
  await api.reportsService.downloadReportPDF('daily_sales');
  assert.equal(calls[0].url, '/api/reports/export-pdf/');
  assert.equal(calls[0].responseType, 'blob');
  assert.equal(clicked && removed, true);
  assert.match(link.download, /^daily_sales-.*\.pdf$/);
  responseStatus = 400;
  responseData = new Blob([JSON.stringify({ error: 'Report unavailable.' })], { type: 'application/json' });
  await assert.rejects(api.reportsService.downloadReportPDF('daily_sales'), { message: 'Report unavailable.' });
});

test('forecast periods request separate evaluations and explain withheld estimates', async () => {
  await api.reportsService.fetchReportPreview('sarima_forecast', 'weekly');
  assert.deepEqual(calls[0].params, { type: 'sarima_forecast', period: 'weekly' });
  assert.match(api.forecastExplanation({ status: 'rejected', accuracy_target_percent: 30, metrics: { combined: { rows: 12, wape_percent: 35.8 } } }), /35\.8%.*30%/);
  assert.match(api.forecastExplanation({ status: 'insufficient_evaluation', metrics: { combined: { rows: 4 } } }), /only 4 complete periods/);
  assert.match(api.forecastExplanation({ status: 'pending_update' }), /offline evaluation/);
});


test('checkout sends decimal strings and refreshes reports after committing', async () => {
  responseData = { id: 7, subtotal: '43.00', total_amount: '43.00', change_due: '7.00' };
  const result = await api.checkoutService.submit({ customerId: null, items: [{ productId: 1, quantity: 2.5 }], paymentMethod: 'Cash', discountType: 'fixed', discountValue: 1.5, amountTendered: 50 });
  assert.deepEqual(JSON.parse(calls[0].data), { customer_id: null, items: [{ product_id: 1, quantity: '2.5' }], payment_method: 'cash', discount_type: 'fixed', discount_value: '1.5', amount_tendered: '50' });
  assert.equal(calls[1].url, '/api/reports/refresh/');
  assert.equal(result.totalAmount, 43);
  assert.equal(result.changeDue, 7);
});

test('a report refresh failure never rejects an already completed checkout', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/api/reports/refresh/') throw new AxiosError('Offline');
    return { data: { id: 7, subtotal: '43', total_amount: '43', change_due: null }, status: 200, config, headers: {} };
  };
  const result = await api.checkoutService.submit({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'GCash', discountType: 'none', discountValue: 0 });
  assert.equal(result.id, 7);
  assert.equal(JSON.parse(calls[0].data).amount_tendered, '0');
});

test('order creation rejects missing customers and refreshes only after a successful save', async () => {
  await assert.rejects(api.ordersService.createOrder({ customer_id: 0, items: [] }), { status: 400 });
  assert.equal(calls.length, 0);
  await api.ordersService.createOrder({ customer_id: 3, items: [{ product_id: 2, quantity: 1.5 }] });
  assert.equal(calls[0].url, '/sales/orders/');
  assert.equal(JSON.parse(calls[0].data).items[0].quantity, '1.5');
  assert.equal(calls[1].url, '/api/reports/refresh/');
});

test('paginated transaction history includes all pages with numeric totals', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    return { data: { count: 2, results: [{ id: config.params.page, total_amount: '43.00', created_at: '2026-09-10T10:00:00Z', handled_by: { username: 'staff' }, payment_method: 'cash' }] }, status: 200, config, headers: {} };
  };
  const sales = await api.salesService.getAll({ startDate: '2026-09-01' });
  assert.equal(sales.length, 2);
  assert.equal(sales[1].total, 43);
  assert.deepEqual(calls.map(call => call.params.page), [1, 2]);
  assert.equal(calls[1].params.start_date, '2026-09-01');
});

test('concurrent unauthorized calls share a refresh and retry with the new bearer token', async () => {
  api.setAccessToken('old'); api.setRefreshToken('refresh');
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const response = { status: 200, data: {}, config, headers: {} };
    if (config.url === '/accounts/refresh/') return { ...response, data: { access: 'new', refresh: 'rotated' } };
    if (config.headers.Authorization === 'Bearer old') throw new AxiosError('Expired', undefined, config, undefined, { ...response, status: 401 });
    assert.equal(config.headers.Authorization, 'Bearer new');
    return response;
  };
  await Promise.all([api.authService.getCurrentUser(), api.settingsService.get()]);
  assert.equal(calls.filter(call => call.url === '/accounts/refresh/').length, 1);
  assert.equal(api.getAccessToken(), 'new');
  assert.equal(api.getRefreshToken(), 'rotated');
});

test('expiry validation uses calendar dates, preserves today and rejects invalid dates', () => {
  const now = new Date(2026, 8, 10, 18);
  assert.equal(api.isExpiredProduct({ expiry: '2026-09-10' }, now), false);
  assert.equal(api.isExpiredProduct({ expiry_date: '2026-09-09' }, now), true);
  assert.equal(api.isExpiredProduct({ status: 'Expired', expiry: '2026-09-11' }, now), true);
  assert.equal(api.isExpiredProduct({ expiry: 'invalid' }, now), true);
});

test('backend detail, error and message responses remain explicit', async () => {
  responseStatus = 400;
  for (const key of ['detail', 'error', 'message']) {
    responseData = { [key]: 'Expired batch stock.' };
    await assert.rejects(api.http.post('/sales/checkout/', {}), { message: 'Expired batch stock.' });
  }
});


test('auto-pagination subtracts measured chrome and floors partial rows', () => {
  assert.equal(api.calculatePageSize(600, 40, 40, 52), 10);
  assert.equal(api.calculatePageSize(599, 40, 40, 52), 9);
  assert.equal(api.calculatePageSize(352, 40, 0, 52), 6);
  assert.equal(api.calculatePageSize(351, 40, 0, 52), 5);
  assert.equal(api.calculatePageSize(0, 40, 40, 52), 3);
  assert.equal(api.calculatePageSize(320, 40, 0, 56), 5);
});

test('nested low-stock rows are unwrapped for products and ingredients', async () => {
  responseData = [{ product: { id: 1, name: 'Milk', category: { name: 'Dairy' }, unit_price: '20.00' }, remaining_quantity: '2.50' }];
  assert.deepEqual(await api.inventoryService.getLowStock(), [{ id: 1, name: 'Milk', cat: 'Dairy', price: 20, stock: 2.5, expiry: '', low: true }]);
  responseData = [{ ingredient: { id: 2, name: 'Raw milk' }, remaining_quantity: '3.25' }];
  assert.deepEqual(await api.inventoryService.getLowStockIngredients(), [{ id: 2, name: 'Raw milk', total_stock: '3.25' }]);
});

test('revenue windows show seven days, seven Monday weeks and five months', () => {
  const daily = api.revenueWindow('daily', 0, '2026-09-30');
  assert.equal(daily.buckets.length, 7);
  assert.deepEqual([daily.start, daily.end], ['2026-09-24', '2026-09-30']);
  const weekly = api.revenueWindow('weekly', 0, '2026-09-30');
  assert.equal(weekly.buckets.length, 7);
  assert.deepEqual([weekly.start, weekly.end, weekly.buckets.at(-1)], ['2026-08-17', '2026-09-30', '2026-09-28']);
  const monthly = api.revenueWindow('monthly', 0, '2026-09-30');
  assert.deepEqual(monthly.buckets, ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01']);
  assert.equal(monthly.end, '2026-09-30');
});

test('revenue navigation has contiguous windows across leap days and year boundaries', () => {
  assert.deepEqual(api.revenueWindow('daily', -1, '2026-01-03'), {
    start: '2025-12-21', end: '2025-12-27', buckets: ['2025-12-21','2025-12-22','2025-12-23','2025-12-24','2025-12-25','2025-12-26','2025-12-27'],
  });
  const previousWeeks = api.revenueWindow('weekly', -1, '2026-09-30');
  assert.deepEqual([previousWeeks.start, previousWeeks.end], ['2026-06-29', '2026-08-16']);
  const previousMonths = api.revenueWindow('monthly', -1, '2026-09-30');
  assert.deepEqual([previousMonths.start, previousMonths.end], ['2025-12-01', '2026-04-30']);
  assert.equal(api.revenueWindow('monthly', -1, '2024-07-31').end, '2024-02-29');
  assert.equal(api.revenueWindow('weekly', 0, '2026-09-28').buckets.at(-1), '2026-09-28');
  assert.equal(api.revenueBusinessDate(new Date('2026-09-30T16:30:00Z')), '2026-10-01');
});

test('revenue buckets retain zero-sales periods and normalize Django datetime buckets', () => {
  const window = api.revenueWindow('monthly', 0, '2026-09-30');
  const series = api.revenueSeries([{ date: '2026-05-01T00:00:00+08:00', rev: '125.50' }, { date: '2026-09-01T00:00:00+08:00', rev: 80 }], window);
  assert.deepEqual(series.map(r => r.rev), [125.5, 0, 0, 0, 80]);
  assert.equal(api.revenueSeries([], api.revenueWindow('daily', 0, '2026-09-30')).length, 7);
});

test('revenue requests use matching aggregation and explicit date boundaries', async () => {
  responseData = [{ date: '2026-08-17T00:00:00+08:00', rev: 400 }];
  const result = await api.reportsService.getRevenue('weekly', '2026-08-17', '2026-09-30');
  assert.equal(calls[0].url, '/sales/reports/revenue/');
  assert.deepEqual(calls[0].params, { period: 'weekly', start_date: '2026-08-17', end_date: '2026-09-30' });
  assert.deepEqual(result, responseData);
});


test('category patch excludes read-only activation even from untyped callers', async () => {
  await api.inventoryService.updateCategory(1, { name: 'Dairy', icon: 'Milk', is_active: false });
  assert.deepEqual(JSON.parse(calls[0].data), { name: 'Dairy', icon: 'Milk' });
});

test('category create includes the selected icon', async () => {
  await api.inventoryService.createCategory({ name: 'Treats', icon: 'Cookie', is_visible_to_staff: true });
  assert.deepEqual(JSON.parse(calls[0].data), {
    name: 'Treats', description: '', icon: 'Cookie', is_visible_to_staff: true,
  });
});

test('category list falls back to Package for missing or invalid imported icons', async () => {
  api.http.defaults.adapter = async config => ({
    status: 200, statusText: '', headers: {}, config,
    data: config.url === '/inventory/categories/' ? [
      { id: 1, name: 'No icon', is_active: true, is_visible_to_staff: true },
      { id: 2, name: 'Bad icon', icon: 'UnknownIcon', is_active: true, is_visible_to_staff: true },
      { id: 3, name: 'Cheese', icon: 'Cheese', is_active: true, is_visible_to_staff: true },
    ] : [],
  });
  const categories = await api.inventoryService.getCategories();
  assert.deepEqual(Object.fromEntries(categories.map(category => [category.name, category.icon])), {
    'Bad icon': 'Package', Cheese: 'Cheese', 'No icon': 'Package',
  });
});

test('expired logout refreshes captured credentials and blacklists without restoring storage', async () => {
  api.setAccessToken('expired'); api.setRefreshToken('refresh');
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const response = { status: 200, data: {}, config, headers: {} };
    if (config.url === '/accounts/refresh/') {
      assert.equal(config.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(config.data), { refresh: 'refresh' });
      return { ...response, data: { access: 'renewed', refresh: 'rotated' } };
    }
    if (config.headers.Authorization === 'Bearer expired') throw new AxiosError('Expired', undefined, config, undefined, { ...response, status: 401 });
    assert.equal(config.headers.Authorization, 'Bearer renewed');
    assert.deepEqual(JSON.parse(config.data), { refresh_token: 'rotated' });
    return response;
  };
  const pending = api.authService.logout('refresh');
  api.setAccessToken(null); api.setRefreshToken(null);
  await pending;
  assert.deepEqual(calls.map(call => call.url), ['/accounts/logout/', '/accounts/refresh/', '/accounts/logout/']);
  assert.equal(api.getAccessToken(), null);
  assert.equal(api.getRefreshToken(), null);
});

test('deactivation sends only Django reason values and rejects legacy on_leave', async () => {
  assert.deepEqual(api.DEACTIVATION_OPTIONS.map(option => option.value), ['leave', 'suspended', 'resigned', 'terminated']);
  assert.equal(api.DEACTIVATION_OPTIONS[0].label, 'On Leave');
  for (const reason of ['leave', 'suspended', 'resigned', 'terminated']) {
    await api.userService.deactivateUser(7, reason);
    assert.equal(calls.at(-1).method, 'delete');
    assert.equal(calls.at(-1).url, '/accounts/users/7/');
    assert.deepEqual(JSON.parse(calls.at(-1).data), { reason });
  }
  await assert.rejects(api.userService.deactivateUser(7, 'on_leave'), { status: 400 });
  assert.equal(calls.length, 4);
});

test('reactivation patches a boolean active flag for every inactive reason', async () => {
  await api.userService.reactivateUser(7);
  assert.equal(calls[0].method, 'patch');
  assert.equal(calls[0].url, '/accounts/users/7/');
  assert.deepEqual(JSON.parse(calls[0].data), { is_active: true });
  for (const reason of ['none', 'leave', 'suspended', 'resigned', 'terminated']) {
    assert.equal(api.canReactivateUser({ status: 'Inactive', deactivationReason: reason }), true);
    assert.equal(api.canReactivateUser({ status: 'Active', deactivationReason: reason }), false);
  }
  responseStatus = 400;
  responseData = { error: 'Unable to reactivate user.' };
  await assert.rejects(api.userService.reactivateUser(7), { status: 400, message: responseData.error });
});

test('user list retains inactive account reasons for recovery eligibility', async () => {
  responseData = [{ id: 7, username: 'staff', first_name: 'Test', last_name: 'User', email: 'staff@example.com', role: 'staff', is_active: false, deactivation_reason: 'leave', last_login: null }];
  const [user] = await api.userService.getAll();
  assert.equal(user.status, 'Inactive');
  assert.equal(user.deactivationReason, 'leave');
  assert.equal(api.canReactivateUser(user), true);
});

test('default user sorting groups active accounts and compares raw login instants', () => {
  const rows = [
    { id: 1, status: 'Inactive', lastLogin: '2026-09-15T12:00:00Z' },
    { id: 2, status: 'Active', lastLogin: null },
    { id: 3, status: 'Active', lastLogin: '2026-09-15T09:00:00+08:00' },
    { id: 4, status: 'Active', lastLogin: '2026-09-15T02:00:00Z' },
    { id: 5, status: 'Inactive' },
  ];
  assert.deepEqual([...rows].sort(api.compareUsersByStatusAndLogin).map(row => row.id), [4, 3, 2, 1, 5]);
  assert.deepEqual(rows.filter(row => row.status === 'Inactive').sort(api.compareUsersByStatusAndLogin).map(row => row.id), [1, 5]);
  assert.equal(api.userLastLoginTimestamp({ lastLogin: 'invalid' }), null);
  assert.equal(api.userLastLoginTimestamp({}), null);
});

function receiptFixture(payment = 'cash', itemCount = 1) {
  return {
    receipt: 'TXN-000007', customer: payment === 'cash' ? 'Walk-in' : 'Customer', cashier: 'staff', payment: payment === 'cash' ? 'Cash' : 'Online', total: 25,
    transaction: { id: 7, created_at: '2026-09-15T01:00:00Z', payment_method: payment, subtotal: '30.00', discount_amount: '5.00', total_amount: '25.00', amount_tendered: '30.00', change_due: '5.00', delivery_status: null,
      items: Array.from({ length: itemCount }, (_, id) => ({ id, quantity: '1.50', unit_price: '20.00', product_batch: { batch_number: 'PRD-0001', product: { name: 'Fresh Milk', variant: '1 L' } } })) },
  };
}

test('receipt details preserve itemized API values without inventing order metadata', () => {
  const receipt = api.receiptDetails(receiptFixture());
  assert.equal(receipt.title, 'Official Sales Receipt');
  assert.equal(receipt.items[0].subtotal, 'PHP 30.00');
  assert.deepEqual(receipt.totals.at(-1), ['Change', 'PHP 5.00']);
  const voucher = api.receiptDetails(receiptFixture('online'));
  assert.equal(voucher.title, 'Sales Invoice & Fulfillment Voucher');
  for (const label of ['Order #', 'Fulfillment Type', 'Payment Status']) assert.equal(voucher.fields.find(field => field[0] === label)[1], 'Not provided');
  assert.equal(api.receiptMoney(null), 'Not provided');
  assert.equal(api.receiptMoney('0'), 'PHP 0.00');
});

test('staff history scopes every page by JWT user ID and rejects other cashiers', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`);
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const response = { status: 200, config, headers: {} };
    if (config.url === '/accounts/user/') return { ...response, data: { username: 'staff', role: 'staff' } };
    assert.equal(config.params.handled_by, 7);
    const own = config.params.page === 2;
    return { ...response, data: { count: 2, next: own ? null : 'next', results: [{ id: config.params.page, handled_by: { id: own ? 7 : 8, username: 'staff' }, created_at: '2026-09-15T00:00:00Z', total_amount: '20', payment_method: 'cash' }] } };
  };
  const sales = await api.salesService.getMine();
  assert.equal(sales.length, 1);
  assert.equal(sales[0].transaction.handled_by.id, 7);
  assert.deepEqual(calls.filter(call => call.url === '/sales/transactions/').map(call => call.params.page), [1, 2]);
});

test('staff history never issues an unscoped query when user ID is missing', async () => {
  api.setAccessToken(`header.${Buffer.from('{}').toString('base64url')}.signature`);
  responseData = { username: 'staff', role: 'staff' };
  await assert.rejects(api.salesService.getMine(), { status: 401 });
  assert.deepEqual(calls.map(call => call.url), ['/accounts/user/']);
});

test('POS catalog retains variants so different package sizes can be distinguished', async () => {
  api.http.defaults.adapter = async config => ({
    status: 200, config, headers: {}, data: config.url === '/inventory/products/'
      ? [
        { id: 1, name: 'Fresh Milk', variant: '1000ml', is_active: true, category: { name: 'Milk' }, unit_price: '138.00', total_stock: '20', low_stock_threshold: 10 },
        { id: 2, name: 'Fresh Milk', variant: '300ml', is_active: true, category: { name: 'Milk' }, unit_price: '45.00', total_stock: '30', low_stock_threshold: 10 },
      ] : [],
  });
  const products = await api.inventoryService.getAll();
  assert.deepEqual(products.map(p => p.name), ['Fresh Milk 1000ml', 'Fresh Milk 300ml']);
  assert.deepEqual(products.map(p => p.price), [138, 45]);
});
