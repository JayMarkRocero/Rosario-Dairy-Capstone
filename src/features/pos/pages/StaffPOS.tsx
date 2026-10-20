import { useState } from "react";
import { SaleComposer } from "@/features/sales/components/SaleComposer";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { toSale, type Sale } from "@/features/sales/api/sales.service";
export function StaffPOS() {
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  return <div className="w-full p-4 sm:p-6 pb-24 xl:pb-6 space-y-4">
    <div><h2 className="text-lg font-semibold text-slate-700">Point of Sale</h2><p className="text-xs text-slate-500">Choose products and enter selling prices for this transaction.</p></div>
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm"><SaleComposer mode="checkout" onSuccess={sale => setCompletedSale(toSale(sale))}/></div>
    <TransactionDetails sale={completedSale} onClose={() => setCompletedSale(null)}/>
  </div>;
}
