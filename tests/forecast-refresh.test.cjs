const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const React = require('react');
const { AxiosError } = require('axios');

let states, refs, stateIndex, refIndex, effects, cleanups, timers, timerId;
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useEffect(effect) { effects.push(effect); },
};
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { useForecastRefresh } from './src/features/dashboard/hooks/useForecastRefresh';
    export { default as http } from './src/lib/api';
    export * from './src/lib/dataCache';
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'forecast-refresh-in-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'forecast-refresh-in-memory.cjs');
loaded.paths = module.paths;
loaded.require = id => id === 'react' ? hooks : require(id);
loaded._compile(compiled, loaded.filename);
const api = loaded.exports;
const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout;
const render = () => { stateIndex = refIndex = 0; return api.useForecastRefresh(); };
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (config, data, status = 200) => ({ status, config, data, headers: {} });
function failure(config, status, headers = {}) {
  return new AxiosError(`Request failed (${status})`, undefined, config, undefined,
    { status, config, headers, data: { detail: `Safe server message (${status}).` } });
}
function activeJob(id = 12) {
  return { job_id: id, status: 'running', stage: 'refresh_beta_graphs', status_url: `/api/forecasting/refresh/${id}/` };
}
async function mount() {
  const state = render();
  for (const effect of effects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  await settle();
  return state;
}
async function tick(delay) {
  const [id, timer] = [...timers].find(([, timer]) => timer.delay === delay) ?? [];
  assert.ok(timer, `Expected a ${delay}ms recovery timer`);
  timers.delete(id); timer.callback(); await settle();
}
beforeEach(() => {
  api.clearDataCache();
  states = []; refs = []; stateIndex = refIndex = 0; effects = []; cleanups = []; timers = new Map(); timerId = 0;
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  global.window = new EventTarget();
  global.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  global.clearTimeout = id => timers.delete(id);
});
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout;
});

for (const kind of ['network', 'timeout', '503']) {
  test(`initial ${kind} status failure retries recovery without issuing another start`, async () => {
    const requests = []; let fail = true;
    api.http.defaults.adapter = async config => {
      requests.push(config);
      if (fail) {
        if (kind === '503') throw failure(config, 503);
        throw new AxiosError(kind === 'timeout' ? 'timeout' : 'Network error', kind === 'timeout' ? AxiosError.ETIMEDOUT : AxiosError.ERR_NETWORK, config);
      }
      return response(config, activeJob());
    };
    await mount();
    assert.equal(render().busy, true);
    assert.ok(render().error);
    await render().refresh();
    assert.equal(requests.length, 1, 'Unknown status must not allow a duplicate POST');
    fail = false; await tick(5000);
    assert.equal(requests.at(-1).url, '/api/forecasting/refresh/');
    assert.equal(render().job.job_id, 12);
    assert.equal(render().error, '');
    assert.equal(render().message, 'Updating forecast graphs');
    await tick(5000);
    assert.equal(requests.at(-1).url, '/api/forecasting/refresh/12/');
    assert.ok(requests.every(request => request.method === 'get'));
  });
}

test('initial 429 status recovery respects Retry-After before polling again', async () => {
  let requests = 0;
  api.http.defaults.adapter = async config => {
    requests++;
    if (requests === 1) throw failure(config, 429, { 'retry-after': '19' });
    return response(config, { status: 'idle', job_id: null });
  };
  await mount();
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [19000]);
  await tick(19000);
  assert.equal(requests, 2);
  assert.equal(render().busy, false);
  assert.equal(timers.size, 0);
});

for (const kind of ['timeout', '503']) {
  test(`ambiguous ${kind} start checks latest job and invalidates all graph caches on completion`, async () => {
    const requests = []; let completed = false;
    api.http.defaults.adapter = async config => {
      requests.push(config);
      if (config.method === 'post') {
        if (kind === '503') throw failure(config, 503);
        throw new AxiosError('timeout', AxiosError.ETIMEDOUT, config);
      }
      const data = requests.some(request => request.method === 'post')
        ? { ...activeJob(), status: completed ? 'succeeded' : 'running', stage: completed ? 'complete' : 'refresh_beta_graphs' }
        : { status: 'idle', job_id: null };
      return response(config, data);
    };
    for (const period of ['weekly', 'monthly', 'yearly']) {
      api.writeDataCache(`graph:${period}`, { period }, ['dashboard', 'reports']);
    }
    await mount();
    const state = render();
    await Promise.all([state.refresh(), state.refresh()]);
    assert.equal(render().busy, true);
    await render().refresh();
    assert.equal(requests.filter(request => request.method === 'post').length, 1);
    await tick(5000);
    assert.equal(requests.at(-1).url, '/api/forecasting/refresh/');
    assert.equal(render().job.status, 'running');
    completed = true; await tick(5000);
    assert.equal(requests.at(-1).url, '/api/forecasting/refresh/12/');
    assert.equal(render().busy, false);
    assert.equal(render().message, 'Forecast refreshed');
    assert.equal(timers.size, 0);
    for (const period of ['weekly', 'monthly', 'yearly']) assert.equal(api.readDataCache(`graph:${period}`).updatedAt, 0);
  });
}

