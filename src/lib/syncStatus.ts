import type { PersistenceMode } from '../types';
import type { AppStore } from '../store/types';
import type {
  CloudSyncStatus,
  OperationCountsByEntity,
  ReceiptStatus,
  SessionDegradedReason,
  SessionTrustState,
  VerificationResult,
  VerificationState,
  VerificationSummary,
  SaveProofState,
} from '../store/state/types';

export type SyncState = 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';
export type SyncPrimaryState = 'checking' | 'saving' | 'saved' | 'needs-attention';
export type SyncTrustStage =
  | 'checking'
  | 'unsaved'
  | 'saving'
  | 'saved-local'
  | 'offline-pending'
  | 'cloud-confirmed'
  | 'verifying'
  | 'verified'
  | 'needs-attention';

export interface SyncMetaSnapshot {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  syncState: SyncState;
  saveError: string;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  cloudSyncStatus: CloudSyncStatus;
  pendingBatchCount: number;
  localRevision: number;
  lastCloudConfirmedRevision: number;
  localSaveState: 'idle' | 'saving' | 'saved' | 'error';
  cloudSyncState: 'idle' | 'queued' | 'sending' | 'confirmed' | 'failed' | 'conflict' | 'offline-pending';
  loadedFromLocalRecoveryCache: boolean;
  lastSyncedAt?: string;
  lastCloudConfirmedAt?: string;
  lastLocalWriteAt?: string;
  lastFallbackRestoreAt?: string;
  lastFailedSyncAt?: string;
  lastLoadFailureStage?: string;
  lastLoadFailureMessage?: string;
  lastLoadRecoveredWithLocalCache?: boolean;
  sessionTrustState: SessionTrustState;
  sessionDegraded: boolean;
  sessionDegradedReason: SessionDegradedReason;
  sessionDegradedAt?: string;
  sessionDegradedClearedByCloudSave: boolean;
  sessionTrustRecoveredAt?: string;
  lastSuccessfulPersistAt?: string;
  lastSuccessfulCloudPersistAt?: string;
  lastConfirmedBatchId?: string;
  lastConfirmedBatchCommittedAt?: string;
  lastReceiptStatus?: ReceiptStatus;
  lastReceiptHashMatch?: boolean;
  lastReceiptSchemaVersion?: number;
  lastReceiptTouchedTables?: string[];
  lastReceiptOperationCount?: number;
  lastReceiptOperationCountsByEntity?: OperationCountsByEntity;
  lastFailedBatchId?: string;
  verificationState: VerificationState;
  lastVerificationRunId?: string;
  lastVerificationStartedAt?: string;
  lastVerificationCompletedAt?: string;
  lastVerificationMatched?: boolean;
  lastVerificationMismatchCount?: number;
  lastVerificationBasedOnBatchId?: string;
  lastVerificationFailureMessage?: string;
  recoveryReviewNeeded: boolean;
  verificationSummary?: VerificationSummary;
  latestVerificationResult?: VerificationResult;
  reviewedMismatchIds: readonly string[];
  outboxState: 'idle' | 'queued' | 'flushing' | 'failed' | 'conflict';
  unresolvedOutboxCount: number;
  lastOutboxFlushAt?: string;
  lastOutboxFailureAt?: string;
  conflictReviewNeeded: boolean;
  openConflictCount: number;
  lastConflictDetectedAt?: string;
  lastConflictBatchId?: string;
  lastConflictFailureMessage?: string;
  connectivityState: 'online' | 'offline' | 'degraded';
  offlineLoadState: 'none' | 'loaded-from-offline-cache' | 'offline-no-cache';
  pendingOfflineChangeCount: number;
  lastFailureClass?: 'payload-invalid' | 'backend-setup' | 'network-transient' | 'rpc-receipt' | 'conflict-revision' | 'cloud-read-fallback' | 'unknown';
  lastFailureNonRetryable?: boolean;
  lastSanitizedFieldCount?: number;
  lastSanitizedEntityTypes?: string[];
  saveProof?: SaveProofState;
}

export interface SyncStatusModel {
  stage: SyncTrustStage;
  primaryState: SyncPrimaryState;
  stateLabel: string;
  stateDescription: string;
  reassurance: string;
  modeLabel: string;
  modeDescription: string;
  tone: 'default' | 'info' | 'warn';
  stateTone: 'info' | 'success' | 'warn' | 'danger';
  showSpinner: boolean;
  trustLabel?: string;
  trustDescription?: string;
  trustRecoveryMessage?: string;
}

