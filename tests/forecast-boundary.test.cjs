const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildSync } = require('esbuild');

// Compile in memory and exercise the chart's real JSX without mounting effects or making requests.
const root = path.resolve(__dirname, '..');
let states = [], stateIndex = 0;
const hooks = {
  ...React,
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef: current => ({ current }), useEffect() {},
};
const compiled = buildSync({
  stdin: { contents: [
    'export { forecastBoundarySegment, centeredForecastSeries } from "./src/features/dashboard/utils/forecast";',
    'export { ForecastChart, ForecastGraphTooltip } from "./src/features/dashboard/components/admin/ForecastChart";',
    'export { forecastGraphKey } from "./src/features/dashboard/api/forecasting.service";',
    'export { dataCacheEpoch, writeDataCache, clearDataCache } from "./src/lib/dataCache";',
    'export { ReferenceLine, Line, Legend, Tooltip, LineChart, XAxis, YAxis } from "recharts";',
  ].join('\n'), resolveDir: root },
  define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') },
}).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'forecast-boundary-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'forecast-boundary-memory.cjs');
loaded.paths = module.paths;
loaded.require = id => id === 'react' ? hooks : require(id);
loaded._compile(compiled, loaded.filename);
const ui = loaded.exports;

const point = (date, end_date, values = {}) => ({ date, end_date, past_prediction: null, actual: null,
  future_prediction: null, prediction_basis: 'historical_test', is_current: false, is_partial_period: false, ...values });
const pair = () => [point('2026-09-01', '2026-09-30', { past_prediction: 10 }),
  point('2026-10-01', '2026-10-31', { future_prediction: 20, prediction_basis: 'forecast', is_current: true, is_partial_period: true })];
function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(item => elements(item, predicate));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree == null || typeof tree === 'boolean') return '';
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function graphFor(period, points) {
  return { scope: 'real', training_scope: 'real', is_demo: false, period, as_of: '2026-10-28', status: 'ready', model_id: 1,
    available_periods: ['weekly', 'monthly', 'yearly'], available_views: ['combined', 'regular', 'feeding'],
    range: { start_date: points[0].date, end_date: points.at(-1).end_date, past_periods: 3, future_periods: 3 },
    views: Object.fromEntries(['combined', 'regular', 'feeding'].map(key => [key, { label: key, points,
      evaluation: { historical_test: { periods: 1, wape_percent: 10, mae: 1, bias: 1 } }, message: null }])) };
}
function renderChart(graph, selectedView) {
  global.window = new EventTarget();
  global.localStorage = { getItem: () => null };
  ui.clearDataCache();
  ui.writeDataCache(ui.dataCacheEpoch() + ':' + ui.forecastGraphKey(graph.period, 'real'), graph, ['dashboard', 'reports']);
  states = [graph.period, selectedView]; stateIndex = 0;
  return ui.ForecastChart();
}

for (const [period, dates] of Object.entries({
  weekly: ['2026-10-19', '2026-10-25', '2026-10-26', '2026-11-01'],
  monthly: ['2026-09-01', '2026-09-30', '2026-10-01', '2026-10-31'],
  yearly: ['2025-01-01', '2025-12-31', '2026-01-01', '2026-12-31'],
})) {
  for (const view of ['combined', 'regular', 'feeding']) {
    test('boundary overlay preserves series and provenance for ' + period + '/' + view, () => {
      const points = [point(dates[0], dates[1], { past_prediction: 10, prediction_basis: 'issued_forecast' }),
        point(dates[2], dates[3], { future_prediction: 20, prediction_basis: 'forecast', is_current: true })];
      const graph = graphFor(period, points), before = structuredClone(graph);
      points.forEach(Object.freeze); Object.freeze(points);
      const tree = renderChart(graph, view);
      const connector = elements(tree, node => node.type === ui.ReferenceLine && node.props.segment)[0];
      assert.ok(connector);
      assert.deepEqual(connector.props.segment, [{ x: dates[0], y: 10 }, { x: dates[2], y: 20 }]);
      assert.equal(connector.props.strokeDasharray, '5 4');
      assert.equal(connector.props.strokeWidth, 2.5);
      assert.equal(connector.props.ifOverflow, 'discard');
      assert.equal(connector.props['aria-hidden'], 'true');
      assert.equal(connector.props.pointerEvents, 'none');
      assert.equal(connector.props.dataKey, undefined);
      assert.equal(connector.props.name, undefined);
      const lines = elements(tree, node => node.type === ui.Line);
      assert.equal(connector.props.stroke, lines.find(line => line.props.dataKey === 'past_prediction').props.stroke);
      assert.notEqual(connector.props.stroke, lines.find(line => line.props.dataKey === 'future_prediction').props.stroke);
      assert.deepEqual(lines.map(line => line.props.dataKey), ['past_prediction', 'actual', 'future_prediction']);
      assert.ok(lines.every(line => line.props.connectNulls === false));
      assert.equal(elements(tree, node => node.type === ui.Legend).length, 1);
      const rows = elements(tree, node => node.type === ui.LineChart)[0].props.data;
      assert.deepEqual(rows, points);
      assert.notEqual(rows[0], points[0]);
      assert.deepEqual(graph, before);
      assert.doesNotMatch(text(tree), /neutral boundary bridge|historical and latest-outlook origins can differ/);
      assert.match(text(tree), /Current period:/);
    });
  }
}

test('boundary accepts numeric zero without using or changing recorded sales', () => {
  const points = pair(); points[0].past_prediction = 0; points[1].future_prediction = 0;
  points[0].actual = null; points[1].actual = 900;
  assert.deepEqual(ui.forecastBoundarySegment(points), [{ x: points[0].date, y: 0 }, { x: points[1].date, y: 0 }]);
});

