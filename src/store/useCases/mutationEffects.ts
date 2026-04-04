import { detectDuplicateReviews } from '../../lib/duplicateDetection';
import { attachProjects } from '../../domains/followups/helpers';
import { applyTaskRollupsToItems } from '../../domains/tasks/helpers';
import { deriveProjects } from '../../domains/projects/helpers';
import type { FollowUpItem } from '../../domains/followups/types';
import type { TaskItem } from '../../domains/tasks/types';
import type { MutationEffectState } from '../types';

export function refreshDuplicates(items: FollowUpItem[], dismissedDuplicatePairs: string[]) {
  return detectDuplicateReviews(items, dismissedDuplicatePairs);
}

export function applyItemMutationEffects(state: MutationEffectState, items: FollowUpItem[]) {
  const projects = deriveProjects(items, state.projects, state.tasks);
  const itemsWithRollups = attachProjects(applyTaskRollupsToItems(items, state.tasks), projects);
  return { items: itemsWithRollups, projects, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
}

export function applyTaskMutationEffects(state: MutationEffectState, tasks: TaskItem[]) {
  const projects = deriveProjects(state.items, state.projects, tasks);
  const items = attachProjects(applyTaskRollupsToItems(state.items, tasks), projects);
  return { tasks, items, projects };
}
