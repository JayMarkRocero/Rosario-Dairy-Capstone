import { EnhancedTable, type Column } from '@/components/data-display/EnhancedTable';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { inventoryService, type ExpiredInventoryBatch } from '@/features/inventory/api/inventory.service';
import { useRef, useState, type ReactNode } from 'react';
import { Box, Eye, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/buttons/ActionButton';
import { Modal } from '@/components/overlays/Modal';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/errorHandling';

const expiredBadge = <span className="inline-flex whitespace-nowrap bg-red-50 text-red-600 font-medium px-2.5 py-1 rounded-full text-xs">Expired</span>;
const categoryBadge = (category: string) => <span className="inline-flex bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium">{category}</span>;
const itemTitle = (item: ExpiredInventoryBatch) => <div className="flex items-center gap-3 min-w-0">
  <span className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0"><Box size={16} aria-hidden="true" /></span>
  <div className="min-w-0"><span className="font-medium text-sm text-gray-900 break-words">{item.name}</span><p className="text-xs text-slate-500 mt-0.5">{item.kind === 'product' ? 'Product' : 'Ingredient'}</p></div>
</div>;

export function ExpiredBatchTable({ staff = false, category = 'All', extraControls }: {
  staff?: boolean; category?: string; extraControls: ReactNode;
}) {
  const query = useCachedQuery(`inventory:expired-batches:${staff}`, () => inventoryService.getExpiredBatches(staff), ['inventory']);
  const [details, setDetails] = useState<ExpiredInventoryBatch | null>(null);
  const [disposal, setDisposal] = useState<ExpiredInventoryBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const submissionLock = useRef(false);
  const dispose = async () => {
    if (!disposal || submissionLock.current) return;
    submissionLock.current = true;
    setSaving(true);
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
    }
  };
  const actions = (item: ExpiredInventoryBatch, mobile = false) => {
    const blocked = item.status !== 'available';
    const restriction = 'The current stock adjustment API does not allow disposal of batches already marked expired.';
    return <div className={mobile ? 'flex items-center gap-2 pt-2' : 'flex items-center justify-center gap-2'} onClick={event => event.stopPropagation()}>
      <ActionButton label={`View batch details: ${item.batch}`} onClick={() => setDetails(item)} disabled={saving} className={mobile ? 'h-11 w-11' : ''}><Eye size={13} /></ActionButton>
      <span title={blocked ? restriction : undefined}>
        <ActionButton label={`Dispose / write off batch: ${item.batch}`} destructive disabled={saving || blocked}
          onClick={() => setDisposal(item)} className={mobile ? 'h-11 w-11' : ''}><Trash2 size={13} /></ActionButton>
      </span>
      {mobile && blocked && <p className="text-xs text-slate-600">{restriction}</p>}
    </div>;
  };
  const columns: Column<ExpiredInventoryBatch>[] = [
    { key: 'name', header: 'Product / Ingredient', align: 'left', width: '22%', render: itemTitle },
    { key: 'category', header: 'Category', align: 'center', width: '14%', render: item => categoryBadge(item.category) },
    { key: 'batch', align: 'center', width: '14%', header: 'Batch', render: item => <span className="text-xs">{item.batch}</span> },
    { key: 'quantity', align: 'center', width: '14%', header: 'Remaining stock', render: item => <span className="text-sm">{item.quantity} {item.unit}</span> },
    { key: 'expiry', align: 'center', width: '14%', header: 'Expiry date', render: item => <span className="text-sm font-medium text-red-700">{item.expiry}</span> },
    { key: 'status', align: 'center', width: '10%', header: 'Status', render: () => expiredBadge },
    { key: 'actions', header: 'Actions', align: 'center', width: '12%', render: item => actions(item) },
  ];
  return <><EnhancedTable contentHeight pageSize={5} rowHeight={56} columns={columns}
    data={(query.data ?? []).filter(item => category === 'All' || item.category === category)} rowKey={item => item.key}
    searchable searchKeys={item => [item.name, item.batch, item.category]} searchPlaceholder="Search expired batches…"
    extraControls={extraControls} showExport={false} loading={query.loading}
    emptyTitle="No expired batches found" emptyDesc="No expired batches with remaining stock match your filters."
    renderMobileRow={item => <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">{itemTitle(item)}{expiredBadge}</div>
      {categoryBadge(item.category)}
      <p className="text-xs text-slate-600">Batch {item.batch}</p>
      <p className="text-sm">{item.quantity} {item.unit} remaining · Expired {item.expiry}</p>
      <p className="text-xs font-semibold text-red-700">Remove batch from active stock immediately.</p>
      {actions(item, true)}
    </div>} />
    <Modal open={!!details} onClose={() => setDetails(null)} title="Expired batch details" size="sm">
      {details && <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {[
          ['Item', details.name], ['Type', details.kind === 'product' ? 'Product' : 'Ingredient'],
          ['Batch', details.batch], ['Category', details.category], ['Expiry date', details.expiry],
          ['Remaining stock', `${details.quantity} ${details.unit}`], ['Initial stock', `${details.initialQuantity} ${details.unit}`],
          ['Unit cost', details.unitCost], ['Received', details.dateReceived], ['Grade', details.grade || 'Not specified'],
          ['Batch status', details.status], ['Notes', details.notes || 'None'],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words font-medium text-gray-900 mt-1">{value}</dd></div>)}
      </dl>}
    </Modal>
    <ConfirmDialog open={!!disposal} onClose={() => { if (!submissionLock.current) setDisposal(null); }}
      onConfirm={() => void dispose()} title="Dispose expired batch?" confirmLabel="Dispose / Write Off" loading={saving}
      description={disposal ? `Write off all ${disposal.quantity} ${disposal.unit} of ${disposal.name} (batch ${disposal.batch})? This records an expired-stock adjustment, sets remaining stock to 0, and marks the batch disposed. This cannot be undone here.` : ''} />
  </>;
}
