import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createPersistenceQueue } from './persistenceQueue';
import { buildPersistedPayload } from './state/persistence';
import { initialBusinessState, initialMetaState, initialUiState } from './state/initialState';
import { createUiSlice } from './slices/uiSlice';
import { createExecutionViewSlice } from './slices/executionViewSlice';
import { createFollowUpsSlice } from './slices/followUpsSlice';
import { createTasksSlice } from './slices/tasksSlice';
import { createProjectsSlice } from './slices/projectsSlice';
import { createRelationshipsSlice } from './slices/relationshipsSlice';
import { createIntakeSlice } from './slices/intakeSlice';
import { createForwardingSlice } from './slices/forwardingSlice';
import { createOutlookSlice } from './slices/outlookSlice';
import { createMetaSlice } from './slices/metaSlice';
import type { AppStore } from './types';
import type { DirtyRecordRef, PersistenceQueueController, QueueRequestMeta } from './persistenceQueue';
import { appendPersistenceActivity, createPersistenceActivityEvent } from './persistenceActivity';
import { getSaveResultKind, resolvePostSaveMetaState } from './persistenceMeta';
import { verifyPersistedState } from '../lib/persistenceVerification';
import { clearCommittedOutboxEntries, listUnresolvedOutboxEntries, loadOutboxState } from '../lib/persistenceOutbox';

const defaultOutlookConnection = initialBusinessState.outlookConnection;

let persistenceQueue: PersistenceQueueController | null = null;

export function resetPersistenceQueueController(): void {
  if (!persistenceQueue) return;
  persistenceQueue.cancelPending();
  persistenceQueue.resetInternalState();
  persistenceQueue = null;
}

