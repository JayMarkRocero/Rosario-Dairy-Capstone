import { daysUntilExpiry as calendarDaysUntilExpiry } from "@/features/inventory/utils/expiry";
import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { filterSelectClass } from "@/styles/controlClasses";
import { ActionButton } from "@/components/buttons/ActionButton";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Eye, Edit, Trash2, AlertTriangle, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { Drawer } from "@/components/overlays/Drawer";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { CategoryIcon } from "@/components/data-display/CategoryIcon";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";

// ─── Form ─────────────────────────────────────────────────────────────────────
interface FormState {
  name: string; cat: string; price: string; stock: string; expiry: string;
}
const EMPTY_FORM: FormState = { name:"", cat:"", price:"", stock:"", expiry:"" };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const STATUSES = ["Active", "Low Stock", "Near Expiry", "Expired"];
const NEAR_EXPIRY_DAYS = 7;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>{label}</label>
      {children}
    </div>
  );
}
const inputClass = `w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100`;
const inputStyle = { borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--input-background)" };

// Compares expiry date against today. A product expiring "today" is not yet
// expired — it becomes expired starting the day after.
function isExpired(expiry: string): boolean {
  const days = calendarDaysUntilExpiry(expiry);
  return days !== null && days < 0;
}

function daysUntilExpiry(expiry: string): number | null {
  return calendarDaysUntilExpiry(expiry);
}

function isNearExpiry(expiry: string): boolean {
  const days = daysUntilExpiry(expiry);
  return days !== null && days >= 0 && days <= NEAR_EXPIRY_DAYS;
}

// Priority: Expired > Low Stock > Near Expiry > Active
function getStatus(item: InventoryItem): "Expired" | "Low" | "Near Expiry" | "Active" {
  if (isExpired(item.expiry)) return "Expired";
  if (item.low) return "Low";
  if (isNearExpiry(item.expiry)) return "Near Expiry";
  return "Active";
}

function ProductForm({ form, onChange, categories, mode }: {
  form: FormState;
  onChange: (f: FormState) => void;
  categories: { id: number; name: string }[];
  mode: "add" | "edit";
}) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Field label="Product Name">
          <input className={inputClass} style={inputStyle} value={form.name}
            onChange={set("name")} placeholder="e.g. Fresh Whole Milk 1L"/>
        </Field>
      </div>
      <Field label="Category">
        <select className={inputClass} style={inputStyle} value={form.cat} onChange={set("cat")}>
          <option value="">Select a category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Unit Price (₱)">
        <input className={inputClass} style={inputStyle} type="number" value={form.price}
          onChange={set("price")} placeholder="0.00"/>
      </Field>
      {mode === "add" && <>
        <Field label="Stock Quantity">
          <input className={inputClass} style={inputStyle} type="number" min="0.01" step="0.01"
            value={form.stock} onChange={set("stock")} placeholder="0"/>
        </Field>
        <Field label="Expiry Date">
          <input className={inputClass} style={inputStyle} type="date" min={today()}
            value={form.expiry} onChange={set("expiry")}/>
        </Field>
      </>}
    </div>
  );
}

