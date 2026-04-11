import { createId, todayIso } from '../../lib/utils';
import { getRecentWorkMode } from '../../lib/dataEntryDefaults';
import { defaultFollowUpFilters } from '../../lib/followUpSelectors';
import { defaultTaskWorkspaceSession } from '../../domains/tasks';
import { mergeDirectoryWorkspaceSession } from '../../domains/directory/session';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceGet, SliceSet } from './types';
import type { QueueRequestMeta } from '../persistenceQueue';

export function createUiSlice(set: SliceSet, get: SliceGet, queuePersist: (meta?: QueueRequestMeta) => void): Pick<AppStoreActions,
  'setSelectedId' | 'setSearch' | 'setProjectFilter' | 'setStatusFilter' | 'setActiveView' | 'setFollowUpFilters' | 'resetFollowUpFilters' |
  'toggleFollowUpSelection' | 'clearFollowUpSelection' | 'pushToast' | 'dismissToast' | 'dismissAllToasts' | 'expireToast' | 'handleToastAction' |
  'selectAllVisibleFollowUps' | 'saveFollowUpCustomView' | 'applySavedFollowUpCustomView' |
  'setFollowUpColumns' | 'setFollowUpTableDensity' | 'setFollowUpDuplicateModule' | 'openCreateModal' | 'openEditModal' | 'closeItemModal' | 'openTouchModal' | 'closeTouchModal' | 'openImportModal' |
  'closeImportModal' | 'openMergeModal' | 'closeMergeModal' | 'openDraftModal' | 'closeDraftModal' | 'setSelectedTaskId' | 'setTaskWorkspaceSession' |
  'resetTaskWorkspaceSession' | 'openCreateTaskModal' | 'openCreateWorkModal' | 'openCreateFromCapture' | 'openEditTaskModal' | 'closeTaskModal' |
  'openRecordEditor' | 'openFollowUpInspector' | 'closeFollowUpInspector' | 'openRecordDrawer' | 'closeRecordDrawer' | 'setSupportWorkspaceSession' | 'setDirectoryWorkspaceSession'
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
      const toast = get().toasts.find((entry) => entry.id === toastId);
      if (!toast?.action?.actionId) return;
      get().dismissToast(toastId);
      get().executeUndo(toast.action.actionId);
    },
    selectAllVisibleFollowUps: (ids, selected = true) => set((state: AppStore) => {
      const existing = new Set(state.selectedFollowUpIds);
      if (selected) {
        ids.forEach((id) => existing.add(id));
      } else {
        ids.forEach((id) => existing.delete(id));
      }
      return {
        selectedFollowUpIds: Array.from(existing),
      };
    }),
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
      followUpInspector: { open: false, itemId: null },
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
      followUpInspector: { open: false, itemId: null },
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'followup', id },
      activeEditorMode: 'edit',
      recordSurfaceSource: 'direct_open',
      selectedId: id,
    }),
    closeItemModal: () => set({ itemModal: { open: false, mode: 'create', itemId: null }, followUpInspector: { open: false, itemId: null }, createWorkDraft: null, activeRecordSurface: 'none', activeRecordRef: null, activeEditorMode: null, recordSurfaceSource: null }),
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
    setTaskWorkspaceSession: (patch) => set((state: AppStore) => ({
      taskWorkspaceSession: {
        ...state.taskWorkspaceSession,
        ...patch,
      },
    })),
    setDirectoryWorkspaceSession: (patch) => set((state: AppStore) => ({
      directoryWorkspaceSession: mergeDirectoryWorkspaceSession(state.directoryWorkspaceSession, patch),
    })),
    resetTaskWorkspaceSession: (options) => set((state: AppStore) => ({
      taskWorkspaceSession: {
        ...defaultTaskWorkspaceSession,
        ...(options?.preserveView ? { view: state.taskWorkspaceSession.view } : {}),
        ...(options?.preserveSearch ? { searchQuery: state.taskWorkspaceSession.searchQuery } : {}),
      },
    })),
    openCreateTaskModal: () => set({
      taskModal: { open: true, mode: 'create', taskId: null },
      itemModal: { open: false, mode: 'create', itemId: null },
      recordDrawerRef: null,
      followUpInspector: { open: false, itemId: null },
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'task', id: 'new-task' },
      activeEditorMode: 'create',
      recordSurfaceSource: 'create_button',
      createWorkDraft: null,
    }),
    openCreateWorkModal: () => set(() => {
      const recentMode = getRecentWorkMode();
      return {
        itemModal: recentMode === 'followup' ? { open: true, mode: 'create', itemId: null } : { open: false, mode: 'create', itemId: null },
        taskModal: recentMode === 'task' ? { open: true, mode: 'create', taskId: null } : { open: false, mode: 'create', taskId: null },
        recordDrawerRef: null,
        followUpInspector: { open: false, itemId: null },
        activeRecordSurface: 'full_editor',
        activeRecordRef: { type: recentMode, id: recentMode === 'task' ? 'new-task' : 'new-followup' },
        activeEditorMode: 'create',
        recordSurfaceSource: 'create_button',
        createWorkDraft: null,
      };
    }),
    openCreateFromCapture: (draft) => set({
      createWorkDraft: draft,
      itemModal: draft.kind === 'followup' ? { open: true, mode: 'create', itemId: null } : { open: false, mode: 'create', itemId: null },
      taskModal: draft.kind === 'task' ? { open: true, mode: 'create', taskId: null } : { open: false, mode: 'create', taskId: null },
      recordDrawerRef: null,
      followUpInspector: { open: false, itemId: null },
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
      followUpInspector: { open: false, itemId: null },
      activeRecordSurface: 'full_editor',
      activeRecordRef: { type: 'task', id },
      activeEditorMode: 'edit',
      recordSurfaceSource: 'direct_open',
      selectedTaskId: id,
    }),
    closeTaskModal: () => set({ taskModal: { open: false, mode: 'create', taskId: null }, followUpInspector: { open: false, itemId: null }, createWorkDraft: null, activeRecordSurface: 'none', activeRecordRef: null, activeEditorMode: null, recordSurfaceSource: null }),
    openRecordEditor: (ref, mode = 'edit', source = 'context_handoff') => set((state: AppStore) => {
      if (ref.type === 'followup') {
        return {
          itemModal: { open: true, mode, itemId: mode === 'edit' ? ref.id : null },
          taskModal: { open: false, mode: 'create', taskId: null },
          followUpInspector: { open: false, itemId: null },
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
          followUpInspector: { open: false, itemId: null },
          recordDrawerRef: mode === 'edit' ? state.recordDrawerRef : null,
          activeRecordSurface: 'full_editor',
          activeRecordRef: ref,
          activeEditorMode: mode,
          recordSurfaceSource: source,
          selectedTaskId: mode === 'edit' ? ref.id : state.selectedTaskId,
        };
      }
      return { followUpInspector: { open: false, itemId: null }, recordDrawerRef: ref, activeRecordSurface: 'context_drawer', activeRecordRef: ref, activeEditorMode: null, recordSurfaceSource: source };
    }),
    // Context-inspection surface: record drawer (not the primary full editor).
    openRecordDrawer: (ref) => set({
      recordDrawerRef: ref,
      itemModal: { open: false, mode: 'create', itemId: null },
      taskModal: { open: false, mode: 'create', taskId: null },
      followUpInspector: { open: false, itemId: null },
      activeRecordSurface: 'context_drawer',
      activeRecordRef: ref,
      activeEditorMode: null,
      recordSurfaceSource: 'context_open',
    }),
    openFollowUpInspector: (id, source = 'workspace') => set({
      followUpInspector: { open: true, itemId: id },
      itemModal: { open: false, mode: 'create', itemId: null },
      taskModal: { open: false, mode: 'create', taskId: null },
      activeRecordSurface: 'execution_inspector',
      activeRecordRef: { type: 'followup', id },
      activeEditorMode: null,
      recordSurfaceSource: source,
      selectedId: id,
    }),
    closeFollowUpInspector: () => set((state: AppStore) => ({
      followUpInspector: { open: false, itemId: null },
      activeRecordSurface: state.recordDrawerRef ? 'context_drawer' : 'none',
      activeRecordRef: state.recordDrawerRef,
      activeEditorMode: null,
      recordSurfaceSource: state.recordDrawerRef ? 'context_open' : null,
    })),
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
