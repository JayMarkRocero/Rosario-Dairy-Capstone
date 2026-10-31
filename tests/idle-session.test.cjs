const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { AxiosError } = require('axios');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export * from './src/lib/idleSession';
  export * from './src/lib/api';
  export { default as http } from './src/lib/api';
  export * from './src/features/auth/sessionActivity';
  export { authService } from './src/features/auth/api/auth.service';
  export * from './src/lib/dataCache';
  export { startLiveUpdates } from './src/lib/liveEvents';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const original = { window: global.window, document: global.document, localStorage: global.localStorage,
  navigator: Object.getOwnPropertyDescriptor(global, 'navigator'), performance: Object.getOwnPropertyDescriptor(global, 'performance'),
  setTimeout, clearTimeout, setInterval, clearInterval, date: Date.now, fetch: global.fetch };
const sid = '11111111-1111-4111-8111-111111111111', otherSid = '22222222-2222-4222-8222-222222222222';
const base = Date.parse('2026-10-31T08:00:00Z');
const token = (id = sid) => `header.${Buffer.from(JSON.stringify({ user_id: 7, sid: id })).toString('base64url')}.signature`;
let api, time, wall, timers, seq, storage, stops, requests, serverExpiry, serverActivity, state;
function load() {
  const loaded = new Module(path.join(root, 'tests', 'idle-memory.cjs'), module);
  loaded.filename = path.join(root, 'tests', 'idle-memory.cjs'); loaded.paths = module.paths;
  loaded._compile(compiled, loaded.filename); return loaded.exports;
}
function snapshot(id = sid, overrides = {}) {
  return { id, idle_timeout_seconds: 900, warning_seconds: 60,
    server_time: new Date(base + time).toISOString(), last_activity_at: new Date(base + serverActivity).toISOString(),
    idle_expires_at: new Date(base + serverExpiry).toISOString(), ...overrides };
}
const response = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data });
function failure(config, status, code, headers = {}) {
  return new AxiosError('Request failed', undefined, config, undefined, { config, status, headers, data: { detail: 'Session error', code } });
}
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
async function tick(ms) {
  const end = time + ms;
  for (let count = 0; count < 2000; count++) {
    const next = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) { wall += end - time; time = end; await settle(); return; }
    const [id, item] = next; wall += item.at - time; time = item.at;
    if (item.interval) item.at += item.interval; else timers.delete(id);
    item.fn(); await settle();
  }
  throw new Error('Unbounded timer loop');
}
function input(name = 'keydown', trusted = true) {
  const event = new Event(name); if (trusted) Object.defineProperty(event, 'isTrusted', { value: true });
  window.dispatchEvent(event);
}
const posts = () => requests.filter(request => request.url === '/accounts/session/activity/');
async function start() {
  const controller = api.startSessionActivity(value => { state = value; });
  stops.push(() => controller.stop()); await settle(); return controller;
}
beforeEach(() => {
  time = 0; wall = base; timers = new Map(); seq = 0; storage = new Map(); stops = []; requests = []; serverExpiry = 900_000; serverActivity = 0;
  global.window = new EventTarget(); global.document = new EventTarget(); document.visibilityState = 'visible';
  Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: true, locks: require('./browser-locks.cjs').createBrowserLocks() } });
  Object.defineProperty(global, 'performance', { configurable: true, value: { now: () => time } });
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const schedule = (fn, delay = 0, interval = 0) => { const id = ++seq; timers.set(id, { fn, at: time + delay, interval }); return id; };
  global.setTimeout = (fn, delay) => schedule(fn, delay); global.setInterval = (fn, delay) => schedule(fn, delay, delay);
  global.clearTimeout = global.clearInterval = id => timers.delete(id); Date.now = () => wall;
  api = load(); api.setAccessToken(token()); api.setRefreshToken('refresh'); api.acceptIdleSession(snapshot());
  api.http.defaults.adapter = async config => {
    requests.push(config);
    if (time >= serverExpiry) throw failure(config, 401, 'session_idle_timeout');
    if (config.url === '/accounts/session/activity/') { serverActivity = time; serverExpiry = time + 900_000; }
    return response(config, snapshot());
  };
});
afterEach(() => {
  stops.forEach(stop => stop());
  Object.assign(global, { window: original.window, document: original.document, localStorage: original.localStorage,
    setTimeout: original.setTimeout, clearTimeout: original.clearTimeout, setInterval: original.setInterval, clearInterval: original.clearInterval, fetch: original.fetch });
  for (const key of ['navigator', 'performance']) { if (original[key]) Object.defineProperty(global, key, original[key]); else delete global[key]; }
  Date.now = original.date;
});

