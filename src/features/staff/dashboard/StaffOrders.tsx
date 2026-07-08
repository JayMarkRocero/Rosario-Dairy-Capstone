import { useMemo, useState } from "react";
import { Plus, Eye, Check, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Card, StatusBadge, Btn, Drawer, Modal, EnhancedTable, ConfirmDialog } from "../../../components";
import type { Column } from "../../../components";
import { C } from "../../../constants/colors";
import { ordersService } from "../../../services/orders.service";
import type { Order } from "../../../types/order";

const ORDER_ITEMS = [
  { name:"Fresh Whole Milk 1L",  qty:2, price:85  },
  { name:"Greek Yogurt 200g",    qty:3, price:75  },
  { name:"Salted Butter 250g",   qty:1, price:120 },
];
const STATUSES = ["Pending","Processing","Ready","Completed","Cancelled"];

export function StaffOrders() {
  const orders = ordersService.getAll();
  const [selected,    setSelected]    = useState<Order | null>(null);
  const [viewOpen,    setViewOpen]    = useState(false);
  const [statusOpen,  setStatusOpen]  = useState(false);
  const [cancelOpen,  setCancelOpen]  = useState(false);
  const [newOpen,     setNewOpen]     = useState(false);
  const [status,      setStatus]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const openView = (o: Order) => { setSelected(o); setViewOpen(true); };

  const handleStatusUpdate = () => {
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setStatusOpen(false); toast.success("Order status updated!"); }, 600);
  };

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter(o => {
      const matchesSearch = !q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const columns: Column<Order>[] = [
    { key:"id",       header:"Order ID", width:"16%",
      render:r=><span className="font-mono text-xs" style={{color:C.muted}}>{r.id}</span> },
    { key:"customer", header:"Customer", width:"22%", sortKey:r=>r.customer,
      render:r=><span className="font-semibold text-sm" style={{color:C.text}}>{r.customer}</span> },
    { key:"status",   header:"Status", align:"center", width:"16%",
      render:r=><div className="flex justify-center"><StatusBadge status={r.status}/></div> },
    { key:"pickup",   header:"Pickup Time", align:"center", width:"18%",
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.pickup}</span> },
    { key:"total",    header:"Total", align:"center", width:"16%", sortKey:r=>r.total,
      render:r=><span className="font-bold text-sm" style={{color:C.text}}>₱{r.total.toLocaleString()}</span> },
    { key:"actions",  header:"Actions", align:"center", width:"12%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}>
            <Eye size={13}/>
          </button>
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

      {/* Single card: search + filter + count + table, all fixed, table paginates instead of scrolling */}
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
            {filteredOrders.length} record{filteredOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table with real pagination, no internal scroll */}
        <EnhancedTable
          columns={columns}
          data={filteredOrders}
          rowKey={r=>r.id}
          pageSize={6}
          searchable={false}
          showExport={false}
          showCount={false}
          onRowClick={openView}
          emptyTitle="No orders found"
          emptyDesc="No orders match your filters."
        />
      </Card>

      {/* View + Update Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Order Details"
        subtitle={selected?.id} size="md"
        footer={<>
          <Btn variant="secondary" onClick={()=>{setCancelOpen(true);}}>Cancel Order</Btn>
          <Btn variant="primary" icon={<Check size={13}/>}
            onClick={()=>{setStatus(selected?.status??"Pending");setStatusOpen(true);}}>
            Update Status
          </Btn>
        </>}>
        {selected&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:"Order ID",   v:selected.id      },
                {l:"Customer",   v:selected.customer},
                {l:"Pickup",     v:selected.pickup  },
                {l:"Staff",      v:selected.staff   },
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
              <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${C.border}`}}>
                {ORDER_ITEMS.map((item,i)=>(
                  <div key={i} className="flex items-center justify-between px-4 py-3"
                    style={{backgroundColor:i%2===0?"#fff":"#FAFBFC",borderBottom:i<ORDER_ITEMS.length-1?`1px solid ${C.border}`:undefined}}>
                    <div>
                      <div className="text-sm font-medium" style={{color:C.text}}>{item.name}</div>
                      <div className="text-xs" style={{color:C.muted}}>Qty: {item.qty}</div>
                    </div>
                    <div className="font-semibold text-sm" style={{color:C.text}}>
                      ₱{(item.price*item.qty).toLocaleString()}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 font-bold"
                  style={{backgroundColor:C.navy+"08"}}>
                  <span style={{color:C.text}}>Total</span>
                  <span style={{color:C.blue}}>₱{selected.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Status Modal */}
      <Modal open={statusOpen} onClose={()=>setStatusOpen(false)} title="Update Order Status"
        size="sm" footer={<>
          <Btn variant="secondary" onClick={()=>setStatusOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleStatusUpdate} disabled={loading}>
            {loading?"Updating…":"Update"}
          </Btn>
        </>}>
        <div className="space-y-2">
          {STATUSES.map(s=>(
            <button key={s} onClick={()=>setStatus(s)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{backgroundColor:status===s?C.blue+"15":"#F8FAFC",
                border:`1.5px solid ${status===s?C.blue:C.border}`,color:status===s?C.blue:C.text}}>
              {s}{status===s&&<Check size={14}/>}
            </button>
          ))}
        </div>
      </Modal>

      {/* New Order Modal */}
      <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="New Order" size="md"
        footer={<>
          <Btn variant="secondary" onClick={()=>setNewOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>{setNewOpen(false);toast.success("Order created!");}}>Create Order</Btn>
        </>}>
        <div className="space-y-4">
          {[["Customer Name","Walk-in / Name"],["Phone Number","09171234567"]].map(([l,p])=>(
            <div key={l}>
              <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{l}</label>
              <input className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border"
                style={{borderColor:C.border,color:C.text,backgroundColor:"#F8FAFC"}} placeholder={p}/>
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Pickup Date & Time</label>
            <input className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border" type="datetime-local"
              style={{borderColor:C.border,color:C.text,backgroundColor:"#F8FAFC"}}/>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={cancelOpen} onClose={()=>setCancelOpen(false)}
        onConfirm={()=>{setLoading(true);setTimeout(()=>{setLoading(false);setCancelOpen(false);setViewOpen(false);toast.success("Order cancelled.");},600);}}
        title="Cancel Order" confirmLabel="Cancel Order" variant="warning" loading={loading}
        description={`Cancel order ${selected?.id}? This will notify the customer.`}/>
    </div>
  );
}