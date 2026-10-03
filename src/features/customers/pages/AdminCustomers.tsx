import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { filterSelectClass } from "@/styles/controlClasses";
import { ActionButton } from "@/components/buttons/ActionButton";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useState, useMemo, useEffect } from "react";
import { Plus, Eye, Edit, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { Drawer } from "@/components/overlays/Drawer";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { customersService } from "@/features/customers/api/customers.service";
import type { Customer } from "@/features/customers/types/customer";
import { isValidPhoneNumber, PHONE_FORMAT_HINT } from "@/lib/validators";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor:"var(--border)", color:"var(--foreground)", backgroundColor:"var(--input-background)" };
interface FormState { name:string; phone:string; email:string; address:string }
const EMPTY:FormState = { name:"", phone:"", email:"", address:"" };

const SEGMENTS = ["All", "First-time", "Repeat", "Inactive"];

function Avatar({ name, size=8 }: { name:string; size?:number }) {
  const initials = name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
      style={{backgroundColor:C.action, width:`${size*4}px`, height:`${size*4}px`, fontSize:size<10?"10px":"12px"}}>
      {initials}
    </div>
  );
}

function CustomerForm({ form, onChange }: { form: FormState; onChange: (f: FormState) => void }) {
  return (
    <div className="space-y-4">
      {([["Full Name","name","Maria Santos"],["Phone Number","phone","09171234567"],["Email Address","email","customer@email.com"]] as [string,keyof FormState,string][]).map(([l,k,p])=>(
        <div key={k}>
          <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>{l}</label>
          <input className={inputClass} style={inputStyle} value={form[k]} placeholder={p}
            maxLength={k === "phone" ? 11 : undefined}
            onChange={e=>{
              const val = k === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value;
              onChange({...form,[k]:val});
            }}/>
        </div>
      ))}
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Address</label>
        <textarea className={inputClass} style={inputStyle} value={form.address} rows={3}
          onChange={e=>onChange({...form,address:e.target.value})}/>
      </div>
    </div>
  );
}

