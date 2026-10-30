import { BatchDetailsFields } from "./BatchDetailsFields";
import { currentInventoryRecord, currentBatchRecord } from "../utils/currentRecord";
import { EnhancedTable, type Column } from '@/components/data-display/EnhancedTable';
import { canDisposeExpiredBatch, inventoryService, type ExpiredInventoryBatch } from '@/features/inventory/api/inventory.service';
import { useRef, useState, type ComponentProps } from 'react';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/buttons/ActionButton';
import { Modal } from '@/components/overlays/Modal';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/errorHandling';
import type { InventoryItem } from '@/features/inventory/types/inventory';
import { MobileInventoryCard } from './MobileInventoryCard';
import { StaffInventoryCard } from './StaffInventoryCard';

type Props = ComponentProps<typeof EnhancedTable<InventoryItem>> & { readOnly?: boolean };

export function ProductTable(props: Props) {
  const [productDetails, setProductDetails] = useState<InventoryItem | null>(null);
  const [editBatch, setEditBatch] = useState<ExpiredInventoryBatch | null>(null);
  const [editDraft, setEditDraft] = useState({ price: '', notes: '' });
  const openBatchEdit = (item: ExpiredInventoryBatch) => { setEditBatch(item); setEditDraft({ price: item.unitCost ?? "", notes: item.notes || '' }); };
  const [details, setDetails] = useState<ExpiredInventoryBatch | null>(null);
  const currentProduct = currentInventoryRecord(props.data, productDetails);
  const currentBatch = currentBatchRecord(props.data, details);
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
  const saveBatch = async () => {
    if (!editBatch || submissionLock.current) return;
    const parsedPrice = editDraft.price.trim() ? Number(editDraft.price) : null;
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) { toast.error('Enter a valid nonnegative inventory cost.'); return; }
    submissionLock.current = true; setSaving(true);
    try {
      const update = inventoryService.updateProductBatch;
      await update(editBatch.id, { unit_price: parsedPrice, notes: editDraft.notes });
      setEditBatch(null); toast.success('Batch updated.');
    } catch (error) { toastApiError(error, 'Unable to update this batch.'); }
    finally { submissionLock.current = false; setSaving(false); }
  };
  const actions = (item: ExpiredInventoryBatch, mobile = false) => {
    const blocked = !canDisposeExpiredBatch(item);
    const restriction = 'Only received, expired batches with remaining stock can be disposed.';
    return <div className={mobile ? 'flex items-center gap-2 pt-2' : 'flex items-center justify-center gap-2'} onClick={event => event.stopPropagation()}>
      <ActionButton label={`View batch details: ${item.batch}`} onClick={() => setDetails(item)} disabled={saving} className={mobile ? 'h-11 w-11 border border-slate-200' : 'border border-slate-200'}><Eye size={13} /></ActionButton>
      <ActionButton label={`Edit batch: ${item.batch}`} disabled={saving} onClick={() => openBatchEdit(item)} className={mobile ? 'h-11 w-11 border border-slate-200' : 'border border-slate-200'}><Edit size={13} /></ActionButton>
      <span title={blocked ? restriction : undefined}>
        <ActionButton label={`Dispose / write off batch: ${item.batch}`} destructive disabled={saving || blocked}
          onClick={() => setDisposal(item)} className={mobile ? 'h-11 w-11 border border-slate-200' : 'border border-slate-200'}><Trash2 size={13} /></ActionButton>
      </span>
      {mobile && blocked && <p className="text-xs text-slate-600">{restriction}</p>}
    </div>;
  };
  const view = (item: InventoryItem) => item.expiredBatch ? setDetails(item.expiredBatch) : props.onRowClick ? props.onRowClick(item) : setProductDetails(item);
  const columns: Column<InventoryItem>[] = props.columns.map(column => column.key === 'actions' ? {
    ...column, render: (item, index) => props.readOnly ? <ActionButton label="View details" onClick={() => view(item)} className="border border-slate-200"><Eye size={13} /></ActionButton> : item.expiredBatch ? actions(item.expiredBatch) : <div className="[&_button]:border [&_button]:border-slate-200">{column.render?.(item, index)}</div>,
  } : column);
  if (!columns.some(column => column.key === 'actions')) columns.push({ key: 'actions', header: 'Actions', align: 'center', width: '12%', render: item => item.expiredBatch && !props.readOnly ? actions(item.expiredBatch) : <ActionButton label="View details" onClick={() => view(item)} className="border border-slate-200"><Eye size={13} /></ActionButton> });
  return <><EnhancedTable {...props} responsivePageSize measureRenderedRows contentHeight reserveTableHeight={false} pageSize={5} autoPageSize={false} pageCapacity={undefined} rowHeight={props.rowHeight ?? 56} columns={columns}
    rowKey={item => item.catalogKey || `product-${item.id}`} onRowClick={view}
    renderMobileRow={props.readOnly ? item => <StaffInventoryCard product={item} onView={view} /> : props.renderMobileRow ? (item, index) => item.expiredBatch ? <MobileInventoryCard product={item} busy={saving} deleteDisabled={!canDisposeExpiredBatch(item.expiredBatch)}
      onEdit={() => openBatchEdit(item.expiredBatch!)} onDelete={() => setDisposal(item.expiredBatch!)} /> : props.renderMobileRow!(item, index) : undefined} />
    <Modal open={!!productDetails} onClose={() => setProductDetails(null)} title="Product details" size="sm">
      {currentProduct ? <div className="space-y-3 text-sm"><p className="font-semibold">{currentProduct.name}</p><p>{currentProduct.cat}</p><p>Stock: {currentProduct.stock} {currentProduct.unit}</p><p>Expiry: {currentProduct.expiry || 'Not available'}</p></div> : <p role="status" className="text-sm text-slate-500">This product is not available in the current results.</p>}
    </Modal>
    <Modal open={!!editBatch} busy={saving} onClose={() => { if (!submissionLock.current) setEditBatch(null); }} title="Edit batch" subtitle={editBatch?.batch} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">Inventory unit cost (optional)<input type="number" min="0" step="0.01" value={editDraft.price} disabled={saving} onChange={event => setEditDraft({ ...editDraft, price: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label>
        <label className="block text-sm">Notes<textarea value={editDraft.notes} disabled={saving} onChange={event => setEditDraft({ ...editDraft, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label>
        <button type="button" disabled={saving} onClick={() => void saveBatch()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Saving?' : 'Save batch'}</button>
      </div>
    </Modal>
    <Modal open={!!details} onClose={() => setDetails(null)} title="Expired batch details" size="sm">
      {currentBatch ? <BatchDetailsFields batch={currentBatch} /> : <p role="status" className="text-sm text-slate-500">This batch is not available in the current results.</p>}
    </Modal>
    <ConfirmDialog open={!!disposal} onClose={() => { if (!submissionLock.current) setDisposal(null); }}
      onConfirm={() => void dispose()} title="Dispose expired batch?" confirmLabel="Dispose / Write Off" loading={saving}
      description={disposal ? `Write off all ${disposal.quantity} ${disposal.unit} of ${disposal.name} (batch ${disposal.batch})? This records an expired-stock adjustment, sets remaining stock to 0, and marks the batch disposed. This cannot be undone here.` : ''} />
  </>;
}
