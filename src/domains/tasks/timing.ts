import { localDayDelta } from '../../lib/utils';
import type { TaskItem } from '../../types';

export type TaskDueBucket = 'none' | 'overdue' | 'today' | 'tomorrow' | 'upcoming';

export function getTaskDueBucket(task: Pick<TaskItem, 'dueDate' | 'status'>, now = new Date()): TaskDueBucket {
  if (!task.dueDate || task.status === 'Done') return 'none';
  const delta = localDayDelta(now, task.dueDate);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  return 'upcoming';
}

export function isTaskOverdueByDay(task: Pick<TaskItem, 'dueDate' | 'status'>, now = new Date()): boolean {
  return getTaskDueBucket(task, now) === 'overdue';
}

export function isTaskDueTodayByDay(task: Pick<TaskItem, 'dueDate' | 'status'>, now = new Date()): boolean {
  return getTaskDueBucket(task, now) === 'today';
}
