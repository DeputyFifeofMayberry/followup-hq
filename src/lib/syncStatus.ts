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
} from '../store/state/types';

export type SyncState = 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';
export type SyncPrimaryState = 'checking' | 'saving' | 'saved' | 'needs-attention';

export interface SyncMetaSnapshot {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  syncState: SyncState;
  saveError: string;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  cloudSyncStatus: CloudSyncStatus;
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
}

export interface SyncStatusModel {
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
      primaryState: 'checking',
      stateLabel: 'Saving…',
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
      primaryState: isBackendSetupIssue ? 'saved' : 'needs-attention',
      stateLabel: isBackendSetupIssue
        ? 'Saved locally'
        : meta.sessionDegradedReason === 'payload-invalid'
          ? 'Repair needed'
          : fallbackAttention
            ? 'Needs attention'
            : 'Retry needed',
      stateDescription: isBackendSetupIssue ? 'Cloud setup required' : narrative.stateDescription,
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

  if (meta.verificationState === 'verified-match' || meta.verificationSummary?.verified) {
    return {
      primaryState: 'saved',
      stateLabel: 'Saved',
      stateDescription: 'Verified match with current cloud data.',
      reassurance: 'Verified match with current cloud data.',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (isSaving) {
    return {
      primaryState: 'saving',
      stateLabel: 'Saving…',
      stateDescription: 'Saving latest changes in the background.',
      reassurance: 'Saving…',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  if (meta.persistenceMode === 'browser' && !meta.sessionDegraded) {
    return {
      primaryState: 'saved',
      stateLabel: 'Saved',
      stateDescription: 'Changes saved on this device; cloud sync will resume automatically',
      reassurance: 'Changes saved on this device; cloud sync will resume automatically',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (hasLocalOnly) {
    return {
      primaryState: 'saved',
      stateLabel: 'Saved locally',
      stateDescription: 'Changes saved on this device; cloud sync will resume automatically',
      reassurance: 'Changes saved on this device; cloud sync will resume automatically',
      tone: 'info',
      stateTone: 'info',
      showSpinner: false,
      ...modeDetails,
    };
  }

  return {
    primaryState: 'saved',
    stateLabel: 'Saved',
    stateDescription: 'All changes saved',
    reassurance: 'All changes saved',
    tone: 'default',
    stateTone: 'success',
    showSpinner: false,
    ...modeDetails,
  };
}
