import type { ForwardedIntakeCandidate, IntakeCandidate, IntakeEvidence, IntakeExistingMatch, IntakeWorkCandidate } from '../types';

export type IntakeFieldReviewStatus = 'strong' | 'medium' | 'weak' | 'missing' | 'conflicting';

export type IntakeFieldReviewKey =
  | 'type'
  | 'title'
  | 'summary'
  | 'project'
  | 'owner'
  | 'dueDate'
  | 'priority'
  | 'waitingOn'
  | 'nextStep'
  | 'existingLink';

export interface FieldEvidenceRef {
  sourceRef: string;
  locator?: string;
  sourceType?: IntakeEvidence['sourceType'] | 'forwarded_reason' | 'quick_add';
}

export interface IntakeFieldReview {
  key: IntakeFieldReviewKey;
  label: string;
  value?: string;
  confidenceScore?: number;
  status: IntakeFieldReviewStatus;
  evidenceSnippets: string[];
  sourceRefs: FieldEvidenceRef[];
  reasons: string[];
}

export interface IntakeFieldReviewSummary {
  strong: IntakeFieldReview[];
  medium: IntakeFieldReview[];
  weak: IntakeFieldReview[];
  missing: IntakeFieldReview[];
  conflicting: IntakeFieldReview[];
  priorityReviewFields: IntakeFieldReview[];
}

export const HIGH_VALUE_REVIEW_FIELDS: IntakeFieldReviewKey[] = ['type', 'project', 'owner', 'dueDate', 'title', 'existingLink'];

const FIELD_LABELS: Record<IntakeFieldReviewKey, string> = {
  type: 'Type',
  title: 'Title',
  summary: 'Summary',
  project: 'Project',
  owner: 'Owner',
  dueDate: 'Due date',
  priority: 'Priority',
  waitingOn: 'Waiting on',
  nextStep: 'Next step',
  existingLink: 'Existing link suggestion',
};

export function confidenceToStatus(score?: number, opts: { missing?: boolean; conflicting?: boolean } = {}): IntakeFieldReviewStatus {
  if (opts.conflicting) return 'conflicting';
  if (opts.missing) return 'missing';
  if (score === undefined || Number.isNaN(score)) return 'weak';
  if (score >= 0.82) return 'strong';
  if (score >= 0.62) return 'medium';
  if (score >= 0.38) return 'weak';
  return 'missing';
}

