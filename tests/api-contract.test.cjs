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
    export * from './src/lib/dataCache';
    export * from './src/lib/saleSubmission';
    export * from './src/hooks/useAutoPageSize';
    export * from './src/features/pos/api/checkout.service';
    export * from './src/features/sales/utils/manualPricing';
    export * from './src/features/sales/api/encoding.service';
    export * from './src/features/inventory/api/outflows.service';
    export * from './src/features/customers/api/customers.service';
    export * from './src/features/orders/api/orders.service';
    export * from './src/features/sales/api/sales.service';
    export * from './src/features/inventory/utils/expiry';
    export * from './src/features/inventory/utils/stock';
    export * from './src/features/inventory/utils/warnings';
    export * from './src/features/auth/api/auth.service';
    export * from './src/features/settings/api/settings.service';
    export * from './src/features/settings/utils/inventorySettings';
    export * from './src/features/inventory/api/inventory.service';
    export * from './src/features/reports/api/reports.service';
    export * from './src/features/reports/utils/reportDateRange';
    export * from './src/lib/notifications.service';
    export * from './src/features/dashboard/components/admin/RevenueChart';
    export * from './src/features/dashboard/components/admin/ForecastChart';
    export * from './src/features/dashboard/api/forecasting.service';
    export { forecastSeries, forecastMetric, forecastDisplayRange, forecastAmount } from './src/features/dashboard/utils/forecast';
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
  api.clearDataCache();
  const storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
  calls = [];
  responseData = {};
  responseStatus = 200;
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const data = config.method === 'get' && config.url === '/settings/notifications/' ? { near_expiry_alerts: true } : responseData;
    const response = { data, status: responseStatus, statusText: '', headers: {}, config };
    if (responseStatus >= 400) throw new AxiosError('Request failed', undefined, config, undefined, response);
    return response;
  };
});

test('the shared client defaults to a 15-second timeout while preserving request overrides and cancellation', async () => {
  await api.authService.getCurrentUser();
  assert.equal(calls[0].timeout, 15_000);
  const controller = new AbortController();
  await api.http.get('/accounts/user/', { timeout: 30_000, signal: controller.signal });
  assert.equal(calls[1].timeout, 30_000);
  assert.equal(calls[1].signal, controller.signal);
  assert.equal(controller.signal.aborted, false);
});

test('the native timeout aborts an unresponsive request without expiring the session', async () => {
  const { createServer } = require('node:http');
  const { getAdapter } = require('axios');
  const server = createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  api.setAccessToken('access'); api.setRefreshToken('refresh');
  let expired = false;
  const remove = api.onUnauthorized(() => { expired = true; });
  try {
    await assert.rejects(api.http.get(`http://127.0.0.1:${server.address().port}/slow/`, {
      adapter: getAdapter('http'), timeout: 50, proxy: false,
    }), error => {
      assert.ok(['ECONNABORTED', 'ETIMEDOUT'].includes(error.code));
      assert.match(api.getApiErrorMessage(error), /request timed out/);
      return true;
    });
    assert.equal(api.getAccessToken(), 'access');
    assert.equal(api.getRefreshToken(), 'refresh');
    assert.equal(expired, false);
  } finally {
    remove();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('a token refresh timeout preserves credentials and exposes a retryable error', async () => {
  api.setAccessToken('old'); api.setRefreshToken('refresh');
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/accounts/refresh/') throw new AxiosError('timeout', AxiosError.ETIMEDOUT, config);
    throw new AxiosError('Expired', undefined, config, undefined, { status: 401, data: {}, config });
  };
  await assert.rejects(api.authService.getCurrentUser(), error => {
    assert.match(api.getApiErrorMessage(error), /request timed out/);
    return true;
  });
  assert.deepEqual(calls.map(call => call.url), ['/accounts/user/', '/accounts/refresh/']);
  assert.ok(calls.every(call => call.timeout === 15_000));
  assert.equal(api.getAccessToken(), 'old');
  assert.equal(api.getRefreshToken(), 'refresh');
});

test('profile username changes send current_password and email verification uses POST then PATCH', async () => {
  responseData = { username: 'new-name', email: 'old@example.com', role: 'staff' };
  assert.deepEqual(await api.userService.updateCurrentUser({ username: 'new-name', current_password: ' current password ', first_name: 'New' }), responseData);
  assert.equal(calls[0].url, '/accounts/user/');
  assert.equal(calls[0].method, 'patch');
  assert.deepEqual(JSON.parse(calls[0].data), { username: 'new-name', current_password: ' current password ', first_name: 'New' });
  const credentials = { email: 'new@example.com', current_password: ' current password ' };
  await api.authService.requestEmailChange(credentials);
  await api.authService.confirmEmailChange({ ...credentials, otp: '012345' });
  assert.deepEqual(calls.slice(1).map(call => [call.method, call.url]), [['post', '/accounts/email-change/'], ['patch', '/accounts/email-change/']]);
  assert.deepEqual(JSON.parse(calls[1].data), credentials);
  assert.deepEqual(JSON.parse(calls[2].data), { ...credentials, otp: '012345' });
  await assert.rejects(api.authService.confirmEmailChange({ ...credentials, otp: '12345' }), { status: 400 });
  assert.equal(calls.length, 3);
  responseStatus = 400; responseData = { detail: ['Invalid or expired verification code.'] };
  await assert.rejects(api.authService.confirmEmailChange({ ...credentials, otp: '000000' }), { status: 400, message: 'Invalid or expired verification code.' });
});

test('orders map compact nested and flat product names without requiring a product variant', async () => {
  const base = { id: 1, customer: { id: 1, name: 'Customer' }, handled_by: { id: 7, username: 'staff' }, status: 'fulfilled', created_at: '2026-10-18T10:00:00+08:00',
    transaction: { id: 1, subtotal: '10.00', discount_amount: '0.00', total_amount: '10.00', payment_method: 'cash', amount_tendered: '10.00', change_due: '0.00' } };
  const amount = { id: 1, quantity: '2.00', unit_price: '5.00', subtotal: '10.00' };
  for (const [line, name] of [
    [{ ...amount, product: { id: 3, name: 'Milk' } }, 'Milk'],
    [{ ...amount, product: { id: 3, name: 'Milk', variant: '1 liter' } }, 'Milk 1 liter'],
    [{ ...amount, product_id: 3, product_name: 'Milk' }, 'Milk'],
    [{ ...amount, product: null, product_id: 3, product_name: 'Milk' }, 'Milk'],
    [{ ...amount, product: { id: 3, name: '' }, product_name: 'Milk' }, 'Milk'],
    [{ ...amount, product_id: 3 }, 'Product #3'],
  ]) {
    responseData = { count: 1, next: null, results: [{ ...base, items: [line] }] };
    const [order] = await api.ordersService.getAll();
    assert.equal(order.staffId, 7);
    assert.deepEqual(order.items, [{ product: name, quantity: 2, unitPrice: 5, subtotal: 10, netAmount: null }]);
    assert.equal((await api.ordersService.getRecent())[0].items[0].product, name);
  }
  assert.equal(api.mapOrder({ ...base, transaction: { ...base.transaction, source_reference: 'imported' }, items: [] }).staffId, null);
});

test('sales dates use the Manila business day across UTC midnight and timestamp offsets', () => {
  const transaction = { id: 1, handled_by: { id: 7, username: 'staff' }, payment_method: 'cash', total_amount: '120' };
  for (const [created_at, expected] of [
    ['2026-10-13T16:30:00Z', '2026-10-14'],
    ['2026-10-14T00:30:00+08:00', '2026-10-14'],
    ['2026-10-13T15:59:59Z', '2026-10-13'],
    ['invalid', ''],
  ]) assert.equal(api.toSale({ ...transaction, created_at }).date, expected);
  assert.equal(api.forecastExplanation({ status: 'new_model_status' }), 'Forecast withheld: new model status.');
});

test('FEFO includes stocked expired batches, excludes disposed stock and orders by expiry', async () => {
  const product = { name: 'Milk', is_active: true };
  const batches = [
    { id: 1, product, status: 'available', remaining_quantity: '5', expiration_date: '2099-01-01', batch_number: 'B1' },
    { id: 2, product, status: 'expired', remaining_quantity: '4', expiration_date: '2000-01-01', batch_number: 'B2' },
    { id: 3, product, status: 'available', remaining_quantity: '3', expiration_date: '2001-01-01', batch_number: 'B3' },
    { id: 4, product, status: 'disposed', remaining_quantity: '2', expiration_date: '1999-01-01' },
    { id: 5, product, status: 'expired', remaining_quantity: '0', expiration_date: '1999-01-01' },
    { id: 6, product: { ...product, is_active: false }, status: 'expired', remaining_quantity: '2', expiration_date: '1999-01-01' },
  ];
  api.http.defaults.adapter = async config => ({ config, status: 200, headers: {}, data: config.url === '/settings/inventory/' ? { near_expiry_threshold: 7, critical_expiry_threshold: 3 } : batches });
  const items = await api.inventoryService.getFEFO();
  assert.deepEqual(items.map(item => item.id), [2, 3, 1]);
  assert.ok(items.slice(0, 2).every(item => item.st === 'red' && item.priority === 'Critical'));
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

test('global inventory settings validate zero, invalid numbers, and coupled expiry changes', () => {
  const saved = { low_stock_threshold: 20, near_expiry_threshold: 7, critical_expiry_threshold: 3 };
  const draft = api.inventorySettingsDraft(saved);
  for (const invalid of ['', ' ', '1.5', '-1', 'Infinity', 'NaN', null]) {
    assert.ok(api.validateInventorySettings({ ...draft, low_stock_threshold: invalid }, saved).errors.low_stock_threshold);
  }
  assert.deepEqual(api.validateInventorySettings({ ...draft, low_stock_threshold: '0' }, saved), { errors: {}, payload: { low_stock_threshold: 0 } });
  assert.ok(api.validateInventorySettings({ ...draft, near_expiry_threshold: '2' }, saved).errors.critical_expiry_threshold);
  assert.deepEqual(api.validateInventorySettings({ ...draft, near_expiry_threshold: '2', critical_expiry_threshold: '0' }, saved), {
    errors: {}, payload: { near_expiry_threshold: 2, critical_expiry_threshold: 0 },
  });
});

test('memory cache deduplicates requests, respects three-minute freshness, and preserves stale data on failure', async () => {
  let calls = 0, resolve;
  const first = api.fetchDataCache('orders:test', () => { calls++; return new Promise(done => resolve = done); }, ['orders']);
  const second = api.fetchDataCache('orders:test', () => { throw new Error('Duplicate fetch'); }, ['orders']);
  await new Promise(done => setImmediate(done));
  assert.equal(calls, 1);
  resolve([{ id: 1 }]); await Promise.all([first, second]);
  await api.fetchDataCache('orders:test', () => { calls++; return Promise.resolve([]); }, ['orders']);
  assert.equal(calls, 1);
  const originalNow = Date.now;
  const updated = api.readDataCache('orders:test').updatedAt;
  try {
    Date.now = () => updated + api.DEFAULT_STALE_TIME;
    await assert.rejects(api.fetchDataCache('orders:test', () => Promise.reject(new Error('Offline')), ['orders']), /Offline/);
    assert.deepEqual(api.readDataCache('orders:test').data, [{ id: 1 }]);
    assert.equal(api.DEFAULT_STALE_TIME, 180000);
  } finally { Date.now = originalNow; }
});

test('invalidation and session clearing discard outdated in-flight cache results', async () => {
  let resolveOld;
  const old = api.fetchDataCache('sales:race', () => new Promise(resolve => resolveOld = resolve), ['sales']);
  await new Promise(done => setImmediate(done));
  api.invalidateDataCache(['sales']);
  await api.fetchDataCache('sales:race', () => Promise.resolve('new'), ['sales']);
  resolveOld('old'); await old;
  assert.equal(api.readDataCache('sales:race').data, 'new');
  let resolveSession;
  const pending = api.fetchDataCache('session:race', () => new Promise(resolve => resolveSession = resolve), ['dashboard']);
  await new Promise(done => setImmediate(done));
  api.setAccessToken('another-user');
  resolveSession('previous-account'); await pending;
  assert.equal(api.readDataCache('session:race').data, undefined);
});

test('successful writes invalidate dependent caches while failed writes leave them intact', async () => {
  const seed = async () => {
    for (const group of ['orders', 'sales', 'dashboard', 'inventory']) await api.fetchDataCache(group, () => Promise.resolve(group), [group], true);
  };
  await seed();
  await api.http.post('/sales/orders/', {});
  for (const group of ['orders', 'sales', 'dashboard', 'inventory']) assert.equal(api.readDataCache(group).updatedAt, 0);
  await seed();
  await api.http.post('/sales/checkout/', {});
  assert.ok(api.readDataCache('orders').updatedAt > 0);
  assert.equal(api.readDataCache('sales').updatedAt, 0);
  assert.equal(api.readDataCache('dashboard').updatedAt, 0);
  await seed();
  responseStatus = 400;
  await assert.rejects(api.http.patch('/settings/inventory/', {}));
  assert.ok(api.readDataCache('inventory').updatedAt > 0);
});

test('permission loss removes stale data and normal token refresh preserves the current account cache', async () => {
  await api.fetchDataCache('protected:cached', () => Promise.resolve('private'), ['dashboard']);
  api.setAccessToken('rotated-token', true);
  assert.equal(api.readDataCache('protected:cached').data, 'private');
  await assert.rejects(api.fetchDataCache('protected:cached', () => Promise.reject(new api.ApiError(403, 'Denied')), ['dashboard'], true));
  assert.equal(api.readDataCache('protected:cached').data, undefined);
});

test('staff sales history reuses initialized identity instead of a sequential account fetch', async () => {
  responseData = [];
  await api.salesService.getMine(7);
  assert.deepEqual(calls.map(call => call.url), ['/sales/transactions/']);
  assert.equal(calls[0].params.handled_by, 7);
});

test('inventory settings PATCH retains API field errors and uses the authenticated settings endpoint', async () => {
  await api.settingsService.updateInventory({ near_expiry_threshold: 2, critical_expiry_threshold: 0 });
  assert.equal(calls[0].method, 'patch');
  assert.equal(calls[0].url, '/settings/inventory/');
  assert.deepEqual(JSON.parse(calls[0].data), { near_expiry_threshold: 2, critical_expiry_threshold: 0 });
  responseStatus = 400; responseData = { critical_expiry_threshold: ['Must not exceed the near-expiry threshold.'] };
  await assert.rejects(api.settingsService.updateInventory({ near_expiry_threshold: 1 }), error => {
    assert.deepEqual(error.fieldErrors, responseData); return true;
  });
});

test('product and ingredient writes omit global threshold even for legacy ingredient callers', async () => {
  responseData = { id: 1 };
  await api.inventoryService.createProduct({ name: 'Milk', categoryId: 1, price: 10, stock: 1, expiry: '2099-01-01' });
  await api.inventoryService.updateProduct(1, { name: 'Milk', categoryId: 1, price: 12, low_stock_threshold: 10 });
  await api.inventoryService.createIngredient({ name: 'Milk powder', unit: 'kg', unit_price: 1, shelf_life: 30, low_stock_threshold: null });
  await api.inventoryService.updateIngredient(1, { name: 'Milk powder', low_stock_threshold: 10 });
  const writes = calls.filter(call => ['/inventory/products/', '/inventory/products/1/', '/inventory/ingredients/', '/inventory/ingredients/1/'].includes(call.url));
  assert.equal(writes.length, 4);
  assert.ok(writes.every(call => !Object.hasOwn(JSON.parse(call.data), 'low_stock_threshold')));
});

test('admin uses saved expiry windows while staff uses permitted feeds without requesting global settings', async () => {
  const date = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const product = { id: 1, name: 'Milk', unit: 'litre', is_active: true, category: { name: 'Dairy', is_active: true, is_visible_to_staff: true }, unit_price: '1', total_stock: '0', low_stock_threshold: 0 };
  const batch = { id: 1, product, status: 'available', remaining_quantity: '2', expiration_date: date(12), expiry_status: 'near_expiry' };
  const settings = { low_stock_threshold: 0, near_expiry_threshold: 15, critical_expiry_threshold: 2 };
  let disabled = false;
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const data = config.url === '/settings/inventory/' ? settings : config.url === '/inventory/products/' ? [product] : config.url === '/inventory/expiring/products/' && disabled ? [] : [batch];
    return { status: 200, config, headers: {}, data };
  };
  let items = await api.inventoryService.getOverview(false);
  assert.equal(api.getInventoryWarnings(items[0]).nearExpiry, true);
  assert.equal(items[0].nearExpiryThreshold, 15);
  assert.equal(items[0].low, true);
  settings.near_expiry_threshold = 2;
  items = await api.inventoryService.getOverview(false);
  assert.equal(api.getInventoryWarnings(items[0]).nearExpiry, false);
  calls = [];
  items = await api.inventoryService.getOverview(true);
  assert.equal(api.getInventoryWarnings(items[0]).nearExpiry, true);
  assert.equal(items[0].expiryStatus, 'near_expiry');
  assert.ok(calls.every(call => !call.url.startsWith('/settings/')));
  disabled = true;
  items = await api.inventoryService.getOverview(true);
  assert.equal(api.getInventoryWarnings(items[0]).nearExpiry, false);
  assert.equal(items[0].low, true);
});

test('FEFO classifications follow saved critical windows and backend expiry annotations', async () => {
  const date = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const batches = [-1, 0, 2, 12, 16].map((days, id) => ({ id, product: { name: 'Milk', is_active: true }, remaining_quantity: '2', status: 'available', expiration_date: date(days) }));
  api.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data: config.url === '/settings/inventory/' ? { near_expiry_threshold: 15, critical_expiry_threshold: 2 } : batches });
  const rows = await api.inventoryService.getFEFO();
  assert.deepEqual(rows.map(row => row.priority), ['Critical', 'Critical', 'Critical', 'High', 'Low']);
  api.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data: [{ ...batches[3], expiry_status: 'critical' }] });
  assert.equal((await api.inventoryService.getNearExpiry())[0].priority, 'Critical');
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
  api.invalidateDataCache(['reports']);
  responseStatus = 400;
  responseData = new Blob([JSON.stringify({ error: 'Report unavailable.' })], { type: 'application/json' });
  await assert.rejects(api.reportsService.downloadReportPDF('daily_sales'), { message: 'Report unavailable.' });
});

