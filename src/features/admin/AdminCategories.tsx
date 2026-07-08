import { useState } from "react";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, StatusBadge, Btn, Modal, ConfirmDialog, Drawer } from "../../components";
import { C } from "../../constants/colors";
import { inventoryService } from "../../services/inventory.service";
import type { Category } from "../../types/inventory";

const EMOJI: Record<string, string> = {
  Milk:"🥛", Cheese:"🧀", Butter:"🧈", Yogurt:"🍶", "Ice Cream":"🍨", Cream:"🍦",
};

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" };

interface FormState { name: string; desc: string; active: boolean }
const EMPTY: FormState = { name:"", desc:"", active:true };

export function AdminCategories() {
  const cats = inventoryService.getCategories();
  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [selected,   setSelected]   = useState<Category | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [loading,    setLoading]    = useState(false);

  const openEdit = (c: Category) => {
    setSelected(c); setForm({ name:c.name, desc:c.desc, active:c.active }); setEditOpen(true);
  };

  const save = (mode:"add"|"edit") => {
    if (!form.name) { toast.error("Category name is required."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      mode==="add" ? setAddOpen(false) : setEditOpen(false);
      setForm(EMPTY);
      toast.success(mode==="add" ? "Category added!" : "Category updated!");
    }, 700);
  };

  const handleDelete = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setDeleteOpen(false); toast.success(`${selected?.name} deleted.`); }, 600);
  };

  const CategoryForm = () => (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Category Name</label>
        <input className={inputClass} style={inputStyle} value={form.name}
          onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Milk"/>
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Description</label>
        <input className={inputClass} style={inputStyle} value={form.desc}
          onChange={e => setForm(f=>({...f,desc:e.target.value}))} placeholder="Short description"/>
      </div>
      <div className="flex items-center justify-between p-3 rounded-xl" style={{backgroundColor:C.bg}}>
        <div>
          <div className="text-sm font-medium" style={{color:C.text}}>Active Status</div>
          <div className="text-xs" style={{color:C.muted}}>Category is visible to staff</div>
        </div>
        <button
          onClick={() => setForm(f=>({...f,active:!f.active}))}
          className="w-11 h-6 rounded-full transition-colors relative"
          style={{backgroundColor:form.active?C.green:C.border}}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
            style={{left:form.active?"calc(100% - 22px)":"2px"}}/>
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Organize products by type</h2>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} fullWidth onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
          Add Category
        </Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cats.map(cat => (
          <Card key={cat.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{backgroundColor:C.blue+"12"}}>
                {EMOJI[cat.name]??"📦"}
              </div>
              <div className="flex gap-1">
                <button onClick={()=>{setSelected(cat);setViewOpen(true);}}
                  className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" style={{color:C.blue}}>
                  <Eye size={13}/>
                </button>
                <button onClick={()=>openEdit(cat)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{color:C.muted}}>
                  <Edit size={13}/>
                </button>
                <button onClick={()=>{setSelected(cat);setDeleteOpen(true);}}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{color:C.red}}>
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
            <h3 className="font-bold text-base" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{cat.name}</h3>
            <p className="text-xs mt-1 leading-relaxed" style={{color:C.muted}}>{cat.desc}</p>
            <div className="flex items-center justify-between mt-4 pt-3" style={{borderTop:`1px solid ${C.border}`}}>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{backgroundColor:C.blue+"15",color:C.blue}}>
                {cat.products} products
              </span>
              <StatusBadge status={cat.active?"Active":"Inactive"}/>
            </div>
          </Card>
        ))}

        <button onClick={()=>{setForm(EMPTY);setAddOpen(true);}}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
          style={{borderColor:C.border}}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{backgroundColor:C.blue+"15"}}>
            <Plus size={20} style={{color:C.blue}}/>
          </div>
          <span className="text-sm font-semibold" style={{color:C.blue}}>Add Category</span>
        </button>
      </div>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Category" subtitle="Create a new product category"
        footer={<><Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("add")} disabled={loading}>{loading?"Saving…":"Add Category"}</Btn></>}>
        <CategoryForm/>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Category" subtitle={selected?.name}
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("edit")} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <CategoryForm/>
      </Modal>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Category Details" size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          <Btn variant="primary" onClick={()=>{setViewOpen(false);selected&&openEdit(selected);}}>Edit</Btn></>}>
        {selected && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-5xl mb-3">{EMOJI[selected.name]??"📦"}</div>
              <h3 className="font-bold text-xl" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
              <p className="text-sm mt-1" style={{color:C.muted}}>{selected.desc}</p>
            </div>
            {[{l:"Total Products",v:`${selected.products}`},{l:"Status",v:selected.active?"Active":"Inactive"}].map(r=>(
              <div key={r.l} className="flex justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.muted}} className="text-sm">{r.l}</span>
                <span className="text-sm font-semibold" style={{color:C.text}}>{r.v}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Delete Confirm */}
      <ConfirmDialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} onConfirm={handleDelete}
        title="Delete Category" confirmLabel="Delete Category" variant="danger" loading={loading}
        description={`Delete "${selected?.name}"? All associated products will need to be reassigned.`}/>
    </div>
  );
}
