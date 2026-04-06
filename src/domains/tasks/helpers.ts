import { todayIso } from '../../lib/utils';
import type { FollowUpItem, TaskItem } from '../../types';
import { normalizeItem } from '../../lib/utils';
import { buildFollowUpChildRollup } from '../../lib/childWorkRollups';

export function normalizeTask(task: TaskItem): TaskItem {
  const status = task.status || 'To do';
  const updatedAt = todayIso();
  return {
    ...task,
    project: (task.project || '').trim(),
    owner: (task.owner || '').trim(),
    assigneeUserId: task.assigneeUserId || undefined,
    assigneeDisplayName: (task.assigneeDisplayName || task.owner || '').trim() || '',
    title: task.title.trim(),
    summary: (task.summary || '').trim(),
    nextStep: (task.nextStep || '').trim(),
    notes: (task.notes || '').trim(),
    tags: [...new Set((task.tags || []).map((tag) => tag.trim()).filter(Boolean))],
    dueDate: task.dueDate || undefined,
    startDate: task.startDate || undefined,
    startedAt: task.startedAt || (status === 'In progress' ? updatedAt : undefined),
    deferredUntil: task.deferredUntil || undefined,
    nextReviewAt: task.nextReviewAt || task.deferredUntil || undefined,
    linkedFollowUpId: task.linkedFollowUpId || undefined,
    linkedProjectContext: task.linkedProjectContext || undefined,
    contextNote: task.contextNote || undefined,
    blockReason: task.blockReason || undefined,
    completionImpact: task.completionImpact || 'advance_parent',
    contactId: task.contactId || undefined,
    companyId: task.companyId || undefined,
    status,
    completedAt: status === 'Done' ? (task.completedAt || updatedAt) : undefined,
    completionNote: task.completionNote || undefined,
    createdAt: task.createdAt || updatedAt,
    updatedAt,
    needsCleanup: task.needsCleanup || false,
    cleanupReasons: task.cleanupReasons || [],
    recommendedAction: task.recommendedAction || (task.needsCleanup ? 'Review cleanup' : undefined),
    lastCompletedAction: task.lastCompletedAction || undefined,
    lastActionAt: task.lastActionAt || undefined,
    createdByUserId: task.createdByUserId || 'user-seed',
    createdByDisplayName: task.createdByDisplayName || 'System',
    updatedByUserId: task.updatedByUserId || task.createdByUserId || 'user-seed',
    updatedByDisplayName: task.updatedByDisplayName || task.createdByDisplayName || 'System',
    visibilityScope: task.visibilityScope || 'team',
    teamId: task.teamId || 'team-default',
    watchers: task.watchers || [],
    auditHistory: task.auditHistory || [],
    lifecycleState: task.lifecycleState || 'draft',
    reviewReasons: task.reviewReasons || [],
    invalidReason: task.invalidReason || undefined,
    dataQuality: task.dataQuality || 'draft',
    provenance: task.provenance,
  };
}

export function normalizeTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks.map(normalizeTask).sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (a.status === 'Done' && b.status !== 'Done') return 1;
    if (a.status !== 'Done' && b.status === 'Done') return -1;
    return aDue - bDue || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function summarizeLinkedTasks(tasks: TaskItem[], followUpId: string) {
  const rollup = buildFollowUpChildRollup(followUpId, 'In progress', tasks);
  return {
    total: rollup.total,
    blocked: rollup.blocked,
    overdue: rollup.overdue,
    open: rollup.open,
    done: rollup.done,
    allDone: rollup.allDone,
  };
}

export function applyTaskRollupsToItems(items: FollowUpItem[], tasks: TaskItem[]): FollowUpItem[] {
  return items.map((item) => {
    const rollup = buildFollowUpChildRollup(item.id, item.status, tasks);
    if (rollup.total === 0) {
      return normalizeItem({
        ...item,
        linkedTaskCount: 0,
        openLinkedTaskCount: 0,
        blockedLinkedTaskCount: 0,
        overdueLinkedTaskCount: 0,
        doneLinkedTaskCount: 0,
        allLinkedTasksDone: false,
        childWorkflowSignal: 'on_track',
      });
    }
    const recommendedAction = rollup.allDone
      ? 'Close out'
      : rollup.blocked > 0
        ? 'Create task'
        : item.recommendedAction;
    const nextAction = rollup.allDone
      ? 'All linked tasks are done. Review and close out parent follow-up.'
      : rollup.blocked > 0
        ? `Resolve ${rollup.blocked} blocked linked task${rollup.blocked > 1 ? 's' : ''} before next move.`
        : rollup.overdue > 0
          ? `Child task overdue: ${rollup.overdue} linked task${rollup.overdue > 1 ? 's are' : ' is'} late.`
          : item.nextAction;
    return normalizeItem({
      ...item,
      linkedTaskCount: rollup.total,
      openLinkedTaskCount: rollup.open,
      blockedLinkedTaskCount: rollup.blocked,
      overdueLinkedTaskCount: rollup.overdue,
      doneLinkedTaskCount: rollup.done,
      allLinkedTasksDone: rollup.allDone,
      childWorkflowSignal: rollup.signal,
      recommendedAction,
      nextAction,
    });
  });
}
