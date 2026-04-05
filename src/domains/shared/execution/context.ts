import { deriveExecutionAttentionState } from './signals';
import type { ExecutionRecordSurface, ExecutionRouteHandoff } from './types';

export interface ExecutionSelectedContext {
  identity: string;
  title: string;
  topSignal: string;
  nextMove: string;
  timingPressure: string;
  linkedWork: string;
  routeContext?: string;
}

export function buildExecutionSelectedContext(surface: ExecutionRecordSurface | null, handoff?: ExecutionRouteHandoff | null): ExecutionSelectedContext | null {
  if (!surface) return null;
  const topSignal = deriveExecutionAttentionState(surface);

  const timingPressure = surface.queueFlags.overdue
    ? 'Overdue'
    : surface.queueFlags.dueToday
      ? 'Due today'
      : surface.queueFlags.needsTouchToday
        ? 'Touch due today'
        : 'No immediate timing pressure';

  const linkedOpenCount = surface.sourceItem.linkedOpenTaskCount ?? 0;

  return {
    identity: `${surface.recordType.toUpperCase()} · ${surface.id}`,
    title: surface.title,
    topSignal: topSignal.label,
    nextMove: surface.nextMoveSummary,
    timingPressure,
    linkedWork: linkedOpenCount > 0 ? `${linkedOpenCount} linked items open` : 'No linked work pressure',
    routeContext: handoff?.targetRecordId === surface.id
      ? `Opened from ${handoff.source} for ${handoff.intentLabel || 'execution handoff'}`
      : undefined,
  };
}
