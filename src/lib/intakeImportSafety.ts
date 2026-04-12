import type { ForwardedIntakeCandidate, IntakeExistingMatch, IntakeWorkCandidate } from '../types';
import { resolveCandidateAdmissionState } from './intakeAdmission';

export type DuplicateRiskLevel = 'low' | 'medium' | 'high';
export type IntakeDecisionMode = 'create_new_task' | 'create_new_followup' | 'link_existing' | 'duplicate_update_review' | 'save_reference' | 'reject';
export type IntakeEvidenceStrength = 'strong' | 'medium' | 'weak' | 'missing' | 'conflicting';
export type IntakeCriticalFieldKey = 'title' | 'type' | 'project' | 'owner' | 'dueDate' | 'existingLink';

export interface CriticalFieldAssessment {
  key: IntakeCriticalFieldKey;
  strength: IntakeEvidenceStrength;
  confidence?: number;
  reason: string;
}

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
  criticalFieldAssessments: CriticalFieldAssessment[];
  createNewBlockers: string[];
  createNewWarnings: string[];
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

function fieldConfidence(candidate: IntakeWorkCandidate, key: 'title' | 'type' | 'project' | 'owner' | 'dueDate'): number {
  if (key === 'type') return candidate.fieldConfidence?.type ?? candidate.confidence;
  return candidate.fieldConfidence?.[key] ?? candidate.confidence;
}

function evidenceSignals(candidate: IntakeWorkCandidate, field: 'title' | 'type' | 'project' | 'owner' | 'dueDate') {
  const entries = candidate.evidence.filter((entry) => entry.field.toLowerCase() === field.toLowerCase());
  const topScore = entries.reduce((max, entry) => Math.max(max, entry.score ?? 0), 0);
  const hasTextEvidence = entries.some((entry) => entry.sourceType === 'text' || entry.sourceType === 'email_body' || entry.sourceType === 'docx_paragraph');
  return { entries, topScore, hasTextEvidence };
}

function classifyFieldStrength(candidate: IntakeWorkCandidate, key: CriticalFieldAssessment['key']): CriticalFieldAssessment {
  if (key === 'existingLink') {
    const topMatch = candidate.existingRecordMatches[0];
    if (!topMatch) return { key, strength: 'missing', reason: 'No meaningful existing-record overlap detected.' };
    if (topMatch.score >= 0.9 || topMatch.strategy === 'duplicate') return { key, strength: 'conflicting', confidence: topMatch.score, reason: 'Strong overlap suggests link/update instead of create-new.' };
    if (topMatch.score >= 0.82) return { key, strength: 'weak', confidence: topMatch.score, reason: 'Moderate overlap should be reviewed before creating new.' };
    return { key, strength: 'medium', confidence: topMatch.score, reason: 'Low overlap present but not a strong blocker.' };
  }

  const value = key === 'type'
    ? candidate.candidateType
    : key === 'owner'
      ? (candidate.owner || candidate.assignee)
      : candidate[key];
  const confidence = fieldConfidence(candidate, key as 'title' | 'type' | 'project' | 'owner' | 'dueDate');
  const conflictFlag = candidate.warnings.some((warning) => CONFLICT_PATTERN.test(warning) && new RegExp(key, 'i').test(warning));
  if (!value || !String(value).trim()) return { key, strength: 'missing', confidence, reason: `${key} is unresolved.` };
  if (conflictFlag) return { key, strength: 'conflicting', confidence, reason: `${key} has conflicting extracted signals.` };

  const evidence = evidenceSignals(candidate, key as 'title' | 'type' | 'project' | 'owner' | 'dueDate');
  const inferredDueDate = key === 'dueDate'
    && candidate.warnings.some((warning) => /due date inferred from body text/i.test(warning))
    && evidence.topScore < 0.82;
  if (inferredDueDate) return { key, strength: 'weak', confidence, reason: 'Due date is inferred from body text with weak evidence.' };

  if (confidence >= 0.88 && (evidence.topScore >= 0.8 || key === 'type' || key === 'title')) return { key, strength: 'strong', confidence, reason: `${key} has strong explicit signal.` };
  if (confidence >= 0.72 && (evidence.topScore >= 0.6 || evidence.hasTextEvidence || key === 'title')) return { key, strength: 'medium', confidence, reason: `${key} has acceptable but reviewable evidence.` };
  if (confidence >= 0.45) return { key, strength: 'weak', confidence, reason: `${key} appears inferred with weak confidence.` };
  return { key, strength: 'missing', confidence, reason: `${key} confidence is too low to trust.` };
}

