import { useStaffAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { filterSelectClass } from "@/styles/controlClasses";
import { ActionButton } from "@/components/buttons/ActionButton";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useEffect, useMemo, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { Btn } from "@/components/buttons/Btn";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Drawer } from "@/components/overlays/Drawer";
import { ordersService } from "@/features/orders/api/orders.service";
import { CreateOrderModal } from "@/features/orders/components/CreateOrderModal";
import type { OrderListItem } from "@/features/orders/types/order";
import { C } from "@/styles/tokens/colors";

const STATUSES = ["Fulfilled", "Cancelled"];

export function StaffOrders() {
  const pageCapacity = useStaffAutoPageSize(56);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    ordersService.getAll().then(setOrders).catch(error => toastApiError(error, "Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => orders.filter(order => status === "All" || order.status === status), [orders, status]);
  const view = (order: OrderListItem) => { setSelected(order); setViewOpen(true); };

  const columns: Column<OrderListItem>[] = [
    { key:"id", header:"Order ID", align:"left", width:"15%", render:o=><span className="font-mono text-xs" style={{color:C.muted}}>#{o.id}</span> },
    { key:"customer", header:"Customer", align:"left", width:"22%", sortKey:o=>o.customer, render:o=><span className="font-medium text-sm">{o.customer}</span> },
    { key:"status", header:"Status", align:"center", width:"18%", render:o=><StatusBadge status={o.status}/> },
    { key:"date", header:"Date", align:"center", width:"18%", render:o=><span className="text-xs" style={{color:C.muted}}>{o.date}</span> },
    { key:"total", header:"Total", align:"center", width:"15%", sortKey:o=>o.total, render:o=><span className="font-medium text-sm">₱{o.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", width:"12%", render:o=><div onClick={e=>e.stopPropagation()}><ActionButton label="View details" onClick={()=>view(o)}><Eye size={13}/></ActionButton></div> },
  ];

  return <div className="records-page px-4 sm:px-6 py-2 flex flex-1 flex-col h-full min-h-0 gap-3 overflow-hidden max-w-[1400px] mx-auto w-full">
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-base sm:text-lg font-bold" style={{color:C.muted}}>Manage and track customer orders</h2><Btn variant="primary" icon={<Plus size={16}/>} onClick={()=>setCreateOpen(true)}>Create Order</Btn></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">{[
      ["Total", orders.length, C.blue], ["Fulfilled", orders.filter(o=>o.status==="Fulfilled").length, C.green], ["Cancelled", orders.filter(o=>o.status==="Cancelled").length, C.red],
    ].map(([label,value,color])=><SummaryCard compact key={String(label)} label={String(label)} value={value} color={String(color)} />)}</div>
    <Card className="records-card p-3 sm:p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
      <EnhancedTable rowHeight={56} fillHeight scrollBody disableScroll columns={columns} data={filtered} rowKey={o=>o.id} pageCapacity={pageCapacity} searchable searchKeys={o=>[String(o.id),o.customer,o.staff]} searchPlaceholder="Search orders…" showExport={false} onRowClick={view} loading={loading} emptyTitle="No orders found" emptyDesc="No orders match your filters." extraControls={<select value={status} onChange={e=>setStatus(e.target.value)} className={filterSelectClass}><option value="All">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>}/>
    </Card>
    <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details" subtitle={selected?`#${selected.id}`:""} size="md">
      {selected&&<div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[["Order ID",`#${selected.id}`],["Customer",selected.customer],["Phone",selected.customerPhone||"—"],["Email",selected.customerEmail||"—"],["Date",selected.date],["Cashier",selected.staff]].map(([l,v])=><div key={l} className="min-w-0 rounded-xl p-3" style={{backgroundColor:C.bg}}><div className="text-xs" style={{color:C.muted}}>{l}</div><div className="break-all text-sm font-medium">{v}</div></div>)}</div>
        <StatusBadge status={selected.status}/>
        {selected.warning&&<div className="p-3 rounded-xl text-sm" style={{backgroundColor:C.orange+"12",color:C.orange}}>{selected.warning}</div>}
        <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>{selected.items.map((item,i)=><div key={i} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between sm:gap-3"><div className="min-w-0"><div className="break-words font-medium">{item.product}</div><div className="text-xs" style={{color:C.muted}}>Qty: {item.quantity}</div></div><b className="shrink-0">₱{item.subtotal.toLocaleString()}</b></div>)}<div className="space-y-1 px-4 py-3" style={{backgroundColor:C.navy+"08"}}><div className="flex justify-between text-sm"><span>Subtotal</span><span>₱{selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span>−₱{selected.discountAmount.toLocaleString()}</span></div><div className="flex justify-between font-bold"><span>Total</span><span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span></div></div></div>
      </div>}
    </Drawer>
    <CreateOrderModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={()=>{ ordersService.getAll().then(setOrders).catch(error=>toastApiError(error, "Order saved, but the list could not refresh.")); }}/>
  </div>;
}
