import type { AppMetaState } from './state/types';

export type CanonicalSaveProofStage =
  | 'editing'
  | 'saving'
  | 'saved-locally'
  | 'queued-for-cloud'
  | 'cloud-confirmed'
  | 'cloud-verified'
  | 'verification-stale'
  | 'needs-attention';

export interface SaveProofStatusDetails {
  stage: CanonicalSaveProofStage;
  stageLabel: string;
  stageDescription: string;
  latestLocalWriteAt?: string;
  latestCloudCommitAt?: string;
  latestVerificationAt?: string;
  verificationFreshForCurrentRevision: boolean;
  cloudConfirmationCurrentForRevision: boolean;
  localAheadOfCloudConfirmedRevision: boolean;
  localAheadOfVerifiedRevision: boolean;
  isLocallyProtectedOnly: boolean;
  isFullyCloudVerified: boolean;
}

export type SaveProofModelInput = Pick<AppMetaState,
  | 'persistenceMode'
  | 'syncState'
  | 'localSaveState'
  | 'cloudSyncState'
  | 'outboxState'
  | 'hasLocalUnsavedChanges'
  | 'unsavedChangeCount'
  | 'pendingBatchCount'
  | 'unresolvedOutboxCount'
  | 'connectivityState'
  | 'localRevision'
  | 'lastCloudConfirmedRevision'
  | 'sessionDegraded'
  | 'sessionDegradedReason'
  | 'conflictReviewNeeded'
  | 'openConflictCount'
  | 'recoveryReviewNeeded'
  | 'verificationState'
  | 'lastVerificationMatched'
  | 'lastVerificationBasedOnBatchId'
  | 'lastConfirmedBatchId'
  | 'saveProof'
>;

const ATTENTION_VERIFICATION_STATES = new Set(['mismatch-found', 'read-failed', 'failed']);

export function deriveCanonicalSaveProofStatus(input: SaveProofModelInput): SaveProofStatusDetails {
  const verificationRevision = input.saveProof.latestVerifiedRevision;
  const verificationFreshForCurrentRevision = Boolean(
    input.lastVerificationMatched
      && verificationRevision !== undefined
      && verificationRevision === input.localRevision
      && input.saveProof.latestVerifiedBatchId
      && input.lastConfirmedBatchId
      && input.saveProof.latestVerifiedBatchId === input.lastConfirmedBatchId
      && input.lastVerificationBasedOnBatchId === input.lastConfirmedBatchId,
  );
  const localAheadOfCloudConfirmedRevision = input.localRevision > input.lastCloudConfirmedRevision;
  const localAheadOfVerifiedRevision = verificationRevision !== undefined
    ? input.localRevision > verificationRevision
    : input.localRevision > 0;
  const cloudConfirmationCurrentForRevision = input.persistenceMode === 'supabase'
    ? !localAheadOfCloudConfirmedRevision && input.saveProof.cloudProofState === 'confirmed'
    : true;

  const needsAttention = input.sessionDegraded
    || input.syncState === 'error'
    || input.cloudSyncState === 'failed'
    || input.cloudSyncState === 'conflict'
    || input.outboxState === 'conflict'
    || input.conflictReviewNeeded
    || input.openConflictCount > 0
    || input.recoveryReviewNeeded
    || ATTENTION_VERIFICATION_STATES.has(input.verificationState);

  if (needsAttention) {
    return {
      stage: 'needs-attention',
      stageLabel: 'Save needs attention',
      stageDescription: 'A save or trust condition requires review before cloud trust can be relied on.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision,
      cloudConfirmationCurrentForRevision,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: true,
      isFullyCloudVerified: false,
    };
  }

  const editing = input.hasLocalUnsavedChanges || input.unsavedChangeCount > 0 || input.syncState === 'dirty';
  if (editing) {
    return {
      stage: 'editing',
      stageLabel: 'Editing',
      stageDescription: 'Recent edits are in progress and have not reached durable local storage yet.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision,
      cloudConfirmationCurrentForRevision,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: true,
      isFullyCloudVerified: false,
    };
  }

  const saving = input.syncState === 'saving'
    || input.localSaveState === 'saving'
    || input.cloudSyncState === 'sending'
    || input.outboxState === 'flushing';
  if (saving) {
    return {
      stage: 'saving',
      stageLabel: 'Saving',
      stageDescription: 'Writing local durable state and advancing queued cloud work.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision,
      cloudConfirmationCurrentForRevision,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: true,
      isFullyCloudVerified: false,
    };
  }

  if (input.persistenceMode !== 'supabase') {
    return {
      stage: 'saved-locally',
      stageLabel: 'Saved on this device',
      stageDescription: 'Local durable protection is complete for this device profile.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: undefined,
      latestVerificationAt: undefined,
      verificationFreshForCurrentRevision: false,
      cloudConfirmationCurrentForRevision: true,
      localAheadOfCloudConfirmedRevision: false,
      localAheadOfVerifiedRevision: false,
      isLocallyProtectedOnly: true,
      isFullyCloudVerified: false,
    };
  }

  const hasQueuedCloudWork = input.cloudSyncState === 'offline-pending'
    || input.cloudSyncState === 'queued'
    || input.outboxState === 'queued'
    || input.pendingBatchCount > 0
    || input.unresolvedOutboxCount > 0
    || localAheadOfCloudConfirmedRevision;

  if (hasQueuedCloudWork) {
    const offline = input.cloudSyncState === 'offline-pending' || input.connectivityState === 'offline';
    return {
      stage: 'queued-for-cloud',
      stageLabel: offline ? 'Queued for cloud (offline)' : 'Queued for cloud',
      stageDescription: offline
        ? 'Changes are protected locally and queued for cloud replay once online.'
        : 'Changes are protected locally and queued until cloud commit confirmation is current.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision,
      cloudConfirmationCurrentForRevision,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: true,
      isFullyCloudVerified: false,
    };
  }

  if (verificationFreshForCurrentRevision) {
    return {
      stage: 'cloud-verified',
      stageLabel: 'Cloud match verified',
      stageDescription: 'Cloud read-back verification matches the current local revision.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision: true,
      cloudConfirmationCurrentForRevision: true,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: false,
      isFullyCloudVerified: true,
    };
  }

  if (input.saveProof.latestVerifiedAt && localAheadOfVerifiedRevision) {
    return {
      stage: 'verification-stale',
      stageLabel: 'Verification stale due to newer edits',
      stageDescription: 'A previous cloud verification exists, but it no longer covers the current revision.',
      latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
      latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
      latestVerificationAt: input.saveProof.latestVerifiedAt,
      verificationFreshForCurrentRevision: false,
      cloudConfirmationCurrentForRevision,
      localAheadOfCloudConfirmedRevision,
      localAheadOfVerifiedRevision,
      isLocallyProtectedOnly: false,
      isFullyCloudVerified: false,
    };
  }

  return {
    stage: 'cloud-confirmed',
    stageLabel: 'Cloud save committed',
    stageDescription: 'Cloud commit receipt confirms the latest revision, with verification available separately.',
    latestLocalWriteAt: input.saveProof.latestDurableLocalWriteAt,
    latestCloudCommitAt: input.saveProof.latestCloudConfirmedCommitAt,
    latestVerificationAt: input.saveProof.latestVerifiedAt,
    verificationFreshForCurrentRevision: false,
    cloudConfirmationCurrentForRevision,
    localAheadOfCloudConfirmedRevision,
    localAheadOfVerifiedRevision,
    isLocallyProtectedOnly: false,
    isFullyCloudVerified: false,
  };
}
