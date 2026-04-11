import { getExecutionLaneNextSelection } from '../../shared/executionLane/helpers';

export function resolveFollowUpInspectorProgression(
  queueIds: string[],
  currentId: string,
  stillVisible: boolean,
): { nextId: string | null; reason: 'kept_current' | 'advanced_next' | 'fallback_previous' | 'cleared' } {
  if (stillVisible) return { nextId: currentId, reason: 'kept_current' };
  const progression = getExecutionLaneNextSelection(queueIds, currentId, [currentId]);
  return { nextId: progression.nextSelectedId, reason: progression.reason };
}
