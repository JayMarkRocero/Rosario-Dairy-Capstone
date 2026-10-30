const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const compiled = buildSync({ stdin: { contents: `
  export { receiptDetails } from './src/features/sales/utils/receiptDetails';
  export { mapOrder } from './src/features/orders/api/orders.service';
`, resolveDir: root }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'discount-presentation-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'discount-presentation-memory.cjs'); loaded.paths = module.paths;
loaded._compile(compiled, loaded.filename);
const { receiptDetails, mapOrder } = loaded.exports;

function sale(overrides = {}) {
  return { receipt: 'SI-001', cashier: 'Not recorded', customer: 'Customer', payment: 'Cash', transaction: {
    id: 1, created_at: '2026-10-30T04:00:00Z', handled_by: { id: 7, username: 'cashier', role: 'staff' },
    subtotal: '100.00', total_amount: '90.00', amount_tendered: '100.00', change_due: '10.00',
    payment_status: 'paid', items: [{ id: 1, quantity: '2.00', unit_price: '50.00', subtotal: '100.00', total_amount: '90.00',
      product_batch: { batch_number: 'B-1', product: { name: 'Milk', variant: null } } }], ...overrides,
  } };
}

test('receipts preserve recorded invoice and line totals after retired response fields disappear', () => {
  const receipt = receiptDetails(sale());
  assert.deepEqual(receipt.totals, [
    ['Subtotal', 'PHP 100.00'], ['Total', 'PHP 90.00'], ['Amount Tendered', 'PHP 100.00'], ['Change', 'PHP 10.00'],
  ]);
  assert.equal(receipt.items[0].subtotal, 'PHP 90.00');
  assert.equal(receipt.items[0].gross, 'PHP 100.00');
  assert.equal(receipt.lineAmountLabel, 'Line amount');
  assert.doesNotMatch(JSON.stringify(receipt), /discount/i);
});

test('historical recorded source lines may differ from the invoice without repricing', () => {
  const original = sale({ source_reference: 'IMPORT-1' });
  original.transaction.items[0].source_line_total = '100.00';
  const receipt = receiptDetails(original);
  assert.equal(receipt.title, 'Historical Sales Record');
  assert.equal(receipt.lineAmountLabel, 'Recorded line amount');
  assert.equal(receipt.items[0].subtotal, 'PHP 100.00');
  assert.equal(receipt.totals.find(([label]) => label === 'Total')[1], 'PHP 90.00');
  assert.match(receipt.lineAmountNote, /may differ from the recorded invoice total/);
  assert.doesNotMatch(JSON.stringify(receipt), /discount/i);
});

test('missing recorded source amounts stay unknown while real zero amounts remain zero', () => {
  const missing = sale({ source_reference: 'IMPORT-2' });
  missing.transaction.items[0].source_line_total = null;
  assert.equal(receiptDetails(missing).items[0].subtotal, 'Not provided');
  missing.transaction.items[0].source_line_total = '0.00';
  assert.equal(receiptDetails(missing).items[0].subtotal, 'PHP 0.00');
});

test('grouped FEFO lines sum recorded amounts rather than multiplying unit prices', () => {
  const original = sale();
  const item = original.transaction.items[0];
  original.transaction.items = [{ ...item, line_number: 1, quantity: '1.00', total_amount: '44.99' },
    { ...item, id: 2, line_number: 1, quantity: '1.00', total_amount: '45.01' }];
  const receipt = receiptDetails(original);
  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].subtotal, 'PHP 90.00');
  assert.equal(receipt.totals.find(([label]) => label === 'Total')[1], 'PHP 90.00');
});

test('order mapping keeps saved totals and omits the retired display property', () => {
  const mapped = mapOrder({ id: 1, customer: { id: 2, name: 'Customer' }, handled_by: { id: 7, username: 'staff' },
    status: 'fulfilled', created_at: '2026-10-30T04:00:00Z', transaction: sale().transaction,
    items: [{ id: 1, product: { id: 2, name: 'Milk' }, quantity: '2.00', unit_price: '50.00', subtotal: '100.00', total_amount: '90.00' }] });
  assert.equal(mapped.subtotal, 100); assert.equal(mapped.total, 90); assert.equal(mapped.items[0].netAmount, 90);
  assert.equal(Object.hasOwn(mapped, 'discountAmount'), false);
});
