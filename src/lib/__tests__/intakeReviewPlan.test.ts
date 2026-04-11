import { buildWorkCandidateFieldReviews, summarizeFieldReviews } from '../intakeEvidence';
import { evaluateIntakeImportSafety } from '../intakeImportSafety';
import { buildCandidateFieldSuggestions, buildIntakeReviewPlan } from '../intakeReviewPlan';
import { buildIntakeReviewQueue } from '../intakeReviewQueue';
import type { IntakeAssetRecord, IntakeExistingMatch, IntakeWorkCandidate } from '../../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function baseCandidate(overrides: Partial<IntakeWorkCandidate> = {}): IntakeWorkCandidate {
  const topMatch: IntakeExistingMatch = {
    id: 'fu-1',
    recordType: 'followup',
    title: 'Existing permit update',
    project: 'B995',
    score: 0.92,
    reason: 'subject overlap',
    strategy: 'duplicate',
    matchedFields: ['title', 'project'],
  };

  return {
    id: 'c1',
    batchId: 'b1',
    assetId: 'a1',
    candidateType: 'followup',
    suggestedAction: 'create_new',
    confidence: 0.93,
    title: 'Fwd: Permit update [followup]',
    project: 'B995',
    owner: 'Jared',
    assignee: 'Jared',
    dueDate: '2026-04-10',
    nextStep: 'Send update',
    waitingOn: 'City',
    priority: 'Medium',
    summary: 'Send updated permit response by Friday.',
    tags: [],
    explanation: ['strong extraction'],
    evidence: [{ id: 'e1', field: 'dueDate', snippet: 'deadline 2026-04-10', sourceRef: 'a1', score: 0.65, sourceType: 'text' }],
    fieldConfidence: { title: 0.9, project: 0.9, owner: 0.88, dueDate: 0.82, type: 0.9 },
    warnings: [],
    duplicateMatches: [],
    existingRecordMatches: [topMatch],
    approvalStatus: 'pending',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  };
}

const baseAsset: IntakeAssetRecord = {
  id: 'a1',
  batchId: 'b1',
  fileName: 'mail.eml',
  fileType: 'message/rfc822',
  sizeBytes: 100,
  kind: 'email',
  source: 'drop',
  uploadedAt: '2026-04-01T10:00:00.000Z',
  parseStatus: 'review_needed',
  parseQuality: 'strong',
  metadata: {},
  extractedText: 'Permit update details',
  extractedPreview: 'Permit update',
  warnings: [],
  errors: [],
  attachmentIds: [],
  sourceRefs: [],
  contentHash: 'hash-1',
};

