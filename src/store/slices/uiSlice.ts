import { createId, todayIso } from '../../lib/utils';
import { defaultFollowUpFilters } from '../../lib/followUpSelectors';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceSet } from './types';
import type { QueueRequestMeta } from '../persistenceQueue';

export function createUiSlice(set: SliceSet, queuePersist: (meta?: QueueRequestMeta) => void): Pick<AppStoreActions,
  'setSelectedId' | 'setSearch' | 'setProjectFilter' | 'setStatusFilter' | 'setActiveView' | 'setFollowUpFilters' | 'resetFollowUpFilters' |
  'toggleFollowUpSelection' | 'clearFollowUpSelection' | 'selectAllVisibleFollowUps' | 'saveFollowUpCustomView' | 'applySavedFollowUpCustomView' |
  'setFollowUpColumns' | 'setFollowUpTableDensity' | 'setFollowUpDuplicateModule' | 'openCreateModal' | 'openEditModal' | 'closeItemModal' | 'openTouchModal' | 'closeTouchModal' | 'openImportModal' |
  'closeImportModal' | 'openMergeModal' | 'closeMergeModal' | 'openDraftModal' | 'closeDraftModal' | 'setSelectedTaskId' | 'setTaskOwnerFilter' |
  'setTaskStatusFilter' | 'openCreateTaskModal' | 'openCreateFromCapture' | 'openEditTaskModal' | 'closeTaskModal' |
  'openRecordDrawer' | 'closeRecordDrawer'
> {
  return {
    setSelectedId: (id) => set((state: AppStore) => ({
      selectedId: id,
      executionLaneSessions: {
        ...state.executionLaneSessions,
        followups: {
          ...state.executionLaneSessions.followups,
          lastSelectedRecordId: id,
          updatedAt: new Date().toISOString(),
        },
      },
    })),
    setSearch: (value) => set({ search: value }),
    setProjectFilter: (value) => set({ projectFilter: value }),
    setStatusFilter: (value) => set({ statusFilter: value }),
    setActiveView: (value) => set({ activeView: value }),
    setFollowUpFilters: (value) => {
      set((state: AppStore) => ({ followUpFilters: { ...state.followUpFilters, ...value } }));
      queuePersist();
    },
    resetFollowUpFilters: () => {
      set({ followUpFilters: defaultFollowUpFilters });
      queuePersist();
    },
    toggleFollowUpSelection: (id) => set((state: AppStore) => ({
      selectedFollowUpIds: state.selectedFollowUpIds.includes(id) ? state.selectedFollowUpIds.filter((value) => value !== id) : [...state.selectedFollowUpIds, id],
      selectedId: id,
    })),
    clearFollowUpSelection: () => set({ selectedFollowUpIds: [] }),
    selectAllVisibleFollowUps: (ids) => set({ selectedFollowUpIds: ids }),
    saveFollowUpCustomView: (name, search) => {
      set((state: AppStore) => ({
        savedFollowUpViews: [{ id: createId('FUV'), name, search, activeView: state.activeView, filters: state.followUpFilters, createdAt: todayIso() }, ...state.savedFollowUpViews],
      }));
      queuePersist();
    },
    applySavedFollowUpCustomView: (id) => {
      let applied = false;
      set((state: AppStore) => {
        const view = state.savedFollowUpViews.find((entry) => entry.id === id);
        if (!view) return state;
        applied = true;
        return { search: view.search, activeView: view.activeView, followUpFilters: view.filters };
      });
      if (applied) queuePersist();
    },
    setFollowUpColumns: (columns) => {
      set({ followUpColumns: columns });
      queuePersist();
    },
    setFollowUpTableDensity: (density) => {
      set({ followUpTableDensity: density });
      queuePersist();
    },
    setFollowUpDuplicateModule: (mode) => {
      set({ followUpDuplicateModule: mode });
      queuePersist();
    },
    openCreateModal: () => set({ itemModal: { open: true, mode: 'create', itemId: null }, taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null }),
    // Canonical deep-edit surface: full record modal.
    openEditModal: (id) => set({ itemModal: { open: true, mode: 'edit', itemId: id }, selectedId: id }),
    closeItemModal: () => set({ itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null }),
    openTouchModal: () => set({ touchModalOpen: true }),
    closeTouchModal: () => set({ touchModalOpen: false }),
    openImportModal: () => set({ importModalOpen: true }),
    closeImportModal: () => set({ importModalOpen: false }),
    openMergeModal: (baseId, candidateId) => set({ mergeModal: { open: true, baseId, candidateId }, selectedId: baseId }),
    closeMergeModal: () => set({ mergeModal: { open: false, baseId: null, candidateId: null } }),
    openDraftModal: (id) => set({ draftModal: { open: true, itemId: id }, selectedId: id }),
    closeDraftModal: () => set({ draftModal: { open: false, itemId: null } }),
    setSelectedTaskId: (id) => set((state: AppStore) => ({
      selectedTaskId: id,
      executionLaneSessions: {
        ...state.executionLaneSessions,
        tasks: {
          ...state.executionLaneSessions.tasks,
          lastSelectedRecordId: id,
          updatedAt: new Date().toISOString(),
        },
      },
    })),
    setTaskOwnerFilter: (value) => set({ taskOwnerFilter: value }),
    setTaskStatusFilter: (value) => set({ taskStatusFilter: value }),
    openCreateTaskModal: () => set({ taskModal: { open: true, mode: 'create', taskId: null }, itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null }),
    openCreateFromCapture: (draft) => set({
      createWorkDraft: draft,
      itemModal: draft.kind === 'followup' ? { open: true, mode: 'create', itemId: null } : { open: false, mode: 'create', itemId: null },
      taskModal: draft.kind === 'task' ? { open: true, mode: 'create', taskId: null } : { open: false, mode: 'create', taskId: null },
    }),
    // Canonical deep-edit surface: full record modal.
    openEditTaskModal: (id) => set({ taskModal: { open: true, mode: 'edit', taskId: id }, selectedTaskId: id }),
    closeTaskModal: () => set({ taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null }),
    // Context-inspection surface: record drawer (not the primary full editor).
    openRecordDrawer: (ref) => set({ recordDrawerRef: ref }),
    closeRecordDrawer: () => set({ recordDrawerRef: null }),
  };
}
