const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const { createBrowserLocks } = require('./browser-locks.cjs');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export * from './src/lib/api'; export {default as http} from './src/lib/api';
  export * from './src/lib/idleSession'; export * from './src/lib/dataCache';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const sid = '11111111-1111-4111-8111-111111111111', otherSid = '22222222-2222-4222-8222-222222222222';
const token = (version = 1, id = sid) => `h.${Buffer.from(JSON.stringify({ user_id: 7, sid: id, version })).toString('base64url')}.s`;
const policy = (id = sid) => ({ id, idle_timeout_seconds: 900, warning_seconds: 60,
  server_time: new Date().toISOString(), last_activity_at: new Date(Date.now() - 1000).toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString() });
const reply = (config, data) => ({ config, data, status: 200, headers: {}, statusText: 'OK' });
const rejected = (config, code = 'token_not_valid') => new AxiosError('Unauthorized', undefined, config, undefined, { config, status: 401, headers: {}, data: { code } });
const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
let a, b, values, requests, expired, storage;
function load() {
  const mod = new Module(path.join(root, 'tests', 'refresh-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'refresh-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); return mod.exports;
}
async function until(condition) {
  for (let n = 0; n < 200; n++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
  assert.fail('Expected request lifecycle did not settle');
}
beforeEach(() => {
  values = new Map(); requests = []; expired = 0;
  storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  global.localStorage = storage; global.window = new EventTarget();
  Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: createBrowserLocks() } });
  a = load(); b = load();
  for (const api of [a, b]) { api.setAccessToken(token()); api.setRefreshToken('refresh-1'); api.acceptIdleSession(policy()); api.onUnauthorized(() => expired++); }
});
afterEach(() => { if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator); else delete global.navigator; });

