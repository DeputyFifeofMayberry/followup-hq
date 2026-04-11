import { evaluateIntakeDecisionPolicy } from '../intakeDecisionPolicy';
import { summarizeFieldReviews, type IntakeFieldReview } from '../intakeEvidence';
import { evaluateForwardedImportSafety, evaluateIntakeImportSafety } from '../intakeImportSafety';
import { buildIntakeTuningModel } from '../intakeTuningModel';
import type { ForwardedIntakeCandidate, IntakeReviewerFeedback, IntakeWorkCandidate } from '../../types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function field(key: IntakeFieldReview['key'], status: IntakeFieldReview['status']): IntakeFieldReview {
  return { key, label: key, status, value: 'x', confidenceScore: 0.9, evidenceSnippets: [], sourceRefs: [], reasons: [] };
}

function buildFeedback(overrides: Partial<IntakeReviewerFeedback>[]): IntakeReviewerFeedback[] {
  return overrides.map((entry, idx) => ({
    id: `fb-${idx}`,
    createdAt: new Date().toISOString(),
    source: 'forwarding',
    candidateId: `c-${idx}`,
    candidateKind: 'forwarded',
    finalDecision: 'approved_followup',
    overrideApplied: false,
    correctedFields: [],
    ...entry,
  }));
}

