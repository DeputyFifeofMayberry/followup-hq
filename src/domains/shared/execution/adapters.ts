import type { UnifiedQueueItem } from '../../../types';
import type { ExecutionLaneKey, ExecutionRecordSurface, ExecutionRecordSummary } from './types';

function inferSection(row: UnifiedQueueItem): 'now' | 'triage' | 'blocked' | 'ready_to_close' {
  if (row.queueFlags.readyToCloseParent) return 'ready_to_close';
  if (row.queueFlags.blocked || row.queueFlags.parentAtRisk || row.queueFlags.waiting) return 'blocked';
  if (row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask || row.queueFlags.waitingTooLong) return 'triage';
  return 'now';
}

function inferPreferredLane(row: UnifiedQueueItem): Exclude<ExecutionLaneKey, 'overview'> {
  if (row.recordType === 'task') return 'tasks';
  if (row.queueFlags.readyToCloseParent) return 'followups';
  return row.recordType === 'followup' ? 'followups' : 'tasks';
}

export function toExecutionRecordSurface(row: UnifiedQueueItem): ExecutionRecordSurface {
  return {
    id: row.id,
    recordType: row.recordType,
    title: row.title,
    project: row.project,
    owner: row.owner,
    assignee: row.assignee,
    status: row.status,
    primaryDates: {
      dueDate: row.dueDate,
      nextTouchDate: row.nextTouchDate,
      promisedDate: row.promisedDate,
      updatedAt: row.updatedAt,
    },
    nextMoveSummary: row.primaryNextAction,
    urgencySignals: row.queueReasons,
    workflowState: row.workflowState,
    linkedContextSummary: row.linkedChildSummary || row.linkedParentTitle || row.completionImpactSummary,
    queueFlags: row.queueFlags,
    completionRelevance: row.queueFlags.readyToCloseParent ? 'ready_to_close' : row.completionImpact === 'advance_parent' ? 'advance_parent' : 'none',
    routeTarget: {
      preferredLane: inferPreferredLane(row),
      section: inferSection(row),
    },
    sourceItem: row,
  };
}

export function toExecutionRecordSummary(surface: ExecutionRecordSurface): ExecutionRecordSummary {
  return {
    id: surface.id,
    recordType: surface.recordType,
    title: surface.title,
    project: surface.project,
    owner: surface.owner,
    assignee: surface.assignee,
    status: surface.status,
    primaryDate: surface.primaryDates.dueDate || surface.primaryDates.nextTouchDate || surface.primaryDates.promisedDate,
    nextMove: surface.nextMoveSummary,
    timingSummary: surface.urgencySignals[0] || surface.sourceItem.whyInQueue,
    workflowState: surface.workflowState,
    linkedContextSummary: surface.linkedContextSummary,
  };
}
