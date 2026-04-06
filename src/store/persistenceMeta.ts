import type { AppMetaState } from './state/types';
import type { SaveDiagnostics } from '../lib/persistence';

export type PostSaveMetaState = Pick<AppMetaState,
  | 'syncState'
  | 'lastSyncedAt'
  | 'lastCloudConfirmedAt'
  | 'lastLocalWriteAt'
  | 'cloudSyncStatus'
  | 'loadedFromLocalRecoveryCache'
  | 'sessionTrustState'
  | 'sessionDegraded'
  | 'sessionDegradedReason'
  | 'sessionDegradedAt'
  | 'sessionDegradedClearedByCloudSave'
  | 'sessionTrustRecoveredAt'
  | 'lastSuccessfulPersistAt'
  | 'lastSuccessfulCloudPersistAt'
  | 'lastConfirmedBatchId'
  | 'lastConfirmedBatchCommittedAt'
  | 'lastReceiptStatus'
  | 'lastReceiptHashMatch'
  | 'lastReceiptSchemaVersion'
  | 'lastReceiptTouchedTables'
  | 'lastReceiptOperationCount'
  | 'lastReceiptOperationCountsByEntity'
  | 'lastFailedBatchId'
>;

type SaveResultKind = 'noop' | 'local-only' | 'cloud-confirmed';

export function getSaveResultKind(
  mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading',
  didPersist: boolean,
): SaveResultKind {
  if (!didPersist) return 'noop';
  return mode === 'supabase' ? 'cloud-confirmed' : 'local-only';
}

function canCloudConfirmationRecoverSession(state: Pick<AppMetaState, 'sessionDegraded' | 'sessionDegradedReason'>): boolean {
  if (!state.sessionDegraded) return false;
  return state.sessionDegradedReason !== 'none';
}

