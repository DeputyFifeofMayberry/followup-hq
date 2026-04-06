import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, Cloud, Database, LoaderCircle, LogOut, RefreshCcw, Save, Upload, UserRound } from 'lucide-react';
import { RecoveryCenter } from './RecoveryCenter';
import { downloadVerificationIncidentReport, exportVerificationIncident } from '../lib/persistenceVerification';
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
    verifyNow: s.verifyNow,
    markVerificationMismatchReviewed: s.markVerificationMismatchReviewed,
    clearReviewedVerificationMismatches: s.clearReviewedVerificationMismatches,
  })));
  const [open, setOpen] = useState(false);
  const [runningManualSave, setRunningManualSave] = useState(false);
  const [runningRetry, setRunningRetry] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
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
          <div className="sync-status-panel-title">Save & sync trust center</div>

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
            <div className="sync-status-row-detail">Local/browser mode: {syncMeta.persistenceMode === "supabase" ? "Cloud-backed" : "Local/browser mode"}</div>
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


          <div className="sync-status-actions">
            <button
              type="button"
              className="action-btn"
              disabled={syncMeta.verificationState === 'running'}
              onClick={() => {
                void syncMeta.verifyNow('manual');
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {syncMeta.verificationState === 'running' ? 'Verifying…' : 'Verify now'}
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => setRecoveryOpen(true)}
            >
              Open Recovery Center
            </button>
          </div>

          <details className="sync-status-row">
            <summary className="sync-status-row-label">Technical details</summary>
            <div className="sync-status-diagnostics-grid">
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Cloud confirmation status</div>
                <div className="sync-status-row-detail">{getCloudConfirmationLabel(syncMeta)}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last failed sync attempt</div>
                <div className="sync-status-row-detail">{syncMeta.lastFailedSyncAt ? formatDateTime(syncMeta.lastFailedSyncAt) : 'No failed save attempts recorded.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Unsaved local edits</div>
                <div className="sync-status-row-detail">{syncMeta.hasLocalUnsavedChanges ? `${syncMeta.unsavedChangeCount} record${syncMeta.unsavedChangeCount === 1 ? '' : 's'} with unsaved edits` : 'No pending local edits.'}</div>
              </div>

              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Verification status</div>
                <div className="sync-status-row-detail">{syncMeta.verificationState}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last verification</div>
                <div className="sync-status-row-detail">{syncMeta.lastVerificationCompletedAt ? formatDateTime(syncMeta.lastVerificationCompletedAt) : 'No verification run yet.'}</div>
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


            {syncMeta.verificationSummary ? (
              <>
                <div className="sync-status-row-detail">Verification result: {syncMeta.verificationSummary.verified ? 'matched current cloud state' : `found ${syncMeta.verificationSummary.mismatchCount} mismatches`}.</div>
                <div className="sync-status-row-detail">Mismatch counts by category: {Object.entries(syncMeta.verificationSummary.mismatchCountsByCategory).filter(([, count]) => count > 0).map(([category, count]) => `${category} (${count})`).join('; ') || 'none'}</div>
                <div className="sync-status-row-detail">Mismatch counts by entity: {Object.entries(syncMeta.verificationSummary.mismatchCountsByEntity).map(([entity, count]) => `${entity} (${count})`).join('; ') || 'none'}</div>
                <div className="sync-status-row-detail">Verification based on batch: {syncMeta.verificationSummary.basedOnBatchId ?? 'not tied to a committed batch'}</div>
                <button type="button" className="action-btn" onClick={() => {
                  if (!syncMeta.latestVerificationResult) return;
                  const report = exportVerificationIncident({
                    verificationResult: syncMeta.latestVerificationResult,
                    appVersion: typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_APP_VERSION : undefined,
                    lastConfirmedBatchId: syncMeta.lastConfirmedBatchId,
                    lastConfirmedCommittedAt: syncMeta.lastConfirmedBatchCommittedAt,
                    lastLocalWriteAt: syncMeta.lastLocalWriteAt,
                    cloudConfirmationStatus: syncMeta.cloudSyncStatus,
                    sessionTrustState: syncMeta.sessionTrustState,
                    degradedReason: syncMeta.sessionDegradedReason,
                    receiptMetadata: {
                      status: syncMeta.lastReceiptStatus,
                      hashMatch: syncMeta.lastReceiptHashMatch,
                      touchedTables: syncMeta.lastReceiptTouchedTables,
                      operationCount: syncMeta.lastReceiptOperationCount,
                    },
                  });
                  downloadVerificationIncidentReport(report);
                }}>Export report</button>
              </>
            ) : null}

            <div className="sync-status-row-detail sync-status-row-detail-strong" style={{ marginTop: 8 }}>Recent sync activity</div>
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


          <RecoveryCenter
            open={recoveryOpen}
            onClose={() => setRecoveryOpen(false)}
            verificationState={syncMeta.verificationState}
            lastVerificationCompletedAt={syncMeta.lastVerificationCompletedAt}
            lastConfirmedBatchId={syncMeta.lastConfirmedBatchId}
            lastLocalWriteAt={syncMeta.lastLocalWriteAt}
            mismatchList={syncMeta.latestVerificationResult?.mismatches ?? []}
            mismatchCountsByCategory={syncMeta.verificationSummary?.mismatchCountsByCategory ?? {}}
            mismatchCountsByEntity={syncMeta.verificationSummary?.mismatchCountsByEntity ?? {}}
            localSnapshotSummary={syncMeta.latestVerificationResult?.localSnapshotSummary}
            cloudSnapshotSummary={syncMeta.latestVerificationResult?.cloudSnapshotSummary}
            reviewedMismatchIds={syncMeta.reviewedMismatchIds}
            onVerifyNow={() => { void syncMeta.verifyNow('manual'); }}
            onReRunCloudRead={() => { void syncMeta.verifyNow('manual'); }}
            onMarkReviewed={(mismatchId) => syncMeta.markVerificationMismatchReviewed(mismatchId)}
            onExportReport={() => {
              if (!syncMeta.latestVerificationResult) return;
              const report = exportVerificationIncident({
                verificationResult: syncMeta.latestVerificationResult,
                lastConfirmedBatchId: syncMeta.lastConfirmedBatchId,
                lastConfirmedCommittedAt: syncMeta.lastConfirmedBatchCommittedAt,
                lastLocalWriteAt: syncMeta.lastLocalWriteAt,
                cloudConfirmationStatus: syncMeta.cloudSyncStatus,
                sessionTrustState: syncMeta.sessionTrustState,
                degradedReason: syncMeta.sessionDegradedReason,
              });
              downloadVerificationIncidentReport(report);
            }}
          />

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
