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
  } as const;
}

function testCloudConfirmedPrimaryState(): void {
  const model = getSyncStatusModel(baseMeta());
  assert(model.primaryState === 'saved', `expected saved primary state, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saved', `expected Saved label, got ${model.stateLabel}`);
  assert(model.stateDescription === 'Your latest updates are saved.', `expected simplified saved description, got ${model.stateDescription}`);
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
  assert(model.stateDescription === 'Your latest updates are saved on this device.', `expected local-only saved description, got ${model.stateDescription}`);
}

function testPendingCloudFeelsTransitionalNotDangerous(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    cloudSyncStatus: 'pending-cloud',
  });
  assert(model.primaryState === 'saved', `expected pending-cloud to remain saved, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saved', `expected Saved label for pending-cloud, got ${model.stateLabel}`);
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
  });
  assert(model.primaryState === 'saving', `expected dirty to map to saving, got ${model.primaryState}`);
  assert(model.stateLabel === 'Saving', `expected Saving label, got ${model.stateLabel}`);
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
  } as unknown as AppStore;

  const snapshotForBanner = selectSyncMetaSnapshot(state);
  const snapshotForHeader = selectSyncMetaSnapshot(state);
  const bannerModel = getSyncStatusModel(snapshotForBanner);
  const headerModel = getSyncStatusModel(snapshotForHeader);

  assert(bannerModel.stateLabel === headerModel.stateLabel, 'header and banner should agree on status label');
  assert(snapshotForBanner.lastLoadFailureStage === 'user_preferences', 'sync snapshot should include fallback failure stage');
  assert(snapshotForHeader.lastLoadFailureMessage === 'relation "user_preferences" does not exist', 'sync snapshot should include fallback failure message');
}

(function run() {
  testCloudConfirmedPrimaryState();
  testBrowserLocalOnlyMapsToSavedWithoutWarningTone();
  testPendingCloudFeelsTransitionalNotDangerous();
  testFallbackCasesMapToNeedsAttention();
  testFailureNarrativesAreCalmAndSpecific();
  testDirtyMapsToSavingState();
  testSharedSnapshotSelectorConsistency();
})();
