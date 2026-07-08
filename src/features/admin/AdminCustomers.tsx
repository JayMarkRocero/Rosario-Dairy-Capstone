import { useState, useMemo } from "react";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Btn, Modal, Drawer, ConfirmDialog, EnhancedTable, StatusBadge } from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { customersService } from "../../services/customers.service";
import type { Customer } from "../../types/customer";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:C.border, color:C.text, backgroundColor:"#F8FAFC" };
interface FormState { name:string; phone:string; email:string }
const EMPTY:FormState = { name:"", phone:"", email:"" };

const SEGMENTS = ["All", "First-time", "Repeat"];

function Avatar({ name, size=8 }: { name:string; size?:number }) {
  const initials = name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
      style={{backgroundColor:C.blue, width:`${size*4}px`, height:`${size*4}px`, fontSize:size<10?"10px":"12px"}}>
      {initials}
    </div>
  );
}

export function AdminCustomers() {
  const list = customersService.getAll();
  const [segFilter,  setSegFilter]  = useState("All");
  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected,   setSelected]   = useState<Customer | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [loading,    setLoading]    = useState(false);

  // ── Filtered data (segment filter applied before the table's own search/sort/paginate) ──
  const filteredList = useMemo(() => {
    if (segFilter === "First-time") return list.filter(c => c.orders === 1);
    if (segFilter === "Repeat")     return list.filter(c => c.orders >= 2);
    return list;
  }, [list, segFilter]);

  const openView = (c:Customer) => { setSelected(c); setViewOpen(true); };
  const openEdit = (c:Customer) => { setSelected(c); setForm({name:c.name,phone:c.phone,email:c.email}); setEditOpen(true); };

  const save = (mode:"add"|"edit") => {
    if (!form.name||!form.phone) { toast.error("Name and phone are required."); return; }
    setLoading(true);
    setTimeout(()=>{ setLoading(false); mode==="add"?setAddOpen(false):setEditOpen(false);
      setForm(EMPTY); toast.success(mode==="add"?"Customer added!":"Customer updated!"); }, 700);
  };

  const handleDelete = () => {
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setDeleteOpen(false); toast.success(`${selected?.name} removed.`); }, 600);
  };

  const CustomerForm = () => (
    <div className="space-y-4">
      {([["Full Name","name","Maria Santos"],["Phone Number","phone","09171234567"],["Email Address","email","customer@email.com"]] as [string,keyof FormState,string][]).map(([l,k,p])=>(
        <div key={k}>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{l}</label>
          <input className={inputClass} style={inputStyle} value={form[k]} placeholder={p}
            onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
        </div>
      ))}
    </div>
  );

  const columns: Column<Customer>[] = [
    { key:"name", header:"Customer", width:"28%", sortKey:r=>r.name,
      render:r=>(
        <div className="flex items-center gap-2.5">
          <Avatar name={r.name} size={9}/>
          <div>
            <div className="font-semibold text-sm" style={{color:C.text}}>{r.name}</div>
            <div className="text-xs" style={{color:C.muted}}>{r.email}</div>
          </div>
        </div>
      )},
    { key:"phone", header:"Phone", align:"center", width:"16%",
      render:r=><span className="text-sm" style={{color:C.muted}}>{r.phone}</span> },
    { key:"orders", header:"Orders", align:"center", width:"12%", sortKey:r=>r.orders,
      render:r=><span className="font-semibold text-sm" style={{color:C.text}}>{r.orders}</span> },
    { key:"total", header:"Lifetime Value", align:"center", width:"16%", sortKey:r=>r.total,
      render:r=><span className="font-bold text-sm" style={{color:C.green}}>₱{r.total.toLocaleString()}</span> },
    { key:"last", header:"Last Order", align:"center", width:"14%", sortKey:r=>r.last,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.last}</span> },
    { key:"actions", header:"Actions", align:"center", width:"14%",
      render:r=>(
        <div className="flex gap-1 justify-center" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openView(r)} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:C.blue}}><Eye size={13}/></button>
          <button onClick={()=>openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:C.muted}}><Edit size={13}/></button>
          <button onClick={()=>{setSelected(r);setDeleteOpen(true);}} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}}><Trash2 size={13}/></button>
        </div>
      )},
  ];

  return (
    <div className="flex flex-col h-full gap-4 p-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Manage customer accounts and purchase history</h2>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
          Add Customer
        </Btn>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        {[
          {l:"Total Customers", v:list.length,                                              color:C.blue  },
          {l:"Total Revenue",   v:`₱${list.reduce((a,c)=>a+c.total,0).toLocaleString()}`, color:C.green },
          {l:"Avg. Order Value",v:`₱${Math.round(list.reduce((a,c)=>a+c.total,0)/list.reduce((a,c)=>a+c.orders,0)).toLocaleString()}`, color:C.navy },
        ].map(s=>(
          <Card key={s.l} className="p-4 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full" style={{backgroundColor:s.color}}/>
            <div>
              <div className="font-bold text-lg" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>{s.v}</div>
              <div className="text-xs" style={{color:C.muted}}>{s.l}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <EnhancedTable
          columns={columns}
          data={filteredList}
          rowKey={r=>r.id}
          pageSize={4}
          searchable
          searchKeys={r=>[r.name,r.email,r.phone]}
          searchPlaceholder="Search customers…"
          onRowClick={openView}
          emptyTitle="No customers yet"
          emptyDesc="Add your first customer to get started."
          showExport={false}
          extraControls={
            <select
              value={segFilter}
              onChange={e => setSegFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
            >
              {SEGMENTS.map(s => <option key={s} value={s}>{s === "All" ? "All Customers" : s}</option>)}
            </select>
          }
        />
      </Card>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Customer" size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("add")} disabled={loading}>{loading?"Saving…":"Add Customer"}</Btn></>}>
        <CustomerForm/>
      </Modal>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Customer" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("edit")} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <CustomerForm/>
      </Modal>

      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Customer Profile"
        subtitle={selected?.name} size="md"
        footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          <Btn variant="primary" onClick={()=>{setViewOpen(false);selected&&openEdit(selected);}}>Edit</Btn></>}>
        {selected&&(
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{backgroundColor:C.bg}}>
              <Avatar name={selected.name} size={16}/>
              <div>
                <h3 className="font-bold text-lg" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
                <p className="text-sm" style={{color:C.muted}}>{selected.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                {l:"Total Orders",    v:selected.orders,                          color:C.blue  },
                {l:"Total Spent",     v:`₱${selected.total.toLocaleString()}`,    color:C.green },
                {l:"Last Order",      v:selected.last,                            color:C.navy  },
              ].map(s=>(
                <div key={s.l} className="p-3 rounded-xl text-center" style={{backgroundColor:s.color+"10"}}>
                  <div className="font-bold" style={{color:s.color}}>{s.v}</div>
                  <div className="text-xs mt-0.5" style={{color:C.muted}}>{s.l}</div>
                </div>
              ))}
            </div>
            {[{l:"Phone",v:selected.phone},{l:"Email",v:selected.email}].map(r=>(
              <div key={r.l} className="flex justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
                <span className="text-sm" style={{color:C.muted}}>{r.l}</span>
                <span className="text-sm font-semibold" style={{color:C.text}}>{r.v}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} onConfirm={handleDelete}
        title="Delete Customer" confirmLabel="Delete" variant="danger" loading={loading}
        description={`Remove "${selected?.name}" and all their purchase history? This cannot be undone.`}/>
    </div>
  );
}