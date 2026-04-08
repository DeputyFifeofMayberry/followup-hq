import type { UnifiedQueueItem } from '../../../types';

export type OverviewInspectorDestination = 'tasks' | 'followups' | 'outlook';

export interface OverviewInspectorRecommendation {
  label: string;
  reason: string;
  primaryDestination: Extract<OverviewInspectorDestination, 'tasks' | 'followups'>;
  secondaryDestination?: OverviewInspectorDestination;
  secondaryLabel?: string;
  whyNow: string;
  urgencySignals: string[];
}

function buildUrgencySignals(record: UnifiedQueueItem): string[] {
  const signals: string[] = [];

  if (record.queueFlags.overdue) signals.push('Overdue commitment');
  if (record.queueFlags.dueToday) signals.push('Due today');
  if (record.queueFlags.needsTouchToday) signals.push('Touch due today');
  if (record.queueFlags.blocked) signals.push('Blocked now');
  if (record.queueFlags.parentAtRisk) signals.push('Parent at risk');
  if (record.queueFlags.waitingTooLong) signals.push('Waiting too long');
  if (record.queueFlags.waiting) signals.push('Waiting on response');
  if (record.queueFlags.readyToCloseParent) signals.push('Ready to close');
  if (record.queueFlags.cleanupRequired || record.queueFlags.orphanedTask) signals.push('Needs review');

  return signals.slice(0, 3);
}

function buildWhyNow(record: UnifiedQueueItem): string {
  if (record.queueReasons.length > 0) return record.queueReasons[0];
  return record.whyInQueue;
}

export function getOverviewInspectorRecommendation(record: UnifiedQueueItem): OverviewInspectorRecommendation {
  const urgencySignals = buildUrgencySignals(record);
  const whyNow = buildWhyNow(record);
  const needsIntakeReview = record.queueFlags.cleanupRequired || record.queueFlags.orphanedTask;

  if (record.recordType === 'task') {
    return {
      label: 'Continue in Tasks',
      reason: 'This is execution work. Continue in Tasks to update status, unblock, and commit the next step.',
      primaryDestination: 'tasks',
      secondaryDestination: needsIntakeReview ? 'outlook' : 'followups',
      secondaryLabel: needsIntakeReview ? 'Review in Intake' : 'Continue in Follow Ups',
      whyNow,
      urgencySignals,
    };
  }

  return {
    label: 'Continue in Follow Ups',
    reason: needsIntakeReview
      ? 'This surfaced from review signals. Verify context in Intake before continuing execution.'
      : 'This item needs ownership and communication follow-through. Continue in Follow Ups to move it forward.',
    primaryDestination: 'followups',
    secondaryDestination: needsIntakeReview ? 'outlook' : 'tasks',
    secondaryLabel: needsIntakeReview ? 'Review in Intake' : 'Continue in Tasks',
    whyNow,
    urgencySignals,
  };
}
