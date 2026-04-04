import type { ForwardedEmailRule, ForwardedIntakeCandidate, ForwardedRoutingAuditEntry, IntakeReviewerFeedback, IntakeWorkCandidate } from '../types';

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
}

export interface IntakeTuningInsights {
  correctionHotspots: IntakeInsightChip[];
  overridePatterns: IntakeInsightChip[];
  weakParseHotspots: IntakeInsightChip[];
  qualitySummary: IntakeInsightChip[];
  ruleInsights: IntakeRuleInsight[];
  tuningSuggestions: string[];
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

function countBy<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function buildIntakeTuningInsights(input: {
  intakeWorkCandidates: IntakeWorkCandidate[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  forwardedRules: ForwardedEmailRule[];
  forwardedRoutingAudit: ForwardedRoutingAuditEntry[];
  feedback: IntakeReviewerFeedback[];
}): IntakeTuningInsights {
  const { intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, feedback } = input;
  const recentFeedback = feedback.slice(0, 250);

  const correctionHotspots = countBy(recentFeedback.flatMap((entry) => entry.correctedFields))
    .slice(0, 5)
    .map((entry) => ({
      label: toLabel(entry.key),
      value: `${entry.count}`,
      tone: entry.count >= 5 ? 'warn' : 'neutral',
    }));

  const overridePatterns = countBy(
    recentFeedback
      .filter((entry) => entry.overrideApplied)
      .map((entry) => entry.finalDecision),
  )
    .slice(0, 4)
    .map((entry) => ({ label: entry.key.replace(/_/g, ' '), value: `${entry.count}`, tone: entry.count >= 4 ? 'warn' : 'neutral' }));

  const weakParseHotspots: IntakeInsightChip[] = [
    {
      label: 'Universal intake weak confidence',
      value: `${intakeWorkCandidates.filter((candidate) => candidate.confidence < 0.7 && candidate.approvalStatus === 'pending').length}`,
      tone: 'warn',
    },
    {
      label: 'Forwarded weak parses',
      value: `${forwardedCandidates.filter((candidate) => candidate.parseQuality !== 'strong').length}`,
      tone: 'warn',
    },
    {
      label: 'Create-new overridden by linking',
      value: `${recentFeedback.filter((entry) => entry.correctedFields.includes('linking_decision')).length}`,
      tone: 'danger',
    },
  ];

  const qualitySummary: IntakeInsightChip[] = [
    { label: 'Pending review', value: `${intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending').length + forwardedCandidates.filter((entry) => entry.status === 'pending').length}`, tone: 'warn' },
    { label: 'Recent overrides', value: `${recentFeedback.filter((entry) => entry.overrideApplied).length}`, tone: 'blue' },
    { label: 'Rejected / reference (recent)', value: `${recentFeedback.filter((entry) => entry.finalDecision === 'rejected' || entry.finalDecision === 'saved_reference').length}`, tone: 'neutral' },
  ];

  const auditRuleHits = forwardedRoutingAudit.flatMap((audit) => audit.ruleIds);
  const ruleInsights: IntakeRuleInsight[] = forwardedRules.map((rule) => {
    const hits = auditRuleHits.filter((ruleId) => ruleId === rule.id).length;
    const ruleFeedback = recentFeedback.filter((entry) => entry.ruleIds?.includes(rule.id));
    const approved = ruleFeedback.filter((entry) => entry.finalDecision === 'approved_task' || entry.finalDecision === 'approved_followup').length;
    const rejectedOrReference = ruleFeedback.filter((entry) => entry.finalDecision === 'rejected' || entry.finalDecision === 'saved_reference').length;
    const overrides = ruleFeedback.filter((entry) => entry.overrideApplied).length;
    const noisyRatio = hits ? (rejectedOrReference + overrides) / hits : 0;
    const quality: IntakeRuleInsight['quality'] = hits < 2 ? 'watch' : noisyRatio >= 0.6 ? 'noisy' : noisyRatio <= 0.2 ? 'strong' : 'watch';
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      hits,
      approved,
      rejectedOrReference,
      overrides,
      quality,
    };
  }).sort((a, b) => b.hits - a.hits);

  const tuningSuggestions: string[] = [];
  if (correctionHotspots.some((entry) => entry.label === 'Project corrected' && Number(entry.value) >= 3)) {
    tuningSuggestions.push('Project mapping is frequently corrected. Add sender/domain project hints or lower auto-create confidence.');
  }
  if (correctionHotspots.some((entry) => entry.label === 'Due date corrected' && Number(entry.value) >= 3)) {
    tuningSuggestions.push('Due dates are often corrected. Prefer review-first for sources missing explicit date language.');
  }
  const noisyRules = ruleInsights.filter((rule) => rule.quality === 'noisy').slice(0, 2);
  noisyRules.forEach((rule) => tuningSuggestions.push(`Rule “${rule.ruleName}” may be too aggressive (${rule.rejectedOrReference + rule.overrides}/${Math.max(rule.hits, 1)} noisy signals).`));

  if (!tuningSuggestions.length) {
    tuningSuggestions.push('No major friction spike detected. Keep monitoring correction hotspots and override trends.');
  }

  return { correctionHotspots, overridePatterns, weakParseHotspots, qualitySummary, ruleInsights, tuningSuggestions };
}