export function getCloudConfirmationLabel(meta: Pick<SyncMetaSnapshot, 'cloudSyncStatus'>): string {
  switch (meta.cloudSyncStatus) {
    case 'cloud-confirmed':
      return 'Cloud confirmation complete';
    case 'pending-cloud':
      return 'Awaiting cloud confirmation';
    case 'local-only-confirmed':
      return 'Saved on this device';
    case 'local-newer-than-cloud':
      return 'Local copy newer than cloud';
    case 'local-recovery':
      return 'Opened with protected local copy';
    case 'cloud-read-failed-local-fallback':
      return 'Cloud read issue; protected local copy used';
    case 'cloud-save-failed-local-preserved':
      return 'Cloud save failed; local copy preserved';
    case 'load-failed-no-local-copy':
      return 'Could not confirm saved data';
    default:
      return 'Confirmation unavailable';
  }
}

export function selectSyncMetaSnapshot(state: AppStore): SyncMetaSnapshot {
  return {
    hydrated: state.hydrated,
    persistenceMode: state.persistenceMode,
    syncState: state.syncState,
    saveError: state.saveError,
    unsavedChangeCount: state.unsavedChangeCount,
    hasLocalUnsavedChanges: state.hasLocalUnsavedChanges,
    cloudSyncStatus: state.cloudSyncStatus,
    pendingBatchCount: state.pendingBatchCount,
    localRevision: state.localRevision,
    lastCloudConfirmedRevision: state.lastCloudConfirmedRevision,
    localSaveState: state.localSaveState,
    cloudSyncState: state.cloudSyncState,
    loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
    lastSyncedAt: state.lastSyncedAt,
    lastCloudConfirmedAt: state.lastCloudConfirmedAt,
    lastLocalWriteAt: state.lastLocalWriteAt,
    lastFallbackRestoreAt: state.lastFallbackRestoreAt,
    lastFailedSyncAt: state.lastFailedSyncAt,
    lastLoadFailureStage: state.lastLoadFailureStage,
    lastLoadFailureMessage: state.lastLoadFailureMessage,
    lastLoadRecoveredWithLocalCache: state.lastLoadRecoveredWithLocalCache,
    sessionTrustState: state.sessionTrustState,
    sessionDegraded: state.sessionDegraded,
    sessionDegradedReason: state.sessionDegradedReason,
    sessionDegradedAt: state.sessionDegradedAt,
    sessionDegradedClearedByCloudSave: state.sessionDegradedClearedByCloudSave,
    sessionTrustRecoveredAt: state.sessionTrustRecoveredAt,
    lastSuccessfulPersistAt: state.lastSuccessfulPersistAt,
    lastSuccessfulCloudPersistAt: state.lastSuccessfulCloudPersistAt,
    lastConfirmedBatchId: state.lastConfirmedBatchId,
    lastConfirmedBatchCommittedAt: state.lastConfirmedBatchCommittedAt,
    lastReceiptStatus: state.lastReceiptStatus,
    lastReceiptHashMatch: state.lastReceiptHashMatch,
    lastReceiptSchemaVersion: state.lastReceiptSchemaVersion,
    lastReceiptTouchedTables: state.lastReceiptTouchedTables,
    lastReceiptOperationCount: state.lastReceiptOperationCount,
    lastReceiptOperationCountsByEntity: state.lastReceiptOperationCountsByEntity,
    lastFailedBatchId: state.lastFailedBatchId,
    verificationState: state.verificationState,
    lastVerificationRunId: state.lastVerificationRunId,
    lastVerificationStartedAt: state.lastVerificationStartedAt,
    lastVerificationCompletedAt: state.lastVerificationCompletedAt,
    lastVerificationMatched: state.lastVerificationMatched,
    lastVerificationMismatchCount: state.lastVerificationMismatchCount,
    lastVerificationBasedOnBatchId: state.lastVerificationBasedOnBatchId,
    lastVerificationFailureMessage: state.lastVerificationFailureMessage,
    recoveryReviewNeeded: state.recoveryReviewNeeded,
    verificationSummary: state.verificationSummary,
    latestVerificationResult: state.latestVerificationResult,
    reviewedMismatchIds: state.reviewedMismatchIds,
    outboxState: state.outboxState,
    unresolvedOutboxCount: state.unresolvedOutboxCount,
    lastOutboxFlushAt: state.lastOutboxFlushAt,
    lastOutboxFailureAt: state.lastOutboxFailureAt,
    conflictReviewNeeded: state.conflictReviewNeeded,
    openConflictCount: state.openConflictCount,
    lastConflictDetectedAt: state.lastConflictDetectedAt,
    lastConflictBatchId: state.lastConflictBatchId,
    lastConflictFailureMessage: state.lastConflictFailureMessage,
    connectivityState: state.connectivityState,
    offlineLoadState: state.offlineLoadState,
    pendingOfflineChangeCount: state.pendingOfflineChangeCount,
    lastFailureClass: state.lastFailureClass,
    lastFailureNonRetryable: state.lastFailureNonRetryable,
    lastSanitizedFieldCount: state.lastSanitizedFieldCount,
    lastSanitizedEntityTypes: state.lastSanitizedEntityTypes,
    saveProof: state.saveProof,
  };
}

