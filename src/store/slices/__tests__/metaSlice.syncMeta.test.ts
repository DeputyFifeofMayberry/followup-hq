import { deriveSyncMetaFromLoadResult } from '../syncMetaDerivation';
import { createMetaSlice } from '../metaSlice';
import { appendPersistenceActivity, createPersistenceActivityEvent, describeLoadFallbackFailure } from '../../persistenceActivity';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testCloudConfirmedLoad(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'supabase',
    cacheStatus: 'confirmed',
    cloudUpdatedAt: '2026-04-05T09:00:00.000Z',
  });

  assert(meta.cloudSyncStatus === 'cloud-confirmed', 'cloud load should be cloud-confirmed');
  assert(meta.lastSyncedAt === '2026-04-05T09:00:00.000Z', 'cloud load should retain cloud confirmation timestamp');
}

function testBrowserLoadNotRecovery(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'browser',
    source: 'local-cache',
    cacheStatus: 'confirmed',
    localCacheUpdatedAt: '2026-04-05T09:00:00.000Z',
  });

  assert(meta.cloudSyncStatus === 'local-only-confirmed', 'browser local-only load should be local-only-confirmed');
  assert(meta.loadedFromLocalRecoveryCache === false, 'browser local-only load should not be recovery');
}

function testCloudReadFailureFallback(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    cloudReadFailed: true,
    loadedFromFallback: true,
    localCacheUpdatedAt: '2026-04-05T09:00:00.000Z',
    loadFailureStage: 'auth_session',
    loadFailureMessage: 'JWT expired',
    loadFailureRecoveredWithLocalCache: true,
  });

  assert(meta.cloudSyncStatus === 'cloud-read-failed-local-fallback', 'cloud read fallback should use explicit read-failure status');
  assert(meta.loadedFromLocalRecoveryCache === true, 'cloud read fallback should be marked as recovery');
  assert(meta.sessionDegraded === true, 'cloud read fallback should mark session degraded');
  assert(meta.sessionDegradedReason === 'cloud-read-failed-fallback', 'cloud read fallback should preserve degraded reason');
  assert(meta.lastLoadFailureStage === 'auth_session', 'cloud read fallback should preserve failure stage');
  assert(meta.lastLoadFailureMessage === 'JWT expired', 'cloud read fallback should preserve failure details');
  assert(meta.lastLoadRecoveredWithLocalCache === true, 'cloud read fallback should preserve recovery marker');
}

function testCloudReadFailureWithoutFallbackDoesNotLie(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'supabase',
    cacheStatus: 'pending',
    cloudReadFailed: true,
    loadedFromFallback: false,
  });

  assert(meta.cloudSyncStatus === 'pending-cloud', 'cloud read failure without local restore must not claim preserved local fallback');
  assert(meta.loadedFromLocalRecoveryCache === false, 'cloud read failure without local restore should not mark local recovery');
}

function testLocalNewerThanCloud(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    localNewerThanCloud: true,
    loadedFromFallback: true,
    cloudUpdatedAt: '2026-04-05T08:00:00.000Z',
    localCacheUpdatedAt: '2026-04-05T09:00:00.000Z',
    localCacheLastCloudConfirmedAt: '2026-04-05T08:00:00.000Z',
  });

  assert(meta.cloudSyncStatus === 'local-newer-than-cloud', 'local newer than cloud should use explicit status');
  assert(meta.loadedFromLocalRecoveryCache === true, 'local newer than cloud should be marked as recovery');
  assert(meta.sessionDegraded === true, 'local newer fallback should mark session degraded');
  assert(meta.sessionDegradedReason === 'local-newer-than-cloud', 'local newer fallback should preserve degraded reason');
}

function testFallbackCopyIsCalmAndNonJargony(): void {
  const fallback = describeLoadFallbackFailure('user_preferences', 'relation "user_preferences" does not exist');
  assert(fallback.summary === 'Opened using protected local data.', `unexpected fallback summary: ${fallback.summary}`);
  assert(fallback.detail.includes('Cloud data could not be confirmed'), `expected calm fallback detail, got ${fallback.detail}`);
  assert(!fallback.summary.toLowerCase().includes('failed'), `summary should avoid alarming failure-first wording: ${fallback.summary}`);
}

function testBackendSchemaMismatchMapsToExplicitDegradedReason(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    loadedFromFallback: true,
    cloudReadFailed: true,
    backendFailureKind: 'schema-mismatch',
    loadFailureStage: 'follow_up_items',
    loadFailureMessage: 'column public.follow_up_items.deleted_at does not exist',
  });
  assert(meta.sessionDegradedReason === 'backend-schema-mismatch', `expected backend-schema-mismatch, got ${meta.sessionDegradedReason}`);
}