test('forecast periods use the graph endpoint and monthly status uses the regular compatibility contract', async () => {
  const keys = new Set();
  for (const period of ['weekly', 'monthly', 'yearly']) {
    responseData = { period, available_views: ['combined', 'regular', 'feeding'], views: { combined: {}, regular: {}, feeding: {} } };
    assert.deepEqual(await api.forecastingService.getChart(period), responseData);
    assert.equal(calls.at(-1).url, '/api/forecasting/chart/');
    assert.deepEqual(calls.at(-1).params, { period });
    keys.add(api.forecastChartKey(period));
  }
  assert.equal(keys.size, 3);
  await api.forecastingService.getRegularStatus();
  assert.equal(calls.at(-1).url, '/api/forecasting/forecast/');
  assert.deepEqual(calls.at(-1).params, { period: 'monthly' });
  const payload = { status: 'research_only', status_message: 'Publication is withheld pending review.',
    quality_gate: { reasons: ['needs_12_prospective_reviewed_months'] },
    metrics: { retrospective_regular_monthly: { wape_percent: 10.6433, periods: 12 }, prospective_regular_monthly: { wape_percent: null, periods: 0 } } };
  assert.match(api.forecastExplanation(payload), /Publication is withheld.*needs 12 prospective reviewed months/);
  assert.equal(api.forecastMetric(payload.metrics.retrospective_regular_monthly), '10.6% WAPE');
  assert.equal(api.forecastMetric(payload.metrics.prospective_regular_monthly), 'Not yet available');
  assert.equal(api.forecastMetric({ wape_percent: 0 }), '0.0% WAPE');
  assert.equal(api.forecastMetric({ wape_percent: 10, failed_rows: 1 }), 'Incomplete evaluation');
});

test('forecast refresh submits only an empty object and polls authenticated relative job URLs', async () => {
  responseStatus = 202;
  responseData = { job_id: 12, status: 'queued', status_url: '/api/forecasting/refresh/12/' };
  const job = await api.forecastingService.startRefresh();
  assert.equal(calls[0].method, 'post');
  assert.equal(calls[0].url, '/api/forecasting/refresh/');
  assert.deepEqual(JSON.parse(calls[0].data), {});
  responseStatus = 200;
  await api.forecastingService.getRefresh(job);
  await api.forecastingService.getRefresh();
  assert.deepEqual(calls.slice(1).map(call => [call.method, call.url]), [['get', '/api/forecasting/refresh/12/'], ['get', '/api/forecasting/refresh/']]);
  await assert.rejects(api.forecastingService.getRefresh({ ...job, status_url: 'https://untrusted.example/' }), { status: 400 });
  await assert.rejects(api.forecastingService.startRefresh(), /did not accept/);
});

test('forecast graph preserves null history and appends rough points outside the initial historical range', () => {
  const view = { status: 'stale_data', history: [
    { date: '2024-12-01', actual: 99, predicted: 90 },
    { date: '2025-01-01', actual: 0, predicted: null },
    { date: '2025-02-01', actual: null, predicted: null },
  ], provisional_status: 'provisional', provisional_forecast: [{ date: '2026-01-01', predicted: 120 }], forecast: [{ date: '2026-02-01', predicted_revenue: 130 }] };
  const series = api.forecastSeries(view, { start_date: '2025-01-01', end_date: '2025-12-31' });
  assert.deepEqual(series.map(row => row.date), ['2025-01-01', '2025-02-01', '2026-01-01']);
  assert.equal(series[0].actual, 0);
  assert.equal(series[1].actual, null);
  assert.equal(series[2].actual, null);
  assert.equal(series[2].provisional, 120);
  assert.equal(series[2].approved, null);
  assert.equal(api.forecastSeries({ ...view, provisional_status: 'primary_refresh_required' }).some(row => row.provisional !== null), false);
  assert.equal(api.forecastSeries({ ...view, status: 'ready' }).at(-1).approved, 130);
});


test('forecast display keeps eighteen recent history months and the full future horizon', () => {
  const history = Array.from({ length: 48 }, (_, index) => {
    const date = new Date(Date.UTC(2022, index, 1)).toISOString().slice(0, 10);
    return { date, actual: index === 46 ? null : index, predicted: null };
  }).reverse(); // Range calculation must not depend on response ordering.
  const view = { status: 'stale_data', history, provisional_status: 'provisional', provisional_forecast: [{ date: '2026-12-01', predicted: 80 }] };
  const range = api.forecastDisplayRange(view, 'monthly');
  assert.deepEqual(range, { start_date: '2024-07-01', end_date: '2025-12-01' });
  const series = api.forecastSeries(view, range);
  assert.equal(series.length, 19);
  assert.equal(series[0].date, '2024-07-01');
  assert.equal(series.find(row => row.date === '2025-11-01').actual, null);
  assert.equal(series.at(-1).date, '2026-12-01');
  assert.equal(series.at(-1).actual, null);
  assert.equal(series.at(-1).provisional, 80);
  assert.deepEqual(api.forecastDisplayRange({ history: [{ date: '2025-01-01', actual: 0 }, { date: '2026-01-01', actual: null }] }, 'monthly'),
    { start_date: '2023-08-01', end_date: '2025-01-01' });
});

test('forecast ranges handle weekly and annual buckets and missing history', () => {
  assert.equal(api.forecastDisplayRange(undefined, 'monthly'), null);
  assert.equal(api.forecastDisplayRange({ history: [] }, 'monthly'), null);
  assert.equal(api.forecastDisplayRange({ history: [{ date: 'bad-date', actual: 1 }] }, 'monthly'), null);
  const view = { history: [{ date: '2026-10-05', end_date: '2026-10-11', actual: 1 }] };
  assert.deepEqual(api.forecastDisplayRange(view, 'weekly'), { start_date: '2025-05-01', end_date: '2026-10-11' });
  assert.deepEqual(api.forecastDisplayRange(view, 'yearly'), { start_date: '2024-01-01', end_date: '2026-10-11' });
});

test('forecast revenue ticks and tooltips retain accurate currency at small and large magnitudes', () => {
  assert.equal(api.forecastAmount(1500000, true), '₱1.5M');
  assert.equal(api.forecastAmount(1500, true), '₱1.5K');
  assert.equal(api.forecastAmount(0, true), '₱0');
  assert.equal(api.forecastAmount(1500.5), '₱1,500.5');
  for (const value of [null, undefined, '', 'invalid', Infinity]) assert.equal(api.forecastAmount(value), '—');
});

test('checkout sends decimal strings without an automatic report-refresh request', async () => {
  responseData = { id: 7, subtotal: '43.00', total_amount: '43.00', change_due: '7.00' };
  const result = await api.checkoutService.submit({ customer_id: null, items: [{ product_id: 1, quantity: '2.50', unit_price: '17.80', discount_type: 'fixed', discount_value: '1.50' }], payment_method: 'cash', amount_tendered: '50.00' });
  assert.deepEqual(JSON.parse(calls[0].data), { customer_id: null, items: [{ product_id: 1, quantity: '2.50', unit_price: '17.80', discount_type: 'fixed', discount_value: '1.50' }], payment_method: 'cash', amount_tendered: '50.00' });
  assert.equal(calls.length, 1);
  assert.equal(result.totalAmount, 43);
  assert.equal(result.changeDue, 7);
});

test('consecutive completed sales never trigger a throttled automatic report refresh', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/api/reports/refresh/') throw new AxiosError('Throttled', undefined, config, undefined,
      { status: 429, data: { detail: 'Try later.' }, headers: { 'retry-after': '60' }, config });
    return { data: { id: 7, subtotal: '43', total_amount: '43', change_due: null }, status: 200, config, headers: {} };
  };
  for (let i = 0; i < 3; i++) {
    const result = await api.checkoutService.submit({ customer_id: null, items: [{ product_id: 1, quantity: '1', unit_price: '43' }], payment_method: 'online' });
    assert.equal(result.id, 7);
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.url === '/sales/checkout/'));
  assert.equal(JSON.parse(calls[0].data).amount_tendered, undefined);
});

test('order creation rejects missing customers and avoids an automatic report-refresh request', async () => {
  await assert.rejects(api.ordersService.createOrder({ customer_id: 0, items: [] }), { status: 400 });
  assert.equal(calls.length, 0);
  responseData = { id: 1, transaction: { id: 1 } };
  await api.ordersService.createOrder({ customer_id: 3, items: [{ product_id: 2, quantity: '1.5', unit_price: '20.00' }] });
  assert.equal(calls[0].url, '/sales/orders/');
  assert.equal(JSON.parse(calls[0].data).items[0].quantity, '1.50');
  assert.equal(calls.length, 1);
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
  assert.deepEqual(await api.inventoryService.getLowStock(), [{ id: 1, name: 'Milk', cat: 'Dairy', inventoryValue: null, stock: 2.5, expiry: '', low: true }]);
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

test('inventory warnings preserve dual status, calendar boundaries and independent stock warnings', () => {
  const now = new Date(2026, 9, 10, 12);
  const product = { stock: 5, reorderThreshold: 5, low: false, expiry: '2026-10-17', nearExpiryThreshold: 7 };
  let warning = api.getInventoryWarnings(product, now);
  assert.equal(warning.status, 'Low Stock & Near Expiry');
  assert.equal(warning.daysLeft, 7);
  assert.equal(warning.stockMessage, 'Low Stock (5 remaining) & Near Expiry (7 days left).');
  warning = api.getInventoryWarnings({ ...product, expiry: '2026-10-18' }, now);
  assert.equal(warning.status, 'Low');
  assert.equal(warning.stockMessage, 'Stock level (5) is at or below the reorder threshold (5).');
  warning = api.getInventoryWarnings({ ...product, stock: 6, low: true }, now);
  assert.equal(warning.lowStock, false);
  assert.equal(warning.status, 'Near Expiry');
  assert.equal(warning.expiryMessage, 'Product batch expires on 2026-10-17 (7 days remaining).');
  warning = api.getInventoryWarnings({ ...product, expiry: '2026-10-09' }, now);
  assert.equal(warning.status, 'Expired');
  assert.equal(warning.nearExpiry, false);
  assert.equal(warning.lowStock, true);
  assert.equal(warning.expiryMessage, 'Product batch expired on 2026-10-09.');
  assert.equal(api.getInventoryWarnings({ ...product, stock: 6, expiry: '' }, now).status, 'Active');
  assert.equal(api.getInventoryWarnings({ ...product, stock: 6, expiry: '2026-10-10' }, now).daysLeft, 0);
});

test('inventory pagination caps spacious desktop tables at five rows and adapts to shorter bodies', () => {
  const limits = { minPageSize: 1, maxPageSize: 5 };
  assert.equal(api.calculatePageSize(800, 40, 0, 56, limits), 5);
  assert.equal(api.calculatePageSize(320, 40, 0, 56, limits), 5);
  assert.equal(api.calculatePageSize(319, 40, 0, 56, limits), 4);
  assert.equal(api.calculatePageSize(152, 40, 0, 56, limits), 2);
});

test('current user maps the JWT identity when the profile endpoint omits id', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`);
  responseData = { username: 'staff', role: 'staff' };
  assert.deepEqual(await api.authService.getCurrentUser(), { ...responseData, id: 7 });
  assert.equal(await api.authService.getCurrentUserId(), 7);
});

test('session identity uses valid profile ids and rejects invalid token claims safely', () => {
  assert.equal(api.getSessionUserId({ id: 12 }), 12);
  for (const user_id of [null, true, {}, '', -1, 0, 1.5, 'garbage', Number.MAX_SAFE_INTEGER + 1]) {
    api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id })).toString('base64url')}.signature`);
    assert.equal(api.getSessionUserId(), null);
  }
  api.setAccessToken('invalid-token');
  assert.equal(api.getSessionUserId(), null);
  api.setAccessToken(null);
  assert.equal(api.getSessionUserId(), null);
});

