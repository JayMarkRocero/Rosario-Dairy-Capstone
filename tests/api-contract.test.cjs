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
    export * from './src/features/auth/api/auth.service';
    export * from './src/features/settings/api/settings.service';
    export * from './src/features/inventory/api/inventory.service';
    export * from './src/features/reports/api/reports.service';
    export * from './src/lib/notifications.service';
  `, resolveDir: root },
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
