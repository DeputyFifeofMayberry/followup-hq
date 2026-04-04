import { starterItems, starterProjects, starterTasks } from '../../../lib/sample-data';
import { applyItemMutationEffects, applyTaskMutationEffects } from '../mutationEffects';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runMutationEffectChecks() {
  const state = {
    items: starterItems,
    tasks: starterTasks,
    projects: starterProjects,
    dismissedDuplicatePairs: [],
  };

  const mutatedItems = starterItems.map((item) => (item.id === starterItems[0].id ? { ...item, title: `${item.title} updated` } : item));
  const itemResult = applyItemMutationEffects(state, mutatedItems);
  assert(itemResult.items.length === mutatedItems.length, 'item mutation should keep row count stable');
  assert(itemResult.projects.length > 0, 'item mutation should keep derived projects');

  const mutatedTasks = starterTasks.map((task) => (task.id === starterTasks[0].id ? { ...task, status: 'Done' as const } : task));
  const taskResult = applyTaskMutationEffects(state, mutatedTasks);
  assert(taskResult.tasks[0].status === 'Done', 'task mutation should apply status update');
  assert(taskResult.items.length === starterItems.length, 'task mutation should keep follow-up count stable');
}

runMutationEffectChecks();