test('category create includes the selected icon', async () => {
  await api.inventoryService.createCategory({ name: 'Treats', icon: 'Cookie', is_visible_to_staff: true });
  assert.deepEqual(JSON.parse(calls[0].data), {
    name: 'Treats', description: '', icon: 'Cookie', is_visible_to_staff: true,
  });
});

test('category list preserves current lowercase presets and uses automatic fallback for invalid icons', async () => {
  api.http.defaults.adapter = async config => ({
    status: 200, statusText: '', headers: {}, config,
    data: config.url === '/inventory/categories/' ? [
      { id: 1, name: 'No icon', is_active: true, is_visible_to_staff: true },
      { id: 2, name: 'Bad icon', icon: 'UnknownIcon', is_active: true, is_visible_to_staff: true },
      { id: 3, name: 'Cheese', icon: 'cheese', is_active: true, is_visible_to_staff: true },
    ] : [],
  });
  const categories = await api.inventoryService.getCategories();
  assert.deepEqual(Object.fromEntries(categories.map(category => [category.name, category.icon])), {
    'Bad icon': '', Cheese: 'cheese', 'No icon': '',
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
      items: Array.from({ length: itemCount }, (_, id) => ({ id, quantity: '1.50', unit_price: '20.00', subtotal: '30.00', discount_amount: '5.00', total_amount: '25.00', product_batch: { batch_number: 'PRD-0001', product: { name: 'Fresh Milk', variant: '1 L' } } })) },
  };
}

test('receipt details preserve itemized API values without inventing order metadata', () => {
  const receipt = api.receiptDetails(receiptFixture());
  assert.equal(receipt.title, 'Official Sales Receipt');
  assert.equal(receipt.items[0].subtotal, 'PHP 25.00');
  assert.deepEqual(receipt.totals.at(-1), ['Change', 'PHP 5.00']);
  const voucher = api.receiptDetails(receiptFixture('online'));
  assert.equal(voucher.title, 'Official Sales Receipt');
  assert.equal(voucher.fields.find(field => field[0] === 'Payment Status')[1], 'Not recorded');
  for (const label of ['Order #', 'Fulfillment Type']) assert.equal(voucher.fields.some(field => field[0] === label), false);
  assert.equal(api.receiptMoney(null), 'Not provided');
  assert.equal(api.receiptMoney('0'), 'PHP 0.00');
});

test('receipts hide immediate payment timestamps and compare instants at displayed second precision', () => {
  for (const [created_at, payment_updated_at] of [
    ['2026-09-15T01:00:00Z', '2026-09-15T01:00:00Z'],
    ['2026-09-15T01:00:00Z', '2026-09-15T09:00:00+08:00'],
    ['2026-09-15T01:00:00.100Z', '2026-09-15T01:00:00.900Z'],
    ['2026-09-15T01:00:01.001Z', '2026-09-15T01:00:00.999Z'],
  ]) {
    const sale = receiptFixture();
    Object.assign(sale.transaction, { created_at, payment_updated_at, payment_status: 'paid' });
    const receipt = api.receiptDetails(sale);
    assert.equal(receipt.fields.some(([label]) => label === 'Payment updated'), false);
    assert.ok(receipt.fields.some(([label]) => label === 'Date / Time'));
    assert.equal(receipt.fields.find(([label]) => label === 'Payment Status')[1], 'Paid');
  }
});

test('receipts preserve genuine later payment updates for paid and pending transactions', () => {
  for (const payment_status of ['paid', 'pending']) {
    const sale = receiptFixture();
    Object.assign(sale.transaction, { payment_updated_at: '2026-09-16T02:00:00Z', payment_status });
    const fields = api.receiptDetails(sale).fields;
    const updated = fields.find(([label]) => label === 'Payment updated');
    assert.ok(updated);
    assert.match(updated[1], /Asia\/Manila/);
    assert.notEqual(updated[1], fields.find(([label]) => label === 'Date / Time')[1]);
  }
});

test('receipts omit missing or invalid payment update timestamps without losing known payment history', () => {
  for (const payment_updated_at of [undefined, null, '', 'invalid']) {
    const sale = receiptFixture(); sale.transaction.payment_updated_at = payment_updated_at;
    assert.equal(api.receiptDetails(sale).fields.some(([label]) => label === 'Payment updated'), false);
  }
  const sale = receiptFixture();
  Object.assign(sale.transaction, { created_at: 'invalid', payment_updated_at: '2026-09-16T02:00:00Z' });
  assert.ok(api.receiptDetails(sale).fields.some(([label]) => label === 'Payment updated'));
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
  assert.ok(products.every(product => !('price' in product)), 'Catalog prices cannot seed selling prices');
});


test('configured stock thresholds include equality without a UI default', () => {
  assert.equal(api.isLowStock(11, 10), false);
  assert.equal(api.isLowStock(10, 10), true);
  assert.equal(api.isLowStock(9, 10), true);
  assert.equal(api.isLowStock(19, 0), false);
  assert.equal(api.isLowStock(0, 0), true);
});

test('calendar expiry days do not gain a day from timezone offsets and reject impossible dates', () => {
  const today = new Date(2026, 9, 8, 12);
  assert.equal(api.daysUntilExpiry('2026-10-08', today), 0);
  assert.equal(api.daysUntilExpiry('2026-10-15', today), 7);
  assert.equal(api.daysUntilExpiry('2026-10-07', today), -1);
  assert.equal(api.daysUntilExpiry('2026-02-30', today), null);
});

test('catalog expiry prefers a valid positive-stock batch over expired and empty batches', async () => {
  const iso = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
  const product = { id: 385, name: 'Milk', variant: '200ml', is_active: true, category: { name: 'Dairy', is_active: true, is_visible_to_staff: true }, unit_price: '50.00', total_stock: '19.00', low_stock_threshold: 0 };
  api.http.defaults.adapter = async config => ({ status: 200, statusText: '', headers: {}, config, data: config.url === '/inventory/products/' ? [product] : [
    { product, status: 'available', remaining_quantity: '5', expiration_date: iso(-1) },
    { product, status: 'available', remaining_quantity: '0', expiration_date: iso(1) },
    { product, status: 'available', remaining_quantity: '19', expiration_date: iso(9) },
  ] });
  const rows = await api.inventoryService.getAll(true);
  assert.equal(rows[0].expiry, iso(9));
  assert.equal(rows[0].inventoryValue, null, 'Missing batch cost remains unknown');
  assert.equal(rows[0].stock, 19);
  assert.equal(rows[0].low, false);
  assert.equal(api.isExpiredProduct(rows[0]), false);
});

test('published forecast requires ready status and finite nonplaceholder values', () => {
  const point = { date:'2026-11-01', predicted_revenue:'120.00' };
  assert.equal(api.publishedForecast({status:'stale_data',forecast:[point]}), null);
  assert.equal(api.publishedForecast({status:'ready',forecast:[]}), null);
  assert.equal(api.publishedForecast({status:'ready',is_placeholder:true,forecast:[point]}), null);
  assert.equal(api.publishedForecast({status:'ready',forecast:[{...point,predicted_revenue:'NaN'}]}), null);
  assert.equal(api.publishedForecast({status:'ready',forecast:[{...point,predicted_revenue:null}]}), null);
  assert.deepEqual(api.publishedForecast({status:'ready',forecast:[point]}), point);
  assert.equal(api.forecastExplanation({status:'ready',status_message:'Published regular monthly forecast.'}), 'Published regular monthly forecast.');
});

test('checkout retains authoritative returned prices for the saved receipt', async () => {
  responseData = { id: 42, handled_by:{id:2,username:'Cashier'}, created_at:'2026-10-08T03:00:00Z', payment_method:'cash', subtotal:'60.00', discount_amount:'0.00', total_amount:'60.00', amount_tendered:'100.00', change_due:'40.00', items:[{ id:1, quantity:'1', unit_price:'60.00', subtotal:'60.00', total_amount:'60.00', discount_amount:'0.00', product_name_snapshot:'Milk', product_batch:{batch_number:'B1',product:{name:'Milk'}} }] };
  const result = await api.checkoutService.submit({ customer_id: null, items:[{product_id:385,quantity:'1',unit_price:'60'}],payment_method:'cash',amount_tendered:'100' });
  const receipt = api.receiptDetails(api.toSale(result.transaction));
  assert.equal(receipt.items[0].price, 'PHP 60.00');
  assert.equal(receipt.items[0].subtotal, 'PHP 60.00');
  assert.equal(result.totalAmount, 60);
});


test('navigation mutations invalidate their dependent groups and preserve unrelated cache entries', async () => {
  const groups = ['categories', 'customers', 'users', 'settings', 'inventory', 'dashboard', 'reports', 'orders'];
  for (const [method, url, affected] of [
    ['post', '/inventory/categories/', ['categories', 'inventory', 'reports', 'dashboard']],
    ['patch', '/inventory/categories/1/', ['categories', 'inventory', 'reports', 'dashboard']],
    ['delete', '/inventory/categories/1/', ['categories', 'inventory', 'reports', 'dashboard']],
    ['patch', '/sales/customers/1/', ['customers', 'reports']],
    ['delete', '/sales/customers/1/', ['customers', 'reports']],
    ['post', '/accounts/register/', ['users']],
    ['patch', '/accounts/users/1/', ['users']],
    ['delete', '/accounts/users/1/', ['users']],
    ['patch', '/settings/system/', ['settings', 'inventory', 'dashboard', 'reports']],
    ['patch', '/settings/inventory/', ['settings', 'inventory', 'dashboard', 'reports']],
    ['patch', '/settings/notifications/', ['settings', 'inventory', 'dashboard', 'reports']],
  ]) {
    for (const group of groups) api.writeDataCache(group, group, [group]);
    await api.http.request({ method, url, data: {} });
    for (const group of groups) {
      assert.equal(api.readDataCache(group).updatedAt === 0, affected.includes(group), `${url}: ${group}`);
      assert.equal(api.readDataCache(group).data, group);
    }
  }
  responseStatus = 400;
  api.writeDataCache('customers', ['saved'], ['customers']);
  await assert.rejects(api.http.patch('/sales/customers/1/', {}));
  assert.ok(api.readDataCache('customers').updatedAt > 0);
});

test('ingredient reads reuse cache, distinguish inactive filters, and refresh after writes', async () => {
  responseData = [{ id: 1, name: 'Milk' }];
  await api.inventoryService.getIngredients();
  await api.inventoryService.getIngredients();
  assert.equal(calls.length, 1);
  await api.inventoryService.getIngredients(true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].params, { include_inactive: true });
  await api.inventoryService.updateIngredient(1, { name: 'Fresh milk' });
  responseData = [{ id: 1, name: 'Fresh milk' }];
  assert.equal((await api.inventoryService.getIngredients())[0].name, 'Fresh milk');
  assert.equal(calls.filter(call => call.method === 'get').length, 3);
});

test('PDF exports reuse fresh blobs and refetch after report refresh or three-minute expiry', async () => {
  responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  await api.reportsService.downloadReportPDF('inventory');
  await api.reportsService.downloadReportPDF('inventory');
  assert.equal(calls.length, 1);
  await api.reportsService.refreshReportCache();
  await api.reportsService.downloadReportPDF('inventory');
  assert.equal(calls.filter(call => call.url === '/api/reports/export-pdf/').length, 2);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + api.DEFAULT_STALE_TIME;
    await api.reportsService.downloadReportPDF('inventory');
    assert.equal(calls.filter(call => call.url === '/api/reports/export-pdf/').length, 3);
  } finally { Date.now = originalNow; }
});


test('expiry notifications use permitted feed classification and retain backend acknowledgement identity', async () => {
  const inbox = [
    { id: 'expiry-product-1', revision: 'a'.repeat(64), unread: false, dismissed: true },
    { id: 'expiry-ingredient-1', revision: 'b'.repeat(64), unread: true, dismissed: false },
    { id: 'low-stock-products', revision: 'c'.repeat(64), unread: true, dismissed: false },
  ];
  const today = new Date();
  const expiry = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const date = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const data = config.url === '/settings/notifications/' ? { near_expiry_alerts: true } : config.url === '/settings/inbox/' ? inbox : [{ id: 1, expiration_date: date,
      expiry_status: config.url.endsWith('/products/') ? 'critical' : 'near_expiry' }];
    return { status: 200, config, headers: {}, data };
  };
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items[0], { ...inbox[0], expiry: { status: 'critical', daysLeft: 5 } });
  assert.deepEqual(items[1], { ...inbox[1], expiry: { status: 'near_expiry', daysLeft: 5 } });
  assert.deepEqual(items[2], inbox[2]);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/', '/inventory/product-batches/', '/inventory/ingredient-batches/', '/inventory/expiring/products/', '/inventory/expiring/ingredients/']);
});

