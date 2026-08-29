import { useEffect, useMemo, useState } from "react";
import { Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { Card } from "@/components/data-display/Card";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Drawer } from "@/components/overlays/Drawer";
import { ordersService } from "@/features/orders/api/orders.service";
import { CreateOrderModal } from "@/features/orders/components/CreateOrderModal";
import type { OrderListItem } from "@/features/orders/types/order";
import { C } from "@/styles/tokens/colors";

const STATUSES = ["Fulfilled", "Cancelled"];

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setLoadingList(true);
    ordersService.getAll().then(setOrders).catch(() => toast.error("Failed to load orders."))
      .finally(() => setLoadingList(false));
  };
  useEffect(load, []);

  const data = useMemo(() => status === "All" ? orders : orders.filter(order => order.status === status), [orders, status]);
  const view = (order: OrderListItem) => { setSelected(order); setViewOpen(true); };
  const openCancel = (order: OrderListItem) => { setSelected(order); setCancelOpen(true); };
  const cancel = () => {
    if (!selected || selected.status !== "Fulfilled") return;
    setLoading(true);
    ordersService.cancelOrder(selected.id).then(order => {
      if (order.warning) toast.warning(order.warning); else toast.success("Order cancelled.");
      setCancelOpen(false); setViewOpen(false); load();
    }).catch((error: Error) => toast.error(error.message)).finally(() => setLoading(false));
  };

  const columns: Column<OrderListItem>[] = [
    { key:"id", header:"Order ID", render:o=><span className="font-mono text-xs" style={{color:C.muted}}>#{o.id}</span> },
    { key:"customer", header:"Customer", sortKey:o=>o.customer, render:o=><span className="font-semibold text-sm">{o.customer}</span> },
    { key:"status", header:"Status", align:"center", render:o=><StatusBadge status={o.status}/> },
    { key:"staff", header:"Staff", align:"center", render:o=><span className="text-xs" style={{color:C.muted}}>{o.staff}</span> },
    { key:"date", header:"Date", align:"center", render:o=><span className="text-xs" style={{color:C.muted}}>{o.date}</span> },
    { key:"total", header:"Total", align:"center", sortKey:o=>o.total, render:o=><span className="font-bold text-sm">₱{o.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", render:o=><div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
      <button onClick={()=>view(o)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}><Eye size={13}/></button>
      {o.status === "Fulfilled" && <button onClick={()=>openCancel(o)} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}} title="Cancel Order"><XCircle size={13}/></button>}
    </div> },
  ];

  return <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
    <div className="flex items-center justify-between gap-3"><h2 className="text-base sm:text-lg font-bold" style={{color:C.muted}}>Manage and track all customer orders</h2><Btn variant="primary" onClick={()=>setCreateOpen(true)}>+ Create Order</Btn></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
      ["Total", orders.length, C.blue], ["Fulfilled", orders.filter(o=>o.status==="Fulfilled").length, C.green],
      ["Cancelled", orders.filter(o=>o.status==="Cancelled").length, C.red], ["Warnings", orders.filter(o=>o.warning).length, C.orange],
    ].map(([label,value,color])=><Card key={String(label)} className="p-3.5"><div className="font-bold text-xl" style={{color:String(color)}}>{value}</div><div className="text-xs" style={{color:C.muted}}>{label}</div></Card>)}</div>
    <Card className="p-5"><EnhancedTable columns={columns} data={data} rowKey={o=>o.id} pageSize={4} searchable
      searchKeys={o=>[String(o.id),o.customer,o.staff]} onRowClick={view} showExport={false}
      emptyTitle={loadingList?"Loading orders…":"No orders found"} emptyDesc={loadingList?"Fetching data from the server.":"No orders match your filters."}
      extraControls={<select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 rounded-xl text-sm border" style={{borderColor:C.border}}><option value="All">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>}/></Card>
    <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details" subtitle={selected?`#${selected.id}`:""} size="md"
      footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>{selected?.status==="Fulfilled"&&<Btn variant="secondary" onClick={()=>setCancelOpen(true)}>Cancel Order</Btn>}</>}>
      {selected&&<div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">{[["Order ID",`#${selected.id}`],["Customer",selected.customer],["Phone",selected.customerPhone||"—"],["Email",selected.customerEmail||"—"],["Date",selected.date],["Cashier",selected.staff]].map(([l,v])=><div key={l} className="p-3 rounded-xl" style={{backgroundColor:C.bg}}><div className="text-xs" style={{color:C.muted}}>{l}</div><div className="font-semibold text-sm">{v}</div></div>)}</div>
        <StatusBadge status={selected.status}/>
        {selected.warning&&<div className="p-3 rounded-xl text-sm" style={{backgroundColor:C.orange+"12",color:C.orange}}>{selected.warning}</div>}
        <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>{selected.items.map((item,i)=><div key={i} className="flex justify-between px-3 py-2 text-sm"><span>{item.product}</span><span style={{color:C.muted}}>{item.quantity} pcs — ₱{item.subtotal.toLocaleString()}</span></div>)}</div>
        <div className="space-y-1 p-4 rounded-2xl text-sm" style={{backgroundColor:C.navy+"08"}}><div className="flex justify-between"><span>Subtotal</span><span>₱{selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between"><span>Discount</span><span>−₱{selected.discountAmount.toLocaleString()}</span></div><div className="flex justify-between font-bold text-base"><span>Total</span><span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span></div><div className="text-xs" style={{color:C.muted}}>Payment: {selected.paymentMethod}</div></div>
      </div>}
    </Drawer>
    <ConfirmDialog open={cancelOpen} onClose={()=>setCancelOpen(false)} onConfirm={cancel} title="Cancel Order" confirmLabel="Cancel Order" variant="warning" loading={loading} description={selected?`Cancel fulfilled order #${selected.id}? This will attempt to restore stock.`:""}/>
    <CreateOrderModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={load}/>
  </div>;
}