function testBackendMissingRpcMapsToExplicitDegradedReason(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    loadedFromFallback: true,
    cloudReadFailed: true,
    backendFailureKind: 'missing-rpc',
    loadFailureStage: 'schema_preflight',
    loadFailureMessage: 'Could not find the function public.apply_save_batch(batch)',
  });
  assert(meta.sessionDegradedReason === 'backend-rpc-missing', `expected backend-rpc-missing, got ${meta.sessionDegradedReason}`);
}

function testBackendMissingHashingSupportMapsToExplicitDegradedReason(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    loadedFromFallback: true,
    cloudReadFailed: true,
    backendFailureKind: 'missing-hashing-dependency',
    loadFailureStage: 'schema_preflight',
    loadFailureMessage: 'function digest(text, unknown) does not exist',
  });
  assert(meta.sessionDegradedReason === 'backend-missing-hashing-support', `expected backend-missing-hashing-support, got ${meta.sessionDegradedReason}`);
}

function testContractFailureActivityIsDeduplicated(): void {
  const first = createPersistenceActivityEvent({
    kind: 'saved',
    summary: 'Cloud sync blocked by schema mismatch.',
    detail: 'Local changes remain protected until backend contract is repaired.',
  });
  const second = createPersistenceActivityEvent({
    kind: 'saved',
    summary: 'Cloud sync blocked by schema mismatch.',
    detail: 'Local changes remain protected until backend contract is repaired.',
  });
  const entries = appendPersistenceActivity(appendPersistenceActivity([], first), second);
  assert(entries.length === 1, `expected deduped blocked contract event, got ${entries.length}`);
}

function testFallbackPreservesRevisionMetadataHints(): void {
  const meta = deriveSyncMetaFromLoadResult({
    mode: 'supabase',
    source: 'local-cache',
    cacheStatus: 'pending',
    loadedFromFallback: true,
    cloudReadFailed: true,
    backendFailureKind: 'schema-mismatch',
    localCacheUpdatedAt: '2026-04-06T00:00:00.000Z',
    localCacheLastCloudConfirmedAt: '2026-04-05T00:00:00.000Z',
  });
  assert(meta.lastLocalWriteAt === '2026-04-06T00:00:00.000Z', `expected preserved local write timestamp, got ${meta.lastLocalWriteAt}`);
  assert(meta.lastCloudConfirmedAt === '2026-04-05T00:00:00.000Z', `expected preserved cloud confirmed timestamp, got ${meta.lastCloudConfirmedAt}`);
}

async function testInitializeAppCatchDoesNotReferenceTryScopedValues(): Promise<void> {
  const snapshots: Array<Record<string, unknown>> = [];
  const set = (partial: unknown) => {
    snapshots.push(partial as Record<string, unknown>);
    return partial;
  };
  const slice = createMetaSlice(
    set as any,
    { settings: {}, syncCursorByFolder: { inbox: {}, sentitems: {} } } as any,
    {
      loadPersistedPayload: async () => {
        throw new Error('forced startup failure');
      },
      loadOutboxState: async () => ({ entries: [] } as any),
      listUnresolvedOutboxEntries: async () => [],
    },
  );
  await slice.initializeApp();
  const next = snapshots.at(-1) ?? {};
  assert(next.syncState === 'error', `expected startup fallback syncState=error, got ${String(next.syncState)}`);
  assert(next.cloudSyncState === 'failed', `expected startup fallback cloudSyncState=failed, got ${String(next.cloudSyncState)}`);
  assert(next.localSaveState === 'error', `expected startup fallback localSaveState=error, got ${String(next.localSaveState)}`);
}

(async function run() {
  testCloudConfirmedLoad();
  testBrowserLoadNotRecovery();
  testCloudReadFailureFallback();
  testCloudReadFailureWithoutFallbackDoesNotLie();
  testLocalNewerThanCloud();
  testFallbackCopyIsCalmAndNonJargony();
  testBackendSchemaMismatchMapsToExplicitDegradedReason();
  testBackendMissingRpcMapsToExplicitDegradedReason();
  testBackendMissingHashingSupportMapsToExplicitDegradedReason();
  testContractFailureActivityIsDeduplicated();
  testFallbackPreservesRevisionMetadataHints();
  await testInitializeAppCatchDoesNotReferenceTryScopedValues();
})();
