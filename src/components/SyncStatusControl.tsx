import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, Cloud, Database, LoaderCircle, LogOut, RefreshCcw, Save, Upload, UserRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../lib/utils';
import { getCloudConfirmationLabel, getSyncStatusModel, selectSyncMetaSnapshot } from '../lib/syncStatus';
import { getSupabaseHost, supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

function SyncStateIcon({ tone, spinning }: { tone: 'info' | 'success' | 'warn' | 'danger'; spinning: boolean }) {
  if (spinning || tone === 'info') return <LoaderCircle className={spinning ? 'h-3.5 w-3.5 state-spin' : 'h-3.5 w-3.5'} />;
  if (tone === 'danger') return <AlertTriangle className="h-3.5 w-3.5" />;
  if (tone === 'warn') return <Upload className="h-3.5 w-3.5" />;
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

export function SyncStatusControl() {
  const syncMeta = useAppStore(useShallow((s) => ({
    ...selectSyncMetaSnapshot(s),
    dirtyRecordRefs: s.dirtyRecordRefs,
    persistenceActivity: s.persistenceActivity,
    flushPersistenceNow: s.flushPersistenceNow,
    retryPersistenceNow: s.retryPersistenceNow,
  })));
  const [open, setOpen] = useState(false);
  const [runningManualSave, setRunningManualSave] = useState(false);
  const [runningRetry, setRunningRetry] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const statusModel = useMemo(() => getSyncStatusModel(syncMeta), [syncMeta]);
  const isNeedsAttention = statusModel.primaryState === 'needs-attention';
  const showRetry = syncMeta.syncState === 'error' || syncMeta.sessionDegradedReason === 'cloud-save-failed';
  const trustAction = syncMeta.persistenceMode === 'supabase'
    ? 'Run a successful cloud save (Save now or Retry failed save) to restore trust.'
    : 'Continue saving locally. Cloud trust recovery requires cloud-backed mode.';
  const lastSavedLabel = syncMeta.lastCloudConfirmedAt
    ? `Last confirmed save: ${formatDateTime(syncMeta.lastCloudConfirmedAt)}`
    : syncMeta.lastLocalWriteAt
      ? `Last saved locally: ${formatDateTime(syncMeta.lastLocalWriteAt)}`
      : 'No save timestamp recorded yet.';

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? '');
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? '');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
          <div className="sync-status-panel-title">Save status</div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Current state</span>
            <div className="sync-status-row-value">
              <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
              <span>{statusModel.stateLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.stateDescription}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Save mode</span>
            <div className="sync-status-row-value">
              {syncMeta.persistenceMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
              <span>{statusModel.modeLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.modeDescription}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Save timeline</span>
            <div className="sync-status-row-detail">{lastSavedLabel}</div>
            {syncMeta.lastLocalWriteAt && syncMeta.lastCloudConfirmedAt !== syncMeta.lastLocalWriteAt ? (
              <div className="sync-status-row-detail">Last saved locally: {formatDateTime(syncMeta.lastLocalWriteAt)}</div>
            ) : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Summary</span>
            <div className="sync-status-row-detail">{statusModel.reassurance}</div>
            {isNeedsAttention ? <div className="sync-status-row-detail">{statusModel.stateDescription}</div> : null}
            {statusModel.trustRecoveryMessage ? <div className="sync-status-row-detail">{statusModel.trustRecoveryMessage}</div> : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Session trust</span>
            <div className="sync-status-row-detail">{statusModel.trustLabel ?? 'Session trust status unavailable.'}</div>
            {statusModel.trustDescription ? <div className="sync-status-row-detail">{statusModel.trustDescription}</div> : null}
            {syncMeta.sessionDegraded ? (
              <>
                <div className="sync-status-row-detail">Why review is needed: {syncMeta.sessionDegradedReason.replaceAll('-', ' ')}.</div>
                <div className="sync-status-row-detail">{trustAction}</div>
              </>
            ) : null}
          </div>

          {(syncMeta.hasLocalUnsavedChanges || showRetry) ? (
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
                disabled={!showRetry || runningRetry}
                onClick={() => {
                  setRunningRetry(true);
                  void syncMeta.retryPersistenceNow().finally(() => setRunningRetry(false));
                }}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {runningRetry ? 'Retrying…' : 'Retry save'}
              </button>
            </div>
          ) : null}

          <details className="sync-status-row">
            <summary className="sync-status-row-label">Technical details</summary>
            <div className="sync-status-diagnostics-grid">
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Cloud confirmation status</div>
                <div className="sync-status-row-detail">{getCloudConfirmationLabel(syncMeta)}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last failed save</div>
                <div className="sync-status-row-detail">{syncMeta.lastFailedSyncAt ? formatDateTime(syncMeta.lastFailedSyncAt) : 'No failed save attempts recorded.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Unsaved local edits</div>
                <div className="sync-status-row-detail">{syncMeta.hasLocalUnsavedChanges ? `${syncMeta.unsavedChangeCount} record${syncMeta.unsavedChangeCount === 1 ? '' : 's'} with unsaved edits` : 'No pending local edits.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Connected Supabase host</div>
                <div className="sync-status-row-detail">{getSupabaseHost()}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last confirmed batch ID</div>
                <div className="sync-status-row-detail">{syncMeta.lastConfirmedBatchId ?? 'No committed batch yet.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Receipt status</div>
                <div className="sync-status-row-detail">{syncMeta.lastReceiptStatus ?? 'No receipt recorded yet.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Payload hash match</div>
                <div className="sync-status-row-detail">{syncMeta.lastReceiptHashMatch == null ? 'Not available yet.' : syncMeta.lastReceiptHashMatch ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Schema version</div>
                <div className="sync-status-row-detail">{syncMeta.lastReceiptSchemaVersion ?? 'Not available yet.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Operation count</div>
                <div className="sync-status-row-detail">{syncMeta.lastReceiptOperationCount ?? 'Not available yet.'}</div>
              </div>
            </div>
            {syncMeta.lastConfirmedBatchCommittedAt ? (
              <div className="sync-status-row-detail">Last committed cloud save time: {formatDateTime(syncMeta.lastConfirmedBatchCommittedAt)}</div>
            ) : null}
            {syncMeta.lastReceiptTouchedTables?.length ? (
              <div className="sync-status-row-detail">Touched tables: {syncMeta.lastReceiptTouchedTables.join(', ')}</div>
            ) : null}
            {syncMeta.lastReceiptOperationCountsByEntity ? (
              <div className="sync-status-row-detail">
                Per-entity counts: {Object.entries(syncMeta.lastReceiptOperationCountsByEntity)
                  .map(([entity, counts]) => `${entity} (upserts ${counts.upserts}, deletes ${counts.deletes})`)
                  .join('; ')}
              </div>
            ) : null}
            {syncMeta.lastFailedBatchId ? (
              <div className="sync-status-row-detail">Failed batch ID: {syncMeta.lastFailedBatchId}</div>
            ) : null}
            {syncMeta.lastFallbackRestoreAt ? <div className="sync-status-row-detail">Last fallback restore: {formatDateTime(syncMeta.lastFallbackRestoreAt)}</div> : null}
            {syncMeta.lastLoadRecoveredWithLocalCache && syncMeta.lastLoadFailureStage ? <div className="sync-status-row-detail">Fallback reason: {syncMeta.lastLoadFailureStage}</div> : null}
            {syncMeta.lastLoadRecoveredWithLocalCache && syncMeta.lastLoadFailureMessage ? <div className="sync-status-row-detail">Load detail: {syncMeta.lastLoadFailureMessage}</div> : null}
            {syncMeta.saveError ? <div className="sync-status-row-detail">Save/load detail: {syncMeta.saveError}</div> : null}
            {syncMeta.dirtyRecordRefs.length ? (
              <div className="sync-status-row-detail">
                Dirty records in focus: {syncMeta.dirtyRecordRefs.slice(0, 3).map((ref) => `${ref.type} ${ref.id}`).join(', ')}
                {syncMeta.dirtyRecordRefs.length > 3 ? ` +${syncMeta.dirtyRecordRefs.length - 3} more` : ''}
              </div>
            ) : null}

            <div className="sync-status-row-detail sync-status-row-detail-strong" style={{ marginTop: 8 }}>Activity log</div>
            {syncMeta.persistenceActivity.length ? (
              <ul className="sync-status-activity-list" aria-label="Persistence activity log">
                {syncMeta.persistenceActivity.map((entry) => (
                  <li key={entry.id} className="sync-status-activity-item">
                    <div className="sync-status-activity-top">
                      <span className="sync-status-row-detail-strong">{entry.summary}</span>
                      <span className="sync-status-row-detail">{formatDateTime(entry.at)}</span>
                    </div>
                    {entry.detail ? <div className="sync-status-row-detail">{entry.detail}</div> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sync-status-row-detail">No sync activity recorded yet.</div>
            )}
          </details>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Session</span>
            <div className="sync-status-row-value">
              <UserRound className="h-3.5 w-3.5" />
              <span>{email ? `Signed in as ${email}` : 'Signed-in account unavailable.'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
              className="action-btn sync-status-signout"
              disabled={signingOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