test('boundary rejects null, absent, non-finite and nonnumeric prediction endpoints', () => {
  for (const key of ['past_prediction', 'future_prediction']) {
    for (const value of [null, undefined, NaN, Infinity, -Infinity, '10', '']) {
      const points = pair(); points[key === 'past_prediction' ? 0 : 1][key] = value;
      assert.equal(ui.forecastBoundarySegment(points), null);
    }
  }
});

test('boundary does not search across missing predecessors, missing current periods, or later predictions', () => {
  assert.equal(ui.forecastBoundarySegment([]), null);
  assert.equal(ui.forecastBoundarySegment([pair()[1]]), null);
  assert.equal(ui.forecastBoundarySegment([pair()[0]]), null);
  const sparse = []; sparse[1] = pair()[1];
  assert.equal(ui.forecastBoundarySegment(sparse), null);
  const points = pair(); points[0].past_prediction = null;
  assert.equal(ui.forecastBoundarySegment([point('2026-08-01', '2026-08-31', { past_prediction: 10 }), ...points]), null);
  points[0].past_prediction = 10; points[1].future_prediction = null;
  assert.equal(ui.forecastBoundarySegment([...points, point('2026-11-01', '2026-11-30', { future_prediction: 30 })]), null);
});

test('boundary rejects malformed dates, reversed ranges, overlaps and omitted calendar buckets', () => {
  for (const [index, key, value] of [[0, 'date', 'invalid'], [0, 'date', '2026-09-31'], [0, 'end_date', '2026-09-31'],
    [1, 'date', '2026-02-30'], [1, 'date', '2026-1-01'], [1, 'date', '0000-10-01'],
    [0, 'end_date', '2026-08-31'], [0, 'end_date', '2026-10-01'], [0, 'end_date', '2026-09-29'],
    [0, 'date', '2026-10-01'], [1, 'date', '2026-11-01']]) {
    const points = pair(); points[index][key] = value;
    assert.equal(ui.forecastBoundarySegment(points), null);
  }
});

test('UTC adjacency supports week/year transitions, unequal months, and leap February', () => {
  for (const dates of [['2026-12-28', '2027-01-03', '2027-01-04', '2027-01-10'],
    ['2026-12-01', '2026-12-31', '2027-01-01', '2027-01-31'],
    ['2024-02-01', '2024-02-29', '2024-03-01', '2024-03-31'],
    ['2025-02-01', '2025-02-28', '2025-03-01', '2025-03-31']]) {
    const points = [point(dates[0], dates[1], { past_prediction: 1 }), point(dates[2], dates[3], { future_prediction: 2, is_current: true })];
    assert.deepEqual(ui.forecastBoundarySegment(points), [{ x: dates[0], y: 1 }, { x: dates[2], y: 2 }]);
  }
});

test('refresh-required graphs retain valid issued endpoints but missing Combined predictions leave a gap', () => {
  const graph = graphFor('monthly', pair()); graph.status = 'refresh_required';
  assert.equal(elements(renderChart(graph, 'regular'), node => node.type === ui.ReferenceLine && node.props.segment).length, 1);
  graph.views.combined = { ...graph.views.combined, points: pair().map(p => ({ ...p, past_prediction: null })) };
  assert.equal(elements(renderChart(graph, 'combined'), node => node.type === ui.ReferenceLine && node.props.segment).length, 0);
  const tooltip = ui.ForecastGraphTooltip({ active: true, payload: [{ payload: graph.views.regular.points[0] }] });
  assert.match(text(tooltip), /Historical comparison estimate/);
  assert.match(text(tooltip), /Earlier estimates/);
});

test('real Recharts SVG draws the connector between the two prediction dots without a fourth legend item', () => {
  const points = pair(); points[0].actual = 5;
  const connector = elements(renderChart(graphFor('monthly', points), 'combined'), node => node.type === ui.ReferenceLine && node.props.segment)[0];
  const chart = React.createElement(ui.LineChart, { data: points, width: 640, height: 250 },
    React.createElement(ui.XAxis, { dataKey: 'date' }), React.createElement(ui.YAxis, { domain: [0, 25] }),
    React.createElement(ui.Legend),
    React.createElement(ui.ReferenceLine, connector.props),
    ...['past_prediction', 'actual', 'future_prediction'].map(key => React.createElement(ui.Line, { key, dataKey: key, name: key, connectNulls: false, isAnimationActive: false })));
  const html = renderToStaticMarkup(chart);
  assert.match(html, /forecast-boundary-connector/);
  assert.equal((html.match(/recharts-legend-item legend-item-/g) || []).length, 3);
  const line = html.match(/<line[^>]*class="recharts-reference-line-line"[^>]*>/)?.[0];
  assert.ok(line);
  const dots = [...html.matchAll(/<circle[^>]*class="recharts-dot recharts-line-dot"[^>]*>/g)].map(match => match[0]);
  assert.equal(dots.length, 3);
  const coordinate = (element, key) => Number(element.match(new RegExp('(?:^|\\s)' + key + '="([^"]+)"'))?.[1]);
  assert.ok(['x1', 'y1', 'x2', 'y2'].every(key => Number.isFinite(coordinate(line, key))));
  assert.ok(dots.every(dot => ['cx', 'cy'].every(key => Number.isFinite(coordinate(dot, key)))));
  assert.equal(coordinate(line, 'x1'), coordinate(dots[0], 'cx'));
  assert.equal(coordinate(line, 'y1'), coordinate(dots[0], 'cy'));
  assert.equal(coordinate(line, 'x2'), coordinate(dots[2], 'cx'));
  assert.equal(coordinate(line, 'y2'), coordinate(dots[2], 'cy'));
});