// ─── View Drawer Content ──────────────────────────────────────────────────────
function ProductDetail({ p }: { p: InventoryItem }) {
  const status = getStatus(p);
  const statusLabel =
    status === "Expired" ? "Expired" :
    status === "Low" ? "Low Stock" :
    status === "Near Expiry" ? "Near Expiry" : "Adequate";
  const accentColor = status === "Expired" ? C.red : status === "Near Expiry" ? "#f0c06f" : C.blue;
  const rows = [
    { label:"Product ID",    value:`PRD-${String(p.id).padStart(3,"0")}` },
    { label:"Name",          value: p.name     },
    { label:"Category",      value: p.cat      },
    { label:"Unit Price",    value:`₱${p.price}` },
    { label:"Stock Qty",     value: p.stock    },
    { label:"Expiry Date",   value: p.expiry   },
    { label:"FEFO Status",   value: statusLabel },
  ];
  return (
    <div className="space-y-5 sm:p-6">
      <div
        className="rounded-2xl p-4 text-center"
        style={{ backgroundColor: accentColor + "08", border:`1px solid ${accentColor}20` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: accentColor + "12" }}
        >
          <CategoryIcon name={p.cat} size={30} color={accentColor} />
        </div>
        <div className="font-bold text-base" style={{ color:C.text,fontFamily:"Poppins,sans-serif" }}>{p.name}</div>
        <div className="mt-1"><StatusBadge status={status}/></div>
      </div>
      <div className="space-y-2 sm:space-y-5 sm:p-6">
        {rows.map(r => (
          <div key={r.label} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between sm:gap-3" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{r.label}</span>
            <span className="min-w-0 break-words text-sm font-semibold sm:text-right" style={{color:C.text}}>{r.value}</span>
          </div>
        ))}
      </div>
      {status === "Expired" && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:C.red+"15",color:C.red,border:`1px solid ${C.red}30`}}>
          <AlertTriangle size={14}/>
          <span>This product has expired and should be removed from active stock.</span>
        </div>
      )}
      {status === "Low" && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:C.orange+"15",color:C.orange,border:`1px solid ${C.orange}30`}}>
          <AlertTriangle size={14}/>
          <span>This product is below the minimum stock threshold.</span>
        </div>
      )}
      {status === "Near Expiry" && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:"#F59E0B"+"15",color:"#F59E0B",border:`1px solid #F59E0B30`}}>
          <AlertTriangle size={14}/>
          <span>This product expires within {NEAR_EXPIRY_DAYS} days — prioritize it for sale (FEFO).</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminInventory() {
  const pageCapacity = useAdminAutoPageSize(56);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  const loadItems = () => {
    setItemsLoading(true);
    inventoryService.getAll()
      .then(setItems)
      .catch(error => toastApiError(error, "Failed to load inventory."))
      .finally(() => setItemsLoading(false));
  };

  useEffect(() => {
    loadItems();
    inventoryService.getCategoriesRaw()
      .then(setCategories)
      .catch(error => toastApiError(error, "Failed to load categories."));
  }, []);

  const [catFilter,    setCatFilter]    = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addOpen,     setAddOpen]    = useState(false);
  const [editOpen,    setEditOpen]   = useState(false);
  const [deleteOpen,  setDeleteOpen] = useState(false);
  const [viewOpen,    setViewOpen]   = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockQuery, setRestockQuery] = useState("");
  const [restockForm, setRestockForm] = useState({ quantity:"", expiry:"" });
  const [selected,    setSelected]   = useState<InventoryItem | null>(null);
  const [form,        setForm]       = useState<FormState>(EMPTY_FORM);
  const [loading,     setLoading]    = useState(false);
  const submissionLock = useRef(false);

  const filteredItems = useMemo(() => {
  return items
    .filter(i => {
      const matchesCat = catFilter === "All" || i.cat === catFilter;
      const status = getStatus(i);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Low Stock" ? status === "Low" :
         statusFilter === "Near Expiry" ? status === "Near Expiry" :
         statusFilter === "Expired" ? status === "Expired" :
         status === "Active");
      return matchesCat && matchesStatus;
    })
    // FEFO ordering: soonest expiry first. Items with no expiry date sort last.
    .sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
}, [items, catFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalProducts = items.length;
    const lowStock = items.filter(i => getStatus(i) === "Low").length;
    const expired = items.filter(i => getStatus(i) === "Expired").length;
    const nearExpiry = items.filter(i => getStatus(i) === "Near Expiry").length;
    const totalValue = items.reduce((sum, i) => sum + (i.price * i.stock), 0);

    return { totalProducts, lowStock, expired, nearExpiry, totalValue };
  }, [items]);

  const openEdit = (p: InventoryItem) => {
    setSelected(p);
    const matchedCat = categories.find(c => c.name === p.cat);
    setForm({ name:p.name, cat: matchedCat ? String(matchedCat.id) : "", price:String(p.price), stock:String(p.stock), expiry: p.expiry || "" });
    setEditOpen(true);
  };
  const openDelete = (p: InventoryItem) => { setSelected(p); setDeleteOpen(true); };
  const openView   = (p: InventoryItem) => { setSelected(p); setViewOpen(true); };
  const openRestock = () => {
    setSelected(null);
    setRestockQuery("");
    setRestockForm({ quantity:"", expiry:"" });
    setRestockOpen(true);
  };

  const restockMatches = useMemo(() => {
    const query = restockQuery.trim().toLowerCase();
    if (!query || (selected && restockQuery === selected.name)) return [];
    return items.filter(item => `${item.name} ${item.cat}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  }, [items, restockQuery, selected]);

  const handleRestock = async () => {
    const quantity = Number(restockForm.quantity);
    if (!selected || !Number.isFinite(quantity) || quantity <= 0 || calendarDaysUntilExpiry(restockForm.expiry) == null || restockForm.expiry < today()) {
      toast.error("Select a product, enter a positive quantity, and choose a valid expiry date.");
      return;
    }
    if (submissionLock.current) return;
    submissionLock.current = true;
    setLoading(true);
    try {
      await inventoryService.restockProduct(selected.id, { quantity, expirationDate: restockForm.expiry });
      toast.success(`${selected.name} restocked.`);
      setRestockOpen(false);
      loadItems();
    } catch (error) {
      toastApiError(error, "Failed to restock product.");
    } finally {
      submissionLock.current = false; setLoading(false);
    }
  };

  const handleSave = (mode: "add"|"edit") => {
    if (!form.name.trim() || !form.price || !form.cat || (mode === "add" && !form.stock)) {
      toast.error("Please fill in all required fields."); return;
    }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0 || !Number.isInteger(Number(form.cat)) || Number(form.cat) <= 0) {
      toast.error("Enter a valid price and category."); return;
    }
    if (mode === "add" && (!Number.isFinite(Number(form.stock)) || Number(form.stock) <= 0 || calendarDaysUntilExpiry(form.expiry) == null || form.expiry < today())) {
      toast.error("Enter positive stock and a valid expiry date."); return;
    }
    if (submissionLock.current) return;
    submissionLock.current = true;
    setLoading(true);

    if (mode === "add") {
      inventoryService.createProduct({
        name: form.name,
        categoryId: Number(form.cat),
        price: Number(form.price),
        stock: Number(form.stock),
        expiry: form.expiry,
      })
        .then(() => {
          toast.success("Product added successfully!");
          setAddOpen(false);
          setForm(EMPTY_FORM);
          loadItems();
        })
        .catch(error => toastApiError(error, "Failed to add product."))
        .finally(() => { submissionLock.current = false; setLoading(false); });
    } else {
      if (!selected) { submissionLock.current = false; setLoading(false); return; }
      inventoryService.updateProduct(selected.id, {
        name: form.name,
        categoryId: Number(form.cat),
        price: Number(form.price),
      })
        .then(() => {
          toast.success("Product updated successfully!");
          setEditOpen(false);
          setForm(EMPTY_FORM);
          loadItems();
        })
        .catch(error => toastApiError(error, "Failed to update product."))
        .finally(() => { submissionLock.current = false; setLoading(false); });
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (submissionLock.current) return;
    submissionLock.current = true;
    setLoading(true);
    inventoryService.deleteProduct(selected.id)
      .then(deletionType => {
        toast.success(deletionType === "permanent"
          ? `${selected.name} permanently deleted.`
          : `${selected.name} deactivated; linked records were preserved.`);
        setDeleteOpen(false);
        loadItems();
      })
      .catch(error => toastApiError(error, "Failed to delete product."))
      .finally(() => { submissionLock.current = false; setLoading(false); });
  };

  const columns: Column<InventoryItem>[] = [
    {
      key:"name", header:"Product", align:"left", width:"23%",
      sortKey: r => r.name,
      render: r => (
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: C.blue + "12" }}
          >
            <CategoryIcon name={r.cat} size={16} color={C.blue} />
          </div>
          <div>
            <div className="font-medium text-sm" style={{color:C.text}}>{r.name}</div>
            <div className="text-xs mt-0.5" style={{color:C.muted}}>PRD-{String(r.id).padStart(3,"0")}</div>
          </div>
        </div>
      ),
    },
    {
      key:"cat", header:"Category", align:"center", width:"14%",
      sortKey: r => r.cat,
      render: r => (
        <span className="text-xs px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 border border-blue-200/60"
          style={{backgroundColor:C.blue+"15",color:C.blue}}>{r.cat}</span>
      ),
    },
    {
      key:"price", header:"Price", align:"center", width:"11%",
      sortKey: r => r.price,
      render: r => <span className="font-medium text-sm" style={{color:C.text}}>₱{r.price}</span>,
    },
    {
      key:"stock", header:"Stock", align:"center", width:"10%",
      sortKey: r => r.stock,
      render: r => {
        const status = getStatus(r);
        const iconColor = status === "Expired" ? C.red : status === "Low" ? C.orange : status === "Near Expiry" ? "#F59E0B" : undefined;
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="font-medium text-sm" style={{color:status==="Expired"||status==="Low"?C.red:C.text}}>{r.stock}</span>
            {status !== "Active" && <AlertTriangle size={12} style={{color:iconColor}}/>}
          </div>
        );
      },
    },
    { key:"expiry", header:"Expiry", align:"center", width:"13%", sortKey: r => r.expiry,
      render: r => {
        const expired = isExpired(r.expiry);
        const near = !expired && isNearExpiry(r.expiry);
        return (
          <span className="text-xs" style={{color:expired?C.red:near?"#F59E0B":C.muted, fontWeight:(expired||near)?600:400}}>
            {r.expiry}
          </span>
        );
      } },
    { key:"status", header:"Status", align:"center", width:"13%",
      render: r => <div className="flex justify-center"><StatusBadge status={getStatus(r)}/></div> },
    {
      key:"actions", header:"Actions", align:"center", width:"16%",
      render: r => (
        <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
          <ActionButton label="View details" onClick={() => openView(r)}>
            <Eye size={13}/>
          </ActionButton>
          <ActionButton label="Edit" onClick={() => openEdit(r)}>
            <Edit size={13}/>
          </ActionButton>
          <ActionButton label="Delete product" destructive onClick={() => openDelete(r)}>
            <Trash2 size={13}/>
          </ActionButton>
        </div>
      ),
    },
  ];
  const formFooter = (mode: "add"|"edit") => (
    <>
      <Btn variant="secondary" disabled={loading} onClick={() => mode==="add"?setAddOpen(false):setEditOpen(false)}>
        Cancel
      </Btn>
      <Btn variant="primary" onClick={() => handleSave(mode)} disabled={loading}>
        {loading ? "Saving…" : mode==="add" ? "Add Product" : "Save Changes"}
      </Btn>
    </>
  );

  return (
    <div className="records-page flex flex-1 flex-col h-full min-h-0 overflow-hidden gap-3 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="hidden text-lg font-bold sm:block" style={{color:C.muted}}>Expiry-Based Inventory</h2>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">
            <Btn variant="primary" size="sm" icon={<PackagePlus size={13}/>} fullWidth onClick={openRestock}>
              Restock
            </Btn>
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <Btn variant="primary" size="sm" icon={<Plus size={13}/>} fullWidth onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }}>
              Add Product
            </Btn>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 flex-shrink-0">
        {[
          { label:"Total Products",  value:String(stats.totalProducts), color:C.blue   },
          { label:"Low Stock",       value:String(stats.lowStock),      color:C.orange },
          { label:"Near Expiry",     value:String(stats.nearExpiry),    color:"#f59e0b" },
          { label:"Expired",         value:String(stats.expired),       color:C.red    },
          { label:"Total Value",     value:`₱${stats.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, color:C.green  },
        ].map(s => (
          <SummaryCard compact key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* Table */}
      <Card className="records-card p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <EnhancedTable
            mobileTable
            rowHeight={56}
            columns={columns}
            data={filteredItems}
            rowKey={r => r.id}
            pageCapacity={pageCapacity}
            searchable
            searchKeys={r => [r.name, r.cat]}
            searchPlaceholder="Search products…"
            onRowClick={openView}
            loading={itemsLoading}
            emptyTitle="No products found"
            emptyDesc="Add your first product to get started."
            showExport={false}
            extraControls={
              <div className="flex flex-wrap gap-2">
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  className={filterSelectClass}
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className={filterSelectClass}
                >
                  <option value="All">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            }
          />
        </div>
      </Card>

      {/* Add Modal */}
      <Modal busy={loading} open={addOpen} onClose={() => setAddOpen(false)}
        title="Add New Product" subtitle="Fill in the product details below"
        footer={formFooter("add")}>
        <ProductForm form={form} onChange={setForm} categories={categories} mode="add"/>
      </Modal>

      {/* Edit Modal */}
      <Modal busy={loading} open={editOpen} onClose={() => setEditOpen(false)}
        title="Edit Product" subtitle={selected?.name}
        footer={formFooter("edit")}>
        <ProductForm form={form} onChange={setForm} categories={categories} mode="edit"/>
      </Modal>

      <Modal busy={loading} open={restockOpen} onClose={() => setRestockOpen(false)} title="Restock Product" size="sm"
        footer={<><Btn variant="secondary" disabled={loading} onClick={() => setRestockOpen(false)}>Cancel</Btn>
          <Btn variant="primary" icon={<PackagePlus size={15}/>} onClick={handleRestock} disabled={loading}>{loading ? "Saving…" : "Add Stock"}</Btn></>}>
        <div className="space-y-4">
          <Field label="Product">
            <div className="relative">
              <input className={inputClass} style={inputStyle} type="search" value={restockQuery}
                role="combobox" aria-autocomplete="list" aria-expanded={restockMatches.length > 0}
                aria-controls={restockMatches.length > 0 ? "restock-products" : undefined}
                placeholder="Search products" onChange={event => { setRestockQuery(event.target.value); setSelected(null); }}/>
              {restockMatches.length > 0 && <div id="restock-products" role="listbox"
                className="mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-white" style={{borderColor:C.border}}>
                {restockMatches.map(item => <button key={item.id} type="button" role="option" aria-selected={false}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => { setSelected(item); setRestockQuery(item.name); }}>
                  <span className="min-w-0 truncate font-medium" style={{color:C.text}}>{item.name}</span>
                  <span className="shrink-0 text-xs" style={{color:C.muted}}>{item.stock} in stock</span>
                </button>)}
              </div>}
            </div>
          </Field>
          {selected && <div className="text-xs" style={{color:C.muted}}>{selected.cat} · {selected.stock} currently in stock</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Quantity to add"><input className={inputClass} style={inputStyle} type="number" min="0.01" step="0.01"
              value={restockForm.quantity} onChange={event => setRestockForm({...restockForm, quantity:event.target.value})}/></Field>
            <Field label="Expiry date"><input className={inputClass} style={inputStyle} type="date" min={today()}
              value={restockForm.expiry} onChange={event => setRestockForm({...restockForm, expiry:event.target.value})}/></Field>
          </div>
        </div>
      </Modal>

      {/* View Drawer */}
      <Drawer open={viewOpen} onClose={() => setViewOpen(false)}
        title="Product Details" subtitle="View full product information"
        size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setViewOpen(false)}>Close</Btn>
            <Btn variant="primary" onClick={() => { setViewOpen(false); selected && openEdit(selected); }}>
              Edit Product
            </Btn>
          </>
        }>
        {selected && <ProductDetail p={selected}/>}
      </Drawer>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        description={`Delete "${selected?.name}"? An unused product is removed permanently; one with stock or sales history is deactivated.`}
        confirmLabel="Delete Product"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