test('expiry enrichment keeps inbox alerts if a feed fails and avoids guessing critical windows', async () => {
  const inbox = [{ id: 'expiry-product-1' }, { id: 'expiry-ingredient-2' }];
  api.http.defaults.adapter = async config => {
    if (config.url.endsWith('/products/')) throw new Error('Feed unavailable');
    return { status: 200, config, headers: {}, data: config.url === '/settings/notifications/' ? { near_expiry_alerts: true } : config.url === '/settings/inbox/' ? inbox : [{ id: 2, expiration_date: '2099-01-01', expiry_status: 'near_expiry' }] };
  };
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items[0], inbox[0]);
  assert.equal(items[1].expiry.status, 'near_expiry');
  responseData = [];
  api.http.defaults.adapter = async config => { calls.push(config); return { status: 200, config, headers: {}, data: config.url === '/settings/notifications/' ? { near_expiry_alerts: true } : [] }; };
  assert.deepEqual(await api.notificationsService.getAllWithExpiry(), []);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
});


test('server expiry metadata includes expired items without redundant feed requests', async () => {
  responseData = [{ id: 'expiry-product-1', revision: 'a'.repeat(64), unread: true, dismissed: false,
    expiry: { status: 'expired', daysLeft: -3 } }];
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items, responseData);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
});

test('expired inventory batches include products and ingredients with remaining stock only', async () => {
  const product = { id: 1, name: 'Milk', unit: 'liter', is_active: true,
    category: { name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  const ingredient = { id: 1, name: 'Cream', unit: 'liter' };
  const batch = { id: 1, batch_number: 'PAST', expiration_date: '2000-01-01', remaining_quantity: '5', status: 'available' };
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const data = config.url.endsWith('/product-batches/') ? [
      { ...batch, product }, { ...batch, id: 2, product, remaining_quantity: '0' },
      { ...batch, id: 3, product, status: 'disposed' }, { ...batch, id: 4, product, expiration_date: '2099-01-01' },
      { ...batch, id: 5, product: { ...product, category: { ...product.category, is_visible_to_staff: false } } },
    ] : [{ ...batch, ingredient, status: 'expired' }, { ...batch, id: 2, ingredient, status: 'depleted' }];
    return { status: 200, config, headers: {}, data };
  };
  assert.deepEqual((await api.inventoryService.getExpiredBatches(true)).map(row => row.key), ['product-1', 'ingredient-1']);
  assert.deepEqual(calls.map(call => call.url), ['/inventory/product-batches/', '/inventory/ingredient-batches/']);
  assert.deepEqual((await api.inventoryService.getExpiredBatches()).map(row => row.key), ['product-1', 'product-5', 'ingredient-1']);
});


function expiredFeedAdapter(inbox = []) {
  const product = { id: 1, name: 'Milk', unit: 'liter', is_active: true,
    category: { name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  const batch = { id: 1, batch_number: 'PAST', expiration_date: '2000-01-01', remaining_quantity: '5', status: 'available' };
  api.http.defaults.adapter = async config => {
    calls.push(config);
    const data = config.url === '/settings/notifications/' ? { near_expiry_alerts: true } : config.url === '/settings/inbox/' ? inbox : config.url === '/inventory/product-batches/' ? [
      { ...batch, product }, { ...batch, id: 2, product, remaining_quantity: '0' },
      { ...batch, id: 3, product, status: 'disposed' }, { ...batch, id: 4, product, expiration_date: '2099-01-01' },
      { ...batch, id: 5, product: { ...product, category: { ...product.category, is_visible_to_staff: false } } },
    ] : [{ ...batch, ingredient: { name: 'Cream', unit: 'liter' }, status: 'expired' }];
    return { status: 200, config, headers: {}, data };
  };
}

test('frontend combines expired batches with an empty inbox and preserves staff visibility', async () => {
  expiredFeedAdapter();
  const items = await api.notificationsService.getAllWithExpiry(true);
  assert.deepEqual(items.map(item => item.id), ['expiry-product-1', 'expiry-ingredient-1']);
  assert.ok(items.every(item => item.clientOnly && item.unread && !item.dismissed && item.expiry.status === 'expired'));
  assert.equal(items[0].title, 'EXPIRED \u2022 Action Required');
  assert.match(items[0].body, /Milk.*PAST.*5 liter remaining/);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
});

test('disabled expiry preferences suppress synthetic alerts for admin and staff and retain other inbox alerts', async () => {
  const inbox = [{ id: 'low-stock-products', revision: 'a'.repeat(64), unread: true, dismissed: false }];
  expiredFeedAdapter(inbox);
  const adapter = api.http.defaults.adapter;
  let enabled = false;
  api.http.defaults.adapter = async config => {
    if (config.url === '/settings/notifications/') {
      calls.push(config);
      return { status: 200, config, headers: {}, data: { near_expiry_alerts: enabled } };
    }
    return adapter(config);
  };
  for (const staff of [false, true]) {
    calls = [];
    assert.deepEqual(await api.notificationsService.getAllWithExpiry(staff), inbox);
    assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/']);
    enabled = true;
    let items = await api.notificationsService.getAllWithExpiry(staff);
    const synthetic = items.find(item => item.clientOnly);
    assert.ok(synthetic);
    await api.notificationsService.update('read', [synthetic]);
    enabled = false;
    assert.deepEqual(await api.notificationsService.getAllWithExpiry(staff), inbox);
    enabled = true;
    items = await api.notificationsService.getAllWithExpiry(staff);
    assert.equal(items.find(item => item.id === synthetic.id).unread, false);
    assert.ok(calls.every(call => call.url !== '/settings/inventory/'));
    enabled = false;
  }
});

test('unavailable notification preferences keep the server inbox without inventing synthetic expiry alerts', async () => {
  const inbox = [{ id: 'fulfilled-1', revision: 'a'.repeat(64), unread: false, dismissed: false }];
  expiredFeedAdapter(inbox);
  const adapter = api.http.defaults.adapter;
  api.http.defaults.adapter = async config => {
    if (config.url === '/settings/notifications/') {
      calls.push(config);
      throw new AxiosError('Unavailable', undefined, config, undefined, { status: 500, data: {}, config });
    }
    return adapter(config);
  };
  assert.deepEqual(await api.notificationsService.getAllWithExpiry(true), inbox);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/settings/notifications/']);
});

test('inventory-derived duplicates retain server revisions and acknowledgement states', async () => {
  const server = { id: 'expiry-product-1', revision: 'b'.repeat(64), unread: false, dismissed: true };
  expiredFeedAdapter([server]);
  const items = await api.notificationsService.getAllWithExpiry(true);
  assert.equal(items.filter(item => item.id === server.id).length, 1);
  const merged = items.find(item => item.id === server.id);
  assert.equal(merged.revision, server.revision); assert.equal(merged.unread, false);
  assert.equal(merged.dismissed, true); assert.equal(merged.clientOnly, undefined);
  assert.equal(merged.expiry.status, 'expired');
});

test('server-issued expired alerts persist via inbox POST and reload authoritative read/dismissed state', async () => {
  let persisted = { id: 'expiry-product-1', revision: 'b'.repeat(64), unread: true, dismissed: false, expiry: { status: 'expired', daysLeft: -2 } };
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/settings/inbox/' && config.method === 'post') {
      const payload = JSON.parse(config.data);
      assert.deepEqual(payload.notifications, [{ id: persisted.id, revision: persisted.revision }]);
      persisted = { ...persisted, unread: false, dismissed: payload.action === 'dismiss' };
      return { status: 200, config, headers: {}, data: { updated: 1, action: payload.action } };
    }
    return { status: 200, config, headers: {}, data: config.url === '/settings/inbox/' ? [{ ...persisted }] : [] };
  };
  let [item] = await api.notificationsService.getAllWithExpiry();
  assert.equal(item.clientOnly, undefined);
  await api.notificationsService.update('read', [item]);
  api.clearDataCache();
  [item] = await api.notificationsService.getAllWithExpiry();
  assert.equal(item.unread, false);
  await api.notificationsService.update('dismiss', [item]);
  [item] = await api.notificationsService.getAllWithExpiry();
  assert.equal(item.dismissed, true);
  assert.equal(item.unread, false);
});

const notificationToken = (userId, nonce = '') => `header.${Buffer.from(JSON.stringify({ user_id: userId, jti: nonce })).toString('base64url')}.signature`;
const syntheticStorageKey = userId => `rosario:synthetic-notifications:v1:${userId}`;

test('synthetic alert acknowledgements survive rehydration and never post synthetic references', async () => {
  api.setAccessToken(notificationToken(7));
  expiredFeedAdapter();
  let item = (await api.notificationsService.getAllWithExpiry(true))[0];
  calls = [];
  await api.notificationsService.update('dismiss', [item]);
  assert.equal(calls.length, 0);
  assert.ok(localStorage.getItem(syntheticStorageKey(7)));
  api.clearDataCache();
  item = (await api.notificationsService.getAllWithExpiry(true))[0];
  assert.equal(item.dismissed, true); assert.equal(item.unread, false);
  await api.notificationsService.update('restore', [item]);
  item = (await api.notificationsService.getAllWithExpiry(true))[0];
  assert.equal(item.dismissed, false); assert.equal(item.unread, false);
  api.clearDataCache();
  item = (await api.notificationsService.getAllWithExpiry(true))[0];
  assert.equal(item.dismissed, false); assert.equal(item.unread, false);
  await api.notificationsService.update('read', [item, { id: 'server-alert', revision: 'c'.repeat(64) }]);
  assert.deepEqual(JSON.parse(calls.at(-1).data), { action: 'read', notifications: [{ id: 'server-alert', revision: 'c'.repeat(64) }] });
});

test('synthetic acknowledgement storage isolates accounts and retains state across logout and token rotation', async () => {
  api.setAccessToken(notificationToken(7));
  expiredFeedAdapter();
  let [item] = await api.notificationsService.getAllWithExpiry(true);
  await api.notificationsService.update('dismiss', [item]);
  const accountSeven = localStorage.getItem(syntheticStorageKey(7));
  api.setAccessToken(null);
  api.setAccessToken(notificationToken(8));
  [item] = await api.notificationsService.getAllWithExpiry(true);
  assert.equal(item.unread, true); assert.equal(item.dismissed, false);
  await api.notificationsService.update('read', [item]);
  assert.equal(localStorage.getItem(syntheticStorageKey(7)), accountSeven);
  assert.notEqual(localStorage.getItem(syntheticStorageKey(8)), accountSeven);
  api.setAccessToken(notificationToken(7));
  [item] = await api.notificationsService.getAllWithExpiry(true);
  assert.equal(item.unread, false); assert.equal(item.dismissed, true);
  api.setAccessToken(notificationToken(7, 'rotated'), true);
  [item] = await api.notificationsService.getAllWithExpiry(true);
  assert.equal(item.unread, false); assert.equal(item.dismissed, true);
});

test('changed synthetic alert revisions become unread and replace obsolete stored acknowledgements', async () => {
  api.setAccessToken(notificationToken(7));
  expiredFeedAdapter();
  let [item] = await api.notificationsService.getAllWithExpiry(true);
  await api.notificationsService.update('dismiss', [item]);
  const originalRevision = item.revision;
  const adapter = api.http.defaults.adapter;
  api.http.defaults.adapter = async config => {
    const response = await adapter(config);
    if (config.url === '/inventory/product-batches/') response.data = response.data.map(batch => ({ ...batch, remaining_quantity: '6' }));
    return response;
  };
  [item] = await api.notificationsService.getAllWithExpiry(true);
  assert.notEqual(item.revision, originalRevision);
  assert.equal(item.unread, true); assert.equal(item.dismissed, false);
  await api.notificationsService.update('read', [item]);
  const stored = JSON.parse(localStorage.getItem(syntheticStorageKey(7)));
  assert.equal(stored.length, 1);
  assert.equal(stored[0][0], `${item.id}:${item.revision}`);
});

test('corrupt or malformed synthetic acknowledgement storage does not hide notifications', async () => {
  api.setAccessToken(notificationToken(7));
  expiredFeedAdapter();
  const [original] = await api.notificationsService.getAllWithExpiry(true);
  for (const value of ['invalid json', '{}', JSON.stringify([[`${original.id}:${original.revision}`, { unread: 'false', dismissed: true }], null])]) {
    localStorage.setItem(syntheticStorageKey(7), value);
    api.clearDataCache();
    const [item] = await api.notificationsService.getAllWithExpiry(true);
    assert.equal(item.unread, true); assert.equal(item.dismissed, false);
  }
  await api.notificationsService.update('read', [original]);
  api.clearDataCache();
  assert.equal((await api.notificationsService.getAllWithExpiry(true))[0].unread, false);
});

test('blocked browser storage falls back to session acknowledgements without invalid inbox writes', async () => {
  api.setAccessToken(notificationToken(7));
  const original = localStorage;
  global.localStorage = {
    ...original,
    getItem: key => { if (key.startsWith('rosario:synthetic-notifications:')) throw new Error('Storage blocked'); return original.getItem(key); },
    setItem: (key, value) => { if (key.startsWith('rosario:synthetic-notifications:')) throw new Error('Quota exceeded'); original.setItem(key, value); },
  };
  expiredFeedAdapter();
  const [item] = await api.notificationsService.getAllWithExpiry(true);
  await api.notificationsService.update('read', [item]);
  assert.equal((await api.notificationsService.getAllWithExpiry(true))[0].unread, false);
  assert.ok(calls.every(call => call.method === 'get'));
});

test('synthetic alerts never persist under a shared key when account identity is missing', async () => {
  expiredFeedAdapter();
  const [item] = await api.notificationsService.getAllWithExpiry(true);
  const writes = [];
  const original = localStorage.setItem;
  localStorage.setItem = (key, value) => { writes.push(key); original(key, value); };
  await api.notificationsService.update('read', [item]);
  assert.equal((await api.notificationsService.getAllWithExpiry(true))[0].unread, false);
  assert.deepEqual(writes, []);
  api.clearDataCache();
  assert.equal((await api.notificationsService.getAllWithExpiry(true))[0].unread, true);
});

test('a delayed inbox action cannot save synthetic acknowledgements into a different account', async () => {
  api.setAccessToken(notificationToken(7));
  expiredFeedAdapter();
  const [item] = await api.notificationsService.getAllWithExpiry(true);
  let complete;
  api.http.defaults.adapter = config => new Promise(resolve => { complete = () => resolve({ status: 200, config, headers: {}, data: {} }); });
  const pending = api.notificationsService.update('read', [item, { id: 'server', revision: 'a'.repeat(64) }]);
  await new Promise(resolve => setImmediate(resolve));
  api.setAccessToken(notificationToken(8));
  complete(); await assert.rejects(pending, { status: 409 });
  assert.equal(localStorage.getItem(syntheticStorageKey(7)), null);
  assert.equal(localStorage.getItem(syntheticStorageKey(8)), null);
  expiredFeedAdapter();
  assert.equal((await api.notificationsService.getAllWithExpiry(true))[0].unread, true);
});

test('partial expired batch feed failure keeps inbox and available ingredient alerts', async () => {
  expiredFeedAdapter([{ id: 'stock-alert', revision: 'd'.repeat(64) }]);
  const adapter = api.http.defaults.adapter;
  api.http.defaults.adapter = async config => {
    if (config.url === '/inventory/product-batches/') throw new Error('Unavailable');
    return adapter(config);
  };
  const items = await api.notificationsService.getAllWithExpiry(true);
  assert.deepEqual(items.map(item => item.id), ['stock-alert', 'expiry-ingredient-1']);
});


test('expired batch disposal writes off the full authoritative quantity with the proper batch reference', async () => {
  for (const kind of ['product', 'ingredient']) {
    calls = [];
    let refreshed = 0;
    window.addEventListener(api.REPORTS_UPDATED, () => refreshed++);
    api.http.defaults.adapter = async config => {
      calls.push(config);
      const data = config.method === 'get' ? { status: 'available', expiration_date: '2000-01-01',
        remaining_quantity: '5.25', unit_price: '12.34', batch_number: 'EX-01' } : {};
      return { status: 200, config, headers: {}, data };
    };
    await api.inventoryService.disposeExpiredBatch({ id: 7, kind, quantity: 5.25 });
    assert.equal(calls[0].url, `/inventory/${kind}-batches/7/`);
    assert.equal(calls[1].url, '/inventory/stock-adjustments/');
    assert.deepEqual(JSON.parse(calls[1].data), { [`${kind}_batch_id`]: 7, adjustment_type: 'expired',
      quantity: '5.25', unit_cost: '12.34', reason: 'Expired batch EX-01: full remaining stock disposed.' });
    assert.ok(refreshed > 0);
  }
});

test('disposal rejects changed stock, nonexpired dates, blocked status and failed writes', async () => {
  const base = { status: 'available', expiration_date: '2000-01-01', remaining_quantity: '5', unit_price: '12.34', batch_number: 'EX-01' };
  for (const change of [{ remaining_quantity: '4' }, { status: 'depleted' }, { status: 'disposed' },
    { expiration_date: '2099-01-01' }, { date_received: '2099-01-01' }, { unit_price: '-1' }, { remaining_quantity: '0' }]) {
    calls = [];
    api.http.defaults.adapter = async config => { calls.push(config); return { status: 200, config, headers: {}, data: { ...base, ...change } }; };
    await assert.rejects(api.inventoryService.disposeExpiredBatch({ id: 7, kind: 'product', quantity: 5 }));
    assert.equal(calls.length, 1);
  }
  api.http.defaults.adapter = async config => {
    if (config.method === 'post') throw new Error('Write failed');
    return { status: 200, config, headers: {}, data: base };
  };
  await assert.rejects(api.inventoryService.disposeExpiredBatch({ id: 7, kind: 'product', quantity: 5 }), /Write failed/);
});


test('unified catalog includes expired batches first without modifying the sellable catalog', async () => {
  const originalOverview = api.inventoryService.getOverview;
  const originalExpired = api.inventoryService.getExpiredBatches;
  const valid = { id: 1, name: 'Milk', cat: 'Dairy', stock: 10, price: 20, expiry: '2099-01-01', low: false };
  const batch = { id: 7, itemId: 1, key: 'product-7', kind: 'product', name: 'Milk', category: 'Dairy',
    unitCost: '20', quantity: 3, expiry: '2000-01-01', unit: 'liter' };
  api.inventoryService.getOverview = async () => [valid];
  api.inventoryService.getExpiredBatches = async () => [batch, { ...batch, id: 8, itemId: 1, key: 'ingredient-8', kind: 'ingredient', name: 'Cream', category: 'Ingredients' }];
  try {
    const rows = await api.inventoryService.getCatalogOverview();
    assert.deepEqual(rows.map(row => row.catalogKey || row.id), ['expired-product-7', 'expired-ingredient-8', 1]);
    assert.equal(rows[0].stock, 3); assert.equal(rows[0].expiredBatch, batch);
    assert.equal(rows[2], valid); assert.equal(valid.expiry, '2099-01-01');
    api.inventoryService.getOverview = async () => [{ ...valid, stock: 0, low: true, expiry: batch.expiry }];
    const emptyStockRows = await api.inventoryService.getCatalogOverview();
    const product = emptyStockRows.find(item => !item.expiredBatch);
    assert.equal(product.stock, 0); assert.equal(product.low, true); assert.equal(product.expiry, '');
  } finally { api.inventoryService.getOverview = originalOverview; api.inventoryService.getExpiredBatches = originalExpired; }
});


test('API base URL prefers VITE_API_URL, then VITE_API_BASE_URL, then the proxy', () => {
  for (const [env, expected] of [
    [{ VITE_API_URL: 'https://primary.example/api', VITE_API_BASE_URL: 'https://legacy.example/api' }, 'https://primary.example/api'],
    [{ VITE_API_URL: '', VITE_API_BASE_URL: 'https://legacy.example/api' }, 'https://legacy.example/api'],
    [{}, '/backend'],
  ]) {
    const output = buildSync({ stdin: { contents: "export { default } from './src/lib/api';", resolveDir: root },
      define: { 'import.meta.env': JSON.stringify(env) }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    }).outputFiles[0].text;
    const instance = new Module(path.join(root, 'tests', 'env-in-memory.cjs'), module);
    instance.filename = path.join(root, 'tests', 'env-in-memory.cjs'); instance.paths = module.paths;
    instance._compile(output, instance.filename);
    assert.equal(instance.exports.default.defaults.baseURL, expected);
  }
});

test('blocked token storage supports session requests and logout without reviving persisted tokens', async () => {
  const original = global.localStorage;
  const deny = () => { throw new Error('Storage blocked'); };
  try {
    Object.defineProperty(global, 'localStorage', { configurable: true, get: deny });
    assert.equal(api.getAccessToken(), null);
    assert.equal(api.getRefreshToken(), null);
    api.setAccessToken('memory-access'); api.setRefreshToken('memory-refresh');
    assert.equal(api.getAccessToken(), 'memory-access');
    assert.equal(api.getRefreshToken(), 'memory-refresh');
    await api.authService.getCurrentUser();
    assert.equal(calls.at(-1).headers.Authorization, 'Bearer memory-access');
    api.setAccessToken(null); api.setRefreshToken(null);
    Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: { getItem: () => 'old-token', setItem: deny, removeItem: deny } });
    assert.equal(api.getAccessToken(), null);
    assert.equal(api.getRefreshToken(), null);
    api.setAccessToken('new-memory-access'); api.setRefreshToken('new-memory-refresh');
    assert.equal(api.getAccessToken(), 'new-memory-access');
    assert.equal(api.getRefreshToken(), 'new-memory-refresh');
  } finally {
    Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: original });
    api.setAccessToken(null); api.setRefreshToken(null);
  }
});


