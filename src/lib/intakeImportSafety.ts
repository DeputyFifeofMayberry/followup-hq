import type { ForwardedIntakeCandidate, IntakeExistingMatch, IntakeWorkCandidate } from '../types';

export type DuplicateRiskLevel = 'low' | 'medium' | 'high';
export type IntakeDecisionMode = 'create_new_task' | 'create_new_followup' | 'link_existing' | 'duplicate_update_review' | 'save_reference' | 'reject';

export interface ImportSafetyChecklistItem {
  key: 'duplicate' | 'existing_match' | 'core_fields' | 'confidence' | 'type_conflict' | 'already_finalized';
  label: string;
  pass: boolean;
  severity: 'warn' | 'blocker';
  detail?: string;
}

export interface ImportSafetyResult {
  safeToCreateNew: boolean;
  safeToBatchApprove: boolean;
  requiresLinkReview: boolean;
  duplicateRiskLevel: DuplicateRiskLevel;
  recommendedDecision: IntakeDecisionMode;
  warnings: string[];
  blockers: string[];
  overrideAllowed: boolean;
  checklist: ImportSafetyChecklistItem[];
  strongMatches: IntakeExistingMatch[];
  weakMatches: IntakeExistingMatch[];
  batchExclusionReasons: string[];
}

const CONFLICT_PATTERN = /conflict|ambiguous|mismatch|unclear/i;

function classifyDuplicateRisk(matches: IntakeExistingMatch[], hasDuplicateWarnings: boolean): DuplicateRiskLevel {
  const topScore = matches[0]?.score ?? 0;
  const hasStrongDuplicate = matches.some((match) => match.score >= 0.87 || match.strategy === 'duplicate');
  if (hasDuplicateWarnings || hasStrongDuplicate || topScore >= 0.9) return 'high';
  if (topScore >= 0.75 || matches.some((match) => match.strategy === 'update' || match.strategy === 'link')) return 'medium';
  return 'low';
}

function splitMatchStrength(matches: IntakeExistingMatch[]) {
  return {
    strongMatches: matches.filter((match) => match.score >= 0.78),
    weakMatches: matches.filter((match) => match.score < 0.78),
  };
}

export function evaluateIntakeImportSafety(candidate: IntakeWorkCandidate): ImportSafetyResult {
  const allMatches = [...candidate.duplicateMatches, ...candidate.existingRecordMatches].sort((a, b) => b.score - a.score);
  const { strongMatches, weakMatches } = splitMatchStrength(allMatches);
  const duplicateRiskLevel = classifyDuplicateRisk(allMatches, false);
  const hasTypeConflict = candidate.warnings.some((warning) => CONFLICT_PATTERN.test(warning));
  const missingCore = !candidate.title?.trim() || !candidate.project?.trim();
  const lowConfidence = candidate.confidence < 0.7;
  const finalized = candidate.approvalStatus !== 'pending';
  const requiresLinkReview = strongMatches.length > 0 || duplicateRiskLevel !== 'low';

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (duplicateRiskLevel === 'high') blockers.push('Strong duplicate risk: review existing matches before creating new work.');
  else if (duplicateRiskLevel === 'medium') warnings.push('Likely update to existing record.');

  if (requiresLinkReview) warnings.push('Existing-record match found: link existing should be reviewed first.');
  if (missingCore) blockers.push('Critical fields missing (title/project).');
  if (lowConfidence) warnings.push('Low confidence on core fields; reviewer confirmation needed.');
  if (hasTypeConflict) blockers.push('Conflicting candidate type/evidence detected.');
  if (finalized) blockers.push('Candidate already finalized (imported/linked/reference/rejected).');

  const safeToCreateNew = blockers.length === 0 && duplicateRiskLevel === 'low';
  const safeToBatchApprove = safeToCreateNew && candidate.confidence >= 0.9 && candidate.suggestedAction === 'create_new';
  const overrideAllowed = !finalized;

  const recommendedDecision: IntakeDecisionMode = strongMatches.length > 0
    ? 'link_existing'
    : duplicateRiskLevel !== 'low'
      ? 'duplicate_update_review'
      : candidate.candidateType === 'reference' || candidate.suggestedAction === 'reference_only'
        ? 'save_reference'
        : candidate.candidateType.includes('task')
          ? 'create_new_task'
          : 'create_new_followup';

  const checklist: ImportSafetyChecklistItem[] = [
    { key: 'duplicate', label: 'No strong duplicate match', pass: duplicateRiskLevel === 'low', severity: duplicateRiskLevel === 'high' ? 'blocker' : 'warn' },
    { key: 'existing_match', label: 'No strong existing-record overlap', pass: strongMatches.length === 0, severity: 'warn' },
    { key: 'core_fields', label: 'Core fields present (title + project)', pass: !missingCore, severity: 'blocker' },
    { key: 'confidence', label: 'Acceptable confidence on core fields', pass: !lowConfidence, severity: 'warn' },
    { key: 'type_conflict', label: 'No conflicting type signals', pass: !hasTypeConflict, severity: 'blocker' },
    { key: 'already_finalized', label: 'Not already imported/linked', pass: !finalized, severity: 'blocker' },
  ];

  const batchExclusionReasons = [
    ...(safeToBatchApprove ? [] : ['Excluded from batch approval: duplicate/link review required or safety checks failed.']),
    ...checklist.filter((item) => !item.pass).map((item) => item.label),
  ];

  return {
    safeToCreateNew,
    safeToBatchApprove,
    requiresLinkReview,
    duplicateRiskLevel,
    recommendedDecision,
    warnings,
    blockers,
    overrideAllowed,
    checklist,
    strongMatches,
    weakMatches,
    batchExclusionReasons,
  };
}

