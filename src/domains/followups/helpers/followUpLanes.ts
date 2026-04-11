import { isExecutionReady } from '../../records/integrity';
import type { FollowUpItem, SavedViewKey } from '../../../types';
import { localDayDelta, needsNudge } from '../../../lib/utils';

export type FollowUpLaneKey =
  | 'all_open'
  | 'now'
  | 'overdue'
  | 'needs_nudge'
  | 'waiting'
  | 'at_risk'
  | 'closed'
  | 'all_items';

export type FollowUpPressureBucket =
  | 'overdue'
  | 'due_today'
  | 'needs_nudge'
  | 'waiting'
  | 'at_risk'
  | 'stable'
  | 'closed'
  | 'cleanup';

export interface FollowUpLaneDefinition {
  key: FollowUpLaneKey;
  label: string;
  description: string;
  inclusionRule: string;
  exclusionRule: string;
  allowsClosedItems: boolean;
  allowsCleanupReviewItems: boolean;
  urgencyContract: string;
}

export interface FollowUpClassification {
  laneMemberships: Set<FollowUpLaneKey>;
  isOpen: boolean;
  isClosed: boolean;
  isExecutionReady: boolean;
  isCleanupOnly: boolean;
  isReviewRequired: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isNeedsNudge: boolean;
  isWaiting: boolean;
  isAtRisk: boolean;
  pressureBucket: FollowUpPressureBucket;
  primaryExecutionSignal: string;
  urgencyLabel: string;
  urgencyTone: 'danger' | 'warn' | 'info' | 'success';
}

const FOLLOW_UP_LANES: Record<FollowUpLaneKey, FollowUpLaneDefinition> = {
  all_open: {
    key: 'all_open',
    label: 'All open',
    description: 'All open follow-ups that still require active handling.',
    inclusionRule: 'Open records regardless of urgency subtype.',
    exclusionRule: 'Closed follow-ups.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Mixed urgency; use row-level urgency signal for next move.',
  },
  now: {
    key: 'now',
    label: 'Today',
    description: 'Open follow-ups due on the local calendar day.',
    inclusionRule: 'Open follow-ups with due date exactly today.',
    exclusionRule: 'Overdue-only and nudge-only records not due today.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Due today commitments requiring same-day execution.',
  },
  overdue: {
    key: 'overdue',
    label: 'Overdue',
    description: 'Open follow-ups with due dates before today.',
    inclusionRule: 'Open follow-ups where due date is before the local day.',
    exclusionRule: 'Due today or future-due follow-ups.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Past-due commitments with highest urgency.',
  },
  needs_nudge: {
    key: 'needs_nudge',
    label: 'Needs nudge',
    description: 'Open follow-ups whose next touch cadence is due now without due-date pressure.',
    inclusionRule: 'Needs-nudge true and not currently due/overdue.',
    exclusionRule: 'Closed, overdue, and due-today commitments.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Cadence pressure: prompt outreach or touch update.',
  },
  waiting: {
    key: 'waiting',
    label: 'Waiting',
    description: 'Open follow-ups waiting on external or internal response.',
    inclusionRule: 'Waiting status or explicit waiting-on context.',
    exclusionRule: 'Closed follow-ups.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Monitor and unblock response-driven work.',
  },
  at_risk: {
    key: 'at_risk',
    label: 'At risk',
    description: 'Open follow-ups with explicit at-risk or critical escalation state.',
    inclusionRule: 'Status is At risk or escalation level is Critical.',
    exclusionRule: 'Closed follow-ups.',
    allowsClosedItems: false,
    allowsCleanupReviewItems: false,
    urgencyContract: 'Escalation pressure requiring ownership attention.',
  },
  closed: {
    key: 'closed',
    label: 'Closed',
    description: 'Completed follow-ups kept for history and auditability.',
    inclusionRule: 'Status is Closed.',
    exclusionRule: 'Any open follow-up.',
    allowsClosedItems: true,
    allowsCleanupReviewItems: true,
    urgencyContract: 'No active urgency; historical context only.',
  },
  all_items: {
    key: 'all_items',
    label: 'All items',
    description: 'Complete follow-up inventory across open, closed, and cleanup states.',
    inclusionRule: 'Every follow-up record.',
    exclusionRule: 'None.',
    allowsClosedItems: true,
    allowsCleanupReviewItems: true,
    urgencyContract: 'Mixed urgency and lifecycle states.',
  },
};

export function getFollowUpLaneDefinition(key: FollowUpLaneKey): FollowUpLaneDefinition {
  return FOLLOW_UP_LANES[key];
}

