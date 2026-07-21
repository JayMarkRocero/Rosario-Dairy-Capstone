import { useState, useEffect } from "react";
import { Search, ShoppingCart, AlertTriangle, Banknote, Smartphone, Printer, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components";
import { C } from "../../../constants/colors";
import { inventoryService } from "../../../services/inventory.service";
import { checkoutService } from "../../../services/checkout.service";
import type { InventoryItem } from "../../../types/inventory";

type PayMethod  = "Cash" | "GCash";
interface CartItem { id:number; name:string; price:number; qty:number; stock:number }

const EMOJI: Record<string,string> = {
  Milk:"🥛", Cheese:"🧀", Butter:"🧈", Yogurt:"🍶", "Ice Cream":"🍨", Cream:"🍦",
};

const LOW_STOCK_THRESHOLD = 20;

const money = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ cart, total, subtotal, payment, change, onClose, onConfirm, loading }:{
  cart:CartItem[]; total:number; subtotal:number;
  payment:PayMethod; change:number;
  onClose:()=>void; onConfirm:()=>void; loading:boolean;
}) {
  const now = new Date();
  return (
    <Modal open onClose={onClose} title="Receipt Preview" subtitle="Review before completing transaction" size="sm"
      footer={<>
        <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          style={{border:`1px solid ${C.border}`,color:C.muted}}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{backgroundColor:C.green}}>
          <Check size={14}/> {loading ? "Processing…" : "Complete Transaction"}
        </button>
      </>}>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center py-3">
          <div className="font-bold text-lg" style={{color:C.navy,fontFamily:"Poppins,sans-serif"}}>Rosario Dairy</div>
          <div className="text-xs" style={{color:C.muted}}>123 Dairy Road, Quezon City</div>
          <div className="text-xs mt-1" style={{color:C.muted}}>
            {now.toLocaleDateString("en-PH",{dateStyle:"full"})} · {now.toLocaleTimeString("en-PH",{timeStyle:"short"})}
          </div>
        </div>
        {/* Items */}
        <div className="space-y-1 py-3" style={{borderTop:`1px dashed ${C.border}`,borderBottom:`1px dashed ${C.border}`}}>
          {cart.map(item=>(
            <div key={item.id} className="flex justify-between text-xs">
              <span style={{color:C.text}}>{item.name} × {item.qty}</span>
              <span className="font-semibold" style={{color:C.text}}>₱{money(item.price*item.qty)}</span>
            </div>
          ))}
        </div>
        {/* Totals */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span style={{color:C.muted}}>Subtotal</span>
            <span style={{color:C.text}}>₱{money(subtotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1" style={{borderTop:`1px solid ${C.border}`}}>
            <span style={{color:C.text}}>TOTAL</span>
            <span style={{color:C.blue}}>₱{money(total)}</span>
          </div>
          {payment==="Cash"&&change>0&&(
            <div className="flex justify-between font-semibold pt-1" style={{color:C.green}}>
              <span>Change</span><span>₱{money(change)}</span>
            </div>
          )}
        </div>
        {/* Payment */}
        <div className="text-center text-xs py-2 rounded-xl"
          style={{backgroundColor:C.green+"10",color:C.green}}>
          Payment: <strong>{payment}</strong>
        </div>
        <div className="text-center text-xs" style={{color:C.muted}}>Thank you for your purchase!</div>
      </div>
    </Modal>
  );
}

// ─── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({ prod, qtyInCart, onAdd }:{
  prod: InventoryItem; qtyInCart: number; onAdd: () => void;
}) {
  const isLow = prod.stock > 0 && prod.stock <= LOW_STOCK_THRESHOLD;
  const isOut = prod.stock === 0;
  const isMaxed = qtyInCart >= prod.stock;

  return (
    <button
      onClick={onAdd}
      disabled={isOut || isMaxed}
      className="relative flex flex-col bg-white rounded-2xl p-3.5 sm:p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed"
      style={{ border: `1px solid ${C.border}`, opacity: (isOut || isMaxed) ? 0.5 : 1, minHeight: 150 }}
    >
      {qtyInCart > 0 && (
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3">
          <span
            className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shadow-sm"
            style={{ backgroundColor: C.blue }}
          >
            {qtyInCart}
          </span>
        </div>
      )}

      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl sm:text-2xl mb-2.5 sm:mb-3"
        style={{ backgroundColor: C.blue + "10" }}>
        {EMOJI[prod.cat] ?? "📦"}
      </div>

      <div
        className="font-semibold text-xs sm:text-sm leading-snug mb-1.5 sm:mb-2 flex-1"
        style={{
          color: C.text,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {prod.name}
      </div>

      <div className="font-bold text-sm sm:text-base mb-1 sm:mb-1.5" style={{ color: C.blue, fontFamily: "Poppins, sans-serif" }}>
        ₱{money(prod.price)}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: isLow ? C.orange : C.muted }}>
          {prod.stock} left
        </span>
        {isLow && (
          <span
            className="hidden sm:flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: C.orange + "15", color: C.orange }}
          >
            <AlertTriangle size={10} /> Low
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Cart Contents (shared between desktop panel and mobile sheet) ────────────
function CartContents({
  cart, total, subtotal, payMethod, setPayMethod, cashReceived, setCash, change,
  updateQty, clearCart, onComplete,
}: {
  cart: CartItem[]; total: number; subtotal: number;
  payMethod: PayMethod; setPayMethod: (m: PayMethod) => void;
  cashReceived: string; setCash: (v: string) => void; change: number;
  updateQty: (id: number, delta: number) => void; clearCart: () => void;
  onComplete: () => void;
}) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            Order Items
          </div>
          {cart.length>0&&(
            <button onClick={clearCart} className="text-xs font-medium hover:opacity-70" style={{ color: C.red }}>
              Clear
            </button>
          )}
        </div>
        {cart.length===0?(
          <div className="flex flex-col items-center justify-center gap-3 py-12" style={{color:C.muted}}>
            <ShoppingCart size={40} style={{opacity:0.2}}/>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: C.text }}>No items yet</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>Select products to begin an order.</p>
            </div>
          </div>
        ):(
          <div className="space-y-3">
            {cart.map(item=>(
              <div key={item.id} className="flex items-center gap-3 pb-3" style={{borderBottom:`1px solid ${C.border}`}}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{color:C.text}}>{item.name}</div>
                  <div className="text-xs mt-0.5" style={{color:C.muted}}>₱{money(item.price)} × {item.qty}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>updateQty(item.id,-1)}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 text-sm font-bold"
                    style={{border:`1px solid ${C.border}`,color:C.muted}}>−</button>
                  <span className="w-5 text-center text-xs font-bold" style={{color:C.text}}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} disabled={item.qty >= item.stock}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center hover:bg-blue-50 text-sm font-bold disabled:opacity-30"
                    style={{border:`1px solid ${C.border}`,color:C.blue}}>+</button>
                </div>
                <div className="text-xs font-bold w-16 text-right" style={{color:C.text}}>
                  ₱{money(item.price*item.qty)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-2 flex-shrink-0" style={{borderTop:`1px solid ${C.border}`}}>
        <div className="flex justify-between font-bold text-base pt-2"
          style={{color:C.text}}>
          <span>Total</span>
          <span style={{color:C.blue}}>₱{money(total)}</span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-1 space-y-3 flex-shrink-0">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          Payment Method
        </div>
        <div className="flex gap-2">
          {(["Cash","GCash"] as PayMethod[]).map(m=>(
            <button key={m} onClick={()=>setPayMethod(m)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              style={{backgroundColor:payMethod===m?C.navy:"transparent",color:payMethod===m?"#fff":C.muted,
                border:`1px solid ${payMethod===m?C.navy:C.border}`}}>
              {m==="Cash"?<Banknote size={12}/>:<Smartphone size={12}/>}{m}
            </button>
          ))}
        </div>

        {payMethod==="Cash"&&(
          <div className="space-y-2">
            <input type="number" step="0.01" placeholder="Cash received" value={cashReceived}
              onChange={e=>setCash(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border"
              style={{borderColor:C.border,color:C.text}}/>
            {cashReceived&&(
              <div className="flex justify-between text-xs px-1">
                <span style={{color:C.muted}}>Change</span>
                <span className="font-bold" style={{color:C.green}}>₱{money(change)}</span>
              </div>
            )}
          </div>
        )}

        <button onClick={onComplete}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
          style={{backgroundColor:cart.length>0?C.blue:C.border}}>
          <Printer size={14}/> Review & Complete
        </button>
      </div>
    </>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────
export function StaffPOS() {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    setProductsLoading(true);
    inventoryService.getAll()
      .then(setProducts)
      .catch(() => toast.error("Failed to load products."))
      .finally(() => setProductsLoading(false));
  }, []);

  const [cart,         setCart]       = useState<CartItem[]>([]);
  const [category,     setCategory]   = useState("All");
  const [search,       setSearch]     = useState("");
  const [payMethod,    setPayMethod]  = useState<PayMethod>("Cash");
  const [cashReceived, setCash]       = useState("");
  const [receiptOpen,  setReceiptOpen]= useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const categories = ["All",...Array.from(new Set(products.map(p=>p.cat)))];
  const filtered = products.filter(p=>
    (category==="All"||p.cat===category) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (prod:InventoryItem) => {
    setCart(prev=>{
      const ex = prev.find(i=>i.id===prod.id);
      if (ex) {
        if (ex.qty >= prod.stock) return prev;
        return prev.map(i=>i.id===prod.id?{...i,qty:i.qty+1}:i);
      }
      return [...prev,{id:prod.id,name:prod.name,price:prod.price,qty:1,stock:prod.stock}];
    });
  };
  const updateQty = (id:number,delta:number) =>
    setCart(prev=>prev.map(i=>{
      if (i.id !== id) return i;
      const nextQty = i.qty + delta;
      return { ...i, qty: Math.min(nextQty, i.stock) };
    }).filter(i=>i.qty>0));

  const subtotal = cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const total    = subtotal; // no tax — matches backend, which applies no tax at all
  const cashValue = parseFloat(cashReceived);
  const change   = payMethod==="Cash" && cashReceived && !isNaN(cashValue)
    ? Math.max(0, cashValue - total)
    : 0;
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const handleComplete = () => {
    if (cart.length===0) { toast.error("Cart is empty."); return; }
    if (payMethod === "Cash" && (!cashReceived || isNaN(cashValue) || cashValue < total)) {
      toast.error("Cash received must be at least the total amount.");
      return;
    }
    setMobileCartOpen(false);
    setReceiptOpen(true);
  };

  const handleConfirmTransaction = () => {
    setSubmitting(true);
    checkoutService.submit({
      items: cart.map(i => ({ productId: i.id, quantity: i.qty })),
      paymentMethod: payMethod,
      amountTendered: payMethod === "Cash" ? cashValue : undefined,
    })
      .then((result) => {
        setReceiptOpen(false);
        setCart([]);
        setCash("");
        toast.success(`Transaction complete! ₱${money(result.totalAmount)} received.`);
        inventoryService.getAll().then(setProducts).catch(() => {});
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden relative" style={{ backgroundColor: "#F7F8FA" }}>
      {/* ── Products (full width on mobile, flex-1 on desktop) ── */}
      <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-6 gap-3 sm:gap-4 min-w-0">
        <div
          className="flex items-center gap-3 bg-white rounded-full px-4 sm:px-5 py-3 sm:py-3.5 border transition-all duration-200"
          style={{
            borderColor: searchFocused ? C.blue : C.border,
            boxShadow: searchFocused ? `0 0 0 3px ${C.blue}15` : "none",
          }}
        >
          <Search size={16} style={{ color: searchFocused ? C.blue : C.muted }} />
          <input
            className="bg-transparent outline-none text-sm flex-1"
            placeholder="Search products…"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{ color: C.text }}
          />
        </div>

        <div className="flex gap-2 sm:gap-2.5 flex-wrap">
          {categories.map(cat=>(
            <button key={cat} onClick={()=>setCategory(cat)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all duration-150 hover:opacity-80"
              style={{backgroundColor:category===cat?C.blue:C.white,color:category===cat?"#fff":C.muted,
                border:`1px solid ${category===cat?C.blue:C.border}`}}>
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 py-1 pb-20 lg:pb-1">
          {productsLoading ? (
            <p className="text-sm text-center py-10" style={{color:C.muted}}>Loading products…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5">
              {filtered.map(prod=>{
                const inCart = cart.find(i=>i.id===prod.id);
                return (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    qtyInCart={inCart?.qty ?? 0}
                    onAdd={() => addToCart(prod)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop cart panel (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-col bg-white shadow-xl flex-shrink-0 h-full overflow-hidden"
        style={{width:360,borderLeft:`1px solid ${C.border}`}}>
        <div className="px-5 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${C.border}`}}>
          <h3 className="font-bold text-base" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>Current Order</h3>
        </div>
        <CartContents
          cart={cart} total={total} subtotal={subtotal}
          payMethod={payMethod} setPayMethod={setPayMethod}
          cashReceived={cashReceived} setCash={setCash} change={change}
          updateQty={updateQty} clearCart={()=>setCart([])} onComplete={handleComplete}
        />
      </div>

      {/* ── Mobile floating "View Cart" button ── */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between px-5 py-4 rounded-2xl text-white font-bold shadow-2xl"
          style={{ backgroundColor: C.blue }}
        >
          <span className="flex items-center gap-2 text-sm">
            <ShoppingCart size={18}/>
            {cartCount} item{cartCount !== 1 ? "s" : ""}
          </span>
          <span className="text-sm">₱{money(total)}</span>
        </button>
      )}

      {/* ── Mobile cart bottom sheet ── */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{borderBottom:`1px solid ${C.border}`}}>
              <h3 className="font-bold text-base" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>Current Order</h3>
              <button onClick={() => setMobileCartOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:C.muted}}>
                <X size={18}/>
              </button>
            </div>
            <div className="flex flex-col overflow-hidden" style={{ maxHeight: "calc(85vh - 60px)" }}>
              <CartContents
                cart={cart} total={total} subtotal={subtotal}
                payMethod={payMethod} setPayMethod={setPayMethod}
                cashReceived={cashReceived} setCash={setCash} change={change}
                updateQty={updateQty} clearCart={()=>setCart([])} onComplete={handleComplete}
              />
            </div>
          </div>
        </div>
      )}

      {receiptOpen&&(
        <ReceiptModal cart={cart} total={total} subtotal={subtotal}
          payment={payMethod} change={change} loading={submitting}
          onClose={()=>!submitting && setReceiptOpen(false)} onConfirm={handleConfirmTransaction}/>
      )}
    </div>
  );
}