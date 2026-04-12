import { buildCandidatesFromAsset } from '../universalIntake';
import { evaluateIntakeImportSafety } from '../intakeImportSafety';
import { buildIntakeReviewQueue } from '../intakeReviewQueue';
import { buildWorkCandidateFieldReviews, summarizeFieldReviews } from '../intakeEvidence';
import { buildIntakeReviewPlan } from '../intakeReviewPlan';
import { buildBatchApprovalSummary, buildQueueLaneView, resolveQueueSelectionId } from '../intakeWorkspaceQueueModel';
import { INTAKE_GOLDEN_BATCH, INTAKE_GOLDEN_CASES } from './fixtures/intakeGoldenCases';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function runGoldenCase(caseId: string) {
  const fixture = INTAKE_GOLDEN_CASES.find((entry) => entry.id === caseId);
  if (!fixture) throw new Error(`Missing fixture case: ${caseId}`);

  const candidates = buildCandidatesFromAsset(fixture.asset, fixture.existingFollowups, fixture.existingTasks);
  const queue = buildIntakeReviewQueue(candidates, [fixture.asset], [INTAKE_GOLDEN_BATCH]);
  const primaryCandidate = candidates[0];
  const primaryQueue = queue[0];
  const primarySafety = primaryCandidate ? evaluateIntakeImportSafety(primaryCandidate) : null;
  const summary = primaryCandidate ? summarizeFieldReviews(buildWorkCandidateFieldReviews(primaryCandidate)) : null;
  const plan = primaryCandidate && primaryQueue && summary && primarySafety
    ? buildIntakeReviewPlan({ queueItem: primaryQueue, fieldSummary: summary, safety: primarySafety })
    : null;

  return {
    fixture,
    candidates,
    queue,
    primaryCandidate,
    primaryQueue,
    primarySafety,
    plan,
    batchSummary: buildBatchApprovalSummary(queue),
  };
}

/**
 * Golden harness intent:
 * - lock representative intake categories, not a narrow parser edge.
 * - verify parse/extract -> admission -> candidate -> queue -> decision behavior.
 * - catch false-positive create-new regressions (weak, duplicate, reference, blocked).
 */
function runRepresentativeWorkflowChecks() {
  INTAKE_GOLDEN_CASES.forEach((fixture) => {
    const run = runGoldenCase(fixture.id);
    const { expected } = fixture;
    assert(
      run.candidates.length >= expected.candidateCount.min && run.candidates.length <= expected.candidateCount.max,
      `[${fixture.id}] candidate count ${run.candidates.length} outside expected range ${expected.candidateCount.min}-${expected.candidateCount.max}`,
    );

    if (expected.admission === 'extracted_only') {
      assert(run.candidates.length === 0, `[${fixture.id}] extracted-only case must not produce candidates`);
      assert(run.queue.length === 0, `[${fixture.id}] extracted-only case must not create queue rows`);
      return;
    }

    const candidate = run.primaryCandidate;
    const queueItem = run.primaryQueue;
    const safety = run.primarySafety;
    assert(!!candidate, `[${fixture.id}] expected at least one candidate`);
    assert(!!queueItem, `[${fixture.id}] expected queue item for produced candidate`);
    assert(!!safety, `[${fixture.id}] expected safety evaluation result`);

    assert(candidate!.admissionState === expected.admission, `[${fixture.id}] admission mismatch expected ${expected.admission}, got ${candidate!.admissionState}`);

    if (expected.likelyType) {
      assert(candidate!.candidateType.includes(expected.likelyType), `[${fixture.id}] candidate type ${candidate!.candidateType} did not include expected ${expected.likelyType}`);
    }
    if (expected.likelyProjectIncludes) {
      assert((candidate!.project || '').toLowerCase().includes(expected.likelyProjectIncludes.toLowerCase()), `[${fixture.id}] project "${candidate!.project}" did not include ${expected.likelyProjectIncludes}`);
    }
    if (expected.likelyTitleIncludes) {
      assert(candidate!.title.toLowerCase().includes(expected.likelyTitleIncludes.toLowerCase()), `[${fixture.id}] title "${candidate!.title}" did not include ${expected.likelyTitleIncludes}`);
    }

    if (expected.expectedReadiness) {
      assert(queueItem!.readiness === expected.expectedReadiness, `[${fixture.id}] readiness mismatch expected ${expected.expectedReadiness}, got ${queueItem!.readiness}`);
    }
    if (expected.expectedTriage) {
      assert(queueItem!.triageCategory === expected.expectedTriage, `[${fixture.id}] triage mismatch expected ${expected.expectedTriage}, got ${queueItem!.triageCategory}`);
    }

    if (expected.expectsDuplicatePressure !== undefined) {
      assert(queueItem!.duplicateRisk === expected.expectsDuplicatePressure, `[${fixture.id}] duplicate pressure mismatch expected ${expected.expectsDuplicatePressure}, got ${queueItem!.duplicateRisk}`);
    }

    if (expected.batchSafeAllowed !== undefined) {
      assert(queueItem!.batchSafe === expected.batchSafeAllowed, `[${fixture.id}] batch-safe mismatch expected ${expected.batchSafeAllowed}, got ${queueItem!.batchSafe}`);
    }

    if (expected.expectedDecision) {
      assert(safety!.recommendedDecision === expected.expectedDecision, `[${fixture.id}] safety decision mismatch expected ${expected.expectedDecision}, got ${safety!.recommendedDecision}`);
    }

    if (expected.actionableLane === 'reviewable') {
      assert(candidate!.admissionState !== 'action_ready', `[${fixture.id}] reviewable case should never be action-ready`);
      assert(queueItem!.batchSafe === false, `[${fixture.id}] reviewable case should not be batch-safe`);
    }
    if (expected.actionableLane === 'actionable') {
      assert(queueItem!.readiness !== 'manual_review_required', `[${fixture.id}] actionable case should not route to manual review`);
    }

    if (run.plan) {
      const hasLinkFix = run.plan.quickFixActions.some((action) => action.kind === 'link_best_match');
      if (queueItem!.duplicateRisk) {
        assert(hasLinkFix, `[${fixture.id}] duplicate-risk item should include quick link fix action`);
      }
    }
  });
}

