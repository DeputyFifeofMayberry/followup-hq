import type {
  FollowUpItem,
  SavedExecutionView,
  TaskItem,
  UnifiedQueueFilter,
  UnifiedQueueItem,
  UnifiedQueuePreset,
  UnifiedQueueSort,
} from '../types';
import { daysSince, isOverdue, isTaskDeferred, isTaskDueWithin, isTaskOverdue, needsNudge, taskWorkflowState } from './utils';
import { isExecutionReady } from '../domains/records/integrity';

const DAY_MS = 24 * 60 * 60 * 1000;
const priorityScore: Record<UnifiedQueueItem['priority'], number> = { Low: 1, Medium: 2, High: 3, Critical: 5 };

function startOfDayTs(value = Date.now()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function withinDays(dateText: string | undefined, days: number) {
  if (!dateText) return false;
  return new Date(dateText).getTime() <= Date.now() + days * DAY_MS;
}

function isToday(dateText?: string) {
  if (!dateText) return false;
  const ts = new Date(dateText).getTime();
  return ts >= startOfDayTs() && ts < startOfDayTs() + DAY_MS;
}

function isThisWeek(dateText?: string) {
  if (!dateText) return false;
  return new Date(dateText).getTime() <= startOfDayTs() + 7 * DAY_MS;
}

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

function pickReason(flags: UnifiedQueueItem['queueFlags']) {
  if (flags.overdue) return 'Overdue';
  if (flags.dueToday) return 'Due today';
  if (flags.needsTouchToday) return 'Needs touch today';
  if (flags.blocked) return 'Blocked / at risk';
  if (flags.waitingTooLong) return 'Waiting too long';
  if (flags.cleanupRequired) return 'Cleanup required';
  if (flags.readyToCloseParent) return 'Ready to close parent';
  if (flags.orphanedTask) return 'Unlinked task';
  return 'Queue candidate';
}

function reasonList(flags: UnifiedQueueItem['queueFlags']) {
  return [
    flags.overdue && 'Overdue commitment',
    flags.dueToday && 'Due in next 24h',
    flags.needsTouchToday && 'Touch cadence due',
    flags.waitingTooLong && 'Waiting exceeded cadence',
    flags.blocked && 'Blocked / parent at risk',
    flags.deferred && 'Deferred',
    flags.cleanupRequired && 'Needs cleanup',
    flags.parentAtRisk && 'Parent at risk',
    flags.readyToCloseParent && 'Task completion can close parent',
    flags.orphanedTask && 'No linked follow-up',
  ].filter(Boolean) as string[];
}

function computeFollowUpRow(item: FollowUpItem, tasks: TaskItem[]): UnifiedQueueItem {
  const stats = linkedTaskStats(tasks, item.id);
  const overdue = isOverdue(item);
  const dueToday = isToday(item.dueDate) || withinDays(item.dueDate, 1);
  const dueThisWeek = isThisWeek(item.dueDate);
  const needsTouchToday = withinDays(item.nextTouchDate, 0) || needsNudge(item);
  const waitingTooLong = (item.status === 'Waiting on external' || item.status === 'Waiting internal') && daysSince(item.lastTouchDate) > Math.max(4, item.cadenceDays);
  const cleanupRequired = !!item.needsCleanup;
  const blocked = item.status === 'At risk' || item.escalationLevel === 'Critical' || stats.blocked > 0;
  const waiting = Boolean(item.waitingOn || item.status.includes('Waiting'));

  const flags: UnifiedQueueItem['queueFlags'] = {
    overdue,
    dueToday,
    dueThisWeek,
    needsTouchToday,
    waitingTooLong,
    blocked,
    deferred: false,
    cleanupRequired,
    parentAtRisk: blocked,
    readyToCloseParent: stats.total > 0 && stats.open === 0,
    orphanedTask: false,
    linked: stats.total > 0,
    waiting,
  };

  const score =
    (flags.overdue ? 55 : 0)
    + (flags.dueToday ? 34 : 0)
    + (flags.needsTouchToday ? 20 : 0)
    + (flags.blocked ? 30 : 0)
    + (flags.cleanupRequired ? 24 : 0)
    + (flags.waitingTooLong ? 26 : 0)
    + (stats.overdue * 8)
    + priorityScore[item.priority] * 8
    + (item.escalationLevel === 'Critical' ? 18 : item.escalationLevel === 'Escalate' ? 10 : 0)
    + Math.min(18, daysSince(item.lastTouchDate));

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
    promisedDate: item.promisedDate,
    nextTouchDate: item.nextTouchDate,
    escalationLevel: item.escalationLevel,
    waitingOn: item.waitingOn,
    needsCleanup: cleanupRequired,
    linkedRecordStatus: stats.total > 0 ? `${stats.open}/${stats.total} open tasks` : 'No child tasks',
    linkedTaskCount: stats.total,
    linkedOpenTaskCount: stats.open,
    linkedBlockedCount: stats.blocked,
    linkedOverdueTaskCount: stats.overdue,
    parentAtRisk: flags.parentAtRisk,
    primaryNextAction: item.nextAction || item.recommendedAction || 'Review follow-up',
    whyInQueue: pickReason(flags),
    queueReasons: reasonList(flags),
    queueFlags: flags,
    score,
    updatedAt: item.lastActionAt || item.lastTouchDate,
    tags: item.tags,
    companyId: item.companyId,
    contactId: item.contactId,
    summary: item.summary,
    source: item.source,
    notesPreview: item.notes?.slice(0, 160),
    recentActivity: item.timeline?.[0]?.summary,
    lastActionAt: item.lastActionAt,
    blockReason: item.escalationLevel === 'Critical' ? 'Critical escalation' : undefined,
    linkedChildSummary: stats.total ? `${stats.done} done • ${stats.blocked} blocked • ${stats.overdue} overdue` : 'No linked child tasks',
  };
}