test('manual pricing requires an explicit price per item, allows zero and rounds each line half up', () => {
  const draft = { productId: 1, name: 'Milk', stock: 100, quantity: '3', unitPrice: '', discountType: 'none', discountValue: '0' };
  for (const unitPrice of ['', 'NaN', 'Infinity', '-1', '1.001', '100000000']) assert.throws(() => api.priceLine({ ...draft, unitPrice }, false));
  assert.equal(api.priceLine({ ...draft, unitPrice: '0' }, false).total, 0n);
  assert.equal(api.priceLine({ ...draft, unitPrice: '2.99', discountType: 'percent', discountValue: '12.5' }, true).total, 785n);
  assert.equal(api.priceLine({ ...draft, quantity: '2', unitPrice: '150', discountType: 'fixed', discountValue: '50' }, true).total, 25000n);
  assert.equal(api.priceLine({ ...draft, unitPrice: '100', discountType: 'percent', discountValue: '50' }, false).discount, 0n);
  assert.throws(() => api.priceSale([{ ...draft, unitPrice: '1' }, { ...draft, unitPrice: '1' }], true), /duplicate/i);
});

test('item prices and discounts are submitted without catalog or invoice-level price defaults', async () => {
  responseData = { id: 1, subtotal: '10', total_amount: '9', change_due: '1' };
  await api.checkoutService.submit({ customer_id: null, items: [{ product_id: 1, quantity: '1', unit_price: '10', discount_type: 'fixed', discount_value: '1' }], payment_method: 'cash', amount_tendered: '10', discount_type: 'fixed', discount_value: '999' });
  const payload = JSON.parse(calls[0].data);
  assert.equal('discount_type' in payload, false);
  assert.equal('discount_value' in payload, false);
  assert.deepEqual(payload.items[0], { product_id: 1, quantity: '1.00', unit_price: '10.00', discount_type: 'fixed', discount_value: '1.00' });
  calls = [];
  await assert.rejects(api.checkoutService.submit({ customer_id: null, items: [{ product_id: 1, quantity: '1' }], payment_method: 'online' }), /price/i);
  assert.equal(calls.length, 0, 'No request is sent when a selling price is missing');
});

test('product writes omit removed prices even from legacy callers and null batch costs stay null', async () => {
  responseData = { id: 1 };
  await api.inventoryService.updateProduct(1, { name: 'Milk', categoryId: 1, price: 100, unit_price: 100 });
  assert.deepEqual(JSON.parse(calls[0].data), { name: 'Milk', category_id: 1 });
  calls = [];
  await api.inventoryService.createProduct({ name: 'Milk', categoryId: 1, stock: 2, expiry: '2099-01-01', price: 100 });
  assert.equal('unit_price' in JSON.parse(calls[0].data), false);
  assert.equal('unit_price' in JSON.parse(calls[1].data), false);
  const product = { id: 1, name: 'Milk', unit: 'unit', is_active: true, category: { name: 'Dairy', is_active: true, is_visible_to_staff: true }, unit_price: '999' };
  api.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data: config.url === '/inventory/product-batches/' ? [{ id: 2, product, status: 'available', remaining_quantity: '1', initial_quantity: '1', unit_price: null, expiration_date: '2000-01-01' }] : [] });
  assert.equal((await api.inventoryService.getExpiredBatches())[0].unitCost, null, 'A removed product price is never a cost fallback');
});

test('encoding, payment and customer-history services use the documented methods and field names', async () => {
  const payload = { request_id: '12640ab5-3b27-40d9-80f8-376bd456fbe9', transaction_date: '2026-10-01', customer_id: null, si_number: 'SI0608', note: '', payment_method: 'cash', payment_status: 'pending', amount_tendered: null, items: [{ product_id: 1, quantity: '1.00', unit_price: '12.00', discount_type: 'none', discount_value: '0.00' }] };
  responseData = { id: 3, payment_status: 'pending' };
  await api.encodingService.create(payload);
  assert.equal(calls[0].url, '/sales/encoding/'); assert.equal(calls[0].method, 'post'); assert.deepEqual(JSON.parse(calls[0].data), payload);
  await api.encodingService.updatePayment(3, { payment_status: 'paid', payment_method: 'cash', amount_tendered: '20.00' });
  assert.equal(calls[1].url, '/sales/encoding/3/payment/'); assert.equal(calls[1].method, 'patch');
  assert.deepEqual(Object.keys(JSON.parse(calls[1].data)).sort(), ['amount_tendered', 'payment_method', 'payment_status']);
  responseData = { count: 0, next: null, previous: null, results: [] };
  const history = await api.customersService.getTransactions(42, 2, true);
  assert.equal(calls[2].url, '/sales/customers/42/transactions/');
  assert.deepEqual(calls[2].params, { page: 2, page_size: 10, include_voided: true }); assert.equal(history.count, 0);
});

test('encoding and payment writes invalidate every dependent frontend cache group', async () => {
  for (const path of ['/sales/encoding/', '/sales/encoding/3/payment/']) {
    const groups = ['sales', 'orders', 'customers', 'inventory', 'dashboard', 'reports'];
    groups.forEach(group => api.writeDataCache(`handoff-${group}`, [1], [group]));
    await api.http.request({ method: path.endsWith('/payment/') ? 'patch' : 'post', url: path, data: {} });
    groups.forEach(group => assert.equal(api.readDataCache(`handoff-${group}`).updatedAt, 0, group));
  }
});

test('stock outflows preserve reason, batch kind and explicit cost and support date filters', async () => {
  for (const adjustment_type of ['spoilage', 'complimentary', 'free_taste']) {
    await api.outflowsService.create({ ingredient_batch_id: 2, adjustment_type, quantity: '2.00', unit_cost: '0.00', reason: 'Tasting event' });
    const payload = JSON.parse(calls.at(-1).data);
    assert.equal(calls.at(-1).url, '/inventory/stock-adjustments/');
    assert.equal(payload.adjustment_type, adjustment_type); assert.equal(payload.ingredient_batch_id, 2);
    assert.equal('product_batch_id' in payload, false); assert.equal(payload.unit_cost, '0.00');
  }
  responseData = [];
  await api.outflowsService.list({ adjustment_type: 'free_taste', start_date: '2026-10-01', end_date: '2026-10-20' });
  assert.deepEqual(calls.at(-1).params, { adjustment_type: 'free_taste', start_date: '2026-10-01', end_date: '2026-10-20' });
});

