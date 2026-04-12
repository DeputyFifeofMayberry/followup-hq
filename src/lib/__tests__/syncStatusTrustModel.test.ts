import { getSyncStatusModel, getSyncStatusToastAnnouncement, selectSyncMetaSnapshot } from '../syncStatus';
import type { AppStore } from '../../store/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function baseMeta() {
  return {
    hydrated: true,
    persistenceMode: 'supabase',
    syncState: 'saved',
    saveError: '',
    unsavedChangeCount: 0,
    hasLocalUnsavedChanges: false,
    cloudSyncStatus: 'cloud-confirmed',
    pendingBatchCount: 0,
    localRevision: 1,
    lastCloudConfirmedRevision: 1,
    localSaveState: 'saved',
    cloudSyncState: 'confirmed',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T10:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T10:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:00:00.000Z',
    sessionTrustState: 'healthy',
    sessionDegraded: false,
    sessionDegradedReason: 'none',
    sessionDegradedClearedByCloudSave: false,
    verificationState: 'idle',
    recoveryReviewNeeded: false,
    reviewedMismatchIds: [],
    outboxState: 'idle',
    unresolvedOutboxCount: 0,
    conflictReviewNeeded: false,
    openConflictCount: 0,
    connectivityState: 'online',
    offlineLoadState: 'none',
    pendingOfflineChangeCount: 0,
    saveProof: {
      cloudProofState: 'confirmed',
      latestDurableLocalWriteAt: '2026-04-05T10:00:00.000Z',
      latestCloudConfirmedCommitAt: '2026-04-05T10:00:00.000Z',
      latestCloudConfirmedBatchId: 'batch-1',
    },
  } as const;
}

function testCloudCommittedLabeling(): void {
  const model = getSyncStatusModel(baseMeta());
  assert(model.stage === 'cloud-confirmed', `expected cloud-confirmed stage, got ${model.stage}`);
  assert(model.stateLabel === 'Cloud save committed', `expected Cloud save committed label, got ${model.stateLabel}`);
  assert(model.stateDescription.includes('Cloud commit receipt'), `expected cloud commit receipt messaging, got ${model.stateDescription}`);
}

function testCloudVerifiedIsDistinctFromCommitted(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    lastVerificationMatched: true,
    lastVerificationBasedOnBatchId: 'batch-1',
    lastConfirmedBatchId: 'batch-1',
    saveProof: {
      ...baseMeta().saveProof,
      latestVerifiedAt: '2026-04-05T10:01:00.000Z',
      latestVerifiedBatchId: 'batch-1',
      latestVerifiedRevision: 1,
    },
  });
  assert(model.stage === 'cloud-verified', `expected cloud-verified stage, got ${model.stage}`);
  assert(model.stateLabel === 'Cloud match verified', `expected Cloud match verified label, got ${model.stateLabel}`);
}

function testVerificationStaleIsDistinctFromVerified(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    localRevision: 2,
    lastCloudConfirmedRevision: 2,
    saveProof: {
      ...baseMeta().saveProof,
      latestVerifiedAt: '2026-04-05T10:01:00.000Z',
      latestVerifiedBatchId: 'batch-1',
      latestVerifiedRevision: 1,
    },
  });
  assert(model.stage === 'verification-stale', `expected verification-stale stage, got ${model.stage}`);
  assert(model.stateLabel === 'Verification stale', `expected verification stale label, got ${model.stateLabel}`);
}

function testVerifiedSummaryWithoutCurrentRevisionProofStaysCommitted(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    localRevision: 4,
    lastCloudConfirmedRevision: 4,
    lastVerificationMatched: true,
    lastVerificationBasedOnBatchId: 'batch-1',
    verificationSummary: {
      verified: true,
      mismatchCount: 0,
    } as any,
    saveProof: {
      ...baseMeta().saveProof,
      latestVerifiedAt: '2026-04-05T10:01:00.000Z',
      latestVerifiedBatchId: 'batch-1',
      latestVerifiedRevision: 3,
    },
  });
  assert(model.stage === 'verification-stale', `expected stale stage when verification is for older revision, got ${model.stage}`);
}