function computeTaskRow(task: TaskItem, followUps: FollowUpItem[]): UnifiedQueueItem {
  const parent = task.linkedFollowUpId ? followUps.find((f) => f.id === task.linkedFollowUpId) : undefined;
  const overdue = isTaskOverdue(task);
  const dueToday = isTaskDueWithin(task, 1);
  const dueThisWeek = isTaskDueWithin(task, 7);
  const blocked = task.status === 'Blocked' || parent?.status === 'At risk';
  const deferred = isTaskDeferred(task);
  const cleanupRequired = !!task.needsCleanup;
  const orphanedTask = !task.linkedFollowUpId;
  const waiting = Boolean(parent?.waitingOn || parent?.status.includes('Waiting'));

  const flags: UnifiedQueueItem['queueFlags'] = {
    overdue,
    dueToday,
    dueThisWeek,
    needsTouchToday: false,
    waitingTooLong: false,
    blocked,
    deferred,
    cleanupRequired,
    parentAtRisk: !!parent && (parent.status === 'At risk' || parent.escalationLevel === 'Critical'),
    readyToCloseParent: task.completionImpact === 'close_parent',
    orphanedTask,
    linked: Boolean(task.linkedFollowUpId),
    waiting,
  };

  const score =
    (flags.overdue ? 52 : 0)
    + (flags.dueToday ? 32 : 0)
    + (flags.blocked ? 28 : 0)
    + (flags.deferred ? -24 : 0)
    + (flags.cleanupRequired ? 20 : 0)
    + (flags.orphanedTask ? 6 : 0)
    + (flags.readyToCloseParent ? 10 : task.completionImpact === 'advance_parent' ? 4 : 0)
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
    needsCleanup: cleanupRequired,
    linkedFollowUpId: task.linkedFollowUpId,
    linkedParentStatus: parent?.status,
    parentAtRisk: flags.parentAtRisk,
    linkedRecordStatus: parent ? `Parent: ${parent.status}` : 'No parent follow-up',
    linkedParentTitle: parent?.title,
    primaryNextAction: task.nextStep || task.recommendedAction || 'Execute task',
    whyInQueue: pickReason(flags),
    queueReasons: reasonList(flags),
    queueFlags: flags,
    score,
    updatedAt: task.updatedAt,
    contextNote: task.contextNote,
    completionImpact: task.completionImpact,
    completionImpactSummary: task.completionImpact === 'close_parent' ? 'Completing this can close parent follow-up' : task.completionImpact,
    deferredUntil: task.deferredUntil,
    blockReason: task.blockReason,
    workflowState: taskWorkflowState(task),
    tags: task.tags,
    companyId: task.companyId,
    contactId: task.contactId,
    summary: task.summary,
    notesPreview: task.notes?.slice(0, 160),
    recentActivity: task.lastCompletedAction,
    lastActionAt: task.lastActionAt,
  };
}

