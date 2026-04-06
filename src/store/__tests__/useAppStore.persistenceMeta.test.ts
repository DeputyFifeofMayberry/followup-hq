import { resolvePostSaveMetaState } from '../persistenceMeta';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testNoOpSavePreservesConservativeTrust(): void {
  const state = resolvePostSaveMetaState({
    persistenceMode: 'supabase',
    syncState: 'error',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T10:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T10:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:05:00.000Z',
    lastFallbackRestoreAt: undefined,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-save-failed',
    sessionDegradedAt: '2026-04-05T10:06:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: '2026-04-05T10:05:00.000Z',
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
  }, 'supabase', '2026-04-05T11:00:00.000Z', false);

  assert(state.cloudSyncStatus === 'cloud-save-failed-local-preserved', 'no-op save should not promote trust status');
  assert(state.lastCloudConfirmedAt === '2026-04-05T10:00:00.000Z', 'no-op save should not refresh cloud confirmation timestamp');
  assert(state.lastLocalWriteAt === '2026-04-05T10:05:00.000Z', 'no-op save should not refresh local write timestamp');
}

function testPersistedSupabaseSavePromotesTrust(): void {
  const state = resolvePostSaveMetaState({
    persistenceMode: 'supabase',
    syncState: 'dirty',
    cloudSyncStatus: 'pending-cloud',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: undefined,
    lastCloudConfirmedAt: undefined,
    lastLocalWriteAt: undefined,
    lastFallbackRestoreAt: undefined,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-read-failed-fallback',
    sessionDegradedAt: '2026-04-05T10:58:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: undefined,
    lastSuccessfulCloudPersistAt: undefined,
    lastConfirmedBatchId: undefined,
    lastConfirmedBatchCommittedAt: undefined,
    lastReceiptStatus: undefined,
    lastReceiptHashMatch: undefined,
    lastReceiptSchemaVersion: undefined,
    lastReceiptTouchedTables: undefined,
    lastReceiptOperationCount: undefined,
    lastReceiptOperationCountsByEntity: undefined,
    lastFailedBatchId: undefined,
  }, 'supabase', '2026-04-05T11:00:00.000Z', true);

  assert(state.cloudSyncStatus === 'cloud-confirmed', 'persisted save should promote to cloud confirmed');
  assert(state.lastCloudConfirmedAt === '2026-04-05T11:00:00.000Z', 'persisted save should update cloud confirmed timestamp');
  assert(state.sessionDegraded === false, 'confirmed cloud save should clear degraded session state');
  assert(state.sessionTrustState === 'recovered', 'confirmed cloud save should mark recovered session trust state');
}

(function run() {
  testNoOpSavePreservesConservativeTrust();
  testPersistedSupabaseSavePromotesTrust();
})();
