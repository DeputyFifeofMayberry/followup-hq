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
                summary: scopedCount > 0 ? `${scopedCount} change${scopedCount === 1 ? '' : 's'} queued for save.` : 'Changes queued for save.',
                detail: scopedCount > 0 ? 'SetPoint will sync these updates automatically.' : 'SetPoint will sync your latest updates automatically.',
              });
              return {
                hasLocalUnsavedChanges: true,
                unsavedChangeCount: state.unsavedChangeCount + 1,
                dirtyRecordRefs: Array.from(merged.values()),
                syncState: state.syncState === 'error' ? 'error' : 'dirty',
                persistenceActivity: appendPersistenceActivity(state.persistenceActivity, queuedEvent),
              };
            });
          },
          onSaving: ({ reason }) => set((state) => {
            const summary = reason === 'retry'
              ? 'Retrying failed save.'
              : reason === 'manual'
                ? 'Manual save in progress.'
                : 'Saving latest changes.';
            return {
              syncState: 'saving',
              saveError: '',
              persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({ kind: 'saving', summary })),
            };
          }),
          onSaved: (mode, timestamp, reason) => set((state) => ({
            persistenceMode: mode,
            syncState: 'saved',
            saveError: '',
            lastSyncedAt: timestamp,
            unsavedChangeCount: 0,
            hasLocalUnsavedChanges: false,
            dirtyRecordRefs: [],
            persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
              kind: 'saved',
              at: timestamp,
              summary: reason === 'manual' ? 'Manual save completed.' : reason === 'retry' ? 'Retry save completed.' : 'Changes saved successfully.',
              detail: mode === 'supabase' ? 'Cloud-backed sync confirmed.' : 'Local persistence updated.',
            })),
          })),
          onError: (message, timestamp, reason) => set((state) => ({
            syncState: 'error',
            saveError: message,
            hasLocalUnsavedChanges: true,
            lastFailedSyncAt: timestamp,
            persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
              kind: 'failed',
              at: timestamp,
              summary: reason === 'retry' ? 'Retry failed.' : 'Save attempt failed.',
              detail: message,
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
    ...createUiSlice(set),
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