export function sortUnifiedQueue(queue: UnifiedQueueItem[], sortBy: UnifiedQueueSort): UnifiedQueueItem[] {
  const sorted = [...queue];
  sorted.sort((a, b) => {
    if (sortBy === 'due_date') return new Date(a.dueDate || '2999-01-01').getTime() - new Date(b.dueDate || '2999-01-01').getTime() || b.score - a.score;
    if (sortBy === 'next_touch_date') return new Date(a.nextTouchDate || '2999-01-01').getTime() - new Date(b.nextTouchDate || '2999-01-01').getTime() || b.score - a.score;
    if (sortBy === 'updated_date') return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime() || b.score - a.score;
    if (sortBy === 'priority') return priorityScore[b.priority] - priorityScore[a.priority] || b.score - a.score;
    if (sortBy === 'project') return a.project.localeCompare(b.project) || b.score - a.score;
    return b.score - a.score || new Date(a.dueDate || '2999-01-01').getTime() - new Date(b.dueDate || '2999-01-01').getTime();
  });
  return sorted;
}

export function buildUnifiedQueue(items: FollowUpItem[], tasks: TaskItem[]): UnifiedQueueItem[] {
  const liveFollowups = items.filter((item) => isExecutionReady(item));
  const liveTasks = tasks.filter((task) => isExecutionReady(task));
  const followRows = liveFollowups.filter((item) => item.status !== 'Closed').map((item) => computeFollowUpRow(item, liveTasks));
  const taskRows = liveTasks.filter((task) => task.status !== 'Done').map((task) => computeTaskRow(task, liveFollowups));
  return sortUnifiedQueue([...followRows, ...taskRows], 'queue_score');
}

export function applyQueuePreset(queue: UnifiedQueueItem[], preset: UnifiedQueuePreset): UnifiedQueueItem[] {
  switch (preset) {
    case 'Today':
    case 'Due now':
      return queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday);
    case 'This week':
      return queue.filter((row) => row.queueFlags.dueThisWeek || row.queueFlags.needsTouchToday);
    case 'Waiting on others':
      return queue.filter((row) => row.queueFlags.waiting);
    case 'Needs nudge':
      return queue.filter((row) => row.queueFlags.needsTouchToday || row.queueFlags.waitingTooLong);
    case 'Blocked':
    case 'Blocked / at risk':
      return queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk);
    case 'Deferred':
      return queue.filter((row) => row.queueFlags.deferred);
    case 'Linked to at-risk follow-ups':
      return queue.filter((row) => row.recordType === 'task' && !!row.linkedFollowUpId && !!row.parentAtRisk);
    case 'Unlinked tasks':
      return queue.filter((row) => row.recordType === 'task' && row.queueFlags.orphanedTask);
    case 'Cleanup':
      return queue.filter((row) => row.queueFlags.cleanupRequired);
    case 'Recently updated':
      return sortUnifiedQueue(queue, 'updated_date').slice(0, 80);
    default:
      return queue;
  }
}