test('session endpoints use bearer GET and an empty activity object without extra CORS headers; server policy is retained', async () => {
  await api.authService.getSession(); await api.authService.reportActivity();
  assert.deepEqual(requests.map(r => [r.method, r.url]), [['get', '/accounts/session/'], ['post', '/accounts/session/activity/']]);
  assert.equal(requests[1].data, '{}'); assert.equal(requests[0].headers.Authorization, `Bearer ${token()}`);
  assert.equal(requests[0].headers['Cache-Control'], undefined); assert.deepEqual(api.getIdleSession(), snapshot());
});
test('wrong-session, invalid and stale metadata cannot shorten or revive a confirmed session', async () => {
  assert.equal(api.acceptIdleSession(snapshot(otherSid)), false);
  assert.equal(api.acceptIdleSession(snapshot(sid, { warning_seconds: 900 })), false);
  assert.equal(api.acceptIdleSession(snapshot(sid, { server_time: 'invalid' })), false);
  time = 10_000; serverActivity = time; serverExpiry += time;
  assert.equal(api.acceptIdleSession(snapshot()), true);
  assert.equal(api.acceptIdleSession(snapshot(sid, { server_time: new Date(base).toISOString(), idle_expires_at: new Date(base + 900_000).toISOString() })), false);
  assert.equal(api.remainingSessionMs(), 900_000);
  api.endIdleSession('session_idle_timeout');
  assert.equal(api.acceptIdleSession(snapshot()), false); assert.equal(api.getAccessToken(), null);
});
test('idle warning and exact expiry use server time, clear private cache, and never POST/logout/replay', async () => {
  let reason; api.onUnauthorized(value => { reason = value; });
  api.writeDataCache('private', ['sensitive'], ['sales']);
  storage.set('rosario:pending-encoding:7', 'durable uncertain submission');
  await start(); await tick(839_000); assert.equal(state.warning, false);
  await tick(1000); assert.equal(state.warning, true); assert.equal(state.seconds, 60);
  await tick(60_000); assert.equal(reason, 'session_idle_timeout'); assert.equal(api.getAccessToken(), null);
  assert.equal(api.readDataCache('private').data, undefined); assert.equal(posts().length, 0);
  assert.equal(storage.get('rosario:pending-encoding:7'), 'durable uncertain submission', 'Keep duplicate-sale recovery evidence');
  assert.equal(requests.some(r => r.url === '/accounts/logout/'), false);
});
test('synthetic input, focus, visibility, reconnect and background requests never extend idle expiry', async () => {
  await start(); input('keydown', false); input('pointerdown', false);
  window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online'));
  await api.http.get('/sales/transactions/'); await tick(60_000);
  assert.equal(posts().length, 0); assert.equal(api.remainingSessionMs(), 840_000);
});
test('UA-trusted programmatic scrolling and passive pointer movement do not count as activity', async () => {
  await start(); input('scroll'); input('pointermove'); await tick(2000); assert.equal(posts().length, 0);
  input('wheel'); input('scroll'); await tick(1000); assert.equal(posts().length, 1);
  await tick(31_000); input('scroll'); await tick(2000); assert.equal(posts().length, 1);
});
test('trusted input is coalesced below the throttle and stops sending after the final interaction', async () => {
  await start();
  for (let index = 0; index < 100; index++) input(index % 2 ? 'pointerdown' : 'keydown');
  await tick(1000); assert.equal(posts().length, 1); assert.equal(api.remainingSessionMs(), 900_000);
  for (let index = 0; index < 12; index++) { input(); await tick(5000); }
  assert.ok(posts().length <= 3); const count = posts().length;
  await tick(30_000); const finalCount = posts().length;
  assert.ok(finalCount <= count + 1); await tick(300_000); assert.equal(posts().length, finalCount);
});
test('warning continuation stays visible on network failure and closes only on confirmed extension', async () => {
  const control = await start(); await tick(840_000);
  api.http.defaults.adapter = async config => { requests.push(config); throw new Error('offline transport'); };
  assert.equal(await control.continueSession(), false); assert.equal(state.warning, true); assert.ok(state.error);
  assert.equal(api.remainingSessionMs(), 60_000);
  await tick(30_000);
  let finish;
  api.http.defaults.adapter = config => new Promise(resolve => { finish = () => { serverActivity = time; serverExpiry = time + 900_000; resolve(response(config, snapshot())); }; });
  const pending = control.continueSession(); await settle(); assert.equal(state.warning, true); assert.equal(state.busy, true);
  finish(); assert.equal(await pending, true); assert.equal(state.warning, false); assert.equal(api.remainingSessionMs(), 900_000);
});
test('429 Retry-After blocks continuation duplicates without automatic retries or fake deadline extensions', async () => {
  const control = await start(); await tick(840_000);
  api.http.defaults.adapter = async config => { requests.push(config); throw failure(config, 429, undefined, { 'retry-after': '45' }); };
  await control.continueSession(); assert.equal(posts().length, 1);
  await tick(31_000); assert.equal(await control.continueSession(), false); assert.equal(posts().length, 1);
  assert.match(state.error, /14 seconds/); await tick(14_000); assert.equal(posts().length, 1);
});
test('offline activity never extends deadlines; resume GET reconciles without activity', async () => {
  await start(); navigator.onLine = false; input(); await tick(5000);
  assert.equal(posts().length, 0); assert.equal(api.remainingSessionMs(), 895_000);
  document.visibilityState = 'hidden'; input(); await tick(5000); assert.equal(posts().length, 0);
  navigator.onLine = true; document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await settle();
  assert.equal(requests.filter(r => r.url === '/accounts/session/').length, 2); assert.equal(posts().length, 0);
});
test('wall-clock jumps cannot extend, prematurely expire or rewind the same confirmed snapshot', async () => {
  await start(); wall += 86_400_000; await tick(1000); assert.equal(api.remainingSessionMs(), 899_000);
  wall -= 172_800_000; await tick(1000); assert.equal(api.remainingSessionMs(), 898_000);
  await tick(838_000); assert.equal(state.seconds, 60); assert.equal(state.warning, true);
});
test('clock rollback does not permanently block activity or Retry-After completion', async () => {
  const control = await start(); await control.continueSession();
  await control.continueSession(); // Capture the shared throttle before the clock changes.
  wall -= 86_400_000; await tick(30_000);
  assert.equal(await control.continueSession(), true); assert.equal(posts().length, 2);
});
for (const code of ['session_idle_timeout', 'session_required']) test(`${code} blocks mutation replay and ordinary JWT refresh, including blob failures`, async () => {
  let reason; api.onUnauthorized(value => { reason = value; });
  api.http.defaults.adapter = async config => { requests.push(config); const error = failure(config, 401, code);
    if (code === 'session_required') error.response.data = new Blob([JSON.stringify(error.response.data)], { type: 'application/json' });
    throw error; };
  await assert.rejects(api.http.patch('/sales/encoding/3/payment/', { payment_status: 'paid' }), error => error.code === code);
  assert.equal(requests.length, 1); assert.equal(reason, code); assert.equal(api.getAccessToken(), null);
});
test('ordinary access expiry still rotates tokens and reconciles session metadata before one retry', async () => {
  api.http.defaults.adapter = async config => {
    requests.push(config);
    if (requests.length === 1) throw failure(config, 401, 'token_not_valid');
    if (config.url === '/accounts/refresh/') return response(config, { access: token(), refresh: 'rotated', session: snapshot() });
    return response(config, ['fresh']);
  };
  assert.deepEqual((await api.http.get('/sales/transactions/')).data, ['fresh']);
  assert.equal(requests.length, 3); assert.equal(api.getRefreshToken(), 'rotated'); assert.equal(api.getIdleSession().id, sid);
});
test('terminal refresh failure preserves inactivity reason and never retries the original write', async () => {
  let reason; api.onUnauthorized(value => { reason = value; });
  api.http.defaults.adapter = async config => { requests.push(config); throw failure(config, 401, requests.length === 1 ? 'token_not_valid' : 'session_idle_timeout'); };
  await assert.rejects(api.http.post('/sales/orders/', {}), error => error.code === 'session_idle_timeout');
  assert.equal(requests.length, 2); assert.equal(reason, 'session_idle_timeout');
});
test('deadline guard rejects a business write before dispatch even while no warning UI is mounted', async () => {
  time = 900_000;
  await assert.rejects(api.http.post('/sales/checkout/', {}), error => error.code === 'session_idle_timeout');
  assert.equal(requests.length, 0); assert.equal(api.getAccessToken(), null);
});
test('same-session tabs share confirmed extensions, activity throttle and terminal cleanup', async () => {
  const second = load(); second.setAccessToken(token()); second.setRefreshToken('refresh'); second.reconcileStoredSession();
  time = 100_000; serverActivity = time; serverExpiry = time + 900_000; api.acceptIdleSession(snapshot());
  second.reconcileStoredSession(); assert.equal(second.remainingSessionMs(), 900_000);
  const firstControl = await start();
  second.http.defaults.adapter = api.http.defaults.adapter;
  const secondControl = second.startSessionActivity(() => {}); stops.push(() => secondControl.stop()); await settle();
  assert.equal(await firstControl.continueSession(), true); assert.equal(await secondControl.continueSession(), false);
  assert.equal(posts().length, 1);
  second.endIdleSession('session_idle_timeout'); api.reconcileStoredSession(); assert.equal(api.getAccessToken(), null);
});
test('a late tab response cannot overwrite a newer shared deadline', () => {
  const second = load(); second.setAccessToken(token()); second.setRefreshToken('refresh'); second.reconcileStoredSession();
  time = 100_000; serverActivity = time; serverExpiry = time + 900_000; api.acceptIdleSession(snapshot());
  const newer = storage.get(`rosario:idle-session:${sid}`);
  second.acceptIdleSession(snapshot(sid, { server_time: new Date(base + 50_000).toISOString(), last_activity_at: new Date(base).toISOString(), idle_expires_at: new Date(base + 950_000).toISOString() }));
  assert.equal(storage.get(`rosario:idle-session:${sid}`), newer);
  assert.equal(second.getIdleSession().idle_expires_at, snapshot().idle_expires_at);
});
test('a session with unknown policy blocks business writes until GET confirms the deadline', async () => {
  api.setAccessToken(token(otherSid)); api.setRefreshToken('other-refresh');
  await assert.rejects(api.http.post('/sales/checkout/', {}), /deadline has not been verified/); assert.equal(requests.length, 0);
  api.http.defaults.adapter = async config => { requests.push(config); return response(config, snapshot(otherSid)); };
  await api.authService.getSession(); await api.http.post('/sales/checkout/', {}); assert.equal(requests.length, 2);
});
test('malformed session replies leave the confirmed deadline untouched and show a retryable error', async () => {
  api.http.defaults.adapter = async config => response(config, { id: sid });
  await assert.rejects(api.authService.getSession(), /Unable to verify/);
  await assert.rejects(api.authService.reportActivity(), /Unable to verify/);
  assert.equal(api.remainingSessionMs(), 900_000);
});
test('server-configured warning lead and idle period are used without client constants', async () => {
  api.setAccessToken(token(otherSid)); api.setRefreshToken('other-refresh');
  serverExpiry = 120_000;
  api.acceptIdleSession(snapshot(otherSid, { idle_timeout_seconds: 120, warning_seconds: 20 }));
  api.http.defaults.adapter = async config => response(config, snapshot(otherSid, { idle_timeout_seconds: 120, warning_seconds: 20 }));
  await start(); await tick(99_000); assert.equal(state.warning, false);
  await tick(1000); assert.equal(state.warning, true); assert.equal(state.seconds, 20);
  await tick(20_000); assert.equal(api.getAccessToken(), null);
});
test('simultaneous same-session tabs serialize and coalesce activity with Web Locks', async () => {
  let tail = Promise.resolve();
  navigator.locks = { request: (_key, _options, work) => { const result = tail.then(work); tail = result.catch(() => {}); return result; } };
  const second = load(); second.setAccessToken(token()); second.setRefreshToken('refresh'); second.reconcileStoredSession();
  second.http.defaults.adapter = api.http.defaults.adapter;
  const first = await start(), other = second.startSessionActivity(() => {}); stops.push(() => other.stop()); await settle();
  const results = await Promise.all([first.continueSession(), other.continueSession()]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(posts().length, 1);
});
test('denied Web Locks fall back to the existing shared/local throttle', async () => {
  navigator.locks = { request: async () => { throw new Error('locks denied'); } };
  const control = await start(); assert.equal(await control.continueSession(), true);
  assert.equal(await control.continueSession(), false); assert.equal(posts().length, 1);
});
test('server terminal auth during visibility reconciliation signs out with no activity keepalive', async () => {
  await start(); let reason; api.onUnauthorized(value => { reason = value; });
  api.http.defaults.adapter = async config => { requests.push(config); throw failure(config, 401, 'session_idle_timeout'); };
  window.dispatchEvent(new Event('focus')); await settle();
  assert.equal(reason, 'session_idle_timeout'); assert.equal(api.getAccessToken(), null); assert.equal(posts().length, 0);
});
test('late prior-session responses and expiry messages never clear an independent replacement sign-in', async () => {
  let finish;
  api.http.defaults.adapter = config => new Promise(resolve => { finish = () => resolve(response(config, snapshot())); });
  const request = api.authService.reportActivity(); const rejected = assert.rejects(request, /previous session/); await settle();
  api.setAccessToken(token(otherSid)); api.setRefreshToken('other-refresh'); api.acceptIdleSession(snapshot(otherSid));
  finish(); await rejected;
  assert.equal(api.currentSessionId(), otherSid); assert.equal(api.getAccessToken(), token(otherSid));
  storage.set(`rosario:idle-session:${sid}`, JSON.stringify({ id: sid, ended: 'session_idle_timeout' }));
  api.reconcileStoredSession(); assert.equal(api.getAccessToken(), token(otherSid));
});
test('late local expiry cannot erase newer shared tokens before their storage event is processed', () => {
  storage.set('rosario_access_token', token(otherSid)); storage.set('rosario_refresh_token', 'replacement');
  api.endIdleSession('session_idle_timeout'); assert.equal(api.getAccessToken(), token(otherSid));
  assert.equal(api.currentSessionId(), otherSid);
});
test('cross-tab token removal retains the inactivity reason and notifies auth even if token events arrive first', () => {
  let reason, changes = 0;
  api.onUnauthorized(value => { reason = value; }); api.onSessionStorageChange(() => changes++);
  storage.set(`rosario:idle-session:${sid}`, JSON.stringify({ id: sid, ended: 'session_idle_timeout' }));
  storage.delete('rosario_access_token'); storage.delete('rosario_refresh_token');
  api.synchronizeSessionStorage();
  assert.equal(reason, 'session_idle_timeout'); assert.equal(changes, 1); assert.equal(api.getAccessToken(), null);
});
test('blocked storage retains safe local expiry and throttling without uncaught startup errors', async () => {
  global.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  api.setAccessToken(token()); api.setRefreshToken('refresh'); await start(); input(); await tick(1000);
  assert.equal(posts().length, 1); await tick(900_000); assert.equal(api.getAccessToken(), null);
});
test('controller cleanup aborts outstanding reads and removes timers/input listeners', async () => {
  const control = await start(); const signal = requests[0].signal;
  input(); control.stop(); assert.equal(signal.aborted, true); assert.equal(timers.size, 0);
  input(); await tick(60_000); assert.equal(posts().length, 0);
});
test('SSE terminal 401 uses the same cleanup without GET/refresh retries or lingering fallback', async () => {
  let reason; api.onUnauthorized(value => { reason = value; });
  global.fetch = async () => new Response(JSON.stringify({ code: 'session_idle_timeout' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  let checks = 0; const stop = api.startLiveUpdates('admin', async () => { checks++; return true; }); stops.push(stop);
  await settle(); await tick(60_000); assert.equal(checks, 0); assert.equal(reason, 'session_idle_timeout'); assert.equal(timers.size, 0);
});
