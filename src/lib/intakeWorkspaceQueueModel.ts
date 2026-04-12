import { buildQueueMetrics, sortReviewQueue, type IntakeQueueItem } from './intakeReviewQueue';
import { queueLane, type QueueLane } from '../components/intake/intakeWorkspaceTypes';

function queueSortDateValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareQueueItemsForWorkflow(a: IntakeQueueItem, b: IntakeQueueItem) {
  if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
  const readinessWeight = (item: IntakeQueueItem) => {
    if (item.readiness === 'unsafe_to_create') return 5;
    if (item.readiness === 'needs_link_decision') return 4;
    if (item.readiness === 'ready_after_correction') return 3;
    if (item.readiness === 'ready_to_approve') return 2;
    return 1;
  };
  const readinessDelta = readinessWeight(b) - readinessWeight(a);
  if (readinessDelta !== 0) return readinessDelta;
  const dateDelta = queueSortDateValue(b.sortDate) - queueSortDateValue(a.sortDate);
  if (dateDelta !== 0) return dateDelta;
  return b.confidence - a.confidence;
}

export function sortPendingQueueForWorkflow(queue: IntakeQueueItem[]) {
  return sortReviewQueue(queue, 'newest')
    .filter((item) => item.status === 'pending')
    .sort(compareQueueItemsForWorkflow);
}

export function buildQueueLaneView(queue: IntakeQueueItem[]) {
  const pending = sortPendingQueueForWorkflow(queue);
  const byLane: Record<QueueLane, IntakeQueueItem[]> = {
    needs_correction: [],
    link_duplicate_review: [],
    ready_to_create: [],
    reference_only: [],
  };
  pending.forEach((item) => {
    byLane[queueLane(item)].push(item);
  });
  const counts: Record<QueueLane, number> = {
    needs_correction: byLane.needs_correction.length,
    link_duplicate_review: byLane.link_duplicate_review.length,
    ready_to_create: byLane.ready_to_create.length,
    reference_only: byLane.reference_only.length,
  };
  return { pending, byLane, counts };
}

export function buildQueueOpsSummary(queue: IntakeQueueItem[]) {
  const metrics = buildQueueMetrics(queue);
  const pending = queue.filter((item) => item.status === 'pending');
  return {
    pendingCount: metrics.pendingCount,
    safeNowCount: metrics.batchSafeCount,
    linkReviewCount: metrics.duplicateReviewCount,
    needsCorrectionCount: metrics.weakOrConflictingCount,
    referenceLikelyCount: pending.filter((item) => item.readiness === 'reference_likely').length,
  };
}

export interface IntakeBatchApprovalSummary {
  pendingCount: number;
  includedCount: number;
  excludedCount: number;
  includedIds: string[];
  topExclusionReasons: Array<{ reason: string; count: number }>;
}

export function buildBatchApprovalSummary(queue: IntakeQueueItem[]): IntakeBatchApprovalSummary {
  const pending = queue.filter((item) => item.status === 'pending');
  const included = pending.filter((item) => item.batchSafe);
  const excluded = pending.filter((item) => !item.batchSafe);
  const reasonCounts = new Map<string, number>();

  excluded.forEach((item) => {
    item.batchExclusionReasons.forEach((reason) => {
      const normalized = reason.trim();
      if (!normalized) return;
      reasonCounts.set(normalized, (reasonCounts.get(normalized) ?? 0) + 1);
    });
  });

  const topExclusionReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => ({ reason, count }));

  return {
    pendingCount: pending.length,
    includedCount: included.length,
    excludedCount: excluded.length,
    includedIds: included.map((item) => item.id),
    topExclusionReasons,
  };
}

export function resolveQueueSelectionId(input: {
  activeLane: QueueLane;
  byLane: Record<QueueLane, IntakeQueueItem[]>;
  previousSelectionId: string | null;
}) {
  const visible = input.byLane[input.activeLane];
  if (input.previousSelectionId && visible.some((item) => item.id === input.previousSelectionId)) {
    return input.previousSelectionId;
  }
  if (visible[0]) return visible[0].id;

  const laneFallbackOrder: QueueLane[] = ['needs_correction', 'link_duplicate_review', 'ready_to_create', 'reference_only'];
  for (const lane of laneFallbackOrder) {
    const candidate = input.byLane[lane][0];
    if (candidate) return candidate.id;
  }
  return null;
}
