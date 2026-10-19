import { useState, type ComponentProps } from "react";
import { Eye } from "lucide-react";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { ActionButton } from "@/components/buttons/ActionButton";
import { Modal } from "@/components/overlays/Modal";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { StaffInventoryCard } from "./StaffInventoryCard";
import { BatchDetailsFields } from "./BatchDetailsFields";

type Props = ComponentProps<typeof EnhancedTable<InventoryItem>>;

export function StaffInventoryTable(props: Props) {
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const view = (item: InventoryItem) => props.onRowClick ? props.onRowClick(item) : setSelected(item);
  const actionColumn: Column<InventoryItem> = {
    key: "actions", header: "Actions", align: "center", width: "12%",
    render: item => <div onClick={event => event.stopPropagation()}>
      <ActionButton label="View details" onClick={() => view(item)} className="border border-slate-200"><Eye size={13} /></ActionButton>
    </div>,
  };
  const columns = props.columns.some(column => column.key === "actions")
    ? props.columns.map(column => column.key === "actions" ? { ...column, render: actionColumn.render } : column)
    : [...props.columns, actionColumn];

  return <>
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between flex-1 min-h-0 overflow-hidden [&_.enhanced-table]:flex-1 [&_.enhanced-table]:min-h-0 [&_.enhanced-table]:overflow-hidden [&_[data-table-surface]]:flex-1 [&_[data-table-surface]]:min-h-0 [&_[data-table-surface]]:overflow-hidden [&_[data-table-surface]>div:last-child]:!overflow-visible [&_tbody_tr]:!h-auto [&_tbody_td]:!py-2 [&_.enhanced-table>div:last-child:not([data-table-surface])]:mt-auto [&_.enhanced-table>div:last-child:not([data-table-surface])]:!pt-3 [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-t [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-slate-100">
      <EnhancedTable {...props} columns={columns} contentHeight reserveTableHeight={false}
        pageSize={6} autoPageSize={false} pageCapacity={undefined} rowHeight={52}
        rowKey={item => item.catalogKey || `product-${item.id}`} onRowClick={view}
        renderMobileRow={item => <StaffInventoryCard product={item} onView={view} />} />
    </div>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.expiredBatch ? "Expired batch details" : "Product details"} size="sm">
      {selected?.expiredBatch ? <BatchDetailsFields batch={selected.expiredBatch} /> : selected && <div className="space-y-3 text-sm">
        <p className="font-semibold">{selected.name}</p><p>{selected.cat}</p>
        <p>Stock: {selected.stock} {selected.unit}</p>
        {selected.expiry && <p>Expiry: {selected.expiry}</p>}
      </div>}
    </Modal>
  </>;
}
