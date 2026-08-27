import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Drawer } from "@/components/overlays/Drawer";
import { CategoryIcon } from "@/components/data-display/CategoryIcon";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { Category } from "@/features/inventory/types/inventory";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" };

interface FormState { name: string; desc: string; is_active: boolean }
const EMPTY: FormState = { name:"", desc:"", is_active:true };

function CategoryForm({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
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
          onClick={() => setForm(f=>({...f,is_active:!f.is_active}))}
          className="w-11 h-6 rounded-full transition-colors relative"
          style={{backgroundColor:form.is_active?C.green:C.border}}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
            style={{left:form.is_active?"calc(100% - 22px)":"2px"}}/>
        </button>
      </div>
    </div>
  );
}

export function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const loadCategories = () => {
    setCatsLoading(true);
    inventoryService.getCategories()
      .then(setCats)
      .catch(() => toast.error("Failed to load categories."))
      .finally(() => setCatsLoading(false));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [selected,   setSelected]   = useState<Category | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [loading,    setLoading]    = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const visibleCategories = showInactive
    ? cats
    : cats.filter((cat) => cat.is_active);

  const openEdit = (c: Category) => {
    setSelected(c); setForm({ name:c.name, desc:c.desc, is_active:c.is_active }); setEditOpen(true);
  };

  const save = (mode:"add"|"edit") => {
    if (!form.name) { toast.error("Category name is required."); return; }
    setLoading(true);

    if (mode === "add") {
      inventoryService.createCategory(form)
        .then(() => {
          toast.success("Category added!");
          setAddOpen(false);
          setForm(EMPTY);
          loadCategories();
        })
        .catch((err) => toast.error(err.message || "Failed to add category."))
        .finally(() => setLoading(false));
    } else {
      if (!selected) return;
      inventoryService.updateCategory(selected.id, form)
        .then(() => {
          toast.success("Category updated!");
          setEditOpen(false);
          setForm(EMPTY);
          loadCategories();
        })
        .catch((err) => toast.error(err.message || "Failed to update category."))
        .finally(() => setLoading(false));
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    setLoading(true);
    inventoryService.updateCategory(selected.id, { is_active: false })
      .then(() => {
        toast.success(`${selected.name} deactivated.`);
        setDeleteOpen(false);
        loadCategories();
      })
      .catch((err) => toast.error(err.message || "Failed to deactivate category."))
      .finally(() => setLoading(false));
  };

  const handleReactivate = (category: Category) => {
    setLoading(true);
    inventoryService.updateCategory(category.id, {
      is_active: true,
    })
      .then(() => {
        toast.success(`${category.name} reactivated.`);
        loadCategories();
      })
      .catch((err) => toast.error(err.message || "Failed to reactivate category."))
      .finally(() => setLoading(false));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Organize products by type</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color:C.muted}}>
            <input type="checkbox" checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)} className="accent-blue-600"/>
            Show Inactive Categories
          </label>
          <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
            Add Category
          </Btn>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{backgroundColor:C.bg, borderBottom:`1px solid ${C.border}`}}>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{color:C.muted}}>Category</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{color:C.muted}}>Description</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{color:C.muted}}>Products</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{color:C.muted}}>Status</th>
                <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{color:C.muted}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catsLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm" style={{color:C.muted}}>
                    Loading categories…
                  </td>
                </tr>
              )}

              {!catsLoading && visibleCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm" style={{color:C.muted}}>
                    {showInactive ? "No categories found." : "No active categories found."}
                  </td>
                </tr>
              )}

              {!catsLoading && visibleCategories.map(cat => (
                <tr key={cat.id} className="hover:bg-gray-50/70 transition-colors"
                  style={{borderBottom:`1px solid ${C.border}`}}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{backgroundColor:C.blue+"12"}}>
                        <CategoryIcon name={cat.name} size={18} color={C.blue}/>
                      </div>
                      <span className="font-semibold" style={{color:C.text, fontFamily:"Poppins,sans-serif"}}>
                        {cat.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 max-w-xs whitespace-normal break-words" style={{color:C.muted}}>
                    {cat.desc}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{backgroundColor:C.blue+"15",color:C.blue}}>
                      {cat.products}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={cat.is_active?"Active":"Inactive"}/>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      {!cat.is_active && (
                        <button onClick={()=>handleReactivate(cat)} disabled={loading}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
                          style={{color:C.green}}>
                          <RotateCcw size={13}/> Reactivate
                        </button>
                      )}
                      <button onClick={()=>{setSelected(cat);setViewOpen(true);}}
                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" style={{color:C.blue}}>
                        <Eye size={14}/>
                      </button>
                      <button onClick={()=>openEdit(cat)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{color:C.muted}}>
                        <Edit size={14}/>
                      </button>
                      <button onClick={()=>{setSelected(cat);setDeleteOpen(true);}}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{color:C.red}}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Add Category" subtitle="Create a new product category"
        footer={<><Btn variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("add")} disabled={loading}>{loading?"Saving…":"Add Category"}</Btn></>}>
        <CategoryForm form={form} setForm={setForm}/>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Category" subtitle={selected?.name}
        footer={<><Btn variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>save("edit")} disabled={loading}>{loading?"Saving…":"Save Changes"}</Btn></>}>
        <CategoryForm form={form} setForm={setForm}/>
      </Modal>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={()=>setViewOpen(false)} title="Category Details" size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setViewOpen(false)}>Close</Btn>
          <Btn variant="primary" onClick={()=>{setViewOpen(false);selected&&openEdit(selected);}}>Edit</Btn></>}>
        {selected && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{backgroundColor:C.blue+"12"}}>
                <CategoryIcon name={selected.name} size={28} color={C.blue}/>
              </div>
              <h3 className="font-bold text-xl" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
              <p className="text-sm mt-1" style={{color:C.muted}}>{selected.desc}</p>
            </div>
            {[{l:"Total Products",v:`${selected.products}`},{l:"Status",v:selected.is_active?"Active":"Inactive"}].map(r=>(
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
