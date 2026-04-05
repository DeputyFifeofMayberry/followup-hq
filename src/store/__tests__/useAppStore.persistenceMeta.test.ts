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
  }, 'supabase', '2026-04-05T11:00:00.000Z', true);

  assert(state.cloudSyncStatus === 'cloud-confirmed', 'persisted save should promote to cloud confirmed');
  assert(state.lastCloudConfirmedAt === '2026-04-05T11:00:00.000Z', 'persisted save should update cloud confirmed timestamp');
}

(function run() {
  testNoOpSavePreservesConservativeTrust();
  testPersistedSupabaseSavePromotesTrust();
})();