function runIntakeReviewPlanChecks() {
  const safeCandidate = baseCandidate({ existingRecordMatches: [], duplicateMatches: [] });
  const safeSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(safeCandidate));
  const safeSafety = evaluateIntakeImportSafety(safeCandidate);
  const safeQueueItem = { ...buildIntakeReviewQueue([safeCandidate], [baseAsset])[0], readiness: 'ready_to_approve' as const, batchSafe: true };
  const safePlan = buildIntakeReviewPlan({ queueItem: safeQueueItem, fieldSummary: safeSummary, safety: safeSafety, suggestions: [] });
  assert(!safePlan.fastApproveEligible, 'medium/weak critical evidence should not receive fast-approve path');

  const strongCandidate = baseCandidate({
    id: 'c1-strong',
    existingRecordMatches: [],
    duplicateMatches: [],
    fieldConfidence: { title: 0.95, project: 0.94, owner: 0.93, dueDate: 0.94, type: 0.95 },
    evidence: [
      { id: 'e-title', field: 'title', snippet: 'Permit update required', sourceRef: 'a1', score: 0.9, sourceType: 'email_header' },
      { id: 'e-project', field: 'project', snippet: 'Project B995', sourceRef: 'a1', score: 0.91, sourceType: 'email_body' },
      { id: 'e-owner', field: 'owner', snippet: 'Owner Jared', sourceRef: 'a1', score: 0.9, sourceType: 'email_body' },
      { id: 'e-due', field: 'dueDate', snippet: 'deadline 2026-04-10', sourceRef: 'a1', score: 0.92, sourceType: 'email_body' },
    ],
  });
  const strongSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(strongCandidate));
  const strongSafety = evaluateIntakeImportSafety(strongCandidate);
  const strongQueueItem = { ...buildIntakeReviewQueue([strongCandidate], [baseAsset])[0], readiness: 'ready_to_approve' as const, batchSafe: true };
  const strongPlan = buildIntakeReviewPlan({ queueItem: strongQueueItem, fieldSummary: strongSummary, safety: strongSafety, suggestions: [] });
  assert(strongPlan.fastApproveEligible, 'strong critical evidence should remain fast-approve eligible');

  const missingProject = baseCandidate({ project: '', existingRecordMatches: [{ ...baseCandidate().existingRecordMatches[0], project: 'B771', score: 0.89 }] });
  const missingProjectSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(missingProject));
  const missingProjectSafety = evaluateIntakeImportSafety(missingProject);
  const suggestions = buildCandidateFieldSuggestions(missingProject, missingProjectSummary, missingProjectSafety);
  assert(suggestions.some((entry) => entry.field === 'project' && entry.value === 'B771'), 'missing project should get project suggestion from top match');

  const duplicateCandidate = baseCandidate();
  const duplicateSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(duplicateCandidate));
  const duplicateSafety = evaluateIntakeImportSafety(duplicateCandidate);
  const duplicateQueueItem = buildIntakeReviewQueue([duplicateCandidate], [baseAsset])[0];
  const duplicatePlan = buildIntakeReviewPlan({ queueItem: duplicateQueueItem, fieldSummary: duplicateSummary, safety: duplicateSafety, suggestions: [] });
  assert(duplicatePlan.suggestedDecision === 'link_existing', 'strong top match should recommend link decision');
  assert(duplicatePlan.quickFixActions.some((entry) => entry.kind === 'link_best_match'), 'duplicate risk should expose link best match action');

  const conflictingCandidate = baseCandidate({ warnings: ['conflicting type inference'], confidence: 0.62 });
  const conflictingSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(conflictingCandidate));
  const conflictingSafety = evaluateIntakeImportSafety(conflictingCandidate);
  const conflictingQueueItem = buildIntakeReviewQueue([conflictingCandidate], [baseAsset])[0];
  const conflictingPlan = buildIntakeReviewPlan({ queueItem: conflictingQueueItem, fieldSummary: conflictingSummary, safety: conflictingSafety, suggestions: [] });
  assert(!conflictingPlan.fastApproveEligible, 'conflicting evidence should block fast approve');
  assert(conflictingPlan.requiredCorrections.length > 0, 'conflicting evidence should require correction');

  const noisyTitleCandidate = baseCandidate({ title: 'Fwd: Status report [task]', project: '', assignee: 'Sam', owner: '', dueDate: '', nextStep: '' });
  const noisySummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(noisyTitleCandidate));
  const noisySafety = evaluateIntakeImportSafety(noisyTitleCandidate);
  const noisySuggestions = buildCandidateFieldSuggestions(noisyTitleCandidate, noisySummary, noisySafety);
  const noisyQueueItem = buildIntakeReviewQueue([noisyTitleCandidate], [baseAsset])[0];
  const noisyPlan = buildIntakeReviewPlan({ queueItem: noisyQueueItem, fieldSummary: noisySummary, safety: noisySafety, suggestions: noisySuggestions });
  assert(noisyPlan.quickFixActions.some((entry) => entry.kind === 'apply_suggestion'), 'quick fix suggestions should be generated for weak fields');
  assert(noisyPlan.requiredCorrections.some((field) => field.key === 'project'), 'project should be classified as required correction');
  assert(noisyPlan.duplicateReviewPriority === 'high', 'high duplicate risk should remain high priority');
}

try {
  runIntakeReviewPlanChecks();
  console.log('intake review plan checks passed');
} catch (error) {
  console.error('intake review plan checks failed');
  throw error;
}
