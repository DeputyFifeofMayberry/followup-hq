import type { CloudSyncStatus, SaveProofState, SessionDegradedReason } from '../state/types';
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
  sessionDegradedReason: SessionDegradedReason;
  sessionDegradedAt?: string;
  sessionDegradedClearedByCloudSave: boolean;
  sessionTrustRecoveredAt?: string;
  lastSuccessfulPersistAt?: string;
  lastSuccessfulCloudPersistAt?: string;
}

function deriveCloudSyncStatusFromProof(
  load: Pick<LoadResult, 'mode' | 'source' | 'cacheStatus' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'backendFailureKind'>,
  saveProof: SaveProofState,
): CloudSyncStatus {
  const loadedFromLocalCache = load.source === 'local-cache';
  const didRestoreFallback = Boolean(load.loadedFromFallback && loadedFromLocalCache);
  const backendFailure = load.backendFailureKind === 'schema-mismatch'
    || load.backendFailureKind === 'missing-rpc'
    || load.backendFailureKind === 'hashing-failure'
    || load.backendFailureKind === 'missing-hashing-dependency';
  if (didRestoreFallback && load.localNewerThanCloud) return 'local-newer-than-cloud';
  if (didRestoreFallback && load.cloudReadFailed) return 'cloud-read-failed-local-fallback';
  if (didRestoreFallback) return 'local-recovery';
  if (saveProof.cloudProofState === 'degraded') {
    if (saveProof.latestFailureClass === 'payload-invalid') return 'payload-invalid';
    if (backendFailure) return 'local-recovery';
    return 'cloud-save-failed-local-preserved';
  }
  if (saveProof.cloudProofState === 'local-only' || load.mode === 'browser') return 'local-only-confirmed';
  if (saveProof.cloudProofState === 'pending') return load.mode === 'supabase' ? 'pending-cloud' : 'local-only-confirmed';
  return load.mode === 'supabase' ? 'cloud-confirmed' : 'local-only-confirmed';
}

function deriveSessionDegradedReason(
  load: Pick<LoadResult, 'source' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'backendFailureKind'>,
  cloudSyncStatus: CloudSyncStatus,
  saveProof: SaveProofState,
): SessionDegradedReason {
  const loadedFromLocalCache = load.source === 'local-cache';
  const didRestoreFallback = Boolean(load.loadedFromFallback && loadedFromLocalCache);
  if (didRestoreFallback && load.backendFailureKind === 'schema-mismatch') return 'backend-schema-mismatch';
  if (didRestoreFallback && load.backendFailureKind === 'missing-rpc') return 'backend-rpc-missing';
  if (didRestoreFallback && (load.backendFailureKind === 'hashing-failure' || load.backendFailureKind === 'missing-hashing-dependency')) return 'backend-missing-hashing-support';
  if (didRestoreFallback && load.localNewerThanCloud) return 'local-newer-than-cloud';
  if (didRestoreFallback && load.cloudReadFailed) return 'cloud-read-failed-fallback';
  if (didRestoreFallback) return 'local-recovery-fallback';
  if (cloudSyncStatus === 'payload-invalid' || saveProof.latestFailureClass === 'payload-invalid') return 'payload-invalid';
  if (cloudSyncStatus === 'cloud-save-failed-local-preserved') return 'cloud-save-failed';
  return 'none';
}

export function deriveSyncMetaFromLoadResult(load: Pick<LoadResult, 'mode' | 'source' | 'cacheStatus' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'cloudUpdatedAt' | 'localCacheUpdatedAt' | 'localCacheLastCloudConfirmedAt' | 'loadFailureStage' | 'loadFailureMessage' | 'loadFailureRecoveredWithLocalCache' | 'backendFailureKind' | 'saveProof'>): DerivedSyncMeta {
  const loadedFromLocalCache = load.source === 'local-cache';
  const didRestoreFallback = Boolean(load.loadedFromFallback && loadedFromLocalCache);
  const saveProof: SaveProofState = load.saveProof ?? {
    latestVerifiedAt: undefined,
    latestVerifiedBatchId: undefined,
    latestVerifiedRevision: undefined,
    latestLocalSaveAttemptAt: load.localCacheUpdatedAt,
    latestDurableLocalWriteAt: load.localCacheUpdatedAt,
    latestCloudConfirmedCommitAt: load.cloudUpdatedAt ?? load.localCacheLastCloudConfirmedAt,
    latestConfirmedBatchId: undefined,
    latestReceiptStatus: undefined,
    latestReceiptHashMatch: undefined,
    latestReceiptSchemaVersion: undefined,
    latestReceiptTouchedTables: undefined,
    latestReceiptOperationCount: undefined,
    latestReceiptOperationCountsByEntity: undefined,
    latestFailedBatchId: undefined,
    latestFailureMessage: undefined,
    latestFailureClass: undefined,
    cloudProofState: load.mode === 'browser'
      ? 'local-only'
      : load.cacheStatus === 'confirmed'
        ? 'confirmed'
        : 'pending',
  };
  const cloudStatus = deriveCloudSyncStatusFromProof(load, saveProof);
  const usingRecoveryCache = didRestoreFallback;
  const lastCloudConfirmedAt = saveProof.latestCloudConfirmedCommitAt
    ?? (load.mode === 'supabase' ? load.cloudUpdatedAt ?? load.localCacheLastCloudConfirmedAt : undefined);
  const degradedReason = deriveSessionDegradedReason(load, cloudStatus, saveProof);
  const degraded = degradedReason !== 'none';
  const fallbackAt = usingRecoveryCache
    ? saveProof.latestDurableLocalWriteAt ?? load.localCacheUpdatedAt
    : undefined;

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
