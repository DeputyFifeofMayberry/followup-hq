import type {
  ForwardedEmailRule,
  ForwardedIntakeCandidate,
  ForwardedRoutingAuditEntry,
  IntakeReviewerFeedback,
  IntakeReviewerFeedbackDecision,
  IntakeReviewerFeedbackField,
  IntakeWorkCandidate,
} from '../types';

export type IntakeTrustPosture = 'stable' | 'caution' | 'noisy';
export type IntakeAutomationHealth = 'strong' | 'watch' | 'weak';
export type IntakeRuleQuality = 'strong' | 'watch' | 'noisy';

export interface IntakeRateStat {
  count: number;
  total: number;
  rate: number;
}

export interface IntakeFieldCorrectionStat extends IntakeRateStat {
  source: IntakeReviewerFeedback['source'] | 'all';
  candidateType: string | 'all';
  field: IntakeReviewerFeedbackField;
}

export interface IntakeDecisionOverrideStat extends IntakeRateStat {
  finalDecision: IntakeReviewerFeedbackDecision;
}

export interface IntakeRuleQualityStat {
  ruleId: string;
  ruleName: string;
  hits: number;
  approvals: number;
  overrides: number;
  rejectedOrReference: number;
  quality: IntakeRuleQuality;
  reasons: string[];
  noisySignalRate: number;
}

export interface IntakeTuningThresholds {
  minimumReadyConfidence: number;
  minimumBatchSafeConfidence: number;
  requireStrongDueDateEvidence: boolean;
  requireStrongProjectEvidence: boolean;
  forceReviewBySource: Partial<Record<IntakeReviewerFeedback['source'] | 'forwarded_email', boolean>>;
  duplicateCautionBoost: number;
  noisyRuleIds: string[];
}

export interface IntakeTuningModel {
  trustPosture: IntakeTrustPosture;
  automationHealth: IntakeAutomationHealth;
  recentFeedbackCount: number;
  correctionRate: IntakeRateStat;
  overrideRate: IntakeRateStat;
  rejectionOrReferenceRate: IntakeRateStat;
  linkInsteadOfCreateRate: IntakeRateStat;
  duplicateRiskOverrideRate: IntakeRateStat;
  correctionByFieldAndSource: IntakeFieldCorrectionStat[];
  correctionByFieldAndCandidateType: IntakeFieldCorrectionStat[];
  overridesByDecision: IntakeDecisionOverrideStat[];
  ruleQuality: IntakeRuleQualityStat[];
  routeToReviewPressure: Array<{ source: IntakeReviewerFeedback['source'] | 'forwarded_email'; pressure: number; reason: string }>;
  directImportReadiness: Array<{ source: IntakeReviewerFeedback['source'] | 'forwarded_email'; readiness: 'ready' | 'watch' | 'review_first'; reason: string }>;
  thresholds: IntakeTuningThresholds;
  cautionFlags: string[];
  tuningSuggestions: string[];
}

const SAMPLE_WINDOW = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRate(count: number, total: number): IntakeRateStat {
  if (!total) return { count, total, rate: 0 };
  return { count, total, rate: count / total };
}

function classifyPosture(input: { correctionRate: number; overrideRate: number; ruleNoisyRate: number; linkInsteadOfCreateRate: number }): IntakeTrustPosture {
  if (input.correctionRate >= 0.35 || input.overrideRate >= 0.22 || input.ruleNoisyRate >= 0.35 || input.linkInsteadOfCreateRate >= 0.2) return 'noisy';
  if (input.correctionRate >= 0.2 || input.overrideRate >= 0.12 || input.ruleNoisyRate >= 0.2 || input.linkInsteadOfCreateRate >= 0.1) return 'caution';
  return 'stable';
}

function classifyAutomationHealth(input: { correctionRate: number; overrideRate: number; rejectionOrReferenceRate: number; weakParseRate: number }): IntakeAutomationHealth {
  if (input.correctionRate >= 0.35 || input.overrideRate >= 0.22 || input.rejectionOrReferenceRate >= 0.25 || input.weakParseRate >= 0.45) return 'weak';
  if (input.correctionRate >= 0.2 || input.overrideRate >= 0.12 || input.rejectionOrReferenceRate >= 0.12 || input.weakParseRate >= 0.25) return 'watch';
  return 'strong';
}

