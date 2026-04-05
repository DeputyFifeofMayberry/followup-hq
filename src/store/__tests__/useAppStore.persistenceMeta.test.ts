import { readFileSync } from 'node:fs';
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
  }, 'supabase', '2026-04-05T11:00:00.000Z', true);

  assert(state.cloudSyncStatus === 'cloud-confirmed', 'persisted save should promote to cloud confirmed');
  assert(state.lastCloudConfirmedAt === '2026-04-05T11:00:00.000Z', 'persisted save should update cloud confirmed timestamp');
  assert(state.sessionDegraded === false, 'confirmed cloud save should clear degraded session state');
  assert(state.sessionTrustState === 'recovered', 'confirmed cloud save should mark recovered session trust state');
}

function testUseAppStoreActivityCopyIsCalmAndClear(): void {
  const source = readFileSync(new URL('../../../src/store/useAppStore.ts', import.meta.url), 'utf8');

  assert(source.includes("summary: 'Changes queued to save.'"), 'queued summary should use calm plain language');
  assert(source.includes("? 'Saving latest changes.'"), 'saving summary should use plain language');
  assert(source.includes("'Changes confirmed to cloud.'"), 'saved summaries should include explicit cloud confirmation');
  assert(source.includes("'Retry completed and trust restored.'"), 'retry success should include recovery summary copy');
  assert(!source.includes('cloud confirmation pending'), 'useAppStore activity summary should avoid cloud confirmation pending jargon');
}

(function run() {
  testNoOpSavePreservesConservativeTrust();
  testPersistedSupabaseSavePromotesTrust();
  testUseAppStoreActivityCopyIsCalmAndClear();
})();
