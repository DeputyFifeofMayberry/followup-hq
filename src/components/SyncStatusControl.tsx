import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, Cloud, Database, LoaderCircle, RefreshCcw, Save, Upload } from 'lucide-react';
import { RecoveryCenter } from './RecoveryCenter';
import { ConflictQueueCenter } from './ConflictQueueCenter';
import { downloadVerificationIncidentReport, exportVerificationIncident } from '../lib/persistenceVerification';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../lib/utils';
import { getCloudConfirmationLabel, getSyncStatusModel, getSyncStatusToastAnnouncement, selectSyncMetaSnapshot } from '../lib/syncStatus';
import { getSupabaseHost } from '../lib/supabase';
import type { SyncTrustStage } from '../lib/syncStatus';

function SyncStateIcon({ tone, spinning }: { tone: 'info' | 'success' | 'warn' | 'danger'; spinning: boolean }) {
  if (spinning || tone === 'info') return <LoaderCircle className={spinning ? 'h-3.5 w-3.5 state-spin' : 'h-3.5 w-3.5'} />;
  if (tone === 'danger') return <AlertTriangle className="h-3.5 w-3.5" />;
  if (tone === 'warn') return <Upload className="h-3.5 w-3.5" />;
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

function getTriggerSecondaryLine(stage: string, stateDescription: string): string {
  if (stage === 'cloud-verified') return 'Current local state matches the latest cloud read.';
  if (stage === 'cloud-confirmed') return 'Latest cloud batch committed; verification is separate.';
  if (stage === 'saved-locally') return 'Protected locally; cloud confirmation has not completed yet.';
  if (stage === 'queued-for-cloud') return stateDescription;
  if (stage === 'verification-stale') return 'Newer edits made the previous verification stale.';
  if (stage === 'needs-attention') return 'Cloud confirmation needs review before trust can be restored.';
  return stateDescription;
}

export function SyncStatusControl() {
  const syncMeta = useAppStore(useShallow((s) => ({
    ...selectSyncMetaSnapshot(s),
    pendingBatchCount: s.pendingBatchCount,
    dirtyRecordRefs: s.dirtyRecordRefs,
    persistenceActivity: s.persistenceActivity,
    flushPersistenceNow: s.flushPersistenceNow,
    retryPersistenceNow: s.retryPersistenceNow,
    verifyNow: s.verifyNow,
    pushToast: s.pushToast,
    markVerificationMismatchReviewed: s.markVerificationMismatchReviewed,
    clearReviewedVerificationMismatches: s.clearReviewedVerificationMismatches,
    markConflictReviewed: s.markConflictReviewed,
    dismissConflict: s.dismissConflict,
    conflictQueue: s.conflictQueue,
  })));
  const [open, setOpen] = useState(false);
  const [runningManualSave, setRunningManualSave] = useState(false);
  const [runningRetry, setRunningRetry] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousStageRef = useRef<SyncTrustStage | null>(null);
  const lastAnnouncedToastKeyRef = useRef<string | null>(null);

  const statusModel = useMemo(() => getSyncStatusModel(syncMeta), [syncMeta]);
  const isBackendSetupIssue = syncMeta.sessionDegradedReason === 'backend-schema-mismatch'
    || syncMeta.sessionDegradedReason === 'backend-rpc-missing'
    || syncMeta.sessionDegradedReason === 'backend-missing-hashing-support';
  const retryBlocked = Boolean(syncMeta.lastFailureNonRetryable || syncMeta.sessionDegradedReason === 'payload-invalid' || isBackendSetupIssue);
  const showRetry = !retryBlocked && (syncMeta.pendingBatchCount > 0 || syncMeta.syncState === 'error' || syncMeta.cloudSyncState === 'failed' || syncMeta.cloudSyncState === 'conflict');
  const trustAction = syncMeta.persistenceMode === 'supabase'
    ? retryBlocked
      ? 'Retry is paused because this issue requires repair before cloud sync can continue.'
      : 'Cloud sync retries automatically. Use Retry only if attention is required.'
    : 'Continue saving locally. Cloud trust recovery requires cloud-backed mode.';
  const verificationReadFailureKind = syncMeta.verificationSummary?.verificationReadFailureKind;
  const timestampDriftCount = syncMeta.verificationSummary?.timestampDriftCount ?? 0;
  const trueMismatchCategorySummary = useMemo(
    () => Object.entries(syncMeta.verificationSummary?.mismatchCountsByCategory ?? {})
      .filter(([category, count]) => count > 0 && category !== 'newer_locally' && category !== 'newer_in_cloud'),
    [syncMeta.verificationSummary?.mismatchCountsByCategory],
  );
  const trueMismatchEntitySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    (syncMeta.latestVerificationResult?.mismatches ?? []).forEach((mismatch) => {
      if (mismatch.category === 'verification_read_failed' || mismatch.category === 'newer_locally' || mismatch.category === 'newer_in_cloud') return;
      counts[mismatch.entity] = (counts[mismatch.entity] ?? 0) + 1;
    });
    return Object.entries(counts);
  }, [syncMeta.latestVerificationResult?.mismatches]);
  const verificationResultLabel = syncMeta.verificationSummary?.verified
    ? statusModel.stage === 'cloud-verified'
      ? timestampDriftCount > 0
        ? `matched current cloud state (${timestampDriftCount} timestamp drift record${timestampDriftCount === 1 ? '' : 's'}, content matched)`
        : 'matched current cloud state'
      : 'matched a prior revision; run verification again after latest edits commit'
    : syncMeta.verificationSummary?.verificationReadFailed
      ? verificationReadFailureKind === 'backend-contract'
        ? `stopped by backend contract mismatch${syncMeta.verificationSummary.verificationReadFailureMessage ? ` (${syncMeta.verificationSummary.verificationReadFailureMessage})` : ''}`
        : `could not complete cloud verification read${syncMeta.verificationSummary.verificationReadFailureMessage ? ` (${syncMeta.verificationSummary.verificationReadFailureMessage})` : ''}`
      : `found ${syncMeta.verificationSummary?.mismatchCount ?? 0} mismatches`;
  const verificationDiagnosticLabel = verificationReadFailureKind === 'backend-contract'
    ? 'Verification contract diagnostics'
    : 'Verification read diagnostics';
  const lastSavedLabel = syncMeta.lastCloudConfirmedAt
    ? `Last confirmed save: ${formatDateTime(syncMeta.lastCloudConfirmedAt)}`
    : syncMeta.lastLocalWriteAt
      ? `Last saved locally: ${formatDateTime(syncMeta.lastLocalWriteAt)}`
      : 'No save timestamp recorded yet.';
  const triggerSecondaryLine = getTriggerSecondaryLine(statusModel.stage, statusModel.stateDescription);
  const protectionSummary = syncMeta.hasLocalUnsavedChanges
    ? 'Latest edits are still being written; local durable protection is in progress.'
    : syncMeta.lastLocalWriteAt
      ? `Changes are durably saved on this device as of ${formatDateTime(syncMeta.lastLocalWriteAt)}.`
      : 'No local save timestamp is recorded yet.';
  const cloudStatusSummary = statusModel.stage === 'cloud-verified'
    ? 'Cloud commit and read-back verification both cover the current revision.'
    : statusModel.stage === 'cloud-confirmed'
      ? 'Cloud commit receipt confirms the latest revision. Verification can run separately.'
      : statusModel.stage === 'saved-locally'
        ? 'Cloud commit has not been confirmed for this revision yet.'
        : statusModel.stage === 'queued-for-cloud'
          ? syncMeta.connectivityState === 'offline'
            ? 'Cloud sync is waiting for connectivity. Local protection remains active.'
            : 'Cloud sync is queued and will commit as soon as pending work clears.'
          : statusModel.stage === 'needs-attention'
            ? 'Cloud trust is degraded and needs review before cloud confirmation can be trusted.'
            : 'Cloud confirmation is in progress.';
  const verificationStatusSummary = statusModel.stage === 'cloud-verified'
    ? 'Verified against current cloud state.'
    : statusModel.stage === 'verification-stale'
      ? 'Verification stale — newer local edits exist.'
      : statusModel.stage === 'cloud-confirmed'
        ? syncMeta.verificationState === 'running' || syncMeta.verificationState === 'pending'
          ? 'Verification pending after latest cloud commit.'
          : 'Verification available now for the latest committed revision.'
        : statusModel.stage === 'queued-for-cloud' || statusModel.stage === 'saved-locally'
          ? 'Verification unavailable because cloud confirmation has not completed.'
          : statusModel.stage === 'needs-attention'
            ? 'Verification blocked by a trust issue that needs review.'
            : 'Verification has not run yet.';
  const actionGuidance = retryBlocked
    ? isBackendSetupIssue
      ? 'Cloud setup is blocked. Retry will not resolve this until backend contract issues are repaired.'
      : syncMeta.sessionDegradedReason === 'payload-invalid'
        ? 'Repair invalid content first, then run save again to resume cloud confirmation.'
        : 'Resolve the trust issue first, then retry cloud save.'
    : statusModel.stage === 'queued-for-cloud'
      ? syncMeta.connectivityState === 'offline'
        ? 'Keep working normally. Changes are protected locally and will replay when back online.'
        : 'No manual action is usually needed. Use Retry only if queueing does not clear.'
      : statusModel.stage === 'verification-stale'
        ? 'Run Verify now to refresh verification for the latest edits.'
        : statusModel.stage === 'cloud-confirmed'
          ? 'Run Verify now when you need read-back proof for the current revision.'
          : statusModel.stage === 'needs-attention'
            ? trustAction
            : 'No action needed right now.';

  useEffect(() => {
    const previousStage = previousStageRef.current;
    const announcement = getSyncStatusToastAnnouncement({
      hasLocalUnsavedChanges: syncMeta.hasLocalUnsavedChanges,
      pendingBatchCount: syncMeta.pendingBatchCount,
      cloudSyncState: syncMeta.cloudSyncState,
      localRevision: syncMeta.localRevision,
      lastCloudConfirmedRevision: syncMeta.lastCloudConfirmedRevision,
      lastConfirmedBatchId: syncMeta.lastConfirmedBatchId,
      saveProof: syncMeta.saveProof,
    }, { stage: statusModel.stage, previousStage });
    previousStageRef.current = statusModel.stage;
    if (!announcement) return;
    if (lastAnnouncedToastKeyRef.current === announcement.key) return;
    lastAnnouncedToastKeyRef.current = announcement.key;
    syncMeta.pushToast({
      tone: announcement.tone,
      title: announcement.title,
      message: announcement.message,
      durationMs: announcement.durationMs,
      source: announcement.source,
    });
  }, [
    statusModel.stage,
    syncMeta.hasLocalUnsavedChanges,
    syncMeta.pendingBatchCount,
    syncMeta.cloudSyncState,
    syncMeta.localRevision,
    syncMeta.lastCloudConfirmedRevision,
    syncMeta.lastConfirmedBatchId,
    syncMeta.saveProof?.latestVerifiedBatchId,
    syncMeta.saveProof?.latestVerifiedRevision,
    syncMeta.pushToast,
  ]);

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
        className={`sync-status-trigger sync-status-trigger-${statusModel.tone} sync-status-trigger-stage-${statusModel.stage}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
        <span className="sync-status-trigger-text">
          <strong>{statusModel.stateLabel}</strong>
          <span>{triggerSecondaryLine}</span>
        </span>
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
            <span className="sync-status-row-label">What this means</span>
            <div className="sync-status-row-detail">{statusModel.reassurance}</div>
            <div className="sync-status-row-detail">{triggerSecondaryLine}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Protection summary</span>
            <div className="sync-status-row-detail">{protectionSummary}</div>
            <div className="sync-status-row-detail">
              {syncMeta.persistenceMode === 'supabase' ? 'Cloud-backed workspace with local durable protection.' : 'Local mode only; cloud confirmation is unavailable in this mode.'}
            </div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Cloud status</span>
            <div className="sync-status-row-detail">{cloudStatusSummary}</div>
            <div className="sync-status-row-detail">Connectivity: {syncMeta.connectivityState}</div>
            {syncMeta.pendingOfflineChangeCount > 0 ? <div className="sync-status-row-detail">Queued offline changes: {syncMeta.pendingOfflineChangeCount}</div> : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Verification status</span>
            <div className="sync-status-row-detail">{verificationStatusSummary}</div>
            <div className="sync-status-row-detail">
              Last verification: {syncMeta.lastVerificationCompletedAt ? formatDateTime(syncMeta.lastVerificationCompletedAt) : 'No verification run yet.'}
            </div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Save mode</span>
            <div className="sync-status-row-value">
              {syncMeta.persistenceMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
              <span>{statusModel.modeLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.modeDescription}</div>
            <div className="sync-status-row-detail">
              {syncMeta.persistenceMode === 'supabase' ? 'Signed in as cloud workspace user.' : 'Local/browser mode (no cloud account session).'}
            </div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Last timestamps</span>
            <div className="sync-status-row-detail">{lastSavedLabel}</div>
            {syncMeta.lastLocalWriteAt && syncMeta.lastCloudConfirmedAt !== syncMeta.lastLocalWriteAt ? (
              <div className="sync-status-row-detail">Last saved locally: {formatDateTime(syncMeta.lastLocalWriteAt)}</div>
            ) : null}
            {syncMeta.lastConfirmedBatchCommittedAt ? (
              <div className="sync-status-row-detail">Last cloud commit: {formatDateTime(syncMeta.lastConfirmedBatchCommittedAt)}</div>
            ) : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Action guidance</span>
            <div className="sync-status-row-detail">{actionGuidance}</div>
            {syncMeta.offlineLoadState !== 'none' ? <div className="sync-status-row-detail">Startup mode: {syncMeta.offlineLoadState.replaceAll('-', ' ')}</div> : null}
            {statusModel.trustRecoveryMessage ? <div className="sync-status-row-detail">{statusModel.trustRecoveryMessage}</div> : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Session trust</span>
            <div className="sync-status-row-detail">{statusModel.trustLabel ?? (syncMeta.sessionDegradedReason === 'payload-invalid' ? 'Cloud trust paused until invalid content is repaired.' : isBackendSetupIssue ? 'Cloud trust blocked by backend contract issue.' : syncMeta.persistenceMode === 'supabase' ? 'Cloud-backed trust is healthy.' : 'Local device trust is active.')}</div>
            {statusModel.trustDescription ? <div className="sync-status-row-detail">{statusModel.trustDescription}</div> : null}
            {syncMeta.sessionDegraded ? (
              <>
                <div className="sync-status-row-detail">Why review is needed: {syncMeta.sessionDegradedReason.replaceAll('-', ' ')}.</div>
                <div className="sync-status-row-detail">{trustAction}</div>
              </>
            ) : null}
            {isBackendSetupIssue ? (
              <div className="sync-status-row-detail">
                {syncMeta.sessionDegradedReason === 'backend-rpc-missing'
                  ? 'Cloud sync is blocked because public.apply_save_batch(batch) is missing in the connected Supabase project.'
                : syncMeta.sessionDegradedReason === 'backend-missing-hashing-support'
                    ? 'Cloud persistence backend hashing failed. A stale SQL function or invalid digest() signature is still deployed.'
                  : 'Cloud sync is blocked because one or more required table columns are missing in the connected Supabase project.'}
              </div>
            ) : null}
          </div>


          {retryBlocked && syncMeta.sessionDegradedReason === 'payload-invalid' ? (
            <div className="sync-status-row-detail">Cloud retry is paused: invalid text content must be repaired before cloud confirmation can resume.</div>
          ) : null}

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
            <button
              type="button"
              className="action-btn"
              onClick={() => setConflictOpen(true)}
            >
              Open Conflict Queue
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
                <div className="sync-status-row-detail sync-status-row-detail-strong">Local revision</div>
                <div className="sync-status-row-detail">{syncMeta.localRevision} (durable local snapshot version)</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Confirmed revision</div>
                <div className="sync-status-row-detail">{syncMeta.lastCloudConfirmedRevision} (last cloud-confirmed version)</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Pending batches</div>
                <div className="sync-status-row-detail">{syncMeta.pendingBatchCount}</div>
              </div>

              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Verification status</div>
                <div className="sync-status-row-detail">{syncMeta.verificationState}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last verification</div>
            <div className="sync-status-row-detail">{syncMeta.lastVerificationCompletedAt ? formatDateTime(syncMeta.lastVerificationCompletedAt) : 'No verification run yet.'}</div>
                {syncMeta.verificationSummary?.verified && timestampDriftCount > 0 ? (
                  <div className="sync-status-row-detail">Content matched current cloud state. Some updated timestamps differed.</div>
                ) : null}
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Connected Supabase host</div>
                <div className="sync-status-row-detail">{getSupabaseHost()}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Backend contract diagnostics</div>
                <div className="sync-status-row-detail">
                  {isBackendSetupIssue
                    ? (syncMeta.lastLoadFailureMessage ?? 'Cloud contract check failed; verify migrations are applied to this Supabase project.')
                    : 'No contract drift detected in this session.'}
                </div>
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
            {syncMeta.lastFailureClass ? <div className="sync-status-row-detail">Failure class: {syncMeta.lastFailureClass}</div> : null}
            {syncMeta.lastSanitizedFieldCount ? <div className="sync-status-row-detail">Sanitized fields before save: {syncMeta.lastSanitizedFieldCount}{syncMeta.lastSanitizedEntityTypes?.length ? ` (${syncMeta.lastSanitizedEntityTypes.join(', ')})` : ''}</div> : null}
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
                <div className="sync-status-row-detail">
                  Verification result: {verificationResultLabel}.
                </div>
                <div className="sync-status-row-detail">Mismatch counts by category: {trueMismatchCategorySummary.map(([category, count]) => `${category} (${count})`).join('; ') || 'none'}</div>
                <div className="sync-status-row-detail">Mismatch counts by entity: {trueMismatchEntitySummary.map(([entity, count]) => `${entity} (${count})`).join('; ') || 'none'}</div>
                {timestampDriftCount > 0 ? (
                  <div className="sync-status-row-detail">Informational timestamp drift only: {timestampDriftCount} record{timestampDriftCount === 1 ? '' : 's'} had differing updated timestamps while canonical content matched.</div>
                ) : null}
                {syncMeta.verificationSummary.verificationReadFailed ? (
                  <div className="sync-status-row-detail">
                    {verificationDiagnosticLabel}: kind {syncMeta.verificationSummary.verificationReadFailureKind ?? 'unknown'} • stage {syncMeta.verificationSummary.verificationReadFailureStage ?? 'unknown'} • attempts {syncMeta.verificationSummary.verificationReadAttempts}
                  </div>
                ) : null}
                <div className="sync-status-row-detail">Verification based on batch: {syncMeta.verificationSummary.basedOnBatchId ?? 'not tied to a committed batch'}</div>
                <button type="button" className="action-btn" onClick={() => {
                  if (!syncMeta.latestVerificationResult) return;
                  const report = exportVerificationIncident({
                    verificationResult: syncMeta.latestVerificationResult,
                    appVersion: typeof import.meta !== 'undefined'
                      ? (import.meta.env as ImportMetaEnv | undefined)?.VITE_APP_VERSION
                      : undefined,
                    lastConfirmedBatchId: syncMeta.lastConfirmedBatchId,
                    lastConfirmedCommittedAt: syncMeta.lastConfirmedBatchCommittedAt,
                    lastLocalWriteAt: syncMeta.lastLocalWriteAt,
                    cloudConfirmationStatus: syncMeta.cloudSyncStatus,
                    sessionTrustState: syncMeta.sessionTrustState,
                    degradedReason: syncMeta.sessionDegradedReason,
                    receiptMetadata: {
                      status: syncMeta.lastReceiptStatus,
                      hashMatch: syncMeta.lastReceiptHashMatch,
                      touchedTables: syncMeta.lastReceiptTouchedTables ? [...syncMeta.lastReceiptTouchedTables] : undefined,
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
            reviewedMismatchIds={[...syncMeta.reviewedMismatchIds]}
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
          <ConflictQueueCenter
            open={conflictOpen}
            onClose={() => setConflictOpen(false)}
            conflicts={syncMeta.conflictQueue}
            onMarkReviewed={(id) => syncMeta.markConflictReviewed(id)}
            onDismiss={(id) => syncMeta.dismissConflict(id)}
            onReverify={() => { void syncMeta.verifyNow('manual'); }}
          />

        </section>
      ) : null}
    </div>
  );
}
