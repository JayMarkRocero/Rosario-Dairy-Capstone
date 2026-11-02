const countUnits = new Map<string, readonly [string, string]>();

for (const pair of [
  ['unit', 'units'],
  ['piece', 'pieces'],
  ['bottle', 'bottles'],
  ['pack', 'packs'],
  ['carton', 'cartons'],
  ['liter', 'liters'],
  ['litre', 'litres'],
  ['box', 'boxes'],
] as const) {
  countUnits.set(pair[0], pair);
  countUnits.set(pair[1], pair);
}

// Finite numbers may stringify in exponential notation; decimal strings never
// pass through Number, so backend quantities retain all of their precision.
function expandNumber(value: number): string {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/.exec(text);
  if (!match) return text;

  const [, sign, whole, fraction = '', exponent] = match;
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** Formats an inventory quantity for display without changing its source value. */
export function formatInventoryQuantity(value: string | number, unit?: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';

  const raw = typeof value === 'number' ? expandNumber(value) : value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return '—';

  const [, sign, integer, decimal = ''] = match;
  const whole = integer.replace(/^0+(?=\d)/, '');
  const fraction = decimal.replace(/0+$/, '');
  const negative = sign === '-' && (whole !== '0' || fraction !== '');
  const quantity = `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
  const label = typeof unit === 'string' ? unit.trim() : '';
  if (!label) return quantity;

  const pair = countUnits.get(label.toLowerCase());
  if (!pair) return `${quantity} ${label}`;

  let noun = pair[quantity === '1' ? 0 : 1];
  if (label === label.toUpperCase()) noun = noun.toUpperCase();
  else if (label[0] === label[0].toUpperCase()) noun = noun[0].toUpperCase() + noun.slice(1);
  return `${quantity} ${noun}`;
}