function testSavedLocallyDoesNotProjectCloudSuccess(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    persistenceMode: 'browser',
    cloudSyncStatus: 'local-only-confirmed',
    lastCloudConfirmedAt: undefined,
  });
  assert(model.stage === 'saved-locally', `expected saved-locally stage, got ${model.stage}`);
  assert(model.stateLabel === 'Saved on this device', `expected saved-on-device label, got ${model.stateLabel}`);
  assert(model.stateTone === 'info', `local-only saved should stay informational, got ${model.stateTone}`);
}

function testQueuedForCloudIsCautionary(): void {
  const onlineQueued = getSyncStatusModel({
    ...baseMeta(),
    localRevision: 2,
    lastCloudConfirmedRevision: 1,
    cloudSyncState: 'queued',
    pendingBatchCount: 1,
    saveProof: {
      ...baseMeta().saveProof,
      cloudProofState: 'pending',
    },
  });
  assert(onlineQueued.stage === 'queued-for-cloud', `expected queued-for-cloud stage, got ${onlineQueued.stage}`);
  assert(onlineQueued.stateTone === 'warn', `expected warning tone for queued cloud work, got ${onlineQueued.stateTone}`);

  const offlineQueued = getSyncStatusModel({
    ...baseMeta(),
    localRevision: 2,
    lastCloudConfirmedRevision: 1,
    cloudSyncState: 'offline-pending',
    connectivityState: 'offline',
    saveProof: {
      ...baseMeta().saveProof,
      cloudProofState: 'pending',
    },
  });
  assert(offlineQueued.stateDescription.includes('replay after reconnect'), `expected offline replay wording, got ${offlineQueued.stateDescription}`);
}

function testNeedsAttentionOverridesOptimisticStates(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    sessionDegraded: true,
    sessionDegradedReason: 'backend-rpc-missing',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
  });
  assert(model.stage === 'needs-attention', `expected needs-attention stage, got ${model.stage}`);
  assert(model.stateLabel === 'Save needs attention', `expected save-needs-attention label, got ${model.stateLabel}`);
  assert(model.stateDescription === 'Cloud setup is blocked; local protection remains active.', `unexpected backend setup messaging: ${model.stateDescription}`);
}

function testExplicitPipelineEditingAndSavingStates(): void {
  const editing = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'dirty',
    hasLocalUnsavedChanges: true,
    unsavedChangeCount: 1,
  });
  assert(editing.stage === 'editing', `expected editing stage, got ${editing.stage}`);

  const saving = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'saving',
    localSaveState: 'saving',
    cloudSyncState: 'sending',
  });
  assert(saving.stage === 'saving', `expected saving stage, got ${saving.stage}`);

  const verifying = getSyncStatusModel({
    ...baseMeta(),
    verificationState: 'pending',
    lastVerificationStartedAt: '2026-04-11T12:00:00.000Z',
  });
  assert(verifying.stateLabel === 'Cloud save committed (verifying)', `expected explicit verifying label, got ${verifying.stateLabel}`);
}

