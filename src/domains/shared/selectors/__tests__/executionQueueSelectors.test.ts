import { buildUnifiedQueue } from '../../../../lib/unifiedQueue';
import { starterItems, starterTasks } from '../../../../lib/sample-data';
import { buildExecutionQueueStats } from '../executionQueueSelectors';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runExecutionQueueSelectorChecks() {
  const queue = buildUnifiedQueue(starterItems, starterTasks);
  const stats = buildExecutionQueueStats(queue);
  assert(stats.due > 0, 'expected due items in queue stats');
  assert(stats.blocked > 0, 'expected blocked items in queue stats');
  assert(stats.cleanup >= 0, 'cleanup count should be non-negative');
  assert(stats.closeable >= 0, 'closeable count should be non-negative');
}

runExecutionQueueSelectorChecks();
