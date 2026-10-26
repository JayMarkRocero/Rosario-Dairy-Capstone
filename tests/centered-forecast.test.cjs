const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

// Compile production code in memory; these tests make no server/database writes.
const root = path.resolve(__dirname, '..');
const compiled = buildSync({
  stdin: { contents: `
    export { default as http } from './src/lib/api';
    export * from './src/lib/dataCache';
    export * from './src/features/dashboard/api/forecasting.service';
    export { centeredForecastSeries, forecastBasisLabel } from './src/features/dashboard/utils/forecast';
  `, resolveDir: root },
  define: { 'import.meta.env': '{}' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'centered-forecast-in-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'centered-forecast-in-memory.cjs');
loaded.paths = module.paths;
loaded._compile(compiled, loaded.filename);
const api = loaded.exports;

function graphFixture(period) {
  const current = period === 'yearly' ? 2 : 3;
  const starts = period === 'weekly'
    ? ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']
    : period === 'monthly'
      ? ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']
      : ['2024-01-01', '2025-01-01', '2026-01-01', '2027-01-01', '2028-01-01'];
  const endDate = value => {
    const date = new Date(`${value}T00:00:00Z`);
    if (period === 'weekly') date.setUTCDate(date.getUTCDate() + 6);
    else if (period === 'monthly') { date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); }
    else { date.setUTCMonth(11); date.setUTCDate(31); }
    return date.toISOString().slice(0, 10);
  };
  return {
    scope: 'real', is_demo: false, training_scope: 'real', period, as_of: '2026-10-26',
    status: 'ready', model_id: 17,
    available_periods: ['weekly', 'monthly', 'yearly'], available_views: ['combined', 'regular', 'feeding'],
    range: { start_date: starts[0], end_date: endDate(starts.at(-1)), past_periods: current, future_periods: current },
    views: Object.fromEntries(['combined', 'regular', 'feeding'].map((view, viewIndex) => [view, {
      label: view === 'feeding' ? 'Milk feeding' : view === 'regular' ? 'Regular sales' : 'Combined',
      message: null,
      points: starts.map((date, index) => ({
        date, end_date: endDate(date),
        past_prediction: index < current ? 100 + viewIndex : null,
        actual: index === 0 ? 0 : index === 1 || index > current ? null : 15 + viewIndex,
        future_prediction: index >= current ? 200 + viewIndex : null,
        prediction_basis: index === 0 ? 'issued_forecast' : index < current ? 'historical_test' : 'forecast',
        is_current: index === current, is_partial_period: index === current,
      })),
      evaluation: {
        issued_forecast: { periods: 1, wape_percent: null, mae: 100 + viewIndex, bias: 100 + viewIndex },
        historical_test: { periods: 1, wape_percent: 12.5 + viewIndex, mae: 2, bias: -2 },
      },
    }])) ,
  };
}

let requests, responseData;
beforeEach(() => {
  const storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
  api.clearDataCache(); requests = []; responseData = graphFixture('monthly');
  api.http.defaults.adapter = async config => {
    requests.push(config);
    return { status: 200, statusText: '', headers: {}, config, data: responseData };
  };
});

test('centered graph requests use explicit real scope for each period and preserve cancellation', async () => {
  for (const period of ['weekly', 'monthly', 'yearly']) {
    responseData = graphFixture(period);
    const controller = new AbortController();
    const graph = await api.forecastingService.getGraph(period, 'real', controller.signal);
    assert.deepEqual(graph, responseData);
    assert.equal(requests.at(-1).url, '/api/forecasting/graph/');
    assert.equal(requests.at(-1).method, 'get');
    assert.deepEqual(requests.at(-1).params, { period, scope: 'real' });
    assert.equal(requests.at(-1).signal, controller.signal);
    assert.equal(graph.is_demo, false);
  }
  assert.equal(requests.length, 3, 'all three views arrive together, without a per-view request');
});

test('production graph requests reject demo scope and do not present demo responses as real sales', async () => {
  await assert.rejects(api.forecastingService.getGraph('monthly', 'demo2026'), /real|demo/i);
  assert.equal(requests.length, 0);
  responseData = { ...graphFixture('monthly'), scope: 'demo2026', is_demo: true };
  await assert.rejects(api.forecastingService.getGraph('monthly'), /real|demo/i);
  responseData = { ...graphFixture('monthly'), is_demo: true };
  await assert.rejects(api.forecastingService.getGraph('monthly'), /real|demo/i);
});

for (const period of ['weekly', 'monthly', 'yearly']) for (const view of ['combined', 'regular', 'feeding']) {
  test(`centered ${period}/${view} preserves the entire calendar, missing actuals, zero and partial current bucket`, () => {
    const graph = graphFixture(period), points = graph.views[view].points;
    const series = api.centeredForecastSeries(graph.views[view]);
    assert.equal(series.length, period === 'yearly' ? 5 : 7);
    assert.deepEqual(series.map(point => point.date), points.map(point => point.date));
    for (let index = 0; index < points.length; index++) {
      for (const field of ['date', 'end_date', 'actual', 'past_prediction', 'future_prediction', 'prediction_basis', 'is_current', 'is_partial_period']) {
        assert.equal(series[index][field], points[index][field], `${field} must preserve the backend bucket`);
      }
    }
    assert.equal(series[0].actual, 0);
    assert.equal(series[1].actual, null);
    const current = series.find(point => point.is_current);
    assert.equal(current.is_partial_period, true);
    assert.ok(current.actual > 0);
    assert.ok(current.future_prediction > current.actual, 'partial actual and full-period prediction remain distinct');
    assert.equal(series.at(-1).actual, null);
    assert.equal(series.at(-1).future_prediction, points.at(-1).future_prediction);
  });
}

test('centered graph evaluations preserve independent basis counts and undefined WAPE', async () => {
  const graph = await api.forecastingService.getGraph('monthly');
  const evaluation = graph.views.regular.evaluation;
  assert.deepEqual(evaluation.issued_forecast, { periods: 1, wape_percent: null, mae: 101, bias: 101 });
  assert.deepEqual(evaluation.historical_test, { periods: 1, wape_percent: 13.5, mae: 2, bias: -2 });
  assert.equal(evaluation.forecast, undefined, 'current/future buckets have no frontend-generated evaluation');
  assert.equal(api.forecastBasisLabel('issued_forecast'), 'Original issued forecast');
  assert.equal(api.forecastBasisLabel('historical_test'), 'Reconstructed historical test');
  assert.equal(api.forecastBasisLabel('forecast'), 'Current forecast');
});

test('centered graphs retain recorded sales when saved predictions are unavailable', () => {
  const view = graphFixture('monthly').views.regular;
  view.message = 'Not enough sales history yet.';
  view.points = view.points.map(point => ({ ...point, past_prediction: null, future_prediction: null }));
  view.evaluation = {};
  const series = api.centeredForecastSeries(view);
  assert.equal(series.length, 7);
  assert.equal(series[0].actual, 0);
  assert.ok(series.some(point => point.actual > 0));
  assert.ok(series.every(point => point.past_prediction === null && point.future_prediction === null));
  assert.deepEqual(api.centeredForecastSeries(undefined), []);
});

test('centered graph caches isolate periods and preserve other periods on navigation', async () => {
  const keys = new Set(['weekly', 'monthly', 'yearly'].map(period => api.forecastGraphKey(period, 'real')));
  assert.equal(keys.size, 3);
  for (const period of ['weekly', 'monthly', 'yearly']) {
    const key = api.forecastGraphKey(period, 'real');
    await api.fetchDataCache(key, async () => graphFixture(period), ['dashboard', 'reports']);
    assert.equal(api.readDataCache(key).data.period, period);
  }
  let reloaded = false;
  const cached = await api.fetchDataCache(api.forecastGraphKey('monthly', 'real'), async () => { reloaded = true; return null; }, ['dashboard', 'reports']);
  assert.equal(cached.period, 'monthly');
  assert.equal(reloaded, false);
  assert.notEqual(api.forecastGraphKey('monthly', 'real', '2026-10-26'), api.forecastGraphKey('monthly', 'real', '2026-10-27'));
  assert.notEqual(api.forecastGraphKey('monthly', 'real'), api.forecastChartKey('monthly'), 'legacy responses cannot share the centered graph cache key');
});
