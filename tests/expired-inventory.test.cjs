const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const code = buildSync({ entryPoints: [path.join(root, 'src/features/inventory/utils/expiredInventory.ts')],
  bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
  alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const loaded = new Module(path.join(root, 'tests', 'expired-inventory-memory.cjs'), module);
loaded.filename = path.join(root, 'tests', 'expired-inventory-memory.cjs'); loaded.paths = module.paths;
loaded._compile(code, loaded.filename);
const { mapExpiredDisposals, selectExpiredRows } = loaded.exports;

const adjustment = (overrides = {}) => ({
  id: 71, adjustment_type: 'expired', quantity: '2.50', unit_cost: '99.99', reason: 'Expired write-off',
  created_at: '2026-10-30T08:00:00+08:00', updated_at: '2026-10-30T08:00:00+08:00',
  adjusted_by: { id: 4, username: 'recordingstaff', role: 'staff' },
  product_batch: { id: 15, batch_number: 'B-15', expiration_date: '2026-10-28', status: 'disposed', remaining_quantity: '0.00',
    product: { id: 3, name: 'Milk', variant: '1 L', unit: 'bottle', category: { name: 'Dairy' } } },
  ...overrides,
});
const current = (overrides = {}) => ({
  id: 3, catalogKey: 'expired-product-15', name: 'Milk 1 L', cat: 'Dairy', unit: 'bottle', stock: 7.5, expiry: '2000-01-01', low: false,
  expiredBatch: { id: 15, itemId: 3, kind: 'product', status: 'expired', batch: 'B-15', quantity: 7.5, expiry: '2000-01-01', dateReceived: '2000-01-01' },
  ...overrides,
});

test('only explicit expired write-offs become historical disposal rows without inferring from batch status', () => {
  const rows = mapExpiredDisposals([
    adjustment({ id: 1, adjustment_type: 'spoilage' }),
    adjustment({ id: 2, adjustment_type: 'correction' }),
    adjustment({ id: 3, adjustment_type: 'complimentary' }),
    adjustment({ id: 4, adjustment_type: 'free_taste' }),
    adjustment({ id: 5, adjustment_type: undefined }),
    adjustment({ id: 6, product_batch: { ...adjustment().product_batch, status: 'available', remaining_quantity: '7.50' } }),
  ]);
  assert.deepEqual(rows.map(row => row.expiredDisposal.adjustmentId), [6]);
  assert.equal(rows[0].expiredBatch, undefined);
});

test('duplicate adjustment IDs collapse while distinct events for the same batch remain in newest-first order', () => {
  const original = adjustment();
  const later = adjustment({ id: 72, quantity: '1.25', created_at: '2026-10-31T08:00:00+08:00' });
  const before = JSON.stringify([original, later]);
  const rows = mapExpiredDisposals([original, original, later]);
  assert.deepEqual(rows.map(row => row.catalogKey), ['disposed-adjustment-72', 'disposed-adjustment-71']);
  assert.deepEqual(rows.map(row => row.expiredDisposal.batchId), [15, 15]);
  assert.deepEqual(rows.map(row => row.expiredDisposal.quantity), ['1.25', '2.50']);
  assert.equal(JSON.stringify([original, later]), before);
});

test('disposal mapping preserves recorded decimal quantity and product metadata while contributing zero current stock', () => {
  const [row] = mapExpiredDisposals([adjustment({ quantity: '0002.50' })]);
  assert.deepEqual(row, { catalogKey: 'disposed-adjustment-71', id: 3, name: 'Milk 1 L', cat: 'Dairy', unit: 'bottle',
    stock: 0, expiry: '2026-10-28', low: false,
    expiredDisposal: { adjustmentId: 71, batchId: 15, batch: 'B-15', quantity: '0002.50', disposedAt: '2026-10-30T08:00:00+08:00', adjustedBy: 'recordingstaff' } });
  for (const key of ['inventoryValue', 'unitCost', 'unit_cost', 'cost', 'value', 'total']) {
    assert.equal(Object.hasOwn(row, key), false);
    assert.equal(Object.hasOwn(row.expiredDisposal, key), false);
  }
  const [anonymous] = mapExpiredDisposals([adjustment({ adjusted_by: null })]);
  assert.equal(Object.hasOwn(anonymous.expiredDisposal, 'adjustedBy'), false);
});

test('partial disposal history and eligible remaining stock stay separate in all three expired views', () => {
  const remaining = current();
  const catalog = { id: 3, name: 'Milk 1 L', cat: 'Dairy', stock: 12, expiry: '2000-01-01', low: false };
  const later = current({ catalogKey: 'expired-product-16', expiry: '2001-01-01', expiredBatch: { ...remaining.expiredBatch, id: 16, expiry: '2001-01-01' } });
  const disposals = mapExpiredDisposals([adjustment(), adjustment({ id: 72, quantity: '1.25', created_at: '2026-10-31T08:00:00+08:00' })]);
  const items = [catalog, later, remaining];
  const before = JSON.stringify(items);
  const reverseHistory = [...disposals].reverse();
  const historyBefore = JSON.stringify(reverseHistory);
  assert.deepEqual(selectExpiredRows(items, reverseHistory, 'all'), [remaining, later, ...disposals]);
  assert.deepEqual(selectExpiredRows(items, disposals, 'awaiting'), [remaining, later]);
  assert.deepEqual(selectExpiredRows(items, disposals, 'disposed'), disposals);
  assert.equal(JSON.stringify(items), before);
  assert.equal(JSON.stringify(reverseHistory), historyBefore);
  assert.equal(selectExpiredRows(items, disposals, 'all').filter(row => row.id === 3).length, 4);
  assert.equal(selectExpiredRows(items, disposals, 'all')[0].stock, 7.5);
  assert.equal(disposals[0].stock, 0);
});

test('awaiting view excludes disposed, depleted, empty, invalid and unreceived batches', () => {
  const batch = current().expiredBatch;
  const rows = [
    current({ expiredBatch: { ...batch, status: 'disposed' } }),
    current({ expiredBatch: { ...batch, status: 'depleted' } }),
    current({ expiredBatch: { ...batch, quantity: 0 } }),
    current({ expiredBatch: { ...batch, quantity: -1 } }),
    current({ expiredBatch: { ...batch, quantity: NaN } }),
    current({ expiredBatch: { ...batch, dateReceived: '9999-12-31' } }),
    current({ expiredBatch: undefined }),
  ];
  assert.deepEqual(selectExpiredRows(rows, [], 'awaiting'), []);
});

test('null and malformed history entries cannot create disposal rows or crash the mapper', () => {
  const valid = adjustment();
  const invalid = [null, undefined, {}, ...[null, undefined, '', '0', '0.00', '-1', 'NaN', 'Infinity', '1e2', ' 2.50 ', 2.5].map(quantity => adjustment({ quantity })),
    adjustment({ id: 0 }), adjustment({ id: -1 }), adjustment({ id: 1.5 }), adjustment({ id: '71' }),
    adjustment({ product_batch: null }), adjustment({ product_batch: { ...valid.product_batch, id: 0 } }),
    adjustment({ product_batch: { ...valid.product_batch, product: null } }),
    adjustment({ product_batch: { ...valid.product_batch, product: { ...valid.product_batch.product, id: null } } }),
    adjustment({ product_batch: { ...valid.product_batch, product: { ...valid.product_batch.product, category: null } } }),
    adjustment({ product_batch: { ...valid.product_batch, batch_number: null } }),
    adjustment({ product_batch: { ...valid.product_batch, expiration_date: '2026-02-30' } }),
    adjustment({ product_batch: { ...valid.product_batch, expiration_date: null } }),
    ...[null, '', 'not-a-date', '2026-02-30T08:00:00Z'].map(created_at => adjustment({ created_at })),
  ];
  assert.deepEqual(mapExpiredDisposals(invalid), []);
  assert.deepEqual(mapExpiredDisposals(null), []);
  assert.equal(mapExpiredDisposals([...invalid, valid]).length, 1, 'invalid entries do not reserve an otherwise valid adjustment ID');
});
