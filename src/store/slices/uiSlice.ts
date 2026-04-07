import { createId, todayIso } from '../../lib/utils';
import { defaultFollowUpFilters } from '../../lib/followUpSelectors';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceSet } from './types';
import type { QueueRequestMeta } from '../persistenceQueue';

export function createUiSlice(set: SliceSet, queuePersist: (meta?: QueueRequestMeta) => void): Pick<AppStoreActions,
  'setSelectedId' | 'setSearch' | 'setProjectFilter' | 'setStatusFilter' | 'setActiveView' | 'setFollowUpFilters' | 'resetFollowUpFilters' |
  'toggleFollowUpSelection' | 'clearFollowUpSelection' | 'pushToast' | 'dismissToast' | 'dismissAllToasts' | 'expireToast' | 'handleToastAction' |
  'selectAllVisibleFollowUps' | 'saveFollowUpCustomView' | 'applySavedFollowUpCustomView' |
  'setFollowUpColumns' | 'setFollowUpTableDensity' | 'setFollowUpDuplicateModule' | 'openCreateModal' | 'openEditModal' | 'closeItemModal' | 'openTouchModal' | 'closeTouchModal' | 'openImportModal' |
  'closeImportModal' | 'openMergeModal' | 'closeMergeModal' | 'openDraftModal' | 'closeDraftModal' | 'setSelectedTaskId' | 'setTaskOwnerFilter' |
  'setTaskStatusFilter' | 'openCreateTaskModal' | 'openCreateFromCapture' | 'openEditTaskModal' | 'closeTaskModal' |
  'openRecordEditor' | 'openRecordDrawer' | 'closeRecordDrawer' | 'setSupportWorkspaceSession'
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
    pushToast: (toastInput) => {
      const id = createId('TOAST');
      const createdAt = new Date().toISOString();
      set((state: AppStore) => {
        const tone = toastInput.tone ?? 'info';
        const durationMs = toastInput.durationMs ?? state.toastConfig.defaultDurationMs[tone];
        const toast = {
          id,
          kind: toastInput.kind ?? 'action_result',
          tone,
          title: toastInput.title,
          message: toastInput.message,
          createdAt,
          durationMs,
          expiresAt: durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : undefined,
          action: toastInput.action,
          dismissible: toastInput.dismissible ?? true,
          source: toastInput.source,
          recordType: toastInput.recordType,
          recordIds: toastInput.recordIds,
          operationSummary: toastInput.operationSummary,
        };
        return { toasts: [toast, ...state.toasts].slice(0, state.toastConfig.maxVisible) };
      });
      return id;
    },
    dismissToast: (id) => set((state: AppStore) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    dismissAllToasts: () => set({ toasts: [] }),
    expireToast: (id) => set((state: AppStore) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    handleToastAction: (toastId) => {
      set((state: AppStore) => {
        const toast = state.toasts.find((entry) => entry.id === toastId);
        if (!toast?.action) return state;
        const infoToast = {
          id: createId('TOAST'),
          kind: 'system_notice' as const,
          tone: 'info' as const,
          title: `${toast.action.label} not available yet`,
          message: 'Undo support will be enabled in the next workflow upgrade.',
          createdAt: new Date().toISOString(),
          durationMs: state.toastConfig.defaultDurationMs.info,
          expiresAt: new Date(Date.now() + state.toastConfig.defaultDurationMs.info).toISOString(),
          dismissible: true,
          source: 'toast_action',
        };
        const toasts = state.toasts.filter((entry) => entry.id !== toastId);
        return { toasts: [infoToast, ...toasts].slice(0, state.toastConfig.maxVisible) };
      });
    },
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
    openCreateModal: () => set({
      itemModal: { open: true, mode: 'create', itemId: null },
      taskModal: { open: false, mode: 'create', taskId: null },
      recordDrawerRef: null,
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'followup', id: 'new-followup' },
      activeEditorMode: 'create',
      recordSurfaceSource: 'create_button',
      createWorkDraft: null,
    }),
    // Canonical deep-edit surface: full record modal.
    openEditModal: (id) => set({
      itemModal: { open: true, mode: 'edit', itemId: id },
      taskModal: { open: false, mode: 'create', taskId: null },
      recordDrawerRef: null,
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'followup', id },
      activeEditorMode: 'edit',
      recordSurfaceSource: 'direct_open',
      selectedId: id,
    }),
    closeItemModal: () => set({ itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null, activeRecordSurface: 'none', activeRecordRef: null, activeEditorMode: null, recordSurfaceSource: null }),
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
    openCreateTaskModal: () => set({
      taskModal: { open: true, mode: 'create', taskId: null },
      itemModal: { open: false, mode: 'create', itemId: null },
      recordDrawerRef: null,
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'task', id: 'new-task' },
      activeEditorMode: 'create',
      recordSurfaceSource: 'create_button',
      createWorkDraft: null,
    }),
    openCreateFromCapture: (draft) => set({
      createWorkDraft: draft,
      itemModal: draft.kind === 'followup' ? { open: true, mode: 'create', itemId: null } : { open: false, mode: 'create', itemId: null },
      taskModal: draft.kind === 'task' ? { open: true, mode: 'create', taskId: null } : { open: false, mode: 'create', taskId: null },
      recordDrawerRef: null,
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: draft.kind, id: draft.kind === 'task' ? 'new-task' : 'new-followup' },
      activeEditorMode: 'create',
      recordSurfaceSource: 'capture',
    }),
    // Canonical deep-edit surface: full record modal.
    openEditTaskModal: (id) => set({
      taskModal: { open: true, mode: 'edit', taskId: id },
      itemModal: { open: false, mode: 'create', itemId: null },
      recordDrawerRef: null,
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'task', id },
      activeEditorMode: 'edit',
      recordSurfaceSource: 'direct_open',
      selectedTaskId: id,
    }),
    closeTaskModal: () => set({ taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null, activeRecordSurface: 'none', activeRecordRef: null, activeEditorMode: null, recordSurfaceSource: null }),
    openRecordEditor: (ref, mode = 'edit', source = 'context_handoff') => set((state: AppStore) => {
      if (ref.type === 'followup') {
        return {
          itemModal: { open: true, mode, itemId: mode === 'edit' ? ref.id : null },
          taskModal: { open: false, mode: 'create', taskId: null },
          recordDrawerRef: mode === 'edit' ? state.recordDrawerRef : null,
          activeRecordSurface: 'full_editor',
          activeRecordRef: ref,
          activeEditorMode: mode,
          recordSurfaceSource: source,
          selectedId: mode === 'edit' ? ref.id : state.selectedId,
        };
      }
      if (ref.type === 'task') {
        return {
          taskModal: { open: true, mode, taskId: mode === 'edit' ? ref.id : null },
          itemModal: { open: false, mode: 'create', itemId: null },
          recordDrawerRef: mode === 'edit' ? state.recordDrawerRef : null,
          activeRecordSurface: 'full_editor',
          activeRecordRef: ref,
          activeEditorMode: mode,
          recordSurfaceSource: source,
          selectedTaskId: mode === 'edit' ? ref.id : state.selectedTaskId,
        };
      }
      return { recordDrawerRef: ref, activeRecordSurface: 'context_drawer', activeRecordRef: ref, activeEditorMode: null, recordSurfaceSource: source };
    }),
    // Context-inspection surface: record drawer (not the primary full editor).
    openRecordDrawer: (ref) => set({
      recordDrawerRef: ref,
      itemModal: { open: false, mode: 'create', itemId: null },
      taskModal: { open: false, mode: 'create', taskId: null },
      activeRecordSurface: 'context_drawer',
      activeRecordRef: ref,
      activeEditorMode: null,
      recordSurfaceSource: 'context_open',
    }),
    closeRecordDrawer: () => set({ recordDrawerRef: null, activeRecordSurface: 'none', activeRecordRef: null, activeEditorMode: null, recordSurfaceSource: null }),
    setSupportWorkspaceSession: (lens, patch) => set((state: AppStore) => ({
      supportWorkspaceSession: {
        ...state.supportWorkspaceSession,
        [lens]: {
          ...state.supportWorkspaceSession[lens],
          ...patch,
        },
      },
    })),
  };
}
