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
  } as const;
}

function testCloudConfirmed(): void {
  const model = getSyncStatusModel(baseMeta());
  assert(model.stateLabel === 'Saved to cloud', `expected cloud-confirmed label, got ${model.stateLabel}`);
}

function testBrowserLocalOnly(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    persistenceMode: 'browser',
    cloudSyncStatus: 'local-only-confirmed',
    lastSyncedAt: undefined,
    lastCloudConfirmedAt: undefined,
  });
  assert(model.stateLabel === 'Saved locally on this device', `expected local-only confirmed label, got ${model.stateLabel}`);
}

function testCloudReadFallback(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    cloudSyncStatus: 'cloud-read-failed-local-fallback',
    loadedFromLocalRecoveryCache: true,
  });
  assert(model.stateLabel === 'Cloud read failed; local copy preserved', `expected cloud read fallback label, got ${model.stateLabel}`);
}

function testLocalNewerThanCloud(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    cloudSyncStatus: 'local-newer-than-cloud',
    loadedFromLocalRecoveryCache: true,
  });
  assert(model.stateLabel === 'Loaded from local recovery cache', `expected local newer state label, got ${model.stateLabel}`);
}

function testSaveFailure(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'error',
    saveError: 'Failed to save to cloud.',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
  });
  assert(model.stateLabel === 'Save failed; latest local changes preserved', `expected explicit save failure label, got ${model.stateLabel}`);
}

function testFailedThenEditIsPending(): void {
  const model = getSyncStatusModel({
    ...baseMeta(),
    syncState: 'dirty',
    saveError: 'Previous failure message',
    hasLocalUnsavedChanges: true,
    unsavedChangeCount: 1,
    cloudSyncStatus: 'pending-cloud',
  });
  assert(model.stateLabel === 'Unsaved local edits', `expected dirty state after new edit, got ${model.stateLabel}`);
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
  } as unknown as AppStore;

  const snapshotForBanner = selectSyncMetaSnapshot(state);
  const snapshotForHeader = selectSyncMetaSnapshot(state);
  const bannerModel = getSyncStatusModel(snapshotForBanner);
  const headerModel = getSyncStatusModel(snapshotForHeader);

  assert(bannerModel.stateLabel === headerModel.stateLabel, 'header and banner should agree on status label');
}

(function run() {
  testCloudConfirmed();
  testBrowserLocalOnly();
  testCloudReadFallback();
  testLocalNewerThanCloud();
  testSaveFailure();
  testFailedThenEditIsPending();
  testSharedSnapshotSelectorConsistency();
})();
