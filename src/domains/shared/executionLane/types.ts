import type { ExecutionIntent, ExecutionIntentSource, ExecutionSectionKey, ExecutionRouteTarget, UnifiedQueueItem } from '../../../types';

export type ExecutionLaneId = Exclude<ExecutionRouteTarget, 'overview'> | 'overview';

export interface ExecutionLaneRecordSummary {
  id: string;
  recordType: UnifiedQueueItem['recordType'];
  title: string;
  project: string;
  owner: string;
  assignee: string;
  status: string;
  priority: UnifiedQueueItem['priority'];
  nextStep: string;
  timingLabel: string;
}

export interface ExecutionLaneToolbarConfig {
  lane: ExecutionLaneId;
  searchLabel: string;
  focusLabel?: string;
  primaryControlsLabel: string;
  advancedControlsLabel?: string;
  createActionLabel: string;
}

export interface ExecutionLaneActionGroup {
  title: string;
  description?: string;
  primaryActions: string[];
  secondaryActions?: string[];
}

export interface ExecutionLaneSelectionState {
  selectedId: string | null;
  queueIds: string[];
  targetedId?: string | null;
}

export interface ExecutionLaneProgressionResult {
  nextSelectedId: string | null;
  reason: 'kept_current' | 'advanced_next' | 'fallback_previous' | 'cleared';
}

export interface ExecutionLaneHandoff {
  source: ExecutionIntentSource;
  sourceLabel: string;
  destination: ExecutionLaneId;
  targetLabel: string;
  section?: ExecutionSectionKey;
  intentLabel?: string;
  recordId?: string;
  project?: string;
  createdAt: string;
}

export type LaneIntent = Pick<ExecutionIntent, 'source' | 'target' | 'section' | 'intentLabel' | 'recordId' | 'project' | 'createdAt'>;
