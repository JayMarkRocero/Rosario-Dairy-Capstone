const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export * from './src/lib/liveEvents';
  export * from './src/lib/dataCache';
  export { default as http, ApiError, getAccessToken, getRefreshToken, setAccessToken, refreshAccessToken } from './src/lib/api';
`, resolveDir: root }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const original = { fetch: global.fetch, window: global.window, document: global.document,
  navigator: Object.getOwnPropertyDescriptor(global, 'navigator'), setTimeout, clearTimeout, setInterval, clearInterval, now: Date.now, random: Math.random };
let api, timers, clock, nextId, stops, streams, requests, reads, subscriptions;
const token = exp => `header.${Buffer.from(JSON.stringify({ user_id: 7, exp })).toString('base64url')}.signature`;
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
beforeEach(() => {
  const mod = new Module(path.join(root, 'tests', 'events-memory.cjs'), module);
  mod.filename = path.join(root, 'tests', 'events-memory.cjs'); mod.paths = module.paths;
  mod._compile(compiled, mod.filename); api = mod.exports;
  timers = new Map(); clock = 1_800_000_000_000; nextId = 0; stops = []; streams = []; requests = []; reads = {}; subscriptions = [];
  const schedule = (fn, delay, interval) => { const id = ++nextId; timers.set(id, { fn, due: clock + delay, interval }); return id; };
  global.setTimeout = (fn, delay = 0) => schedule(fn, delay, 0);
  global.setInterval = (fn, delay) => schedule(fn, delay, delay);
  global.clearTimeout = global.clearInterval = id => timers.delete(id);
  Date.now = () => clock; Math.random = () => 0.5;
  global.window = new EventTarget(); global.document = new EventTarget(); document.visibilityState = 'visible';
  Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: true } });
  const tokens = new Map([['rosario_access_token', token(2_100_000_000)], ['rosario_refresh_token', 'refresh-original']]);
  global.localStorage = { getItem: key => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: key => tokens.delete(key) };
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    const stream = { cancelled: false };
    const body = new ReadableStream({ start(controller) { stream.controller = controller; }, cancel() { stream.cancelled = true; } });
    streams.push(stream);
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  };
});
afterEach(() => {
  stops.forEach(stop => stop()); subscriptions.forEach(stop => stop());
  Object.assign(global, { fetch: original.fetch, window: original.window, document: original.document,
    setTimeout: original.setTimeout, clearTimeout: original.clearTimeout, setInterval: original.setInterval, clearInterval: original.clearInterval });
  if (original.navigator) Object.defineProperty(global, 'navigator', original.navigator); else delete global.navigator;
  Date.now = original.now; Math.random = original.random;
});
async function tick(ms) {
  const end = clock + ms;
  for (let guard = 0; guard < 1000; guard++) {
    const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
    if (!next) { clock = end; await settle(); return; }
    const [id, timer] = next; clock = timer.due;
    if (timer.interval) timer.due += timer.interval; else timers.delete(id);
    timer.fn(); await settle();
  }
  throw new Error('Timer loop');
}
async function start(role = 'admin', recheck = async () => true) {
  const stop = api.startLiveUpdates(role, recheck); stops.push(stop); await settle(); return stop;
}
async function event(name, data, stream = streams.at(-1)) {
  stream.controller.enqueue(new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)); await settle();
}
function watch(key, group) {
  const epoch = api.dataCacheEpoch();
  api.writeDataCache(key, ['existing'], [group]);
  subscriptions.push(api.subscribeDataCache(key, () => {
    if (epoch !== api.dataCacheEpoch()) return;
    const value = api.readDataCache(key);
    if (value.updatedAt === 0 && !value.error) void api.fetchDataCache(key, async () => { reads[key] = (reads[key] ?? 0) + 1; return ['fresh']; }, [group]);
  }));
}

test('SSE parser handles split UTF-8 CRLF multiline JSON comments retries and unknown/malformed frames', () => {
  const events = [], retries = [], decoder = new TextDecoder();
  const parse = api.createEventParser((...args) => events.push(args), value => retries.push(value));
  const bytes = new TextEncoder().encode(': heartbeat\r\n\r\nretry: 3000\r\n\r\nevent: ready\r\ndata: {"version":"café",\r\ndata: "groups":["sales"]}\r\n\r\nevent: invalid\ndata: {broken}\n\nevent: data_changed\ndata: {"version":"next"}\n\n');
  for (const byte of bytes) parse(decoder.decode(Uint8Array.of(byte), { stream: true }));
  assert.deepEqual(retries, [3000]);
  assert.deepEqual(events, [['ready', { version: 'café', groups: ['sales'] }], ['data_changed', { version: 'next' }]]);
  assert.deepEqual(api.recognizedGroups(['sales', 'sales', 'unknown', '__proto__', null, {}, 'users']), ['sales', 'users']);
  assert.throws(() => parse('x'.repeat(65_537)), /too large/);
});

test('one authenticated stream targets recognized groups, coalesces bursts and ignores duplicate versions', async () => {
  watch('sales', 'sales'); watch('inventory', 'inventory'); watch('users', 'users');
  await start('staff');
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/backend/events/');
  assert.equal(requests[0].options.method, 'GET'); assert.equal(requests[0].options.headers.Authorization, `Bearer ${api.getAccessToken()}`);
  assert.equal(requests[0].options.headers.Accept, 'text/event-stream'); assert.doesNotMatch(requests[0].url, /token|header/);
  await event('ready', { groups: ['sales', 'users', 'unknown'], version: 'opaque-1', resync: true });
  await event('data_changed', { groups: ['inventory'], version: 'opaque-2' });
  await event('data_changed', { groups: ['inventory'], version: 'opaque-2' });
  await event('not_supported', { groups: ['users'], version: 'opaque-3' });
  await tick(200); assert.deepEqual(reads, { sales: 1, inventory: 1 });
  await tick(10_000); assert.deepEqual(reads, { sales: 1, inventory: 1 }, 'Healthy streaming suspends five-second fallback polling');
});

test('WSGI/503 preserves REST fallback every five seconds, honors Retry-After and stops when hidden/offline', async () => {
  watch('sales', 'sales');
  global.fetch = async (url, options) => { requests.push({ url, options }); return new Response('', { status: 503, headers: { 'Retry-After': '7' } }); };
  await start(); await tick(5000); await tick(200);
  assert.equal(reads.sales, 1); assert.equal(requests.length, 1);
  await tick(1800); assert.equal(requests.length, 2);
  navigator.onLine = false; window.dispatchEvent(new Event('offline'));
  const count = requests.length, priorReads = reads.sales;
  await tick(20_000); assert.equal(requests.length, count); assert.equal(reads.sales, priorReads);
  navigator.onLine = true; window.dispatchEvent(new Event('online')); await settle(); await tick(200);
  assert.equal(requests.length, count + 1); assert.ok(reads.sales > priorReads);
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  const hiddenReads = reads.sales; await tick(20_000); assert.equal(reads.sales, hiddenReads);
});

test('EOF and rotation reconnect with backoff and resync even when the opaque version is unchanged', async () => {
  watch('sales', 'sales'); await start();
  await event('ready', { groups: ['sales'], version: 'same' }); await tick(200);
  streams[0].controller.close(); await settle(); await tick(2999); assert.equal(requests.length, 1);
  await tick(1); assert.equal(requests.length, 2);
  await event('ready', { groups: ['sales'], version: 'same' }); await tick(200); assert.equal(reads.sales, 2);
  await event('reconnect', { reason: 'renew_connection' }); await tick(3000); assert.equal(requests.length, 3);
  await event('ready', { groups: ['sales'], version: 'same' }); await tick(200); assert.equal(reads.sales, 3);
});

test('unavailable frames enable fallback and capped exponential backoff without business POSTs', async () => {
  await start(); await event('ready', { groups: ['sales'], version: 'one' });
  await event('unavailable', { retry_after: 5 }); await tick(4999); assert.equal(requests.length, 1);
  await tick(1); assert.equal(requests.length, 2);
  streams.at(-1).controller.close(); await settle(); await tick(5999); assert.equal(requests.length, 2);
  await tick(1); assert.equal(requests.length, 3);
  for (let i = 0; i < 6; i++) { streams.at(-1).controller.close(); await settle(); await tick(60_000); }
  assert.ok([...timers.values()].filter(timer => !timer.interval).every(timer => timer.due - clock <= 60_000));
  assert.ok(requests.every(request => request.options.method === 'GET'));
});

test('auth_required reuses single-flight refresh, retains rotated tokens and reconnects with the new access token', async () => {
  let refreshes = 0;
  api.http.defaults.adapter = async config => { refreshes++; assert.equal(config.url, '/accounts/refresh/'); return { config, status: 200, headers: {}, data: { access: token(2_200_000_000), refresh: 'rotated-refresh' } }; };
  await start('admin', async () => { await Promise.all([api.refreshAccessToken(), api.refreshAccessToken()]); return true; });
  await event('ready', { groups: ['sales'], version: 'one' }); await event('auth_required', { reason: 'session_expired_or_changed' });
  await tick(3000); assert.equal(refreshes, 1); assert.equal(api.getRefreshToken(), 'rotated-refresh');
  assert.equal(requests.at(-1).options.headers.Authorization, `Bearer ${token(2_200_000_000)}`);
});

test('403 rechecks permissions once without infinite stream retries, and rejected refresh stops all work', async () => {
  let rechecks = 0;
  global.fetch = async (url, options) => { requests.push({ url, options }); return new Response('', { status: 403 }); };
  const stop = await start('admin', async () => { rechecks++; return true; });
  await tick(60_000); assert.equal(rechecks, 1); assert.equal(requests.length, 1); stop();
  global.fetch = async (url, options) => { requests.push({ url, options }); return new Response('', { status: 401 }); };
  await start('admin', async () => { throw new api.ApiError(401, 'Session expired'); });
  const count = requests.length; await tick(60_000); assert.equal(requests.length, count); assert.equal(timers.size, 0);
});

test('singleton replacement, logout/account changes and unmount abort streams and ignore late frames', async () => {
  watch('sales', 'sales'); const first = await start(); const firstSignal = requests[0].options.signal;
  const second = await start(); assert.equal(firstSignal.aborted, true); assert.equal(streams[0].cancelled, true);
  first(); assert.equal(requests[1].options.signal.aborted, false, 'Old cleanup cannot stop its replacement');
  await event('ready', { groups: ['sales'], version: 'one' });
  api.setAccessToken('new-account'); await tick(200); assert.deepEqual(reads, {});
  second(); assert.equal(requests[1].options.signal.aborted, true); await tick(60_000); assert.equal(requests.length, 2);
  assert.equal(timers.size, 0);
});

test('live invalidation waits for one pending read, rejects its stale result and fetches once more', async () => {
  let finish, loads = 0;
  api.writeDataCache('sales', ['existing'], ['sales']);
  const read = () => api.fetchDataCache('sales', () => {
    loads++; return loads === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(['latest']);
  }, ['sales'], true);
  subscriptions.push(api.subscribeDataCache('sales', () => { const value = api.readDataCache('sales'); if (!value.updatedAt && !value.error) void read(); }));
  const first = read(); await settle();
  api.invalidateDataCache(['sales'], { deferPending: true }); api.invalidateDataCache(['sales'], { deferPending: true });
  assert.equal(loads, 1); assert.deepEqual(api.readDataCache('sales').data, ['existing']);
  finish(['stale']); await first; await settle();
  assert.equal(loads, 2); assert.deepEqual(api.readDataCache('sales').data, ['latest']);
});

test('stream reader decodes split UTF-8 bytes and discards an unrecognized ready frame', async () => {
  watch('sales', 'sales'); await start();
  await event('ready', { version: 'ignored', groups: ['unsupported'] }); await tick(5000); await tick(200);
  assert.equal(reads.sales, 1, 'Malformed ready must not disable REST fallback');
  const bytes = new TextEncoder().encode('event: ready\ndata: {"version":"caf\u00e9","groups":["sales"]}\n\n');
  for (const byte of bytes) streams[0].controller.enqueue(Uint8Array.of(byte));
  await settle(); await tick(1000); assert.equal(reads.sales, 2);
  const before = reads.sales; await tick(10_000); assert.equal(reads.sales, before);
});

test('expired access token is renewed before opening and an auth_required rejection stops fallback and retries', async () => {
  api.setAccessToken(token(1));
  let renewals = 0;
  const stop = await start('admin', async () => { renewals++; api.setAccessToken(token(2_200_000_000), true); return true; });
  assert.equal(renewals, 1); assert.equal(requests[0].options.headers.Authorization, `Bearer ${token(2_200_000_000)}`);
  stop();
  await start('admin', async () => { throw new api.ApiError(401, 'Expired'); });
  await event('ready', { groups: ['sales'], version: 'one' });
  await event('auth_required', { reason: 'session_expired_or_changed' });
  const count = requests.length; await tick(60_000);
  assert.equal(requests.length, count); assert.equal(timers.size, 0);
});

test('visibility resume reopens once, resyncs missed events and cleanup removes lifecycle listeners', async () => {
  watch('sales', 'sales'); const stop = await start();
  await event('ready', { version: 'one', groups: ['sales'] }); await tick(200);
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests[0].options.signal.aborted, true);
  const count = reads.sales; await tick(20_000); assert.equal(reads.sales, count);
  document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
  await settle(); assert.equal(requests.length, 2); await tick(200); assert.equal(reads.sales, count + 1);
  stop(); const requestsBefore = requests.length;
  window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
  await tick(60_000); assert.equal(requests.length, requestsBefore); assert.equal(timers.size, 0);
});

test('a response arriving after unmount is cancelled without parsing or invalidating the next session', async () => {
  watch('sales', 'sales'); let finish, cancelled = false;
  global.fetch = (url, options) => { requests.push({ url, options }); return new Promise(resolve => { finish = resolve; }); };
  const stop = await start(); stop();
  finish(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  await settle(); await tick(60_000);
  assert.equal(cancelled, true); assert.deepEqual(reads, {}); assert.equal(timers.size, 0);
});

test('definitively missing records clear stale cached details while throttling and outages preserve content', async () => {
  for (const status of [404, 410, 429, 500]) {
    api.writeDataCache('detail', ['existing'], ['customers']);
    await assert.rejects(api.fetchDataCache('detail', () => Promise.reject(new api.ApiError(status, 'Unavailable')), ['customers'], true));
    assert.deepEqual(api.readDataCache('detail').data, status === 404 || status === 410 ? undefined : ['existing']);
  }
});

test('five-second fallback coalesces slow reads without aborting or hiding completed data', async () => {
  global.fetch = async () => new Response('', { status: 503, headers: { 'Retry-After': '60' } });
  const pending = [];
  const load = () => api.fetchDataCache('slow-orders', signal => new Promise(resolve => pending.push({ signal, resolve })), ['orders'], false, { cancelable: true }).catch(() => {});
  subscriptions.push(api.subscribeDataCache('slow-orders', () => {
    const snapshot = api.readDataCache('slow-orders');
    if (!snapshot.updatedAt && !snapshot.error) void load();
  }));
  void load(); await settle(); await start();
  await tick(16_000);
  assert.equal(pending.length, 1); assert.equal(pending[0].signal.aborted, false);
  pending[0].resolve(['first complete result']); await settle();
  assert.deepEqual(api.readDataCache('slow-orders').data, ['first complete result']);
  assert.equal(pending.length, 2, 'Missed polling ticks queue one follow-up');
  await tick(10_000); assert.equal(pending.length, 2); assert.equal(pending[1].signal.aborted, false);
  pending[1].resolve(['second complete result']); await settle();
  assert.deepEqual(api.readDataCache('slow-orders').data, ['second complete result']);
  assert.equal(pending.length, 3);
  // Confirmed mutations still supersede obsolete reads and protect fresh state.
  api.invalidateDataCache(['orders']); await settle();
  assert.equal(pending[2].signal.aborted, true); assert.equal(pending.length, 4);
  pending[3].resolve(['fresh after mutation']); await settle();
  pending[2].resolve(['obsolete']); await settle();
  assert.deepEqual(api.readDataCache('slow-orders').data, ['fresh after mutation']);
});
