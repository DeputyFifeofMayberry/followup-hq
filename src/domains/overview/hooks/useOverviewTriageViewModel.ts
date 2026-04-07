import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { resolveExecutionLaneSelection } from '../../shared';

const BASE_TRIAGE_LIMIT = 24;
const TRIAGE_INCREMENT = 24;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;

type OverviewFilterKey = 'all' | 'due_now' | 'blocked' | 'waiting' | 'ready_close';

export interface OverviewSignalCard {
  key: Exclude<OverviewFilterKey, 'all'>;
  label: string;
  count: number;
  filterSummary: string;
  lane: LaneTarget;
  section: ExecutionSectionKey;
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
    openCreateWorkModal: s.openCreateWorkModal,
  })));

  const queue = store.getUnifiedQueue();
  const [selectedFilter, setSelectedFilter] = useState<OverviewFilterKey>('all');
  const [visibleLimit, setVisibleLimit] = useState(BASE_TRIAGE_LIMIT);
  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);

  const signalPredicates: Record<Exclude<OverviewFilterKey, 'all'>, (row: UnifiedQueueItem) => boolean> = useMemo(() => ({
    due_now: (row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday,
    blocked: (row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk,
    waiting: (row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong,
    ready_close: (row) => row.queueFlags.readyToCloseParent,
  }), []);

  const filteredRows = useMemo(() => {
    if (selectedFilter === 'all') return queue;
    return queue.filter((row) => signalPredicates[selectedFilter]?.(row));
  }, [queue, selectedFilter, signalPredicates]);

  const triageRows = useMemo(() => filteredRows.slice(0, visibleLimit), [filteredRows, visibleLimit]);
  const triageIds = useMemo(() => triageRows.map((row) => row.id), [triageRows]);

  useEffect(() => {
    setVisibleLimit(BASE_TRIAGE_LIMIT);
  }, [selectedFilter]);

  useEffect(() => {
    const resolved = resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds });
    if (resolved !== store.executionSelectedId) {
      store.setExecutionSelectedId(resolved);
    }
  }, [triageIds, store]);

  const selected = triageRows.find((row) => row.id === resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds })) || null;

  const signalCards = useMemo<OverviewSignalCard[]>(() => {
    const dueNowRows = queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday);
    const blockedRows = queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk);
    const waitingRows = queue.filter((row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong);
    const readyToCloseRows = queue.filter((row) => row.queueFlags.readyToCloseParent);

    return [
      {
        key: 'due_now',
        label: 'Due now',
        count: dueNowRows.length,
        filterSummary: 'Requires same-day movement.',
        lane: pickLaneForRows(dueNowRows, 'tasks'),
        section: 'now',
        intentLabel: 'handle due now commitments',
      },
      {
        key: 'blocked',
        label: 'Blocked',
        count: blockedRows.length,
        filterSummary: 'Needs unblock or risk response.',
        lane: pickLaneForRows(blockedRows, 'tasks'),
        section: 'blocked',
        intentLabel: 'unblock at-risk work',
      },
      {
        key: 'waiting',
        label: 'Waiting',
        count: waitingRows.length,
        filterSummary: 'Stalled and waiting on others.',
        lane: pickLaneForRows(waitingRows, 'followups'),
        section: 'triage',
        intentLabel: 'clear waiting dependencies',
      },
      {
        key: 'ready_close',
        label: 'Ready to close',
        count: readyToCloseRows.length,
        filterSummary: 'Can close with quick verification.',
        lane: 'followups',
        section: 'ready_to_close',
        intentLabel: 'close ready follow-ups',
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
    selectedFilter,
    selected,
    signalCards,
    totalFilteredCount: filteredRows.length,
    hasMoreRows: filteredRows.length > triageRows.length,
    showMoreRows: () => setVisibleLimit((current) => current + TRIAGE_INCREMENT),
    openCreateWorkModal: store.openCreateWorkModal,
    setSelectedId: store.setExecutionSelectedId,
    setSelectedFilter,
    routeToLane,
    openSelectedDetail,
  };
}
