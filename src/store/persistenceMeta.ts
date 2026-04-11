import type { AppMetaState, SaveProofCloudState, SaveProofState } from './state/types';
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
  | 'saveProof'
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

function toLegacyProofFields(saveProof: SaveProofState): Pick<PostSaveMetaState,
  | 'lastCloudConfirmedAt'
  | 'lastLocalWriteAt'
  | 'lastConfirmedBatchId'
  | 'lastConfirmedBatchCommittedAt'
  | 'lastReceiptStatus'
  | 'lastReceiptHashMatch'
  | 'lastReceiptSchemaVersion'
  | 'lastReceiptTouchedTables'
  | 'lastReceiptOperationCount'
  | 'lastReceiptOperationCountsByEntity'
  | 'lastFailedBatchId'
> {
  return {
    lastCloudConfirmedAt: saveProof.latestCloudConfirmedCommitAt,
    lastLocalWriteAt: saveProof.latestDurableLocalWriteAt,
    lastConfirmedBatchId: saveProof.latestConfirmedBatchId,
    lastConfirmedBatchCommittedAt: saveProof.latestCloudConfirmedCommitAt,
    lastReceiptStatus: saveProof.latestReceiptStatus,
    lastReceiptHashMatch: saveProof.latestReceiptHashMatch,
    lastReceiptSchemaVersion: saveProof.latestReceiptSchemaVersion,
    lastReceiptTouchedTables: saveProof.latestReceiptTouchedTables,
    lastReceiptOperationCount: saveProof.latestReceiptOperationCount,
    lastReceiptOperationCountsByEntity: saveProof.latestReceiptOperationCountsByEntity,
    lastFailedBatchId: saveProof.latestFailedBatchId,
  };
}

function mergeSaveProof(
  state: Pick<AppMetaState, 'saveProof'>,
  patch: Partial<SaveProofState>,
  cloudProofState?: SaveProofCloudState,
): SaveProofState {
  return {
    ...state.saveProof,
    ...patch,
    cloudProofState: cloudProofState ?? state.saveProof.cloudProofState,
  };
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
  | 'saveProof'
  >,
  mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading',
  timestamp: string,
  didPersist: boolean,
  diagnostics?: SaveDiagnostics,
): PostSaveMetaState {
  const saveKind = getSaveResultKind(mode, didPersist);

  if (!didPersist) {
    const saveProof = mergeSaveProof(state, { latestLocalSaveAttemptAt: timestamp });
    return {
      syncState: state.syncState === 'error' ? 'error' : 'saved',
      lastSyncedAt: state.lastSyncedAt,
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
      saveProof,
      ...toLegacyProofFields(saveProof),
    };
  }

  if (saveKind === 'local-only') {
    const saveProof = mergeSaveProof(state, {
      latestLocalSaveAttemptAt: timestamp,
      latestDurableLocalWriteAt: timestamp,
      latestFailureMessage: undefined,
      latestFailureClass: undefined,
    }, 'local-only');
    return {
      syncState: 'saved',
      lastSyncedAt: state.lastSyncedAt,
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
      saveProof,
      ...toLegacyProofFields(saveProof),
    };
  }

  const recoveredByCloudSave = canCloudConfirmationRecoverSession(state);
  const hasCommittedCloudReceipt = diagnostics?.receiptStatus === 'committed' && Boolean(diagnostics?.batchId);

  if (!hasCommittedCloudReceipt) {
    const saveProof = mergeSaveProof(state, {
      latestLocalSaveAttemptAt: timestamp,
      latestDurableLocalWriteAt: timestamp,
      latestReceiptStatus: diagnostics?.receiptStatus ?? state.saveProof.latestReceiptStatus,
      latestReceiptHashMatch: diagnostics?.hashMatch ?? state.saveProof.latestReceiptHashMatch,
      latestReceiptSchemaVersion: diagnostics?.schemaVersion ?? state.saveProof.latestReceiptSchemaVersion,
      latestReceiptTouchedTables: diagnostics?.touchedTables ?? state.saveProof.latestReceiptTouchedTables,
      latestReceiptOperationCount: diagnostics?.operationCount ?? state.saveProof.latestReceiptOperationCount,
      latestReceiptOperationCountsByEntity: diagnostics?.operationCountsByEntity ?? state.saveProof.latestReceiptOperationCountsByEntity,
      latestFailedBatchId: diagnostics?.failedBatchId ?? state.saveProof.latestFailedBatchId,
    }, state.sessionDegraded ? 'degraded' : 'pending');
    return {
      syncState: 'saved',
      lastSyncedAt: state.lastSyncedAt,
      cloudSyncStatus: 'pending-cloud',
      loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
      sessionTrustState: state.sessionDegraded ? 'degraded' : state.sessionTrustState,
      sessionDegraded: state.sessionDegraded,
      sessionDegradedReason: state.sessionDegradedReason,
      sessionDegradedAt: state.sessionDegradedAt,
      sessionDegradedClearedByCloudSave: false,
      sessionTrustRecoveredAt: state.sessionTrustRecoveredAt,
      lastSuccessfulPersistAt: timestamp,
      lastSuccessfulCloudPersistAt: state.lastSuccessfulCloudPersistAt,
      saveProof,
      ...toLegacyProofFields(saveProof),
    };
  }

  const committedAt = diagnostics?.committedAt ?? timestamp;
  const saveProof = mergeSaveProof(state, {
    latestLocalSaveAttemptAt: timestamp,
    latestDurableLocalWriteAt: timestamp,
    latestCloudConfirmedCommitAt: committedAt,
    latestConfirmedBatchId: diagnostics?.batchId ?? state.saveProof.latestConfirmedBatchId,
    latestReceiptStatus: diagnostics?.receiptStatus === 'rejected' ? 'rejected' : 'committed',
    latestReceiptHashMatch: diagnostics?.hashMatch ?? state.saveProof.latestReceiptHashMatch,
    latestReceiptSchemaVersion: diagnostics?.schemaVersion ?? state.saveProof.latestReceiptSchemaVersion,
    latestReceiptTouchedTables: diagnostics?.touchedTables ?? state.saveProof.latestReceiptTouchedTables,
    latestReceiptOperationCount: diagnostics?.operationCount ?? state.saveProof.latestReceiptOperationCount,
    latestReceiptOperationCountsByEntity: diagnostics?.operationCountsByEntity ?? state.saveProof.latestReceiptOperationCountsByEntity,
    latestFailedBatchId: undefined,
    latestFailureMessage: undefined,
    latestFailureClass: undefined,
  }, 'confirmed');
  return {
    syncState: 'saved',
    lastSyncedAt: committedAt,
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
    saveProof,
    ...toLegacyProofFields(saveProof),
  };
}