test('two tabs share one rotating refresh, preserve open-session caches and retry each authorized read once', async () => {
  let finish, changes = 0;
  a.onSessionStorageChange(() => changes++); b.onSessionStorageChange(() => changes++);
  b.writeDataCache('retained-rows', ['rows'], ['sales']);
  const adapter = async config => {
    requests.push(config);
    if (config.url === '/accounts/refresh/') return new Promise(resolve => { finish = () => resolve(reply(config, { access: token(2), refresh: 'refresh-2', session: policy() })); });
    if (config.headers.Authorization === `Bearer ${token()}`) throw rejected(config);
    return reply(config, ['fresh']);
  };
  a.http.defaults.adapter = b.http.defaults.adapter = adapter;
  const first = a.http.get('/sales/transactions/'), second = b.http.get('/sales/transactions/');
  await until(() => !!finish); assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 1);
  finish(); const results = await Promise.all([first, second]);
  assert.ok(results.every(r => r.data[0] === 'fresh')); assert.equal(expired, 0);
  assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 1);
  assert.equal(a.getRefreshToken(), 'refresh-2'); assert.equal(b.getRefreshToken(), 'refresh-2');
  assert.deepEqual(b.readDataCache('retained-rows').data, ['rows']); assert.equal(changes, 0);
});
test('a late old-access 401 uses the already rotated token without rotating again', async () => {
  let failOld;
  a.http.defaults.adapter = config => {
    if (config.headers.Authorization === `Bearer ${token()}`) return new Promise((_, reject) => { failOld = () => reject(rejected(config)); });
    requests.push(config); return Promise.resolve(reply(config, ['fresh']));
  };
  const request = a.http.get('/sales/transactions/'); await until(() => !!failOld);
  b.setAccessToken(token(2), true); b.setRefreshToken('refresh-2');
  failOld(); await request;
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/sales/transactions/');
  assert.equal(requests[0].headers.Authorization, `Bearer ${token(2)}`); assert.equal(expired, 0);
});
test('a stale refresh rejection cannot erase newer same-session credentials', async () => {
  let failRefresh;
  a.http.defaults.adapter = async config => {
    if (config.url === '/accounts/refresh/') return new Promise((_, reject) => { failRefresh = () => reject(rejected(config)); });
    if (config.headers.Authorization === `Bearer ${token()}`) throw rejected(config);
    return reply(config, ['fresh']);
  };
  const request = a.http.get('/sales/transactions/'); await until(() => !!failRefresh);
  b.setAccessToken(token(2), true); b.setRefreshToken('refresh-2'); failRefresh();
  await request; assert.equal(a.getAccessToken(), token(2)); assert.equal(a.getRefreshToken(), 'refresh-2'); assert.equal(expired, 0);
});
test('new sign-in is never replaced or signed out by an old terminal refresh response', async () => {
  let failRefresh;
  a.http.defaults.adapter = async config => {
    if (config.url === '/accounts/refresh/') return new Promise((_, reject) => { failRefresh = () => reject(rejected(config, 'session_idle_timeout')); });
    throw rejected(config);
  };
  const request = a.http.get('/sales/transactions/'); const failure = assert.rejects(request);
  await until(() => !!failRefresh);
  b.setAccessToken(token(1, otherSid)); b.setRefreshToken('independent-refresh'); b.acceptIdleSession(policy(otherSid));
  failRefresh(); await failure; assert.equal(a.getAccessToken(), token(1, otherSid)); assert.equal(expired, 0);
});
for (const kind of ['absent', 'denied', 'storage-blocked', 'storage-full', 'silent-storage']) test(`${kind} coordination fails closed without rotating or clearing credentials`, async () => {
  if (kind === 'absent') delete navigator.locks;
  if (kind === 'denied') navigator.locks.request = async () => { throw new Error('Denied'); };
  if (kind.startsWith('storage') || kind === 'silent-storage') global.localStorage = { ...storage,
    getItem(key) { if (kind === 'storage-blocked' && key === 'rosario:refresh-attempt') throw Error('Blocked'); return storage.getItem(key); },
    setItem(key, value) { if (key === 'rosario:refresh-attempt') { if (kind === 'silent-storage') return; throw Error('Quota'); } storage.setItem(key, value); },
  };
  a.http.defaults.adapter = async config => { requests.push(config); throw rejected(config); };
  await assert.rejects(a.http.get('/sales/transactions/'), error => error.status === 503);
  assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 0); assert.equal(expired, 0); assert.equal(a.getAccessToken(), token());
});
test('ambiguous refresh cannot be repeated by another tab or after reload', async () => {
  const adapter = async config => {
    requests.push(config);
    if (config.url === '/accounts/refresh/') throw new AxiosError('Timeout', AxiosError.ETIMEDOUT, config);
    throw rejected(config);
  };
  a.http.defaults.adapter = adapter; await assert.rejects(a.http.get('/sales/transactions/'));
  const reloaded = load(); reloaded.http.defaults.adapter = adapter;
  await assert.rejects(reloaded.http.get('/sales/transactions/'), /could not be confirmed/);
  assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 1); assert.equal(expired, 0);
  assert.equal(a.getRefreshToken(), 'refresh-1'); assert.ok(!values.get('rosario:refresh-attempt').includes('refresh-1'));
});
test('refresh Retry-After is shared across tabs and expires without dropping credentials', async () => {
  const adapter = async config => {
    requests.push(config);
    if (config.url !== '/accounts/refresh/') throw rejected(config);
    throw new AxiosError('Throttled', undefined, config, undefined, { config, status: 429, headers: { 'retry-after': '45' }, data: {} });
  };
  a.http.defaults.adapter = b.http.defaults.adapter = adapter;
  await assert.rejects(a.http.get('/sales/transactions/'), error => error.status === 429);
  await assert.rejects(b.http.get('/sales/transactions/'), error => error.status === 429 && error.retryAfterMs > 0);
  assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 1); assert.equal(expired, 0);
  const saved = JSON.parse(values.get('rosario:refresh-attempt')); saved.retryAt = Date.now() - 1; values.set('rosario:refresh-attempt', JSON.stringify(saved));
  await assert.rejects(b.http.get('/sales/transactions/'), error => error.status === 429);
  assert.equal(requests.filter(r => r.url === '/accounts/refresh/').length, 2); assert.equal(a.getAccessToken(), token());
});
test('queued refresh stops after logout or the authoritative idle deadline', async () => {
  let release;
  const held = navigator.locks.request('rosario:token-refresh', {}, () => new Promise(resolve => { release = resolve; }));
  await until(() => !!release);
  const request = a.refreshAccessToken(); const failed = assert.rejects(request);
  b.endIdleSession('session_idle_timeout'); release(); await held; await failed;
  assert.equal(a.getAccessToken(), null); assert.equal(a.getRefreshToken(), null); assert.equal(requests.length, 0);
});
