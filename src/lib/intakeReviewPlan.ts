import { buildReviewerActionHints, type IntakeFieldReview, type IntakeFieldReviewSummary } from './intakeEvidence';
import type { ImportSafetyResult, IntakeDecisionMode } from './intakeImportSafety';
import type { IntakeQueueItem } from './intakeReviewQueue';
import type { IntakeWorkCandidate } from '../types';

export type IntakeSuggestionField = 'project' | 'owner' | 'assignee' | 'dueDate' | 'title' | 'nextStep' | 'candidateType';

export interface IntakeFieldSuggestion {
  field: IntakeSuggestionField;
  value: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  source: 'match' | 'evidence' | 'candidate_context' | 'title_cleanup' | 'summary';
}

export interface IntakeQuickFixAction {
  id: string;
  label: string;
  kind: 'apply_suggestion' | 'link_best_match' | 'save_reference' | 'keep_new_record';
  suggestion?: IntakeFieldSuggestion;
  reason: string;
  emphasis?: 'primary' | 'neutral' | 'danger';
}

export interface IntakeReviewPlan {
  requiredCorrections: IntakeFieldReview[];
  recommendedCorrections: IntakeFieldReview[];
  optionalFields: IntakeFieldReview[];
  suggestedDecision: IntakeDecisionMode;
  suggestedDecisionReason: string;
  fastApproveEligible: boolean;
  quickFixActions: IntakeQuickFixAction[];
  duplicateReviewPriority: 'high' | 'medium' | 'low';
  reviewerBurdenScore: number;
}

const REQUIRED_KEYS = new Set(['type', 'title', 'project']);

function fieldIsRequired(field: IntakeFieldReview, safety: ImportSafetyResult): boolean {
  if (field.status === 'conflicting') return true;
  if (field.status === 'missing' && field.key !== 'existingLink') return true;
  if (REQUIRED_KEYS.has(field.key)) return field.status !== 'strong';
  if (field.key === 'owner') return field.status !== 'strong' && !safety.checklist.find((item) => item.key === 'core_fields')?.pass;
  if (field.key === 'dueDate') return field.status === 'weak';
  return false;
}

function toDecisionReason(mode: IntakeDecisionMode, queueItem: IntakeQueueItem, safety: ImportSafetyResult): string {
  if (mode === 'link_existing') return 'A strong existing record match was detected. Linking is safer than create-new.';
  if (mode === 'duplicate_update_review') return `Duplicate risk is ${safety.duplicateRiskLevel}; compare and link before creating.`;
  if (mode === 'save_reference') return 'Signals look informational; save as reference unless explicit work is required.';
  if (mode === 'reject') return 'Safety blockers remain unresolved.';
  if (queueItem.readiness === 'ready_to_approve') return 'All critical checks are green for a fast approval path.';
  return 'Apply required corrections first, then approve using the recommended type.';
}

