import type { UnifiedQueueItem } from '../../../types';
import { toExecutionRecordSummary, toExecutionRecordSurface } from './adapters';
import { deriveExecutionAttentionState } from './signals';
import type { ExecutionLaneItem, ExecutionLaneKey, ExecutionMetricsVocabulary, ExecutionRouteHandoff } from './types';

export function selectExecutionRecords(queue: UnifiedQueueItem[]) {
  return queue.map(toExecutionRecordSurface);
}

export function selectExecutionLaneItems(
  lane: ExecutionLaneKey,
  queue: UnifiedQueueItem[],
  options?: { project?: string },
): ExecutionLaneItem[] {
  return selectExecutionRecords(queue)
    .filter((record) => {
      if (lane === 'tasks') return record.recordType === 'task';
      if (lane === 'followups') return record.recordType === 'followup';
      return true;
    })
    .filter((record) => !options?.project || record.project === options.project)
    .map((surface) => ({
      lane,
      surface,
      summary: toExecutionRecordSummary(surface),
      attention: deriveExecutionAttentionState(surface),
    }));
}

export function buildExecutionLaneMetrics(items: ExecutionLaneItem[], selectedRecordId?: string | null, latestHandoff?: ExecutionRouteHandoff | null): ExecutionMetricsVocabulary {
  return {
    visible: items.length,
    dueNow: items.filter((item) => item.surface.queueFlags.dueToday || item.surface.queueFlags.needsTouchToday).length,
    overdue: items.filter((item) => item.surface.queueFlags.overdue).length,
    blockedOrAtRisk: items.filter((item) => item.surface.queueFlags.blocked || item.surface.queueFlags.parentAtRisk).length,
    waiting: items.filter((item) => item.surface.queueFlags.waiting).length,
    readyToClose: items.filter((item) => item.surface.queueFlags.readyToCloseParent || item.surface.status === 'Done' || item.surface.status === 'Closed').length,
    cleanup: items.filter((item) => item.surface.queueFlags.cleanupRequired || item.surface.queueFlags.orphanedTask).length,
    linkedOpenWork: items.filter((item) => (item.surface.sourceItem.linkedOpenTaskCount ?? 0) > 0).length,
    selected: selectedRecordId ? items.filter((item) => item.surface.id === selectedRecordId).length : 0,
    routed: latestHandoff ? items.filter((item) => item.surface.id === latestHandoff.targetRecordId).length : 0,
  };
}
