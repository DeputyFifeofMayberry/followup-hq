import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import type { IntakeReviewPlan } from '../../lib/intakeReviewPlan';

export type Tone = 'success' | 'error' | 'info';
export type QueueLane = 'ready_to_create' | 'needs_correction' | 'link_duplicate_review' | 'reference_only';
export type SourceTab = 'overview' | 'preview' | 'evidence' | 'metadata';

export interface ActionFeedback {
  tone: Tone;
  message: string;
}

export function queueLane(item: IntakeQueueItem): QueueLane {
  if (item.readiness === 'reference_likely') return 'reference_only';
  if (item.readiness === 'needs_link_decision') return 'link_duplicate_review';
  if (item.readiness === 'ready_to_approve') return 'ready_to_create';
  return 'needs_correction';
}

export function laneLabel(lane: QueueLane) {
  if (lane === 'ready_to_create') return 'Ready to create';
  if (lane === 'link_duplicate_review') return 'Link / duplicate review';
  if (lane === 'needs_correction') return 'Needs correction';
  return 'Reference only';
}

export function decisionLabel(mode: 'create_new_task' | 'create_new_followup' | 'link_existing' | 'duplicate_update_review' | 'save_reference' | 'reject') {
  if (mode === 'create_new_followup') return 'Create follow-up';
  if (mode === 'create_new_task') return 'Create task';
  if (mode === 'link_existing') return 'Link to existing';
  if (mode === 'save_reference') return 'Save reference';
  if (mode === 'reject') return 'Dismiss candidate';
  return 'Needs more correction';
}

export function actionIsPrimary(decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link', plan: IntakeReviewPlan, createBlocked: boolean) {
  if (createBlocked) return decision === 'link' || decision === 'reference';
  if (plan.suggestedDecision === 'create_new_followup') return decision === 'approve_followup';
  if (plan.suggestedDecision === 'create_new_task') return decision === 'approve_task';
  if (plan.suggestedDecision === 'link_existing' || plan.suggestedDecision === 'duplicate_update_review') return decision === 'link';
  if (plan.suggestedDecision === 'save_reference') return decision === 'reference';
  return decision === 'reject';
}

export function createActionBlockReason(input: { createBlocked: boolean; safeToCreateNew: boolean; confirmUnsafeCreate: boolean }) {
  if (input.createBlocked) return 'Create-new actions are disabled until blockers are corrected.';
  if (!input.safeToCreateNew && !input.confirmUnsafeCreate) return 'Create-new actions are disabled until duplicate-risk override is acknowledged.';
  return null;
}

export function candidateTypeLabel(type: string) {
  if (type === 'followup') return 'Follow-up';
  if (type === 'task') return 'Task';
  if (type === 'update_existing_followup') return 'Update follow-up';
  if (type === 'update_existing_task') return 'Update task';
  return 'Reference';
}

export function correctionBucketLabel(status: 'missing' | 'weak' | 'conflicting') {
  if (status === 'missing') return 'Missing';
  if (status === 'conflicting') return 'Conflicting';
  return 'Weak signal';
}

export function recommendedActionDescription(mode: 'create_new_task' | 'create_new_followup' | 'link_existing' | 'duplicate_update_review' | 'save_reference' | 'reject') {
  if (mode === 'create_new_followup') return 'This appears actionable and follow-up shaped after required checks are complete.';
  if (mode === 'create_new_task') return 'This appears actionable with task ownership and completion expectations.';
  if (mode === 'link_existing') return 'Existing-record overlap is strong; linking is safer than creating a new record.';
  if (mode === 'save_reference') return 'Signals look informational; save without creating a new action item.';
  if (mode === 'reject') return 'Evidence is unsafe or insufficient for creating or linking work.';
  return 'Correct blockers first, then resolve duplicate/link pressure before create-new.';
}

export function reviewReasonForField(key: string) {
  if (key === 'title') return 'Without a clear title, the created record is hard to scan and trust.';
  if (key === 'type') return 'Wrong type creates the wrong workflow and ownership expectations.';
  if (key === 'project') return 'Project drives context, ownership, and where work lands.';
  if (key === 'dueDate') return 'Due date controls urgency and reminder pressure.';
  if (key === 'existingLink') return 'Potential overlap can create duplicate work if not reviewed.';
  if (key === 'owner') return 'Owner clarity prevents orphaned follow-ups.';
  if (key === 'nextStep') return 'A concrete next step reduces decision hesitation.';
  return 'Needs reviewer confirmation before safe approval.';
}

export function confidenceBand(confidence: number) {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.75) return 'Medium';
  return 'Low';
}

export function sanitizeSnippet(value: string) {
  return value.split('').map((char) => {
    const code = char.charCodeAt(0);
    return (code >= 32 || code === 10 || code === 13 || code === 9) ? char : ' ';
  }).join('');
}

export function prettyFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
