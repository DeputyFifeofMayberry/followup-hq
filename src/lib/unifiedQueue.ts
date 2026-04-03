import type { FollowUpItem, SavedExecutionView, TaskItem, UnifiedQueueFilter, UnifiedQueueItem, UnifiedQueuePreset } from '../types';
import { daysSince, isOverdue, needsNudge } from './utils';

const priorityScore: Record<UnifiedQueueItem['priority'], number> = { Low: 1, Medium: 2, High: 3, Critical: 5 };

function linkedTaskStats(tasks: TaskItem[], followUpId: string) {
  const linked = tasks.filter((task) => task.linkedFollowUpId === followUpId);
  return {
    total: linked.length,
    blocked: linked.filter((task) => task.status === 'Blocked').length,
    open: linked.filter((task) => task.status !== 'Done').length,
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
    linkedBlockedCount: stats.blocked,
    primaryNextAction: item.nextAction || item.recommendedAction || 'Review follow-up',
    whyInQueue: why,
    score,
    updatedAt: item.lastActionAt || item.lastTouchDate,
  };
}

function computeTaskRow(task: TaskItem, followUps: FollowUpItem[]): UnifiedQueueItem {
  const parent = task.linkedFollowUpId ? followUps.find((f) => f.id === task.linkedFollowUpId) : undefined;
  const dueSoon = !!task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 24 * 60 * 60 * 1000;
  const overdue = !!task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'Done';
  const blocked = task.status === 'Blocked' || parent?.status === 'At risk';
  const cleanup = !!task.needsCleanup;

  let why = 'Execution task';
  if (overdue) why = 'Overdue';
  else if (dueSoon) why = 'Due today';
  else if (blocked) why = 'Blocked / at risk';
  else if (cleanup) why = 'Cleanup required';

  const score =
    (overdue ? 52 : 0)
    + (dueSoon ? 32 : 0)
    + (blocked ? 28 : 0)
    + (cleanup ? 20 : 0)
    + priorityScore[task.priority] * 8
    + (parent?.escalationLevel === 'Critical' ? 12 : 0);

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
    escalationLevel: parent?.escalationLevel,
    waitingOn: parent?.waitingOn,
    needsCleanup: cleanup,
    linkedFollowUpId: task.linkedFollowUpId,
    linkedRecordStatus: parent ? `Parent: ${parent.status}` : 'No parent follow-up',
    primaryNextAction: task.nextStep || task.recommendedAction || 'Execute task',
    whyInQueue: why,
    score,
    updatedAt: task.updatedAt,
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
    case 'Waiting on others':
      return queue.filter((row) => !!row.waitingOn || row.status.includes('Waiting'));
    case 'Needs nudge':
      return queue.filter((row) => row.whyInQueue === 'Needs nudge' || row.whyInQueue === 'Waiting too long');
    case 'Blocked / at risk':
      return queue.filter((row) => row.whyInQueue.includes('Blocked') || row.status === 'Blocked' || row.status === 'At risk' || row.escalationLevel === 'Critical');
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
    if (filter.cleanupOnly && !row.needsCleanup) return false;
    if (typeof filter.waitingOn === 'boolean' && filter.waitingOn !== Boolean(row.waitingOn || row.status.includes('Waiting'))) return false;
    if (typeof filter.dueInDays === 'number') {
      if (!row.dueDate) return false;
      if (new Date(row.dueDate).getTime() > Date.now() + filter.dueInDays * 86400000) return false;
    }
    if (typeof filter.updatedWithinDays === 'number') {
      if (!row.updatedAt) return false;
      if (new Date(row.updatedAt).getTime() < Date.now() - filter.updatedWithinDays * 86400000) return false;
    }
    return true;
  });
}

export const defaultExecutionViews: SavedExecutionView[] = [
  { id: 'morning-scan', name: 'Morning scan', preset: 'Today', filter: {}, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'vendor-chase', name: 'Vendor chase', preset: 'Waiting on others', filter: { waitingOn: true, dueInDays: 7 }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'waiting-replies', name: 'Waiting on replies', preset: 'Needs nudge', filter: { waitingOn: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'risk-week', name: 'At risk this week', preset: 'Blocked / at risk', filter: { dueInDays: 7 }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'cleanup-queue', name: 'Cleanup queue', preset: 'Cleanup', filter: { cleanupOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
];
