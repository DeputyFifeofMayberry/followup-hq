import { buildExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';
import { isReviewRecord } from '../../domains/records/integrity';
import { buildUnifiedQueue } from '../unifiedQueue';
import type { FollowUpItem, ProjectRecord, RecordIntegrityReason, ReportDraftState, TaskItem, UnifiedQueueItem } from '../../types';
import type { ReportingContext } from './contracts';
import { resolveReportScope } from './reportScope';

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
  draft,
}: {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  draft?: ReportDraftState;
}): ReportingContext {
  const generatedAt = new Date().toISOString();
  const scope = draft?.scope ?? { mode: 'trusted_live_only', includeClosed: false };
  const resolution = resolveReportScope({ items, tasks, scope });

  const queue = buildUnifiedQueue(resolution.includedItems, resolution.includedTasks).slice(0, Math.max(5, draft?.display.rowLimit ?? 8) * 4);
  const executionStats = buildExecutionQueueStats(queue);
  const openFollowUps = resolution.includedItems.filter((item) => item.status !== 'Closed');
  const openTasks = resolution.includedTasks.filter((task) => task.status !== 'Done');
  const queueFollowUps = queue.filter((row) => row.recordType === 'followup');
  const queueTasks = queue.filter((row) => row.recordType === 'task');
  const followUpsNeedingReview = resolution.includedItems.filter((item) => isReviewRecord(item));
  const tasksNeedingReview = resolution.includedTasks.filter((task) => isReviewRecord(task));
  const drafts = [...resolution.includedItems, ...resolution.includedTasks].filter((record) => record.lifecycleState === 'draft');

  return {
    generatedAt,
    items: resolution.includedItems,
    tasks: resolution.includedTasks,
    projects,
    openFollowUps,
    openTasks,
    queue,
    queueFollowUps,
    queueTasks,
    executionStats,
    scopeReceipt: resolution.receipt,
    confidence: resolution.confidence,
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
      byReason: collectIntegrityReasonCounts(resolution.includedItems, resolution.includedTasks),
    },
  };
}
