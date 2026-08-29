import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;
    Promise.all([customersService.getAll(), inventoryService.getAll()])
      .then(([customerData, productData]) => { setCustomers(customerData); setProducts(productData.filter(product => product.stock > 0)); })
      .catch(() => toast.error("Failed to load order options."));
  }, [open]);

  const selectedItems = products.filter(product => (quantities[product.id] ?? 0) > 0);
  const total = useMemo(() => selectedItems.reduce((sum, product) => sum + product.price * quantities[product.id], 0), [selectedItems, quantities]);
  const setQuantity = (product: InventoryItem, quantity: number) => setQuantities(current => ({ ...current, [product.id]: Math.max(0, Math.min(quantity, product.stock)) }));

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
    const tendered = Number(amountTendered);
    if (paymentMethod === "cash" && (!amountTendered || tendered < total)) { toast.error("Amount tendered must cover the total."); return; }
    setLoading(true);
    try {
      const order = await ordersService.createOrder({
        customer_id: Number(customerId),
        items: selectedItems.map(product => ({ product_id: product.id, quantity: quantities[product.id] })),
        payment_method: paymentMethod,
        discount_type: "none",
        discount_value: 0,
        amount_tendered: paymentMethod === "cash" ? tendered : null,
      });
      if (order.warning) toast.warning(order.warning);
      else toast.success("Order placed successfully.");
      setQuantities({}); setCustomerId(""); setAmountTendered(""); onCreated(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to place order."); }
    finally { setLoading(false); }
  };

  return <Modal open={open} onClose={onClose} title="Create Call-In Order" subtitle="Register the customer and select ordered products" size="lg"
    footer={<><Btn variant="secondary" onClick={onClose}>Close</Btn><Btn variant="primary" onClick={submit} disabled={loading}>{loading ? "Placing…" : "Place Order"}</Btn></>}>
    <div className="space-y-5">
      <div><div className="flex justify-between items-center mb-1.5"><label className="text-xs font-semibold" style={{color:C.muted}}>Customer</label><button type="button" onClick={()=>setShowNewCustomer(value=>!value)} className="text-xs font-semibold" style={{color:C.blue}}>+ New Customer</button></div>
        <select value={customerId} onChange={event=>setCustomerId(event.target.value)} className="w-full px-3 py-2.5 rounded-xl border bg-gray-50 text-sm" style={{borderColor:C.border}}><option value="">Select customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
      {showNewCustomer&&<div className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl" style={{backgroundColor:C.bg}}>
        <input placeholder="Name" value={newCustomer.name} onChange={e=>setNewCustomer(v=>({...v,name:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <input placeholder="Phone" value={newCustomer.phone} onChange={e=>setNewCustomer(v=>({...v,phone:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <input placeholder="Email" value={newCustomer.email} onChange={e=>setNewCustomer(v=>({...v,email:e.target.value}))} className="px-3 py-2 rounded-lg border text-sm"/>
        <Btn variant="secondary" size="sm" onClick={registerCustomer} disabled={loading}>Register Customer</Btn>
      </div>}
      <div><label className="text-xs font-semibold block mb-2" style={{color:C.muted}}>Products</label><div className="max-h-56 overflow-y-auto rounded-xl border" style={{borderColor:C.border}}>{products.map(product=><div key={product.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0">
        <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{product.name}</div><div className="text-xs" style={{color:C.muted}}>₱{product.price.toFixed(2)} · {product.stock} available</div></div>
        <button type="button" onClick={()=>setQuantity(product,(quantities[product.id]??0)-1)} className="p-1 rounded border"><Minus size={12}/></button><span className="w-6 text-center text-sm font-semibold">{quantities[product.id]??0}</span><button type="button" onClick={()=>setQuantity(product,(quantities[product.id]??0)+1)} className="p-1 rounded border"><Plus size={12}/></button>
      </div>)}</div></div>
      <div className="flex justify-between font-bold"><span>Total</span><span style={{color:C.blue}}>₱{total.toFixed(2)}</span></div>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPaymentMethod("cash")} className="py-2.5 rounded-xl text-sm font-semibold border" style={{backgroundColor:paymentMethod==="cash"?C.navy:"white",color:paymentMethod==="cash"?"white":C.muted}}>Cash</button><button type="button" onClick={()=>setPaymentMethod("online")} className="py-2.5 rounded-xl text-sm font-semibold border" style={{backgroundColor:paymentMethod==="online"?C.navy:"white",color:paymentMethod==="online"?"white":C.muted}}>GCash / Online</button></div>
      {paymentMethod==="cash"&&<input type="number" min="0" step="0.01" value={amountTendered} onChange={e=>setAmountTendered(e.target.value)} placeholder="Amount tendered" className="w-full px-3 py-2.5 rounded-xl border text-sm"/>}
    </div>
  </Modal>;
}