test('receipts group FEFO fragments by original line and use recorded net totals without repeating fixed discounts', () => {
  const sale = receiptFixture();
  sale.transaction.items = [
    { ...sale.transaction.items[0], id: 1, line_number: 1, quantity: '1', subtotal: '100', discount_amount: '10', total_amount: '90' },
    { ...sale.transaction.items[0], id: 2, line_number: 1, quantity: '2', subtotal: '200', discount_amount: '20', total_amount: '180' },
  ];
  const receipt = api.receiptDetails(sale);
  assert.equal(receipt.items.length, 1); assert.equal(receipt.items[0].quantity, '3');
  assert.equal(receipt.items[0].gross, 'PHP 300.00'); assert.equal(receipt.items[0].discount, 'PHP 30.00'); assert.equal(receipt.items[0].subtotal, 'PHP 270.00');
  sale.transaction.items[0].total_amount = null;
  assert.equal(api.receiptDetails(sale).items[0].subtotal, 'Not provided', 'Missing historical net totals are not replaced with gross amounts');
});

test('missing and duplicate SI numbers retain recorded display values with numeric transaction identity', () => {
  const base = { handled_by: { id: 7, username: 'Staff' }, created_at: '2026-10-01T04:00:00Z', payment_method: 'cash', total_amount: '10', source_invoice_number: '' };
  assert.equal(api.toSale({ ...base, id: 1, transaction_number: null }).receipt, 'Not recorded');
  assert.equal(api.toSale({ ...base, id: 2, transaction_number: 'SI0608' }).receipt, 'SI0608');
});

for (const replaceSession of [false, true]) {
  test(`a late protected 401 after ${replaceSession ? 'another login' : 'logout'} cannot clear or expire the current session`, async () => {
    api.setAccessToken('old-access'); api.setRefreshToken('old-refresh');
    let reject, unauthorized = 0, refreshes = 0;
    const remove = api.onUnauthorized(() => unauthorized++);
    api.http.defaults.adapter = config => {
      if (config.url === '/accounts/refresh/') refreshes++;
      return new Promise((_, fail) => { reject = () => fail(new AxiosError('Expired', undefined, config, undefined, { status: 401, data: {}, config, headers: {} })); });
    };
    const request = api.http.get('/sales/transactions/');
    await new Promise(resolve => setImmediate(resolve));
    api.setAccessToken(null); api.setRefreshToken(null);
    if (replaceSession) { api.setAccessToken('new-access'); api.setRefreshToken('new-refresh'); }
    reject(); await assert.rejects(request);
    assert.equal(unauthorized, 0); assert.equal(refreshes, 0);
    assert.equal(api.getAccessToken(), replaceSession ? 'new-access' : null);
    remove();
  });
}

test('a refresh that finishes after logout cannot restore tokens or emit session-expired notifications', async () => {
  api.setAccessToken('old'); api.setRefreshToken('refresh');
  let completeRefresh, unauthorized = 0;
  const remove = api.onUnauthorized(() => unauthorized++);
  api.http.defaults.adapter = config => {
    if (config.url === '/accounts/refresh/') return new Promise(resolve => { completeRefresh = () => resolve({ status: 200, data: { access: 'late-access', refresh: 'late-refresh' }, config, headers: {} }); });
    return Promise.reject(new AxiosError('Expired', undefined, config, undefined, { status: 401, data: {}, config, headers: {} }));
  };
  const request = api.http.get('/sales/transactions/');
  await new Promise(resolve => setImmediate(resolve));
  api.setAccessToken(null); api.setRefreshToken(null);
  completeRefresh(); await assert.rejects(request);
  assert.equal(api.getAccessToken(), null); assert.equal(api.getRefreshToken(), null); assert.equal(unauthorized, 0); remove();
});


test('optional inventory costs are written only to batches and explicit zero is preserved', async () => {
  responseData = { id: 7 };
  await api.inventoryService.createProduct({ name: 'Milk', categoryId: 1, stock: 1, expiry: '2099-01-01', batchCost: '0' });
  assert.equal('unit_price' in JSON.parse(calls[0].data), false);
  assert.equal(JSON.parse(calls[1].data).unit_price, 0);
  calls = [];
  await api.inventoryService.restockProduct(7, { quantity: 2, expirationDate: '2099-01-01', unitCost: '' });
  assert.equal('unit_price' in JSON.parse(calls[0].data), false);
  await assert.rejects(api.inventoryService.createProduct({ name: 'Milk', categoryId: 1, stock: 1, expiry: '2099-01-01', batchCost: '-1' }), /cost/i);
  assert.equal(calls.length, 1, 'Invalid inventory costs are rejected before product creation');
});

test('display currency remains a peso sign rather than an encoding placeholder', () => {
  assert.equal(api.formatCents(217000n), '\u20b12,170.00');
});


test('request session identity is captured synchronously before immediate logout', async () => {
  api.setAccessToken('old'); api.setRefreshToken('refresh');
  const origin = api.getSessionGeneration();
  let captured, complete;
  api.http.defaults.adapter = config => {
    captured = config.sessionGeneration;
    return new Promise(resolve => { complete = () => resolve({ status: 200, data: [], config, headers: {} }); });
  };
  const request = api.http.get('/sales/transactions/');
  api.setAccessToken(null); api.setRefreshToken(null);
  assert.equal(captured, origin);
  complete(); await assert.rejects(request, { status: 409 });
});


test('new stock-changing flows refresh mounted alert feeds only after successful writes', async () => {
  let updates = 0;
  const listener = () => updates++;
  window.addEventListener(api.INVENTORY_UPDATED, listener);
  await api.http.post('/sales/encoding/', {});
  await api.http.post('/inventory/stock-adjustments/', {});
  assert.equal(updates, 2);
  responseStatus = 400;
  await assert.rejects(api.http.post('/inventory/stock-adjustments/', {}));
  assert.equal(updates, 2);
  window.removeEventListener(api.INVENTORY_UPDATED, listener);
});

test('self user edits omit role, protect email verification and send the password for username changes', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 7 })).toString('base64url')}.signature`);
  api.http.defaults.adapter = async config => {
    calls.push(config);
    return { status: 200, config, headers: {}, data: { id: 7, username: 'before', email: 'admin@example.com' } };
  };
  const input = { username: 'after', email: 'admin@example.com', role: 'Administrator', firstName: 'Admin', currentPassword: 'test-password' };
  await api.userService.updateUser(7, input);
  const payload = JSON.parse(calls.find(call => call.method === 'patch').data);
  assert.equal('role' in payload, false);
  assert.equal('email' in payload, false);
  assert.equal(payload.current_password, 'test-password');
  assert.equal(payload.username, 'after');
  calls = [];
  await assert.rejects(api.userService.updateUser(7, { ...input, currentPassword: undefined }), /current password/i);
  assert.equal(calls.some(call => call.method === 'patch'), false);
  await assert.rejects(api.userService.updateUser(7, { ...input, email: 'other@example.com' }), /verified/i);
  calls = [];
  await api.userService.updateUser(8, input);
  assert.equal(JSON.parse(calls[0].data).role, 'admin', 'Other-user role updates remain available');
});

test('null order transactions keep every order visible without fabricating financial values', async () => {
  const base = { customer: { id: 3, name: 'Customer' }, handled_by: { id: 7, username: 'staff' },
    status: 'fulfilled', created_at: '2026-10-01T04:00:00Z', items: [] };
  responseData = { count: 3, next: null, results: [
    { ...base, id: 1, transaction: null }, { ...base, id: 2 },
    { ...base, id: 3, transaction: { total_amount: '0.00', subtotal: '0.00', discount_amount: '0.00', amount_tendered: '0.00', change_due: '0.00' } },
  ] };
  const rows = await api.ordersService.getAll();
  assert.deepEqual(rows.map(row => row.id), [3, 2, 1]);
  assert.equal(rows[0].total, 0); assert.equal(rows[0].changeDue, 0);
  for (const row of rows.slice(1)) {
    assert.equal(row.total, null); assert.equal(row.subtotal, null); assert.equal(row.discountAmount, null);
    assert.equal(row.invoiceNumber, ''); assert.equal(row.paymentMethod, null);
    assert.equal(row.staffId, 7); assert.equal(row.date, '2026-10-01');
  }
});

test('initial batch failure reports the existing product and recovery steps without deleting or recreating it', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/inventory/products/') return { status: 201, config, headers: {}, data: { id: 42, name: 'Milk' } };
    throw new AxiosError('Rejected', undefined, config, undefined, { status: 400, data: { quantity: ['Too many decimal places.'] }, config });
  };
  await assert.rejects(api.inventoryService.createProduct({ name: 'Milk', categoryId: 1, stock: 1.234, expiry: '2099-01-01' }), error => {
    assert.match(error.message, /ID 42/); assert.match(error.message, /Do not add the product again/);
    assert.match(error.message, /Restock/); assert.equal(error.status, 400); return true;
  });
  assert.deepEqual(calls.map(call => call.url), ['/inventory/products/', '/inventory/product-batches/']);
});

test('simultaneous checkout calls share one active write without refreshing reports', async () => {
  let finish;
  const payload = { customer_id: null, payment_method: 'online', items: [{ product_id: 1, quantity: '1', unit_price: '10' }] };
  api.http.defaults.adapter = config => {
    calls.push(config);
    if (config.url === '/sales/checkout/') return new Promise(resolve => { finish = () => resolve({ status: 201, config, headers: {}, data: { id: 1, subtotal: '10', total_amount: '10', change_due: null } }); });
    return Promise.resolve({ status: 200, config, headers: {}, data: {} });
  };
  const first = api.checkoutService.submit(payload), second = api.checkoutService.submit(payload);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(call => call.url === '/sales/checkout/').length, 1);
  finish();
  assert.deepEqual(await first, await second);
  assert.equal(calls.filter(call => call.url === '/api/reports/refresh/').length, 0);
});

test('ambiguous writes block checkout and order retries across reloads until explicitly reconciled', async () => {
  const previous = global.sessionStorage, storage = new Map();
  global.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  try {
    let writes = 0;
    const fail = () => { writes++; return Promise.reject(new AxiosError('timeout', AxiosError.ECONNABORTED)); };
    await assert.rejects(api.submitSaleOnce('checkout', { price: '10' }, fail), api.UnconfirmedSaleError);
    await assert.rejects(api.submitSaleOnce('checkout', { price: '11' }, fail), api.UnconfirmedSaleError);
    await assert.rejects(api.submitSaleOnce('order', { price: '10' }, fail), api.UnconfirmedSaleError);
    api.clearDataCache(); // The storage marker survives losing the in-memory attempt.
    assert.equal(api.hasUnconfirmedSale('checkout'), true);
    await assert.rejects(api.submitSaleOnce('checkout', {}, fail), api.UnconfirmedSaleError);
    assert.equal(writes, 1); assert.equal(storage.size, 1);
    api.acknowledgeUnconfirmedSale('checkout');
    assert.equal(await api.submitSaleOnce('checkout', {}, async () => 'recorded'), 'recorded');
    assert.equal(storage.size, 0);
    await assert.rejects(api.submitSaleOnce('order', {}, () => Promise.reject(new api.ApiError(400, 'Invalid tender'))), { status: 400 });
    assert.equal(api.hasUnconfirmedSale('order'), false, 'Definite validation failures remain correctable');
  } finally { api.acknowledgeUnconfirmedSale('checkout'); global.sessionStorage = previous; }
});

test('cross-tab token replacement clears cached account data and rejects a late old-session 401', async () => {
  api.setAccessToken('account-A'); api.setRefreshToken('refresh-A');
  let changes = 0;
  const remove = api.onSessionStorageChange(() => changes++);
  api.writeDataCache('private-account-data', ['account A'], ['sales']);
  const epoch = api.dataCacheEpoch(), generation = api.getSessionGeneration();
  let reject;
  api.http.defaults.adapter = config => new Promise((_, fail) => { reject = () => fail(new AxiosError('Old request', undefined, config, undefined, { status: 401, data: {}, config })); });
  const old = api.http.get('/sales/transactions/');
  localStorage.setItem('rosario_access_token', 'account-B'); localStorage.setItem('rosario_refresh_token', 'refresh-B');
  const event = new Event('storage'); Object.defineProperty(event, 'key', { value: 'rosario_access_token' });
  window.dispatchEvent(event);
  assert.equal(changes, 1); assert.ok(api.dataCacheEpoch() > epoch); assert.ok(api.getSessionGeneration() > generation);
  assert.equal(api.readDataCache('private-account-data').data, undefined);
  reject(); await assert.rejects(old, /previous session/);
  assert.equal(api.getAccessToken(), 'account-B'); assert.equal(api.getRefreshToken(), 'refresh-B');
  remove();
});

test('an action from a stale tab is stopped before it can be sent with another account token', async () => {
  api.setAccessToken('account-A'); api.setRefreshToken('refresh-A');
  const remove = api.onSessionStorageChange(() => {});
  localStorage.setItem('rosario_access_token', 'account-B'); localStorage.setItem('rosario_refresh_token', 'refresh-B');
  // The browser storage event has not been dispatched yet.
  await assert.rejects(api.http.post('/sales/checkout/', {}), error => {
    assert.equal(error.status, 409); assert.match(error.message, /another tab/); return true;
  });
  assert.equal(calls.length, 0);
  assert.equal(api.getAccessToken(), 'account-B');
  remove();
});

test('all six report previews send both inclusive date bounds and preserve default requests', async () => {
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  for (const type of ['daily_sales', 'weekly_sales', 'monthly_sales', 'customer', 'inventory', 'sarima_forecast']) {
    assert.equal(api.supportsReportDateRange(type), true);
    await api.reportsService.fetchReportPreview(type, undefined, range);
    assert.deepEqual(calls.at(-1).params, { type, ...range });
    await api.reportsService.fetchReportPreview(type);
    assert.deepEqual(calls.at(-1).params, { type });
  }
  await api.reportsService.fetchReportPreview('daily_sales', undefined, { start_date: '2000-09-01', end_date: '2000-09-01' });
  assert.equal(calls.at(-1).params.start_date, calls.at(-1).params.end_date);
  await api.reportsService.fetchReportPreview('sarima_forecast', 'weekly', range);
  assert.deepEqual(calls.at(-1).params, { type: 'sarima_forecast', period: 'weekly', ...range });
  await api.reportsService.fetchReportPreview('sarima_forecast', 'monthly');
  assert.deepEqual(calls.at(-1).params, { type: 'sarima_forecast', period: 'monthly' });
});

test('report range validation accepts same-day and leap-day ranges and uses the Manila business day', () => {
  const day = { start_date: '2026-10-22', end_date: '2026-10-22' };
  assert.deepEqual(api.validateReportDateRange('customer', day, '2026-10-22'), day);
  assert.notEqual(api.validateReportDateRange('customer', day, '2026-10-22'), day, 'Capture immutable request bounds rather than the draft object');
  assert.deepEqual(api.validateReportDateRange('daily_sales', { start_date: '2024-02-29', end_date: '2024-02-29' }, '2026-10-22'), { start_date: '2024-02-29', end_date: '2024-02-29' });
  assert.equal(api.revenueBusinessDate(new Date('2026-10-21T16:30:00Z')), '2026-10-22');
  assert.equal(api.validateReportDateRange('inventory', undefined), undefined);
});

test('invalid report ranges fail before any preview or PDF network request', async () => {
  const invalid = [
    null, {}, { start_date: '2000-01-01' }, { end_date: '2000-01-01' },
    { start_date: '', end_date: '' },
    { start_date: '2000-02-30', end_date: '2000-03-01' },
    { start_date: '2000-01-02', end_date: '2000-01-01' },
    { start_date: '9999-01-01', end_date: '9999-01-02' },
    { start_date: '0001-01-01', end_date: '2000-01-01' },
    { start_date: '2000-1-01', end_date: '2000-01-02' },
    { start_date: 20000101, end_date: '2000-01-02' },
  ];
  for (const type of ['daily_sales', 'weekly_sales', 'monthly_sales', 'customer', 'inventory', 'sarima_forecast']) {
    for (const range of invalid) {
      for (const request of [
        () => api.reportsService.fetchReportPreview(type, undefined, range),
        () => api.reportsService.downloadReportPDF(type, range),
      ]) await assert.rejects(request, error => error.status === 400 && Object.keys(error.fieldErrors).length > 0);
    }
  }
  assert.equal(calls.length, 0);
});

test('report PDFs use preview dates, isolate both cache bounds, and refresh every range after invalidation', async () => {
  responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const downloads = [];
  global.document = { createElement: () => {
    const link = { click() { downloads.push(this.download); }, remove() {} }; return link;
  }, body: { appendChild() {} } };
  const first = { start_date: '2000-09-01', end_date: '2000-09-30' };
  const changedEnd = { ...first, end_date: '2000-10-01' };
  const changedStart = { ...first, start_date: '2000-09-02' };
  await api.reportsService.downloadReportPDF('customer', first);
  await api.reportsService.downloadReportPDF('customer', first);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, { type: 'customer', ...first });
  assert.equal(calls[0].responseType, 'blob');
  assert.equal(downloads[0], 'customer-2000-09-01-to-2000-09-30.pdf');
  await api.reportsService.downloadReportPDF('customer', changedEnd);
  await api.reportsService.downloadReportPDF('customer', changedStart);
  await api.reportsService.downloadReportPDF('customer');
  assert.equal(calls.length, 4);
  await api.reportsService.refreshReportCache();
  await api.reportsService.downloadReportPDF('customer', first);
  await api.reportsService.downloadReportPDF('customer', changedEnd);
  assert.equal(calls.filter(call => call.url === '/api/reports/export-pdf/').length, 6);
  assert.notEqual(api.reportCacheKey('preview', 'customer', undefined, first), api.reportCacheKey('pdf', 'customer', undefined, first));
  assert.notEqual(api.reportCacheKey('preview', 'sarima_forecast', 'weekly'), api.reportCacheKey('preview', 'sarima_forecast', 'monthly'));
});

test('inventory and forecast previews retain their returned range metadata and report data unchanged', async () => {
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  const payloads = {
    inventory: { ...range, is_custom_range: true, as_of: '2026-10-28', ledger: { ...range, rows: [], columns: [] },
      total_products: 2, total_ingredients: 1, low_stock_count: 1, expired_batch_count: 0, expiring_soon_batch_count: 0,
      items: [], status_counts: { healthy: 2 } },
    sarima_forecast: { ...range, is_custom_range: true, is_placeholder: false, forecast: [],
      range_note: 'Requested range', planning_projection: null, warnings: ['No forecast points for this range.'] },
  };
  for (const [type, data] of Object.entries(payloads)) {
    responseData = { report_type: type, generated_at: '2026-10-28T01:00:00Z', data };
    const result = await api.reportsService.fetchReportPreview(type, undefined, range);
    assert.deepEqual(result, responseData);
    assert.equal(result.data.is_custom_range, true);
    assert.deepEqual(calls.at(-1).params, { type, ...range });
  }
});

test('inventory and forecast PDF exports use the preview bounds and keep default and custom caches separate', async () => {
  const downloads = [];
  global.document = { createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }), body: { appendChild() {} } };
  const first = { start_date: '2000-09-01', end_date: '2000-09-30' };
  const ranges = [first, { ...first, start_date: '2000-09-02' }, { ...first, end_date: '2000-10-01' }, undefined];
  for (const type of ['inventory', 'sarima_forecast']) {
    const keys = new Set(ranges.map(range => api.reportCacheKey('preview', type, undefined, range)));
    assert.equal(keys.size, 4, 'Both bounds and the default range must distinguish preview caches');
    for (const range of ranges) {
      responseData = { report_type: type, data: { ...range } };
      await api.reportsService.fetchReportPreview(type, undefined, range);
      const params = { ...calls.at(-1).params };
      responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      await api.reportsService.downloadReportPDF(type, range);
      assert.deepEqual(calls.at(-1).params, params, 'The PDF and preview must use identical dates');
      assert.equal(calls.at(-1).responseType, 'blob');
      const count = calls.length;
      await api.reportsService.downloadReportPDF(type, range);
      assert.equal(calls.length, count, 'Fresh exports should reuse only their matching range blob');
      assert.match(downloads.at(-1), range ? new RegExp(`${type}-${range.start_date}-to-${range.end_date}\\.pdf$`)
        : new RegExp(`${type}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
    }
  }
  assert.equal(calls.filter(call => call.url === '/api/reports/export-pdf/').length, 8);
  const inventoryKey = api.reportCacheKey('preview', 'inventory', undefined, first);
  const forecastKey = api.reportCacheKey('preview', 'sarima_forecast', undefined, first);
  assert.notEqual(inventoryKey, forecastKey);
  assert.notEqual(forecastKey, api.reportCacheKey('preview', 'sarima_forecast', 'weekly', first));
});

