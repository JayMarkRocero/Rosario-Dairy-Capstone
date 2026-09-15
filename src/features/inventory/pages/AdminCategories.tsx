import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { ActionButton } from "@/components/buttons/ActionButton";
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

interface FormState { name: string; desc: string; is_visible_to_staff: boolean }
const EMPTY: FormState = { name:"", desc:"", is_visible_to_staff:true };

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
    </div>
  );
}

export function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const loadCategories = async () => {
    setCatsLoading(true);
    try {
      setCats(await inventoryService.getCategories());
    } catch (error) {
      toastApiError(error, "Failed to load categories.");
    } finally {
      setCatsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [selected,   setSelected]   = useState<Category | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [loading,    setLoading]    = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const { pageSize, containerRef, headerRef } = useAdminAutoPageSize(56);
  useEffect(() => { setPage(1); }, [pageSize]);

  const visibleCategories = showInactive
    ? cats
    : cats.filter((cat) => cat.is_active);
  const sortedCategories = [...visibleCategories].sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageCategories = sortedCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const syncCategory = (id: number, changes: Partial<Category>) => {
    setCats(current => current.map(cat => cat.id === id ? { ...cat, ...changes } : cat));
    setSelected(current => current?.id === id ? { ...current, ...changes } : current);
  };

  const openEdit = (c: Category) => {
    setSelected(c); setForm({ name:c.name, desc:c.desc, is_visible_to_staff:c.is_visible_to_staff }); setEditOpen(true);
  };

  const save = async (mode:"add"|"edit") => {
    if (!form.name) { toast.error("Category name is required."); return; }
    setLoading(true);

    try {
      if (mode === "add") {
        await inventoryService.createCategory(form);
          toast.success("Category added!");
          setAddOpen(false);
      } else {
        if (!selected) return;
        await inventoryService.updateCategory(selected.id, form);
          toast.success("Category updated!");
          setEditOpen(false);
      }
      setForm(EMPTY);
      await loadCategories();
    } catch (err) {
      toastApiError(err, `Failed to ${mode === "add" ? "add" : "update"} category.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selected?.is_active || loading) return;
    setLoading(true);
    inventoryService.deleteCategory(selected.id)
      .then(() => {
        syncCategory(selected.id, { is_active: false, is_visible_to_staff: false });
        toast.success(`${selected.name} deactivated.`);
        setDeleteOpen(false);
        loadCategories();
      })
      .catch((err) => toastApiError(err, "Failed to deactivate category."))
      .finally(() => setLoading(false));
  };

  const handleReactivate = (category: Category) => {
    if (category.is_active || loading) return;
    setLoading(true);
    inventoryService.reactivateCategory(category.id)
      .then(() => {
        syncCategory(category.id, { is_active: true });
        toast.success(`${category.name} reactivated.`);
        loadCategories();
      })
      .catch((err) => toastApiError(err, "Failed to reactivate category."))
      .finally(() => setLoading(false));
  };

  const handleStaffVisibility = async (category: Category) => {
    if (!category.is_active || loading) return;
    const isVisible = !category.is_visible_to_staff;
    setLoading(true);
    try {
      await inventoryService.updateCategory(category.id, { is_visible_to_staff: isVisible });
      setCats(current => current.map(item => item.id === category.id
        ? { ...item, is_visible_to_staff: isVisible }
        : item));
      setSelected(current => current?.id === category.id
        ? { ...current, is_visible_to_staff: isVisible }
        : current);
      toast.success(`${category.name} is now ${isVisible ? "visible" : "hidden"} to staff.`);
    } catch (err) {
      toastApiError(err, "Failed to update staff visibility.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden gap-3 px-4 sm:px-6 pt-3 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Organize products by type</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color:C.muted}}>
            <input type="checkbox" checked={showInactive}
              onChange={e => { setShowInactive(e.target.checked); setPage(1); }} className="accent-blue-600"/>
            Show Inactive Categories
          </label>
          <Btn variant="primary" size="sm" icon={<Plus size={13}/>} onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
            Add Category
          </Btn>
        </div>
      </div>

      <Card className="p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <table className="w-full table-fixed text-sm text-slate-700">
            <thead ref={headerRef} className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="w-[22%] text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Category</th>
                <th className="w-[26%] text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Description</th>
                <th className="w-[12%] text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Products</th>
                <th className="w-[12%] text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="w-[16%] text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Staff Visibility</th>
                <th className="w-[12%] text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catsLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm" style={{color:C.muted}}>
                    Loading categories…
                  </td>
                </tr>
              )}

              {!catsLoading && visibleCategories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{color:C.muted}}>
                    {showInactive ? "No categories found." : "No active categories found."}
                  </td>
                </tr>
              )}

              {!catsLoading && pageCategories.map(cat => (
                <tr key={cat.id} className="h-14 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                  <td className="text-left px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{backgroundColor:C.blue+"12"}}>
                        <CategoryIcon name={cat.name} size={18} color={C.blue}/>
                      </div>
                      <span className="truncate font-medium text-slate-700" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-left px-4 py-2 max-w-xs truncate" style={{color:C.muted}}>
                    {cat.desc}
                  </td>
                  <td className="text-center px-4 py-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1 border border-blue-200/60"
                      style={{backgroundColor:C.blue+"15",color:C.blue}}>
                      {cat.products}
                    </span>
                  </td>
                  <td className="text-center px-4 py-2">
                    <StatusBadge status={cat.is_active?"Active":"Inactive"}/>
                  </td>
                  <td className="text-center px-4 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <StatusBadge status={(cat.is_active && cat.is_visible_to_staff)?"Visible":"Hidden"}/>
                      <button type="button" disabled={loading || !cat.is_active} onClick={()=>handleStaffVisibility(cat)}
                        className="w-9 h-5 shrink-0 rounded-full transition-colors relative disabled:opacity-50"
                        style={{backgroundColor:(cat.is_active && cat.is_visible_to_staff)?C.green:C.border}}
                        aria-label={`${(cat.is_active && cat.is_visible_to_staff)?"Hide":"Show"} ${cat.name} for staff`}>
                        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{left:(cat.is_active && cat.is_visible_to_staff)?"calc(100% - 18px)":"2px"}}/>
                      </button>
                    </div>
                  </td>
                  <td className="text-center px-4 py-2">
                    <div className="flex items-center justify-center gap-2">
                      {!cat.is_active && (
                        <button onClick={()=>handleReactivate(cat)} disabled={loading}
                          title="Restore category" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                          <RotateCcw size={13}/> Reactivate
                        </button>
                      )}
                      <ActionButton label="View details" onClick={()=>{setSelected(cat);setViewOpen(true);}}>
                        <Eye size={14}/>
                      </ActionButton>
                      <ActionButton label="Edit category" onClick={()=>openEdit(cat)}>
                        <Edit size={14}/>
                      </ActionButton>
                      {cat.is_active && <ActionButton label="Deactivate category" destructive disabled={loading} onClick={()=>{setSelected(cat);setDeleteOpen(true);}}>
                        <Trash2 size={14}/>
                      </ActionButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-auto pt-3 border-t border-slate-100 flex shrink-0 items-center justify-between gap-3 text-xs text-slate-500">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="h-8 w-8 rounded-lg border disabled:opacity-40">&lt;</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i).map(number => (
              <button key={number} type="button" aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`h-8 w-8 rounded-lg border ${number === currentPage ? "bg-blue-600 text-white border-blue-600" : "hover:bg-slate-100"}`}>{number}</button>
            ))}
            <button type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="h-8 w-8 rounded-lg border disabled:opacity-40">&gt;</button>
          </div>
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
            {[{l:"Total Products",v:`${selected.products}`},{l:"Status",v:selected.is_active?"Active":"Inactive"},{l:"Staff Visibility",v:selected.is_visible_to_staff?"Visible":"Hidden"}].map(r=>(
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
        title="Deactivate Category" confirmLabel="Deactivate Category" variant="danger" loading={loading}
        description={`Deactivate "${selected?.name}"? Existing product associations will be preserved.`}/>
    </div>
  );
}