export function classifyFollowUpItem(item: FollowUpItem, now = new Date()): FollowUpClassification {
  const executionReady = isExecutionReady(item);
  const isClosed = item.status === 'Closed';
  const isOpen = !isClosed;
  const dueDelta = localDayDelta(now, item.dueDate);
  const touchDelta = localDayDelta(now, item.nextTouchDate);
  const overdue = isOpen && dueDelta < 0;
  const dueToday = isOpen && dueDelta === 0;
  const waiting = isOpen && (item.status === 'Waiting on external' || item.status === 'Waiting internal' || Boolean(item.waitingOn));
  const atRisk = isOpen && (item.status === 'At risk' || item.escalationLevel === 'Critical');
  const nudged = isOpen && needsNudge(item);
  const reviewRequired = !executionReady || Boolean(item.reviewReasons?.length) || item.lifecycleState === 'review_required' || item.dataQuality === 'review_required';
  const cleanupOnly = reviewRequired || Boolean(item.needsCleanup);

  const laneMemberships = new Set<FollowUpLaneKey>(['all_items']);
  if (isOpen) laneMemberships.add('all_open');
  if (isClosed) laneMemberships.add('closed');
  if (overdue) laneMemberships.add('overdue');
  if (dueToday) laneMemberships.add('now');
  if (nudged && !overdue && !dueToday) laneMemberships.add('needs_nudge');
  if (waiting) laneMemberships.add('waiting');
  if (atRisk) laneMemberships.add('at_risk');

  if (isClosed) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: cleanupOnly ? 'cleanup' : 'closed',
      primaryExecutionSignal: 'Closed record',
      urgencyLabel: cleanupOnly ? 'Closed (needs cleanup)' : 'Closed',
      urgencyTone: 'success',
    };
  }

  if (cleanupOnly) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'cleanup',
      primaryExecutionSignal: 'Review required before execution',
      urgencyLabel: 'Needs cleanup',
      urgencyTone: 'warn',
    };
  }

  if (overdue) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'overdue',
      primaryExecutionSignal: `Overdue by ${Math.abs(dueDelta)}d`,
      urgencyLabel: 'Overdue',
      urgencyTone: 'danger',
    };
  }

  if (dueToday) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'due_today',
      primaryExecutionSignal: 'Due today',
      urgencyLabel: 'Due today',
      urgencyTone: 'warn',
    };
  }

  if (nudged) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'needs_nudge',
      primaryExecutionSignal: touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today',
      urgencyLabel: 'Needs nudge',
      urgencyTone: 'warn',
    };
  }

  if (atRisk) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'at_risk',
      primaryExecutionSignal: 'At risk',
      urgencyLabel: 'At risk',
      urgencyTone: 'warn',
    };
  }

  if (waiting) {
    return {
      laneMemberships,
      isOpen,
      isClosed,
      isExecutionReady: executionReady,
      isCleanupOnly: cleanupOnly,
      isReviewRequired: reviewRequired,
      isOverdue: overdue,
      isDueToday: dueToday,
      isNeedsNudge: nudged,
      isWaiting: waiting,
      isAtRisk: atRisk,
      pressureBucket: 'waiting',
      primaryExecutionSignal: 'Waiting on response',
      urgencyLabel: 'Waiting',
      urgencyTone: 'info',
    };
  }

  return {
    laneMemberships,
    isOpen,
    isClosed,
    isExecutionReady: executionReady,
    isCleanupOnly: cleanupOnly,
    isReviewRequired: reviewRequired,
    isOverdue: overdue,
    isDueToday: dueToday,
    isNeedsNudge: nudged,
    isWaiting: waiting,
    isAtRisk: atRisk,
    pressureBucket: 'stable',
    primaryExecutionSignal: item.nextAction ? 'Next move set' : 'Needs direction',
    urgencyLabel: item.nextAction ? 'On track' : 'Needs direction',
    urgencyTone: 'info',
  };
}

export function getSavedViewLaneKey(view: SavedViewKey): FollowUpLaneKey | null {
  switch (view) {
    case 'All items':
      return 'all_items';
    case 'All':
      return 'all_open';
    case 'Today':
      return 'now';
    case 'Waiting':
    case 'Waiting on others':
      return 'waiting';
    case 'Needs nudge':
      return 'needs_nudge';
    case 'At risk':
      return 'at_risk';
    case 'Overdue':
      return 'overdue';
    case 'Closed':
      return 'closed';
    default:
      return null;
  }
}
