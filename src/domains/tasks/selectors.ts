import { isTaskDeferred } from '../../lib/utils';
import type { TaskItem } from '../../types';
import { getTaskDueBucket } from './timing';

type TaskLike = Pick<TaskItem, 'status' | 'dueDate' | 'deferredUntil' | 'linkedFollowUpId'>;
export type TaskQueueView = 'today' | 'overdue' | 'upcoming' | 'blocked' | 'review' | 'deferred' | 'unlinked' | 'recent' | 'all';

function normalizeStatusValue(status: string | undefined | null): string {
  return (status || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

export function normalizeTaskStatus(status: TaskItem['status'] | string | undefined): TaskItem['status'] {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'done' || normalized === 'completed' || normalized === 'complete' || normalized === 'closed') return 'Done';
  if (normalized === 'inprogress' || normalized === 'progress' || normalized === 'doing') return 'In progress';
  if (normalized === 'blocked' || normalized === 'onhold') return 'Blocked';
  return 'To do';
}

export function isTaskOpen(task: Pick<TaskItem, 'status'>): boolean {
  return normalizeTaskStatus(task.status) !== 'Done';
}

export function isTaskEligibleForQueue<T extends TaskLike & Pick<TaskItem, 'completedAt'>>(task: T, view: TaskQueueView, options: { now?: Date } = {}): boolean {
  const now = options.now ?? new Date();
  const dueTs = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const endWeekTs = now.getTime() + 7 * 86400000;
  const todayStartTs = new Date(now).setHours(0, 0, 0, 0);
  const status = normalizeTaskStatus(task.status);

  if (view === 'recent') {
    return status === 'Done' && Boolean(task.completedAt && new Date(task.completedAt).getTime() >= todayStartTs);
  }
  if (status === 'Done') return false;

  const dueBucket = getTaskDueBucket({ ...task, status }, now);
  if (view === 'today') {
    const dueToday = dueBucket === 'overdue' || dueBucket === 'today';
    const actionableUnscheduled = dueTs === null && status !== 'Blocked' && !isTaskDeferred(task);
    const deferredReady = Boolean(task.deferredUntil && !isTaskDeferred(task));
    return dueToday || actionableUnscheduled || deferredReady;
  }
  if (view === 'overdue') return dueBucket === 'overdue';
  if (view === 'upcoming') return (dueBucket === 'tomorrow' || dueBucket === 'upcoming') && dueTs !== null && dueTs <= endWeekTs;
  if (view === 'blocked') return status === 'Blocked';
  if (view === 'deferred') return Boolean(task.deferredUntil) && isTaskDeferred(task);
  if (view === 'unlinked') return !task.linkedFollowUpId;
  return true;
}

export function selectVisibleTasksForQueue<T extends TaskLike & Pick<TaskItem, 'completedAt'>>(
  tasks: T[],
  view: TaskQueueView,
  options: { now?: Date; isReviewNeeded?: (task: T) => boolean } = {},
): T[] {
  return tasks.filter((task) => {
    if (view !== 'review') return isTaskEligibleForQueue(task, view, options);
    if (!isTaskOpen(task)) return false;
    return options.isReviewNeeded ? options.isReviewNeeded(task) : false;
  });
}

export function selectOpenTasks<T extends Pick<TaskItem, 'status'>>(tasks: T[]): T[] {
  return tasks.filter(isTaskOpen);
}

export function selectOpenTaskCount(tasks: Array<Pick<TaskItem, 'status'>>): number {
  return selectOpenTasks(tasks).length;
}

export function selectTaskCounts<T extends TaskLike>(
  tasks: T[],
  options: {
    now?: Date;
    isReviewNeeded?: (task: T) => boolean;
  } = {},
) {
  const now = options.now ?? new Date();
  const open = tasks.filter(isTaskOpen);
  const reviewRequired = options.isReviewNeeded
    ? open.filter((task) => options.isReviewNeeded?.(task))
    : [];

  return {
    open: open.length,
    blocked: open.filter((task) => normalizeTaskStatus(task.status) === 'Blocked').length,
    overdue: open.filter((task) => getTaskDueBucket({ ...task, status: normalizeTaskStatus(task.status) }, now) === 'overdue').length,
    dueSoon: open.filter((task) => {
      const bucket = getTaskDueBucket({ ...task, status: normalizeTaskStatus(task.status) }, now);
      return bucket === 'today' || bucket === 'tomorrow';
    }).length,
    deferred: open.filter((task) => Boolean(task.deferredUntil) && isTaskDeferred(task)).length,
    reviewRequired: reviewRequired.length,
    reviewNotReady: reviewRequired.length,
    unlinked: open.filter((task) => !task.linkedFollowUpId).length,
  };
}
