import { deriveSyncMetaFromLoadResult } from '../syncMetaDerivation';

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
  });

  assert(meta.cloudSyncStatus === 'cloud-read-failed-local-fallback', 'cloud read fallback should use explicit read-failure status');
  assert(meta.loadedFromLocalRecoveryCache === true, 'cloud read fallback should be marked as recovery');
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
}

(function run() {
  testCloudConfirmedLoad();
  testBrowserLoadNotRecovery();
  testCloudReadFailureFallback();
  testCloudReadFailureWithoutFallbackDoesNotLie();
  testLocalNewerThanCloud();
})();
