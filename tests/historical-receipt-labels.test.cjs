const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
// Keep the real receipt content while bypassing the animated shell and payment
// editor, whose lifecycle and API behavior are covered by the existing UI suite.
const receiptUI = build({
  stdin: {
    contents: `
      export { receiptDetails } from './src/features/sales/utils/receiptDetails';
      export { TransactionDetails } from './src/features/sales/components/TransactionDetails';
    `,
    resolveDir: root,
  },
  alias: { '@': path.join(root, 'src') },
  define: { 'import.meta.env': '{}' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  plugins: [{
    name: 'receipt-shell-only',
    setup(builder) {
      builder.onLoad({ filter: /[\\/]components[\\/]overlays[\\/]Modal\.tsx$/ }, () => ({
        contents: `import React from 'react'; export function Modal({children, footer}) { return React.createElement('section', null, children, footer); }`,
        loader: 'js',
      }));
      builder.onLoad({ filter: /[\\/]sales[\\/]components[\\/]PaymentUpdateControl\.tsx$/ }, () => ({
        contents: 'export function PaymentUpdateControl() { return null; }', loader: 'js',
      }));
    },
  }],
}).then(result => {
  const compiled = new Module(path.join(root, 'tests', 'receipt-labels-in-memory.cjs'), module);
  compiled.filename = path.join(root, 'tests', 'receipt-labels-in-memory.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
});

function item(overrides = {}) {
  return {
    id: 1, line_number: null, quantity: '2.00', unit_price: '60.00',
    subtotal: null, discount_amount: null, total_amount: null,
    source_line_total: '120.00', product_name_snapshot: 'Milk', product_variant_snapshot: '',
    product_batch: { batch_number: 'BATCH-1', product: { name: 'Milk', variant: '' } },
    ...overrides,
  };
}

function sale(transaction = {}) {
  return {
    receipt: 'SI-001', customer: 'Test customer', cashier: 'Not recorded',
    date: '2026-09-10', payment: 'Cash', total: 100,
    transaction: {
      id: 1, created_at: '2026-09-10T01:00:00Z', payment_status: 'paid',
      source_reference: 'imported-workbook:row-1', source_note: 'Original source note.',
      subtotal: '120.00', discount_amount: '20.00', total_amount: '100.00',
      amount_tendered: null, change_due: null, items: [item()],
      ...transaction,
    },
  };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('imported receipts label source amounts without changing recorded totals or exposing retired fields', async () => {
  const { receiptDetails } = await receiptUI;
  const source = freeze(sale());
  const before = JSON.stringify(source);
  const receipt = receiptDetails(source);
  assert.equal(receipt.lineAmountLabel, 'Recorded line amount');
  assert.match(receipt.lineAmountNote, /recorded source values/);
  assert.match(receipt.lineAmountNote, /may differ from the recorded invoice total/);
  assert.doesNotMatch(receipt.lineAmountNote, /discount/i);
  assert.equal(receipt.note, 'Original source note.');
  assert.equal(receipt.items[0].subtotal, 'PHP 120.00');
  assert.equal(receipt.items[0].gross, 'Not provided');
  assert.equal(Object.hasOwn(receipt.items[0], 'discount'), false);
  assert.deepEqual(receipt.totals, [
    ['Subtotal', 'PHP 120.00'], ['Total', 'PHP 100.00'],
    ['Amount Tendered', 'Not provided'], ['Change', 'Not provided'],
  ]);
  assert.equal(JSON.stringify(source), before);
});

test('imported missing source amounts remain unknown even if a local line total exists', async () => {
  const { receiptDetails } = await receiptUI;
  const receipt = receiptDetails(sale({ items: [item({ source_line_total: null, total_amount: '100.00' })] }));
  assert.equal(receipt.lineAmountLabel, 'Recorded line amount');
  assert.equal(receipt.items[0].subtotal, 'Not provided');
  assert.equal(receipt.items[0].price, 'Not provided');
  assert.deepEqual(receipt.totals.find(([label]) => label === 'Total'), ['Total', 'PHP 100.00']);
});

test('grouped imported lines sum only recorded source values and preserve missing amounts', async () => {
  const { receiptDetails } = await receiptUI;
  const source = freeze(sale({ items: [
    item({ id: 10, line_number: 7, quantity: '1.50', source_line_total: '90.00' }),
    item({ id: 11, line_number: 7, quantity: '0.50', source_line_total: '30.00' }),
  ] }));
  const receipt = receiptDetails(source);
  assert.equal(receipt.items.length, 1);
  assert.equal(receipt.items[0].quantity, '2');
  assert.equal(receipt.items[0].subtotal, 'PHP 120.00');
  assert.equal(receipt.items[0].batch, 'Not recorded');
  const missing = sale({ items: [
    item({ id: 10, line_number: 7, source_line_total: '90.00' }),
    item({ id: 11, line_number: 7, source_line_total: null }),
  ] });
  assert.equal(receiptDetails(missing).items[0].subtotal, 'Not provided');
});

test('older local checkout retains recorded line and invoice totals without discount output', async () => {
  const { receiptDetails } = await receiptUI;
  const source = freeze(sale({ source_reference: null, items: [
    item({ id: 10, line_number: 1, quantity: '1.00', subtotal: '60.00', discount_amount: '10.00', total_amount: '50.00', source_line_total: null }),
    item({ id: 11, line_number: 1, quantity: '1.00', subtotal: '60.00', discount_amount: '10.00', total_amount: '50.00', source_line_total: null }),
  ] }));
  const before = JSON.stringify(source);
  const receipt = receiptDetails(source);
  assert.equal(receipt.lineAmountLabel, 'Line amount');
  assert.equal(receipt.lineAmountNote, '');
  assert.equal(receipt.items[0].subtotal, 'PHP 100.00');
  assert.equal(receipt.items[0].gross, 'PHP 120.00');
  assert.equal(Object.hasOwn(receipt.items[0], 'discount'), false);
  assert.equal(receipt.totals.some(([label]) => label === 'Discount'), false);
  assert.deepEqual(receipt.totals.find(([label]) => label === 'Total'), ['Total', 'PHP 100.00']);
  assert.equal(JSON.stringify(source), before);
});

test('Transaction Details renders the historical label and explanation with existing receipt styling', async () => {
  const { TransactionDetails } = await receiptUI;
  const html = renderToStaticMarkup(React.createElement(TransactionDetails, { sale: sale(), onClose() {} }));
  assert.match(html, /<th class="py-2 text-right">Recorded line amount<\/th>/);
  assert.match(html, /class="text-xs text-slate-500">Original source note\. Historical line amounts/);
  assert.match(html, /may differ from the recorded invoice total/);
  assert.doesNotMatch(html, /discount/i);
  assert.match(html, /PHP 120\.00/);
  assert.match(html, /PHP 100\.00/);
  const local = renderToStaticMarkup(React.createElement(TransactionDetails, {
    sale: sale({ source_reference: null, source_note: '', items: [item({ total_amount: '100.00' })] }), onClose() {},
  }));
  assert.match(local, /<th class="py-2 text-right">Line amount<\/th>/);
  assert.doesNotMatch(local, /Recorded line amount|Historical line amounts|per-line allocations/);
});
