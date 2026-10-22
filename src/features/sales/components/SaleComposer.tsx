import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { acknowledgeUnconfirmedSale, hasUnconfirmedSale, UnconfirmedSaleError } from "@/lib/saleSubmission";
import { isDefiniteRequestFailure } from "../api/pendingRequest";
import { Skeleton } from "@/components/EmptyState";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage, type DjangoTransaction } from "@/lib/api";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { isExpiredProduct } from "@/features/inventory/utils/expiry";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { customersService } from "@/features/customers/api/customers.service";
import { CustomerPicker } from "@/features/customers/components/CustomerPicker";
import { CustomerHistory } from "@/features/customers/components/CustomerHistory";
import type { Customer } from "@/features/customers/types/customer";
import { checkoutService } from "@/features/pos/api/checkout.service";
import { ordersService } from "@/features/orders/api/orders.service";
import { encodingFingerprint, encodingService, type EncodingPayload } from "../api/encoding.service";
import { SaleLineEditor } from "./SaleLineEditor";
import { businessDate, newEncodingRequestId, formatCents, newSaleLine, priceSale, validateTender, type SaleLineDraft } from "../utils/manualPricing";

const input = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400";
export function SaleComposer({ mode, onSuccess, onBusyChange }: { mode: "checkout" | "order" | "encoding"; onSuccess: (sale: DjangoTransaction) => void; onBusyChange?: (busy: boolean) => void }) {
  const { user } = useAuth();
  const isCheckout = mode === "checkout";
  const canDiscount = mode !== "order" && user?.role === "admin";
  const savedEncoding = mode === "encoding" ? encodingService.pending()?.payload : undefined;
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [customerId, setCustomerId] = useState(() => savedEncoding?.payload.customer_id == null ? "" : String(savedEncoding.payload.customer_id));
  const [lines, setLines] = useState<SaleLineDraft[]>(() => savedEncoding?.lines ?? []);
  const [method, setMethod] = useState<"cash" | "online">(savedEncoding?.payload.payment_method ?? "cash");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">(savedEncoding?.payload.payment_status ?? (mode === "encoding" ? "pending" : "paid"));
  const [tender, setTender] = useState(savedEncoding?.payload.amount_tendered ?? "");
  const [date, setDate] = useState(() => savedEncoding?.payload.transaction_date ?? businessDate());
  const [si, setSi] = useState(savedEncoding?.payload.si_number ?? "");
  const [note, setNote] = useState(savedEncoding?.payload.note ?? "");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContact, setNewCustomerContact] = useState({ phone: "", email: "", address: "" });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [focusProductId, setFocusProductId] = useState<number | null>(null);
  const [mobilePane, setMobilePane] = useState<"products" | "cart">("products");
  const lock = useRef(false);
  const attempt = useRef<{ fingerprint: string; payload: EncodingPayload } | null>(savedEncoding ? { fingerprint: encodingFingerprint(savedEncoding.payload), payload: savedEncoding.payload } : null);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(undefined);
    Promise.all([inventoryService.getAll(user?.role === "staff"), customersService.getAll()])
      .then(([items, people]) => { if (active) { setProducts(items.filter(item => item.stock > 0 && !isExpiredProduct(item))); setCustomers(people); } })
      .catch(error => { if (active) setLoadError(error); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, user?.id, user?.role]);
  let totals: ReturnType<typeof priceSale> | null = null;
  try { totals = priceSale(lines, canDiscount); } catch { /* Show a draft summary until all lines are complete. */ }
  const selectedCustomer = customers.find(customer => customer.id === Number(customerId));
  let checkoutReady = false;
  try {
    if (isCheckout && totals && lines.every(line => Number(line.unitPrice) > 0) && (!customerId || selectedCustomer)) {
      if (method === "cash") validateTender(tender, totals.total);
      checkoutReady = true;
    }
  } catch { /* Incomplete prices or insufficient tender keep checkout disabled. */ }
  const unconfirmed = mode !== "encoding" && hasUnconfirmedSale(mode);
  const addProduct = (product: InventoryItem) => {
    if (lock.current) return;
    setLines(current => current.some(line => line.productId === product.id) ? current : [...current, newSaleLine(product)]);
    if (isCheckout) { setFocusProductId(product.id); setMobilePane("cart"); }
  };
  const submit = async () => {
    if (lock.current) return;
    if (mode !== "encoding" && hasUnconfirmedSale(mode)) {
      const message = new UnconfirmedSaleError(mode).message;
      setFormError(message); toast.error(message); return;
    }
    setFormError("");
    try {
      const priced = priceSale(lines, canDiscount);
      if (isCheckout && lines.some(line => Number(line.unitPrice) <= 0)) throw new Error("Enter a selling price greater than zero for every item.");
      if (mode === "order" && !selectedCustomer || customerId && !selectedCustomer) throw new Error("Select a valid customer.");
      const amount = paymentStatus === "paid" && method === "cash" ? validateTender(tender, priced.total) : null;
      if (mode === "encoding" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > businessDate())) throw new Error("Choose today or a past sales date.");
      const common = { customer_id: selectedCustomer?.id ?? null, payment_method: method, amount_tendered: amount, items: priced.items };
      lock.current = true; setBusy(true); onBusyChange?.(true);
      let transaction: DjangoTransaction;
      if (mode === "encoding") {
        const fields = { ...common, transaction_date: date, si_number: si.trim(), note: note.trim(), payment_status: paymentStatus };
        const fingerprint = encodingFingerprint(fields);
        if (attempt.current && attempt.current.fingerprint !== fingerprint) throw new Error("A submission was already attempted. Retry its original values, or check encoding history before starting a new entry.");
        if (!attempt.current) attempt.current = { fingerprint, payload: { ...fields, request_id: newEncodingRequestId() } };
        transaction = await encodingService.create(attempt.current.payload, lines);
      } else if (mode === "order") transaction = (await ordersService.createOrder({ ...common, customer_id: selectedCustomer!.id })).transaction;
      else transaction = (await checkoutService.submit(common)).transaction;
      attempt.current = null; setLines([]); setTender(""); setSi(""); setNote("");
      setReload(value => value + 1);
      toast.success(mode === "encoding" ? "Sales entry recorded." : "Transaction completed.");
      onSuccess(transaction);
    } catch (error) { if (isDefiniteRequestFailure(error)) attempt.current = null; const message = getApiErrorMessage(error, "Unable to save this transaction."); setFormError(message); toast.error(message); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const registerCustomer = async () => {
    if (lock.current || !newCustomerName.trim()) return;
    lock.current = true; setBusy(true); onBusyChange?.(true);
    try { const customer = await customersService.createCustomer({ name: newCustomerName.trim(), ...newCustomerContact }); setCustomers(current => [...current, customer]); setCustomerId(String(customer.id)); setNewCustomerOpen(false); setNewCustomerName(""); setNewCustomerContact({ phone: "", email: "", address: "" }); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const customerFields = <>
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><label className="block text-xs font-medium text-slate-600">Customer {mode !== "order" && "(optional)"}</label><CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} includeWalkIn={mode !== "order"} placeholder="Search customers" className="w-full px-3 py-2.5 rounded-lg"/></div>
        <Btn variant="secondary" size="sm" onClick={() => setNewCustomerOpen(value => !value)}>New customer</Btn>
        {selectedCustomer && <Btn variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>Purchase history</Btn>}
      </div>
      {newCustomerOpen && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3">
        <label className="text-xs font-medium text-slate-600">Customer name<input aria-label="New customer name" className={input} value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Full name"/></label>
        <label className="text-xs font-medium text-slate-600">Phone (optional)<input aria-label="New customer phone" className={input} value={newCustomerContact.phone} onChange={e => setNewCustomerContact({ ...newCustomerContact, phone: e.target.value })} placeholder="09XXXXXXXXX"/></label>
        <label className="text-xs font-medium text-slate-600">Email (optional)<input aria-label="New customer email" type="email" className={input} value={newCustomerContact.email} onChange={e => setNewCustomerContact({ ...newCustomerContact, email: e.target.value })} placeholder="name@example.com"/></label>
        <label className="text-xs font-medium text-slate-600">Address (optional)<input aria-label="New customer address" className={input} value={newCustomerContact.address} onChange={e => setNewCustomerContact({ ...newCustomerContact, address: e.target.value })} placeholder="Address"/></label>
        <div className="sm:col-span-2 flex justify-end"><Btn variant="secondary" onClick={registerCustomer}>Register customer</Btn></div>
      </div>}
  </>;
  const catalog = <section className="min-w-0 space-y-3">
    <div className="flex flex-col sm:flex-row gap-2"><input aria-label="Search available products" className={input} value={search} placeholder="Search available products" onChange={e => setSearch(e.target.value)}/><select aria-label="Product category" className={input} value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{[...new Set(products.map(product => product.cat))].sort().map(cat => <option key={cat}>{cat}</option>)}</select></div>
    <div className={isCheckout ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3" : "flex flex-wrap gap-2 max-h-40 overflow-y-auto"}>
      {products.filter(product => (category === "All" || product.cat === category) && product.name.toLowerCase().includes(search.toLowerCase())).map(product => <button key={product.id} type="button" disabled={lines.some(line => line.productId === product.id)} onClick={() => addProduct(product)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 disabled:bg-slate-50 disabled:opacity-50"><span title={product.name} className={`block ${isCheckout ? "truncate" : "break-words"} text-sm font-semibold text-slate-800`}>{product.name}</span><span className="block truncate text-xs text-slate-500">{product.stock} {product.unit || "units"} available</span><span className="text-xs text-blue-600">Add · enter price</span></button>)}
    </div>{!products.length && <p className="text-sm text-slate-500">No sellable products available.</p>}
  </section>;
  const cartItems = lines.map(line => <SaleLineEditor key={line.productId} line={line} canDiscount={canDiscount} compact={isCheckout} focusPrice={isCheckout && focusProductId === line.productId}
    onChange={next => setLines(current => current.map(item => item.productId === next.productId ? next : item))} onRemove={() => setLines(current => current.filter(item => item.productId !== line.productId))}/>);
  const summary = <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-sm"><div className="flex justify-between gap-2"><span>{mode === "order" ? "Subtotal" : "Gross subtotal"}</span><span>{totals ? formatCents(totals.subtotal) : "Not entered"}</span></div>{mode === "encoding" && <div className="flex justify-between gap-2"><span>Item discounts</span><span>{totals ? formatCents(totals.discount) : "Not entered"}</span></div>}<div className="flex justify-between gap-2 font-semibold"><span>Total</span><span>{totals ? formatCents(totals.total) : "Enter item prices"}</span></div></div>;
  const paymentFields = <div className={`grid ${isCheckout ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
        <label className="text-xs font-medium text-slate-600">Payment method<select aria-label="Payment method" className={input} value={method} onChange={e => { setMethod(e.target.value as typeof method); setTender(""); }}><option value="cash">Cash</option><option value="online">GCash / Online</option></select></label>
        {mode === "encoding" && <label className="text-xs font-medium text-slate-600">Payment status<select aria-label="Payment status" className={input} value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value as typeof paymentStatus); setTender(""); }}><option value="pending">Pending</option><option value="paid">Paid</option></select></label>}
        {method === "cash" && paymentStatus === "paid" && <label className="min-w-0 text-xs font-medium text-slate-600">Amount tendered (₱)<input aria-label="Amount tendered" className={input} type="number" min="0" step="0.01" placeholder="Cash received" value={tender} onChange={e => setTender(e.target.value)}
          onKeyDown={event => {
            if (!isCheckout || event.key !== "Enter" || event.nativeEvent?.isComposing || event.repeat) return;
            event.preventDefault();
            if (checkoutReady && !busy && !unconfirmed) void submit();
          }}/></label>}
  </div>;
  const errorMessage = formError && <p role="alert" className="break-words text-sm text-red-600">{formError}</p>;
  const actions = <div className={`flex flex-wrap justify-end gap-2 ${isCheckout ? "[&_button]:w-full" : ""}`}>
      {unconfirmed && !busy && <Btn variant="secondary" onClick={() => setReviewOpen(true)}>Review previous submission</Btn>}
      {mode === "encoding" && attempt.current && !busy && <Btn variant="secondary" onClick={() => setReviewOpen(true)}>Start a new entry</Btn>}
      <Btn variant="primary" disabled={busy || !lines.length || unconfirmed || isCheckout && !checkoutReady} onClick={submit}>{busy ? "Saving..." : mode === "encoding" ? "Save sales entry" : mode === "order" ? "Submit & Fulfill" : "Complete Transaction"}</Btn>
  </div>;
  if (loadError) return <QueryErrorMessage error={loadError} onRetry={() => setReload(value => value + 1)}/>;
  if (loading) return <div role="status" aria-label="Loading sales options" className="space-y-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-40 w-full"/></div>;
  return <div className={isCheckout ? "h-full min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden" : "min-w-0 space-y-4"}>
    {isCheckout ? <fieldset disabled={busy} data-pos-workspace className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden disabled:opacity-70 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_auto]">
      <div className="flex shrink-0 gap-2 lg:hidden" role="group" aria-label="POS panels">
        <button type="button" aria-pressed={mobilePane === "products"} onClick={() => setMobilePane("products")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mobilePane === "products" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>Products</button>
        <button type="button" aria-pressed={mobilePane === "cart"} onClick={() => setMobilePane("cart")} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mobilePane === "cart" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>Cart ({lines.length})</button>
      </div>
      <div data-pos-catalog className={`${mobilePane === "products" ? "block" : "hidden"} min-h-0 min-w-0 overflow-y-auto pr-1 space-y-3 lg:block lg:col-start-1 lg:row-start-1 lg:row-span-2`}>
        {customerFields}{catalog}
      </div>
      <section id="sale-cart" data-pos-cart className={`${mobilePane === "cart" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col gap-3 overflow-hidden lg:flex lg:col-start-2 lg:row-start-1`}>
        <div className="flex shrink-0 items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Current order · {lines.length} items</h3>
          <button type="button" disabled={busy || !lines.length || unconfirmed} onClick={() => setClearOpen(true)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Clear All</button>
        </div>
        <div data-pos-cart-items className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-2">
          {lines.length ? cartItems : <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500"><ShoppingCart size={32} aria-hidden="true"/><p>Cart is empty. Click products on the left to add items.</p></div>}
        </div>
      </section>
      <section data-pos-checkout className="min-w-0 shrink-0 border-t border-slate-200 bg-white pt-3 space-y-2 lg:col-start-2 lg:row-start-2">
        {summary}{paymentFields}{errorMessage}{actions}
      </section>
    </fieldset> : <>
      {mode === "encoding" && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Past sales deduct current stock from batches that expire first (FEFO). The sales date and actual entry time are recorded separately. Pending entries also deduct stock and count as sales.</div>}
      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-70">
        {mode === "encoding" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">Sales date<input className={input} type="date" aria-label="Sales date" max={businessDate()} value={date} onChange={e => setDate(e.target.value)}/></label>
          <label className="text-xs font-medium text-slate-600">SI number (optional)<input className={input} aria-label="SI number" maxLength={50} placeholder="e.g. SI0608" value={si} onChange={e => setSi(e.target.value)}/></label>
          <p className="text-xs text-slate-500 sm:col-span-2">Recorded by {user?.username}. The server records your identity and actual entry time.</p>
        </div>}
        {customerFields}
        <div className="space-y-4">{catalog}<section id="sale-cart" className="min-w-0 space-y-3"><p className="text-xs text-slate-500">For complimentary items or tasting samples, use Inventory &gt; Stock outflows.</p><h3 className="text-sm font-semibold text-slate-900">Selected products</h3>
          {!lines.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Choose products, then enter the selling price for every line.</p>}
          {cartItems}{summary}
        </section></div>
        {paymentFields}
        {mode === "encoding" && <label className="block text-xs font-medium text-slate-600">Notes (optional)<textarea aria-label="Encoding notes" maxLength={2000} className={input} placeholder="Reference or reason for this entry" value={note} onChange={e => setNote(e.target.value)}/></label>}
      </fieldset>
      {errorMessage}
      {attempt.current && !busy && <p className="text-xs text-amber-700">Your previous entry is restored. Retry it unchanged with the same request ID to avoid duplicate records. Check encoding history before starting another entry.</p>}
      {actions}
    </>}
    <CustomerHistory customer={historyOpen ? selectedCustomer ?? null : null} onClose={() => setHistoryOpen(false)}/>
    <OverlayPortal><ConfirmDialog open={reviewOpen} onClose={() => setReviewOpen(false)} variant="warning" title="Have you checked transaction history?"
      description="An interrupted request may already have recorded the sale and deducted stock. Check Orders and Sales History before continuing. Start a new transaction only after confirming whether the previous one was recorded."
      confirmLabel="History checked — start new transaction" onConfirm={() => {
        if (lock.current) return;
        if (mode !== "encoding") acknowledgeUnconfirmedSale(mode);
        else { encodingService.clearPending(); attempt.current = null; setSi(""); setNote(""); }
        setReviewOpen(false); setLines([]); setTender(""); setFormError(""); setReload(value => value + 1);
      }} /></OverlayPortal>
    {isCheckout && <OverlayPortal><ConfirmDialog open={clearOpen} loading={busy} onClose={() => { if (!lock.current) setClearOpen(false); }} title="Clear all cart items?"
      description={`Remove all ${lines.length} items from this cart? No sale will be recorded and stock will not change.`} confirmLabel="Clear All" variant="warning"
      onConfirm={() => {
        if (lock.current || hasUnconfirmedSale("checkout")) return;
        setLines([]); setTender(""); setFormError(""); setFocusProductId(null); setMobilePane("products"); setClearOpen(false);
      }}/></OverlayPortal>}
  </div>;
}
