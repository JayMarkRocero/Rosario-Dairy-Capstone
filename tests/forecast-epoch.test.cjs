const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { AxiosError } = require('axios');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
let api, states, refs, effectSlots, pendingEffects, stateIndex, refIndex, effectIndex, timers, sequence, storage;
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { const index = refIndex++; return refs[index] ?? (refs[index] = { current: initial }); },
  useEffect(effect, dependencies) {
    const index = effectIndex++, previous = effectSlots[index];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
      pendingEffects.push(() => {
        previous?.cleanup?.();
        effectSlots[index] = { dependencies, cleanup: effect() };
      });
    }
  },
};
const compiled = buildSync({ stdin: { contents: `
  export { useForecastRefresh } from './src/features/dashboard/hooks/useForecastRefresh';
  export { default as http, setAccessToken } from './src/lib/api';
  export * from './src/lib/dataCache';
  export { userService } from './src/features/users/api/user.service';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const token = id => `header.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.signature`;
const originalSet = global.setTimeout, originalClear = global.clearTimeout;
const response = (config, data, status = 200) => ({ config, data, status, headers: {}, statusText: 'OK' });
const idle = { status: 'idle', job_id: null };
const active = id => ({ status: 'running', job_id: id, stage: 'refresh_beta_graphs', status_url: `/api/forecasting/refresh/${id}/` });
beforeEach(() => {
  states = []; refs = []; effectSlots = []; pendingEffects = []; timers = new Map(); sequence = 0;
  storage = new Map([['rosario_access_token', token(7)]]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
  global.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  global.clearTimeout = id => timers.delete(id);
  const loaded = new Module(path.join(root, 'tests', 'forecast-epoch-memory.cjs'), module);
  loaded.filename = path.join(root, 'tests', 'forecast-epoch-memory.cjs'); loaded.paths = module.paths;
  loaded.require = id => id === 'react' ? hooks : require(id);
  loaded._compile(compiled, loaded.filename); api = loaded.exports;
});
const render = () => {
  stateIndex = refIndex = effectIndex = 0;
  const value = api.useForecastRefresh();
  pendingEffects.splice(0).forEach(effect => effect());
  return value;
};
const flush = async () => { await new Promise(setImmediate); render(); await new Promise(setImmediate); return render(); };
const cleanup = () => { effectSlots.forEach(effect => effect.cleanup?.()); effectSlots = []; };
afterEach(() => { cleanup(); global.setTimeout = originalSet; global.clearTimeout = originalClear; });

test('mounted refresh tracking restarts on cache epochs, aborts the old lifecycle and never auto-POSTs', async () => {
  const calls = [];
  api.http.defaults.adapter = async config => { calls.push(config); return response(config, config.method === 'post' ? active(calls.length) : idle); };
  render(); await flush();
  await render().refresh(); await flush();
  assert.equal(calls.filter(call => call.method === 'post').length, 1);
  const previousSignal = calls[0].signal;
  api.clearDataCache(); await flush();
  assert.equal(previousSignal.aborted, true);
  assert.equal(calls.filter(call => call.method === 'get').length, 2);
  assert.equal(calls.filter(call => call.method === 'post').length, 1, 'Resynchronization only checks status');
  assert.equal(render().busy, false); assert.equal(render().job.status, 'idle');
  await render().refresh(); await flush();
  assert.equal(calls.filter(call => call.method === 'post').length, 2, 'Refresh remains usable without remounting');
});

test('new-epoch status recovery blocks duplicate starts and ignores a late previous-epoch response', async () => {
  const calls = []; let finishOld, finishNew;
  api.http.defaults.adapter = config => {
    calls.push(config);
    return new Promise(resolve => {
      if (calls.length === 1) finishOld = () => resolve(response(config, active(99)));
      else finishNew = () => resolve(response(config, idle));
    });
  };
  render(); await flush();
  assert.equal(calls.length, 1);
  api.clearDataCache(); await flush();
  await render().refresh(); assert.equal(calls.length, 2, 'New epoch also waits for its status read');
  finishNew(); await flush(); finishOld(); await flush();
  assert.equal(render().job.status, 'idle'); assert.equal(render().job.job_id, null);
  assert.equal(render().busy, false); assert.equal(render().error, '');
  assert.equal(timers.size, 0);
});

test('a new epoch clears old cooldown/recovery timers and unmount removes the epoch subscriber', async () => {
  let reads = 0;
  api.http.defaults.adapter = async config => {
    if (config.method === 'post') throw new AxiosError('Cooling down', undefined, config, undefined,
      { ...response(config, {}, 429), headers: { 'retry-after': '17' } });
    reads++; return response(config, idle);
  };
  render(); await flush(); await render().refresh(); await flush();
  assert.equal(render().busy, true); assert.ok([...timers.values()].some(timer => timer.delay === 17000));
  api.clearDataCache(); await flush();
  assert.equal(reads, 2); assert.equal(render().busy, false); assert.equal(render().error, '');
  assert.equal(timers.size, 0);
  cleanup(); api.clearDataCache(); await new Promise(setImmediate);
  assert.equal(reads, 2); assert.equal(timers.size, 0);
});

test('profile PATCH retains the JWT identity when the response omits id without extra requests', async () => {
  const calls = [], payload = { first_name: 'Updated', username: 'new-name', current_password: 'current-password' };
  api.http.defaults.adapter = async config => { calls.push(config); return response(config, { username: 'new-name', role: 'admin', first_name: 'Updated', last_name: 'User' }); };
  const user = await api.userService.updateCurrentUser(payload);
  assert.equal(user.id, 7); assert.equal(user.username, 'new-name'); assert.equal(user.role, 'admin');
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'patch'); assert.equal(calls[0].url, '/accounts/user/');
  assert.deepEqual(JSON.parse(calls[0].data), payload);
});

test('profile PATCH preserves an explicit backend id and never invents an id without session evidence', async () => {
  let data = { id: 9, username: 'returned', role: 'admin' };
  api.http.defaults.adapter = async config => response(config, data);
  assert.equal((await api.userService.updateCurrentUser({ first_name: 'Updated' })).id, 9);
  api.setAccessToken(null); data = { username: 'returned', role: 'admin' };
  assert.equal((await api.userService.updateCurrentUser({ first_name: 'Updated' })).id, undefined);
});
