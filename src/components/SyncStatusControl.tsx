import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, Cloud, Database, LoaderCircle, RefreshCcw, Save, Upload } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../lib/utils';
import { getSyncStatusModel } from '../lib/syncStatus';

function SyncStateIcon({ tone, spinning }: { tone: 'info' | 'success' | 'warn' | 'danger'; spinning: boolean }) {
  if (spinning || tone === 'info') return <LoaderCircle className={spinning ? 'h-3.5 w-3.5 state-spin' : 'h-3.5 w-3.5'} />;
  if (tone === 'danger') return <AlertTriangle className="h-3.5 w-3.5" />;
  if (tone === 'warn') return <Upload className="h-3.5 w-3.5" />;
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

export function SyncStatusControl() {
  const syncMeta = useAppStore(useShallow((s) => ({
    hydrated: s.hydrated,
    persistenceMode: s.persistenceMode,
    syncState: s.syncState,
    saveError: s.saveError,
    lastSyncedAt: s.lastSyncedAt,
    unsavedChangeCount: s.unsavedChangeCount,
    hasLocalUnsavedChanges: s.hasLocalUnsavedChanges,
    dirtyRecordRefs: s.dirtyRecordRefs,
    flushPersistenceNow: s.flushPersistenceNow,
    retryPersistenceNow: s.retryPersistenceNow,
  })));
  const [open, setOpen] = useState(false);
  const [runningManualSave, setRunningManualSave] = useState(false);
  const [runningRetry, setRunningRetry] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const statusModel = useMemo(() => getSyncStatusModel(syncMeta), [syncMeta]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className="sync-status-shell" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`sync-status-trigger sync-status-trigger-${statusModel.tone}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
        <span>{statusModel.stateLabel}</span>
      </button>

      {open ? (
        <section className="sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Sync status details">
          <div className="sync-status-panel-title">Save & sync status</div>
          <div className="sync-status-row">
            <span className="sync-status-row-label">Current state</span>
            <div className="sync-status-row-value">
              <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
              <span>{statusModel.stateLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.stateDescription}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Persistence mode</span>
            <div className="sync-status-row-value">
              {syncMeta.persistenceMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
              <span>{statusModel.modeLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.modeDescription}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Last successful sync</span>
            <div className="sync-status-row-detail sync-status-row-detail-strong">
              {syncMeta.lastSyncedAt ? formatDateTime(syncMeta.lastSyncedAt) : 'No successful sync recorded yet.'}
            </div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Pending local edits</span>
            <div className="sync-status-row-detail sync-status-row-detail-strong">
              {syncMeta.hasLocalUnsavedChanges ? `${syncMeta.unsavedChangeCount} pending change${syncMeta.unsavedChangeCount === 1 ? '' : 's'}` : 'No pending local edits.'}
            </div>
            {syncMeta.dirtyRecordRefs.length ? (
              <div className="sync-status-row-detail">
                Dirty records in focus: {syncMeta.dirtyRecordRefs.slice(0, 3).map((ref) => `${ref.type} ${ref.id}`).join(', ')}
                {syncMeta.dirtyRecordRefs.length > 3 ? ` +${syncMeta.dirtyRecordRefs.length - 3} more` : ''}
              </div>
            ) : null}
          </div>

          <div className="sync-status-actions">
            <button
              type="button"
              className="action-btn"
              disabled={!syncMeta.hasLocalUnsavedChanges || runningManualSave}
              onClick={() => {
                setRunningManualSave(true);
                void syncMeta.flushPersistenceNow().finally(() => setRunningManualSave(false));
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {runningManualSave ? 'Saving now…' : 'Save now'}
            </button>
            <button
              type="button"
              className="action-btn"
              disabled={syncMeta.syncState !== 'error' || runningRetry}
              onClick={() => {
                setRunningRetry(true);
                void syncMeta.retryPersistenceNow().finally(() => setRunningRetry(false));
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {runningRetry ? 'Retrying…' : 'Retry failed save'}
            </button>
          </div>

          {syncMeta.saveError ? (
            <div className="sync-status-error">
              <AlertTriangle className="h-4 w-4" />
              <span>{syncMeta.saveError}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
