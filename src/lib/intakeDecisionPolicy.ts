import type { IntakeFieldReviewSummary } from './intakeEvidence';
import type { ImportSafetyResult } from './intakeImportSafety';
import type { IntakeTuningModel } from './intakeTuningModel';
import type { ForwardedIntakeCandidate, ForwardedRoutingAuditEntry, IntakeReviewerFeedback, IntakeWorkCandidate } from '../types';

export type IntakePolicyDecisionMode = 'auto_resolve' | 'ready_now' | 'correction_first' | 'link_review_first' | 'manual_review' | 'reference_lane';
export type IntakePolicyAutoActionType = 'create_task' | 'create_followup' | 'save_reference' | 'route_link_review' | 'none';
export type IntakePolicyRequiredReviewLevel = 'none' | 'quick_check' | 'correction_required' | 'manual_required';
export type IntakePolicyReferenceBias = 'strong' | 'moderate' | 'none';
export type IntakePolicyPatternRisk = 'low' | 'medium' | 'high';

export interface IntakePatternSignals {
  key: string;
  sampleSize: number;
  linkInsteadOfCreateRate: number;
  referenceDecisionRate: number;
  frequentCorrections: string[];
  duplicateOverrideRate: number;
}

export interface IntakeDecisionPolicyResult {
  decisionMode: IntakePolicyDecisionMode;
  autoActionEligible: boolean;
  autoActionType: IntakePolicyAutoActionType;
  requiredReviewLevel: IntakePolicyRequiredReviewLevel;
  createNewAllowed: boolean;
  linkReviewRequired: boolean;
  referenceBias: IntakePolicyReferenceBias;
  escalationReason: string | null;
  policySource: string[];
  patternRisk: IntakePolicyPatternRisk;
  preQueueDisposition: 'auto_resolve' | 'link_review' | 'correction_first' | 'ready_now' | 'manual_review' | 'reference_lane';
  auditExplanation: string[];
}

function sourceFromCandidate(kind: 'work' | 'forwarded'): 'quick_capture' | 'universal_intake' | 'forwarding' | 'forwarded_email' {
  if (kind === 'forwarded') return 'forwarded_email';
  return 'universal_intake';
}

function buildPatternSignals(input: {
  feedback: IntakeReviewerFeedback[];
  source: IntakeReviewerFeedback['source'] | 'forwarded_email';
  candidateType: string;
}): IntakePatternSignals {
  const sourceFeedback = input.feedback.filter((entry) => entry.source === input.source || (input.source === 'forwarded_email' && entry.source === 'forwarding'));
  const patternFeedback = sourceFeedback.filter((entry) => (entry.suggestedType ?? 'unknown') === input.candidateType);
  const total = patternFeedback.length || 1;
  const createCount = patternFeedback.filter((entry) => entry.finalDecision === 'approved_task' || entry.finalDecision === 'approved_followup').length;
  const linkCount = patternFeedback.filter((entry) => entry.finalDecision === 'linked_existing').length;
  const refCount = patternFeedback.filter((entry) => entry.finalDecision === 'saved_reference').length;
  const duplicateOverrideCount = patternFeedback.filter((entry) => entry.duplicateRiskOverride).length;

  const correctionCounts = new Map<string, number>();
  patternFeedback.forEach((entry) => {
    entry.correctedFields.forEach((field) => {
      correctionCounts.set(field, (correctionCounts.get(field) ?? 0) + 1);
    });
  });
  const frequentCorrections = Array.from(correctionCounts.entries())
    .filter(([, count]) => count / total >= 0.3)
    .sort((a, b) => b[1] - a[1])
    .map(([field]) => field)
    .slice(0, 4);

  return {
    key: `${input.source}:${input.candidateType}`,
    sampleSize: patternFeedback.length,
    linkInsteadOfCreateRate: linkCount / Math.max(linkCount + createCount, 1),
    referenceDecisionRate: refCount / total,
    frequentCorrections,
    duplicateOverrideRate: duplicateOverrideCount / total,
  };
}

