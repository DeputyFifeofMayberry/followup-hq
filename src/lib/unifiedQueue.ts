import type { FollowUpItem, SavedExecutionView, TaskItem, UnifiedQueueFilter, UnifiedQueueItem, UnifiedQueuePreset } from '../types';
import { daysSince, isOverdue, isTaskDeferred, isTaskDueWithin, isTaskOverdue, needsNudge, taskWorkflowState } from './utils';

const priorityScore: Record<UnifiedQueueItem['priority'], number> = { Low: 1, Medium: 2, High: 3, Critical: 5 };

function linkedTaskStats(tasks: TaskItem[], followUpId: string) {
  const linked = tasks.filter((task) => task.linkedFollowUpId === followUpId);
  return {
    total: linked.length,
    blocked: linked.filter((task) => task.status === 'Blocked').length,
    open: linked.filter((task) => task.status !== 'Done').length,
    overdue: linked.filter((task) => isTaskOverdue(task)).length,
    done: linked.filter((task) => task.status === 'Done').length,
  };
}

function computeFollowUpRow(item: FollowUpItem, tasks: TaskItem[]): UnifiedQueueItem {
  const stats = linkedTaskStats(tasks, item.id);
  const overdue = isOverdue(item);
  const dueSoon = new Date(item.dueDate).getTime() <= Date.now() + 24 * 60 * 60 * 1000;
  const staleWaiting = (item.status === 'Waiting on external' || item.status === 'Waiting internal') && daysSince(item.lastTouchDate) > Math.max(4, item.cadenceDays);
  const cleanup = !!item.needsCleanup;
  const blocked = item.status === 'At risk' || item.escalationLevel === 'Critical' || stats.blocked > 0;

  let why = 'Queue candidate';
  if (overdue) why = 'Overdue';
  else if (dueSoon) why = 'Due today';
  else if (blocked) why = 'Blocked child task';
  else if (cleanup) why = 'Cleanup required';
  else if (staleWaiting) why = 'Waiting too long';
  else if (needsNudge(item)) why = 'Needs nudge';

  const score =
    (overdue ? 55 : 0)
    + (dueSoon ? 38 : 0)
    + (blocked ? 30 : 0)
    + (cleanup ? 24 : 0)
    + (staleWaiting ? 26 : 0)
    + (stats.overdue * 8)
    + priorityScore[item.priority] * 8
    + (item.escalationLevel === 'Critical' ? 18 : item.escalationLevel === 'Escalate' ? 10 : 0)
    + Math.min(18, daysSince(item.lastTouchDate));

  const linkedRecordStatus = stats.total > 0 ? `${stats.open}/${stats.total} open tasks` : 'No child tasks';

  return {
    id: item.id,
    recordType: 'followup',
    title: item.title,
    project: item.project,
    owner: item.owner,
    assignee: item.assigneeDisplayName || item.owner,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate,
    nextTouchDate: item.nextTouchDate,
    escalationLevel: item.escalationLevel,
    waitingOn: item.waitingOn,
    needsCleanup: cleanup,
    linkedRecordStatus,
    linkedTaskCount: stats.total,
    linkedOpenTaskCount: stats.open,
    linkedBlockedCount: stats.blocked,
    linkedOverdueTaskCount: stats.overdue,
    parentAtRisk: item.escalationLevel === 'Critical' || item.status === 'At risk' || stats.blocked > 0,
    primaryNextAction: item.nextAction || item.recommendedAction || 'Review follow-up',
    whyInQueue: why,
    score,
    updatedAt: item.lastActionAt || item.lastTouchDate,
    tags: item.tags,
    companyId: item.companyId,
    contactId: item.contactId,
  };
}

