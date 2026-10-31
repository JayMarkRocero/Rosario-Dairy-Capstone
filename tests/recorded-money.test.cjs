const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export * from './src/features/sales/utils/recordedMoney';
  export { receiptDetails, receiptMoney } from './src/features/sales/utils/receiptDetails';
  export { toSale, recordedSaleAmount } from './src/features/sales/api/sales.service';
  export { mapOrder, ordersService } from './src/features/orders/api/orders.service';
  export { MobileSaleCard } from './src/features/sales/components/MobileSaleCard';
  export { MobileOrderCard } from './src/features/orders/components/MobileOrderCard';
  export { SalesEncoding } from './src/features/sales/pages/SalesEncoding';
  export { EnhancedTable } from './src/components/data-display/EnhancedTable';
  export * from './src/lib/dataCache';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'money-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'money-memory.cjs'); loaded.paths = module.paths;
loaded.require = id => id === 'react' ? { ...React, useEffect() {}, useLayoutEffect() {},
  useState: value => [typeof value === 'function' ? value() : value, () => {}], useRef: value => ({ current: value }), useMemo: fn => fn(), useCallback: fn => fn,
} : require(id);
loaded._compile(compiled, loaded.filename); const api = loaded.exports;
const tx = overrides => ({ id: 5, transaction_number: 'SI-5', created_at: '2026-10-01T01:00:00Z',
  handled_by: { id: 7, username: 'encoder', role: 'admin' }, recorded_cashier: null,
  payment_method: 'cash', payment_status: 'pending', is_manually_encoded: true,
  subtotal: '999999999999999999.99', total_amount: '90071992547409.93', amount_tendered: '999999999999999999.99', change_due: '909928007452590.06',
  items: [{ id: 1, line_number: 1, quantity: '1', unit_price: '50', subtotal: '999999999999999999.99', total_amount: '90071992547409.93', product_batch: { batch_number: 'B1', product: { name: 'Milk' } } }],
  ...overrides });
function nodes(tree, test) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, test));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [...(test(tree) ? [tree] : []), ...nodes(tree.props.children, test)];
}

test('recorded currency preserves supported large decimal strings, zero, signs and missing values', () => {
  assert.equal(api.receiptMoney('90071992547409.93'), 'PHP 90,071,992,547,409.93');
  assert.equal(api.recordedPesos('999999999999999999.99', 2), '₱999,999,999,999,999,999.99');
  assert.equal(api.recordedPesos('-90071992547409.91', 2), '₱-90,071,992,547,409.91');
  assert.equal(api.recordedPesos('0.00'), '₱0'); assert.equal(api.recordedPesos('0.00', 2), '₱0.00');
  assert.equal(api.recordedPesos('120.10'), '₱120.1');
  for (const value of [null, undefined, '', 'NaN', '1e20', Infinity]) assert.equal(api.recordedPesos(value), 'Not recorded');
});

test('complete recorded sums use exact cents and never replace unknown values with zero', () => {
  assert.equal(api.sumRecordedMoney(['90071992547409.93', '0.01', '-0.02']), '90071992547409.92');
  assert.equal(api.sumRecordedMoney(['999999999999999999.99', '0.01']), '1000000000000000000.00');
  assert.equal(api.sumRecordedMoney([]), '0.00'); assert.equal(api.sumRecordedMoney(['1.00', null]), null);
});

test('receipt grouping formats saved line and invoice values exactly without repricing them', () => {
  const source = api.toSale(tx()), before = JSON.stringify(source);
  source.transaction.items.push({ ...source.transaction.items[0], id: 2, subtotal: '0.01', total_amount: '0.01' });
  const saved = JSON.stringify(source), details = api.receiptDetails(source);
  assert.equal(details.items[0].gross, 'PHP 1,000,000,000,000,000,000.00');
  assert.equal(details.items[0].subtotal, 'PHP 90,071,992,547,409.94');
  assert.deepEqual(details.totals.find(([key]) => key === 'Total'), ['Total', 'PHP 90,071,992,547,409.93']);
  assert.equal(JSON.stringify(source), saved); assert.notEqual(saved, before);
});

test('mobile history and order cards display original backend totals while keeping numeric sorting fields', () => {
  const sale = api.toSale(tx());
  assert.equal(typeof sale.total, 'number'); assert.equal(api.recordedSaleAmount(sale), '90071992547409.93');
  const saleHTML = renderToStaticMarkup(React.createElement(api.MobileSaleCard, { sale, onView() {} }));
  assert.match(saleHTML, /90,071,992,547,409\.93/);
  const order = api.mapOrder({ id: 2, customer: { id: 1, name: 'Customer' }, handled_by: { id: 7, username: 'encoder' }, status: 'fulfilled', created_at: '2026-10-01', transaction: tx(),
    items: [{ id: 1, product: { id: 4, name: 'Milk' }, quantity: '1', unit_price: '50.00', subtotal: '999999999999999999.99', total_amount: '90071992547409.93' }] });
  assert.equal(typeof order.total, 'number'); assert.equal(order.recordedAmounts.total, '90071992547409.93');
  assert.equal(order.items[0].recordedAmounts.netAmount, '90071992547409.93');
  assert.match(renderToStaticMarkup(React.createElement(api.MobileOrderCard, { order, onView() {} })), /90,071,992,547,409\.93/);
  assert.equal(typeof api.ordersService.getById, 'function', 'Open order details can refresh independently of the visible page');
});

test('encoding Entered by uses the backend encoder rather than the separately recorded cashier', () => {
  global.window = new EventTarget();
  api.clearDataCache();
  const record = tx();
  api.writeDataCache(`${api.dataCacheEpoch()}:sales:encoding::::page:1:5`, { count: 1, results: [record] }, ['sales']);
  const tree = api.SalesEncoding();
  const table = nodes(tree, node => node.type === api.EnhancedTable)[0];
  const sale = table.props.data[0], entered = table.props.columns.find(column => column.header === 'Entered by');
  assert.equal(sale.cashier, 'Not recorded');
  assert.equal(entered.render(sale).props.children, 'encoder');
  assert.equal(entered.render(api.toSale(tx({ handled_by: { id: 8, username: 'staff-encoder', role: 'staff' } }))).props.children, 'staff-encoder');
  const total = table.props.columns.find(column => column.key === 'total').render(sale);
  assert.equal(total.props.children, '₱90,071,992,547,409.93');
});
