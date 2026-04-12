import type { PersistenceMode } from '../types';
import type { AppStore } from '../store/types';
import { deriveCanonicalSaveProofStatus } from '../store/saveProofModel';
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
export type SyncTrustStage = 'checking' | 'editing' | 'saving' | 'saved-locally' | 'queued-for-cloud' | 'cloud-confirmed' | 'cloud-verified' | 'verification-stale' | 'needs-attention';

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

export interface SyncStatusToastAnnouncement {
  key: string;
  tone: 'success';
  title: string;
  message: string;
  durationMs: number;
  source: 'sync.status.cloud_confirmed' | 'sync.status.verified';
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

  const canonical = deriveCanonicalSaveProofStatus({ ...meta, saveProof: meta.saveProof ?? { cloudProofState: 'pending' } });
  const verificationRunAppearsActive = meta.verificationState === 'running'
    || (meta.verificationState === 'pending' && (!meta.lastVerificationCompletedAt || (meta.lastVerificationStartedAt ?? '') > meta.lastVerificationCompletedAt));

  if (canonical.stage === 'needs-attention') {
    const isBackendSetupIssue = meta.sessionDegradedReason === 'backend-rpc-missing'
      || meta.sessionDegradedReason === 'backend-schema-mismatch'
      || meta.sessionDegradedReason === 'backend-missing-hashing-support';
    const narrative = getAttentionNarrative(meta);
    return {
      stage: 'needs-attention',
      primaryState: isBackendSetupIssue ? 'saved' : 'needs-attention',
      stateLabel: 'Save needs attention',
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

  if (canonical.stage === 'editing') {
    return {
      stage: 'editing',
      primaryState: 'saving',
      stateLabel: 'Editing',
      stateDescription: 'Recent edits are not yet durably saved on this device.',
      reassurance: 'Keep editing — FollowUp HQ will save automatically.',
      tone: 'info',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (canonical.stage === 'saving') {
    return {
      stage: 'saving',
      primaryState: 'saving',
      stateLabel: 'Saving changes',
      stateDescription: 'Writing local durable state and sending queued cloud work.',
      reassurance: 'Saving in progress…',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  if (canonical.stage === 'saved-locally') {
    return {
      stage: 'saved-locally',
      primaryState: 'saved',
      stateLabel: 'Saved on this device',
      stateDescription: 'Local protection is complete. Cloud confirmation has not completed yet.',
      reassurance: 'Local protection complete.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (canonical.stage === 'queued-for-cloud') {
    return {
      stage: 'queued-for-cloud',
      primaryState: 'saved',
      stateLabel: 'Queued for cloud',
      stateDescription: meta.connectivityState === 'offline'
        ? 'Changes are protected locally and queued for cloud replay after reconnect.'
        : 'Changes are protected locally and queued until cloud commit confirmation catches up.',
      reassurance: 'Saved on this device; cloud work is queued.',
      tone: 'warn',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (canonical.stage === 'cloud-verified') {
    return {
      stage: 'cloud-verified',
      primaryState: 'saved',
      stateLabel: 'Cloud match verified',
      stateDescription: 'Cloud read-back verification matches the current revision.',
      reassurance: 'Cloud match verified.',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (canonical.stage === 'verification-stale') {
    return {
      stage: 'verification-stale',
      primaryState: 'saved',
      stateLabel: 'Verification stale',
      stateDescription: 'Cloud commit is current, but newer edits made the last verification stale.',
      reassurance: 'Cloud commit is confirmed; verification is stale for the latest revision.',
      tone: 'warn',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  return {
    stage: 'cloud-confirmed',
    primaryState: 'saved',
    stateLabel: verificationRunAppearsActive ? 'Cloud save committed (verifying)' : 'Cloud save committed',
    stateDescription: verificationRunAppearsActive
      ? 'Cloud commit is confirmed and read-back verification is running.'
      : 'Cloud commit receipt confirms the latest saved revision.',
    reassurance: verificationRunAppearsActive ? 'Cloud commit confirmed; verification in progress.' : 'Cloud commit confirmed.',
    tone: 'default',
    stateTone: 'success',
    showSpinner: verificationRunAppearsActive,
    ...modeDetails,
  };
}

export function getSyncStatusToastAnnouncement(
  meta: Pick<SyncMetaSnapshot, 'hasLocalUnsavedChanges' | 'pendingBatchCount' | 'cloudSyncState' | 'localRevision' | 'lastCloudConfirmedRevision' | 'lastConfirmedBatchId' | 'saveProof'>,
  input: { stage: SyncTrustStage; previousStage: SyncTrustStage | null },
): SyncStatusToastAnnouncement | null {
  const cloudCommitCurrentForRevision = !meta.hasLocalUnsavedChanges
    && meta.pendingBatchCount === 0
    && meta.cloudSyncState === 'confirmed'
    && meta.localRevision === meta.lastCloudConfirmedRevision;

  if (!cloudCommitCurrentForRevision) return null;

  if (input.stage === 'cloud-confirmed' && input.previousStage !== 'cloud-verified') {
    return {
      key: `cloud-confirmed:${meta.lastConfirmedBatchId ?? 'none'}:${meta.localRevision}:${meta.lastCloudConfirmedRevision}`,
      tone: 'success',
      title: 'Cloud save committed',
      message: 'Latest batch is committed in cloud storage. Verification can run separately.',
      durationMs: 1800,
      source: 'sync.status.cloud_confirmed',
    };
  }

  if (input.stage === 'cloud-verified') {
    return {
      key: `cloud-verified:${meta.saveProof?.latestVerifiedBatchId ?? meta.lastConfirmedBatchId ?? 'none'}:${meta.saveProof?.latestVerifiedRevision ?? meta.localRevision}`,
      tone: 'success',
      title: 'Cloud match verified',
      message: 'Current local state matches the latest cloud read-back.',
      durationMs: 2000,
      source: 'sync.status.verified',
    };
  }

  return null;
}