export function evaluateIntakeDecisionPolicy(input: {
  kind: 'work' | 'forwarded';
  candidate: IntakeWorkCandidate | ForwardedIntakeCandidate;
  fieldSummary: IntakeFieldReviewSummary;
  safety: ImportSafetyResult;
  tuningModel?: IntakeTuningModel;
  feedback: IntakeReviewerFeedback[];
  ruleIds?: string[];
}): IntakeDecisionPolicyResult {
  const source = sourceFromCandidate(input.kind);
  const readiness = input.tuningModel?.directImportReadiness.find((entry) => entry.source === source)?.readiness ?? 'watch';
  const sourceReviewFirst = readiness === 'review_first' || !!input.tuningModel?.thresholds.forceReviewBySource[source];
  const hasNoisyRule = Boolean(input.ruleIds?.some((ruleId) => input.tuningModel?.thresholds.noisyRuleIds.includes(ruleId)));
  const parseWeak = input.kind === 'forwarded'
    ? (input.candidate as ForwardedIntakeCandidate).parseQuality !== 'strong'
    : ['weak', 'missing', 'conflicting'].includes(input.fieldSummary.priorityReviewFields.find((field) => field.key === 'title')?.status ?? 'weak');

  const missingCritical = input.fieldSummary.priorityReviewFields.filter((field) => ['missing', 'weak', 'conflicting'].includes(field.status)).length;
  const candidateType = input.kind === 'forwarded'
    ? (input.candidate as ForwardedIntakeCandidate).suggestedType
    : (input.candidate as IntakeWorkCandidate).candidateType.includes('task') ? 'task' : (input.candidate as IntakeWorkCandidate).candidateType.includes('reference') ? 'reference' : 'followup';
  const confidence = input.kind === 'forwarded'
    ? (input.candidate as ForwardedIntakeCandidate).confidence
    : (input.candidate as IntakeWorkCandidate).confidence;

  const patternSignals = buildPatternSignals({ feedback: input.feedback, source: source === 'forwarded_email' ? 'forwarding' : source, candidateType });
  const duplicatePressure = input.safety.duplicateRiskLevel !== 'low' || (input.tuningModel?.thresholds.duplicateCautionBoost ?? 0) > 0;

  const policySource: string[] = [];
  const auditExplanation: string[] = [];
  let escalationReason: string | null = null;

  const referenceBias: IntakePolicyReferenceBias = candidateType === 'reference' || patternSignals.referenceDecisionRate >= 0.55
    ? 'strong'
    : patternSignals.referenceDecisionRate >= 0.3
      ? 'moderate'
      : 'none';

  const patternRisk: IntakePolicyPatternRisk = patternSignals.sampleSize >= 4
    ? (patternSignals.linkInsteadOfCreateRate >= 0.45 || patternSignals.frequentCorrections.length >= 2 || patternSignals.duplicateOverrideRate >= 0.2 ? 'high'
      : (patternSignals.linkInsteadOfCreateRate >= 0.25 || patternSignals.frequentCorrections.length > 0 ? 'medium' : 'low'))
    : 'medium';

  const meetsConfidence = confidence >= (input.tuningModel?.thresholds.minimumBatchSafeConfidence ?? 0.84);
  const strongTrust = readiness === 'ready' && (input.tuningModel?.automationHealth ?? 'watch') === 'strong' && (input.tuningModel?.trustPosture ?? 'caution') === 'stable';

  let decisionMode: IntakePolicyDecisionMode = 'manual_review';
  let autoActionEligible = false;
  let autoActionType: IntakePolicyAutoActionType = 'none';
  let requiredReviewLevel: IntakePolicyRequiredReviewLevel = 'manual_required';
  let createNewAllowed = input.safety.safeToCreateNew;
  let linkReviewRequired = input.safety.requiresLinkReview;

  if (sourceReviewFirst) {
    decisionMode = 'manual_review';
    escalationReason = 'Source is in review-first posture.';
    policySource.push('source_readiness_review_first');
    auditExplanation.push('Source trust posture currently requires reviewer confirmation before create-new actions.');
  }

  if (hasNoisyRule) {
    decisionMode = 'manual_review';
    requiredReviewLevel = 'manual_required';
    createNewAllowed = false;
    escalationReason = escalationReason ?? 'Noisy rule influence detected.';
    policySource.push('noisy_rule_suppression');
    auditExplanation.push('A noisy routing rule influenced this candidate, so automation is suppressed until review.');
  }

  if (referenceBias === 'strong' && !input.safety.blockers.length && !duplicatePressure) {
    decisionMode = 'reference_lane';
    autoActionEligible = true;
    autoActionType = 'save_reference';
    requiredReviewLevel = 'quick_check';
    createNewAllowed = false;
    policySource.push('reference_pattern_bias');
    auditExplanation.push('Historical outcomes for this source/type frequently end as reference-only.');
  }

  if (duplicatePressure || patternSignals.linkInsteadOfCreateRate >= 0.4) {
    linkReviewRequired = true;
    createNewAllowed = false;
    decisionMode = 'link_review_first';
    requiredReviewLevel = 'manual_required';
    autoActionEligible = input.safety.duplicateRiskLevel === 'high' || patternSignals.linkInsteadOfCreateRate >= 0.55;
    autoActionType = autoActionEligible ? 'route_link_review' : 'none';
    escalationReason = escalationReason ?? 'Duplicate/link pressure is elevated.';
    policySource.push('duplicate_link_policy');
    auditExplanation.push('Top-match overlap plus reviewer history favors linking over creating new records.');
  }

  if (missingCritical > 0 || parseWeak || input.safety.blockers.length > 0) {
    decisionMode = 'correction_first';
    requiredReviewLevel = 'correction_required';
    autoActionEligible = false;
    autoActionType = 'none';
    createNewAllowed = false;
    escalationReason = escalationReason ?? 'Critical field quality is below automation threshold.';
    policySource.push('field_quality_guard');
    auditExplanation.push('Critical field evidence and/or parse quality did not pass required guards.');
  }

  if (!sourceReviewFirst && !hasNoisyRule && !duplicatePressure && missingCritical === 0 && !parseWeak && input.safety.blockers.length === 0) {
    if (strongTrust && meetsConfidence && patternRisk !== 'high') {
      decisionMode = 'auto_resolve';
      autoActionEligible = true;
      autoActionType = candidateType === 'task' ? 'create_task' : 'create_followup';
      requiredReviewLevel = 'none';
      createNewAllowed = true;
      policySource.push('earned_auto_approve');
      auditExplanation.push('Candidate evidence is strong and source-level trust posture has earned safe auto-resolution.');
    } else {
      decisionMode = 'ready_now';
      requiredReviewLevel = 'quick_check';
      createNewAllowed = true;
      policySource.push('ready_now_guarded');
      auditExplanation.push('Candidate is safe but requires a quick reviewer check before execution.');
    }
  }

  if (patternSignals.frequentCorrections.includes('dueDate') || patternSignals.frequentCorrections.includes('project')) {
    if (decisionMode === 'auto_resolve') {
      decisionMode = 'ready_now';
      autoActionEligible = false;
      autoActionType = 'none';
      requiredReviewLevel = 'quick_check';
      escalationReason = 'Pattern-level correction bundle (project/due date) requires a quick check.';
      policySource.push('pattern_correction_bundle_guard');
      auditExplanation.push('Historical corrections repeatedly adjust project/due date for this pattern.');
    }
  }

  const preQueueDisposition: IntakeDecisionPolicyResult['preQueueDisposition'] = decisionMode === 'auto_resolve'
    ? 'auto_resolve'
    : decisionMode === 'link_review_first'
      ? 'link_review'
      : decisionMode === 'correction_first'
        ? 'correction_first'
        : decisionMode === 'ready_now'
          ? 'ready_now'
          : decisionMode === 'reference_lane'
            ? 'reference_lane'
            : 'manual_review';

  return {
    decisionMode,
    autoActionEligible,
    autoActionType,
    requiredReviewLevel,
    createNewAllowed,
    linkReviewRequired,
    referenceBias,
    escalationReason,
    policySource,
    patternRisk,
    preQueueDisposition,
    auditExplanation,
  };
}

export function ruleIdsForForwardedCandidate(candidate: ForwardedIntakeCandidate, routingAudit: ForwardedRoutingAuditEntry[]): string[] {
  return routingAudit.find((entry) => entry.forwardedEmailId === candidate.forwardedEmailId)?.ruleIds ?? [];
}
