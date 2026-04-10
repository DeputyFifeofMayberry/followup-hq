import type { FollowUpItem, TaskItem } from '../types';
import { isExecutionReady } from '../domains/records/integrity';
import { isDueToday, isOverdue, isTaskDueWithin, isTaskOverdue, needsNudge } from './utils';

export interface DailyFocusSummary {
  overdueFollowUps: number;
  dueTodayFollowUps: number;
  nudgeFollowUps: number;
  overdueTasks: number;
  dueSoonTasks: number;
  pressure: number;
}

export function buildDailyFocusSummary(items: FollowUpItem[], tasks: TaskItem[]): DailyFocusSummary {
  const liveFollowUps = items.filter((item) => isExecutionReady(item) && item.status !== 'Closed');
  const liveTasks = tasks.filter((task) => isExecutionReady(task) && task.status !== 'Done');

  const overdueFollowUps = liveFollowUps.filter((item) => isOverdue(item)).length;
  const dueTodayFollowUps = liveFollowUps.filter((item) => isDueToday(item)).length;
  const nudgeFollowUps = liveFollowUps.filter((item) => needsNudge(item)).length;
  const overdueTasks = liveTasks.filter((task) => isTaskOverdue(task)).length;
  const dueSoonTasks = liveTasks.filter((task) => isTaskDueWithin(task, 2)).length;

  return {
    overdueFollowUps,
    dueTodayFollowUps,
    nudgeFollowUps,
    overdueTasks,
    dueSoonTasks,
    pressure: overdueFollowUps + overdueTasks,
  };
}