export function AdminCustomers() {
  const pageCapacity = useAdminAutoPageSize(56);
  const [list, setList] = useState<Customer[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const loadCustomers = () => {
    setListLoading(true);
    customersService.getAll(true)
      .then(setList)
      .catch(error => toastApiError(error, "Failed to load customers."))
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const [segFilter,  setSegFilter]  = useState("All");
  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected,   setSelected]   = useState<Customer | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [loading,    setLoading]    = useState(false);

  const filteredList = useMemo(() => {
    if (segFilter === "Inactive") return list.filter(c => !c.isActive);
    const active = list.filter(c => c.isActive);
    if (segFilter === "First-time") return active.filter(c => c.orders === 1);
    if (segFilter === "Repeat") return active.filter(c => c.orders >= 2);
    return active;
  }, [list, segFilter]);

  const openView = (c:Customer) => { setSelected(c); setViewOpen(true); };
  const openEdit = (c:Customer) => { setSelected(c); setForm({name:c.name,phone:c.phone,email:c.email,address:c.address}); setEditOpen(true); };

  const save = (mode:"add"|"edit") => {
    if (!form.name.trim() || (mode === "add" && !form.phone)) { toast.error(mode === "add" ? "Name and phone are required." : "Name is required."); return; }
    if (form.phone && !isValidPhoneNumber(form.phone)) { toast.error(PHONE_FORMAT_HINT); return; }
    setLoading(true);

    if (mode === "add") {
      customersService.createCustomer(form)
        .then(() => {
          toast.success("Customer added!");
          setAddOpen(false);
          setForm(EMPTY);
          loadCustomers();
        })
        .catch((err: Error) => toastApiError(err))
        .finally(() => setLoading(false));
    } else {
      if (!selected) { setLoading(false); return; }
      customersService.updateCustomer(selected.id, form)
        .then(() => {
          toast.success("Customer updated!");
          setEditOpen(false);
          setForm(EMPTY);
          loadCustomers();
        })
        .catch((err: Error) => toastApiError(err))
        .finally(() => setLoading(false));
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    setLoading(true);
    customersService.deleteCustomer(selected.id)
      .then(deletionType => {
        toast.success(deletionType === "permanent"
          ? `${selected.name} permanently deleted.`
          : `${selected.name} deactivated; purchase history was preserved.`);
        setDeleteOpen(false);
        loadCustomers();
      })
      .catch((err: Error) => toastApiError(err, "Failed to delete customer."))
      .finally(() => setLoading(false));
  };

  const handleReactivate = (customer: Customer) => {
    if (loading) return;
    setLoading(true);
    customersService.reactivateCustomer(customer.id)
      .then(() => {
        toast.success(`${customer.name} reactivated.`);
        loadCustomers();
      })
      .catch((err: Error) => toastApiError(err, "Failed to reactivate customer."))
      .finally(() => setLoading(false));
  };

  const columns: Column<Customer>[] = [
    { key:"name", header:"Customer", align:"left", width:"22%", sortKey:r=>r.name,
      render:r=>(
        <span className="block max-w-full min-w-0 truncate font-medium text-sm" style={{color:C.text}}>{r.name}</span>
      )},
    { key:"email", header:"Email", align:"left", width:"22%", sortKey:r=>r.email,
      render:r=><span className="block max-w-full min-w-0 truncate text-sm" style={{color:C.muted}}>{r.email || "Not recorded"}</span> },
    { key:"phone", header:"Phone", align:"center", width:"16%", sortKey:r=>r.phone,
      render:r=><span className="text-sm" style={{color:C.muted}}>{r.phone || "Not recorded"}</span> },
    { key:"orders", header:"Transactions", align:"center", width:"13%", sortKey:r=>r.orders,
      render:r=><span className="font-medium text-sm" style={{color:C.text}}>{r.orders}</span> },
    { key:"last", header:"Last Sale", align:"center", width:"12%", sortKey:r=>r.last,
      render:r=><span className="text-xs" style={{color:C.muted}}>{r.last}</span> },
    { key:"actions", header:"Actions", align:"center", width:"15%",
      render:r=>(
        <div className="flex items-center justify-center gap-1" onClick={e=>e.stopPropagation()}>
          <ActionButton label="View details" onClick={()=>openView(r)}><Eye size={13}/></ActionButton>
          {r.isActive ? <>
            <ActionButton label="Edit" onClick={()=>openEdit(r)}><Edit size={13}/></ActionButton>
            <ActionButton label="Delete" destructive onClick={()=>{setSelected(r);setDeleteOpen(true);}}><Trash2 size={13}/></ActionButton>
          </> : <ActionButton label="Reactivate customer" onClick={()=>handleReactivate(r)} disabled={loading}><RotateCcw size={13}/></ActionButton>}
        </div>
      )},
  ];

  return (
    <div className="records-page flex flex-1 flex-col h-full min-h-0 overflow-hidden gap-3 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="hidden text-lg font-bold sm:block" style={{color:C.text}}>Customers</h2>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} fullWidth onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
          Add Customer
        </Btn>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        {[
          {label:"Customers", value:list.filter(c=>c.isActive).length, color:C.blue},
          {label:"Repeat", value:list.filter(c=>c.isActive && c.orders >= 2).length, color:C.green},
          {label:"First-time", value:list.filter(c=>c.isActive && c.orders === 1).length, color:C.navy},
        ].map(stat=>(
          <SummaryCard compact key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      <Card className="records-card p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <EnhancedTable
          mobileTable
          rowHeight={56}
          columns={columns}
          data={filteredList}
          rowKey={r=>r.id}
          pageCapacity={pageCapacity}
          searchable
          searchKeys={r=>[r.name,r.email,r.phone]}
          searchPlaceholder="Search customers…"
          onRowClick={openView}
          loading={listLoading}
          emptyTitle="No customers yet"
          emptyDesc="Add your first customer to get started."
          showExport={false}
          extraControls={
            <select
              value={segFilter}
              onChange={e => setSegFilter(e.target.value)}
              className={filterSelectClass}
            >
              {SEGMENTS.map(s => <option key={s} value={s}>{s === "All" ? "Active Customers" : s}</option>)}
            </select>
          }
        />
      </Card>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Customer" size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("add")} disabled={loading}>{loading?"Saving…":"Add Customer"}</Btn></>}>
        <CustomerForm form={form} onChange={setForm}/>
      </Modal>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Customer" subtitle={selected?.name} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("edit")} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <CustomerForm form={form} onChange={setForm}/>
      </Modal>

      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Customer Profile"
        subtitle={selected?.name} size="md"
        footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          {selected?.isActive && <Btn variant="primary" onClick={()=>{setViewOpen(false);selected&&openEdit(selected);}}>Edit</Btn>}</>}>
        {selected&&(
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{backgroundColor:C.bg}}>
              <Avatar name={selected.name} size={16}/>
              <div className="min-w-0">
                <h3 className="break-words text-lg font-bold" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
                <p className="break-all text-sm" style={{color:C.muted}}>{selected.email || "Email not recorded"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:"Transactions", v:selected.orders, color:C.blue},
                {l:"Last Sale", v:selected.last, color:C.navy},
              ].map(s=>(
                <div key={s.l} className="rounded-lg p-3 text-center" style={{backgroundColor:s.color+"10"}}>
                  <div className="font-bold" style={{color:s.color}}>{s.v}</div>
                  <div className="text-xs mt-0.5" style={{color:C.muted}}>{s.l}</div>
                </div>
              ))}
            </div>
            {[{l:"Phone",v:selected.phone || "Not recorded"},{l:"Email",v:selected.email || "Not recorded"},{l:"Address",v:selected.address || "Not recorded"}].map(r=>(
              <div key={r.l} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between sm:gap-2" style={{borderBottom:`1px solid ${C.border}`}}>
                <span className="text-sm flex-shrink-0" style={{color:C.muted}}>{r.l}</span>
                <span className="min-w-0 break-all text-sm font-semibold sm:text-right" style={{color:C.text}}>{r.v}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} onConfirm={handleDelete}
        title="Delete Customer" confirmLabel="Delete" variant="danger" loading={loading}
        description={`Delete "${selected?.name}"? A customer with no sales is removed permanently; otherwise they are hidden from the customer list and their purchase history is retained.`}/>
    </div>
  );
}