const baseForwarded: ForwardedIntakeCandidate = {
  id: 'f1',
  forwardedEmailId: 'e1',
  normalizedSubject: 'Ship docs tomorrow',
  originalSender: 'ops@example.com',
  forwardingAlias: 'in@setpoint.com',
  parsedProject: 'B995',
  suggestedType: 'followup',
  confidence: 0.95,
  reasons: ['sender requested follow up'],
  warnings: [],
  duplicateWarnings: [],
  parsedCommands: ['p:B995'],
  parseQuality: 'strong',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseWork: IntakeWorkCandidate = {
  id: 'w1',
  batchId: 'b1',
  assetId: 'a1',
  candidateType: 'task',
  suggestedAction: 'create_new',
  confidence: 0.94,
  title: 'Send proposal',
  project: 'B995',
  owner: 'Jared',
  assignee: 'Jared',
  dueDate: '2026-04-20',
  priority: 'High',
  summary: 'ship proposal',
  tags: [],
  explanation: ['clear task language'],
  evidence: [],
  warnings: [],
  duplicateMatches: [],
  existingRecordMatches: [],
  approvalStatus: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function runIntakeDecisionPolicyChecks() {
  const stableFeedback = buildFeedback(new Array(8).fill(null).map(() => ({ finalDecision: 'approved_followup', suggestedType: 'followup' })));
  const stableModel = buildIntakeTuningModel({
    intakeWorkCandidates: [baseWork],
    forwardedCandidates: [baseForwarded],
    forwardedRules: [],
    forwardedRoutingAudit: [],
    feedback: stableFeedback,
  });

  const autoPolicy = evaluateIntakeDecisionPolicy({
    kind: 'forwarded',
    candidate: baseForwarded,
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'strong'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'medium')]),
    safety: evaluateForwardedImportSafety(baseForwarded),
    tuningModel: stableModel,
    feedback: stableFeedback,
    ruleIds: [],
  });
  assert(autoPolicy.decisionMode === 'auto_resolve' || autoPolicy.decisionMode === 'ready_now', 'stable strong candidate should be auto or ready-now path');

  const noisyModel = {
    ...stableModel,
    directImportReadiness: stableModel.directImportReadiness.map((entry) => entry.source === 'forwarded_email' ? { ...entry, readiness: 'review_first' as const, reason: 'forced' } : entry),
    thresholds: { ...stableModel.thresholds, forceReviewBySource: { ...stableModel.thresholds.forceReviewBySource, forwarded_email: true } },
  };
  const noisyPolicy = evaluateIntakeDecisionPolicy({
    kind: 'forwarded',
    candidate: baseForwarded,
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'strong'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'medium')]),
    safety: evaluateForwardedImportSafety(baseForwarded),
    tuningModel: noisyModel,
    feedback: stableFeedback,
    ruleIds: [],
  });
  assert(noisyPolicy.requiredReviewLevel === 'manual_required', 'review-first source should force manual review');

  const noisyRulePolicy = evaluateIntakeDecisionPolicy({
    kind: 'forwarded',
    candidate: baseForwarded,
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'strong'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'medium')]),
    safety: evaluateForwardedImportSafety(baseForwarded),
    tuningModel: { ...stableModel, thresholds: { ...stableModel.thresholds, noisyRuleIds: ['rule-1'] } },
    feedback: stableFeedback,
    ruleIds: ['rule-1'],
  });
  assert(!noisyRulePolicy.createNewAllowed, 'noisy rule should suppress create-new');

  const linkHeavyFeedback = buildFeedback([
    { finalDecision: 'linked_existing', suggestedType: 'task' },
    { finalDecision: 'linked_existing', suggestedType: 'task' },
    { finalDecision: 'approved_task', suggestedType: 'task' },
    { finalDecision: 'linked_existing', suggestedType: 'task' },
  ]);
  const strongMatch = { id: 'x', title: 'Existing', project: 'B995', score: 0.91, reason: 'same', recordType: 'followup' as const, strategy: 'link' as const, matchedFields: ['title', 'project'] };
  const linkPolicy = evaluateIntakeDecisionPolicy({
    kind: 'work',
    candidate: { ...baseWork, existingRecordMatches: [strongMatch] },
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'strong'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'strong')]),
    safety: evaluateIntakeImportSafety({ ...baseWork, existingRecordMatches: [strongMatch] }),
    tuningModel: stableModel,
    feedback: linkHeavyFeedback,
    ruleIds: [],
  });
  assert(!linkPolicy.createNewAllowed && linkPolicy.linkReviewRequired, 'strong match + link history should bias away from create-new toward link review');

  const weakPolicy = evaluateIntakeDecisionPolicy({
    kind: 'forwarded',
    candidate: { ...baseForwarded, parseQuality: 'weak', confidence: 0.7 },
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'weak'), field('owner', 'strong'), field('dueDate', 'weak'), field('title', 'strong'), field('existingLink', 'weak')]),
    safety: evaluateForwardedImportSafety({ ...baseForwarded, parseQuality: 'weak', confidence: 0.7 }),
    tuningModel: stableModel,
    feedback: stableFeedback,
    ruleIds: [],
  });
  assert(weakPolicy.decisionMode === 'correction_first', 'weak parse quality should block auto-approval');

  const weakOwnerWork = { ...baseWork, owner: '', assignee: '', fieldConfidence: { type: 0.92, title: 0.92, project: 0.9, owner: 0.41, dueDate: 0.9 } };
  const weakOwnerPolicy = evaluateIntakeDecisionPolicy({
    kind: 'work',
    candidate: weakOwnerWork,
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'missing'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'missing')]),
    safety: evaluateIntakeImportSafety(weakOwnerWork),
    tuningModel: stableModel,
    feedback: stableFeedback,
    ruleIds: [],
  });
  assert(weakOwnerPolicy.decisionMode === 'correction_first', 'missing owner evidence should force correction-first before create-new');
  assert(!weakOwnerPolicy.createNewAllowed, 'missing owner evidence should disable create-new');

  const referencePolicy = evaluateIntakeDecisionPolicy({
    kind: 'forwarded',
    candidate: { ...baseForwarded, suggestedType: 'reference' },
    fieldSummary: summarizeFieldReviews([field('type', 'strong'), field('project', 'strong'), field('owner', 'strong'), field('dueDate', 'strong'), field('title', 'strong'), field('existingLink', 'medium')]),
    safety: evaluateForwardedImportSafety({ ...baseForwarded, suggestedType: 'reference' }),
    tuningModel: stableModel,
    feedback: stableFeedback,
    ruleIds: [],
  });
  assert(referencePolicy.referenceBias === 'strong', 'reference-like patterns should carry strong reference bias');
  assert(referencePolicy.auditExplanation.length > 0 && referencePolicy.policySource.length > 0, 'policy should always be explainable');
}

runIntakeDecisionPolicyChecks();
