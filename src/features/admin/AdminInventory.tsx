import { useState, useMemo } from "react";
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
const EMPTY_FORM: FormState = { name:"", cat:"Milk", price:"", stock:"", expiry:"" };
const CATEGORIES = ["Milk","Cheese","Butter","Yogurt","Cream","Ice Cream"];
const STATUSES = ["Active", "Low Stock"];

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

function ProductForm({ form, onChange }: { form: FormState; onChange: (f: FormState) => void }) {
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
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
  const rows = [
    { label:"Product ID",    value:`PRD-${String(p.id).padStart(3,"0")}` },
    { label:"Name",          value: p.name     },
    { label:"Category",      value: p.cat      },
    { label:"Unit Price",    value:`₱${p.price}` },
    { label:"Stock Qty",     value: p.stock    },
    { label:"Expiry Date",   value: p.expiry   },
    { label:"FEFO Status",   value: p.low ? "Low Stock" : "Adequate" },
  ];
  return (
    <div className="space-y-5 p-6">
      <div
        className="rounded-2xl p-4 text-center"
        style={{ backgroundColor: C.blue + "08", border:`1px solid ${C.blue}20` }}
      >
        <div className="text-4xl mb-2">
          {p.cat==="Milk"?"🥛":p.cat==="Cheese"?"🧀":p.cat==="Butter"?"🧈":p.cat==="Yogurt"?"🍶":p.cat==="Ice Cream"?"🍨":"🍦"}
        </div>
        <div className="font-bold text-base" style={{ color:C.text,fontFamily:"Poppins,sans-serif" }}>{p.name}</div>
        <div className="mt-1"><StatusBadge status={p.low ? "Low" : "Active"}/></div>
      </div>
      <div className="space-y-5 p-6">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between py-2" style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm" style={{color:C.muted}}>{r.label}</span>
            <span className="text-sm font-semibold" style={{color:C.text}}>{r.value}</span>
          </div>
        ))}
      </div>
      {p.low && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
          style={{backgroundColor:C.orange+"15",color:C.orange,border:`1px solid ${C.orange}30`}}>
          <AlertTriangle size={14}/>
          <span>This product is below the minimum stock threshold.</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminInventory() {
  const items = inventoryService.getAll();

  const [catFilter,    setCatFilter]    = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addOpen,     setAddOpen]    = useState(false);
  const [editOpen,    setEditOpen]   = useState(false);
  const [deleteOpen,  setDeleteOpen] = useState(false);
  const [viewOpen,    setViewOpen]   = useState(false);
  const [selected,    setSelected]   = useState<InventoryItem | null>(null);
  const [form,        setForm]       = useState<FormState>(EMPTY_FORM);
  const [loading,     setLoading]    = useState(false);

  // ── Filtered data (category + status filters applied before the table's own search/sort/paginate) ──
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchesCat = catFilter === "All" || i.cat === catFilter;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Low Stock" ? i.low : !i.low);
      return matchesCat && matchesStatus;
    });
  }, [items, catFilter, statusFilter]);

  const openEdit = (p: InventoryItem) => {
    setSelected(p);
    setForm({ name:p.name, cat:p.cat, price:String(p.price), stock:String(p.stock), expiry:"2026-07-20" });
    setEditOpen(true);
  };
  const openDelete = (p: InventoryItem) => { setSelected(p); setDeleteOpen(true); };
  const openView   = (p: InventoryItem) => { setSelected(p); setViewOpen(true); };

  const handleSave = (mode: "add"|"edit") => {
    if (!form.name || !form.price || !form.stock) {
      toast.error("Please fill in all required fields."); return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      mode === "add" ? setAddOpen(false) : setEditOpen(false);
      setForm(EMPTY_FORM);
      toast.success(mode === "add" ? "Product added successfully!" : "Product updated successfully!");
    }, 800);
  };

  const handleDelete = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDeleteOpen(false);
      toast.success(`${selected?.name} removed from inventory.`);
    }, 600);
  };

  // ── Columns ────────────────────────────────────────────────────────────────
const columns: Column<InventoryItem>[] = [
    {
      key:"name", header:"Product", width:"26%",
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
      key:"price", header:"Price", align:"center", width:"12%",
      sortKey: r => r.price,
      render: r => <span className="font-semibold text-sm" style={{color:C.text}}>₱{r.price}</span>,
    },
    {
      key:"stock", header:"Stock", align:"center", width:"12%",
      sortKey: r => r.stock,
      render: r => (
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-semibold text-sm" style={{color:r.low?C.red:C.text}}>{r.stock}</span>
          {r.low && <AlertTriangle size={12} style={{color:C.orange}}/>}
        </div>
      ),
    },
    { key:"expiry", header:"Expiry", align:"center", width:"14%", sortKey: r => r.expiry,
      render: r => <span className="text-xs" style={{color:C.muted}}>{r.expiry}</span> },
    { key:"status", header:"Status", align:"center", width:"14%",
      render: r => <div className="flex justify-center"><StatusBadge status={r.low?"Low":"Active"}/></div> },
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
    <div className="flex flex-col min-h-full gap-4 p-4 sm:p-6 overflow-hidden">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 flex-shrink-0">
        {[
          { label:"Total Products",  value:"12",       color:C.blue   },
          { label:"Low Stock",       value:"4",        color:C.orange },
          { label:"Near Expiry",     value:"5",        color:C.red    },
          { label:"Total Value",     value:"₱187,400", color:C.green  },
        ].map(s => (
          <Card key={s.label} className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-2 h-10 rounded-full flex-shrink-0" style={{backgroundColor:s.color}}/>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg truncate" style={{color:s.color,fontFamily:"Poppins,sans-serif"}}>
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
            emptyTitle="No products found"
            emptyDesc="Add your first product to get started."
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
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
        <ProductForm form={form} onChange={setForm}/>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title="Edit Product" subtitle={selected?.name}
        footer={formFooter("edit")}>
        <ProductForm form={form} onChange={setForm}/>
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