import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { customersService } from "@/features/customers/api/customers.service";
import type { Customer } from "@/features/customers/types/customer";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { ordersService } from "@/features/orders/api/orders.service";
import { C } from "@/styles/tokens/colors";

interface Props { open: boolean; onClose: () => void; onCreated: () => void }
type PaymentMethod = "cash" | "online";
type DiscountType = "none" | "percent" | "fixed";

export function CreateOrderModal({ open, onClose, onCreated }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([customersService.getAll(), inventoryService.getAll()])
      .then(([customerData, productData]) => { setCustomers(customerData); setProducts(productData.filter(product => product.stock > 0)); })
      .catch(() => toast.error("Failed to load order options."));
  }, [open]);

  const selectedItems = products.filter(product => (quantities[product.id] ?? 0) > 0);
  const suggestions = productSearch.trim()
    ? products.filter(product => !quantities[product.id] && product.name.toLowerCase().includes(productSearch.trim().toLowerCase())).slice(0, 8)
    : [];
  const subtotal = useMemo(() => selectedItems.reduce((sum, product) => sum + product.price * quantities[product.id], 0), [selectedItems, quantities]);
  const parsedDiscount = Number(discountValue) || 0;
  const calculatedDiscount = discountType === "percent"
    ? subtotal * parsedDiscount / 100
    : discountType === "fixed" ? parsedDiscount : 0;
  const discountAmount = Math.min(subtotal, calculatedDiscount);
  const total = subtotal - discountAmount;
  const setQuantity = (product: InventoryItem, quantity: number) => setQuantities(current => ({ ...current, [product.id]: Math.max(1, Math.min(quantity || 1, product.stock)) }));
  const selectProduct = (product: InventoryItem) => { setQuantity(product, 1); setProductSearch(""); };
  const removeProduct = (productId: number) => setQuantities(current => {
    const next = { ...current };
    delete next[productId];
    return next;
  });
  const hasValidCustomer = customers.some(customer => customer.id === Number(customerId));

  const registerCustomer = async () => {
    if (!newCustomer.name.trim()) { toast.error("Customer name is required."); return; }
    setLoading(true);
    try {
      const created = await customersService.createCustomer(newCustomer);
      setCustomers(current => [...current, created]);
      setCustomerId(String(created.id));
      setShowNewCustomer(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      toast.success("Customer registered.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to register customer."); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!customerId) { toast.error("Select a customer."); return; }
    if (!selectedItems.length) { toast.error("Add at least one product."); return; }
    if (parsedDiscount < 0 || (discountType === "percent" && parsedDiscount > 100)) { toast.error("Enter a valid discount value."); return; }
    const tendered = Number(amountTendered);
    if (paymentMethod === "cash" && (!amountTendered || tendered < total)) { toast.error("Amount tendered must cover the total."); return; }
    setLoading(true);
    try {
      const order = await ordersService.createOrder({
        customer_id: Number(customerId),
        items: selectedItems.map(product => ({ product_id: product.id, quantity: quantities[product.id] })),
        payment_method: paymentMethod,
        discount_type: discountType,
        discount_value: discountType === "none" ? 0 : parsedDiscount,
        amount_tendered: paymentMethod === "cash" ? tendered : null,
      });
      if (order.warning) toast.warning(order.warning);
      else toast.success("Order placed successfully.");
      setQuantities({}); setProductSearch(""); setCustomerId(""); setAmountTendered("");
      setShowDiscount(false); setDiscountType("none"); setDiscountValue(""); onCreated(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to place order."); }
    finally { setLoading(false); }
  };

  return <Modal open={open} onClose={onClose} title="Create Call-In Order" subtitle="Register the customer and select ordered products" size="lg"
    footer={<><Btn variant="secondary" onClick={onClose}>Close</Btn><Btn variant="primary" onClick={submit} disabled={loading || !selectedItems.length || !hasValidCustomer}>{loading ? "Placing…" : "Place Order"}</Btn></>}>
    <div className="space-y-5">
      <div><div className="flex justify-between items-center mb-1.5"><label className="text-xs font-semibold" style={{color:C.muted}}>Customer</label><button type="button" onClick={()=>setShowNewCustomer(value=>!value)} className="text-xs font-semibold" style={{color:C.blue}}>+ New Customer</button></div>
        <select value={customerId} onChange={event=>setCustomerId(event.target.value)} className="w-full px-3 py-2.5 rounded-xl border bg-gray-50 text-sm" style={{borderColor:C.border}}><option value="">Select customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
      {showNewCustomer&&<div className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl" style={{backgroundColor:C.bg}}>
        <input placeholder="Name" value={newCustomer.name} onChange={e=>setNewCustomer(v=>({...v,name:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <input placeholder="Phone" value={newCustomer.phone} onChange={e=>setNewCustomer(v=>({...v,phone:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <input placeholder="Email" value={newCustomer.email} onChange={e=>setNewCustomer(v=>({...v,email:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <Btn variant="secondary" size="sm" onClick={registerCustomer} disabled={loading}>Register Customer</Btn>
      </div>}
      <div>
        <label className="text-xs font-semibold block mb-2" style={{color:C.muted}}>Product Search / Select</label>
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-gray-50" style={{borderColor:C.border}}>
            <Search size={14} style={{color:C.muted}}/>
            <input value={productSearch} onChange={event=>setProductSearch(event.target.value)} placeholder="Search available products…" className="flex-1 bg-transparent outline-none text-sm"/>
          </div>
          {productSearch.trim()&&<div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white shadow-lg border" style={{borderColor:C.border}}>
            {suggestions.length?suggestions.map(product=><button key={product.id} type="button" onClick={()=>selectProduct(product)} className="w-full flex justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b last:border-0"><span className="text-sm font-medium truncate">{product.name}</span><span className="text-xs whitespace-nowrap" style={{color:C.muted}}>₱{product.price.toFixed(2)} · {product.stock} in stock</span></button>):<div className="px-3 py-4 text-sm text-center" style={{color:C.muted}}>No available products found.</div>}
          </div>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold block mb-2" style={{color:C.muted}}>Selected Products</label>
        {!selectedItems.length?<div className="py-6 px-3 rounded-xl border border-dashed text-sm text-center" style={{borderColor:C.border,color:C.muted}}>Search and select products above to add to this order</div>:<div className="max-h-56 overflow-y-auto rounded-xl border" style={{borderColor:C.border}}>{selectedItems.map(product=>{
          const quantity=quantities[product.id];
          return <div key={product.id} className="flex items-center gap-3 px-3 py-3 border-b last:border-0"><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{product.name}</div><div className="text-xs" style={{color:C.muted}}>₱{product.price.toFixed(2)} each</div></div><div className="flex items-center gap-1"><button type="button" onClick={()=>setQuantity(product,quantity-1)} disabled={quantity<=1} className="p-1.5 rounded-lg border disabled:opacity-40"><Minus size={12}/></button><input type="number" min="1" max={product.stock} value={quantity} onChange={event=>setQuantity(product,Number(event.target.value))} className="w-12 py-1 text-center text-sm rounded-lg border"/><button type="button" onClick={()=>setQuantity(product,quantity+1)} disabled={quantity>=product.stock} className="p-1.5 rounded-lg border disabled:opacity-40"><Plus size={12}/></button></div><span className="w-20 text-right text-sm font-semibold">₱{(product.price*quantity).toFixed(2)}</span><button type="button" onClick={()=>removeProduct(product.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{color:C.red}} aria-label={`Remove ${product.name}`}><Trash2 size={14}/></button></div>;
        })}</div>}
      </div>
      <div className="space-y-2 p-3 rounded-xl" style={{backgroundColor:C.bg}}>
        <div className="flex justify-between text-sm"><span style={{color:C.muted}}>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
        {discountAmount>0&&<div className="flex justify-between text-sm"><span style={{color:C.muted}}>Discount</span><span style={{color:C.green}}>−₱{discountAmount.toFixed(2)}</span></div>}
        <div className="flex justify-between font-bold pt-2 border-t"><span>Final Total</span><span style={{color:C.blue}}>₱{total.toFixed(2)}</span></div>
      </div>
      {!showDiscount?<button type="button" onClick={()=>setShowDiscount(true)} className="text-sm font-semibold text-left" style={{color:C.blue}}>+ Apply Discount</button>:<div className="grid grid-cols-2 gap-2 p-3 rounded-xl border" style={{borderColor:C.border}}>
        <select value={discountType} onChange={event=>setDiscountType(event.target.value as DiscountType)} className="px-3 py-2 rounded-lg border bg-gray-50 text-sm" style={{borderColor:C.border}}><option value="none">No Discount</option><option value="percent">Percent</option><option value="fixed">Fixed Amount</option></select>
        <input type="number" min="0" step="0.01" value={discountValue} onChange={event=>setDiscountValue(event.target.value)} disabled={discountType==="none"} placeholder="Discount value" className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50" style={{borderColor:C.border}}/>
        <button type="button" onClick={()=>{setShowDiscount(false);setDiscountType("none");setDiscountValue("");}} className="col-span-2 text-xs text-left" style={{color:C.muted}}>Remove discount</button>
      </div>}
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPaymentMethod("cash")} className="py-2.5 rounded-xl text-sm font-semibold border" style={{backgroundColor:paymentMethod==="cash"?C.navy:"white",color:paymentMethod==="cash"?"white":C.muted}}>Cash</button><button type="button" onClick={()=>setPaymentMethod("online")} className="py-2.5 rounded-xl text-sm font-semibold border" style={{backgroundColor:paymentMethod==="online"?C.navy:"white",color:paymentMethod==="online"?"white":C.muted}}>GCash / Online</button></div>
      {paymentMethod==="cash"&&<input type="number" min="0" step="0.01" value={amountTendered} onChange={e=>setAmountTendered(e.target.value)} placeholder="Amount tendered" className="w-full px-3 py-2.5 rounded-xl border text-sm"/>}
    </div>
  </Modal>;
}