function computeTaskRow(task: TaskItem, followUps: FollowUpItem[]): UnifiedQueueItem {
  const parent = task.linkedFollowUpId ? followUps.find((f) => f.id === task.linkedFollowUpId) : undefined;
  const dueSoon = isTaskDueWithin(task, 1);
  const overdue = isTaskOverdue(task);
  const blocked = task.status === 'Blocked' || parent?.status === 'At risk';
  const deferred = isTaskDeferred(task);
  const cleanup = !!task.needsCleanup;
  const orphaned = !task.linkedFollowUpId;

  let why = 'Execution task';
  if (overdue) why = 'Overdue';
  else if (dueSoon) why = 'Due today';
  else if (blocked) why = 'Blocked / at risk';
  else if (deferred) why = 'Deferred';
  else if (cleanup) why = 'Cleanup required';
  else if (task.completionImpact === 'close_parent') why = 'Can close parent';

  const score =
    (overdue ? 52 : 0)
    + (dueSoon ? 32 : 0)
    + (blocked ? 28 : 0)
    + (deferred ? -24 : 0)
    + (cleanup ? 20 : 0)
    + (orphaned ? 6 : 0)
    + (task.completionImpact === 'close_parent' ? 10 : task.completionImpact === 'advance_parent' ? 4 : 0)
    + priorityScore[task.priority] * 8
    + (parent?.escalationLevel === 'Critical' ? 12 : parent?.status === 'At risk' ? 8 : 0)
    + Math.min(14, daysSince(task.updatedAt || task.createdAt));

  return {
    id: task.id,
    recordType: 'task',
    title: task.title,
    project: task.project,
    owner: task.owner,
    assignee: task.assigneeDisplayName || task.owner,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    startDate: task.startDate,
    escalationLevel: parent?.escalationLevel,
    waitingOn: parent?.waitingOn,
    needsCleanup: cleanup,
    linkedFollowUpId: task.linkedFollowUpId,
    linkedParentStatus: parent?.status,
    parentAtRisk: !!parent && (parent.status === 'At risk' || parent.escalationLevel === 'Critical'),
    linkedRecordStatus: parent ? `Parent: ${parent.status}` : 'No parent follow-up',
    primaryNextAction: task.nextStep || task.recommendedAction || 'Execute task',
    whyInQueue: why,
    score,
    updatedAt: task.updatedAt,
    contextNote: task.contextNote,
    completionImpact: task.completionImpact,
    deferredUntil: task.deferredUntil,
    blockReason: task.blockReason,
    workflowState: taskWorkflowState(task),
    tags: task.tags,
    companyId: task.companyId,
    contactId: task.contactId,
  };
}

export function buildUnifiedQueue(items: FollowUpItem[], tasks: TaskItem[]): UnifiedQueueItem[] {
  const followRows = items.filter((item) => item.status !== 'Closed').map((item) => computeFollowUpRow(item, tasks));
  const taskRows = tasks.filter((task) => task.status !== 'Done').map((task) => computeTaskRow(task, items));
  return [...followRows, ...taskRows].sort((a, b) => b.score - a.score || new Date(a.dueDate || '2999-01-01').getTime() - new Date(b.dueDate || '2999-01-01').getTime());
}

export function applyQueuePreset(queue: UnifiedQueueItem[], preset: UnifiedQueuePreset): UnifiedQueueItem[] {
  switch (preset) {
    case 'Today':
    case 'Due now':
      return queue.filter((row) => (row.dueDate ? new Date(row.dueDate).getTime() <= Date.now() + 24 * 60 * 60 * 1000 : false) || row.whyInQueue === 'Overdue');
    case 'This week':
      return queue.filter((row) => !!row.dueDate && new Date(row.dueDate).getTime() <= Date.now() + 7 * 86400000);
    case 'Waiting on others':
      return queue.filter((row) => !!row.waitingOn || row.status.includes('Waiting'));
    case 'Needs nudge':
      return queue.filter((row) => row.whyInQueue === 'Needs nudge' || row.whyInQueue === 'Waiting too long');
    case 'Blocked':
    case 'Blocked / at risk':
      return queue.filter((row) => row.whyInQueue.includes('Blocked') || row.status === 'Blocked' || row.status === 'At risk' || row.escalationLevel === 'Critical');
    case 'Deferred':
      return queue.filter((row) => row.workflowState === 'deferred');
    case 'Linked to at-risk follow-ups':
      return queue.filter((row) => row.recordType === 'task' && !!row.linkedFollowUpId && !!row.parentAtRisk);
    case 'Unlinked tasks':
      return queue.filter((row) => row.recordType === 'task' && !row.linkedFollowUpId);
    case 'Cleanup':
      return queue.filter((row) => row.needsCleanup);
    case 'Recently updated':
      return [...queue].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).slice(0, 80);
    default:
      return queue;
  }
}