export function evaluateForwardedImportSafety(candidate: ForwardedIntakeCandidate): ImportSafetyResult {
  const duplicateRiskLevel = candidate.duplicateWarnings.length > 0 ? 'high' : candidate.warnings.some((warning) => /possible duplicate|similar existing/i.test(warning)) ? 'medium' : 'low';
  const hasTypeConflict = candidate.warnings.some((warning) => CONFLICT_PATTERN.test(warning));
  const missingCore = !candidate.normalizedSubject?.trim() || !candidate.parsedProject?.trim();
  const lowConfidence = candidate.confidence < 0.72 || candidate.parseQuality === 'weak';
  const finalized = candidate.status !== 'pending';

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (duplicateRiskLevel === 'high') blockers.push('Strong duplicate risk: review existing matches before creating new work.');
  if (duplicateRiskLevel === 'medium') warnings.push('Possible duplicate/update signal in forwarded message.');
  if (missingCore) blockers.push('Critical fields missing (subject/project).');
  if (lowConfidence) warnings.push('Forwarded parse is weak; review before creating new work.');
  if (hasTypeConflict) blockers.push('Conflicting candidate type/evidence detected.');
  if (finalized) blockers.push('Candidate already finalized.');

  const safeToCreateNew = blockers.length === 0 && duplicateRiskLevel === 'low';
  const safeToBatchApprove = safeToCreateNew && candidate.confidence >= 0.9 && candidate.parseQuality === 'strong' && candidate.suggestedType !== 'reference';
  const recommendedDecision: IntakeDecisionMode = duplicateRiskLevel !== 'low'
    ? 'duplicate_update_review'
    : candidate.suggestedType === 'reference'
      ? 'save_reference'
      : candidate.suggestedType === 'task'
        ? 'create_new_task'
        : 'create_new_followup';

  const checklist: ImportSafetyChecklistItem[] = [
    { key: 'duplicate', label: 'No duplicate warning flags', pass: duplicateRiskLevel === 'low', severity: duplicateRiskLevel === 'high' ? 'blocker' : 'warn' },
    { key: 'core_fields', label: 'Core fields present (subject + project)', pass: !missingCore, severity: 'blocker' },
    { key: 'confidence', label: 'Acceptable parser confidence', pass: !lowConfidence, severity: 'warn' },
    { key: 'type_conflict', label: 'No conflicting type signals', pass: !hasTypeConflict, severity: 'blocker' },
    { key: 'already_finalized', label: 'Not already imported/linked', pass: !finalized, severity: 'blocker' },
    { key: 'existing_match', label: 'Link review available if needed', pass: true, severity: 'warn', detail: 'Use Link existing when subject overlaps an open record.' },
  ];

  const batchExclusionReasons = [
    ...(safeToBatchApprove ? [] : ['Excluded from batch approval: duplicate/link review required.']),
    ...checklist.filter((item) => !item.pass).map((item) => item.label),
  ];

  return {
    safeToCreateNew,
    safeToBatchApprove,
    requiresLinkReview: duplicateRiskLevel !== 'low',
    duplicateRiskLevel,
    recommendedDecision,
    warnings,
    blockers,
    overrideAllowed: !finalized,
    checklist,
    strongMatches: [],
    weakMatches: [],
    batchExclusionReasons,
  };
}

export function describeFinalizedOutcome(input: { approvalStatus?: string; createdRecordId?: string; linkedRecordId?: string; status?: string; createdTaskId?: string; createdFollowUpId?: string; linkedItemId?: string }) {
  if (input.approvalStatus === 'imported' && input.createdRecordId) return `Imported new record (${input.createdRecordId})`;
  if (input.approvalStatus === 'linked' && input.linkedRecordId) return `Linked existing record (${input.linkedRecordId})`;
  if (input.approvalStatus === 'reference') return 'Saved as reference';
  if (input.approvalStatus === 'rejected') return 'Rejected';
  if (input.status === 'approved' && input.createdTaskId) return `Imported task (${input.createdTaskId})`;
  if (input.status === 'approved' && input.createdFollowUpId) return `Imported follow-up (${input.createdFollowUpId})`;
  if (input.status === 'linked' && input.linkedItemId) return `Linked existing record (${input.linkedItemId})`;
  if (input.status === 'reference') return 'Saved as reference';
  if (input.status === 'rejected') return 'Rejected';
  return 'Pending review';
}
