import type { ForwardedIntakeCandidate, IntakeCandidateDecision, IntakeParseStatus } from '../types';

export type IntakeLifecycleStatus =
  | 'received'
  | 'parsing'
  | 'parsed'
  | 'review_needed'
  | 'ready_high_confidence'
  | 'imported'
  | 'linked'
  | 'reference'
  | 'rejected'
  | 'failed';

export type IntakeLifecycleGroup = 'in_progress' | 'pending_review' | 'finalized' | 'errored';
export type IntakeDecisionAction = 'approve_followup' | 'approve_task' | 'link_existing' | 'save_reference' | 'reject';

const lifecycleLabels: Record<IntakeLifecycleStatus, string> = {
  received: 'Received',
  parsing: 'Parsing',
  parsed: 'Parsed',
  review_needed: 'Review needed',
  ready_high_confidence: 'Ready (high confidence)',
  imported: 'Imported',
  linked: 'Linked',
  reference: 'Reference',
  rejected: 'Rejected',
  failed: 'Failed',
};

const lifecycleGroups: Record<IntakeLifecycleStatus, IntakeLifecycleGroup> = {
  received: 'in_progress',
  parsing: 'in_progress',
  parsed: 'in_progress',
  review_needed: 'pending_review',
  ready_high_confidence: 'pending_review',
  imported: 'finalized',
  linked: 'finalized',
  reference: 'finalized',
  rejected: 'finalized',
  failed: 'errored',
};

const lifecycleActions: Record<IntakeLifecycleStatus, IntakeDecisionAction[]> = {
  received: [],
  parsing: [],
  parsed: ['approve_followup', 'approve_task', 'link_existing', 'save_reference', 'reject'],
  review_needed: ['approve_followup', 'approve_task', 'link_existing', 'save_reference', 'reject'],
  ready_high_confidence: ['approve_followup', 'approve_task', 'link_existing', 'save_reference', 'reject'],
  imported: [],
  linked: [],
  reference: [],
  rejected: [],
  failed: ['reject'],
};

export function normalizeAssetStatus(status: IntakeParseStatus): IntakeLifecycleStatus {
  if (status === 'queued') return 'received';
  if (status === 'reading') return 'parsing';
  return status;
}

export function normalizeWorkCandidateStatus(status: IntakeCandidateDecision): IntakeLifecycleStatus {
  if (status === 'pending' || status === 'approved') return 'review_needed';
  if (status === 'reference') return 'reference';
  return status;
}

export function normalizeForwardedCandidateStatus(status: ForwardedIntakeCandidate['status']): IntakeLifecycleStatus {
  if (status === 'pending') return 'review_needed';
  if (status === 'approved') return 'imported';
  if (status === 'reference') return 'reference';
  return status;
}

export function getIntakeLifecycleLabel(status: IntakeLifecycleStatus): string {
  return lifecycleLabels[status];
}

export function getIntakeLifecycleGroup(status: IntakeLifecycleStatus): IntakeLifecycleGroup {
  return lifecycleGroups[status];
}

export function getAllowedIntakeActions(status: IntakeLifecycleStatus): IntakeDecisionAction[] {
  return lifecycleActions[status];
}

export function isIntakePendingReview(status: IntakeLifecycleStatus): boolean {
  return lifecycleGroups[status] === 'pending_review';
}

export function isIntakeFinalized(status: IntakeLifecycleStatus): boolean {
  return lifecycleGroups[status] === 'finalized';
}

export function isIntakeErrored(status: IntakeLifecycleStatus): boolean {
  return lifecycleGroups[status] === 'errored';
}

export function getIntakeDecisionLabel(action: IntakeDecisionAction): string {
  switch (action) {
    case 'approve_followup':
      return 'Approve as follow-up';
    case 'approve_task':
      return 'Approve as task';
    case 'link_existing':
      return 'Link to existing';
    case 'save_reference':
      return 'Save as reference';
    case 'reject':
      return 'Reject';
    default:
      return action;
  }
}
