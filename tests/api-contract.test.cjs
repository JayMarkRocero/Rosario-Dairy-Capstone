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

test('disabled alerts produce no notifications and skip orders', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    return { data: config.url === '/settings/' ? { notifications: { new_order_alerts: false } } : [], status: 200, headers: {}, config };
  };
  assert.deepEqual(await api.notificationsService.getAll(), []);
  assert.equal(calls.length, 5);
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

test('revenue chart maps Django daily totals and weekly/monthly breakdowns', () => {
  assert.deepEqual(api.normalizeRevenueChart({ date: '2026-09-15', total_revenue: '42.50', items: [{ total_revenue: '99' }] }, 'daily'), [{ n: '2026-09-15', rev: 42.5 }]);
  assert.deepEqual(api.normalizeRevenueChart({ daily_breakdown: [{ date: '2026-09-15', revenue: '0.00' }, { date: '2026-09-14', revenue: '20.00' }] }, 'weekly'), [{ n: '2026-09-14', rev: 20 }, { n: '2026-09-15', rev: 0 }]);
  assert.deepEqual(api.normalizeRevenueChart({ weekly_breakdown: [{ week_start: '2026-09-07', week_end: '2026-09-13', revenue: '125.50' }] }, 'monthly'), [{ n: '2026-09-07', rev: 125.5 }]);
  assert.deepEqual(api.normalizeRevenueChart(null, 'daily'), []);
});

test('category patch excludes read-only activation even from untyped callers', async () => {
  await api.inventoryService.updateCategory(1, { name: 'Dairy', is_active: false });
  assert.deepEqual(JSON.parse(calls[0].data), { name: 'Dairy' });
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
