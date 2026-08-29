import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { toast } from "sonner";
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
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    ordersService.getAll().then(setOrders).catch(() => toast.error("Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => orders.filter(order =>
    (status === "All" || order.status === status) &&
    (!search || String(order.id).includes(search) || order.customer.toLowerCase().includes(search.toLowerCase()))
  ), [orders, search, status]);
  const view = (order: OrderListItem) => { setSelected(order); setViewOpen(true); };

  const columns: Column<OrderListItem>[] = [
    { key:"id", header:"Order ID", render:o=><span className="font-mono text-xs" style={{color:C.muted}}>#{o.id}</span> },
    { key:"customer", header:"Customer", sortKey:o=>o.customer, render:o=><span className="font-semibold text-sm">{o.customer}</span> },
    { key:"status", header:"Status", align:"center", render:o=><StatusBadge status={o.status}/> },
    { key:"date", header:"Date", align:"center", render:o=><span className="text-xs" style={{color:C.muted}}>{o.date}</span> },
    { key:"total", header:"Total", align:"center", sortKey:o=>o.total, render:o=><span className="font-bold text-sm">₱{o.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", render:o=><button onClick={()=>view(o)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}><Eye size={13}/></button> },
  ];

  return <div className="p-6 flex flex-col min-h-full gap-4 overflow-hidden">
    <div className="flex items-center justify-between gap-3"><h3 style={{color:C.muted}}>View completed and cancelled orders</h3><Btn variant="primary" onClick={()=>setCreateOpen(true)}>+ Create Order</Btn></div>
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border w-72" style={{borderColor:C.border}}><Search size={14} style={{color:C.muted}}/><input className="bg-transparent outline-none text-sm flex-1" placeholder="Search orders…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="text-sm rounded-lg px-3 py-2 border bg-gray-50" style={{borderColor:C.border}}><option value="All">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        <span className="text-xs ml-auto" style={{color:C.muted}}>{loading?"Loading…":`${filtered.length} record${filtered.length===1?"":"s"}`}</span>
      </div>
      <EnhancedTable columns={columns} data={filtered} rowKey={o=>o.id} pageSize={6} searchable={false} showExport={false} showCount={false} onRowClick={view} emptyTitle={loading?"Loading orders…":"No orders found"} emptyDesc={loading?"Fetching data from the server.":"No orders match your filters."}/>
    </Card>
    <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details" subtitle={selected?`#${selected.id}`:""} size="md">
      {selected&&<div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">{[["Order ID",`#${selected.id}`],["Customer",selected.customer],["Phone",selected.customerPhone||"—"],["Email",selected.customerEmail||"—"],["Date",selected.date],["Cashier",selected.staff]].map(([l,v])=><div key={l} className="p-3 rounded-xl" style={{backgroundColor:C.bg}}><div className="text-xs" style={{color:C.muted}}>{l}</div><div className="font-semibold text-sm">{v}</div></div>)}</div>
        <StatusBadge status={selected.status}/>
        {selected.warning&&<div className="p-3 rounded-xl text-sm" style={{backgroundColor:C.orange+"12",color:C.orange}}>{selected.warning}</div>}
        <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>{selected.items.map((item,i)=><div key={i} className="flex justify-between px-4 py-3 text-sm"><div><div className="font-medium">{item.product}</div><div className="text-xs" style={{color:C.muted}}>Qty: {item.quantity}</div></div><b>₱{item.subtotal.toLocaleString()}</b></div>)}<div className="space-y-1 px-4 py-3" style={{backgroundColor:C.navy+"08"}}><div className="flex justify-between text-sm"><span>Subtotal</span><span>₱{selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span>−₱{selected.discountAmount.toLocaleString()}</span></div><div className="flex justify-between font-bold"><span>Total</span><span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span></div></div></div>
      </div>}
    </Drawer>
    <CreateOrderModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={()=>ordersService.getAll().then(setOrders)}/>
  </div>;
}