test('successful sales mutations invalidate cached previews and PDFs without posting a report refresh', async () => {
  global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  let inventoryUpdates = 0;
  window.addEventListener(api.INVENTORY_UPDATED, () => inventoryUpdates++);
  const range = { start_date: '2000-09-01', end_date: '2000-09-30' };
  for (const [method, url] of [['post', '/sales/checkout/'], ['post', '/sales/orders/'],
    ['patch', '/sales/orders/2/'], ['patch', '/sales/transactions/2/']]) {
    const previewKey = api.reportCacheKey('preview', 'inventory', undefined, range);
    const pdfKey = `${api.dataCacheEpoch()}:${api.reportCacheKey('pdf', 'inventory', undefined, range)}`;
    const loadPreview = () => api.fetchDataCache(previewKey,
      async () => (await api.reportsService.fetchReportPreview('inventory', undefined, range)).data, ['reports', 'dashboard']);
    responseData = { report_type: 'inventory', data: { is_custom_range: true, ...range } };
    await loadPreview();
    responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await api.reportsService.downloadReportPDF('inventory', range);
    assert.ok(api.readDataCache(previewKey).updatedAt > 0);
    assert.ok(api.readDataCache(pdfKey).updatedAt > 0);
    responseData = {};
    await api.http.request({ method, url, data: {} });
    assert.equal(api.readDataCache(previewKey).updatedAt, 0, `${url}: preview invalidation`);
    assert.equal(api.readDataCache(pdfKey).updatedAt, 0, `${url}: PDF invalidation`);
    const count = calls.length;
    responseData = { report_type: 'inventory', data: { is_custom_range: true, ...range } };
    await loadPreview();
    responseData = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await api.reportsService.downloadReportPDF('inventory', range);
    assert.equal(calls.length, count + 2, 'Visible reports and the next PDF export must refetch after a commit');
  }
  assert.equal(inventoryUpdates, 4);
  assert.equal(calls.filter(call => call.url === '/api/reports/refresh/').length, 0);
});

test('failed sales writes preserve report caches and do not signal committed stock changes', async () => {
  api.writeDataCache('report-preview', { saved: true }, ['reports']);
  api.writeDataCache('report-pdf', new Blob(['saved']), ['reports']);
  let changes = 0;
  window.addEventListener(api.INVENTORY_UPDATED, () => changes++);
  responseStatus = 400;
  for (const url of ['/sales/checkout/', '/sales/orders/', '/sales/transactions/2/']) {
    await assert.rejects(api.http.post(url, {}), { status: 400 });
  }
  assert.ok(api.readDataCache('report-preview').updatedAt > 0);
  assert.ok(api.readDataCache('report-pdf').updatedAt > 0);
  assert.equal(changes, 0);
});

test('concurrent manual report refreshes share one request and publish one cache update', async () => {
  let complete;
  let updates = 0;
  window.addEventListener(api.REPORTS_UPDATED, () => updates++);
  api.writeDataCache('report-preview', { saved: true }, ['reports']);
  api.http.defaults.adapter = config => {
    calls.push(config);
    return new Promise(resolve => { complete = () => resolve({ status: 200, data: {}, headers: {}, config }); });
  };
  const first = api.reportsService.refreshReportCache();
  const second = api.reportsService.refreshReportCache();
  assert.equal(first, second);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/reports/refresh/');
  assert.equal(calls[0].method, 'post');
  assert.deepEqual(JSON.parse(calls[0].data), {});
  assert.equal(updates, 0);
  assert.ok(api.readDataCache('report-preview').updatedAt > 0);
  complete();
  await Promise.all([first, second]);
  assert.equal(updates, 1);
  assert.equal(api.readDataCache('report-preview').updatedAt, 0);
});

test('manual refresh honors Retry-After seconds without requests during cooldown and retries at expiry', async () => {
  const originalNow = Date.now;
  let now = Date.UTC(2026, 9, 28, 1);
  Date.now = () => now;
  let updates = 0;
  window.addEventListener(api.REPORTS_UPDATED, () => updates++);
  api.writeDataCache('report-preview', { saved: true }, ['reports']);
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (calls.length === 1) throw new AxiosError('Throttled', undefined, config, undefined,
      { status: 429, data: { detail: 'Wait before refreshing again.' }, headers: { 'retry-after': '2' }, config });
    return { status: 200, data: {}, headers: {}, config };
  };
  try {
    await assert.rejects(api.reportsService.refreshReportCache(), error => error.status === 429 && error.retryAfterMs === 2000);
    await assert.rejects(api.reportsService.refreshReportCache(), error => error.status === 429 && error.retryAfterMs === 2000);
    now += 1999;
    await assert.rejects(api.reportsService.refreshReportCache(), error => error.status === 429 && error.retryAfterMs === 1);
    assert.equal(calls.length, 1, 'A cooldown must not bypass the server limit');
    assert.equal(updates, 0);
    assert.ok(api.readDataCache('report-preview').updatedAt > 0);
    now++;
    await api.reportsService.refreshReportCache();
    assert.equal(calls.length, 2);
    assert.equal(updates, 1);
    assert.equal(api.readDataCache('report-preview').updatedAt, 0);
  } finally { Date.now = originalNow; }
});

test('manual refresh also honors HTTP-date Retry-After headers', async () => {
  const originalNow = Date.now;
  const now = Date.UTC(2026, 9, 28, 1);
  Date.now = () => now;
  api.http.defaults.adapter = async config => {
    calls.push(config);
    throw new AxiosError('Throttled', undefined, config, undefined,
      { status: 429, data: {}, headers: { 'retry-after': new Date(now + 5000).toUTCString() }, config });
  };
  try {
    await assert.rejects(api.reportsService.refreshReportCache(), error => error.status === 429 && error.retryAfterMs === 5000);
    await assert.rejects(api.reportsService.refreshReportCache(), error => error.status === 429 && error.retryAfterMs === 5000);
    assert.equal(calls.length, 1);
  } finally { Date.now = originalNow; }
});

test('a report cooldown is isolated from a later account cache epoch', async () => {
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (calls.length === 1) throw new AxiosError('Throttled', undefined, config, undefined,
      { status: 429, data: {}, headers: { 'retry-after': '60' }, config });
    return { status: 200, data: {}, headers: {}, config };
  };
  await assert.rejects(api.reportsService.refreshReportCache(), { status: 429 });
  api.clearDataCache();
  await api.reportsService.refreshReportCache();
  assert.equal(calls.length, 2, 'The previous account must not block a new account refresh');
});

test('manual refresh never shares pending work or publishes old updates across account cache epochs', async () => {
  let completeOld;
  let updates = 0;
  window.addEventListener(api.REPORTS_UPDATED, () => updates++);
  api.http.defaults.adapter = config => {
    calls.push(config);
    if (calls.length === 1) return new Promise(resolve => { completeOld = () => resolve({ status: 200, data: {}, headers: {}, config }); });
    return Promise.resolve({ status: 200, data: {}, headers: {}, config });
  };
  const old = api.reportsService.refreshReportCache();
  await new Promise(resolve => setImmediate(resolve));
  api.clearDataCache();
  const current = api.reportsService.refreshReportCache();
  assert.notEqual(old, current);
  await current;
  assert.equal(updates, 1);
  completeOld();
  await old;
  assert.equal(calls.length, 2);
  assert.equal(updates, 1, 'A completed old request must not invalidate a newer account cache');
});