export function evaluateIntakeImportSafety(candidate: IntakeWorkCandidate): ImportSafetyResult {
  const admissionState = resolveCandidateAdmissionState(candidate);
  const allMatches = [...candidate.duplicateMatches, ...candidate.existingRecordMatches].sort((a, b) => b.score - a.score);
  const { strongMatches, weakMatches } = splitMatchStrength(allMatches);
  const duplicateRiskLevel = classifyDuplicateRisk(allMatches, false);
  const hasTypeConflict = candidate.warnings.some((warning) => CONFLICT_PATTERN.test(warning));
  const criticalFieldKeys: IntakeCriticalFieldKey[] = ['title', 'type', 'project', 'owner', 'dueDate', 'existingLink'];
  const criticalFieldAssessments: CriticalFieldAssessment[] = criticalFieldKeys.map((key) => classifyFieldStrength(candidate, key));
  const assessmentByKey = new Map(criticalFieldAssessments.map((assessment) => [assessment.key, assessment]));
  const missingCore = ['title', 'project', 'type'].some((key) => ['missing', 'weak', 'conflicting'].includes(assessmentByKey.get(key as IntakeCriticalFieldKey)?.strength ?? 'missing'));
  const weakExecutionFields = ['owner', 'dueDate'].filter((key) => ['missing', 'weak', 'conflicting'].includes(assessmentByKey.get(key as IntakeCriticalFieldKey)?.strength ?? 'missing'));
  const lowConfidence = candidate.confidence < 0.7;
  const finalized = candidate.approvalStatus !== 'pending';
  const requiresLinkReview = strongMatches.length > 0 || duplicateRiskLevel !== 'low' || ['weak', 'conflicting'].includes(assessmentByKey.get('existingLink')?.strength ?? 'missing');

  const warnings: string[] = [];
  const blockers: string[] = [];
  const createNewBlockers: string[] = [];
  const createNewWarnings: string[] = [];

  if (duplicateRiskLevel === 'high') {
    blockers.push('Strong duplicate risk: review existing matches before creating new work.');
    createNewBlockers.push('Duplicate/link overlap is high.');
  } else if (duplicateRiskLevel === 'medium') {
    warnings.push('Likely update to existing record.');
    createNewWarnings.push('Duplicate/link overlap is medium.');
  }

  if (requiresLinkReview) warnings.push('Existing-record match found: link existing should be reviewed first.');
  if (admissionState !== 'action_ready') {
    blockers.push(`Candidate admission is ${admissionState.replace('_', ' ')}; strengthen evidence before create-new.`);
    createNewBlockers.push('Admission gate blocks create-new until candidate is action-ready.');
  }
  if (missingCore) {
    blockers.push('Critical create-new fields are weak or missing (type/title/project).');
    createNewBlockers.push('Type, title, and project must be medium+ confidence before create-new.');
  }
  if (weakExecutionFields.length > 0) {
    warnings.push(`Execution fields need review (${weakExecutionFields.join(', ')}).`);
    createNewWarnings.push(`Execution fields are unresolved or weak: ${weakExecutionFields.join(', ')}.`);
  }
  if (lowConfidence) warnings.push('Low confidence on core fields; reviewer confirmation needed.');
  if (hasTypeConflict) blockers.push('Conflicting candidate type/evidence detected.');
  if (finalized) blockers.push('Candidate already finalized (imported/linked/reference/rejected).');

  const safeToCreateNew = blockers.length === 0
    && duplicateRiskLevel === 'low'
    && weakExecutionFields.length === 0
    && ['strong', 'medium'].includes(assessmentByKey.get('title')?.strength ?? 'missing')
    && ['strong', 'medium'].includes(assessmentByKey.get('type')?.strength ?? 'missing')
    && ['strong', 'medium'].includes(assessmentByKey.get('project')?.strength ?? 'missing');
  const safeToBatchApprove = safeToCreateNew
    && candidate.confidence >= 0.92
    && candidate.suggestedAction === 'create_new'
    && ['title', 'type', 'project', 'owner', 'dueDate'].every((key) => assessmentByKey.get(key as IntakeCriticalFieldKey)?.strength === 'strong');
  const overrideAllowed = !finalized;

  const recommendedDecision: IntakeDecisionMode = strongMatches.length > 0
    ? 'link_existing'
    : admissionState !== 'action_ready'
      ? 'save_reference'
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
    { key: 'core_fields', label: 'Core fields are medium+ confidence (type + title + project)', pass: !missingCore, severity: 'blocker' },
    { key: 'confidence', label: 'Acceptable confidence on core fields', pass: !lowConfidence, severity: 'warn' },
    { key: 'type_conflict', label: 'No conflicting type signals', pass: !hasTypeConflict, severity: 'blocker' },
    { key: 'already_finalized', label: 'Not already imported/linked', pass: !finalized, severity: 'blocker' },
  ];

  const batchExclusionReasons = [
    ...(safeToBatchApprove ? [] : ['Excluded from batch approval: only strong-evidence candidates can fast-approve.']),
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
    criticalFieldAssessments,
    createNewBlockers,
    createNewWarnings,
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
    criticalFieldAssessments: [],
    createNewBlockers: [],
    createNewWarnings: [],
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
