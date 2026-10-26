import { TABLE_CARD_CLASS_NAME } from "@/components/data-display/TableCard";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { ActionButton } from "@/components/buttons/ActionButton";
import { Modal } from "@/components/overlays/Modal";
import { Drawer } from "@/components/overlays/Drawer";
import { Btn } from "@/components/buttons/Btn";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { StaffInventoryCard } from "./StaffInventoryCard";
import { BatchDetailsFields } from "./BatchDetailsFields";
import { ProductDetail } from "./ProductDetail";

type Props = ComponentProps<typeof EnhancedTable<InventoryItem>> & { errorContent?: ReactNode };

export function StaffInventoryTable({ errorContent, ...props }: Props) {
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
    <div className={TABLE_CARD_CLASS_NAME}>
      {errorContent ?? <EnhancedTable {...props} responsivePageSize measureRenderedRows columns={columns} contentHeight reserveTableHeight={false}
        pageSize={5} autoPageSize={false} pageCapacity={undefined} rowHeight={52}
        rowKey={item => item.catalogKey || `product-${item.id}`} onRowClick={view}
        renderMobileRow={item => <StaffInventoryCard product={item} onView={view} />} />}
    </div>
    <Drawer open={!!selected && !selected.expiredBatch} onClose={() => setSelected(null)}
      title="Product Details" subtitle="View full product information" size="sm"
      footer={<Btn variant="secondary" onClick={() => setSelected(null)}>Close</Btn>}>
      {selected && !selected.expiredBatch && <ProductDetail p={selected} />}
    </Drawer>
    <Modal open={!!selected?.expiredBatch} onClose={() => setSelected(null)} title="Expired batch details" size="sm">
      {selected?.expiredBatch && <BatchDetailsFields batch={selected.expiredBatch} />}
    </Modal>
  </>;
}