function testSharedSnapshotSelectorConsistency(): void {
  const state = {
    hydrated: true,
    persistenceMode: 'supabase',
    syncState: 'saved',
    saveError: '',
    unsavedChangeCount: 0,
    hasLocalUnsavedChanges: false,
    cloudSyncStatus: 'pending-cloud',
    localRevision: 2,
    lastCloudConfirmedRevision: 1,
    localSaveState: 'saved',
    cloudSyncState: 'queued',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T09:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T09:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:00:00.000Z',
    lastLoadFailureStage: 'user_preferences',
    lastLoadFailureMessage: 'relation "user_preferences" does not exist',
    lastLoadRecoveredWithLocalCache: true,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-read-failed-fallback',
    sessionDegradedAt: '2026-04-05T08:59:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    lastSuccessfulPersistAt: '2026-04-05T09:00:00.000Z',
    lastSuccessfulCloudPersistAt: '2026-04-05T09:00:00.000Z',
    lastConfirmedBatchId: 'batch-123',
    lastConfirmedBatchCommittedAt: '2026-04-05T09:00:00.000Z',
    lastReceiptStatus: 'committed',
    lastReceiptHashMatch: true,
    lastReceiptSchemaVersion: 1,
    lastReceiptTouchedTables: ['follow_up_items'],
    lastReceiptOperationCount: 3,
    lastReceiptOperationCountsByEntity: {
      items: { upserts: 3, deletes: 0 },
      tasks: { upserts: 0, deletes: 0 },
      projects: { upserts: 0, deletes: 0 },
      contacts: { upserts: 0, deletes: 0 },
      companies: { upserts: 0, deletes: 0 },
    },
    verificationState: 'idle',
    recoveryReviewNeeded: false,
    reviewedMismatchIds: [],
    outboxState: 'idle',
    unresolvedOutboxCount: 0,
    conflictReviewNeeded: false,
    openConflictCount: 0,
    connectivityState: 'online',
    offlineLoadState: 'none',
    pendingOfflineChangeCount: 0,
    saveProof: {
      cloudProofState: 'pending',
      latestDurableLocalWriteAt: '2026-04-05T10:00:00.000Z',
      latestCloudConfirmedCommitAt: '2026-04-05T09:00:00.000Z',
      latestCloudConfirmedBatchId: 'batch-123',
    },
  } as unknown as AppStore;

  const snapshotForBanner = selectSyncMetaSnapshot(state);
  const snapshotForHeader = selectSyncMetaSnapshot(state);
  const bannerModel = getSyncStatusModel(snapshotForBanner);
  const headerModel = getSyncStatusModel(snapshotForHeader);

  assert(bannerModel.stateLabel === headerModel.stateLabel, 'header and banner should agree on status label');
  assert(snapshotForBanner.lastLoadFailureStage === 'user_preferences', 'sync snapshot should include fallback failure stage');
  assert(snapshotForHeader.lastLoadFailureMessage === 'relation "user_preferences" does not exist', 'sync snapshot should include fallback failure message');
  assert(snapshotForBanner.lastConfirmedBatchId === 'batch-123', 'sync snapshot should include last confirmed batch id');
  assert(snapshotForHeader.lastReceiptHashMatch === true, 'sync snapshot should include hash match status');
}

function testToastAnnouncementKeysAreStablePerRevisionTransition(): void {
  const cloudConfirmedAnnouncement = getSyncStatusToastAnnouncement(baseMeta(), {
    stage: 'cloud-confirmed',
    previousStage: 'queued-for-cloud',
  });
  assert(Boolean(cloudConfirmedAnnouncement), 'cloud-confirmed stage should emit a toast announcement when commit is current');
  assert(cloudConfirmedAnnouncement?.source === 'sync.status.cloud_confirmed', `expected cloud-confirmed source, got ${cloudConfirmedAnnouncement?.source}`);

  const sameRevisionAnnouncement = getSyncStatusToastAnnouncement(baseMeta(), {
    stage: 'cloud-confirmed',
    previousStage: 'queued-for-cloud',
  });
  assert(cloudConfirmedAnnouncement?.key === sameRevisionAnnouncement?.key, 'announcement key should remain stable for the same committed revision');

  const newRevisionAnnouncement = getSyncStatusToastAnnouncement({
    ...baseMeta(),
    localRevision: 2,
    lastCloudConfirmedRevision: 2,
    lastConfirmedBatchId: 'batch-2',
  }, {
    stage: 'cloud-confirmed',
    previousStage: 'queued-for-cloud',
  });
  assert(cloudConfirmedAnnouncement?.key !== newRevisionAnnouncement?.key, 'announcement key should change for a newly committed revision');
}

function testToastAnnouncementSuppressesWhenCommitNotCurrent(): void {
  const staleCommit = getSyncStatusToastAnnouncement({
    ...baseMeta(),
    hasLocalUnsavedChanges: true,
  }, {
    stage: 'cloud-confirmed',
    previousStage: 'queued-for-cloud',
  });
  assert(staleCommit === null, 'announcement should be suppressed when local state is not commit-current');
}

(function run() {
  testCloudCommittedLabeling();
  testCloudVerifiedIsDistinctFromCommitted();
  testVerificationStaleIsDistinctFromVerified();
  testVerifiedSummaryWithoutCurrentRevisionProofStaysCommitted();
  testSavedLocallyDoesNotProjectCloudSuccess();
  testQueuedForCloudIsCautionary();
  testNeedsAttentionOverridesOptimisticStates();
  testExplicitPipelineEditingAndSavingStates();
  testSharedSnapshotSelectorConsistency();
  testToastAnnouncementKeysAreStablePerRevisionTransition();
  testToastAnnouncementSuppressesWhenCommitNotCurrent();
})();
