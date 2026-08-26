import { useMemo, useState, useEffect } from "react";
import { Plus, Eye, Check, Search, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Drawer } from "@/components/overlays/Drawer";
import { Modal } from "@/components/overlays/Modal";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { C } from "@/styles/tokens/colors";
import { ordersService } from "@/features/orders/api/orders.service";
import { customersService } from "@/features/customers/api/customers.service";
import type { Order } from "@/features/orders/types/order";
import type { Customer } from "@/features/customers/types/customer";

const STATUSES = ["Placed", "Confirmed", "Fulfilled", "Cancelled"];
const PAYMENT_METHODS = ["cash", "online"];

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border";
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" };

export function StaffOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const loadOrders = () => {
    setOrdersLoading(true);
    ordersService.getAll()
      .then(setOrders)
      .catch(() => toast.error("Failed to load orders."))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    loadOrders();
    customersService.getAll()
      .then(setCustomers)
      .catch(() => toast.error("Failed to load customers."));
  }, []);

  const [selected,    setSelected]    = useState<Order | null>(null);
  const [viewOpen,    setViewOpen]    = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [cancelOpen,  setCancelOpen]  = useState(false);
  const [newOpen,     setNewOpen]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);

  const openView = (o: Order) => { setSelected(o); setViewOpen(true); };

  const handleConfirm = (o: Order) => {
    setLoading(true);
    ordersService.confirmOrder(o.id)
      .then(() => { toast.success("Order confirmed."); loadOrders(); })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const openFulfill = (o: Order) => { setSelected(o); setPaymentMethod(PAYMENT_METHODS[0]); setFulfillOpen(true); };

  const handleFulfill = () => {
    if (!selected) return;
    setLoading(true);
    ordersService.fulfillOrder(selected.id, paymentMethod)
      .then(() => { toast.success("Order fulfilled."); setFulfillOpen(false); setViewOpen(false); loadOrders(); })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleCancel = () => {
    if (!selected) return;
    setLoading(true);
    ordersService.cancelOrder(selected.id)
      .then(() => { toast.success("Order cancelled."); setCancelOpen(false); setViewOpen(false); loadOrders(); })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleCreateOrder = () => {
    if (!newCustomerId) { toast.error("Please select a customer."); return; }
    setLoading(true);
    ordersService.createOrder(Number(newCustomerId))
      .then(() => {
        toast.success("Order created.");
        setNewOpen(false);
        setNewCustomerId("");
        loadOrders();
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter(o => {
      const matchesSearch = !q || String(o.id).includes(q) || o.customer.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  // Staff can only cancel a fulfilled order via admin — hide that option for them here.
  const canCancel = (o: Order) => o.status !== "Cancelled" && o.status !== "Fulfilled";

  const columns: Column<Order>[] = [
    { key:"id",       header:"Order ID", width:"14%",
      render:r=><span className="font-mono text-xs" style={{color:C.muted}}>#{r.id}</span> },
    { key:"customer", header:"Customer", width:"22%", sortKey:r=>r.customer,
      render:r=><span className="font-semibold text-sm" style={{color:C.text}}>{r.customer}</span> },
    { key:"status",   header:"Status", align:"center", width:"16%",
      render:r=><div className="flex justify-center"><StatusBadge status={r.status}/></div> },
    { key:"date",     header:"Date", align:"center", width:"16%",
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.date}</span> },
    { key:"total",    header:"Total", align:"center", width:"16%", sortKey:r=>r.total,
      render:r=><span className="font-bold text-sm" style={{color:C.text}}>₱{r.total.toLocaleString()}</span> },
    { key:"actions",  header:"Actions", align:"center", width:"16%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}>
            <Eye size={13}/>
          </button>
          {r.status === "Placed" && (
            <button onClick={()=>handleConfirm(r)} className="p-1.5 rounded-lg hover:bg-green-50" style={{color:C.green}} title="Confirm">
              <Check size={13}/>
            </button>
          )}
          {r.status === "Confirmed" && (
            <button onClick={()=>openFulfill(r)} className="p-1.5 rounded-lg hover:bg-green-50" style={{color:C.green}} title="Fulfill">
              <PackageCheck size={13}/>
            </button>
          )}
          {canCancel(r) && (
            <button onClick={()=>{setSelected(r);setCancelOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}} title="Cancel">
              <XCircle size={13}/>
            </button>
          )}
        </div>
      )},
  ];

  return (
    <div className="p-6 flex flex-col min-h-full gap-4 overflow-hidden">
      {/* Header - fixed */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h3 style={{color:C.muted}}>View and update today's orders</h3>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>setNewOpen(true)}>New Order</Btn>
      </div>

      <Card className="p-5">
        {/* Search + Filter + Count */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border w-72"
            style={{ borderColor: C.border }}
          >
            <Search size={14} style={{ color: C.muted }} />
            <input
              className="bg-transparent outline-none text-sm flex-1"
              placeholder="Search orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ color: C.text }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border bg-gray-50 outline-none"
            style={{ borderColor: C.border, color: C.text }}
          >
            <option value="All">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <span className="text-xs ml-auto" style={{ color: C.muted }}>
            {ordersLoading ? "Loading…" : `${filteredOrders.length} record${filteredOrders.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <EnhancedTable
          columns={columns}
          data={filteredOrders}
          rowKey={r=>r.id}
          pageSize={6}
          searchable={false}
          showExport={false}
          showCount={false}
          onRowClick={openView}
          emptyTitle={ordersLoading ? "Loading orders…" : "No orders found"}
          emptyDesc={ordersLoading ? "Fetching data from the server." : "No orders match your filters."}
        />
      </Card>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details"
        subtitle={selected ? `#${selected.id}` : ""} size="md"
        footer={selected && (
          <>
            {canCancel(selected) && (
              <Btn variant="secondary" onClick={()=>setCancelOpen(true)}>Cancel Order</Btn>
            )}
            {selected.status === "Placed" && (
              <Btn variant="primary" icon={<Check size={13}/>} onClick={()=>handleConfirm(selected)}>
                Confirm Order
              </Btn>
            )}
            {selected.status === "Confirmed" && (
              <Btn variant="primary" icon={<PackageCheck size={13}/>} onClick={()=>openFulfill(selected)}>
                Fulfill Order
              </Btn>
            )}
          </>
        )}>
        {selected&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:"Order ID",   v:`#${selected.id}` },
                {l:"Customer",   v:selected.customer  },
                {l:"Date",       v:selected.date      },
                {l:"Staff",      v:selected.staff     },
              ].map(r=>(
                <div key={r.l} className="p-3 rounded-xl" style={{backgroundColor:C.bg}}>
                  <div className="text-xs" style={{color:C.muted}}>{r.l}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{color:C.text}}>{r.v}</div>
                </div>
              ))}
            </div>
            <div><div className="font-semibold text-sm mb-2" style={{color:C.text}}>Status</div>
              <StatusBadge status={selected.status}/></div>
            <div>
              <div className="font-semibold text-sm mb-3" style={{color:C.text}}>Items</div>
              {selected.items.length === 0 ? (
                <p className="text-sm" style={{color:C.muted}}>No items on this order yet.</p>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
                  {selected.items.map((item,i)=>(
                    <div key={i} className="flex items-center justify-between px-4 py-3"
                      style={{backgroundColor:i%2===0?"#fff":"#FAFBFC",borderBottom:i<selected.items.length-1?`1px solid ${C.border}`:undefined}}>
                      <div>
                        <div className="text-sm font-medium" style={{color:C.text}}>{item.product}</div>
                        <div className="text-xs" style={{color:C.muted}}>Qty: {item.quantity}</div>
                      </div>
                      <div className="font-semibold text-sm" style={{color:C.text}}>
                        ₱{item.subtotal.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 font-bold"
                    style={{backgroundColor:C.navy+"08"}}>
                    <span style={{color:C.text}}>Total</span>
                    <span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span>
                  </div>
                </div>
              )}
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

      {/* New Order Modal */}
      <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="New Order" size="sm"
        footer={<>
          <Btn variant="secondary" onClick={()=>setNewOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreateOrder} disabled={loading}>
            {loading?"Creating…":"Create Order"}
          </Btn>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Customer</label>
            <select className={inputClass} style={inputStyle} value={newCustomerId}
              onChange={e => setNewCustomerId(e.target.value)}>
              <option value="">Select a customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <p className="text-xs px-3 py-2.5 rounded-xl" style={{backgroundColor:C.orange+"10",color:C.orange}}>
            Note: adding products to an order isn't supported yet — this creates an empty order for the selected customer.
          </p>
        </div>
      </Modal>

      <ConfirmDialog open={cancelOpen} onClose={()=>setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Order" confirmLabel="Cancel Order" variant="warning" loading={loading}
        description={selected ? `Cancel order #${selected.id}? This will notify the customer.` : ""}/>
    </div>
  );
}
