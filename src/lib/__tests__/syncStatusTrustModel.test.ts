import { getSyncStatusModel, selectSyncMetaSnapshot } from '../syncStatus';
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
    localRevision: 1,
    lastCloudConfirmedRevision: 1,
    localSaveState: 'saved',
    cloudSyncState: 'confirmed',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T10:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T10:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:00:00.000Z',
    lastFallbackRestoreAt: undefined,
    lastFailedSyncAt: undefined,
    lastLoadFailureStage: undefined,
    lastLoadFailureMessage: undefined,
    lastLoadRecoveredWithLocalCache: false,
    sessionTrustState: 'healthy',
    sessionDegraded: false,
    sessionDegradedReason: 'none',
    sessionDegradedAt: undefined,
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: '2026-04-05T10:00:00.000Z',
    lastSuccessfulCloudPersistAt: '2026-04-05T10:00:00.000Z',
    lastConfirmedBatchId: undefined,
    lastConfirmedBatchCommittedAt: undefined,
    lastReceiptStatus: undefined,
    lastReceiptHashMatch: undefined,
    lastReceiptSchemaVersion: undefined,
    lastReceiptTouchedTables: undefined,
    lastReceiptOperationCount: undefined,
    lastReceiptOperationCountsByEntity: undefined,
    lastFailedBatchId: undefined,
    verificationState: 'idle',
    lastVerificationRunId: undefined,
    lastVerificationStartedAt: undefined,
    lastVerificationCompletedAt: undefined,
    lastVerificationMatched: undefined,
    lastVerificationMismatchCount: undefined,
    lastVerificationBasedOnBatchId: undefined,
    lastVerificationFailureMessage: undefined,
    recoveryReviewNeeded: false,
    verificationSummary: undefined,
    latestVerificationResult: undefined,
    reviewedMismatchIds: [],
    outboxState: 'idle',
    unresolvedOutboxCount: 0,
    lastOutboxFlushAt: undefined,
    lastOutboxFailureAt: undefined,
    conflictReviewNeeded: false,
    openConflictCount: 0,
    lastConflictDetectedAt: undefined,
    lastConflictBatchId: undefined,
    lastConflictFailureMessage: undefined,
    connectivityState: 'online',
    offlineLoadState: 'none',
    pendingOfflineChangeCount: 0,
  } as const;
}

function testCloudConfirmedPrimaryState(): void {
  const model = getSyncStatusModel(baseMeta());
  assert(model.primaryState === 'saved', `expected saved primary state, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saved', `expected Saved label, got ${model.stateLabel}`);
  assert(model.stateDescription === 'All changes saved', `expected simplified saved description, got ${model.stateDescription}`);
}

function testBrowserLocalOnlyMapsToSavedWithoutWarningTone(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    persistenceMode: 'browser',
    cloudSyncStatus: 'local-only-confirmed',
    lastSyncedAt: undefined,
    lastCloudConfirmedAt: undefined,
  });
  assert(model.primaryState === 'saved', `expected saved primary state in browser mode, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saved', `expected Saved label in browser mode, got ${model.stateLabel}`);
  assert(model.stateTone === 'success', `expected success tone for local-only saved state, got ${model.stateTone}`);
  assert(model.stateDescription === 'Changes saved on this device; cloud sync will resume automatically', `expected local-only saved description, got ${model.stateDescription}`);
}

function testPendingCloudFeelsTransitionalNotDangerous(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    cloudSyncStatus: 'pending-cloud',
    localRevision: 2,
    lastCloudConfirmedRevision: 1,
    localSaveState: 'saved',
    cloudSyncState: 'queued',
  });
  assert(model.primaryState === 'saved', `expected pending-cloud local protection state, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saved locally', `expected Saved locally label for pending-cloud, got ${model.stateLabel}`);
  assert(model.stateTone === 'info', `expected info tone for pending-cloud transition, got ${model.stateTone}`);
}

function testFallbackCasesMapToNeedsAttention(): void {
  const fallbackStatuses = [
    'local-recovery',
    'local-newer-than-cloud',
    'cloud-read-failed-local-fallback',
    'cloud-save-failed-local-preserved',
    'load-failed-no-local-copy',
  ] as const;

  fallbackStatuses.forEach((cloudSyncStatus) => {
    const model = getSyncStatusModel({
      ...baseMeta(),
      cloudSyncStatus,
      loadedFromLocalRecoveryCache: cloudSyncStatus !== 'load-failed-no-local-copy',
    });
    assert(model.primaryState === 'needs-attention', `expected ${cloudSyncStatus} to map to needs-attention, got ${model.primaryState}`);
    assert(model.stateLabel === 'Needs attention', `expected Needs attention label for ${cloudSyncStatus}, got ${model.stateLabel}`);
  });
}

function testBackendSetupIssueMapsToSavedLocally(): void {
  const backendSchemaModel = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    sessionDegraded: true,
    sessionDegradedReason: 'backend-schema-mismatch',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
  } as any);
  assert(backendSchemaModel.stateLabel === 'Saved locally', `expected Saved locally for backend schema mismatch, got ${backendSchemaModel.stateLabel}`);
  assert(backendSchemaModel.stateDescription === 'Cloud setup required', `expected cloud setup required description, got ${backendSchemaModel.stateDescription}`);

  const backendRpcModel = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    sessionDegraded: true,
    sessionDegradedReason: 'backend-rpc-missing',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
  } as any);
  assert(backendRpcModel.stateLabel === 'Saved locally', `expected Saved locally for backend rpc mismatch, got ${backendRpcModel.stateLabel}`);
  assert(backendRpcModel.modeLabel === 'Protected local fallback', `expected protected local fallback mode, got ${backendRpcModel.modeLabel}`);
  assert(backendRpcModel.trustLabel === 'Cloud trust blocked by missing RPC', `expected missing RPC trust label, got ${backendRpcModel.trustLabel}`);
}

function testFailureNarrativesAreCalmAndSpecific(): void {
  const saveFailure = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    saveError: 'network exploded',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-save-failed',
  });
  assert(saveFailure.reassurance === 'Your recent work was protected.', `expected reassurance-first save failure narrative, got ${saveFailure.reassurance}`);
  assert(saveFailure.stateDescription === 'A cloud save failed. Retry a confirmed cloud save to restore session trust.', `unexpected save failure description: ${saveFailure.stateDescription}`);

  const noLocalCopy = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    saveError: 'network exploded',
    cloudSyncStatus: 'load-failed-no-local-copy',
    sessionDegraded: true,
    sessionDegradedReason: 'load-failed-no-local-copy',
  });
  assert(noLocalCopy.stateDescription === 'SetPoint could not confirm saved data. Save once workspace is rebuilt to restore trust.', `unexpected no-local-copy description: ${noLocalCopy.stateDescription}`);
}

function testDirtyMapsToSavingState(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'dirty',
    hasLocalUnsavedChanges: true,
    unsavedChangeCount: 2,
    cloudSyncStatus: 'pending-cloud',
    localRevision: 2,
    lastCloudConfirmedRevision: 1,
    localSaveState: 'saved',
    cloudSyncState: 'queued',
  });
  assert(model.primaryState === 'saving', `expected dirty to map to saving, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saving…', `expected Saving label, got ${model.stateLabel}`);
}


