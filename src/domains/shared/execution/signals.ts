import type { ExecutionAttentionState, ExecutionRecordSurface } from './types';

const SIGNAL_PRIORITY: ExecutionAttentionState[] = [
  { key: 'overdue', label: 'Overdue', tone: 'danger', weight: 100 },
  { key: 'blocked', label: 'Blocked', tone: 'danger', weight: 95 },
  { key: 'at_risk', label: 'At risk', tone: 'warn', weight: 90 },
  { key: 'due_now', label: 'Due now', tone: 'warn', weight: 85 },
  { key: 'touch_due', label: 'Touch due', tone: 'info', weight: 80 },
  { key: 'waiting', label: 'Waiting', tone: 'info', weight: 70 },
  { key: 'ready_to_close', label: 'Ready to close', tone: 'success', weight: 65 },
  { key: 'cleanup', label: 'Cleanup', tone: 'warn', weight: 60 },
  { key: 'orphaned', label: 'Orphaned', tone: 'warn', weight: 55 },
  { key: 'linked_open_work', label: 'Linked work open', tone: 'info', weight: 50 },
  { key: 'stale_activity', label: 'Stale activity', tone: 'default', weight: 40 },
  { key: 'none', label: 'Stable', tone: 'default', weight: 0 },
];

export function deriveExecutionSignalKeys(surface: ExecutionRecordSurface): ExecutionAttentionState['key'][] {
  const keys: ExecutionAttentionState['key'][] = [];
  if (surface.queueFlags.overdue) keys.push('overdue');
  if (surface.queueFlags.blocked) keys.push('blocked');
  if (surface.queueFlags.parentAtRisk) keys.push('at_risk');
  if (surface.queueFlags.dueToday) keys.push('due_now');
  if (surface.queueFlags.needsTouchToday) keys.push('touch_due');
  if (surface.queueFlags.waiting) keys.push('waiting');
  if (surface.queueFlags.readyToCloseParent || surface.status === 'Done' || surface.status === 'Closed') keys.push('ready_to_close');
  if (surface.queueFlags.cleanupRequired) keys.push('cleanup');
  if (surface.queueFlags.orphanedTask) keys.push('orphaned');
  if ((surface.sourceItem.linkedOpenTaskCount ?? 0) > 0) keys.push('linked_open_work');
  if (surface.queueFlags.waitingTooLong) keys.push('stale_activity');
  if (!keys.length) keys.push('none');
  return keys;
}

export function deriveExecutionAttentionState(surface: ExecutionRecordSurface): ExecutionAttentionState {
  const keys = deriveExecutionSignalKeys(surface);
  return SIGNAL_PRIORITY.find((candidate) => keys.includes(candidate.key)) ?? SIGNAL_PRIORITY[SIGNAL_PRIORITY.length - 1];
}