for (const status of [401, 403, 404]) {
  test(`initial ${status} response stops recovery and exposes the safe request error`, async () => {
    api.http.defaults.adapter = async config => { throw failure(config, status); };
    await mount();
    assert.equal(render().busy, false);
    assert.match(render().error, new RegExp(`Safe server message \\(${status}\\)`));
    assert.equal(timers.size, 0);
  });
}

test('unmount cancels scheduled initial recovery and aborts its request signal', async () => {
  let signal;
  api.http.defaults.adapter = async config => { signal = config.signal; throw failure(config, 503); };
  await mount();
  assert.equal(timers.size, 1);
  cleanups.splice(0).forEach(cleanup => cleanup());
  assert.equal(timers.size, 0);
  assert.equal(signal.aborted, true);
});

test('an older terminal job cannot confirm an ambiguous start, and a manual retry remains available', async () => {
  let posts = 0;
  api.http.defaults.adapter = async config => {
    if (config.method === 'post') {
      posts++;
      if (posts === 1) throw failure(config, 503);
      return response(config, { ...activeJob(6), status: 'queued', stage: 'queued' }, 202);
    }
    return response(config, { ...activeJob(5), status: 'succeeded', stage: 'complete' });
  };
  await mount();
  assert.equal(render().job.job_id, 5);
  await render().refresh();
  assert.equal(render().message, 'Waiting to refresh', 'An old complete stage must not announce success while starting');
  await tick(5000);
  assert.equal(posts, 1);
  assert.equal(render().busy, false);
  assert.equal(render().job, null);
  assert.notEqual(render().message, 'Forecast refreshed');
  assert.match(render().error, /Safe server message.*No new refresh job could be confirmed/);
  assert.equal(timers.size, 0);
  await render().refresh();
  assert.equal(posts, 2);
  assert.equal(render().job.job_id, 6);
});

test('a newer terminal job confirms a refresh even when its accepted response timed out', async () => {
  let posted = false;
  api.http.defaults.adapter = async config => {
    if (config.method === 'post') { posted = true; throw new AxiosError('timeout', AxiosError.ETIMEDOUT, config); }
    return response(config, { ...activeJob(posted ? 6 : 5), status: 'succeeded', stage: 'complete' });
  };
  await mount();
  api.writeDataCache('graph:monthly', { revision: 'old' }, ['dashboard', 'reports']);
  await render().refresh(); await tick(5000);
  assert.equal(render().busy, false);
  assert.equal(render().job.job_id, 6);
  assert.equal(render().message, 'Forecast refreshed');
  assert.equal(render().error, '');
  assert.equal(api.readDataCache('graph:monthly').updatedAt, 0);
});

test('unknown baseline terminal recovery never claims completion of an ambiguous new request', async () => {
  let resolveInitial, reads = 0, posts = 0;
  api.http.defaults.adapter = config => {
    if (config.method === 'post') { posts++; return Promise.reject(failure(config, 503)); }
    reads++;
    const done = () => response(config, { ...activeJob(5), status: 'succeeded', stage: 'complete' });
    if (reads === 1) return new Promise(resolve => { resolveInitial = () => resolve(done()); });
    return Promise.resolve(done());
  };
  const state = await mount(); // Deliberately leave the initial status request unresolved.
  await state.refresh(); await tick(5000);
  assert.equal(posts, 1);
  assert.equal(render().job, null);
  assert.match(render().error, /No new refresh job could be confirmed/);
  resolveInitial(); await settle();
  assert.equal(render().job, null, 'Late initial status must not override the recovery decision');
});

test('a refresh completed while unmounted invalidates fresh graph caches once per job and session', async () => {
  let completed = false;
  api.http.defaults.adapter = async config => response(config, { ...activeJob(8),
    status: completed ? 'succeeded' : 'running', stage: completed ? 'complete' : 'refresh_beta_graphs' });
  await mount();
  cleanups.splice(0).forEach(cleanup => cleanup());
  for (const period of ['weekly', 'monthly', 'yearly']) api.writeDataCache(`graph:${period}`, { period }, ['dashboard', 'reports']);
  completed = true;
  states = []; refs = []; effects = [];
  await mount();
  for (const period of ['weekly', 'monthly', 'yearly']) assert.equal(api.readDataCache(`graph:${period}`).updatedAt, 0);
  cleanups.splice(0).forEach(cleanup => cleanup());
  for (const period of ['weekly', 'monthly', 'yearly']) api.writeDataCache(`graph:${period}`, { period }, ['dashboard', 'reports']);
  states = []; refs = []; effects = [];
  await mount();
  for (const period of ['weekly', 'monthly', 'yearly']) assert.ok(api.readDataCache(`graph:${period}`).updatedAt > 0,
    'Mounting again must not invalidate the same completed job repeatedly');
  // Reusing a job ID in another session must not inherit the earlier acknowledgement.
  api.clearDataCache();
  for (const period of ['weekly', 'monthly', 'yearly']) api.writeDataCache(`graph:${period}`, { period }, ['dashboard', 'reports']);
  cleanups.splice(0).forEach(cleanup => cleanup());
  states = []; refs = []; effects = [];
  await mount();
  for (const period of ['weekly', 'monthly', 'yearly']) assert.equal(api.readDataCache(`graph:${period}`).updatedAt, 0);
});
