import { selectMaterializedUnifiedQueue } from '../unifiedQueue';
import type { AppStore } from '../../types';
import type { FollowUpItem, TaskItem } from '../../../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseState = {
  items: [],
  tasks: [],
  queuePreset: 'All',
  executionFilter: {},
  executionSort: 'queue_score',
} as const;

function buildFollowUp(id: string, title: string) {
  return ({
    id,
    title,
    project: 'Alpha',
    owner: 'Jordan',
    status: 'Open',
    priority: 'P2',
    lifecycleState: 'ready',
    cadenceDays: 3,
    lastTouchDate: '2026-04-11T00:00:00.000Z',
    escalationLevel: 'None',
    dueDate: '2026-04-12',
    nextTouchDate: '2026-04-12',
    promisedDate: '',
    updatedAt: '2026-04-12T00:00:00.000Z',
    createdAt: '2026-04-12T00:00:00.000Z',
    taskIds: [],
  } as unknown as FollowUpItem);
}

function buildTask(id: string, title: string) {
  return ({
    id,
    title,
    project: 'Alpha',
    assignee: 'Casey',
    status: 'Open',
    priority: 'P2',
    lifecycleState: 'ready',
    completionImpact: 'advance_parent',
    dueDate: '2026-04-12',
    updatedAt: '2026-04-12T00:00:00.000Z',
    createdAt: '2026-04-12T00:00:00.000Z',
  } as unknown as TaskItem);
}

function testSelectorTracksUnderlyingQueueInputs(): void {
  const emptyQueue = selectMaterializedUnifiedQueue(baseState as unknown as Pick<AppStore, 'items' | 'tasks' | 'queuePreset' | 'executionFilter' | 'executionSort'>);
  assert(emptyQueue.length === 0, 'expected no queue rows from empty state');

  const hydratedQueue = selectMaterializedUnifiedQueue({
    ...baseState,
    items: [buildFollowUp('FU-1', 'Hydrated follow-up')],
    tasks: [buildTask('TASK-1', 'Hydrated task')],
  } as unknown as Pick<AppStore, 'items' | 'tasks' | 'queuePreset' | 'executionFilter' | 'executionSort'>);
  assert(hydratedQueue.length === 2, 'expected queue to materialize hydrated follow-up and task rows');

  const taskOnlyQueue = selectMaterializedUnifiedQueue({
    ...baseState,
    items: [buildFollowUp('FU-1', 'Hydrated follow-up')],
    tasks: [buildTask('TASK-1', 'Hydrated task')],
    executionFilter: { types: ['task'] },
  } as unknown as Pick<AppStore, 'items' | 'tasks' | 'queuePreset' | 'executionFilter' | 'executionSort'>);
  assert(taskOnlyQueue.length === 1, 'expected queue filter changes to recompute materialized queue');
  assert(taskOnlyQueue[0]?.recordType === 'task', 'expected task-only filter to return only task rows');
}

(function run() {
  testSelectorTracksUnderlyingQueueInputs();
})();