function includesSearch(row: UnifiedQueueItem, query: string) {
  const haystack = [
    row.title,
    row.project,
    row.owner,
    row.assignee,
    row.tags?.join(' '),
    row.primaryNextAction,
    row.waitingOn,
    row.summary,
    row.notesPreview,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function applyUnifiedFilter(queue: UnifiedQueueItem[], filter: UnifiedQueueFilter): UnifiedQueueItem[] {
  return queue.filter((row) => {
    if (filter.search && !includesSearch(row, filter.search)) return false;
    if (filter.types?.length && !filter.types.includes(row.recordType)) return false;
    if (filter.project?.length && !filter.project.includes(row.project)) return false;
    if (filter.owner?.length && !filter.owner.includes(row.owner)) return false;
    if (filter.assignee?.length && !filter.assignee.includes(row.assignee)) return false;
    if (filter.status?.length && !filter.status.includes(row.status)) return false;
    if (filter.priority?.length && !filter.priority.includes(row.priority)) return false;
    if (filter.escalation?.length && !filter.escalation.includes(row.escalationLevel || 'None')) return false;
    if (filter.linkedParentStatus?.length && !filter.linkedParentStatus.includes(row.linkedParentStatus || '')) return false;
    if (filter.parentAtRisk && !row.queueFlags.parentAtRisk) return false;
    if (filter.orphanedOnly && !row.queueFlags.orphanedTask) return false;
    if (filter.readyToCloseParentOnly && !row.queueFlags.readyToCloseParent) return false;
    if (filter.blockedOnly && !row.queueFlags.blocked) return false;
    if (filter.deferredOnly && !row.queueFlags.deferred) return false;
    if (filter.cleanupOnly && !row.queueFlags.cleanupRequired) return false;
    if (filter.waitingTooLongOnly && !row.queueFlags.waitingTooLong) return false;
    if (filter.needsTouchTodayOnly && !row.queueFlags.needsTouchToday) return false;
    if (filter.dueTodayOnly && !row.queueFlags.dueToday) return false;
    if (filter.overdueOnly && !row.queueFlags.overdue) return false;
    if (filter.tags?.length && !filter.tags.some((tag) => row.tags?.includes(tag))) return false;
    if (filter.companyId?.length && (!row.companyId || !filter.companyId.includes(row.companyId))) return false;
    if (filter.contactId?.length && (!row.contactId || !filter.contactId.includes(row.contactId))) return false;
    if (filter.missingProjectContext && row.project && row.project !== 'General') return false;
    if (typeof filter.waitingOn === 'boolean' && filter.waitingOn !== row.queueFlags.waiting) return false;
    if (filter.linkedState === 'linked' && !row.queueFlags.linked) return false;
    if (filter.linkedState === 'unlinked' && row.queueFlags.linked) return false;
    if (filter.linkedState === 'blocked_child' && !(row.linkedBlockedCount && row.linkedBlockedCount > 0)) return false;
    if (filter.linkedState === 'all_done' && !(row.linkedTaskCount && row.linkedOpenTaskCount === 0)) return false;

    if (filter.dueDateFrom) {
      if (!row.dueDate || new Date(row.dueDate).getTime() < new Date(filter.dueDateFrom).getTime()) return false;
    }
    if (filter.dueDateTo) {
      if (!row.dueDate || new Date(row.dueDate).getTime() > new Date(filter.dueDateTo).getTime()) return false;
    }
    if (filter.nextTouchDateFrom) {
      if (!row.nextTouchDate || new Date(row.nextTouchDate).getTime() < new Date(filter.nextTouchDateFrom).getTime()) return false;
    }
    if (filter.nextTouchDateTo) {
      if (!row.nextTouchDate || new Date(row.nextTouchDate).getTime() > new Date(filter.nextTouchDateTo).getTime()) return false;
    }
    if (typeof filter.dueInDays === 'number') {
      if (!row.dueDate) return false;
      if (new Date(row.dueDate).getTime() > Date.now() + filter.dueInDays * DAY_MS) return false;
    }
    if (filter.startDateFrom || filter.startDateTo) {
      if (!row.startDate) return false;
      if (filter.startDateFrom && new Date(row.startDate).getTime() < new Date(filter.startDateFrom).getTime()) return false;
      if (filter.startDateTo && new Date(row.startDate).getTime() > new Date(filter.startDateTo).getTime()) return false;
    }
    if (typeof filter.updatedWithinDays === 'number') {
      if (!row.updatedAt) return false;
      if (new Date(row.updatedAt).getTime() < Date.now() - filter.updatedWithinDays * DAY_MS) return false;
    }
    return true;
  });
}

export const defaultExecutionViews: SavedExecutionView[] = [
  { id: 'due-now', name: 'Due now', preset: 'Due now', filter: { types: ['task'] }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'this-week', name: 'This week', preset: 'This week', filter: { types: ['task'] }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'blocked-work', name: 'Blocked', preset: 'Blocked', filter: { blockedOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'deferred-work', name: 'Deferred', preset: 'Deferred', filter: { types: ['task'], deferredOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'linked-risk', name: 'Linked at risk', preset: 'Linked to at-risk follow-ups', filter: { types: ['task'], parentAtRisk: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'cleanup-queue', name: 'Cleanup queue', preset: 'Cleanup', filter: { cleanupOnly: true }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'unlinked-tasks', name: 'Unlinked tasks', preset: 'Unlinked tasks', filter: { types: ['task'], linkedState: 'unlinked' }, scope: 'personal', createdAt: new Date().toISOString() },
  { id: 'recently-updated', name: 'Recently updated', preset: 'Recently updated', filter: { updatedWithinDays: 3 }, scope: 'personal', createdAt: new Date().toISOString() },
];