test('manual refresh recovers after network and server failures without publishing successful refreshes', async () => {
  for (const status of [null, 500, 429]) {
    api.clearDataCache();
    calls = [];
    let updates = 0;
    const listener = () => updates++;
    window.addEventListener(api.REPORTS_UPDATED, listener);
    api.http.defaults.adapter = async config => {
      calls.push(config);
      if (calls.length === 1) throw new AxiosError('Unavailable', undefined, config, undefined,
        status == null ? undefined : { status, data: {}, headers: {}, config });
      return { status: 200, data: {}, headers: {}, config };
    };
    await assert.rejects(api.reportsService.refreshReportCache());
    assert.equal(updates, 0);
    await api.reportsService.refreshReportCache();
    assert.equal(calls.length, 2, 'A rejected request must release its in-flight state');
    assert.equal(updates, 1);
    window.removeEventListener(api.REPORTS_UPDATED, listener);
  }
});

function reloadServicesForRetry() {
  const instance = new Module(path.join(root, 'tests', 'reloaded-services.cjs'), module);
  instance.filename = path.join(root, 'tests', 'reloaded-services.cjs');
  instance.paths = module.paths;
  instance._compile(compiled, instance.filename);
  return instance.exports;
}

test('encoding retains its original UUID and payload across a full module reload after timeout', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 704 })).toString('base64url')}.signature`);
  const payload = { request_id: '550e8400-e29b-41d4-a716-446655440001', transaction_date: '2000-01-01',
    customer_id: null, payment_method: 'cash', payment_status: 'pending', amount_tendered: null,
    si_number: 'SI-RETRY', note: 'Paper invoice', items: [{ product_id: 1, quantity: '2', unit_price: '10' }] };
  const lines = [{ productId: 1, name: 'Milk', stock: 5, quantity: '2', unitPrice: '10', discountType: 'none', discountValue: '0' }];
  api.http.defaults.adapter = async config => { calls.push(config); throw new AxiosError('Timed out', AxiosError.ECONNABORTED); };
  await assert.rejects(api.encodingService.create(payload, lines));
  const saved = api.encodingService.pending();
  assert.equal(saved.id, payload.request_id);
  assert.equal(saved.payload.lines[0].name, 'Milk');
  const reloaded = reloadServicesForRetry();
  assert.equal(reloaded.encodingService.pending().id, payload.request_id);
  let retried;
  reloaded.http.defaults.adapter = async config => { retried = JSON.parse(config.data); return { status: 200, config, headers: {}, data: { id: 88 } }; };
  await assert.rejects(reloaded.encodingService.create({ ...payload, note: 'Changed' }), /already attempted/);
  assert.equal(retried, undefined);
  const sale = await reloaded.encodingService.create({ ...payload, request_id: '550e8400-e29b-41d4-a716-446655440002' });
  assert.equal(sale.id, 88);
  assert.equal(retried.request_id, payload.request_id);
  assert.deepEqual(retried.items, [{ product_id: 1, quantity: '2.00', unit_price: '10.00', discount_type: 'none', discount_value: '0.00' }]);
  assert.equal(api.encodingService.pending(), null);
});

test('outflow timeout records survive reload and block another POST until history review', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 705 })).toString('base64url')}.signature`);
  const payload = { product_batch_id: 3, adjustment_type: 'spoilage', quantity: '2.00', unit_cost: '0.00', reason: 'Spoiled stock' };
  let posts = 0;
  api.http.defaults.adapter = async config => { posts++; assert.deepEqual(JSON.parse(config.data), payload); throw new AxiosError('Timed out', AxiosError.ECONNABORTED); };
  await assert.rejects(api.outflowsService.create(payload));
  const saved = api.outflowsService.pending();
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  const reloaded = reloadServicesForRetry();
  reloaded.http.defaults.adapter = async config => { posts++; return { status: 201, config, headers: {}, data: { id: 9 } }; };
  assert.equal(reloaded.outflowsService.pending().id, saved.id);
  await assert.rejects(reloaded.outflowsService.create(payload), /unconfirmed/);
  await assert.rejects(reloaded.outflowsService.create({ ...payload, quantity: '1.00' }), /unconfirmed/);
  assert.equal(posts, 1);
  reloaded.outflowsService.clearPending();
  await reloaded.outflowsService.create(payload);
  assert.equal(posts, 2);
  assert.equal(api.outflowsService.pending(), null);
});

test('outflows share an active write, clear definite validation failures and preserve account isolation', async () => {
  const token = id => `header.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.signature`;
  api.setAccessToken(token(701));
  const payload = { product_batch_id: 3, adjustment_type: 'free_taste', quantity: '1.00', unit_cost: '0.00' };
  let reject, posts = 0;
  api.http.defaults.adapter = config => { posts++; return new Promise((_, fail) => { reject = error => fail(error ?? new AxiosError('Invalid', undefined, config, undefined, { status: 400, config, headers: {}, data: { detail: 'Invalid quantity' } })); }); };
  const first = api.outflowsService.create(payload), second = api.outflowsService.create(payload);
  const failures = Promise.allSettled([first, second]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(posts, 1);
  reject(); await failures;
  assert.equal(api.outflowsService.pending(), null);
  const uncertain = api.outflowsService.create(payload); const rejected = assert.rejects(uncertain);
  await new Promise(resolve => setImmediate(resolve));
  reject(new AxiosError('Timed out', AxiosError.ECONNABORTED)); await rejected;
  const originalId = api.outflowsService.pending().id;
  api.setAccessToken(token(702));
  assert.equal(api.outflowsService.pending(), null);
  api.outflowsService.clearPending();
  api.setAccessToken(token(701));
  assert.equal(api.outflowsService.pending().id, originalId);
  api.outflowsService.clearPending();
});

test('blocked storage retains outflow guards in memory across component remounts', async () => {
  api.setAccessToken(`header.${Buffer.from(JSON.stringify({ user_id: 703 })).toString('base64url')}.signature`);
  const originalStorage = global.localStorage;
  try {
    global.localStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); }, removeItem() { throw new Error('Blocked'); } };
    let posts = 0;
    api.http.defaults.adapter = async () => { posts++; throw new Error('Offline'); };
    const payload = { ingredient_batch_id: 4, adjustment_type: 'spoilage', quantity: '1.00', unit_cost: '0.00' };
    await assert.rejects(api.outflowsService.create(payload));
    assert.ok(api.outflowsService.pending());
    await assert.rejects(api.outflowsService.create(payload), /unconfirmed/);
    assert.equal(posts, 1);
    api.outflowsService.clearPending();
    assert.equal(api.outflowsService.pending(), null);
  } finally { global.localStorage = originalStorage; }
});

test('expired batch disposal accepts available or expired status and null, zero or positive costs', async () => {
  const costs = [null, '0.00', '4.25'];
  for (const kind of ['product', 'ingredient']) for (const status of ['available', 'expired']) for (const unit_price of costs) {
    let submitted;
    api.http.defaults.adapter = async config => {
      if (config.method === 'post') submitted = JSON.parse(config.data);
      return { status: 200, config, headers: {}, data: { [kind]: { unit_price: null }, status, expiration_date: '2000-01-01', remaining_quantity: '2', unit_price, batch_number: 'B1' } };
    };
    await api.inventoryService.disposeExpiredBatch({ id: 1, kind, quantity: 2 });
    assert.equal(submitted.unit_cost, unit_price ?? '0.00');
    assert.equal(submitted.quantity, '2');
  }
});

test('user mapping retains separate multi-word first and last names for edit payloads', async () => {
  responseData = [{ id: 8, username: 'juan', first_name: 'Juan Miguel', last_name: 'Dela Cruz', email: 'juan@example.com', role: 'staff', is_active: true, deactivation_reason: 'none', last_login: null }];
  const [user] = await api.userService.getAll();
  assert.equal(user.firstName, 'Juan Miguel'); assert.equal(user.lastName, 'Dela Cruz');
  assert.equal(user.name, 'Juan Miguel Dela Cruz');
  await api.userService.updateUser(8, { username: user.username, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName });
  assert.equal(JSON.parse(calls.at(-1).data).first_name, 'Juan Miguel');
  assert.equal(JSON.parse(calls.at(-1).data).last_name, 'Dela Cruz');
});

test('recorded cashier takes precedence and unknown historical cashiers never fall back to the entry owner', () => {
  const base = { id: 1, handled_by: { id: 7, username: 'entry-owner' }, created_at: '2026-10-01T00:00:00Z',
    total_amount: '10.00', payment_method: 'cash', items: [] };
  assert.equal(api.toSale({ ...base, recorded_cashier: { id: 8, username: 'original-cashier' } }).cashier, 'original-cashier');
  for (const fields of [{ recorded_cashier: null }, { recorded_cashier: null, is_manually_encoded: true },
    { recorded_cashier: null, source_reference: 'imported' }, { source_reference: 'legacy-import' },
    { is_manually_encoded: true }, { encoded_at: '2026-10-02T00:00:00Z' }]) {
    const sale = api.toSale({ ...base, ...fields });
    assert.equal(sale.cashier, 'Not recorded');
    assert.equal(api.receiptDetails(sale).fields.find(([label]) => label === 'Cashier')[1], 'Not recorded');
  }
  assert.equal(api.toSale(base).cashier, 'entry-owner', 'Legacy live receipts retain their known handler');
});

test('inbox read, dismiss and restore preserve business caches while actual settings saves invalidate them', async () => {
  api.setAccessToken(null); api.setRefreshToken(null);
  const groups = ['settings', 'inventory', 'dashboard', 'reports'];
  for (const group of groups) await api.fetchDataCache(`ack-test:${group}`, async () => [1], [group]);
  for (const action of ['read', 'dismiss', 'restore']) {
    await api.notificationsService.update(action, [{ id: 'server-alert', revision: 'a'.repeat(64) }]);
    assert.equal(calls.at(-1).url, '/settings/inbox/');
    assert.deepEqual(JSON.parse(calls.at(-1).data), { action, notifications: [{ id: 'server-alert', revision: 'a'.repeat(64) }] });
    for (const group of groups) assert.ok(api.readDataCache(`ack-test:${group}`).updatedAt > 0, `${action} keeps ${group} fresh`);
  }
  await api.settingsService.updateInventory({ low_stock_threshold: 0 });
  for (const group of groups) assert.equal(api.readDataCache(`ack-test:${group}`).updatedAt, 0);
});

test('order cashier display uses recorded identity without changing staff ownership scoping', () => {
  const order = { id: 1, status: 'fulfilled', created_at: '2026-10-01T00:00:00Z', items: [],
    customer: { id: 1, name: 'Customer' }, handled_by: { id: 7, username: 'entry-owner' },
    transaction: { recorded_cashier: { id: 8, username: 'recorded-cashier' } } };
  assert.equal(api.mapOrder(order).staff, 'recorded-cashier');
  assert.equal(api.mapOrder(order).staffId, 7, 'Staff filtering continues to use the order processor ID');
  assert.equal(api.mapOrder({ ...order, transaction: { recorded_cashier: null, is_manually_encoded: true } }).staff, 'Not recorded');
});

test('catalog shares one product-batch request per load and reads fresh batches after invalidation', async () => {
  const product = { id: 1, name: 'Milk', unit: 'L', is_active: true, total_stock: '10.00', low_stock_threshold: 2,
    category: { id: 1, name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  const batch = { id: 7, product, batch_number: 'B7', status: 'available', remaining_quantity: '10.00',
    initial_quantity: '10.00', expiration_date: '2099-01-01', date_received: api.businessDate(), unit_price: null };
  let batchRequests = 0;
  api.http.defaults.adapter = async config => {
    let data;
    if (config.url === '/inventory/products/') data = [product];
    else if (config.url === '/inventory/product-batches/') { batchRequests++; data = [batch]; }
    else if (config.url === '/inventory/ingredient-batches/') data = [];
    else if (config.url === '/settings/inventory/') data = { near_expiry_threshold: 7, critical_expiry_threshold: 3 };
    else throw new Error(`Unexpected request: ${config.url}`);
    return { status: 200, config, headers: {}, data };
  };
  assert.equal((await api.inventoryService.getCatalogOverview())[0].stock, 10);
  assert.equal(batchRequests, 1);
  product.total_stock = batch.remaining_quantity = '2.00';
  api.invalidateDataCache(['inventory']);
  assert.equal((await api.inventoryService.getCatalogOverview())[0].stock, 2);
  assert.equal(batchRequests, 2);
  const successfulAdapter = api.http.defaults.adapter;
  api.http.defaults.adapter = config => config.url === '/inventory/product-batches/'
    ? Promise.reject(new Error('Batch feed offline')) : successfulAdapter(config);
  api.invalidateDataCache(['inventory']);
  await assert.rejects(api.inventoryService.getCatalogOverview(), /Batch feed offline/);
  api.http.defaults.adapter = successfulAdapter;
  assert.equal((await api.inventoryService.getCatalogOverview())[0].stock, 2);
  assert.equal(batchRequests, 3, 'A failed batch load can be retried without a stuck shared request');
});

test('expired outflow choices include stocked expired batches, excluding disposed, empty and future receipts', async () => {
  const product = { id: 1, name: 'Milk', unit: 'L', is_active: true, total_stock: '0', low_stock_threshold: 2,
    category: { id: 1, name: 'Dairy', is_active: true, is_visible_to_staff: true } };
  const batch = { product, id: 1, batch_number: 'EX', status: 'expired', remaining_quantity: '2', initial_quantity: '2',
    expiration_date: '2000-01-01', date_received: '2000-01-01', unit_price: null };
  api.http.defaults.adapter = async config => ({ status: 200, config, headers: {}, data:
    config.url === '/inventory/product-batches/' ? [batch, { ...batch, id: 2, status: 'disposed' },
      { ...batch, id: 3, remaining_quantity: '0' }, { ...batch, id: 4, date_received: '2099-01-01' }] :
    config.url === '/inventory/products/' ? [product] : [] });
  const choices = await api.outflowsService.batches();
  assert.deepEqual(choices.map(item => [item.id, item.status]), [[1, 'expired']]);
  assert.equal(api.canDisposeExpiredBatch({ status: 'expired', quantity: 2, expiry: '2000-01-01', dateReceived: '2000-01-01' }), true);
  const warning = api.getInventoryWarnings({ expiry: '2099-01-01', stock: 2, low: false, expiredBatch: { status: 'expired' } });
  assert.equal(warning.status, 'Expired'); assert.equal(warning.nearExpiry, false);
  assert.deepEqual((await api.inventoryService.getExpiredBatches()).map(item => item.id), [1]);
  assert.equal((await api.inventoryService.getAll(true))[0].stock, 0, 'Disposal eligibility never makes expired stock sellable');
});
