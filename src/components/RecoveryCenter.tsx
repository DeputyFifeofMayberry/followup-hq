import { useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCcw, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import type { VerificationMismatch } from '../lib/persistenceVerification';

export type RecoveryFilter = 'all' | 'entity' | 'category';

interface RecoveryCenterProps {
  open: boolean;
  onClose: () => void;
  verificationState: string;
  lastVerificationCompletedAt?: string;
  lastConfirmedBatchId?: string;
  lastLocalWriteAt?: string;
  mismatchList: VerificationMismatch[];
  mismatchCountsByCategory: Record<string, number>;
  mismatchCountsByEntity: Record<string, number>;
  localSnapshotSummary?: { countsByEntity: Record<string, number>; schemaVersion?: number; freshCloudRead?: boolean };
  cloudSnapshotSummary?: { countsByEntity: Record<string, number>; schemaVersion?: number; freshCloudRead?: boolean };
  reviewedMismatchIds: string[];
  onVerifyNow: () => void;
  onReRunCloudRead: () => void;
  onMarkReviewed: (mismatchId: string) => void;
  onExportReport: () => void;
}

export function RecoveryCenter(props: RecoveryCenterProps) {
  const [filterType, setFilterType] = useState<RecoveryFilter>('all');
  const [filterValue, setFilterValue] = useState<string>('all');
  const [selectedMismatchId, setSelectedMismatchId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filterType === 'entity' && filterValue !== 'all') return props.mismatchList.filter((mismatch) => mismatch.entity === filterValue);
    if (filterType === 'category' && filterValue !== 'all') return props.mismatchList.filter((mismatch) => mismatch.category === filterValue);
    return props.mismatchList;
  }, [filterType, filterValue, props.mismatchList]);

  const selected = filtered.find((mismatch) => mismatch.id === selectedMismatchId) ?? filtered[0] ?? null;
  const trueMismatchCount = props.mismatchList.filter((mismatch) => mismatch.category !== 'verification_read_failed').length;

  if (!props.open) return null;

  return (
    <div className="sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Recovery center" style={{ marginTop: 8, maxHeight: '72vh', overflow: 'auto' }}>
      <div className="sync-status-panel-title">Recovery Center</div>

      <div className="sync-status-row">
        <span className="sync-status-row-label">Overall status</span>
        <div className="sync-status-row-value">
          {props.verificationState === 'verified-match' ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>
            {props.verificationState === 'verified-match'
              ? 'Verified match'
              : props.verificationState === 'failed' || props.verificationState === 'read-failed'
                ? 'Could not verify cloud state'
                : 'Recovery review needed'}
          </span>
        </div>
        <div className="sync-status-row-detail">Last verification: {props.lastVerificationCompletedAt ? formatDateTime(props.lastVerificationCompletedAt) : 'No verification run yet.'}</div>
        <div className="sync-status-row-detail">Last confirmed batch: {props.lastConfirmedBatchId ?? 'Not available'}</div>
        <div className="sync-status-row-detail">Total mismatches: {trueMismatchCount}</div>
      </div>

      <div className="sync-status-row">
        <span className="sync-status-row-label">State snapshot</span>
        <div className="sync-status-row-detail">Last local write: {props.lastLocalWriteAt ? formatDateTime(props.lastLocalWriteAt) : 'Unknown'}</div>
        <div className="sync-status-row-detail">Local schema: {props.localSnapshotSummary?.schemaVersion ?? 'unknown'} • Cloud schema: {props.cloudSnapshotSummary?.schemaVersion ?? 'unknown'}</div>
        <div className="sync-status-row-detail">Fresh cloud read: {props.cloudSnapshotSummary?.freshCloudRead ? 'Yes' : 'No'}</div>
      </div>

      <div className="sync-status-row">
        <span className="sync-status-row-label">Mismatch filters</span>
        <div className="sync-status-actions">
          <select className="field-input" value={filterType} onChange={(event) => { setFilterType(event.target.value as RecoveryFilter); setFilterValue('all'); }}>
            <option value="all">All mismatches</option>
            <option value="entity">By entity</option>
            <option value="category">By category</option>
          </select>
          {filterType !== 'all' ? (
            <select className="field-input" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="all">All</option>
              {Object.keys(filterType === 'entity' ? props.mismatchCountsByEntity : props.mismatchCountsByCategory).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="sync-status-row-detail">By category: {Object.entries(props.mismatchCountsByCategory).filter(([, count]) => count > 0).map(([key, count]) => `${key} (${count})`).join('; ') || 'none'}</div>
        <div className="sync-status-row-detail">By entity: {Object.entries(props.mismatchCountsByEntity).filter(([, count]) => count > 0).map(([key, count]) => `${key} (${count})`).join('; ') || 'none'}</div>
      </div>

      <div className="sync-status-row">
        <span className="sync-status-row-label">Mismatch queue</span>
        {filtered.length === 0 ? <div className="sync-status-row-detail">No mismatches in this filter.</div> : (
          <ul className="sync-status-activity-list" aria-label="Mismatch queue">
            {filtered.map((mismatch) => (
              <li
                key={mismatch.id}
                className="sync-status-activity-item"
                style={{ border: selected?.id === mismatch.id ? '1px solid var(--color-border-strong, #334155)' : undefined, cursor: 'pointer' }}
                onClick={() => setSelectedMismatchId(mismatch.id)}
              >
                <div className="sync-status-activity-top">
                  <span className="sync-status-row-detail-strong">{mismatch.entity} {mismatch.recordId ? `• ${mismatch.recordId}` : ''}</span>
                  <span className="sync-status-row-detail">{mismatch.category}</span>
                </div>
                <div className="sync-status-row-detail">{mismatch.summary}</div>
                <div className="sync-status-row-detail">Digest/timestamp: {mismatch.localDigest?.slice(0, 10) ?? '—'} / {mismatch.cloudDigest?.slice(0, 10) ?? '—'} • {mismatch.localUpdatedAt ?? '—'} / {mismatch.cloudUpdatedAt ?? '—'}</div>
                <div className="sync-status-actions">
                  <button type="button" className="action-btn" onClick={(event) => { event.stopPropagation(); props.onMarkReviewed(mismatch.id); }}>Mark reviewed</button>
                  <span className="sync-status-row-detail">{props.reviewedMismatchIds.includes(mismatch.id) ? 'Reviewed this session' : 'Unreviewed'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="sync-status-row">
          <span className="sync-status-row-label">Detail</span>
          <div className="sync-status-row-detail sync-status-row-detail-strong">{selected.summary}</div>
          <div className="sync-status-row-detail">{selected.technicalDetail}</div>
          <div className="sync-status-row-detail">Local timestamp: {selected.localUpdatedAt ?? 'n/a'} • Cloud timestamp: {selected.cloudUpdatedAt ?? 'n/a'}</div>
          {selected.localRecordPreview ? <pre className="sync-status-row-detail" style={{ whiteSpace: 'pre-wrap' }}>Local preview: {JSON.stringify(selected.localRecordPreview, null, 2)}</pre> : null}
          {selected.cloudRecordPreview ? <pre className="sync-status-row-detail" style={{ whiteSpace: 'pre-wrap' }}>Cloud preview: {JSON.stringify(selected.cloudRecordPreview, null, 2)}</pre> : null}
        </div>
      ) : null}

      <div className="sync-status-actions">
        <button type="button" className="action-btn" onClick={props.onVerifyNow}><RefreshCcw className="h-3.5 w-3.5" />Verify now</button>
        <button type="button" className="action-btn" onClick={props.onReRunCloudRead}><RefreshCcw className="h-3.5 w-3.5" />Re-run cloud read</button>
        <button type="button" className="action-btn" onClick={props.onExportReport}><Download className="h-3.5 w-3.5" />Export report</button>
        <button type="button" className="action-btn" onClick={props.onClose}>Close</button>
      </div>
    </div>
  );
}
