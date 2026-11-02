import { BatchDetailsFields } from "./BatchDetailsFields";
import { EnhancedTable, type Column } from '@/components/data-display/EnhancedTable';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { canDisposeExpiredBatch, inventoryService, type ExpiredInventoryBatch } from '@/features/inventory/api/inventory.service';
import { useRef, useState, type ReactNode } from 'react';
import { Box, Eye, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/buttons/ActionButton';
import { Modal } from '@/components/overlays/Modal';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/errorHandling';
import { QueryErrorMessage } from '@/components/feedback/QueryErrorMessage';
import { OverlayPortal } from '@/components/overlays/OverlayPortal';

const expiredBadge = <span className="inline-flex whitespace-nowrap bg-red-50 text-red-600 font-medium px-2.5 py-1 rounded-full text-xs">Expired</span>;
const categoryBadge = (category: string) => <span className="inline-flex max-w-full whitespace-normal [overflow-wrap:anywhere] bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium">{category}</span>;
const itemTitle = (item: ExpiredInventoryBatch) => <div className="flex items-center gap-3 min-w-0 whitespace-normal [overflow-wrap:anywhere]">
  <span className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0"><Box size={16} aria-hidden="true" /></span>
  <div className="min-w-0"><span className="font-medium text-sm text-slate-900 break-words">{item.name}</span><p className="text-xs text-slate-500 mt-0.5">Product</p></div>
</div>;

export function ExpiredBatchTable({ staff = false, category = 'All', extraControls, enabled = true, onBusyChange }: {
  staff?: boolean; category?: string; extraControls?: ReactNode; enabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const query = useCachedQuery(`inventory:expired-batches:${staff}`, () => inventoryService.getExpiredBatches(staff), ['inventory'], enabled);
  const [details, setDetails] = useState<ExpiredInventoryBatch | null>(null);
  const currentDetails = query.data?.find(batch => batch.id === details?.id);
  const [disposal, setDisposal] = useState<ExpiredInventoryBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const submissionLock = useRef(false);
  const dispose = async () => {
    if (!disposal || submissionLock.current) return;
    submissionLock.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      await inventoryService.disposeExpiredBatch(disposal);
      setDisposal(null);
      setDetails(null);
      toast.success('Expired stock written off and batch disposed.');
    } catch (error) {
      toastApiError(error, 'Unable to dispose this batch.');
    } finally {
      submissionLock.current = false;
      setSaving(false);
      onBusyChange?.(false);
    }
  };
  const actions = (item: ExpiredInventoryBatch, mobile = false) => {
    const blocked = !canDisposeExpiredBatch(item);
    const restriction = 'Only received, expired batches with remaining stock can be disposed.';
    return <div className={mobile ? 'flex items-center gap-2 pt-2' : 'flex flex-wrap items-center justify-center gap-2'} onClick={event => event.stopPropagation()}>
      <ActionButton label={`View batch details: ${item.batch}`} onClick={() => setDetails(item)} disabled={saving} className={mobile ? 'h-11 w-11' : ''}><Eye size={13} /></ActionButton>
      <span title={blocked ? restriction : undefined}>
        <ActionButton label={`Dispose / write off batch: ${item.batch}`} destructive disabled={saving || blocked}
          onClick={() => setDisposal(item)} className={mobile ? 'h-11 w-11' : ''}><Trash2 size={13} /></ActionButton>
      </span>
      {mobile && blocked && <p className="text-xs text-slate-600">{restriction}</p>}
    </div>;
  };
  const columns: Column<ExpiredInventoryBatch>[] = [
    { key: 'name', header: 'Product', align: 'left', width: '22%', render: itemTitle },
    { key: 'category', header: 'Category', align: 'center', width: '14%', render: item => categoryBadge(item.category) },
    { key: 'batch', align: 'center', width: '14%', header: 'Batch', render: item => <span className="block whitespace-normal text-xs [overflow-wrap:anywhere]">{item.batch}</span> },
    { key: 'quantity', align: 'center', width: '14%', header: 'Remaining stock', render: item => <span className="whitespace-normal text-sm">{item.quantity} {item.unit}</span> },
    { key: 'expiry', align: 'center', width: '14%', header: 'Expiry date', render: item => <span className="text-sm font-medium text-red-700">{item.expiry}</span> },
    { key: 'status', align: 'center', width: '10%', header: 'Status', render: () => expiredBadge },
    { key: 'actions', header: 'Actions', align: 'center', width: '12%', render: item => actions(item) },
  ];
  return <><div className="min-w-0 [&_th]:whitespace-normal">{!!(query.error || query.refreshError) && <QueryErrorMessage error={query.error || query.refreshError} onRetry={() => void query.refresh({ force: true })} />}
    {!query.error && <EnhancedTable contentHeight pageSize={5} rowHeight={56} columns={columns}
    data={(query.data ?? []).filter(item => category === 'All' || item.category === category)} rowKey={item => item.key}
    searchable searchKeys={item => [item.name, item.batch, item.category]} searchPlaceholder="Search expired batches…"
    extraControls={extraControls} showExport={false} loading={query.loading}
    emptyTitle="No expired batches found" emptyDesc="No expired batches with remaining stock match your filters."
    renderMobileRow={item => <div className="min-w-0 break-words rounded-lg border border-slate-200 bg-white shadow-sm p-3 space-y-2 [overflow-wrap:anywhere]">
      <div className="flex items-start justify-between gap-2">{itemTitle(item)}{expiredBadge}</div>
      {categoryBadge(item.category)}
      <p className="text-xs text-slate-600">Batch {item.batch}</p>
      <p className="text-sm">{item.quantity} {item.unit} remaining · Expired {item.expiry}</p>
      <p className="text-xs font-semibold text-red-700">Remove batch from active stock immediately.</p>
      {actions(item, true)}
    </div>} />}</div>
    <OverlayPortal><Modal open={!!details} onClose={() => setDetails(null)} title="Expired batch details" size="sm">
      {currentDetails ? <BatchDetailsFields batch={currentDetails} /> : <p role="status" className="text-sm text-slate-500">This batch is no longer available in the current expired inventory.</p>}
    </Modal></OverlayPortal>
    <OverlayPortal><ConfirmDialog open={!!disposal} onClose={() => { if (!submissionLock.current) setDisposal(null); }}
      onConfirm={() => void dispose()} title="Dispose expired batch?" confirmLabel="Dispose / Write Off" loading={saving}
      description={disposal ? `Write off all ${disposal.quantity} ${disposal.unit} of ${disposal.name} (batch ${disposal.batch})? This records an expired-stock adjustment, sets remaining stock to 0, and marks the batch disposed. This cannot be undone here.` : ''} /></OverlayPortal>
  </>;
}
