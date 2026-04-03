import type { FollowUpItem, IntakeEvidence, IntakeExistingMatch, IntakeFieldReview, IntakeReviewOutcome, IntakeReviewRecord, IntakeWorkCandidate, TaskItem } from '../../types';
import { createId, todayIso } from '../utils';

const tokenSplit = /[^a-z0-9]+/g;

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(tokenSplit, ' ').split(/\s+/).filter((x) => x.length > 2));
}

function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  const intersect = [...left].filter((t) => right.has(t)).length;
  const union = new Set([...left, ...right]).size;
  return intersect / union;
}

function dueProximity(left?: string, right?: string): number {
  if (!left || !right) return 0;
  const ms = Math.abs(new Date(left).getTime() - new Date(right).getTime());
  if (!Number.isFinite(ms)) return 0;
  const days = ms / 86400000;
  if (days <= 1) return 1;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.55;
  if (days <= 14) return 0.3;
  return 0;
}

function normalize(value?: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9@ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function scoreCandidateMatch(
  candidate: { title: string; project?: string; dueDate?: string; waitingOn?: string; summary?: string; sourceRefs?: string[] },
  record: { title: string; project: string; dueDate?: string; waitingOn?: string; summary?: string; sourceRefs?: string[] },
): { score: number; reason: string; matchedFields: string[] } {
  const title = similarity(candidate.title, record.title);
  const project = normalize(candidate.project) && normalize(candidate.project) === normalize(record.project) ? 1 : 0;
  const due = dueProximity(candidate.dueDate, record.dueDate);
  const waiting = candidate.waitingOn && record.waitingOn ? similarity(candidate.waitingOn, record.waitingOn) : 0;
  const summary = candidate.summary && record.summary ? similarity(candidate.summary, record.summary) : 0;
  const sourceRef = candidate.sourceRefs?.length && record.sourceRefs?.length
    ? Math.max(...candidate.sourceRefs.map((left) => Math.max(...record.sourceRefs!.map((right) => similarity(left, right)))))
    : 0;

  const score = Number(Math.min(0.99,
    title * 0.38
    + project * 0.17
    + due * 0.14
    + waiting * 0.11
    + summary * 0.14
    + sourceRef * 0.06,
  ).toFixed(2));

  const matchedFields = [
    ...(title > 0.45 ? ['title'] : []),
    ...(project ? ['project'] : []),
    ...(due > 0.45 ? ['dueDate'] : []),
    ...(waiting > 0.45 ? ['waitingOn'] : []),
    ...(summary > 0.45 ? ['summary'] : []),
    ...(sourceRef > 0.5 ? ['sourceRef'] : []),
  ];

  return {
    score,
    reason: `title=${title.toFixed(2)} project=${project.toFixed(2)} due=${due.toFixed(2)} waiting=${waiting.toFixed(2)} summary=${summary.toFixed(2)} source=${sourceRef.toFixed(2)}`,
    matchedFields,
  };
}

export function resolveCandidateMatches(candidate: IntakeWorkCandidate, items: FollowUpItem[], tasks: TaskItem[]): IntakeExistingMatch[] {
  const recordMatch: IntakeExistingMatch[] = [];

  for (const item of items) {
    const result = scoreCandidateMatch(candidate, item);
    if (result.score < 0.45) continue;
    const strategy: IntakeExistingMatch['strategy'] = result.score >= 0.87 ? 'duplicate' : candidate.candidateType.includes('update') ? 'update' : 'link';
    recordMatch.push({
      id: item.id,
      recordType: 'followup',
      title: item.title,
      project: item.project,
      score: result.score,
      reason: result.reason,
      strategy,
      matchedFields: result.matchedFields,
    });
  }

  for (const task of tasks) {
    const result = scoreCandidateMatch(candidate, task);
    if (result.score < 0.45) continue;
    const strategy: IntakeExistingMatch['strategy'] = result.score >= 0.87 ? 'duplicate' : candidate.candidateType.includes('update') ? 'update' : 'link';
    recordMatch.push({
      id: task.id,
      recordType: 'task',
      title: task.title,
      project: task.project,
      score: result.score,
      reason: result.reason,
      strategy,
      matchedFields: result.matchedFields,
    });
  }

  return recordMatch.sort((a, b) => b.score - a.score).slice(0, 5);
}

function field<T>(value: T | undefined, confidence: number, evidence: IntakeEvidence[]): IntakeFieldReview<T> {
  return { value, confidence: Number(confidence.toFixed(2)), evidence };
}

export function buildIntakeReview(candidate: IntakeWorkCandidate): IntakeReviewRecord {
  const now = todayIso();
  const byField = (name: string) => candidate.evidence.filter((entry) => entry.field === name || name === 'summary');

  const outcomes: Array<{ outcome: IntakeReviewOutcome; confidence: number; reason: string }> = [
    { outcome: 'create_new_task', confidence: candidate.candidateType === 'task' ? candidate.confidence : candidate.confidence * 0.82, reason: 'Action language and task-shaped next step.' },
    { outcome: 'create_new_followup', confidence: candidate.candidateType === 'followup' ? candidate.confidence : candidate.confidence * 0.8, reason: 'Waiting and response tracking language detected.' },
    { outcome: 'update_existing_task', confidence: candidate.candidateType === 'update_existing_task' ? candidate.confidence : 0.35, reason: 'Potential continuation/update against an existing task.' },
    { outcome: 'update_existing_followup', confidence: candidate.candidateType === 'update_existing_followup' ? candidate.confidence : 0.35, reason: 'Potential continuation/update against an existing follow-up.' },
    { outcome: 'link_to_existing', confidence: candidate.existingRecordMatches[0]?.score ?? 0.3, reason: 'Strong record match detected.' },
    { outcome: 'save_as_reference', confidence: candidate.candidateType === 'reference' ? candidate.confidence : 0.28, reason: 'No clear action owner/date; better as reference.' },
    { outcome: 'reject', confidence: candidate.warnings.length ? 0.25 : 0.1, reason: 'Low trust parse or irrelevant content.' },
  ] as Array<{ outcome: IntakeReviewOutcome; confidence: number; reason: string }>;
  outcomes.sort((a, b) => b.confidence - a.confidence);

  return {
    id: createId('REV'),
    batchId: candidate.batchId,
    assetId: candidate.assetId,
    title: field(candidate.title, candidate.fieldConfidence?.title ?? candidate.confidence, byField('title')),
    type: field(candidate.candidateType.includes('task') ? 'task' : candidate.candidateType.includes('followup') ? 'followup' : 'reference', candidate.confidence, byField('type')),
    project: field(candidate.project, candidate.fieldConfidence?.project ?? 0.62, byField('project')),
    owner: field(candidate.owner, candidate.fieldConfidence?.owner ?? 0.58, byField('owner')),
    assignee: field(candidate.assignee, candidate.fieldConfidence?.assignee ?? 0.52, byField('assignee')),
    dueDate: field(candidate.dueDate, candidate.fieldConfidence?.dueDate ?? 0.5, byField('dueDate')),
    waitingOn: field(candidate.waitingOn, candidate.fieldConfidence?.waitingOn ?? 0.48, byField('waitingOn')),
    statusHint: field(candidate.statusHint, candidate.fieldConfidence?.statusHint ?? 0.52, byField('statusHint')),
    priority: field(candidate.priority, candidate.fieldConfidence?.priority ?? 0.5, byField('priority')),
    summary: field(candidate.summary, candidate.confidence, byField('summary')),
    nextStep: field(candidate.nextStep, candidate.fieldConfidence?.nextStep ?? 0.54, byField('nextStep')),
    candidateOutcomes: outcomes,
    selectedOutcome: outcomes[0]?.outcome ?? 'save_as_reference',
    existingRecordMatches: candidate.existingRecordMatches,
    createdAt: now,
    updatedAt: now,
  };
}
