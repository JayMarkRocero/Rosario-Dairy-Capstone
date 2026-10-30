const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const code = buildSync({ stdin: { contents: `
  export { encodedByLabel } from './src/features/sales/utils/historyLabels';
  export { MobileSaleCard } from './src/features/sales/components/MobileSaleCard';
`, resolveDir: root }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'history-labels-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'history-labels-memory.cjs'); loaded.paths = module.paths;
loaded._compile(code, loaded.filename);
const { encodedByLabel, MobileSaleCard } = loaded.exports;
const transaction = overrides => ({ is_manually_encoded: true, source_reference: null,
  handled_by: { id: 7, username: 'encodingadmin', role: 'admin' }, payment_status: 'pending', ...overrides });
const sale = record => ({ receipt: 'SI-001', customer: 'Customer', cashier: 'Not recorded', date: '2026-10-30', payment: 'Cash', total: 120, transaction: record });

test('missing transaction metadata has no invented encoder and does not crash mobile history', () => {
  assert.equal(encodedByLabel(undefined), null); assert.equal(encodedByLabel(null), null);
  const html = renderToStaticMarkup(React.createElement(MobileSaleCard, { sale: sale(undefined), onView() {} }));
  assert.doesNotMatch(html, /ENCODED BY/); assert.match(html, /Cash/); assert.match(html, /Not recorded/);
});

test('encoding labels use the actual encoder role and username, independently of viewer or cashier', () => {
  assert.equal(encodedByLabel(transaction()), 'Encoded by Admin — encodingadmin');
  assert.equal(encodedByLabel(transaction({ handled_by: { id: 8, username: 'encoderstaff', role: 'staff' } })), 'Encoded by Staff — encoderstaff');
  assert.equal(encodedByLabel(transaction({ handled_by: { username: 'encoder', role: undefined } })), 'Encoded by encoder');
});

test('ordinary checkout, imported history and absent identities never receive a fabricated encoder label', () => {
  assert.equal(encodedByLabel(transaction({ is_manually_encoded: false })), null);
  assert.equal(encodedByLabel(transaction({ is_manually_encoded: undefined })), null);
  assert.equal(encodedByLabel(transaction({ source_reference: 'workbook:row-1' })), null);
  assert.equal(encodedByLabel(transaction({ handled_by: null })), null);
  assert.equal(encodedByLabel(transaction({ handled_by: { username: '  ', role: 'admin' } })), null);
});

for (const [status, label] of [['pending', 'Pending'], ['paid', 'Paid'], ['unknown', 'Not recorded'], [undefined, 'Not recorded']]) {
  test(`mobile history shows payment method and backend status ${status ?? 'missing'} separately`, () => {
    const html = renderToStaticMarkup(React.createElement(MobileSaleCard, { sale: sale(transaction({ payment_status: status })), onView() {} }));
    assert.match(html, /Cash/); assert.ok(html.includes(`>${label}</span>`));
    assert.match(html, /ENCODED BY/); assert.match(html, /Admin — encodingadmin/);
    assert.match(html, /CASHIER/); assert.match(html, /Not recorded/);
    assert.match(html, /View Details/);
  });
}

test('mobile imported receipts keep their cashier and source classification without encoding labels', () => {
  const html = renderToStaticMarkup(React.createElement(MobileSaleCard, { sale: sale(transaction({ source_reference: 'workbook:row-1' })), onView() {} }));
  assert.doesNotMatch(html, /ENCODED BY|encodingadmin/);
  assert.match(html, /CASHIER/); assert.match(html, /Not recorded/);
});
