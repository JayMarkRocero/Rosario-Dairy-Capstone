import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { StaffOrdersTable } from "@/features/orders/components/StaffOrdersTable";
import { MobileOrderCard } from "@/features/orders/components/MobileOrderCard";
import { filterSelectClass } from "@/styles/controlClasses";
import { ActionButton } from "@/components/buttons/ActionButton";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useMemo, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Drawer } from "@/components/overlays/Drawer";
import { ordersService } from "@/features/orders/api/orders.service";
import { CreateOrderModal } from "@/features/orders/components/CreateOrderModal";
import type { OrderListItem } from "@/features/orders/types/order";
import { C } from "@/styles/tokens/colors";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getSessionUserId } from "@/features/auth/api/auth.service";

const STATUSES = ["Fulfilled", "Cancelled"];

export function StaffOrders() {
  const { user, loading: authLoading } = useAuth();
  const userId = user ? getSessionUserId(user) : null;
  const { data: cachedOrders, loading, refresh, error } = useCachedQuery("orders:list", ordersService.getAll, ["orders"], !authLoading && userId !== null);
  const orders = useMemo(() => !authLoading && userId !== null
    ? (cachedOrders ?? []).filter(order => order.staffId === userId && !order.isHistorical)
    : [], [cachedOrders, userId, authLoading]);
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);


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

  return <div className="records-page orders-page h-auto flex flex-1 flex-col space-y-3 p-6 max-w-[1400px] mx-auto w-full">
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold text-slate-900">Orders</h1><p className="text-xs text-slate-500">Manage and track customer orders</p></div><button type="button" className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5" onClick={()=>setCreateOpen(true)}><Plus size={14}/>Create Order</button></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">{[
      ["Total", orders.length, C.blue], ["Fulfilled", orders.filter(o=>o.status==="Fulfilled").length, C.green], ["Cancelled", orders.filter(o=>o.status==="Cancelled").length, C.red],
    ].map(([label,value,color])=><SummaryCard compact key={String(label)} label={String(label)} value={value} color={String(color)} />)}</div>
    <StaffOrdersTable errorContent={error ? <QueryErrorMessage error={error} onRetry={() => void refresh({ force: true })} /> : undefined} columns={columns} data={filtered} rowKey={o=>o.id} searchable searchKeys={o=>[String(o.id),o.invoiceNumber,o.customer,o.staff]} renderMobileRow={order => <MobileOrderCard order={order} onView={view} />} searchPlaceholder="Search orders…" showExport={false} onRowClick={view} loading={loading} emptyTitle="No orders found" emptyDesc="No orders match your filters." extraControls={<select value={status} onChange={e=>setStatus(e.target.value)} className={filterSelectClass}><option value="All">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>}/>
    <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details" subtitle={selected?`#${selected.id}`:""} size="md">
      {selected&&<div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[["Order ID",`#${selected.id}`],["Customer",selected.customer],["Phone",selected.customerPhone||"—"],["Email",selected.customerEmail||"—"],["Date",selected.date],["Cashier",selected.staff]].map(([l,v])=><div key={l} className="min-w-0 rounded-xl p-3" style={{backgroundColor:C.bg}}><div className="text-xs" style={{color:C.muted}}>{l}</div><div className="break-all text-sm font-medium">{v}</div></div>)}</div>
        <StatusBadge status={selected.status}/>
        {selected.warning&&<div className="p-3 rounded-xl text-sm" style={{backgroundColor:C.orange+"12",color:C.orange}}>{selected.warning}</div>}
        <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>{selected.items.map((item,i)=><div key={i} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between sm:gap-3"><div className="min-w-0"><div className="break-words font-medium">{item.product}</div><div className="text-xs" style={{color:C.muted}}>Qty: {item.quantity}</div></div><b className="shrink-0">₱{item.subtotal.toLocaleString()}</b></div>)}<div className="space-y-1 px-4 py-3" style={{backgroundColor:C.navy+"08"}}><div className="flex justify-between text-sm"><span>Subtotal</span><span>₱{selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span>−₱{selected.discountAmount.toLocaleString()}</span></div><div className="flex justify-between font-bold"><span>Total</span><span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span></div></div></div>
      </div>}
    </Drawer>
    <CreateOrderModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={refresh}/>
  </div>;
}
