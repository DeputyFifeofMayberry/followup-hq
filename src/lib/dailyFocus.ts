import type { FollowUpItem, TaskItem } from '../types';
import { classifyFollowUpItem } from '../domains/followups/helpers/followUpLanes';
import { isTaskDueWithin, isTaskOverdue } from './utils';
import { isExecutionReady } from '../domains/records/integrity';

export interface DailyFocusSummary {
  overdueFollowUps: number;
  dueTodayFollowUps: number;
  nudgeFollowUps: number;
  overdueTasks: number;
  dueSoonTasks: number;
  pressure: number;
}

export function buildDailyFocusSummary(items: FollowUpItem[], tasks: TaskItem[]): DailyFocusSummary {
  const followUpClassifications = items
    .map((item) => classifyFollowUpItem(item))
    .filter((classification) => classification.isExecutionReady && classification.isOpen);
  const liveTasks = tasks.filter((task) => isExecutionReady(task) && task.status !== 'Done');

  const overdueFollowUps = followUpClassifications.filter((classification) => classification.isOverdue).length;
  const dueTodayFollowUps = followUpClassifications.filter((classification) => classification.laneMemberships.has('now')).length;
  const nudgeFollowUps = followUpClassifications.filter((classification) => classification.laneMemberships.has('needs_nudge')).length;
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
