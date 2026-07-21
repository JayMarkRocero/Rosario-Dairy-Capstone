import { useState, useMemo, useEffect } from "react";
import { Plus, Eye, Edit, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Card, StatusBadge, Btn, Modal, Drawer, ConfirmDialog, EnhancedTable,
} from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { inventoryService } from "../../services/inventory.service";
import type { InventoryItem } from "../../types/inventory";

// ─── Form ─────────────────────────────────────────────────────────────────────
interface FormState {
  name: string; cat: string; price: string; stock: string; expiry: string;
}
const EMPTY_FORM: FormState = { name:"", cat:"", price:"", stock:"", expiry:"" };
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
const inputStyle = { borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" };

// Compares expiry date against today. A product expiring "today" is not yet
// expired — it becomes expired starting the day after.
function isExpired(expiry: string): boolean {
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < today;
}

function daysUntilExpiry(expiry: string): number | null {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

function ProductForm({ form, onChange, categories }: {
  form: FormState;
  onChange: (f: FormState) => void;
  categories: { id: number; name: string }[];
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
      <Field label="Stock Quantity">
        <input className={inputClass} style={inputStyle} type="number" value={form.stock}
          onChange={set("stock")} placeholder="0"/>
      </Field>
      <Field label="Expiry Date">
        <input className={inputClass} style={inputStyle} type="date" value={form.expiry}
          onChange={set("expiry")}/>
      </Field>
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
    <div className="space-y-5 p-6">
      <div
        className="rounded-2xl p-4 text-center"
        style={{ backgroundColor: accentColor + "08", border:`1px solid ${accentColor}20` }}
      >
        <div className="text-4xl mb-2">
          {p.cat==="Milk"?"🥛":p.cat==="Cheese"?"🧀":p.cat==="Butter"?"🧈":p.cat==="Yogurt"?"🍶":p.cat==="Ice Cream"?"🍨":"🍦"}
        </div>
        <div className="font-bold text-base" style={{ color:C.text,fontFamily:"Poppins,sans-serif" }}>{p.name}</div>
        <div className="mt-1"><StatusBadge status={status}/></div>
      </div>
      <div className="space-y-5 p-6">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{r.label}</span>
            <span className="text-sm font-semibold" style={{color:C.text}}>{r.value}</span>
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  const loadItems = () => {
    setItemsLoading(true);
    inventoryService.getAll()
      .then(setItems)
      .catch(() => toast.error("Failed to load inventory."))
      .finally(() => setItemsLoading(false));
  };

  useEffect(() => {
    loadItems();
    inventoryService.getCategoriesRaw()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories."));
  }, []);

  const [catFilter,    setCatFilter]    = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addOpen,     setAddOpen]    = useState(false);
  const [editOpen,    setEditOpen]   = useState(false);
  const [deleteOpen,  setDeleteOpen] = useState(false);
  const [viewOpen,    setViewOpen]   = useState(false);
  const [selected,    setSelected]   = useState<InventoryItem | null>(null);
  const [form,        setForm]       = useState<FormState>(EMPTY_FORM);
  const [loading,     setLoading]    = useState(false);

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

  const handleSave = (mode: "add"|"edit") => {
    if (!form.name || !form.price || !form.stock || !form.cat) {
      toast.error("Please fill in all required fields."); return;
    }
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
        .catch(() => toast.error("Failed to add product."))
        .finally(() => setLoading(false));
    } else {
      if (!selected) { setLoading(false); return; }
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
        .catch(() => toast.error("Failed to update product."))
        .finally(() => setLoading(false));
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    setLoading(true);
    inventoryService.deleteProduct(selected.id)
      .then(() => {
        toast.success(`${selected.name} removed from inventory.`);
        setDeleteOpen(false);
        loadItems();
      })
      .catch(() => toast.error("Failed to delete product."))
      .finally(() => setLoading(false));
  };

  const columns: Column<InventoryItem>[] = [
    {
      key:"name", header:"Product", width:"24%",
      sortKey: r => r.name,
      render: r => (
        <div>
          <div className="font-semibold text-sm" style={{color:C.text}}>{r.name}</div>
          <div className="text-xs mt-0.5" style={{color:C.muted}}>PRD-{String(r.id).padStart(3,"0")}</div>
        </div>
      ),
    },
    {
      key:"cat", header:"Category", width:"12%",
      sortKey: r => r.cat,
      render: r => (
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{backgroundColor:C.blue+"15",color:C.blue}}>{r.cat}</span>
      ),
    },
    {
      key:"price", header:"Price", align:"center", width:"11%",
      sortKey: r => r.price,
      render: r => <span className="font-semibold text-sm" style={{color:C.text}}>₱{r.price}</span>,
    },
    {
      key:"stock", header:"Stock", align:"center", width:"11%",
      sortKey: r => r.stock,
      render: r => {
        const status = getStatus(r);
        const iconColor = status === "Expired" ? C.red : status === "Low" ? C.orange : status === "Near Expiry" ? "#F59E0B" : undefined;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-semibold text-sm" style={{color:status==="Expired"||status==="Low"?C.red:C.text}}>{r.stock}</span>
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
      key:"actions", header:"Actions", align:"center", width:"10%",
      render: r => (
        <div className="flex gap-1 justify-center" onClick={e => e.stopPropagation()}>
          <button onClick={() => openView(r)}
            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" style={{color:C.blue}}>
            <Eye size={13}/>
          </button>
          <button onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{color:C.muted}}>
            <Edit size={13}/>
          </button>
          <button onClick={() => openDelete(r)}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{color:C.red}}>
            <Trash2 size={13}/>
          </button>
        </div>
      ),
    },
  ];
  const formFooter = (mode: "add"|"edit") => (
    <>
      <Btn variant="secondary" onClick={() => mode==="add"?setAddOpen(false):setEditOpen(false)}>
        Cancel
      </Btn>
      <Btn variant="primary" onClick={() => handleSave(mode)} disabled={loading}>
        {loading ? "Saving…" : mode==="add" ? "Add Product" : "Save Changes"}
      </Btn>
    </>
  );

  return (
    <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Expiry-Based Inventory</h2>
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" icon={<Plus size={13}/>} fullWidth onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }}>
            Add Product
          </Btn>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-shrink-0">
        {[
          { label:"Total Products",  value:String(stats.totalProducts), color:C.blue   },
          { label:"Low Stock",       value:String(stats.lowStock),      color:C.orange },
          { label:"Near Expiry",     value:String(stats.nearExpiry),    color:"#f6c46d" },
          { label:"Expired",         value:String(stats.expired),       color:C.red    },
          { label:"Total Value",     value:`₱${stats.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, color:C.green  },
        ].map(s => (
          <Card key={s.label} className="p-3.5 flex items-center gap-2.5">
            <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
            <div className="min-w-0">
              <div className="font-bold text-xl leading-tight" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>
                {s.value}
              </div>
              <div className="text-xs truncate" style={{color:C.muted}}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <EnhancedTable
            columns={columns}
            data={filteredItems}
            rowKey={r => r.id}
            pageSize={4}
            searchable
            searchKeys={r => [r.name, r.cat]}
            searchPlaceholder="Search products…"
            onRowClick={openView}
            emptyTitle={itemsLoading ? "Loading inventory…" : "No products found"}
            emptyDesc={itemsLoading ? "Fetching data from the server." : "Add your first product to get started."}
            showExport={false}
            extraControls={
              <div className="flex flex-wrap gap-2">
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
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
      <Modal open={addOpen} onClose={() => setAddOpen(false)}
        title="Add New Product" subtitle="Fill in the product details below"
        footer={formFooter("add")}>
        <ProductForm form={form} onChange={setForm} categories={categories}/>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title="Edit Product" subtitle={selected?.name}
        footer={formFooter("edit")}>
        <ProductForm form={form} onChange={setForm} categories={categories}/>
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
        description={`Are you sure you want to remove "${selected?.name}" from inventory? This action cannot be undone.`}
        confirmLabel="Delete Product"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}