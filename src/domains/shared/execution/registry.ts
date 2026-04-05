import type { ExecutionLaneKey, ExecutionProgressionPolicy } from './types';

export interface ExecutionLaneDefinition {
  key: ExecutionLaneKey;
  title: string;
  subtitle: string;
  supportedRecordTypes: Array<'task' | 'followup'>;
  defaultSelectionPolicy: 'targeted_then_last' | 'targeted_then_first';
  defaultScope: 'triage' | 'follow_through' | 'tactical_execution';
  supportedQuickActions: string[];
  inspectorBehavior: {
    showLinkedContext: boolean;
    showRouteContext: boolean;
  };
  rowVariant: 'overview' | 'followups' | 'tasks';
  handoffBehavior: 'retain_source' | 'focus_target';
  progression: ExecutionProgressionPolicy;
}

export const executionLaneRegistry: Record<ExecutionLaneKey, ExecutionLaneDefinition> = {
  overview: {
    key: 'overview',
    title: 'Overview',
    subtitle: 'Broad triage and routing lens',
    supportedRecordTypes: ['followup', 'task'],
    defaultSelectionPolicy: 'targeted_then_first',
    defaultScope: 'triage',
    supportedQuickActions: ['route_lane', 'open_record'],
    inspectorBehavior: { showLinkedContext: true, showRouteContext: true },
    rowVariant: 'overview',
    handoffBehavior: 'focus_target',
    progression: { advanceOnComplete: true, stayOnDefer: false, returnToSourceOnRouteAway: true },
  },
  followups: {
    key: 'followups',
    title: 'Follow-Ups',
    subtitle: 'Commitment, cadence, and follow-through lens',
    supportedRecordTypes: ['followup'],
    defaultSelectionPolicy: 'targeted_then_last',
    defaultScope: 'follow_through',
    supportedQuickActions: ['progress_work', 'defer_snooze', 'escalate_block', 'close_complete', 'open_linked_context', 'route_lane', 'open_record'],
    inspectorBehavior: { showLinkedContext: true, showRouteContext: true },
    rowVariant: 'followups',
    handoffBehavior: 'retain_source',
    progression: { advanceOnComplete: true, stayOnDefer: true, returnToSourceOnRouteAway: true },
  },
  tasks: {
    key: 'tasks',
    title: 'Tasks',
    subtitle: 'Tactical execution and completion lens',
    supportedRecordTypes: ['task'],
    defaultSelectionPolicy: 'targeted_then_last',
    defaultScope: 'tactical_execution',
    supportedQuickActions: ['progress_work', 'defer_snooze', 'escalate_block', 'close_complete', 'open_linked_context', 'route_lane', 'open_record'],
    inspectorBehavior: { showLinkedContext: true, showRouteContext: true },
    rowVariant: 'tasks',
    handoffBehavior: 'retain_source',
    progression: { advanceOnComplete: true, stayOnDefer: true, returnToSourceOnRouteAway: true },
  },
};

export function getExecutionLaneDefinition(key: ExecutionLaneKey): ExecutionLaneDefinition {
  return executionLaneRegistry[key];
}