function testFailedOutboxDoesNotShowSavingForever(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    hasLocalUnsavedChanges: true,
    unsavedChangeCount: 3,
    syncState: 'error',
    outboxState: 'failed',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-save-failed',
  } as any);
  assert(model.primaryState === 'needs-attention', `expected failed outbox to surface attention state, got ${model.primaryState}`);
  assert(model.stateLabel !== 'Saving', `failed save state should not be rendered as Saving`);
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
    lastFallbackRestoreAt: undefined,
    lastFailedSyncAt: undefined,
    lastLoadFailureStage: 'user_preferences',
    lastLoadFailureMessage: 'relation "user_preferences" does not exist',
    lastLoadRecoveredWithLocalCache: true,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-read-failed-fallback',
    sessionDegradedAt: '2026-04-05T08:59:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
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
    lastFailedBatchId: undefined,
    verificationState: 'idle',
    lastVerificationRunId: undefined,
    lastVerificationStartedAt: undefined,
    lastVerificationCompletedAt: undefined,
    lastVerificationMatched: undefined,
    lastVerificationMismatchCount: undefined,
    lastVerificationBasedOnBatchId: undefined,
    lastVerificationFailureMessage: undefined,
    recoveryReviewNeeded: false,
    verificationSummary: undefined,
    latestVerificationResult: undefined,
    reviewedMismatchIds: [],
    outboxState: 'idle',
    unresolvedOutboxCount: 0,
    lastOutboxFlushAt: undefined,
    lastOutboxFailureAt: undefined,
    conflictReviewNeeded: false,
    openConflictCount: 0,
    lastConflictDetectedAt: undefined,
    lastConflictBatchId: undefined,
    lastConflictFailureMessage: undefined,
    connectivityState: 'online',
    offlineLoadState: 'none',
    pendingOfflineChangeCount: 0,
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


function testVerifiedMatchAndRecoveryProjection(): void {
  const verifiedModel = getSyncStatusModel({
    ...baseMeta(),
    verificationState: 'verified-match',
    lastVerificationCompletedAt: '2026-04-06T12:00:00.000Z',
    verificationSummary: {
      verified: true,
      mismatchCount: 0,
      mismatchCountsByCategory: {},
      mismatchCountsByEntity: {},
    },
  } as any);
  assert(verifiedModel.stateDescription === 'Verified match with current cloud data.', `expected verified message, got ${verifiedModel.stateDescription}`);

  const recoveryModel = getSyncStatusModel({
    ...baseMeta(),
    verificationState: 'mismatch-found',
    recoveryReviewNeeded: true,
    verificationSummary: {
      verified: false,
      mismatchCount: 2,
      mismatchCountsByCategory: { content_mismatch: 2 },
      mismatchCountsByEntity: { tasks: 2 },
    },
  } as any);
  assert(recoveryModel.primaryState === 'needs-attention', `expected mismatch review to require attention, got ${recoveryModel.primaryState}`);

  const conflictModel = getSyncStatusModel({
    ...baseMeta(),
    outboxState: 'conflict',
    conflictReviewNeeded: true,
    openConflictCount: 2,
  } as any);
  assert(conflictModel.stateLabel === 'Needs attention', `expected conflict-specific attention label, got ${conflictModel.stateLabel}`);
}

(function run() {
  testCloudConfirmedPrimaryState();
  testBrowserLocalOnlyMapsToSavedWithoutWarningTone();
  testPendingCloudFeelsTransitionalNotDangerous();
  testFallbackCasesMapToNeedsAttention();
  testBackendSetupIssueMapsToSavedLocally();
  testFailureNarrativesAreCalmAndSpecific();
  testDirtyMapsToSavingState();
testFailedOutboxDoesNotShowSavingForever();
  testVerifiedMatchAndRecoveryProjection();
  testSharedSnapshotSelectorConsistency();
})();