function cleanupTitle(title: string): string {
  return title
    .replace(/^(re:|fw:|fwd:)\s*/gi, '')
    .replace(/\[(task|followup|reference)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDateCandidate(evidence: IntakeWorkCandidate['evidence']): string | null {
  const dueEvidence = evidence
    .filter((entry) => entry.field.toLowerCase() === 'duedate')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const text = dueEvidence[0]?.snippet;
  if (!text) return null;
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1] ?? null;
}

export function buildCandidateFieldSuggestions(candidate: IntakeWorkCandidate, summary: IntakeFieldReviewSummary, safety: ImportSafetyResult): IntakeFieldSuggestion[] {
  const suggestions: IntakeFieldSuggestion[] = [];
  const topMatch = candidate.existingRecordMatches[0];
  const projectField = summary.priorityReviewFields.find((field) => field.key === 'project');
  const ownerField = summary.priorityReviewFields.find((field) => field.key === 'owner');
  const dueDateField = summary.priorityReviewFields.find((field) => field.key === 'dueDate');
  const typeField = summary.priorityReviewFields.find((field) => field.key === 'type');

  if (projectField && ['missing', 'weak'].includes(projectField.status) && topMatch?.project) {
    suggestions.push({
      field: 'project',
      value: topMatch.project,
      confidence: topMatch.score >= 0.87 ? 'high' : 'medium',
      reason: `Top match (${topMatch.score.toFixed(2)}) uses project ${topMatch.project}.`,
      source: 'match',
    });
  }

  if (ownerField && ['missing', 'weak'].includes(ownerField.status) && candidate.assignee?.trim()) {
    suggestions.push({
      field: 'owner',
      value: candidate.assignee,
      confidence: 'medium',
      reason: 'Assignee is present but owner is missing.',
      source: 'candidate_context',
    });
  }

  const cleanedTitle = cleanupTitle(candidate.title || '');
  if (cleanedTitle && cleanedTitle !== (candidate.title || '').trim() && cleanedTitle.length >= 6) {
    suggestions.push({
      field: 'title',
      value: cleanedTitle,
      confidence: 'medium',
      reason: 'Removed noisy forwarding/type tokens from title.',
      source: 'title_cleanup',
    });
  }

  if (dueDateField && ['missing', 'weak'].includes(dueDateField.status) && !candidate.dueDate) {
    const dueCandidate = findDateCandidate(candidate.evidence);
    if (dueCandidate) {
      suggestions.push({
        field: 'dueDate',
        value: dueCandidate,
        confidence: 'low',
        reason: 'One due date candidate was detected in evidence snippets.',
        source: 'evidence',
      });
    }
  }

  if ((!candidate.nextStep || candidate.nextStep.trim().length < 4) && candidate.summary.trim().length > 12) {
    const firstSentence = candidate.summary.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length >= 8) {
      suggestions.push({
        field: 'nextStep',
        value: firstSentence,
        confidence: 'low',
        reason: 'Derived from the first sentence of summary text.',
        source: 'summary',
      });
    }
  }

  if (typeField && ['weak', 'conflicting'].includes(typeField.status) && safety.recommendedDecision !== 'save_reference') {
    const suggestedType = safety.recommendedDecision === 'create_new_task' ? 'task' : 'followup';
    suggestions.push({
      field: 'candidateType',
      value: suggestedType,
      confidence: 'medium',
      reason: `Safety analysis leans ${suggestedType} for create-new decisioning.`,
      source: 'candidate_context',
    });
  }

  return suggestions;
}

export function buildIntakeReviewPlan(input: {
  queueItem: IntakeQueueItem;
  fieldSummary: IntakeFieldReviewSummary;
  safety: ImportSafetyResult;
  suggestions?: IntakeFieldSuggestion[];
  tuningPressure?: boolean;
}): IntakeReviewPlan {
  const actionable = buildReviewerActionHints(input.fieldSummary, 20).map((hint) => hint.field);
  const requiredCorrections = actionable.filter((field, idx, arr) => arr.findIndex((entry) => entry.key === field.key) === idx).filter((field) => fieldIsRequired(field, input.safety));
  const recommendedCorrections = actionable.filter((field) => !requiredCorrections.some((required) => required.key === field.key));
  const optionalFields = input.fieldSummary.medium.filter((field) => !requiredCorrections.some((required) => required.key === field.key) && !recommendedCorrections.some((recommended) => recommended.key === field.key));

  const quickFixActions: IntakeQuickFixAction[] = (input.suggestions ?? []).map((suggestion) => ({
    id: `suggestion-${suggestion.field}`,
    kind: 'apply_suggestion',
    label: suggestion.field === 'candidateType' ? 'Use recommended type' : `Use suggested ${suggestion.field === 'dueDate' ? 'due date' : suggestion.field}`,
    suggestion,
    reason: suggestion.reason,
  }));

  if (input.safety.duplicateRiskLevel === 'high' || input.safety.strongMatches.length > 0) {
    quickFixActions.unshift({
      id: 'link-best-match',
      kind: 'link_best_match',
      label: 'Link best match',
      reason: 'Existing-record overlap is strong; linking is the safer path.',
      emphasis: 'primary',
    });
    quickFixActions.push({
      id: 'save-reference',
      kind: 'save_reference',
      label: 'Save as reference',
      reason: 'Use reference when create-new remains risky.',
      emphasis: 'neutral',
    });
  } else {
    quickFixActions.push({
      id: 'keep-new',
      kind: 'keep_new_record',
      label: 'Keep as new record',
      reason: 'Duplicate risk is low after required corrections.',
      emphasis: 'neutral',
    });
  }

  const fastApproveEligible = input.queueItem.readiness === 'ready_to_approve'
    && input.safety.safeToCreateNew
    && input.safety.duplicateRiskLevel === 'low'
    && requiredCorrections.length === 0
    && !input.tuningPressure;

  const reviewerBurdenScore = Math.min(100, (requiredCorrections.length * 20)
    + (recommendedCorrections.length * 8)
    + (input.safety.duplicateRiskLevel === 'high' ? 25 : input.safety.duplicateRiskLevel === 'medium' ? 12 : 0)
    + (input.queueItem.readiness === 'unsafe_to_create' ? 25 : 0));

  return {
    requiredCorrections,
    recommendedCorrections,
    optionalFields,
    suggestedDecision: input.safety.recommendedDecision,
    suggestedDecisionReason: toDecisionReason(input.safety.recommendedDecision, input.queueItem, input.safety),
    fastApproveEligible,
    quickFixActions,
    duplicateReviewPriority: input.safety.duplicateRiskLevel,
    reviewerBurdenScore,
  };
}
