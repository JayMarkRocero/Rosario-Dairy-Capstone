import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { useEffect, useState } from "react";
import { Modal } from "@/components/overlays/Modal";
import { Skeleton } from "@/components/EmptyState";
import { Btn } from "@/components/buttons/Btn";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import type { Customer } from "../types/customer";
import { customersService } from "../api/customers.service";
import { toSale, type Sale } from "@/features/sales/api/sales.service";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { PaymentStatusBadge } from "@/features/sales/components/PaymentStatusBadge";
export function CustomerHistory({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const [paging, setPaging] = useState({ customerId: customer?.id, page: 1 });
  const [includeVoided, setIncludeVoided] = useState(false);
  const [selected, setSelected] = useState<{ customerId: number; sale: Sale } | null>(null);
  const page = paging.customerId === customer?.id ? paging.page : 1;
  const id = customer?.id;
  useEffect(() => { setPaging({ customerId: id, page: 1 }); setSelected(null); }, [id]);
  const query = useCachedQuery(`customers:history:${id}:${page}:${includeVoided}`, () => customersService.getTransactions(id!, page, includeVoided), ["customers", "sales"], !!id);
  if (!customer) return null;
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / 10));
  return <OverlayPortal><Modal open onClose={onClose} title={`${customer.name} · Purchase history`} subtitle="Recorded sales dates use Asia/Manila. Voided entries are excluded from customer summary counts." size="lg">
    <div className="space-y-4"><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeVoided} onChange={e => { setIncludeVoided(e.target.checked); setPaging({ customerId: id, page: 1 }); }}/>Include voided transactions</label>
      {query.error ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })}/> : query.loading ? <div role="status" aria-label="Loading purchase history" className="space-y-3">{[1,2,3].map(key => <Skeleton key={key} className="h-16 w-full"/>)}</div> : !query.data?.results.length ? <p className="py-8 text-center text-sm text-slate-500">No transactions recorded for this customer.</p> : <div className="space-y-2">{query.data.results.map(transaction => <button key={transaction.id} type="button" onClick={() => setSelected({ customerId: customer.id, sale: toSale(transaction) })} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"><div><div className="text-sm font-semibold text-slate-800">SI Number: {(transaction.transaction_number ?? transaction.source_invoice_number) || "Not recorded"}</div><div className="text-xs text-slate-500">{toSale(transaction).date} · {toSale(transaction).cashier}</div></div><div className="flex flex-wrap items-center gap-2"><PaymentStatusBadge status={transaction.payment_status}/>{transaction.is_voided && <span className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-600">Voided</span>}<span className="text-sm font-semibold">₱{Number(transaction.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div></button>)}</div>}
      {!query.error && !query.loading && <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">Page {page} of {pages} · {query.data?.count ?? 0} transactions</span><div className="flex gap-2"><Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPaging({ customerId: id, page: page - 1 })}>Previous</Btn><Btn variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPaging({ customerId: id, page: page + 1 })}>Next</Btn></div></div>}
    </div>
  </Modal><TransactionDetails sale={selected?.customerId === customer.id ? selected.sale : null} onClose={() => setSelected(null)}/></OverlayPortal>;
}
