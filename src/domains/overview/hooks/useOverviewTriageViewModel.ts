import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { resolveExecutionLaneSelection } from '../../shared';

const TRIAGE_LIMIT = 12;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;

export interface OverviewSignalCard {
  key: string;
  label: string;
  count: number;
  lane: LaneTarget;
  section: ExecutionSectionKey;
  ctaLabel: string;
  intentLabel: string;
}

function pickLaneForRows(rows: UnifiedQueueItem[], fallback: LaneTarget): LaneTarget {
  const taskCount = rows.filter((row) => row.recordType === 'task').length;
  const followupCount = rows.length - taskCount;
  if (!rows.length) return fallback;
  return taskCount >= followupCount ? 'tasks' : 'followups';
}

export function useOverviewTriageViewModel() {
  const store = useAppStore(useShallow((s) => ({
    getUnifiedQueue: s.getUnifiedQueue,
    executionSelectedId: s.executionSelectedId,
    setExecutionSelectedId: s.setExecutionSelectedId,
    openExecutionLane: s.openExecutionLane,
    openRecordDrawer: s.openRecordDrawer,
    openCreateFromCapture: s.openCreateFromCapture,
  })));

  const queue = store.getUnifiedQueue();
  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);
  const triageRows = useMemo(() => queue.slice(0, TRIAGE_LIMIT), [queue]);

  const triageIds = useMemo(() => triageRows.map((row) => row.id), [triageRows]);

  useEffect(() => {
    const resolved = resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds });
    if (resolved !== store.executionSelectedId) {
      store.setExecutionSelectedId(resolved);
    }
  }, [triageIds, store]);

  const selected = triageRows.find((row) => row.id === (resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds }))) || null;

  const signalCards = useMemo<OverviewSignalCard[]>(() => {
    const dueNowRows = queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday);
    const readyToCloseRows = queue.filter((row) => row.queueFlags.readyToCloseParent);
    const blockedRows = queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk || row.queueFlags.waiting);
    const cleanupRows = queue.filter((row) => row.queueFlags.cleanupRequired || row.queueFlags.waitingTooLong || row.queueFlags.orphanedTask);

    return [
      {
        key: 'due_now',
        label: 'Due now',
        count: dueNowRows.length,
        lane: pickLaneForRows(dueNowRows, 'tasks'),
        section: 'now',
        ctaLabel: 'Open lane',
        intentLabel: 'handle due now commitments',
      },
      {
        key: 'ready_close',
        label: 'Ready to close',
        count: readyToCloseRows.length,
        lane: 'followups',
        section: 'ready_to_close',
        ctaLabel: 'Open Follow Ups',
        intentLabel: 'close ready follow-ups',
      },
      {
        key: 'blocked',
        label: 'Blocked / at risk',
        count: blockedRows.length,
        lane: pickLaneForRows(blockedRows, 'tasks'),
        section: 'blocked',
        ctaLabel: 'Open lane',
        intentLabel: 'unblock at-risk work',
      },
      {
        key: 'cleanup',
        label: 'Cleanup / review',
        count: cleanupRows.length,
        lane: pickLaneForRows(cleanupRows, 'followups'),
        section: 'triage',
        ctaLabel: 'Route cleanup',
        intentLabel: 'review cleanup and routing',
      },
    ];
  }, [queue]);

  const routeToLane = (lane: LaneTarget, options?: { record?: UnifiedQueueItem | null; section?: ExecutionSectionKey; intentLabel?: string }) => {
    store.openExecutionLane(lane, {
      source: 'overview',
      section: options?.section,
      intentLabel: options?.intentLabel,
      recordId: options?.record?.id,
      recordType: options?.record?.recordType,
      project: options?.record?.project,
    });
  };

  const openSelectedDetail = () => {
    if (!selected) return;
    store.openRecordDrawer({ type: selected.recordType, id: selected.id });
  };

  return {
    stats,
    triageRows,
    selected,
    signalCards,
    openCreateFromCapture: store.openCreateFromCapture,
    setSelectedId: store.setExecutionSelectedId,
    routeToLane,
    openSelectedDetail,
  };
}
