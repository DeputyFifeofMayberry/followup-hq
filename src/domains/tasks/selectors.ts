import type { TaskItem } from '../../types';
import { classifyTaskIntoLanes, normalizeTaskStatus, type TaskQueueView } from './lanes';

type TaskLike = Pick<TaskItem, 'status' | 'dueDate' | 'deferredUntil' | 'linkedFollowUpId' | 'completedAt'>;

export type { TaskQueueView };
export { normalizeTaskStatus };

export function isTaskOpen(task: Pick<TaskItem, 'status'>): boolean {
  return normalizeTaskStatus(task.status) !== 'Done';
}

export function isTaskEligibleForQueue<T extends TaskLike>(
  task: T,
  view: TaskQueueView,
  options: { now?: Date; isReviewNeeded?: (task: T) => boolean; isExecutionReady?: (task: T) => boolean } = {},
): boolean {
  return classifyTaskIntoLanes(task, options).inLane[view];
}

export function selectVisibleTasksForQueue<T extends TaskLike>(
  tasks: T[],
  view: TaskQueueView,
  options: { now?: Date; isReviewNeeded?: (task: T) => boolean; isExecutionReady?: (task: T) => boolean } = {},
): T[] {
  return tasks.filter((task) => isTaskEligibleForQueue(task, view, options));
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
    isExecutionReady?: (task: T) => boolean;
  } = {},
) {
  const classifications = tasks.map((task) => ({ task, lane: classifyTaskIntoLanes(task, options) }));

  const open = classifications.filter((entry) => entry.lane.isOpen);

  return {
    open: open.length,
    now: open.filter((entry) => entry.lane.inLane.today).length,
    blocked: open.filter((entry) => entry.lane.inLane.blocked).length,
    overdue: open.filter((entry) => entry.lane.inLane.overdue).length,
    dueSoon: open.filter((entry) => entry.lane.isDueToday || entry.lane.dueBucket === 'tomorrow').length,
    deferred: open.filter((entry) => entry.lane.inLane.deferred).length,
    reviewRequired: open.filter((entry) => entry.lane.inLane.review).length,
    reviewNotReady: open.filter((entry) => entry.lane.inLane.review && !entry.lane.isExecutionReady).length,
    unlinked: open.filter((entry) => entry.lane.inLane.unlinked).length,
    doneToday: classifications.filter((entry) => entry.lane.inLane.recent).length,
  };
}
