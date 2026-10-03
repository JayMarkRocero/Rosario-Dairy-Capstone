import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { ActionButton } from "@/components/buttons/ActionButton";
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { Drawer } from "@/components/overlays/Drawer";
import { CategoryIcon } from "@/components/data-display/CategoryIcon";
import { C } from "@/styles/tokens/colors";
import { filterSelectClass } from "@/styles/controlClasses";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { CATEGORY_ICON_NAMES, normalizeCategoryIcon, type CategoryIconName } from "@/features/inventory/utils/categoryIcons";
import type { Category } from "@/features/inventory/types/inventory";

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400";
const inputStyle = { borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--input-background)" };

interface FormState { name: string; icon: CategoryIconName; is_active: boolean; is_visible_to_staff: boolean }
const EMPTY: FormState = { name:"", icon:"Package", is_active:true, is_visible_to_staff:true };
type CategoryStatus = "All" | "Active" | "Inactive";

function CategoryForm({ form, setForm, showStatus = false }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; showStatus?: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Category Name</label>
        <input className={inputClass} style={inputStyle} value={form.name}
          onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Milk"/>
      </div>
      <div role="group" aria-label="Icon Selection">
        <span className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Icon Selection</span>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORY_ICON_NAMES.map(icon => {
            const active = form.icon === icon;
            const label = icon.replace(/([a-z])([A-Z])/g, "$1 $2");
            return <button key={icon} type="button" aria-label={`${label} icon`} aria-pressed={active}
              onClick={() => setForm(current => ({ ...current, icon }))}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-xs transition-colors ${active ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
              style={{ color: active ? C.blue : C.muted }}>
              <CategoryIcon icon={icon} size={20} color={active ? C.blue : C.muted} />
              <span className="w-full truncate text-center text-[10px] leading-tight" title={label}>{label}</span>
            </button>;
          })}
        </div>
      </div>
      {showStatus && <div>
        <label htmlFor="edit-category-status" className="text-xs font-semibold block mb-1.5" style={{color:C.muted}}>Status</label>
        <select id="edit-category-status" className={inputClass} style={inputStyle}
          value={form.is_active ? "active" : "inactive"}
          onChange={e => setForm(f => ({ ...f, is_active: e.target.value === "active" }))}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>}
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
  const [statusFilter, setStatusFilter] = useState<CategoryStatus>("Active");
  const pageCapacity = useAdminAutoPageSize(56);

  const visibleCategories = cats.filter(cat =>
    statusFilter === "All" || cat.is_active === (statusFilter === "Active")
  );
  const sortedCategories = [...visibleCategories].sort((a, b) => a.name.localeCompare(b.name));
  const activeCategories = cats.filter(cat => cat.is_active).length;
  const productCount = cats.reduce((total, cat) => total + cat.products, 0);

  const syncCategory = (id: number, changes: Partial<Category>) => {
    setCats(current => current.map(cat => cat.id === id ? { ...cat, ...changes } : cat));
    setSelected(current => current?.id === id ? { ...current, ...changes } : current);
  };

  const openEdit = (c: Category) => {
    setSelected(c); setForm({ name:c.name, icon:normalizeCategoryIcon(c.icon), is_active:c.is_active, is_visible_to_staff:c.is_visible_to_staff }); setEditOpen(true);
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
        await inventoryService.updateCategory(selected.id, {
          name: form.name,
          icon: form.icon,
          is_visible_to_staff: form.is_active && form.is_visible_to_staff,
        });
        if (form.is_active !== selected.is_active) {
          if (form.is_active) await inventoryService.reactivateCategory(selected.id);
          else await inventoryService.deactivateCategory(selected.id);
        }
        toast.success(form.is_active === selected.is_active ? "Category updated!" : `Category ${form.is_active ? "reactivated" : "deactivated"}.`);
        setEditOpen(false);
      }
      setForm(EMPTY);
      await loadCategories();
    } catch (err) {
      if (mode === "edit") await loadCategories();
      toastApiError(err, `Failed to ${mode === "add" ? "add" : "update"} category.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selected?.is_active || loading) return;
    setLoading(true);
    inventoryService.deleteCategory(selected.id)
      .then(deletionType => {
        if (deletionType === "deactivated") syncCategory(selected.id, { is_active: false });
        toast.success(deletionType === "permanent"
          ? `${selected.name} permanently deleted.`
          : `${selected.name} deactivated; linked records were preserved.`);
        setDeleteOpen(false);
        loadCategories();
      })
      .catch((err) => toastApiError(err, "Failed to delete category."))
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

  const columns: Column<Category>[] = [
    { key: "name", header: "Category", align: "left", width: "32%", sortKey: cat => cat.name,
      render: cat => <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.blue + "12" }}>
          <CategoryIcon icon={cat.icon} size={18} color={C.blue} />
        </div>
        <span className="truncate font-medium" title={cat.name}>{cat.name}</span>
      </div> },
    { key: "products", header: "Products", align: "center", width: "14%", sortKey: cat => cat.products,
      render: cat => <span className="text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center border border-blue-200/60"
        style={{ backgroundColor: C.blue + "15", color: C.blue }}>{cat.products}</span> },
    { key: "status", header: "Status", align: "center", width: "14%", sortKey: cat => cat.is_active ? "Active" : "Inactive",
      render: cat => <StatusBadge status={cat.is_active ? "Active" : "Inactive"} /> },
    { key: "visibility", header: "Staff Visibility", align: "center", width: "20%", sortKey: cat => cat.is_active && cat.is_visible_to_staff ? "Visible" : "Hidden",
      render: cat => <div className="flex items-center justify-center gap-2" onClick={event => event.stopPropagation()}>
        <StatusBadge status={cat.is_active && cat.is_visible_to_staff ? "Visible" : "Hidden"} />
        <button type="button" disabled={loading || !cat.is_active} onClick={() => handleStaffVisibility(cat)}
          className="w-9 h-5 shrink-0 rounded-full transition-colors relative disabled:opacity-50"
          style={{ backgroundColor: cat.is_active && cat.is_visible_to_staff ? C.successAction : C.border }}
          aria-label={`${cat.is_active && cat.is_visible_to_staff ? "Hide" : "Show"} ${cat.name} for staff`}>
          <span className="ui-switch-thumb absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: cat.is_active && cat.is_visible_to_staff ? "calc(100% - 18px)" : "2px" }} />
        </button>
      </div> },
    { key: "actions", header: "Actions", align: "center", width: "20%",
      render: cat => <div className="flex items-center justify-center gap-1.5" onClick={event => event.stopPropagation()}>
        {!cat.is_active && <ActionButton label="Reactivate category" onClick={() => handleReactivate(cat)} disabled={loading}><RotateCcw size={14} /></ActionButton>}
        <ActionButton label="View details" onClick={() => { setSelected(cat); setViewOpen(true); }}><Eye size={14} /></ActionButton>
        <ActionButton label="Edit category" onClick={() => openEdit(cat)}><Edit size={14} /></ActionButton>
        {cat.is_active && <ActionButton label="Delete category" destructive disabled={loading}
          onClick={() => { setSelected(cat); setDeleteOpen(true); }}><Trash2 size={14} /></ActionButton>}
      </div> },
  ];

  return (
    <div className="records-page flex flex-1 flex-col h-full min-h-0 overflow-hidden gap-3 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <h2 className="hidden text-lg font-bold sm:block" style={{color:C.text}}>Categories</h2>
        <Btn variant="primary" size="sm" icon={<Plus size={13}/>} fullWidth onClick={()=>{setForm(EMPTY);setAddOpen(true);}}>
          Add Category
        </Btn>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        {[
          {label:"Categories", value:cats.length, color:C.blue},
          {label:"Active", value:activeCategories, color:C.green},
          {label:"Products", value:productCount, color:C.navy},
        ].map(stat => (
          <SummaryCard compact key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      <Card className="records-card p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <EnhancedTable mobileTable rowHeight={56} columns={columns}
          data={sortedCategories} rowKey={cat => cat.id} pageCapacity={pageCapacity}
          searchable searchKeys={cat => [cat.name]} searchPlaceholder="Search categories…"
          onRowClick={cat => { setSelected(cat); setViewOpen(true); }}
          showExport={false} loading={catsLoading}
          emptyTitle={statusFilter === "Inactive" ? "No inactive categories" : statusFilter === "Active" ? "No active categories" : "No categories found"}
          emptyDesc={statusFilter === "Inactive" ? "Deactivated categories will appear here." : statusFilter === "Active" ? "Reactivate a category or add a new one." : "Add a category to organize your products."}
          extraControls={<select aria-label="Category status" value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as CategoryStatus)} className={filterSelectClass}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>} />
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
        <CategoryForm form={form} setForm={setForm} showStatus />
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
                <CategoryIcon icon={selected.icon} size={28} color={C.blue}/>
              </div>
              <h3 className="font-bold text-xl" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{selected.name}</h3>
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
        title="Delete Category" confirmLabel="Delete Category" variant="danger" loading={loading}
        description={`Delete "${selected?.name}"? An unused category is removed permanently; one linked to products is deactivated and retained in their history.`}/>
    </div>
  );
}
