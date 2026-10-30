import type { ExpiredInventoryBatch } from "@/features/inventory/api/inventory.service";

function stock(value: unknown, unit: string | undefined): string | undefined {
  if (value == null || String(value).trim() === "" || !Number.isFinite(Number(value))) return undefined;
  return `${value}${unit?.trim() ? ` ${unit.trim()}` : ""}`;
}

export function BatchDetailsFields({ batch }: { batch: ExpiredInventoryBatch }) {
  const source = batch.source;
  const item = source?.product;
  const unit = item?.unit ?? batch.unit;
  const fields: Array<[string, unknown]> = [
    ["Product name", source ? item?.name : batch.name],
    ["Batch number", source ? source.batch_number : batch.batch],
    ["Category", source ? item?.category?.name : batch.category],
    ["Expiry date", source ? source.expiration_date : batch.expiry],
    ["Remaining stock", stock(source ? source.remaining_quantity : batch.quantity, unit)],
    ["Initial stock", stock(source ? source.initial_quantity : batch.initialQuantity, unit)],
    ["Unit cost", source ? source.unit_price : batch.unitCost],
    ["Date received", source ? source.date_received : batch.dateReceived],
    ["Batch status", source ? source.status : batch.status],
    ["Notes", source ? source.notes : batch.notes],
  ];
  const present = fields.filter(([, value]) => value != null
    && (typeof value !== "string" || value.trim() !== "")
    && (typeof value !== "number" || Number.isFinite(value)));

  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
    {present.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900 [overflow-wrap:anywhere]">{String(value)}</dd>
    </div>)}
  </dl>;
}
