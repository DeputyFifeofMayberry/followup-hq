import { buildExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';
import { isReviewRecord } from '../../domains/records/integrity';
import { buildUnifiedQueue } from '../unifiedQueue';
import type { FollowUpItem, ProjectRecord, RecordIntegrityReason, TaskItem, UnifiedQueueItem } from '../../types';
import type { ReportingContext } from './contracts';

function groupRows(rows: UnifiedQueueItem[], keySelector: (row: UnifiedQueueItem) => string): Record<string, UnifiedQueueItem[]> {
  return rows.reduce<Record<string, UnifiedQueueItem[]>>((acc, row) => {
    const key = keySelector(row) || 'Unspecified';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function collectIntegrityReasonCounts(items: FollowUpItem[], tasks: TaskItem[]): Partial<Record<RecordIntegrityReason, number>> {
  const counts: Partial<Record<RecordIntegrityReason, number>> = {};
  [...items, ...tasks].forEach((record) => {
    (record.reviewReasons ?? []).forEach((reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1;
    });
  });
  return counts;
}

export function buildReportingContext({
  items,
  tasks,
  projects,
}: {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
}): ReportingContext {
  const generatedAt = new Date().toISOString();
  const queue = buildUnifiedQueue(items, tasks);
  const executionStats = buildExecutionQueueStats(queue);
  const openFollowUps = items.filter((item) => item.status !== 'Closed');
  const openTasks = tasks.filter((task) => task.status !== 'Done');
  const queueFollowUps = queue.filter((row) => row.recordType === 'followup');
  const queueTasks = queue.filter((row) => row.recordType === 'task');
  const followUpsNeedingReview = items.filter((item) => isReviewRecord(item));
  const tasksNeedingReview = tasks.filter((task) => isReviewRecord(task));
  const drafts = [...items, ...tasks].filter((record) => record.lifecycleState === 'draft');

  return {
    generatedAt,
    items,
    tasks,
    projects,
    openFollowUps,
    openTasks,
    queue,
    queueFollowUps,
    queueTasks,
    executionStats,
    scope: {
      openFollowUps: openFollowUps.length,
      openTasks: openTasks.length,
      openExecutionRecords: openFollowUps.length + openTasks.length,
      generatedAt,
    },
    queueByProject: groupRows(queue, (row) => row.project),
    queueByOwner: groupRows(queue, (row) => row.owner),
    integrity: {
      followUpsNeedingReview,
      tasksNeedingReview,
      drafts,
      byReason: collectIntegrityReasonCounts(items, tasks),
    },
  };
}
