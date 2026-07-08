import { useState, useMemo } from "react";
import { Plus, Eye, Edit, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, StatusBadge, Btn, Modal, Drawer, ConfirmDialog, EnhancedTable } from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { ordersService } from "../../services/orders.service";
import type { Order } from "../../types/order";

const ORDER_ITEMS = ["Fresh Whole Milk 1L — 2 pcs — ₱170","Greek Yogurt 200g — 3 pcs — ₱225","Salted Butter 250g — 1 pc — ₱120"];
const STATUSES = ["Pending","Processing","Ready","Completed","Cancelled"];

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor:"#F8FAFC" };

export function AdminOrders() {
  const orders = ordersService.getAll();
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewOpen,   setViewOpen]   = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [newOpen,    setNewOpen]    = useState(false);
  const [selected,   setSelected]   = useState<Order | null>(null);
  const [status,     setStatus]     = useState("");
  const [loading,    setLoading]    = useState(false);

  // ── Filtered data (status filter applied before the table's own search/sort/paginate) ──
  const filteredOrders = useMemo(() => {
    if (statusFilter === "All") return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  const openView = (o: Order) => { setSelected(o); setViewOpen(true); };
  const openEdit = (o: Order) => { setSelected(o); setStatus(o.status); setEditOpen(true); };

  const handleStatusUpdate = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setEditOpen(false); toast.success("Order status updated!"); }, 700);
  };

  const handleCancel = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setCancelOpen(false); toast.success("Order cancelled."); }, 600);
  };

  const SUMMARY = [
    { label:"Total",        value: orders.length,                                  color:C.blue   },
    { label:"Pending",      value: orders.filter(o=>o.status==="Pending").length,  color:C.orange },
    { label:"Processing",   value: orders.filter(o=>o.status==="Processing").length,color:C.navy  },
    { label:"Completed",    value: orders.filter(o=>o.status==="Completed").length, color:C.green },
  ];

  const columns: Column<Order>[] = [
    { key:"id",       header:"Order ID", width:"14%", sortKey:r=>r.id,
      render:r=><span className="font-mono text-xs" style={{color:C.muted}}>{r.id}</span> },
    { key:"customer", header:"Customer", width:"20%", sortKey:r=>r.customer,
      render:r=><span className="font-semibold text-sm" style={{color:C.text}}>{r.customer}</span> },
    { key:"status",   header:"Status", align:"center", width:"14%",
      render:r=><div className="flex justify-center"><StatusBadge status={r.status}/></div> },
    { key:"staff",    header:"Staff", align:"center", width:"14%", sortKey:r=>r.staff,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.staff}</span> },
    { key:"pickup",   header:"Pickup", align:"center", width:"14%",
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.pickup}</span> },
    { key:"total",    header:"Total", align:"center", width:"14%", sortKey:r=>r.total,
      render:r=><span className="font-bold text-sm" style={{color:C.text}}>₱{r.total.toLocaleString()}</span> },
    { key:"actions",  header:"Actions", align:"center", width:"10%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}>
            <Eye size={13}/>
          </button>
          <button onClick={()=>openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:C.muted}}>
            <Edit size={13}/>
          </button>
          <button onClick={()=>{setSelected(r);setCancelOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}}>
            <XCircle size={13}/>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full gap-4 p-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Manage and track all customer orders</h2>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>setNewOpen(true)}>New Order</Btn>
      </div>

      <div className="grid grid-cols-4 gap-4 flex-shrink-0">
        {SUMMARY.map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
            <div>
              <div className="font-bold text-2xl" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>{s.value}</div>
              <div className="text-xs" style={{color:C.muted}}>{s.label}</div>
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
          searchKeys={r=>[r.id,r.customer,r.staff]}
          searchPlaceholder="Search orders…"
          onRowClick={openView}
          emptyTitle="No orders found"
          emptyDesc="Create your first order to get started."
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
        subtitle={selected?.id} size="md"
        footer={<>
          <Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          <Btn variant="primary" icon={<CheckCircle size={13}/>}
            onClick={()=>{setViewOpen(false);selected&&openEdit(selected);}}>Update Status</Btn>
        </>}>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:"Order ID",  v:selected.id         },
                {l:"Customer",  v:selected.customer   },
                {l:"Pickup",    v:selected.pickup      },
                {l:"Staff",     v:selected.staff       },
              ].map(r=>(
                <div key={r.l} className="p-3 rounded-xl" style={{backgroundColor:C.bg}}>
                  <div className="text-xs" style={{color:C.muted}}>{r.l}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{color:C.text}}>{r.v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-semibold text-sm mb-2" style={{color:C.text}}>Status</div>
              <StatusBadge status={selected.status}/>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2" style={{color:C.text}}>Items Ordered</div>
              <div className="space-y-2 rounded-xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
                {ORDER_ITEMS.map((item,i)=>(
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm"
                    style={{backgroundColor:i%2===0?"#fff":"#FAFBFC",borderBottom:i<ORDER_ITEMS.length-1?`1px solid ${C.border}`:undefined}}>
                    <span style={{color:C.text}}>{item.split(" — ")[0]}</span>
                    <span style={{color:C.muted}}>{item.split(" — ").slice(1).join(" — ")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center p-4 rounded-2xl"
              style={{backgroundColor:C.navy+"08",border:`1px solid ${C.navy}15`}}>
              <span className="font-semibold" style={{color:C.text}}>Order Total</span>
              <span className="font-bold text-xl" style={{color:C.blue,fontFamily:"Poppins,sans-serif"}}>
                ₱{selected.total.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </Drawer>

      {/* Update Status Modal */}
      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Update Order Status"
        subtitle={selected?.id} size="sm"
        footer={<>
          <Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleStatusUpdate} disabled={loading}>
            {loading?"Updating…":"Update Status"}
          </Btn>
        </>}>
        <div className="space-y-3">
          {STATUSES.map(s=>(
            <button key={s} onClick={()=>setStatus(s)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium"
              style={{
                backgroundColor:status===s?C.blue+"15":"#F8FAFC",
                border:`1.5px solid ${status===s?C.blue:C.border}`,
                color:status===s?C.blue:C.text,
              }}>
              {s}
              {status===s&&<CheckCircle size={14}/>}
            </button>
          ))}
        </div>
      </Modal>

      {/* New Order Modal */}
      <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="New Order"
        subtitle="Create a manual order entry" size="md"
        footer={<>
          <Btn variant="secondary" onClick={()=>setNewOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>{setNewOpen(false);toast.success("Order created successfully!");}}>
            Create Order
          </Btn>
        </>}>
        <div className="space-y-4">
          {[{l:"Customer Name",p:"Maria Santos"},{l:"Phone Number",p:"09171234567"}].map(f=>(
            <div key={f.l}>
              <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{f.l}</label>
              <input className={inputClass} style={inputStyle} placeholder={f.p}/>
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Order Type</label>
            <select className={inputClass} style={inputStyle}>
              <option>Walk-in</option><option>Pickup</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Pickup Date & Time</label>
            <input className={inputClass} style={inputStyle} type="datetime-local"/>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Assigned Staff</label>
            <select className={inputClass} style={inputStyle}>
              <option>Juan dela Cruz</option><option>Ana Garcia</option><option>Miguel Torres</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog open={cancelOpen} onClose={()=>setCancelOpen(false)} onConfirm={handleCancel}
        title="Cancel Order" confirmLabel="Cancel Order" variant="warning" loading={loading}
        description={`Cancel order ${selected?.id}? The customer will need to be notified.`}/>
    </div>
  );
}