function runFalsePositiveGuards() {
  const reference = runGoldenCase('reference-only-informational');
  const weak = runGoldenCase('weak-degraded-email');
  const duplicate = runGoldenCase('duplicate-link-pressure');
  const extractedOnly = runGoldenCase('legacy-extracted-only');

  assert(reference.primarySafety?.recommendedDecision === 'save_reference', 'reference-only fixture should be save-reference, not create-new');
  assert(!reference.primarySafety?.safeToCreateNew, 'reference-only fixture must not be marked safe create-new');

  assert(weak.primaryQueue?.readiness !== 'ready_to_approve', 'weak/degraded fixture must not be promoted to ready-to-approve');
  assert(!weak.primarySafety?.safeToCreateNew, 'weak/degraded fixture must not be create-new safe');

  assert(duplicate.primaryQueue?.duplicateRisk, 'duplicate fixture must expose duplicate pressure in queue');
  assert(duplicate.primarySafety?.recommendedDecision === 'link_existing' || duplicate.primarySafety?.recommendedDecision === 'duplicate_update_review', 'duplicate fixture must not silently become clean create-new');

  assert(extractedOnly.candidates.length === 0 && extractedOnly.queue.length === 0, 'blocked extracted-only fixture must never emit candidates or queue rows');
}

function runBatchAndSelectionWorkflowChecks() {
  const generated = INTAKE_GOLDEN_CASES.flatMap((fixture) => buildCandidatesFromAsset(fixture.asset, fixture.existingFollowups, fixture.existingTasks));
  const assets = INTAKE_GOLDEN_CASES.map((fixture) => fixture.asset);
  const queue = buildIntakeReviewQueue(generated, assets, [INTAKE_GOLDEN_BATCH]);
  const laneView = buildQueueLaneView(queue);
  const summary = buildBatchApprovalSummary(queue);

  const explicitBatchSafeCount = queue.filter((item) => item.batchSafe).length;
  assert(summary.includedCount === explicitBatchSafeCount, 'batch summary included count should match queue batchSafe flags');
  assert(summary.excludedCount > 0, 'representative corpus should include excluded candidates requiring review');

  const firstSelection = resolveQueueSelectionId({
    activeLane: 'needs_correction',
    byLane: laneView.byLane,
    previousSelectionId: null,
  });
  assert(firstSelection !== null, 'selection resolver should pick a pending candidate from representative queue');

  const withoutSelected = {
    ...laneView.byLane,
    needs_correction: laneView.byLane.needs_correction.filter((item) => item.id !== firstSelection),
  };
  const fallbackSelection = resolveQueueSelectionId({
    activeLane: 'needs_correction',
    byLane: withoutSelected,
    previousSelectionId: firstSelection,
  });
  assert(fallbackSelection !== firstSelection, 'selection should move forward after chosen item is removed');
}

runRepresentativeWorkflowChecks();
runFalsePositiveGuards();
runBatchAndSelectionWorkflowChecks();
