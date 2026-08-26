import { useState, useMemo, useEffect } from "react";
import { Eye, XCircle, CheckCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { Drawer } from "@/components/overlays/Drawer";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { ordersService } from "@/features/orders/api/orders.service";
import type { Order } from "@/features/orders/types/order";

const STATUSES = ["Placed", "Confirmed", "Fulfilled", "Cancelled"];
const PAYMENT_METHODS = ["cash", "gcash", "card"];

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor:"#F8FAFC" };

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const loadOrders = () => {
    setOrdersLoading(true);
    ordersService.getAll()
      .then(setOrders)
      .catch(() => toast.error("Failed to load orders."))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const [statusFilter, setStatusFilter] = useState("All");
  const [viewOpen,   setViewOpen]   = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selected,   setSelected]   = useState<Order | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "All") return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  const openView = (o: Order) => { setSelected(o); setViewOpen(true); };

  const handleConfirm = (o: Order) => {
    setLoading(true);
    ordersService.confirmOrder(o.id)
      .then(() => {
        toast.success("Order confirmed.");
        loadOrders();
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const openFulfill = (o: Order) => { setSelected(o); setPaymentMethod(PAYMENT_METHODS[0]); setFulfillOpen(true); };

  const handleFulfill = () => {
    if (!selected) return;
    setLoading(true);
    ordersService.fulfillOrder(selected.id, paymentMethod)
      .then(() => {
        toast.success("Order fulfilled.");
        setFulfillOpen(false);
        loadOrders();
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleCancel = () => {
    if (!selected) return;
    setLoading(true);
    ordersService.cancelOrder(selected.id)
      .then(() => {
        toast.success("Order cancelled.");
        setCancelOpen(false);
        loadOrders();
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const SUMMARY = [
    { label:"Total",     value: orders.length,                                    color:C.blue   },
    { label:"Placed",    value: orders.filter(o=>o.status==="Placed").length,     color:C.orange },
    { label:"Confirmed", value: orders.filter(o=>o.status==="Confirmed").length,  color:C.navy   },
    { label:"Fulfilled", value: orders.filter(o=>o.status==="Fulfilled").length,  color:C.green  },
  ];

  const columns: Column<Order>[] = [
    { key:"id",       header:"Order ID", width:"12%", sortKey:r=>r.id,
      render:r=><span className="font-mono text-xs" style={{color:C.muted}}>#{r.id}</span> },
    { key:"customer", header:"Customer", width:"20%", sortKey:r=>r.customer,
      render:r=><span className="font-semibold text-sm" style={{color:C.text}}>{r.customer}</span> },
    { key:"status",   header:"Status", align:"center", width:"14%",
      render:r=><div className="flex justify-center"><StatusBadge status={r.status}/></div> },
    { key:"staff",    header:"Staff", align:"center", width:"14%", sortKey:r=>r.staff,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.staff}</span> },
    { key:"date",     header:"Date", align:"center", width:"14%", sortKey:r=>r.date,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.date}</span> },
    { key:"total",    header:"Total", align:"center", width:"14%", sortKey:r=>r.total,
      render:r=><span className="font-bold text-sm" style={{color:C.text}}>₱{r.total.toLocaleString()}</span> },
    { key:"actions",  header:"Actions", align:"center", width:"12%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}>
            <Eye size={13}/>
          </button>
          {r.status === "Placed" && (
            <button onClick={()=>handleConfirm(r)} className="p-1.5 rounded-lg hover:bg-green-50" style={{color:C.green}} title="Confirm">
              <CheckCircle size={13}/>
            </button>
          )}
          {r.status === "Confirmed" && (
            <button onClick={()=>openFulfill(r)} className="p-1.5 rounded-lg hover:bg-green-50" style={{color:C.green}} title="Fulfill">
              <PackageCheck size={13}/>
            </button>
          )}
          {(r.status === "Placed" || r.status === "Confirmed" || r.status === "Fulfilled") && (
            <button onClick={()=>{setSelected(r);setCancelOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}} title="Cancel">
              <XCircle size={13}/>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="text-base sm:text-lg font-bold leading-snug" style={{color:C.muted}}>
          Manage and track all customer orders
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        {SUMMARY.map(s => (
          <Card key={s.label} className="p-3.5 flex items-center gap-2.5">
            <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
            <div className="min-w-0">
              <div className="font-bold text-xl leading-tight" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>{s.value}</div>
              <div className="text-xs truncate" style={{color:C.muted}}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <EnhancedTable
          columns={columns}
          data={filteredOrders}
          rowKey={r=>r.id}
          pageSize={4}
          searchable
          searchKeys={r=>[String(r.id),r.customer,r.staff]}
          searchPlaceholder="Search orders…"
          onRowClick={openView}
          emptyTitle={ordersLoading ? "Loading orders…" : "No orders found"}
          emptyDesc={ordersLoading ? "Fetching data from the server." : "Orders placed by staff will appear here."}
          showExport={false}
          extraControls={
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          }
        />
      </Card>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details"
        subtitle={selected ? `#${selected.id}` : ""} size="md"
        footer={<Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>}>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {l:"Order ID",  v:`#${selected.id}` },
                {l:"Customer",  v:selected.customer  },
                {l:"Date",      v:selected.date      },
                {l:"Staff",     v:selected.staff     },
              ].map(r=>(
                <div key={r.l} className="p-3 rounded-xl min-w-0" style={{backgroundColor:C.bg}}>
                  <div className="text-xs" style={{color:C.muted}}>{r.l}</div>
                  <div className="font-semibold text-sm mt-0.5 truncate" style={{color:C.text}}>{r.v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-semibold text-sm mb-2" style={{color:C.text}}>Status</div>
              <StatusBadge status={selected.status}/>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2" style={{color:C.text}}>Items Ordered</div>
              {selected.items.length === 0 ? (
                <p className="text-sm" style={{color:C.muted}}>No items on this order yet.</p>
              ) : (
                <div className="space-y-2 rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
                  {selected.items.map((item,i)=>(
                    <div key={i} className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-2 text-sm"
                      style={{backgroundColor:i%2===0?"#fff":"#FAFBFC",borderBottom:i<selected.items.length-1?`1px solid ${C.border}`:undefined}}>
                      <span style={{color:C.text}}>{item.product}</span>
                      <span style={{color:C.muted}}>{item.quantity} pcs — ₱{item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 p-4 rounded-2xl"
              style={{backgroundColor:C.navy+"08",border:`1px solid ${C.navy}15`}}>
              <span className="font-semibold" style={{color:C.text}}>Order Total</span>
              <span className="font-bold text-xl" style={{color:C.blue,fontFamily:"Poppins,sans-serif"}}>
                ₱{selected.total.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </Drawer>

      {/* Fulfill Modal */}
      <Modal open={fulfillOpen} onClose={()=>setFulfillOpen(false)} title="Fulfill Order"
        subtitle={selected ? `#${selected.id}` : ""} size="sm"
        footer={<>
          <Btn variant="secondary" onClick={()=>setFulfillOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleFulfill} disabled={loading}>
            {loading?"Processing…":"Fulfill Order"}
          </Btn>
        </>}>
        <div className="space-y-4">
          <p className="text-sm" style={{color:C.muted}}>Select the payment method used for this order.</p>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Payment Method</label>
            <select className={inputClass} style={inputStyle} value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog open={cancelOpen} onClose={()=>setCancelOpen(false)} onConfirm={handleCancel}
        title="Cancel Order" confirmLabel="Cancel Order" variant="warning" loading={loading}
        description={selected ? `Cancel order #${selected.id}? ${selected.status === "Fulfilled" ? "This will attempt to restore stock." : ""}` : ""}/>
    </div>
  );
}
