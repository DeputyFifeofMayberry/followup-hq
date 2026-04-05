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

const defaultOutlookConnection = initialBusinessState.outlookConnection;

let persistenceQueue: PersistenceQueueController | null = null;

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
              saveError: '',
              persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({ kind: 'saving', summary })),
            };
          }),
          onSaved: (mode, timestamp, reason, didPersist, diagnostics) => set((state) => {
            const postSave = resolvePostSaveMetaState(state, mode, timestamp, didPersist);
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
              ? `Your latest updates are confirmed in cloud storage.${staleDeleteDetail}`
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
          }),
          onError: (message, timestamp, reason, diagnostics) => set((state) => ({
            syncState: 'error',
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
            persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
              kind: 'failed',
              at: timestamp,
              summary: reason === 'retry' ? 'Retry failed. Protected local copy retained.' : 'Save failed. Protected local copy retained.',
              detail: diagnostics?.failedTable
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
    isRecordDirty: (type, id) => get().dirtyRecordRefs.some((ref) => ref.type === type && ref.id === id),
  };
});

export const useAppStoreShallow = useShallow;
