import { getExecutionLaneNextSelection } from '../executionLane/helpers';
import type { ExecutionLaneDefinition } from './registry';

export function resolvePostActionSelection(
  lane: ExecutionLaneDefinition,
  queueIds: string[],
  selectedId: string | null,
  options?: { actionGroup?: 'close_complete' | 'defer_snooze' | 'route_lane'; removedIds?: string[] },
): string | null {
  const actionGroup = options?.actionGroup;
  if (actionGroup === 'defer_snooze' && lane.progression.stayOnDefer && selectedId && queueIds.includes(selectedId)) {
    return selectedId;
  }

  if (actionGroup === 'route_lane' && lane.progression.returnToSourceOnRouteAway) {
    return selectedId;
  }

  const progression = getExecutionLaneNextSelection(queueIds, selectedId, options?.removedIds ?? []);
  return progression.nextSelectedId;
}
