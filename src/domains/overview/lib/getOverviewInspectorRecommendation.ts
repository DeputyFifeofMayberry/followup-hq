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

  if (record.queueFlags.overdue) signals.push('Overdue');
  if (record.queueFlags.dueToday) signals.push('Due today');
  if (record.queueFlags.needsTouchToday) signals.push('Needs touch today');
  if (record.queueFlags.blocked || record.queueFlags.waiting) signals.push('Blocked or waiting');
  if (record.queueFlags.parentAtRisk) signals.push('Parent at risk');
  if (record.queueFlags.cleanupRequired || record.queueFlags.waitingTooLong || record.queueFlags.orphanedTask) {
    signals.push('Cleanup review needed');
  }

  return signals.slice(0, 3);
}

function buildWhyNow(record: UnifiedQueueItem): string {
  if (record.queueReasons.length > 0) return record.queueReasons[0];
  return record.whyInQueue;
}

export function getOverviewInspectorRecommendation(record: UnifiedQueueItem): OverviewInspectorRecommendation {
  const urgencySignals = buildUrgencySignals(record);
  const whyNow = buildWhyNow(record);

  if (record.recordType === 'task') {
    return {
      label: 'Handle in Tasks',
      reason: 'This is a task-level execution item and should be worked in the Tasks lane.',
      primaryDestination: 'tasks',
      secondaryDestination: record.queueFlags.cleanupRequired ? 'outlook' : 'followups',
      secondaryLabel: record.queueFlags.cleanupRequired ? 'Review in Intake first' : 'Open in Follow Ups',
      whyNow,
      urgencySignals,
    };
  }

  return {
    label: 'Continue in Follow Ups',
    reason: record.queueFlags.cleanupRequired
      ? 'This surfaced from cleanup/review and should be confirmed in Intake before execution.'
      : 'This follow-up needs ownership and next action handling in the Follow Ups lane.',
    primaryDestination: 'followups',
    secondaryDestination: record.queueFlags.cleanupRequired ? 'outlook' : 'tasks',
    secondaryLabel: record.queueFlags.cleanupRequired ? 'Review in Intake first' : 'Open in Tasks',
    whyNow,
    urgencySignals,
  };
}
