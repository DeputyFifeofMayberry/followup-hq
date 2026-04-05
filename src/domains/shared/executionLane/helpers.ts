import { executionSourceLabel } from '../../../lib/executionHandoff';
import type { ExecutionIntent } from '../../../types';
import type { ExecutionLaneHandoff, ExecutionLaneProgressionResult, ExecutionLaneSelectionState } from './types';

export function toExecutionLaneHandoff(intent: ExecutionIntent): ExecutionLaneHandoff {
  const source = intent.source ?? 'overview';
  return {
    source,
    sourceLabel: executionSourceLabel[source],
    destination: intent.target,
    targetLabel: intent.target === 'tasks' ? 'Tasks lane' : intent.target === 'followups' ? 'Follow-Ups lane' : 'Overview lane',
    section: intent.section,
    intentLabel: intent.intentLabel,
    recordId: intent.recordId,
    project: intent.project,
    createdAt: intent.createdAt,
  };
}

export function describeHandoffMission(handoff: ExecutionLaneHandoff): string {
  const bits = [
    `From ${handoff.sourceLabel}`,
    handoff.intentLabel,
    handoff.project ? `Project: ${handoff.project}` : null,
    handoff.section ? `Scope: ${handoff.section.replaceAll('_', ' ')}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

export function resolveExecutionLaneSelection(state: ExecutionLaneSelectionState): string | null {
  const { selectedId, queueIds, targetedId } = state;
  if (!queueIds.length) return null;
  if (targetedId && queueIds.includes(targetedId)) return targetedId;
  if (selectedId && queueIds.includes(selectedId)) return selectedId;
  return queueIds[0];
}

export function getExecutionLaneNextSelection(
  queueIds: string[],
  currentSelectedId: string | null,
  removedIds: string[] = [],
): ExecutionLaneProgressionResult {
  if (!queueIds.length) return { nextSelectedId: null, reason: 'cleared' };
  if (!currentSelectedId) return { nextSelectedId: queueIds[0], reason: 'advanced_next' };

  if (queueIds.includes(currentSelectedId) && !removedIds.includes(currentSelectedId)) {
    return { nextSelectedId: currentSelectedId, reason: 'kept_current' };
  }

  const combined = [...queueIds, ...removedIds];
  const removedIndex = combined.indexOf(currentSelectedId);
  const originIndex = removedIndex >= 0 ? removedIndex : 0;
  const nextCandidate = queueIds[originIndex] ?? queueIds[Math.max(originIndex - 1, 0)] ?? null;

  if (!nextCandidate) return { nextSelectedId: null, reason: 'cleared' };
  if (queueIds[originIndex] === nextCandidate) return { nextSelectedId: nextCandidate, reason: 'advanced_next' };
  return { nextSelectedId: nextCandidate, reason: 'fallback_previous' };
}
