import type { UnifiedQueueItem } from '../../../types';

export interface ExecutionQueueStats {
  due: number;
  blocked: number;
  cleanup: number;
  closeable: number;
}

export function buildExecutionQueueStats(queue: UnifiedQueueItem[]): ExecutionQueueStats {
  return {
    due: queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
    blocked: queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
    cleanup: queue.filter((row) => row.queueFlags.cleanupRequired).length,
    closeable: queue.filter((row) => row.queueFlags.readyToCloseParent || row.status === 'Done').length,
  };
}
