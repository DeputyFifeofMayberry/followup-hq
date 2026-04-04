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

const defaultOutlookConnection = initialBusinessState.outlookConnection;

let enqueuePersist: (() => void) | null = null;

export const useAppStore = create<AppStore>()((set, get) => {
  const queuePersist = () => {
    if (!enqueuePersist) {
      enqueuePersist = createPersistenceQueue(
        {
          getPayload: () => buildPersistedPayload(get()),
          onSaving: () => set({ syncState: 'saving', saveError: '' }),
          onSaved: (mode, timestamp) => set({ persistenceMode: mode, syncState: 'saved', saveError: '', lastSyncedAt: timestamp }),
          onError: (message) => set({ syncState: 'error', saveError: message }),
        },
        { debounceMs: 350, maxRetries: 2, retryDelayMs: 650 },
      );
    }
    enqueuePersist();
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
  };
});

export const useAppStoreShallow = useShallow;
