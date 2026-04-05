import { resolvePostSaveMetaState } from '../persistenceMeta';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const degradedState = {
  persistenceMode: 'supabase',
  syncState: 'saved',
  cloudSyncStatus: 'cloud-read-failed-local-fallback',
  loadedFromLocalRecoveryCache: true,
  lastSyncedAt: '2026-04-05T08:00:00.000Z',
  lastCloudConfirmedAt: '2026-04-05T08:00:00.000Z',
  lastLocalWriteAt: '2026-04-05T09:00:00.000Z',
  lastFallbackRestoreAt: '2026-04-05T09:05:00.000Z',
  sessionTrustState: 'degraded',
  sessionDegraded: true,
  sessionDegradedReason: 'cloud-read-failed-fallback',
  sessionDegradedAt: '2026-04-05T09:05:00.000Z',
  sessionDegradedClearedByCloudSave: false,
  sessionTrustRecoveredAt: undefined,
  lastSuccessfulPersistAt: '2026-04-05T09:00:00.000Z',
  lastSuccessfulCloudPersistAt: '2026-04-05T08:00:00.000Z',
} as const;

function testNoOpDoesNotRecoverSession(): void {
  const postSave = resolvePostSaveMetaState(degradedState, 'supabase', '2026-04-05T11:00:00.000Z', false);
  assert(postSave.sessionDegraded, 'no-op save must not recover degraded session');
}

function testLocalOnlySaveDoesNotRecoverCloudDegradedSession(): void {
  const postSave = resolvePostSaveMetaState(degradedState, 'browser', '2026-04-05T11:00:00.000Z', true);
  assert(postSave.sessionDegraded, 'local-only save should not recover cloud-degraded session');
  assert(postSave.lastCloudConfirmedAt === '2026-04-05T08:00:00.000Z', 'local-only save should not update cloud timestamp');
}

function testConfirmedCloudSaveRecoversSession(): void {
  const postSave = resolvePostSaveMetaState(degradedState, 'supabase', '2026-04-05T11:00:00.000Z', true);
  assert(postSave.sessionDegraded === false, 'cloud-confirmed save should clear degraded state');
  assert(postSave.sessionDegradedClearedByCloudSave === true, 'cloud-confirmed save should mark explicit recovery');
}

(function run() {
  testNoOpDoesNotRecoverSession();
  testLocalOnlySaveDoesNotRecoverCloudDegradedSession();
  testConfirmedCloudSaveRecoversSession();
})();
