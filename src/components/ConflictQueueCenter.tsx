import { useMemo, useState } from 'react';
import type { PersistenceConflictItem } from '../store/state/types';
import { formatDateTime } from '../lib/utils';

interface ConflictQueueCenterProps {
  open: boolean;
  onClose: () => void;
  conflicts: PersistenceConflictItem[];
  onMarkReviewed: (id: string) => void;
  onDismiss: (id: string) => void;
  onReverify: () => void;
}

export function ConflictQueueCenter({ open, onClose, conflicts, onMarkReviewed, onDismiss, onReverify }: ConflictQueueCenterProps) {
  const [groupBy, setGroupBy] = useState<'entity' | 'type' | 'newest'>('newest');

  const ordered = useMemo(() => {
    if (groupBy === 'newest') {
      return [...conflicts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const key = groupBy === 'entity' ? 'entity' : 'conflictType';
    return [...conflicts].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  }, [conflicts, groupBy]);

  if (!open) return null;

  return (
    <div className="sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Conflict queue" style={{ marginTop: 8, maxHeight: '72vh', overflow: 'auto' }}>
      <div className="sync-status-panel-title">Conflict Queue</div>
      <div className="sync-status-actions" style={{ marginBottom: 8 }}>
        <button type="button" className="action-btn" onClick={onReverify}>Re-verify cloud state</button>
        <button type="button" className="action-btn" onClick={onClose}>Close</button>
      </div>
      <div className="sync-status-row-detail">Open conflicts: {conflicts.filter((entry) => entry.status === 'open').length}</div>
      <div className="sync-status-row-detail">Group by:
        <select className="field-input" value={groupBy} onChange={(event) => setGroupBy(event.target.value as 'entity' | 'type' | 'newest')}>
          <option value="newest">Newest</option>
          <option value="entity">Entity</option>
          <option value="type">Conflict type</option>
        </select>
      </div>
      {ordered.length === 0 ? <div className="sync-status-row-detail">No conflicts queued.</div> : ordered.map((conflict) => (
        <div key={conflict.id} className="sync-status-row" style={{ marginTop: 8 }}>
          <div className="sync-status-row-detail sync-status-row-detail-strong">{conflict.entity} • {conflict.recordId}</div>
          <div className="sync-status-row-detail">Type: {conflict.conflictType} • Status: {conflict.status}</div>
          <div className="sync-status-row-detail">{conflict.summary}</div>
          <div className="sync-status-row-detail">Versions local/cloud: {conflict.localRecordVersion ?? '—'} / {conflict.cloudRecordVersion ?? '—'} • Devices local/cloud: {conflict.localDeviceId ?? '—'} / {conflict.cloudDeviceId ?? '—'}</div>
          <div className="sync-status-row-detail">Batches local/cloud: {conflict.localBatchId ?? '—'} / {conflict.cloudBatchId ?? '—'}</div>
          <div className="sync-status-row-detail">Tombstone local/cloud: {conflict.localDeletedAt ? 'yes' : 'no'} / {conflict.cloudDeletedAt ? 'yes' : 'no'} • {formatDateTime(conflict.createdAt)}</div>
          {conflict.technicalDetail ? <div className="sync-status-row-detail">Detail: {conflict.technicalDetail}</div> : null}
          <div className="sync-status-actions">
            <button type="button" className="action-btn" onClick={() => onMarkReviewed(conflict.id)}>Mark reviewed</button>
            <button type="button" className="action-btn" onClick={() => onDismiss(conflict.id)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}
