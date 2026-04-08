import type { FollowUpItem, TaskItem } from '../types';
import { isTaskOverdue } from './utils';

export interface FollowUpChildRollup {
  total: number;
  open: number;
  blocked: number;
  overdue: number;
  done: number;
  allDone: boolean;
  signal: 'on_track' | 'blocked' | 'overdue' | 'ready_to_close';
  blockedByChildTasks: boolean;
  explanations: string[];
  summaryLabel: string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildFollowUpChildRollup(followUpId: string, followUpStatus: FollowUpItem['status'], tasks: TaskItem[], linkedTasks?: TaskItem[]): FollowUpChildRollup {
  const linked = linkedTasks ?? tasks.filter((task) => task.linkedFollowUpId === followUpId);
  const blocked = linked.filter((task) => task.status === 'Blocked').length;
  const overdue = linked.filter((task) => task.status !== 'Done' && isTaskOverdue(task)).length;
  const open = linked.filter((task) => task.status !== 'Done').length;
  const done = linked.filter((task) => task.status === 'Done').length;
  const allDone = linked.length > 0 && open === 0;

  const explanations: string[] = [];
  if (blocked > 0) explanations.push(`Blocked by open child tasks (${pluralize(blocked, 'task')}).`);
  if (overdue > 0) explanations.push(`Child task overdue (${pluralize(overdue, 'task')}).`);
  if (allDone) explanations.push('All child tasks done.');
  if (allDone && followUpStatus !== 'Closed') explanations.push('Ready to close pending note/confirmation.');
  if (linked.length > 0 && open > 0 && blocked === 0 && overdue === 0) explanations.push('Child work in progress.');
  if (linked.length === 0) explanations.push('No child tasks linked yet.');

  const signal: FollowUpChildRollup['signal'] = blocked > 0
    ? 'blocked'
    : overdue > 0
      ? 'overdue'
      : allDone
        ? 'ready_to_close'
        : 'on_track';

  return {
    total: linked.length,
    open,
    blocked,
    overdue,
    done,
    allDone,
    signal,
    blockedByChildTasks: blocked > 0 || overdue > 0,
    explanations,
    summaryLabel: `${open}/${linked.length} open · ${blocked} blocked · ${overdue} overdue · ${done} done`,
  };
}
