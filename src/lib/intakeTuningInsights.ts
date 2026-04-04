import type { ForwardedEmailRule, ForwardedIntakeCandidate, ForwardedRoutingAuditEntry, IntakeReviewerFeedback, IntakeWorkCandidate } from '../types';
import { buildIntakeTuningModel, type IntakeAutomationHealth, type IntakeTrustPosture } from './intakeTuningModel';

type InsightChipTone = 'neutral' | 'warn' | 'danger' | 'success' | 'blue';

export interface IntakeInsightChip {
  label: string;
  value: string;
  tone?: InsightChipTone;
}

export interface IntakeRuleInsight {
  ruleId: string;
  ruleName: string;
  hits: number;
  approved: number;
  rejectedOrReference: number;
  overrides: number;
  quality: 'strong' | 'watch' | 'noisy';
  reason: string;
}

export interface IntakeTuningInsights {
  correctionHotspots: IntakeInsightChip[];
  overridePatterns: IntakeInsightChip[];
  weakParseHotspots: IntakeInsightChip[];
  qualitySummary: IntakeInsightChip[];
  ruleInsights: IntakeRuleInsight[];
  tuningSuggestions: string[];
  trustPosture: IntakeTrustPosture;
  automationHealth: IntakeAutomationHealth;
  directImportReadiness: Array<{ source: string; readiness: 'ready' | 'watch' | 'review_first'; reason: string }>;
  thresholds: {
    minimumReadyConfidence: number;
    minimumBatchSafeConfidence: number;
    requireStrongDueDateEvidence: boolean;
    requireStrongProjectEvidence: boolean;
    duplicateCautionBoost: number;
  };
}

function toLabel(field: string): string {
  const labels: Record<string, string> = {
    type: 'Type changed',
    project: 'Project corrected',
    owner: 'Owner corrected',
    dueDate: 'Due date corrected',
    title: 'Title corrected',
    nextStep: 'Next step corrected',
    linking_decision: 'Linked instead of create-new',
  };
  return labels[field] ?? field;
}

function toneFromReadiness(readiness: 'ready' | 'watch' | 'review_first'): InsightChipTone {
  if (readiness === 'ready') return 'success';
  if (readiness === 'watch') return 'warn';
  return 'danger';
}

export function buildIntakeTuningInsights(input: {
  intakeWorkCandidates: IntakeWorkCandidate[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  forwardedRules: ForwardedEmailRule[];
  forwardedRoutingAudit: ForwardedRoutingAuditEntry[];
  feedback: IntakeReviewerFeedback[];
}): IntakeTuningInsights {
  const model = buildIntakeTuningModel(input);

  const correctionHotspots = model.correctionByFieldAndSource
    .slice(0, 5)
    .map((entry) => ({
      label: `${toLabel(entry.field)} (${entry.source.replace(/_/g, ' ')})`,
      value: `${Math.round(entry.rate * 100)}% (${entry.count}/${entry.total || 1})`,
      tone: (entry.rate >= 0.3 ? 'danger' : entry.rate >= 0.18 ? 'warn' : 'neutral') as InsightChipTone,
    }));

  const overridePatterns = model.overridesByDecision
    .slice(0, 4)
    .map((entry) => ({
      label: entry.finalDecision.replace(/_/g, ' '),
      value: `${Math.round(entry.rate * 100)}% (${entry.count}/${entry.total || 1})`,
      tone: (entry.rate >= 0.28 ? 'danger' : entry.rate >= 0.15 ? 'warn' : 'neutral') as InsightChipTone,
    }));

  const weakParseHotspots: IntakeInsightChip[] = [
    {
      label: 'Due-date correction pressure',
      value: `${Math.round((model.correctionByFieldAndSource.find((entry) => entry.field === 'dueDate')?.rate ?? 0) * 100)}%`,
      tone: model.thresholds.requireStrongDueDateEvidence ? 'warn' : 'neutral',
    },
    {
      label: 'Project-map correction pressure',
      value: `${Math.round((model.correctionByFieldAndSource.find((entry) => entry.field === 'project')?.rate ?? 0) * 100)}%`,
      tone: model.thresholds.requireStrongProjectEvidence ? 'warn' : 'neutral',
    },
    {
      label: 'Link over create frequency',
      value: `${Math.round(model.linkInsteadOfCreateRate.rate * 100)}%`,
      tone: model.thresholds.duplicateCautionBoost ? 'danger' : 'blue',
    },
  ];

  const qualitySummary: IntakeInsightChip[] = [
    { label: 'Trust posture', value: model.trustPosture, tone: model.trustPosture === 'stable' ? 'success' : model.trustPosture === 'caution' ? 'warn' : 'danger' },
    { label: 'Automation health', value: model.automationHealth, tone: model.automationHealth === 'strong' ? 'success' : model.automationHealth === 'watch' ? 'warn' : 'danger' },
    { label: 'Ready-now minimum confidence', value: model.thresholds.minimumReadyConfidence.toFixed(2), tone: 'blue' },
    { label: 'Batch-safe minimum confidence', value: model.thresholds.minimumBatchSafeConfidence.toFixed(2), tone: 'blue' },
  ];

  const ruleInsights: IntakeRuleInsight[] = model.ruleQuality.map((rule) => ({
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    hits: rule.hits,
    approved: rule.approvals,
    rejectedOrReference: rule.rejectedOrReference,
    overrides: rule.overrides,
    quality: rule.quality,
    reason: rule.reasons[0] ?? 'No friction signals.',
  }));

  const directImportReadiness = model.directImportReadiness.map((entry) => ({ ...entry, source: entry.source.replace(/_/g, ' ') }));

  return {
    correctionHotspots,
    overridePatterns,
    weakParseHotspots,
    qualitySummary,
    ruleInsights,
    tuningSuggestions: model.tuningSuggestions,
    trustPosture: model.trustPosture,
    automationHealth: model.automationHealth,
    directImportReadiness,
    thresholds: {
      minimumReadyConfidence: model.thresholds.minimumReadyConfidence,
      minimumBatchSafeConfidence: model.thresholds.minimumBatchSafeConfidence,
      requireStrongDueDateEvidence: model.thresholds.requireStrongDueDateEvidence,
      requireStrongProjectEvidence: model.thresholds.requireStrongProjectEvidence,
      duplicateCautionBoost: model.thresholds.duplicateCautionBoost,
    },
  };
}

export { toneFromReadiness };
