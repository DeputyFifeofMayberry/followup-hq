import { buildQueueLaneView, buildQueueOpsSummary, resolveQueueSelectionId } from '../intakeWorkspaceQueueModel';
import type { IntakeQueueItem } from '../intakeReviewQueue';
import type { IntakeDecisionPolicyResult } from '../intakeDecisionPolicy';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const defaultPolicy: IntakeDecisionPolicyResult = {
  decisionMode: 'manual_review',
  requiredReviewLevel: 'manual_required',
  autoActionEligible: false,
  autoActionType: 'none',
  createNewAllowed: false,
  linkReviewRequired: true,
  referenceBias: 'none',
  escalationReason: null,
  policySource: [],
  preQueueDisposition: 'manual_review',
  auditExplanation: [],
  patternRisk: 'medium',
};

function queueItem(partial: Partial<IntakeQueueItem> & Pick<IntakeQueueItem, 'id'>): IntakeQueueItem {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    status: partial.status ?? 'pending',
    bucket: partial.bucket ?? 'needs_correction',
    confidence: partial.confidence ?? 0.8,
    confidenceTier: partial.confidenceTier ?? 'medium',
    candidateType: partial.candidateType ?? 'followup',
    sourceType: partial.sourceType ?? 'universal_intake',
    parseStatus: partial.parseStatus,
    parseQuality: partial.parseQuality,
    duplicateRisk: partial.duplicateRisk ?? false,
    missingCriticalFields: partial.missingCriticalFields ?? 0,
    conflictingEvidence: partial.conflictingEvidence ?? false,
    recommendedAction: partial.recommendedAction ?? 'create_new',
    batchSafe: partial.batchSafe ?? false,
    batchExclusionReasons: partial.batchExclusionReasons ?? [],
    alerts: partial.alerts ?? [],
    sortDate: partial.sortDate ?? '2026-04-12',
    readiness: partial.readiness ?? 'ready_after_correction',
    priorityScore: partial.priorityScore ?? 1000,
    nextStepHint: partial.nextStepHint ?? 'next',
    decisionPolicy: partial.decisionPolicy ?? defaultPolicy,
    triageCategory: partial.triageCategory ?? 'needs_correction',
  };
}

const queue = [
  queueItem({ id: 'c-needs-2', priorityScore: 1040, readiness: 'unsafe_to_create', sortDate: '2026-04-10', missingCriticalFields: 2 }),
  queueItem({ id: 'c-ready', bucket: 'ready_to_approve', readiness: 'ready_to_approve', priorityScore: 980, sortDate: '2026-04-11', triageCategory: 'ready_now' }),
  queueItem({ id: 'c-link', bucket: 'link_duplicate_review', readiness: 'needs_link_decision', priorityScore: 1030, duplicateRisk: true }),
  queueItem({ id: 'c-needs-1', priorityScore: 1010, readiness: 'ready_after_correction', sortDate: '2026-04-12' }),
  queueItem({ id: 'c-reference', bucket: 'reference_likely', readiness: 'reference_likely', priorityScore: 900, candidateType: 'reference', triageCategory: 'reference_likely' }),
  queueItem({ id: 'c-finalized', status: 'finalized', bucket: 'finalized_history', readiness: 'ready_to_approve', priorityScore: 50 }),
];

const laneView = buildQueueLaneView(queue);
const opsSummary = buildQueueOpsSummary(queue);
assert(laneView.pending.length === 5, 'lane view should only include pending queue items');
assert(laneView.counts.needs_correction === 2, 'needs_correction count should be derived from queue readiness lanes');
assert(laneView.counts.link_duplicate_review === 1, 'link lane count should match queue lane assignment');
assert(laneView.counts.ready_to_create === 1, 'ready lane count should match queue lane assignment');
assert(laneView.counts.reference_only === 1, 'reference lane count should match queue lane assignment');
assert(laneView.byLane.needs_correction[0]?.id === 'c-needs-2', 'needs-correction lane should be sorted by workflow priority');
assert(opsSummary.pendingCount === 5, 'ops summary pending count should use authoritative pending queue');
assert(opsSummary.safeNowCount === 0, 'ops summary safe-now count should come from batch-safe queue semantics');
assert(opsSummary.linkReviewCount === 1, 'ops summary link review count should map duplicate review pressure');
assert(opsSummary.needsCorrectionCount === 2, 'ops summary correction count should map correction queue pressure');
assert(opsSummary.referenceLikelyCount === 1, 'ops summary should include reference-likely queue pressure');

const defaultSelection = resolveQueueSelectionId({ activeLane: 'needs_correction', byLane: laneView.byLane, previousSelectionId: null });
assert(defaultSelection === 'c-needs-2', 'default selection should be highest-priority queue item in active lane');

const preservedSelection = resolveQueueSelectionId({ activeLane: 'needs_correction', byLane: laneView.byLane, previousSelectionId: 'c-needs-1' });
assert(preservedSelection === 'c-needs-1', 'selection should be preserved when queue item remains in active filtered lane');

const fallbackSelection = resolveQueueSelectionId({ activeLane: 'needs_correction', byLane: laneView.byLane, previousSelectionId: 'c-missing' });
assert(fallbackSelection === 'c-needs-2', 'selection should fall back to next-best lane item when current selection disappears');

const postDecisionLaneView = buildQueueLaneView(queue.filter((item) => item.id !== 'c-needs-2'));
const postDecisionSelection = resolveQueueSelectionId({
  activeLane: 'needs_correction',
  byLane: postDecisionLaneView.byLane,
  previousSelectionId: 'c-needs-2',
});
assert(postDecisionSelection === 'c-needs-1', 'after decision removes selected queue item, next-best item should auto-advance in active lane');