export const useAppStore = create<AppStore>()((set, get) => {
  const queuePersist = (meta?: QueueRequestMeta) => {
    if (!persistenceQueue) {
      persistenceQueue = createPersistenceQueue(
        {
          getPayload: () => buildPersistedPayload(get()),
          onQueued: (requestMeta) => {
            set((state) => {
              const merged = new Map<string, DirtyRecordRef>();
              state.dirtyRecordRefs.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              requestMeta?.dirtyRecords?.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              const scopedCount = requestMeta?.dirtyRecords?.length ?? 0;
              const queuedEvent = createPersistenceActivityEvent({
                kind: 'queued',
                summary: 'Changes queued to save.',
                detail: scopedCount > 0 ? `${scopedCount} change${scopedCount === 1 ? '' : 's'} added to the save queue.` : 'SetPoint will save your latest updates automatically.',
              });
              const pendingRecordCount = merged.size;
              return {
                hasLocalUnsavedChanges: true,
                unsavedChangeCount: pendingRecordCount,
                dirtyRecordRefs: Array.from(merged.values()),
                syncState: 'dirty',
                outboxState: 'queued',
                saveError: '',
                cloudSyncStatus: state.sessionDegraded
                  ? state.cloudSyncStatus
                  : state.persistenceMode === 'supabase'
                    ? 'pending-cloud'
                    : 'local-only-confirmed',
                persistenceActivity: appendPersistenceActivity(state.persistenceActivity, queuedEvent),
              };
            });
          },
          onSaving: ({ reason }) => set((state) => {
            const summary = reason === 'retry'
              ? 'Retry in progress.'
              : reason === 'manual'
                ? 'Saving latest changes.'
                : 'Saving latest changes.';
            return {
              syncState: 'saving',
              outboxState: 'flushing',
              saveError: '',
              persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({ kind: 'saving', summary })),
            };
          }),
          onSaved: (mode, timestamp, reason, didPersist, diagnostics) => {
            set((state) => {
              const postSave = resolvePostSaveMetaState(state, mode, timestamp, didPersist, diagnostics);
              const saveKind = getSaveResultKind(mode, didPersist);
              const staleDeleteDetail = diagnostics?.staleDeleteWarnings?.length
                ? ` ${diagnostics.staleDeleteWarnings.join(' ')}`
                : '';
              const recoveredByCloudSave = state.sessionDegraded && !postSave.sessionDegraded && postSave.sessionDegradedClearedByCloudSave;
              const saveSummary = reason === 'retry'
                ? recoveredByCloudSave
                  ? 'Retry completed and trust restored.'
                  : 'Retry completed.'
                : saveKind === 'cloud-confirmed'
                  ? 'Changes confirmed to cloud.'
                  : saveKind === 'local-only'
                    ? 'Changes saved locally.'
                    : 'No new changes to save.';
              const saveDetail = saveKind === 'cloud-confirmed'
                ? `Your latest updates are confirmed in cloud storage.${diagnostics?.batchId ? ` Batch ${diagnostics.batchId}.` : ''}${staleDeleteDetail}`
                : saveKind === 'local-only'
                  ? `Your latest updates are saved on this device.${staleDeleteDetail}`
                  : 'No new changes were detected.';
              const recoveredEvent = recoveredByCloudSave
                ? createPersistenceActivityEvent({
                  kind: 'saved',
                  at: timestamp,
                  summary: 'Cloud-backed trust restored for this session.',
                  detail: 'SetPoint confirmed a cloud-backed save and cleared the session trust warning.',
                })
                : null;
              return {
                persistenceMode: mode,
                syncState: postSave.syncState,
                saveError: '',
                lastSyncedAt: postSave.lastSyncedAt,
                lastCloudConfirmedAt: postSave.lastCloudConfirmedAt,
                lastLocalWriteAt: postSave.lastLocalWriteAt,
                lastSuccessfulPersistAt: postSave.lastSuccessfulPersistAt,
                lastSuccessfulCloudPersistAt: postSave.lastSuccessfulCloudPersistAt,
                lastConfirmedBatchId: postSave.lastConfirmedBatchId,
                lastConfirmedBatchCommittedAt: postSave.lastConfirmedBatchCommittedAt,
                lastReceiptStatus: postSave.lastReceiptStatus,
                lastReceiptHashMatch: postSave.lastReceiptHashMatch,
                lastReceiptSchemaVersion: postSave.lastReceiptSchemaVersion,
                lastReceiptTouchedTables: postSave.lastReceiptTouchedTables,
                lastReceiptOperationCount: postSave.lastReceiptOperationCount,
                lastReceiptOperationCountsByEntity: postSave.lastReceiptOperationCountsByEntity,
                lastFailedBatchId: postSave.lastFailedBatchId,
                outboxState: 'idle',
                unresolvedOutboxCount: listUnresolvedOutboxEntries(clearCommittedOutboxEntries()).length,
                lastOutboxFlushAt: timestamp,
                lastFallbackRestoreAt: state.lastFallbackRestoreAt,
                unsavedChangeCount: 0,
                hasLocalUnsavedChanges: false,
                dirtyRecordRefs: [],
                cloudSyncStatus: postSave.cloudSyncStatus,
                loadedFromLocalRecoveryCache: postSave.loadedFromLocalRecoveryCache,
                sessionTrustState: postSave.sessionTrustState,
                sessionDegraded: postSave.sessionDegraded,
                sessionDegradedReason: postSave.sessionDegradedReason,
                sessionDegradedAt: postSave.sessionDegradedAt,
                sessionDegradedClearedByCloudSave: postSave.sessionDegradedClearedByCloudSave,
                sessionTrustRecoveredAt: postSave.sessionTrustRecoveredAt,
                persistenceActivity: appendPersistenceActivity(
                  recoveredEvent ? appendPersistenceActivity(state.persistenceActivity, recoveredEvent) : state.persistenceActivity,
                  createPersistenceActivityEvent({
                    kind: 'saved',
                    at: timestamp,
                    summary: saveSummary,
                    detail: saveDetail,
                  }),
                ),
              };
            });
          },
          onError: (message, timestamp, reason, diagnostics) => set((state) => ({
            conflictQueue: diagnostics?.receiptStatus === 'conflict'
              ? [
                ...state.conflictQueue,
                ...(diagnostics.conflictIds ?? [`${diagnostics.failedBatchId ?? 'batch'}-conflict`]).map((id) => ({
                  id,
                  entity: 'unknown',
                  recordId: 'unknown',
                  conflictType: 'revision_mismatch',
                  summary: 'Cloud save blocked due to stale or concurrent state.',
                  technicalDetail: message,
                  localBatchId: diagnostics.batchId ?? diagnostics.failedBatchId,
                  status: 'open' as const,
                  createdAt: timestamp,
                })),
              ]
              : state.conflictQueue,
            syncState: 'error',
            outboxState: diagnostics?.receiptStatus === 'conflict' ? 'conflict' : 'failed',
            unresolvedOutboxCount: listUnresolvedOutboxEntries(loadOutboxState()).length,
            lastOutboxFailureAt: timestamp,
            saveError: message,
            hasLocalUnsavedChanges: true,
            unsavedChangeCount: state.dirtyRecordRefs.length,
            cloudSyncStatus: 'cloud-save-failed-local-preserved',
            loadedFromLocalRecoveryCache: false,
            lastLocalWriteAt: timestamp,
            lastFailedSyncAt: timestamp,
            sessionTrustState: 'degraded',
            sessionDegraded: true,
            sessionDegradedReason: 'cloud-save-failed',
            sessionDegradedAt: state.sessionDegradedAt ?? timestamp,
            sessionDegradedClearedByCloudSave: false,
            lastFailedBatchId: diagnostics?.failedBatchId,
            conflictReviewNeeded: diagnostics?.receiptStatus === 'conflict' || state.conflictReviewNeeded,
            openConflictCount: (diagnostics?.receiptStatus === 'conflict'
              ? (state.openConflictCount + (diagnostics?.conflictedOperationCount ?? 1))
              : state.openConflictCount),
            lastConflictDetectedAt: diagnostics?.receiptStatus === 'conflict' ? timestamp : state.lastConflictDetectedAt,
            lastConflictBatchId: diagnostics?.receiptStatus === 'conflict' ? (diagnostics?.batchId ?? diagnostics?.failedBatchId) : state.lastConflictBatchId,
            lastConflictFailureMessage: diagnostics?.receiptStatus === 'conflict' ? message : state.lastConflictFailureMessage,
            persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
              kind: 'failed',
              at: timestamp,
              summary: reason === 'retry' ? 'Retry failed. Protected local copy retained.' : 'Save failed. Protected local copy retained.',
              detail: diagnostics?.failedBatchId
                ? `${message} (Technical detail: batch ${diagnostics.failedBatchId}${diagnostics.failedTable ? `; table ${diagnostics.failedTable}` : ''}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                : diagnostics?.failedTable
                  ? `${message} (Technical detail: table ${diagnostics.failedTable}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                  : message,
            })),
          })),
        },
        { debounceMs: 350, maxRetries: 2, retryDelayMs: 650 },
      );
    }
    persistenceQueue.enqueue(meta);
  };

  return {
    ...initialBusinessState,
    ...initialUiState,
    ...initialMetaState,
    ...createMetaSlice(set, defaultOutlookConnection),
    ...createUiSlice(set, queuePersist),
    ...createExecutionViewSlice(set, get, { queuePersist }),
    ...createFollowUpsSlice(set, get, { queuePersist }),
    ...createTasksSlice(set, get, { queuePersist }),
    ...createProjectsSlice(set, { queuePersist }),
    ...createRelationshipsSlice(set, get, { queuePersist }),
    ...createIntakeSlice(set, get, { queuePersist }),
    ...createForwardingSlice(set, { queuePersist }),
    ...createOutlookSlice(set, get, { queuePersist }, defaultOutlookConnection),
    flushPersistenceNow: async () => {
      if (!persistenceQueue) return;
      await persistenceQueue.flushNow();
    },
    retryPersistenceNow: async () => {
      if (!persistenceQueue) return;
      await persistenceQueue.retryNow();
    },
    resetForLogout: () => {
      resetPersistenceQueueController();
      set(() => ({
        ...initialBusinessState,
        ...initialUiState,
        ...initialMetaState,
      }));
    },

    verifyNow: async (mode = 'manual') => {
      const startedAt = new Date().toISOString();
      set((state) => ({
        verificationState: 'running',
        lastVerificationStartedAt: startedAt,
        lastVerificationFailureMessage: undefined,
      }));

      try {
        const current = get();
        const result = await verifyPersistedState({
          target: {
            payload: buildPersistedPayload(current),
            schemaVersionClient: current.lastReceiptSchemaVersion,
            lastLocalWriteAt: current.lastLocalWriteAt,
          },
          context: {
            mode,
            basedOnBatchId: current.lastConfirmedBatchId,
            basedOnCommittedAt: current.lastConfirmedBatchCommittedAt,
            includePreviews: true,
            maxMismatchPreviewCount: 50,
          },
        });

        set((state) => ({
          verificationState: result.summary.verified ? 'verified-match' : 'mismatch-found',
          lastVerificationRunId: result.summary.runId,
          lastVerificationStartedAt: result.summary.startedAt,
          lastVerificationCompletedAt: result.summary.completedAt,
          lastVerificationMatched: result.summary.verified,
          lastVerificationMismatchCount: result.summary.mismatchCount,
          lastVerificationBasedOnBatchId: result.summary.basedOnBatchId,
          lastVerificationFailureMessage: result.summary.cloudReadSucceeded ? undefined : result.mismatches[0]?.technicalDetail,
          verificationSummary: result.summary,
          latestVerificationResult: result,
          recoveryReviewNeeded: !result.summary.verified,
          reviewedMismatchIds: !result.summary.verified ? state.reviewedMismatchIds : [],
          persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
            kind: 'saved',
            summary: result.summary.verified ? 'Verified match with cloud state.' : 'Recovery review needed.',
            detail: result.summary.verified
              ? 'Last verification matched current cloud state.'
              : `Last verification found ${result.summary.mismatchCount} mismatch${result.summary.mismatchCount === 1 ? '' : 'es'}.`,
          })),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed.';
        set((state) => ({
          verificationState: 'failed',
          lastVerificationCompletedAt: new Date().toISOString(),
          lastVerificationMatched: false,
          lastVerificationFailureMessage: message,
          recoveryReviewNeeded: state.recoveryReviewNeeded,
          persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
            kind: 'failed',
            summary: 'Could not verify current cloud match.',
            detail: message,
          })),
        }));
      }
    },
    markVerificationMismatchReviewed: (mismatchId) => set((state) => (
      state.reviewedMismatchIds.includes(mismatchId)
        ? state
        : { reviewedMismatchIds: [...state.reviewedMismatchIds, mismatchId] }
    )),
    clearReviewedVerificationMismatches: () => set({ reviewedMismatchIds: [] }),
    markConflictReviewed: (conflictId) => set((state) => ({
      conflictQueue: state.conflictQueue.map((conflict) => (
        conflict.id === conflictId ? { ...conflict, status: 'reviewed', updatedAt: new Date().toISOString() } : conflict
      )),
    })),
    dismissConflict: (conflictId) => set((state) => {
      const nextQueue = state.conflictQueue.map((conflict) => (
        conflict.id === conflictId ? { ...conflict, status: 'dismissed', updatedAt: new Date().toISOString() } : conflict
      ));
      const openCount = nextQueue.filter((entry) => entry.status === 'open').length;
      return {
        conflictQueue: nextQueue,
        openConflictCount: openCount,
        conflictReviewNeeded: openCount > 0,
      };
    }),
    isRecordDirty: (type, id) => get().dirtyRecordRefs.some((ref) => ref.type === type && ref.id === id),
  };
});

export const useAppStoreShallow = useShallow;
