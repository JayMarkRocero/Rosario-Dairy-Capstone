const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const code = buildSync({
  entryPoints: [path.join(root, 'src/features/inventory/utils/formatQuantity.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
}).outputFiles[0].text;
const loaded = new Module(path.join(__dirname, 'inventory-quantity-memory.cjs'), module);
loaded.filename = path.join(__dirname, 'inventory-quantity-memory.cjs');
loaded.paths = module.paths;
loaded._compile(code, loaded.filename);
const { formatInventoryQuantity } = loaded.exports;

test('count nouns use singular only for exactly one and trim insignificant decimal zeroes', () => {
  const pairs = [
    ['unit', 'units'], ['piece', 'pieces'], ['bottle', 'bottles'], ['pack', 'packs'],
    ['carton', 'cartons'], ['liter', 'liters'], ['litre', 'litres'], ['box', 'boxes'],
  ];
  for (const [singular, plural] of pairs) {
    for (const unit of [singular, plural]) {
      assert.equal(formatInventoryQuantity('0.00', unit), `0 ${plural}`);
      assert.equal(formatInventoryQuantity('1.00', unit), `1 ${singular}`);
      assert.equal(formatInventoryQuantity('1.25', unit), `1.25 ${plural}`);
      assert.equal(formatInventoryQuantity('2.00', unit), `2 ${plural}`);
    }
  }
  assert.equal(formatInventoryQuantity('7.00', 'unit'), '7 units');
  assert.equal(formatInventoryQuantity('15.00', 'unit'), '15 units');
  assert.equal(formatInventoryQuantity('0001.000', 'UNITS'), '1 UNIT');
  assert.equal(formatInventoryQuantity('2.000', 'Box'), '2 Boxes');
});

test('decimal strings retain exact large values and meaningful fractional precision', () => {
  const source = Object.freeze({ quantity: '00090071992547409931234567890.1234567890123456789000', unit: 'units' });
  const before = JSON.stringify(source);
  assert.equal(formatInventoryQuantity(source.quantity, source.unit), '90071992547409931234567890.1234567890123456789 units');
  assert.equal(formatInventoryQuantity('1.0000000000000000000000000001', 'unit'), '1.0000000000000000000000000001 units');
  assert.equal(formatInventoryQuantity('0.00000000000000000000000100'), '0.000000000000000000000001');
  assert.equal(JSON.stringify(source), before);
});

test('measurement abbreviations, symbols, and unknown nouns remain unchanged', () => {
  for (const unit of ['L', 'kg', 'mL', '%', 'µg', 'sheep', 'case', 'cases', 'constructor', '__proto__']) {
    assert.equal(formatInventoryQuantity('1.00', unit), `1 ${unit}`);
    assert.equal(formatInventoryQuantity('7.50', unit), `7.5 ${unit}`);
  }
  assert.equal(formatInventoryQuantity(' 007.5000 ', ' L '), '7.5 L');
  assert.equal(formatInventoryQuantity('7.00'), '7');
  assert.equal(formatInventoryQuantity('7.50', ''), '7.5');
});

test('finite numbers render decimal notation and normalized zero', () => {
  assert.equal(formatInventoryQuantity(1, 'units'), '1 unit');
  assert.equal(formatInventoryQuantity(1.25, 'unit'), '1.25 units');
  assert.equal(formatInventoryQuantity(1e21, 'unit'), '1000000000000000000000 units');
  assert.equal(formatInventoryQuantity(1e-7, 'L'), '0.0000001 L');
  assert.equal(formatInventoryQuantity(-0, 'unit'), '0 units');
  assert.equal(formatInventoryQuantity('-0.00', 'unit'), '0 units');
  assert.equal(formatInventoryQuantity('-1.00', 'unit'), '-1 units');
});

test('invalid values display a placeholder without inventing stock', () => {
  for (const value of ['', ' ', 'not a quantity', 'NaN', 'Infinity', '1e2', '1,000', '1.2.3', NaN, Infinity, -Infinity, null, undefined, {}, []]) {
    assert.equal(formatInventoryQuantity(value, 'units'), '—');
  }
});