export function applyUnifiedFilter(queue: UnifiedQueueItem[], filter: UnifiedQueueFilter): UnifiedQueueItem[] {
  return queue.filter((row) => {
    if (filter.types?.length && !filter.types.includes(row.recordType)) return false;
    if (filter.project?.length && !filter.project.includes(row.project)) return false;
    if (filter.owner?.length && !filter.owner.includes(row.owner)) return false;
    if (filter.assignee?.length && !filter.assignee.includes(row.assignee)) return false;
    if (filter.status?.length && !filter.status.includes(row.status)) return false;
    if (filter.priority?.length && !filter.priority.includes(row.priority)) return false;
    if (filter.escalation?.length && !filter.escalation.includes(row.escalationLevel || 'None')) return false;
    if (filter.linkedParentStatus?.length && !filter.linkedParentStatus.includes(row.linkedParentStatus || '')) return false;
    if (filter.parentAtRisk && !row.parentAtRisk) return false;
    if (filter.blockedOnly && row.workflowState !== 'blocked' && row.status !== 'Blocked') return false;
    if (filter.deferredOnly && row.workflowState !== 'deferred') return false;
    if (filter.cleanupOnly && !row.needsCleanup) return false;
    if (filter.tags?.length && !filter.tags.some((tag) => row.tags?.includes(tag))) return false;
    if (filter.companyId?.length && (!row.companyId || !filter.companyId.includes(row.companyId))) return false;
    if (filter.contactId?.length && (!row.contactId || !filter.contactId.includes(row.contactId))) return false;
    if (filter.missingProjectContext && row.project && row.project !== 'General') return false;
    if (typeof filter.waitingOn === 'boolean' && filter.waitingOn !== Boolean(row.waitingOn || row.status.includes('Waiting'))) return false;

    if (filter.dueDateFrom) {
      if (!row.dueDate || new Date(row.dueDate).getTime() < new Date(filter.dueDateFrom).getTime()) return false;
    }
    if (filter.dueDateTo) {
      if (!row.dueDate || new Date(row.dueDate).getTime() > new Date(filter.dueDateTo).getTime()) return false;
    }
    if (typeof filter.dueInDays === 'number') {
      if (!row.dueDate) return false;
      if (new Date(row.dueDate).getTime() > Date.now() + filter.dueInDays * 86400000) return false;
    }
    if (filter.startDateFrom || filter.startDateTo) {
      if (!row.startDate) return false;
      if (filter.startDateFrom && new Date(row.startDate).getTime() < new Date(filter.startDateFrom).getTime()) return false;
      if (filter.startDateTo && new Date(row.startDate).getTime() > new Date(filter.startDateTo).getTime()) return false;
    }
    if (typeof filter.updatedWithinDays === 'number') {
      if (!row.updatedAt) return false;
      if (new Date(row.updatedAt).getTime() < Date.now() - filter.updatedWithinDays * 86400000) return false;
    }
    return true;
  });
}

export const defaultExecutionViews: SavedExecutionView[] = [
  { id: 'due-now', name: 'Due now', preset: 'Due now', filter: { types: ['task'] }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'this-week', name: 'This week', preset: 'This week', filter: { types: ['task'] }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'blocked-work', name: 'Blocked', preset: 'Blocked', filter: { types: ['task'], blockedOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'deferred-work', name: 'Deferred', preset: 'Deferred', filter: { types: ['task'], deferredOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'linked-risk', name: 'Linked at risk', preset: 'Linked to at-risk follow-ups', filter: { types: ['task'], parentAtRisk: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'cleanup-queue', name: 'Cleanup queue', preset: 'Cleanup', filter: { cleanupOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'unlinked-tasks', name: 'Unlinked tasks', preset: 'Unlinked tasks', filter: { types: ['task'], linkedState: 'unlinked' }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'recently-updated', name: 'Recently updated', preset: 'Recently updated', filter: { updatedWithinDays: 3 }, scope: 'personal', createdAt: new Date().toISOString() },
];
