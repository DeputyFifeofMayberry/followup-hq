import type { ExecutionIntentSource, ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';

export type ExecutionLaneKey = ExecutionRouteTarget;
export type ExecutionRecordType = UnifiedQueueItem['recordType'];

export interface ExecutionAttentionState {
  key:
    | 'due_now'
    | 'overdue'
    | 'touch_due'
    | 'blocked'
    | 'waiting'
    | 'at_risk'
    | 'ready_to_close'
    | 'cleanup'
    | 'orphaned'
    | 'linked_open_work'
    | 'stale_activity'
    | 'none';
  label: string;
  tone: 'default' | 'info' | 'warn' | 'danger' | 'success';
  weight: number;
}

export interface ExecutionRecordSummary {
  id: string;
  recordType: ExecutionRecordType;
  title: string;
  project: string;
  owner: string;
  assignee: string;
  status: string;
  primaryDate?: string;
  nextMove: string;
  timingSummary: string;
  workflowState?: string;
  linkedContextSummary?: string;
}

export interface ExecutionRecordSurface {
  id: string;
  recordType: ExecutionRecordType;
  title: string;
  project: string;
  projectId?: string;
  owner: string;
  assignee: string;
  status: string;
  primaryDates: {
    dueDate?: string;
    nextTouchDate?: string;
    promisedDate?: string;
    updatedAt?: string;
  };
  nextMoveSummary: string;
  urgencySignals: string[];
  workflowState?: string;
  linkedContextSummary?: string;
  queueFlags: UnifiedQueueItem['queueFlags'];
  completionRelevance: 'none' | 'ready_to_close' | 'advance_parent';
  routeTarget: {
    preferredLane: Exclude<ExecutionRouteTarget, 'overview'>;
    section: ExecutionSectionKey;
  };
  sourceItem: UnifiedQueueItem;
}

export interface ExecutionLaneItem {
  lane: ExecutionLaneKey;
  summary: ExecutionRecordSummary;
  surface: ExecutionRecordSurface;
  attention: ExecutionAttentionState;
}

export interface ExecutionProgressionPolicy {
  advanceOnComplete: boolean;
  stayOnDefer: boolean;
  returnToSourceOnRouteAway: boolean;
}

export type ExecutionActionCapabilityGroup =
  | 'progress_work'
  | 'defer_snooze'
  | 'escalate_block'
  | 'close_complete'
  | 'open_linked_context'
  | 'route_lane'
  | 'open_record';

export interface ExecutionLaneSessionState {
  lane: Exclude<ExecutionRouteTarget, 'overview'>;
  lastSelectedRecordId: string | null;
  lastProjectScope: string | null;
  lastSection: ExecutionSectionKey | null;
  lastIntentLabel: string | null;
  lastSourceWorkspace: ExecutionIntentSource | null;
  updatedAt: string;
}

export interface ExecutionRouteHandoff {
  source: ExecutionIntentSource;
  targetLane: Exclude<ExecutionRouteTarget, 'overview'>;
  targetSection?: ExecutionSectionKey;
  targetRecordId?: string;
  targetRecordType?: ExecutionRecordType;
  targetProject?: string;
  intentLabel?: string;
  reason?: string;
  routeKind: 'review' | 'action' | 'context';
  createdAt: string;
}

export interface ExecutionMetricsVocabulary {
  visible: number;
  dueNow: number;
  overdue: number;
  blockedOrAtRisk: number;
  waiting: number;
  readyToClose: number;
  cleanup: number;
  linkedOpenWork: number;
  selected: number;
  routed: number;
}
