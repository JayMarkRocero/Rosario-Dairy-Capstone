const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const code = buildSync({ stdin: { contents: `
  export { default as http } from './src/lib/api';
  export { salesService } from './src/features/sales/api/sales.service';
  export { ordersService } from './src/features/orders/api/orders.service';
  export { encodingService } from './src/features/sales/api/encoding.service';
`, resolveDir: root }, define: { 'import.meta.env': '{}' }, bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'history-summary-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'history-summary-memory.cjs'); loaded.paths = module.paths;
loaded._compile(code, loaded.filename);
const api = loaded.exports;
let calls, response;
beforeEach(() => {
  calls = []; response = {};
  api.http.defaults.adapter = async config => { calls.push(config); return { status: 200, data: response, config, headers: {} }; };
});
const filters = { startDate: '2026-01-01', endDate: '2026-01-31', handledBy: 7, customerId: 12,
  paymentMethod: 'online', paymentStatus: 'pending', search: 'SI-9' };

test('history summaries retain complete backend counts and exact decimal strings without paging', async () => {
  response = { transaction_count: 4801, total_revenue: '90071992547409.93', paid_count: 0, paid_amount: '0.00',
    pending_count: 4801, pending_amount: '90071992547409.93', unknown_count: 0, unknown_amount: '0.00' };
  for (const service of [api.salesService, api.encodingService]) {
    const controller = new AbortController();
    const result = await service.getSummary(filters, controller.signal);
    assert.equal(result, response);
    assert.equal(result.total_revenue, '90071992547409.93');
    assert.equal(result.transaction_count, 4801);
    const config = calls.at(-1);
    assert.equal(config.signal, controller.signal);
    assert.match(config.url, /\/summary\/$/);
    assert.deepEqual(config.params, { start_date: filters.startDate, end_date: filters.endDate, handled_by: 7,
      customer_id: 12, payment_method: 'online', payment_status: 'pending', include_voided: undefined, search: 'SI-9' });
    assert.equal('page' in config.params, false);
  }
  assert.equal(calls.length, 2);
});

test('each server page uses its original capacity, count, filters, ordering and cancellation signal', async () => {
  response = { count: 4801, previous: null, next: 'next', results: [] };
  for (const service of [api.salesService, api.encodingService, api.ordersService]) {
    const controller = new AbortController();
    const result = await service.getPage({ ...filters, page: 9, pageSize: 7, ordering: '-total_amount' }, controller.signal);
    assert.equal(result.count, 4801); assert.deepEqual(result.results, []);
    assert.equal(calls.at(-1).params.page, 9); assert.equal(calls.at(-1).params.page_size, 7);
    assert.equal(calls.at(-1).params.ordering, '-total_amount'); assert.equal(calls.at(-1).signal, controller.signal);
  }
  assert.equal(calls.length, 3, 'No full-history chain is started for a page');
});

test('order summary keeps fulfilled pending-payment counts independent of page totals and preserves scope', async () => {
  response = { order_count: 8000, fulfilled_count: 6000, cancelled_count: 2000, pending_payment_count: 314,
    total_revenue: '999999999999999999.99' };
  const result = await api.ordersService.getSummary({ handledBy: 7, status: 'fulfilled' });
  assert.equal(result, response); assert.equal(result.pending_payment_count, 314);
  assert.equal(result.total_revenue, '999999999999999999.99');
  assert.equal(calls[0].params.handled_by, 7); assert.equal(calls[0].params.status, 'fulfilled');
  response = { count: 0, results: [], next: null, previous: null };
  await api.ordersService.getPage({ page: 1, pageSize: 5 });
  assert.equal(calls[1].params.ordering, '-id', 'Existing order default ID ordering is preserved');
});

test('payment detail reads retain backend fields and pass cancellation without creating a sale', async () => {
  response = { id: 42, can_update_payment: false, payment_updated_by_user: { id: 9, username: 'updater', role: 'staff' } };
  const controller = new AbortController();
  assert.equal(await api.encodingService.get(42, controller.signal), response);
  assert.equal(calls[0].method, 'get'); assert.equal(calls[0].url, '/sales/encoding/42/');
  assert.equal(calls[0].signal, controller.signal);
});
