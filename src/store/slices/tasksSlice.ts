import { validateTaskTransition } from '../../lib/workflowPolicy';
import { todayIso } from '../../lib/utils';
import { normalizeTask, normalizeTasks } from '../../domains/tasks/helpers';
import { makeAuditEntry } from '../../domains/shared/audit';
import { enforceTaskIntegrity } from '../../domains/records/integrity';
import { buildBlockedTransitionToast, buildTaskUpdateTitle, shouldToastTaskPatch } from '../../lib/actionFeedback';
import { isMeaningfulUndoableTaskUpdate } from '../../lib/undo';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';
import { applyTaskMutationEffects } from '../useCases/mutationEffects';

export function createTasksSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions, 'addTask' | 'updateTask' | 'deleteTask' | 'attemptTaskTransition'> {
  return {
    addTask: (task) => {
      set((state: AppStore) => {
        const normalized = enforceTaskIntegrity(normalizeTask({ ...task, assigneeDisplayName: task.assigneeDisplayName || task.owner, auditHistory: [makeAuditEntry({ actorUserId: task.createdByUserId || 'user-current', actorDisplayName: task.createdByDisplayName || 'Current user', action: 'created', summary: 'Task created.' }), ...(task.auditHistory || [])] }), state.projects);
        const tasks = normalizeTasks([normalized, ...state.tasks]);
        return { ...applyTaskMutationEffects(state, tasks), selectedTaskId: normalized.id, taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null };
      });
      get().pushToast({ tone: 'success', title: 'Task created', source: 'tasks.addTask', recordType: 'task', recordIds: [task.id] });
      queuePersist({ dirtyRecords: [{ type: 'task', id: task.id }] });
    },
    updateTask: (id, patch) => {
      const before = get().tasks.find((task) => task.id === id);
      set((state: AppStore) => {
        const tasks = normalizeTasks(state.tasks.map((task) => {
          if (task.id !== id) return task;
          const auditHistory = [...(task.auditHistory || [])];
          if (patch.status && patch.status !== task.status) auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'status_changed', field: 'status', from: task.status, to: patch.status, summary: `Task status moved to ${patch.status}.` }));
          if (patch.assigneeDisplayName && patch.assigneeDisplayName !== task.assigneeDisplayName) auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'assignment_changed', field: 'assignee', from: task.assigneeDisplayName || task.owner, to: patch.assigneeDisplayName, summary: 'Task reassigned.' }));
          const status = patch.status || task.status;
          const autoPatch = { startedAt: status === 'In progress' ? (patch.startedAt || task.startedAt || todayIso()) : patch.startedAt, completedAt: status === 'Done' ? (patch.completedAt || task.completedAt || todayIso()) : undefined, completionNote: status === 'Done' ? (patch.completionNote || task.completionNote) : undefined, blockReason: status === 'Blocked' ? (patch.blockReason || task.blockReason || 'Blocked pending dependency') : undefined, deferredUntil: status === 'Done' || status === 'Blocked' ? undefined : patch.deferredUntil };
          return enforceTaskIntegrity(normalizeTask({ ...task, ...patch, ...autoPatch, auditHistory, updatedByUserId: 'user-current', updatedByDisplayName: 'Current user' }), state.projects);
        }));
        return applyTaskMutationEffects(state, tasks);
      });
      if (before && shouldToastTaskPatch(patch)) {
        get().pushToast({ tone: 'success', title: buildTaskUpdateTitle(before, patch), source: 'tasks.updateTask', recordType: 'task', recordIds: [id] });
      }
      const after = get().tasks.find((task) => task.id === id);
      if (before && after && isMeaningfulUndoableTaskUpdate(patch)) {
        get().registerUndoEntry({
          actionKind: 'task_update',
          title: buildTaskUpdateTitle(before, patch),
          entityRefs: [{ type: 'task', id }],
          dirtyRecordRefs: [{ type: 'task', id }],
          snapshots: [{ entityType: 'task', id, before, after }],
          overlapPolicy: 'latest-only',
        });
      }
      queuePersist({ dirtyRecords: [{ type: 'task', id }] });
    },
    deleteTask: (id) => {
      const before = get().tasks.find((task) => task.id === id);
      set((state: AppStore) => {
        const tasks = normalizeTasks(state.tasks.filter((task) => task.id !== id));
        return { ...applyTaskMutationEffects(state, tasks), selectedTaskId: state.selectedTaskId === id ? tasks[0]?.id ?? null : state.selectedTaskId, taskModal: state.taskModal.taskId === id ? { open: false, mode: 'create', taskId: null } : state.taskModal };
      });
      const undoId = before ? get().registerUndoEntry({ actionKind: 'task_delete', title: 'Task deleted', entityRefs: [{ type: 'task', id }], dirtyRecordRefs: [{ type: 'task', id }], snapshots: [{ entityType: 'task', id, before, after: null }] }) : null;
      get().pushToast({ tone: 'warning', kind: 'undo_offer', title: 'Task deleted', source: 'tasks.deleteTask', recordType: 'task', recordIds: [id], action: undoId ? { label: 'Undo', actionId: undoId } : undefined });
      queuePersist({ dirtyRecords: [{ type: 'task', id }] });
    },
    attemptTaskTransition: (id, status, patch = {}) => {
      const state = get();
      const record = state.tasks.find((task) => task.id === id);
      if (!record) return { applied: false, validation: { allowed: false, blockers: ['Task not found.'], warnings: [], requiredFields: [], overrideAllowed: false, recommendedNextActions: [], readyToClose: false } };
      const mergedPatch = { ...patch, status };
      const validation = validateTaskTransition({ record, from: record.status, to: status, patch: mergedPatch });
      if (!validation.allowed) {
        const blocked = buildBlockedTransitionToast('task', status, 1);
        get().pushToast({ tone: 'warning', title: blocked.title, message: blocked.message, source: 'tasks.attemptTaskTransition', recordType: 'task', recordIds: [id] });
        return { applied: false, validation };
      }
      get().updateTask(id, mergedPatch);
      return { applied: true, validation };
    },
  };
}