function describePersistenceMode(mode: PersistenceMode, backendSetupBlocked: boolean): Pick<SyncStatusModel, 'modeLabel' | 'modeDescription'> {
  if (backendSetupBlocked) {
    return {
      modeLabel: 'Protected local fallback',
      modeDescription: 'Signed in to cloud, but writes are protected locally until backend setup is complete.',
    };
  }
  if (mode === 'supabase') {
    return {
      modeLabel: 'Cloud-backed',
      modeDescription: 'SetPoint saves to your account and keeps a protected local copy.',
    };
  }

  if (mode === 'tauri-sqlite') {
    return {
      modeLabel: 'Local on this device',
      modeDescription: 'SetPoint saves on this device profile.',
    };
  }

  if (mode === 'browser') {
    return {
      modeLabel: 'Local-only (this device)',
      modeDescription: 'SetPoint saves in this browser profile only.',
    };
  }

  return {
    modeLabel: 'Checking save mode',
    modeDescription: 'SetPoint is determining where saves are stored.',
  };
}

function getAttentionNarrative(meta: SyncMetaSnapshot): Pick<SyncStatusModel, 'stateDescription' | 'reassurance' | 'tone' | 'stateTone'> {

  if (meta.sessionDegradedReason === 'payload-invalid') {
    return {
      reassurance: 'Your local copy is safe.',
      stateDescription: 'Cloud save is paused because one or more records contained invalid text content. Sync resumes after content is repaired.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }
  if (meta.sessionDegradedReason === 'load-failed-no-local-copy') {
    return {
      reassurance: 'Save or load confirmation needs review.',
      stateDescription: 'SetPoint could not confirm saved data. Save once workspace is rebuilt to restore trust.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'cloud-save-failed') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'A cloud save failed. Retry a confirmed cloud save to restore session trust.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'backend-rpc-missing') {
    return {
      reassurance: 'Changes are saved locally.',
      stateDescription: 'Changes are saved locally. Cloud sync is blocked because apply_save_batch is missing.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'backend-missing-hashing-support') {
    return {
      reassurance: 'Changes are saved locally.',
      stateDescription: 'Changes are saved locally. Cloud persistence backend hashing failed due to a stale digest() dependency.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'backend-schema-mismatch') {
    return {
      reassurance: 'Changes are saved locally.',
      stateDescription: 'Changes are saved locally. Cloud sync is blocked until the Supabase schema is updated.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'cloud-read-failed-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'This session opened from protected local data after a cloud read issue. Confirm one cloud save to restore trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.sessionDegradedReason === 'local-newer-than-cloud') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'Local data was newer than cloud data. Confirm one cloud save to realign trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.sessionDegradedReason === 'local-recovery-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened with protected local data. Confirm one cloud save to restore trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-save-failed-local-preserved') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'Your recent changes were kept locally. Review save status and retry.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-read-failed-local-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened your protected local copy because cloud data could not be confirmed.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-newer-than-cloud') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint restored the newer local copy to avoid data loss.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-recovery' || meta.loadedFromLocalRecoveryCache) {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened using protected local data while save confirmation needs review.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'load-failed-no-local-copy') {
    return {
      reassurance: 'Save or load confirmation needs review.',
      stateDescription: 'SetPoint could not confirm saved data. Review technical details.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  return {
    reassurance: 'Save confirmation needs review.',
    stateDescription: 'SetPoint protected your recent work, but save or load confirmation needs review.',
    tone: 'warn',
    stateTone: 'warn',
  };
}


export function getSyncStatusModel(meta: SyncMetaSnapshot): SyncStatusModel {
  const backendSetupBlocked = meta.sessionDegradedReason === 'backend-rpc-missing'
    || meta.sessionDegradedReason === 'backend-schema-mismatch'
    || meta.sessionDegradedReason === 'backend-missing-hashing-support';
  const modeDetails = describePersistenceMode(meta.persistenceMode, backendSetupBlocked);

  if (!meta.hydrated || meta.syncState === 'checking' || meta.persistenceMode === 'loading') {
    return {
      stage: 'checking',
      primaryState: 'checking',
      stateLabel: 'Checking save status',
      stateDescription: 'Loading your workspace and save status.',
      reassurance: 'Checking save status…',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  const fallbackAttention = meta.cloudSyncStatus === 'local-recovery'
    || meta.cloudSyncStatus === 'local-newer-than-cloud'
    || meta.cloudSyncStatus === 'cloud-read-failed-local-fallback'
    || meta.cloudSyncStatus === 'cloud-save-failed-local-preserved'
    || meta.cloudSyncStatus === 'load-failed-no-local-copy';
  const hasHardFailure = meta.syncState === 'error' || meta.cloudSyncState === 'failed' || meta.cloudSyncState === 'conflict' || meta.sessionDegraded || fallbackAttention;
  const hasLocalOnly = meta.cloudSyncState === 'offline-pending' || meta.loadedFromLocalRecoveryCache || meta.lastCloudConfirmedRevision < meta.localRevision;
  const queuedWithActiveUnsavedWork = meta.cloudSyncState === 'queued'
    && (meta.syncState === 'dirty' || meta.outboxState === 'flushing' || meta.hasLocalUnsavedChanges || meta.unsavedChangeCount > 0);
  const isSaving = meta.syncState === 'saving' || meta.localSaveState === 'saving' || meta.cloudSyncState === 'sending' || queuedWithActiveUnsavedWork;

  if (hasHardFailure) {
    const isBackendSetupIssue = meta.sessionDegradedReason === 'backend-rpc-missing'
      || meta.sessionDegradedReason === 'backend-schema-mismatch'
      || meta.sessionDegradedReason === 'backend-missing-hashing-support';
    const narrative = getAttentionNarrative(meta);
    return {
      stage: 'needs-attention',
      primaryState: isBackendSetupIssue ? 'saved' : 'needs-attention',
      stateLabel: isBackendSetupIssue
        ? 'Needs attention'
        : meta.sessionDegradedReason === 'payload-invalid'
          ? 'Repair needed'
          : fallbackAttention
            ? 'Needs attention'
            : 'Retry needed',
      stateDescription: isBackendSetupIssue ? 'Cloud setup is blocked; local protection remains active.' : narrative.stateDescription,
      reassurance: isBackendSetupIssue
        ? 'Changes are saved locally. Cloud setup is required to resume sync.'
        : narrative.reassurance,
      tone: narrative.tone,
      stateTone: isBackendSetupIssue ? 'danger' : narrative.stateTone,
      showSpinner: false,
      ...modeDetails,
      trustLabel: meta.sessionDegradedReason === 'backend-rpc-missing'
        ? 'Cloud trust blocked by missing RPC'
        : meta.sessionDegradedReason === 'backend-missing-hashing-support'
          ? 'Cloud trust blocked by backend hashing failure'
          : meta.sessionDegradedReason === 'backend-schema-mismatch'
            ? 'Cloud trust blocked by schema mismatch'
            : undefined,
      trustDescription: meta.sessionDegradedReason === 'backend-rpc-missing'
        ? 'Changes are saved locally. Cloud sync is blocked because apply_save_batch is missing.'
        : meta.sessionDegradedReason === 'backend-missing-hashing-support'
          ? 'Changes are saved locally. Cloud persistence backend hashing failed due to a stale digest() dependency.'
          : meta.sessionDegradedReason === 'backend-schema-mismatch'
            ? 'Changes are saved locally. Cloud sync is blocked until the Supabase schema is updated.'
            : undefined,
    };
  }

  const hasVerifiedMismatchSummary = (meta.verificationState === 'mismatch-found' || meta.recoveryReviewNeeded)
    && Boolean(meta.verificationSummary && meta.verificationSummary.mismatchCount > 0);

  if (hasVerifiedMismatchSummary || meta.conflictReviewNeeded || meta.outboxState === 'conflict') {
    return {
      stage: 'needs-attention',
      primaryState: 'needs-attention',
      stateLabel: 'Needs attention',
      stateDescription: 'Review recovery or conflict details to confirm trusted sync state.',
      reassurance: 'Your local changes are preserved while review is pending.',
      tone: 'warn',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  const hasUnsavedWork = meta.hasLocalUnsavedChanges || meta.unsavedChangeCount > 0 || meta.syncState === 'dirty';

  if (hasUnsavedWork && !isSaving) {
    return {
      stage: 'unsaved',
      primaryState: 'saving',
      stateLabel: 'Unsaved changes',
      stateDescription: 'Recent edits have not been written to local durable storage yet.',
      reassurance: 'Keep editing — FollowUp HQ is preparing your changes to save.',
      tone: 'info',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (isSaving) {
    return {
      stage: 'saving',
      primaryState: 'saving',
      stateLabel: 'Saving changes',
      stateDescription: 'Writing your latest edits to local storage and sync queue.',
      reassurance: 'Saving in progress…',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  const hasPendingCloudReplay = meta.persistenceMode === 'supabase'
    && (
      meta.cloudSyncStatus === 'pending-cloud'
      || meta.localRevision > meta.lastCloudConfirmedRevision
      || meta.cloudSyncState === 'queued'
      || meta.cloudSyncState === 'sending'
      || meta.outboxState === 'queued'
      || meta.outboxState === 'flushing'
      || meta.unresolvedOutboxCount > 0
      || meta.pendingBatchCount > 0
    );

  if (meta.cloudSyncState === 'offline-pending' || (meta.connectivityState === 'offline' && (meta.pendingOfflineChangeCount > 0 || hasPendingCloudReplay))) {
    return {
      stage: 'offline-pending',
      primaryState: 'saved',
      stateLabel: 'Offline — queued locally',
      stateDescription: 'Changes are protected locally and queued for cloud replay when online.',
      reassurance: 'Your local copy is safe. Cloud confirmation resumes after reconnect.',
      tone: 'info',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (hasPendingCloudReplay) {
    return {
      stage: 'saved-local',
      primaryState: 'saved',
      stateLabel: 'Saved locally, awaiting cloud',
      stateDescription: 'Local save is complete. Waiting for cloud confirmation.',
      reassurance: 'Local protection is complete while cloud confirmation finishes.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: false,
      ...modeDetails,
    };
  }

  const verificationRunAppearsActive = meta.verificationState === 'running'
    || (meta.verificationState === 'pending' && (!meta.lastVerificationCompletedAt || (meta.lastVerificationStartedAt ?? '') > meta.lastVerificationCompletedAt));

  if (verificationRunAppearsActive) {
    return {
      stage: 'verifying',
      primaryState: 'saved',
      stateLabel: 'Verifying current cloud state',
      stateDescription: 'Cloud save is committed; re-reading cloud data to verify current match.',
      reassurance: 'Saved state is committed. Verification is running in the background.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  if (meta.verificationState === 'verified-match' || meta.verificationSummary?.verified) {
    return {
      stage: 'verified',
      primaryState: 'saved',
      stateLabel: 'Verified',
      stateDescription: 'Verified match with current cloud data.',
      reassurance: 'Verified match with current cloud data.',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (meta.verificationState === 'read-failed' || meta.verificationSummary?.verificationReadFailed) {
    return {
      stage: 'needs-attention',
      primaryState: 'needs-attention',
      stateLabel: 'Needs attention',
      stateDescription: 'Cloud verification could not complete right now. Saved state is unchanged.',
      reassurance: 'Your current saved state remains intact. Retry verification.',
      tone: 'warn',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (meta.persistenceMode === 'browser' && !meta.sessionDegraded) {
    return {
      stage: 'saved-local',
      primaryState: 'saved',
      stateLabel: 'Saved locally',
      stateDescription: 'Changes are saved on this device profile only.',
      reassurance: 'Local-only save is active for this browser profile.',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (hasLocalOnly) {
    const cloudBackedMode = meta.persistenceMode === 'supabase';
    const localLabel = cloudBackedMode ? 'Saved locally, awaiting cloud' : 'Saved locally';
    const localDescription = cloudBackedMode
      ? 'Changes are durably saved locally while cloud confirmation catches up.'
      : 'Changes are saved on this device.';
    return {
      stage: 'saved-local',
      primaryState: 'saved',
      stateLabel: localLabel,
      stateDescription: localDescription,
      reassurance: localDescription,
      tone: 'info',
      stateTone: 'info',
      showSpinner: false,
      ...modeDetails,
    };
  }

  return {
    stage: 'cloud-confirmed',
    primaryState: 'saved',
    stateLabel: 'Cloud confirmed',
    stateDescription: 'Latest save is confirmed by cloud receipt.',
    reassurance: 'Cloud confirmation complete.',
    tone: 'default',
    stateTone: 'success',
    showSpinner: false,
    ...modeDetails,
  };
}
