import { buildExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';
import { isReviewRecord } from '../../domains/records/integrity';
import { buildUnifiedQueue } from '../unifiedQueue';
import type { FollowUpItem, ProjectRecord, RecordIntegrityReason, ReportDraftState, TaskItem, UnifiedQueueItem } from '../../types';
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
  draft,
}: {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  draft?: ReportDraftState;
}): ReportingContext {
  const generatedAt = new Date().toISOString();
  const scopedItems = items.filter((item) => {
    if (!draft?.scope.includeClosed && item.status === 'Closed') return false;
    if (draft?.scope.mode === 'project' && draft.scope.project && item.project !== draft.scope.project) return false;
    if (draft?.scope.mode === 'owner' && draft.scope.owner && item.owner !== draft.scope.owner) return false;
    return true;
  });
  const scopedTasks = tasks.filter((task) => {
    if (!draft?.scope.includeClosed && task.status === 'Done') return false;
    if (draft?.scope.mode === 'project' && draft.scope.project && task.project !== draft.scope.project) return false;
    if (draft?.scope.mode === 'owner' && draft.scope.owner && task.owner !== draft.scope.owner) return false;
    return true;
  });
  const queue = buildUnifiedQueue(scopedItems, scopedTasks).slice(0, Math.max(5, draft?.display.rowLimit ?? 8) * 4);
  const executionStats = buildExecutionQueueStats(queue);
  const openFollowUps = scopedItems.filter((item) => item.status !== 'Closed');
  const openTasks = scopedTasks.filter((task) => task.status !== 'Done');
  const queueFollowUps = queue.filter((row) => row.recordType === 'followup');
  const queueTasks = queue.filter((row) => row.recordType === 'task');
  const followUpsNeedingReview = scopedItems.filter((item) => isReviewRecord(item));
  const tasksNeedingReview = scopedTasks.filter((task) => isReviewRecord(task));
  const drafts = [...scopedItems, ...scopedTasks].filter((record) => record.lifecycleState === 'draft');

  return {
    generatedAt,
    items: scopedItems,
    tasks: scopedTasks,
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
