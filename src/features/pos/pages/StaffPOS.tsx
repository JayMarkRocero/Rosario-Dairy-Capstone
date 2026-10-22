import { useState } from "react";
import { SaleComposer } from "@/features/sales/components/SaleComposer";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { toSale, type Sale } from "@/features/sales/api/sales.service";
export function StaffPOS() {
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  return <div className="w-full h-full min-h-0 min-w-0 flex flex-col overflow-hidden p-3 sm:p-4 lg:p-6 gap-3">
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden"><SaleComposer mode="checkout" onSuccess={sale => setCompletedSale(toSale(sale))}/></div>
    <TransactionDetails sale={completedSale} onClose={() => setCompletedSale(null)}/>
  </div>;
}
