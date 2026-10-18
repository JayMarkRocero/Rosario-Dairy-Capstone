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
    export * from './src/hooks/useAutoPageSize';
    export * from './src/features/pos/api/checkout.service';
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
  api.clearDataCache();
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
    assert.deepEqual(order.items, [{ product: name, quantity: 2, unitPrice: 5, subtotal: 10 }]);
    assert.equal((await api.ordersService.getRecent())[0].items[0].product, name);
  }
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
  assert.equal(rows[0].price, 50);
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
  assert.match(api.forecastExplanation({status:'ready',forecast:[]}), /unavailable/);
});

test('checkout retains authoritative returned prices for the saved receipt', async () => {
  responseData = { id: 42, handled_by:{id:2,username:'Cashier'}, created_at:'2026-10-08T03:00:00Z', payment_method:'cash', subtotal:'60.00', discount_amount:'0.00', total_amount:'60.00', amount_tendered:'100.00', change_due:'40.00', items:[{ id:1, quantity:'1', unit_price:'60.00', product_name_snapshot:'Milk', product_batch:{batch_number:'B1',product:{name:'Milk'}} }] };
  const result = await api.checkoutService.submit({ items:[{productId:385,quantity:1}],paymentMethod:'Cash',discountType:'none',discountValue:0,amountTendered:100 });
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
    const data = config.url === '/settings/inbox/' ? inbox : [{ id: 1, expiration_date: date,
      expiry_status: config.url.endsWith('/products/') ? 'critical' : 'near_expiry' }];
    return { status: 200, config, headers: {}, data };
  };
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items[0], { ...inbox[0], expiry: { status: 'critical', daysLeft: 5 } });
  assert.deepEqual(items[1], { ...inbox[1], expiry: { status: 'near_expiry', daysLeft: 5 } });
  assert.deepEqual(items[2], inbox[2]);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/inventory/product-batches/', '/inventory/ingredient-batches/', '/inventory/expiring/products/', '/inventory/expiring/ingredients/']);
});

test('expiry enrichment keeps inbox alerts if a feed fails and avoids guessing critical windows', async () => {
  const inbox = [{ id: 'expiry-product-1' }, { id: 'expiry-ingredient-2' }];
  api.http.defaults.adapter = async config => {
    if (config.url.endsWith('/products/')) throw new Error('Feed unavailable');
    return { status: 200, config, headers: {}, data: config.url === '/settings/inbox/' ? inbox : [{ id: 2, expiration_date: '2099-01-01', expiry_status: 'near_expiry' }] };
  };
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items[0], inbox[0]);
  assert.equal(items[1].expiry.status, 'near_expiry');
  responseData = [];
  api.http.defaults.adapter = async config => { calls.push(config); return { status: 200, config, headers: {}, data: [] }; };
  assert.deepEqual(await api.notificationsService.getAllWithExpiry(), []);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
});


test('server expiry metadata includes expired items without redundant feed requests', async () => {
  responseData = [{ id: 'expiry-product-1', revision: 'a'.repeat(64), unread: true, dismissed: false,
    expiry: { status: 'expired', daysLeft: -3 } }];
  const items = await api.notificationsService.getAllWithExpiry();
  assert.deepEqual(items, responseData);
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
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
    const data = config.url === '/settings/inbox/' ? inbox : config.url === '/inventory/product-batches/' ? [
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
  assert.deepEqual(calls.map(call => call.url), ['/settings/inbox/', '/inventory/product-batches/', '/inventory/ingredient-batches/']);
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
  complete(); await pending;
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
  for (const change of [{ remaining_quantity: '4' }, { status: 'expired' }, { status: 'disposed' },
    { expiration_date: '2099-01-01' }, { unit_price: '-1' }, { remaining_quantity: '0' }]) {
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
