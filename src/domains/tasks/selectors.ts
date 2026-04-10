import { isTaskDeferred } from '../../lib/utils';
import type { TaskItem } from '../../types';

type TaskLike = Pick<TaskItem, 'status' | 'dueDate' | 'deferredUntil' | 'linkedFollowUpId'>;

export function isTaskOpen(task: Pick<TaskItem, 'status'>): boolean {
  return task.status !== 'Done';
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
    nowTs?: number;
    isReviewNeeded?: (task: T) => boolean;
  } = {},
) {
  const nowTs = options.nowTs ?? Date.now();
  const dueSoonThresholdTs = nowTs + 2 * 86400000;
  const open = tasks.filter(isTaskOpen);
  const reviewRequired = options.isReviewNeeded
    ? open.filter((task) => options.isReviewNeeded?.(task))
    : [];

  return {
    open: open.length,
    blocked: open.filter((task) => task.status === 'Blocked').length,
    overdue: open.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < nowTs).length,
    dueSoon: open.filter((task) => {
      if (!task.dueDate) return false;
      const dueTs = new Date(task.dueDate).getTime();
      return dueTs <= dueSoonThresholdTs && dueTs >= nowTs;
    }).length,
    deferred: open.filter((task) => Boolean(task.deferredUntil) && isTaskDeferred(task)).length,
    reviewRequired: reviewRequired.length,
    reviewNotReady: reviewRequired.length,
    unlinked: open.filter((task) => !task.linkedFollowUpId).length,
  };
}