export function captureTierToFieldStatus(tier: IntakeCandidate['confidenceTier']): IntakeFieldReviewStatus {
  if (tier === 'high') return 'strong';
  if (tier === 'medium') return 'medium';
  return 'weak';
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function findEvidence(evidence: IntakeEvidence[], key: string): IntakeEvidence[] {
  return evidence.filter((entry) => entry.field.toLowerCase() === key.toLowerCase());
}

function buildField(input: {
  key: IntakeFieldReviewKey;
  value?: string;
  score?: number;
  evidence?: IntakeEvidence[];
  reasons?: string[];
  missing?: boolean;
  conflicting?: boolean;
}): IntakeFieldReview {
  const evidence = input.evidence ?? [];
  return {
    key: input.key,
    label: FIELD_LABELS[input.key],
    value: input.value,
    confidenceScore: input.score,
    status: confidenceToStatus(input.score, { missing: input.missing || !input.value, conflicting: input.conflicting }),
    evidenceSnippets: unique(evidence.map((entry) => entry.snippet).filter(Boolean)).slice(0, 3),
    sourceRefs: unique(evidence.map((entry) => `${entry.sourceRef}|${entry.locator || ''}|${entry.sourceType || ''}`)).map((packed) => {
      const [sourceRef, locator, sourceType] = packed.split('|');
      return { sourceRef, locator: locator || undefined, sourceType: (sourceType as FieldEvidenceRef['sourceType']) || undefined };
    }).slice(0, 3),
    reasons: unique(input.reasons ?? []).slice(0, 4),
  };
}

export function summarizeFieldReviews(fields: IntakeFieldReview[]): IntakeFieldReviewSummary {
  const summary: IntakeFieldReviewSummary = {
    strong: [], medium: [], weak: [], missing: [], conflicting: [], priorityReviewFields: [],
  };
  fields.forEach((field) => {
    summary[field.status].push(field);
  });
  summary.priorityReviewFields = fields.filter((field) => HIGH_VALUE_REVIEW_FIELDS.includes(field.key));
  return summary;
}

export function buildWorkCandidateFieldReviews(candidate: IntakeWorkCandidate): IntakeFieldReview[] {
  const topMatch = candidate.existingRecordMatches[0];
  const conflicting = candidate.warnings.some((warning) => /conflict|ambiguous|mismatch/i.test(warning));
  const titleEvidence = findEvidence(candidate.evidence, 'title');
  const typeEvidence = findEvidence(candidate.evidence, 'type');

  return [
    buildField({ key: 'type', value: candidate.candidateType.replace('update_existing_', 'update ').replace('_', ' '), score: candidate.confidence, evidence: typeEvidence, reasons: candidate.explanation }),
    buildField({ key: 'title', value: candidate.title, score: candidate.fieldConfidence?.title ?? candidate.confidence, evidence: titleEvidence, reasons: candidate.explanation, missing: !candidate.title?.trim() }),
    buildField({ key: 'project', value: candidate.project, score: candidate.fieldConfidence?.project, evidence: findEvidence(candidate.evidence, 'project'), reasons: candidate.explanation, missing: !candidate.project }),
    buildField({ key: 'owner', value: candidate.owner || candidate.assignee, score: candidate.fieldConfidence?.owner ?? candidate.fieldConfidence?.assignee, evidence: [...findEvidence(candidate.evidence, 'owner'), ...findEvidence(candidate.evidence, 'assignee')], reasons: candidate.explanation, missing: !(candidate.owner || candidate.assignee) }),
    buildField({ key: 'dueDate', value: candidate.dueDate, score: candidate.fieldConfidence?.dueDate, evidence: findEvidence(candidate.evidence, 'dueDate'), reasons: candidate.explanation, missing: !candidate.dueDate }),
    buildField({ key: 'priority', value: candidate.priority, score: candidate.fieldConfidence?.priority, evidence: findEvidence(candidate.evidence, 'priority'), reasons: candidate.explanation }),
    buildField({ key: 'waitingOn', value: candidate.waitingOn, score: candidate.fieldConfidence?.waitingOn, evidence: findEvidence(candidate.evidence, 'waitingOn'), reasons: candidate.explanation, missing: !candidate.waitingOn }),
    buildField({ key: 'nextStep', value: candidate.nextStep, score: candidate.fieldConfidence?.nextStep, evidence: findEvidence(candidate.evidence, 'nextStep'), reasons: candidate.explanation, missing: !candidate.nextStep }),
    buildField({
      key: 'existingLink',
      value: topMatch ? `${topMatch.recordType}: ${topMatch.title}` : undefined,
      score: topMatch?.score,
      evidence: matchEvidence(topMatch),
      reasons: topMatch ? [describeMatch(topMatch)] : ['No strong existing-record match detected.'],
      missing: !topMatch,
      conflicting,
    }),
  ];
}

function matchEvidence(match?: IntakeExistingMatch): IntakeEvidence[] {
  if (!match) return [];
  return [{
    id: `match-${match.id}`,
    field: 'existingLink',
    snippet: `${match.recordType}: ${match.title} (${match.project})`,
    sourceRef: match.id,
    score: match.score,
    sourceType: 'text',
  }];
}

export function describeMatch(match: IntakeExistingMatch): string {
  const strategy = match.strategy ? `${match.strategy} strategy` : 'link strategy';
  const fields = match.matchedFields?.length ? `matched ${match.matchedFields.join(', ')}` : 'limited matched fields';
  return `${strategy}, score ${match.score.toFixed(2)}, ${fields}. ${match.reason}`;
}

export function buildCaptureFieldReviews(input: {
  kind: 'task' | 'followup';
  title: string;
  rawText?: string;
  project?: string;
  owner?: string;
  dueDate?: string;
  priority?: string;
  waitingOn?: string;
  nextAction?: string;
  nextStep?: string;
  confidence: number;
  cleanupReasons: string[];
  fieldEvidence?: Record<string, { status: IntakeFieldReviewStatus | 'explicit' | 'matched' | 'inferred' | 'contextual' | 'missing' | 'conflicting'; confidence: number; reasons?: string[]; }>;
}): IntakeFieldReview[] {
  const baseStatus = confidenceToStatus(input.confidence);
  const hasCleanup = (reason: string) => input.cleanupReasons.includes(reason);
  const commonReason = `Parse confidence ${input.confidence.toFixed(2)} (${baseStatus}).`;
  const toStatus = (key: string, fallback: IntakeFieldReviewStatus): IntakeFieldReviewStatus => {
    const raw = input.fieldEvidence?.[key]?.status;
    if (!raw) return fallback;
    if (raw === 'explicit' || raw === 'matched') return 'strong';
    if (raw === 'contextual' || raw === 'inferred') return 'medium';
    if (raw === 'conflicting') return 'conflicting';
    if (raw === 'missing') return 'missing';
    return fallback;
  };
  const toScore = (key: string, fallback: number): number => input.fieldEvidence?.[key]?.confidence ?? fallback;

  return [
    {
      key: 'type',
      label: FIELD_LABELS.type,
      value: input.kind,
      confidenceScore: toScore('kind', input.confidence),
      status: hasCleanup('unclear_type') ? 'weak' : toStatus('kind', baseStatus),
      evidenceSnippets: [input.rawText || input.title].filter(Boolean),
      sourceRefs: [{ sourceRef: 'quick-add', sourceType: 'quick_add' }],
      reasons: hasCleanup('unclear_type') ? ['Type tokens were ambiguous; please verify task vs follow-up.'] : (input.fieldEvidence?.kind?.reasons || [commonReason]),
    },
    {
      key: 'title',
      label: FIELD_LABELS.title,
      value: input.title,
      confidenceScore: toScore('title', input.confidence),
      status: hasCleanup('low_confidence_title') ? 'weak' : toStatus('title', baseStatus),
      evidenceSnippets: [input.title],
      sourceRefs: [{ sourceRef: 'quick-add', sourceType: 'quick_add' }],
      reasons: hasCleanup('low_confidence_title') ? ['Title looked too short or noisy.'] : (input.fieldEvidence?.title?.reasons || [commonReason]),
    },
    buildSimpleCaptureField('project', input.project, hasCleanup('missing_project') ? 'missing' : toStatus('project', baseStatus), toScore('project', 0.7)),
    buildSimpleCaptureField('owner', input.owner, hasCleanup('missing_owner') ? 'missing' : toStatus('owner', baseStatus), toScore('owner', 0.7)),
    buildSimpleCaptureField('dueDate', input.dueDate, hasCleanup('missing_due_date') ? 'missing' : toStatus('dueDate', confidenceToStatus(input.dueDate ? input.confidence * 0.8 : 0.2)), toScore('dueDate', 0.64)),
    buildSimpleCaptureField('priority', input.priority, baseStatus),
    buildSimpleCaptureField('waitingOn', input.waitingOn, toStatus('waitingOn', input.waitingOn ? 'medium' : 'missing'), toScore('waitingOn', 0.58)),
    buildSimpleCaptureField('nextStep', input.nextStep || input.nextAction, toStatus('nextStep', input.nextStep || input.nextAction ? 'medium' : 'missing'), toScore('nextStep', 0.56)),
  ];
}

function buildSimpleCaptureField(key: Exclude<IntakeFieldReviewKey, 'type' | 'title' | 'existingLink' | 'summary'>, value: string | undefined, status: IntakeFieldReviewStatus, confidenceScore?: number): IntakeFieldReview {
  return {
    key,
    label: FIELD_LABELS[key],
    value,
    status,
    confidenceScore: confidenceScore ?? (status === 'strong' ? 0.9 : status === 'medium' ? 0.7 : status === 'weak' ? 0.45 : 0.2),
    evidenceSnippets: value ? [value] : [],
    sourceRefs: [{ sourceRef: 'quick-add', sourceType: 'quick_add' }],
    reasons: value ? [] : ['No reliable signal detected in capture text.'],
  };
}

export function buildForwardedFieldReviews(candidate: ForwardedIntakeCandidate): IntakeFieldReview[] {
  const reasonEvidence: IntakeEvidence[] = candidate.reasons.slice(0, 3).map((reason, index) => ({
    id: `${candidate.id}-reason-${index}`,
    field: 'summary',
    snippet: reason,
    sourceRef: candidate.forwardedEmailId,
    sourceType: 'text',
  }));
  const dueReason = candidate.reasons.find((reason) => /due|deadline|date|friday|tomorrow|today/i.test(reason));
  const ownerReason = candidate.reasons.find((reason) => /owner|assigned|assignee|from/i.test(reason));

  return [
    buildField({ key: 'type', value: candidate.suggestedType, score: candidate.confidence, evidence: reasonEvidence, reasons: candidate.reasons }),
    buildField({ key: 'project', value: candidate.parsedProject, score: candidate.parsedProject ? candidate.confidence * 0.78 : 0.2, evidence: reasonEvidence, reasons: candidate.reasons, missing: !candidate.parsedProject }),
    buildField({ key: 'owner', value: ownerReason ? 'Inferred from sender/rule context' : undefined, score: ownerReason ? 0.52 : 0.2, evidence: reasonEvidence, reasons: ownerReason ? [ownerReason] : ['No owner signal detected.'], missing: !ownerReason }),
    buildField({ key: 'dueDate', value: dueReason ? 'Detected in forwarded content' : undefined, score: dueReason ? 0.46 : 0.2, evidence: reasonEvidence, reasons: dueReason ? [dueReason] : ['No due date detected.'], missing: !dueReason }),
    buildField({ key: 'title', value: candidate.normalizedSubject, score: candidate.confidence * 0.84, evidence: reasonEvidence, reasons: candidate.reasons }),
  ];
}
