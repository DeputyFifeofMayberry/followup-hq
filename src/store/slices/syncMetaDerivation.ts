import { todayIso } from '../../lib/utils';
import type { CloudSyncStatus } from '../state/types';
import type { LoadResult } from '../../lib/persistence';

export interface DerivedSyncMeta {
  syncState: 'saved';
  cloudSyncStatus: CloudSyncStatus;
  loadedFromLocalRecoveryCache: boolean;
  lastCloudConfirmedAt?: string;
  lastLocalWriteAt?: string;
  lastFallbackRestoreAt?: string;
  lastSyncedAt?: string;
  lastLoadFailureStage?: string;
  lastLoadFailureMessage?: string;
  lastLoadRecoveredWithLocalCache?: boolean;
  sessionTrustState: 'healthy' | 'degraded';
  sessionDegraded: boolean;
  sessionDegradedReason: 'none' | 'backend-schema-mismatch' | 'backend-rpc-missing' | 'backend-missing-hashing-support' | 'cloud-read-failed-fallback' | 'local-newer-than-cloud' | 'local-recovery-fallback';
  sessionDegradedAt?: string;
  sessionDegradedClearedByCloudSave: boolean;
  sessionTrustRecoveredAt?: string;
  lastSuccessfulPersistAt?: string;
  lastSuccessfulCloudPersistAt?: string;
}

export function deriveSyncMetaFromLoadResult(load: Pick<LoadResult, 'mode' | 'source' | 'cacheStatus' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'cloudUpdatedAt' | 'localCacheUpdatedAt' | 'localCacheLastCloudConfirmedAt' | 'loadFailureStage' | 'loadFailureMessage' | 'loadFailureRecoveredWithLocalCache' | 'backendFailureKind'>): DerivedSyncMeta {
  const loadedFromLocalCache = load.source === 'local-cache';
  const didRestoreFallback = Boolean(load.loadedFromFallback && loadedFromLocalCache);
  const backendSchemaMismatch = didRestoreFallback && load.backendFailureKind === 'schema-mismatch';
  const backendRpcMissing = didRestoreFallback && load.backendFailureKind === 'missing-rpc';
  const backendMissingHashingSupport = didRestoreFallback && load.backendFailureKind === 'missing-hashing-dependency';
  const usedCloudReadFailureFallback = Boolean(load.cloudReadFailed && didRestoreFallback && !backendSchemaMismatch && !backendRpcMissing && !backendMissingHashingSupport);
  const usedLocalNewerFallback = Boolean(load.localNewerThanCloud && didRestoreFallback);
  const usedGeneralRecovery = Boolean(didRestoreFallback && !usedCloudReadFailureFallback && !usedLocalNewerFallback);

  const cloudStatus: CloudSyncStatus = usedCloudReadFailureFallback
    ? 'cloud-read-failed-local-fallback'
    : usedLocalNewerFallback
      ? 'local-newer-than-cloud'
      : load.mode === 'browser'
        ? 'local-only-confirmed'
        : load.cacheStatus === 'pending'
          ? 'pending-cloud'
          : usedGeneralRecovery
            ? 'local-recovery'
            : 'cloud-confirmed';
  const usingRecoveryCache = usedCloudReadFailureFallback || usedLocalNewerFallback || usedGeneralRecovery;
  const lastCloudConfirmedAt = load.mode === 'supabase'
    ? load.cloudUpdatedAt ?? load.localCacheLastCloudConfirmedAt
    : undefined;
  const degradedReason = usedCloudReadFailureFallback
    ? 'cloud-read-failed-fallback'
    : backendSchemaMismatch
      ? 'backend-schema-mismatch'
      : backendRpcMissing
        ? 'backend-rpc-missing'
        : backendMissingHashingSupport
          ? 'backend-missing-hashing-support'
        : usedLocalNewerFallback
      ? 'local-newer-than-cloud'
      : usedGeneralRecovery
        ? 'local-recovery-fallback'
        : 'none';
  const degraded = degradedReason !== 'none';
  const fallbackAt = usingRecoveryCache ? todayIso() : undefined;

  return {
    syncState: 'saved',
    cloudSyncStatus: cloudStatus,
    loadedFromLocalRecoveryCache: usingRecoveryCache,
    lastCloudConfirmedAt,
    lastLocalWriteAt: load.localCacheUpdatedAt,
    lastFallbackRestoreAt: fallbackAt,
    lastSyncedAt: lastCloudConfirmedAt,
    lastLoadFailureStage: load.loadFailureStage,
    lastLoadFailureMessage: load.loadFailureMessage,
    lastLoadRecoveredWithLocalCache: load.loadFailureRecoveredWithLocalCache,
    sessionTrustState: degraded ? 'degraded' : 'healthy',
    sessionDegraded: degraded,
    sessionDegradedReason: degradedReason,
    sessionDegradedAt: fallbackAt,
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: load.localCacheUpdatedAt,
    lastSuccessfulCloudPersistAt: lastCloudConfirmedAt,
  };
}