export function buildIntakeTuningModel(input: {
  intakeWorkCandidates: IntakeWorkCandidate[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  forwardedRules: ForwardedEmailRule[];
  forwardedRoutingAudit: ForwardedRoutingAuditEntry[];
  feedback: IntakeReviewerFeedback[];
}): IntakeTuningModel {
  const { intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, feedback } = input;
  const recentFeedback = feedback.slice(0, SAMPLE_WINDOW);
  const feedbackCount = recentFeedback.length;

  const allCorrections = recentFeedback.reduce((acc, entry) => acc + entry.correctedFields.length, 0);
  const correctionRate = toRate(allCorrections, Math.max(feedbackCount, 1));
  const overrideRate = toRate(recentFeedback.filter((entry) => entry.overrideApplied).length, feedbackCount || 1);
  const rejectionOrReferenceRate = toRate(
    recentFeedback.filter((entry) => entry.finalDecision === 'rejected' || entry.finalDecision === 'saved_reference').length,
    feedbackCount || 1,
  );
  const createDecisions = recentFeedback.filter((entry) => entry.finalDecision === 'approved_task' || entry.finalDecision === 'approved_followup');
  const linkInsteadOfCreateRate = toRate(
    recentFeedback.filter((entry) => entry.finalDecision === 'linked_existing').length,
    createDecisions.length + recentFeedback.filter((entry) => entry.finalDecision === 'linked_existing').length || 1,
  );
  const duplicateRiskOverrideRate = toRate(recentFeedback.filter((entry) => entry.duplicateRiskOverride).length, feedbackCount || 1);

  const sourceTotals = new Map<IntakeReviewerFeedback['source'], number>();
  const candidateTotals = new Map<string, number>();
  const sourceFieldCounts = new Map<`${IntakeReviewerFeedback['source']}::${IntakeReviewerFeedbackField}`, number>();
  const candidateFieldCounts = new Map<string, number>();

  recentFeedback.forEach((entry) => {
    const source = entry.source;
    sourceTotals.set(source, (sourceTotals.get(source) ?? 0) + 1);
    candidateTotals.set(entry.suggestedType ?? 'unknown', (candidateTotals.get(entry.suggestedType ?? 'unknown') ?? 0) + 1);

    entry.correctedFields.forEach((field) => {
      const sourceKey = `${source}::${field}` as `${IntakeReviewerFeedback['source']}::${IntakeReviewerFeedbackField}`;
      const candidateKey = `${entry.suggestedType ?? 'unknown'}::${field}`;
      sourceFieldCounts.set(sourceKey, (sourceFieldCounts.get(sourceKey) ?? 0) + 1);
      candidateFieldCounts.set(candidateKey, (candidateFieldCounts.get(candidateKey) ?? 0) + 1);
    });
  });

  const correctionByFieldAndSource: IntakeFieldCorrectionStat[] = Array.from(sourceFieldCounts.entries()).map(([key, count]) => {
    const [rawSource, field] = key.split('::') as [string, IntakeReviewerFeedbackField];
    const source = rawSource as IntakeReviewerFeedback['source'];
    const total = sourceTotals.get(source) ?? 0;
    return {
      source: source as IntakeReviewerFeedback['source'],
      candidateType: 'all',
      field,
      count,
      total,
      rate: total ? count / total : 0,
    };
  }).sort((a, b) => b.rate - a.rate || b.count - a.count);

  const correctionByFieldAndCandidateType: IntakeFieldCorrectionStat[] = Array.from(candidateFieldCounts.entries()).map(([key, count]) => {
    const [candidateType, field] = key.split('::') as [string, IntakeReviewerFeedbackField];
    const total = candidateTotals.get(candidateType) ?? 0;
    return {
      source: 'all' as const,
      candidateType,
      field,
      count,
      total,
      rate: total ? count / total : 0,
    };
  }).sort((a, b) => b.rate - a.rate || b.count - a.count);

  const decisions: IntakeReviewerFeedbackDecision[] = ['approved_task', 'approved_followup', 'linked_existing', 'saved_reference', 'rejected'];
  const overridesByDecision = decisions.map((decision) => {
    const total = recentFeedback.filter((entry) => entry.finalDecision === decision).length;
    const count = recentFeedback.filter((entry) => entry.finalDecision === decision && entry.overrideApplied).length;
    return { finalDecision: decision, count, total, rate: total ? count / total : 0 };
  }).sort((a, b) => b.rate - a.rate || b.count - a.count);

  const ruleHits = forwardedRoutingAudit.flatMap((entry) => entry.ruleIds);
  const ruleQuality: IntakeRuleQualityStat[] = forwardedRules.map((rule) => {
    const hits = ruleHits.filter((ruleId) => ruleId === rule.id).length;
    const ruleFeedback = recentFeedback.filter((entry) => entry.ruleIds?.includes(rule.id));
    const approvals = ruleFeedback.filter((entry) => entry.finalDecision === 'approved_task' || entry.finalDecision === 'approved_followup').length;
    const rejectedOrReference = ruleFeedback.filter((entry) => entry.finalDecision === 'rejected' || entry.finalDecision === 'saved_reference').length;
    const overrides = ruleFeedback.filter((entry) => entry.overrideApplied).length;
    const noisySignalRate = hits > 0 ? (rejectedOrReference + overrides) / hits : 0;
    const reasons: string[] = [];
    if (hits < 3) reasons.push('Low sample size');
    if (rejectedOrReference >= 2) reasons.push('Produces frequent reject/reference outcomes');
    if (overrides >= 2) reasons.push('Requires frequent reviewer overrides');
    if (noisySignalRate >= 0.55) reasons.push('High noisy-signal ratio');
    const quality: IntakeRuleQuality = hits < 3 ? 'watch' : noisySignalRate >= 0.55 ? 'noisy' : noisySignalRate <= 0.22 ? 'strong' : 'watch';
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      hits,
      approvals,
      overrides,
      rejectedOrReference,
      quality,
      reasons,
      noisySignalRate,
    };
  }).sort((a, b) => b.hits - a.hits);

  const noisyRuleRate = ruleQuality.length ? ruleQuality.filter((entry) => entry.quality === 'noisy').length / ruleQuality.length : 0;
  const weakParseRate = (intakeWorkCandidates.filter((entry) => entry.confidence < 0.7).length + forwardedCandidates.filter((entry) => entry.parseQuality !== 'strong').length)
    / Math.max(intakeWorkCandidates.length + forwardedCandidates.length, 1);

  const trustPosture = classifyPosture({
    correctionRate: correctionRate.rate,
    overrideRate: overrideRate.rate,
    ruleNoisyRate: noisyRuleRate,
    linkInsteadOfCreateRate: linkInsteadOfCreateRate.rate,
  });

  const automationHealth = classifyAutomationHealth({
    correctionRate: correctionRate.rate,
    overrideRate: overrideRate.rate,
    rejectionOrReferenceRate: rejectionOrReferenceRate.rate,
    weakParseRate,
  });

  const dueDateCorrectionRate = correctionByFieldAndSource
    .filter((entry) => entry.field === 'dueDate')
    .reduce((max, entry) => Math.max(max, entry.rate), 0);
  const projectCorrectionRate = correctionByFieldAndSource
    .filter((entry) => entry.field === 'project')
    .reduce((max, entry) => Math.max(max, entry.rate), 0);

  const noisySources = correctionByFieldAndSource
    .filter((entry) => entry.rate >= 0.25)
    .map((entry) => entry.source)
    .filter((source): source is IntakeReviewerFeedback['source'] => source !== 'all');

  const forceReviewBySource: IntakeTuningThresholds['forceReviewBySource'] = {};
  noisySources.forEach((source) => { forceReviewBySource[source] = true; });
  if (forwardedCandidates.length > 0 && forwardedCandidates.filter((candidate) => candidate.parseQuality === 'weak').length / forwardedCandidates.length >= 0.35) {
    forceReviewBySource.forwarded_email = true;
  }

  const minimumReadyConfidence = clamp(0.75 + (projectCorrectionRate >= 0.2 ? 0.05 : 0) + (dueDateCorrectionRate >= 0.22 ? 0.04 : 0), 0.75, 0.9);
  const minimumBatchSafeConfidence = clamp(minimumReadyConfidence + 0.06 + (trustPosture === 'noisy' ? 0.04 : trustPosture === 'caution' ? 0.02 : 0), 0.82, 0.95);

  const directImportReadiness: IntakeTuningModel['directImportReadiness'] = (['quick_capture', 'universal_intake', 'forwarding', 'forwarded_email'] as const).map((source) => {
    const sourceCorrectionRate = correctionByFieldAndSource.filter((entry) => entry.source === source).reduce((max, entry) => Math.max(max, entry.rate), 0);
    if (forceReviewBySource[source]) {
      return { source, readiness: 'review_first', reason: 'Recent corrections indicate unstable parsing for this source.' };
    }
    if (sourceCorrectionRate >= 0.2) {
      return { source, readiness: 'watch', reason: 'Corrections are elevated; require stronger evidence before import.' };
    }
    return { source, readiness: 'ready', reason: 'Recent reviewer outcomes are stable for this source.' };
  });

  const routeToReviewPressure = directImportReadiness.map((entry) => ({
    source: entry.source,
    pressure: entry.readiness === 'review_first' ? 0.9 : entry.readiness === 'watch' ? 0.55 : 0.25,
    reason: entry.reason,
  }));

  const cautionFlags: string[] = [];
  if (dueDateCorrectionRate >= 0.22) cautionFlags.push('due_date_evidence_guard');
  if (projectCorrectionRate >= 0.2) cautionFlags.push('project_mapping_guard');
  if (linkInsteadOfCreateRate.rate >= 0.15) cautionFlags.push('duplicate_link_caution');
  if (ruleQuality.some((entry) => entry.quality === 'noisy')) cautionFlags.push('noisy_rule_pressure');

  const tuningSuggestions: string[] = [];
  if (cautionFlags.includes('due_date_evidence_guard')) tuningSuggestions.push('Due dates are frequently corrected. Require explicit date evidence before ready-now recommendations.');
  if (cautionFlags.includes('project_mapping_guard')) tuningSuggestions.push('Project mapping has elevated correction rates. Demote inferred project-only direct import paths.');
  if (cautionFlags.includes('duplicate_link_caution')) tuningSuggestions.push('Link-vs-create overrides are elevated. Strengthen duplicate caution and link-first messaging.');
  ruleQuality.filter((entry) => entry.quality === 'noisy').slice(0, 2).forEach((entry) => {
    tuningSuggestions.push(`Rule "${entry.ruleName}" is noisy (${Math.round(entry.noisySignalRate * 100)}% noisy signals). Consider review-first routing.`);
  });
  if (!tuningSuggestions.length) tuningSuggestions.push('Operational posture is stable. Keep monitoring for correction spikes.');

  const thresholds: IntakeTuningThresholds = {
    minimumReadyConfidence,
    minimumBatchSafeConfidence,
    requireStrongDueDateEvidence: cautionFlags.includes('due_date_evidence_guard'),
    requireStrongProjectEvidence: cautionFlags.includes('project_mapping_guard'),
    forceReviewBySource,
    duplicateCautionBoost: cautionFlags.includes('duplicate_link_caution') ? 1 : 0,
    noisyRuleIds: ruleQuality.filter((entry) => entry.quality === 'noisy').map((entry) => entry.ruleId),
  };

  return {
    trustPosture,
    automationHealth,
    recentFeedbackCount: feedbackCount,
    correctionRate,
    overrideRate,
    rejectionOrReferenceRate,
    linkInsteadOfCreateRate,
    duplicateRiskOverrideRate,
    correctionByFieldAndSource,
    correctionByFieldAndCandidateType,
    overridesByDecision,
    ruleQuality,
    routeToReviewPressure,
    directImportReadiness,
    thresholds,
    cautionFlags,
    tuningSuggestions,
  };
}
