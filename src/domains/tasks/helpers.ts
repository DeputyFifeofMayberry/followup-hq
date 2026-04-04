import { todayIso, isTaskOverdue } from '../../lib/utils';
import type { FollowUpItem, TaskItem } from '../../types';
import { normalizeItem } from '../../lib/utils';

export function normalizeTask(task: TaskItem): TaskItem {
  const status = task.status || 'To do';
  const updatedAt = todayIso();
  return {
    ...task,
    project: (task.project || 'General').trim() || 'General',
    owner: (task.owner || 'Unassigned').trim() || 'Unassigned',
    assigneeUserId: task.assigneeUserId || undefined,
    assigneeDisplayName: (task.assigneeDisplayName || task.owner || 'Unassigned').trim() || 'Unassigned',
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
  const linked = tasks.filter((task) => task.linkedFollowUpId === followUpId);
  const blocked = linked.filter((task) => task.status === 'Blocked').length;
  const overdue = linked.filter((task) => isTaskOverdue(task)).length;
  const open = linked.filter((task) => task.status !== 'Done').length;
  const done = linked.filter((task) => task.status === 'Done').length;
  const allDone = linked.length > 0 && open === 0;
  return { total: linked.length, blocked, overdue, open, done, allDone };
}

export function applyTaskRollupsToItems(items: FollowUpItem[], tasks: TaskItem[]): FollowUpItem[] {
  return items.map((item) => {
    const summary = summarizeLinkedTasks(tasks, item.id);
    if (summary.total === 0) {
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
    const signal = summary.blocked > 0 ? 'blocked' : summary.overdue > 0 ? 'overdue' : summary.allDone ? 'ready_to_close' : 'on_track';
    const recommendedAction = summary.allDone
      ? 'Close out'
      : summary.blocked > 0
        ? 'Create task'
        : item.recommendedAction;
    const nextAction = summary.allDone
      ? 'All linked tasks are done. Review and close out parent follow-up.'
      : summary.blocked > 0
        ? `Resolve ${summary.blocked} blocked linked task${summary.blocked > 1 ? 's' : ''} before next move.`
        : item.nextAction;
    return normalizeItem({
      ...item,
      linkedTaskCount: summary.total,
      openLinkedTaskCount: summary.open,
      blockedLinkedTaskCount: summary.blocked,
      overdueLinkedTaskCount: summary.overdue,
      doneLinkedTaskCount: summary.done,
      allLinkedTasksDone: summary.allDone,
      childWorkflowSignal: signal,
      recommendedAction,
      nextAction,
    });
  });
}