export function resolvePostSaveMetaState(
  state: Pick<AppMetaState,
  | 'persistenceMode'
  | 'syncState'
  | 'cloudSyncStatus'
  | 'loadedFromLocalRecoveryCache'
  | 'lastSyncedAt'
  | 'lastCloudConfirmedAt'
  | 'lastLocalWriteAt'
  | 'lastFallbackRestoreAt'
  | 'sessionTrustState'
  | 'sessionDegraded'
  | 'sessionDegradedReason'
  | 'sessionDegradedAt'
  | 'sessionDegradedClearedByCloudSave'
  | 'sessionTrustRecoveredAt'
  | 'lastSuccessfulPersistAt'
  | 'lastSuccessfulCloudPersistAt'
  | 'lastConfirmedBatchId'
  | 'lastConfirmedBatchCommittedAt'
  | 'lastReceiptStatus'
  | 'lastReceiptHashMatch'
  | 'lastReceiptSchemaVersion'
  | 'lastReceiptTouchedTables'
  | 'lastReceiptOperationCount'
  | 'lastReceiptOperationCountsByEntity'
  | 'lastFailedBatchId'
  >,
  mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading',
  timestamp: string,
  didPersist: boolean,
  diagnostics?: SaveDiagnostics,
): PostSaveMetaState {
  const saveKind = getSaveResultKind(mode, didPersist);

  if (!didPersist) {
    return {
      syncState: state.syncState === 'error' ? 'error' : 'saved',
      lastSyncedAt: state.lastSyncedAt,
      lastCloudConfirmedAt: state.lastCloudConfirmedAt,
      lastLocalWriteAt: state.lastLocalWriteAt,
      cloudSyncStatus: state.cloudSyncStatus,
      loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
      sessionTrustState: state.sessionTrustState,
      sessionDegraded: state.sessionDegraded,
      sessionDegradedReason: state.sessionDegradedReason,
      sessionDegradedAt: state.sessionDegradedAt,
      sessionDegradedClearedByCloudSave: state.sessionDegradedClearedByCloudSave,
      sessionTrustRecoveredAt: state.sessionTrustRecoveredAt,
      lastSuccessfulPersistAt: state.lastSuccessfulPersistAt,
      lastSuccessfulCloudPersistAt: state.lastSuccessfulCloudPersistAt,
      lastConfirmedBatchId: state.lastConfirmedBatchId,
      lastConfirmedBatchCommittedAt: state.lastConfirmedBatchCommittedAt,
      lastReceiptStatus: state.lastReceiptStatus,
      lastReceiptHashMatch: state.lastReceiptHashMatch,
      lastReceiptSchemaVersion: state.lastReceiptSchemaVersion,
      lastReceiptTouchedTables: state.lastReceiptTouchedTables,
      lastReceiptOperationCount: state.lastReceiptOperationCount,
      lastReceiptOperationCountsByEntity: state.lastReceiptOperationCountsByEntity,
      lastFailedBatchId: state.lastFailedBatchId,
    };
  }

  if (saveKind === 'local-only') {
    return {
      syncState: 'saved',
      lastSyncedAt: state.lastSyncedAt,
      lastCloudConfirmedAt: state.lastCloudConfirmedAt,
      lastLocalWriteAt: timestamp,
      cloudSyncStatus: mode === 'browser' ? 'local-only-confirmed' : state.cloudSyncStatus,
      loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
      sessionTrustState: state.sessionDegraded ? 'degraded' : 'healthy',
      sessionDegraded: state.sessionDegraded,
      sessionDegradedReason: state.sessionDegradedReason,
      sessionDegradedAt: state.sessionDegradedAt,
      sessionDegradedClearedByCloudSave: state.sessionDegradedClearedByCloudSave,
      sessionTrustRecoveredAt: state.sessionTrustRecoveredAt,
      lastSuccessfulPersistAt: timestamp,
      lastSuccessfulCloudPersistAt: state.lastSuccessfulCloudPersistAt,
      lastConfirmedBatchId: state.lastConfirmedBatchId,
      lastConfirmedBatchCommittedAt: state.lastConfirmedBatchCommittedAt,
      lastReceiptStatus: state.lastReceiptStatus,
      lastReceiptHashMatch: state.lastReceiptHashMatch,
      lastReceiptSchemaVersion: state.lastReceiptSchemaVersion,
      lastReceiptTouchedTables: state.lastReceiptTouchedTables,
      lastReceiptOperationCount: state.lastReceiptOperationCount,
      lastReceiptOperationCountsByEntity: state.lastReceiptOperationCountsByEntity,
      lastFailedBatchId: state.lastFailedBatchId,
    };
  }

  const recoveredByCloudSave = canCloudConfirmationRecoverSession(state);

  const committedAt = diagnostics?.committedAt ?? timestamp;
  return {
    syncState: 'saved',
    lastSyncedAt: committedAt,
    lastCloudConfirmedAt: committedAt,
    lastLocalWriteAt: timestamp,
    cloudSyncStatus: 'cloud-confirmed',
    loadedFromLocalRecoveryCache: false,
    sessionTrustState: recoveredByCloudSave ? 'recovered' : 'healthy',
    sessionDegraded: false,
    sessionDegradedReason: 'none',
    sessionDegradedAt: recoveredByCloudSave ? state.sessionDegradedAt : undefined,
    sessionDegradedClearedByCloudSave: recoveredByCloudSave,
    sessionTrustRecoveredAt: recoveredByCloudSave ? committedAt : state.sessionTrustRecoveredAt,
    lastSuccessfulPersistAt: timestamp,
    lastSuccessfulCloudPersistAt: committedAt,
    lastConfirmedBatchId: diagnostics?.batchId ?? state.lastConfirmedBatchId,
    lastConfirmedBatchCommittedAt: committedAt,
    lastReceiptStatus: diagnostics?.receiptStatus === 'rejected' ? 'rejected' : 'committed',
    lastReceiptHashMatch: diagnostics?.hashMatch ?? state.lastReceiptHashMatch,
    lastReceiptSchemaVersion: diagnostics?.schemaVersion ?? state.lastReceiptSchemaVersion,
    lastReceiptTouchedTables: diagnostics?.touchedTables ?? state.lastReceiptTouchedTables,
    lastReceiptOperationCount: diagnostics?.operationCount ?? state.lastReceiptOperationCount,
    lastReceiptOperationCountsByEntity: diagnostics?.operationCountsByEntity ?? state.lastReceiptOperationCountsByEntity,
    lastFailedBatchId: undefined,
  };
}
