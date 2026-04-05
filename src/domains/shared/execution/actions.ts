import type { ExecutionActionCapabilityGroup, ExecutionLaneKey, ExecutionRecordType } from './types';

const followUpCapabilities: ExecutionActionCapabilityGroup[] = [
  'progress_work',
  'defer_snooze',
  'escalate_block',
  'close_complete',
  'open_linked_context',
  'route_lane',
  'open_record',
];

const taskCapabilities: ExecutionActionCapabilityGroup[] = [
  'progress_work',
  'defer_snooze',
  'escalate_block',
  'close_complete',
  'open_linked_context',
  'route_lane',
  'open_record',
];

export function getExecutionActionCapabilities(lane: ExecutionLaneKey, recordType: ExecutionRecordType): ExecutionActionCapabilityGroup[] {
  if (lane === 'overview') return ['route_lane', 'open_record'];
  if (recordType === 'followup') return followUpCapabilities;
  return taskCapabilities;
}
