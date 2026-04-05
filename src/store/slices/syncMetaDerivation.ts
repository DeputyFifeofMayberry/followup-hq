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
}

export function deriveSyncMetaFromLoadResult(load: Pick<LoadResult, 'mode' | 'source' | 'cacheStatus' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'cloudUpdatedAt' | 'localCacheUpdatedAt' | 'localCacheLastCloudConfirmedAt' | 'loadFailureStage' | 'loadFailureMessage' | 'loadFailureRecoveredWithLocalCache'>): DerivedSyncMeta {
  const loadedFromLocalCache = load.source === 'local-cache';
  const didRestoreFallback = Boolean(load.loadedFromFallback && loadedFromLocalCache);
  const usedCloudReadFailureFallback = Boolean(load.cloudReadFailed && didRestoreFallback);
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

  return {
    syncState: 'saved',
    cloudSyncStatus: cloudStatus,
    loadedFromLocalRecoveryCache: usingRecoveryCache,
    lastCloudConfirmedAt,
    lastLocalWriteAt: load.localCacheUpdatedAt,
    lastFallbackRestoreAt: usingRecoveryCache ? todayIso() : undefined,
    lastSyncedAt: lastCloudConfirmedAt,
    lastLoadFailureStage: load.loadFailureStage,
    lastLoadFailureMessage: load.loadFailureMessage,
    lastLoadRecoveredWithLocalCache: load.loadFailureRecoveredWithLocalCache,
  };
}
