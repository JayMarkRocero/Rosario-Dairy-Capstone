const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { AxiosError } = require('axios');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
let api, states, refs, slots, effects, stateIndex, refIndex, effectIndex, updates, messages;
const hooks = { ...React,
  useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
  useRef(initial) { const i = refIndex++; return refs[i] ?? (refs[i] = { current: initial }); },
  useEffect(effect, deps) { const i = effectIndex++, before = slots[i]; if (!before || deps.some((value, index) => !Object.is(value, before.deps[index]))) effects.push(() => { before?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }); },
};
const compiled = buildSync({ stdin: { contents: `
  export { PaymentUpdateControl, canUpdatePayment } from './src/features/sales/components/PaymentUpdateControl';
  export { paymentAuditFields, receiptDetails } from './src/features/sales/utils/receiptDetails';
  export { toSale } from './src/features/sales/api/sales.service';
  export { default as http, ApiError, setAccessToken } from './src/lib/api';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env': '{}' }, alias: { '@': path.join(root, 'src') } }).outputFiles[0].text;
const token = id => `h.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.s`;
const tx = overrides => ({ id: 12, is_manually_encoded: true, can_update_payment: true, is_voided: false,
  payment_status: 'pending', payment_method: 'cash', total_amount: '50.00', subtotal: '50.00', amount_tendered: null,
  created_at: '2026-10-31T01:00:00Z', transaction_number: 'SI-12', items: [],
  handled_by: { id: 1, username: 'encoder', role: 'admin' }, ...overrides });
const response = (config, data, status = 200) => ({ config, data, status, statusText: 'OK', headers: {} });
function nodes(tree, check) {
  if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, check));
  if (!tree?.props) return [];
  return [...(check(tree) ? [tree] : []), ...nodes(tree.props.children, check)];
}
const render = record => { stateIndex = refIndex = effectIndex = 0; const tree = api.PaymentUpdateControl({ transaction: record, onUpdated: value => updates.push(value) }); effects.splice(0).forEach(effect => effect()); return tree; };
const modal = tree => nodes(tree, node => node.props.title === 'Update payment')[0];
const open = record => { const tree = render(record); nodes(tree, node => node.props.children === 'Update payment')[0].props.onClick(); return render(record); };
const chooseOnlinePaid = record => { let tree = open(record); nodes(tree, node => node.props['aria-label'] === 'Updated payment status')[0].props.onChange({ target: { value: 'paid' } }); tree = render(record); nodes(tree, node => node.props['aria-label'] === 'Updated payment method')[0].props.onChange({ target: { value: 'online' } }); return render(record); };
const turn = () => new Promise(setImmediate);
beforeEach(() => {
  states = []; refs = []; slots = []; effects = []; updates = []; messages = [];
  const storage = new Map([['rosario_access_token', token(1)]]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  global.window = new EventTarget();
  const loaded = new Module(path.join(root, 'tests', 'payment-finalization-memory.cjs'), module);
  loaded.filename = path.join(root, 'tests', 'payment-finalization-memory.cjs'); loaded.paths = module.paths;
  loaded.require = id => id === 'react' ? hooks : id === 'sonner' ? { toast: { success: message => messages.push(message), error: message => messages.push(message) } } : require(id);
  loaded._compile(compiled, loaded.filename); api = loaded.exports;
});
afterEach(() => { slots.forEach(slot => slot?.cleanup?.()); });

test('payment capability and Paid status hide finalized and forbidden actions, with older-response fallback', () => {
  for (const record of [tx({ payment_status: 'paid' }), tx({ can_update_payment: false }), tx({ is_voided: true }), tx({ is_manually_encoded: false })]) {
    assert.equal(api.canUpdatePayment(record), false); assert.equal(render(record), null);
  }
  assert.equal(api.canUpdatePayment(tx({ can_update_payment: undefined })), true);
  assert.equal(api.canUpdatePayment(tx({ can_update_payment: null })), true);
});

test('payment save revalidates via GET before the original PATCH and closes on success', async () => {
  const record = tx(), calls = [], saved = tx({ payment_status: 'paid', payment_method: 'online', can_update_payment: false });
  api.http.defaults.adapter = async config => { calls.push(config); return response(config, config.method === 'get' ? record : saved); };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  assert.deepEqual(calls.map(call => [call.method, call.url]), [['get', '/sales/encoding/12/'], ['patch', '/sales/encoding/12/payment/']]);
  assert.deepEqual(JSON.parse(calls[1].data), { payment_status: 'paid', payment_method: 'online', amount_tendered: null });
  assert.equal(updates[0], saved); assert.equal(modal(render(record)).props.open, false);
});

test('fresh finalized state prevents a PATCH and returns saved state without changing payment', async () => {
  const record = tx(), calls = [], paid = tx({ payment_status: 'paid', can_update_payment: false });
  api.http.defaults.adapter = async config => { calls.push(config); return response(config, paid); };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'get'); assert.deepEqual(updates, [paid]);
  assert.equal(modal(render(record)).props.open, false);
});

test('locked conflict preserves server error code, reads current record and permanently closes stale editor', async () => {
  const record = tx(), calls = [], paid = tx({ payment_status: 'paid', can_update_payment: false });
  api.http.defaults.adapter = async config => {
    calls.push(config);
    if (config.method === 'patch') throw new AxiosError('Conflict', undefined, config, undefined, response(config, { code: 'payment_locked', error: 'Payment is read-only.' }, 409));
    return response(config, calls.length === 1 ? record : paid);
  };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  assert.deepEqual(calls.map(call => call.method), ['get', 'patch', 'get']); assert.deepEqual(updates, [paid]);
  assert.equal(render(record), null); assert.equal(messages.at(-1), 'Payment is read-only.');
});

test('failed locked refresh still keeps the stale editor inaccessible without retrying PATCH', async () => {
  const record = tx(); let reads = 0, writes = 0;
  api.http.defaults.adapter = async config => {
    if (config.method === 'patch') { writes++; throw new AxiosError('Conflict', undefined, config, undefined, response(config, { code: 'payment_locked', error: 'Payment is read-only.' }, 409)); }
    if (++reads > 1) throw new Error('Offline'); return response(config, record);
  };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  assert.equal(render(record), null); assert.equal(writes, 1); assert.equal(reads, 2);
});

test('live finalization wins over an older pre-save read without restoring its pending response', async () => {
  const record = tx(); let finish, writes = 0;
  api.http.defaults.adapter = config => { if (config.method === 'patch') writes++; return new Promise(resolve => { finish = () => resolve(response(config, record)); }); };
  const saving = modal(chooseOnlinePaid(record)).props.footer.props.onClick(); await turn();
  assert.equal(render(tx({ payment_status: 'paid', can_update_payment: false })), null);
  finish(); await saving;
  assert.equal(writes, 0); assert.deepEqual(updates, []);
});

test('failed pre-save GET never submits and allows an explicit retry after recovery', async () => {
  const record = tx(); let calls = 0, writes = 0;
  api.http.defaults.adapter = async config => { calls++; if (calls === 1) throw new Error('Timeout'); if (config.method === 'patch') writes++; return response(config, record); };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  assert.equal(writes, 0); assert.equal(modal(render(record)).props.open, true);
  await modal(render(record)).props.footer.props.onClick();
  assert.equal(writes, 1); assert.equal(calls, 3);
});

test('unmount aborts obsolete validation GETs and never starts a payment write', async () => {
  const record = tx(); let finish, signal, writes = 0;
  api.http.defaults.adapter = config => { if (config.method === 'patch') writes++; signal = config.signal; return new Promise(resolve => { finish = () => resolve(response(config, record)); }); };
  const saving = modal(chooseOnlinePaid(record)).props.footer.props.onClick(); await turn();
  slots.forEach(slot => slot?.cleanup?.()); finish(); await saving;
  assert.equal(signal.aborted, true); assert.equal(writes, 0); assert.deepEqual(updates, []);
});

test('lost successful response recovers saved Paid result on retry without another payment write', async () => {
  const record = tx(), paid = tx({ payment_status: 'paid', can_update_payment: false }); let writes = 0;
  api.http.defaults.adapter = async config => {
    if (config.method === 'patch') { writes++; throw new Error('Lost response'); }
    return response(config, writes ? paid : record);
  };
  await modal(chooseOnlinePaid(record)).props.footer.props.onClick();
  await modal(render(record)).props.footer.props.onClick();
  assert.equal(writes, 1); assert.deepEqual(updates, [paid]);
});

test('an account change invalidates a late pre-save read and prevents a cross-account PATCH', async () => {
  const record = tx(); let finish, writes = 0;
  api.http.defaults.adapter = config => { if (config.method === 'patch') writes++; return new Promise(resolve => { finish = () => resolve(response(config, record)); }); };
  const saving = modal(chooseOnlinePaid(record)).props.footer.props.onClick(); await turn();
  api.setAccessToken(token(99)); finish(); await saving;
  assert.equal(writes, 0); assert.deepEqual(updates, []);
});

test('payment audit shows actual updater independently from encoder and same-second creation', () => {
  const record = tx({ payment_updated_by_user: { id: 2, username: 'different-staff', role: 'staff' }, payment_updated_at: '2026-10-31T01:00:00.100Z' });
  const fields = api.receiptDetails(api.toSale(record)).fields;
  assert.deepEqual(fields.find(([key]) => key === 'Payment updated by'), ['Payment updated by', 'different-staff']);
  assert.match(fields.find(([key]) => key === 'Payment updated')[1], /Asia\/Manila/);
  assert.deepEqual(api.paymentAuditFields({ payment_updated_by_user: null, payment_updated_at: null }), [['Payment updated by', 'Not recorded'], ['Payment updated', 'Not provided']]);
  assert.deepEqual(api.paymentAuditFields({ created_at: record.created_at, payment_updated_at: record.created_at }), [], 'Older initial-payment timestamps retain their previous display');
});
