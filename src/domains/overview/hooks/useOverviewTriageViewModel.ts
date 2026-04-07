import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { buildExecutionLaneMetrics, resolveExecutionLaneSelection, selectExecutionLaneItems } from '../../shared';

const TRIAGE_LIMIT = 12;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;

export interface OverviewSignalCard {
  key: string;
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
    openCreateFromCapture: s.openCreateFromCapture,
  })));

  const queue = store.getUnifiedQueue();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);
  const executionItems = useMemo(() => selectExecutionLaneItems('overview', queue), [queue]);
  const sharedMetrics = useMemo(() => buildExecutionLaneMetrics(executionItems, store.executionSelectedId), [executionItems, store.executionSelectedId]);
  const signalPredicates = useMemo(() => ({
    due_now: (row: UnifiedQueueItem) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday,
    ready_close: (row: UnifiedQueueItem) => row.queueFlags.readyToCloseParent,
    blocked: (row: UnifiedQueueItem) => row.queueFlags.blocked || row.queueFlags.parentAtRisk || row.queueFlags.waiting,
    cleanup: (row: UnifiedQueueItem) => row.queueFlags.cleanupRequired || row.queueFlags.waitingTooLong || row.queueFlags.orphanedTask,
  }), []);

  const triageRows = useMemo(() => {
    const filteredQueue = selectedFilter === 'all'
      ? queue
      : queue.filter((row) => signalPredicates[selectedFilter as keyof typeof signalPredicates]?.(row));
    return filteredQueue.slice(0, TRIAGE_LIMIT);
  }, [queue, selectedFilter, signalPredicates]);

  const triageIds = useMemo(() => triageRows.map((row) => row.id), [triageRows]);

  useEffect(() => {
    const resolved = resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds });
    if (resolved !== store.executionSelectedId) {
      store.setExecutionSelectedId(resolved);
    }
  }, [triageIds, store]);

  const selected = triageRows.find((row) => row.id === (resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: triageIds }))) || null;

  const signalCards = useMemo<OverviewSignalCard[]>(() => {
    const dueNowRows = executionItems.filter((entry) => entry.surface.queueFlags.overdue || entry.surface.queueFlags.dueToday || entry.surface.queueFlags.needsTouchToday).map((entry) => entry.surface.sourceItem);
    const readyToCloseRows = executionItems.filter((entry) => entry.surface.queueFlags.readyToCloseParent).map((entry) => entry.surface.sourceItem);
    const blockedRows = executionItems.filter((entry) => entry.surface.queueFlags.blocked || entry.surface.queueFlags.parentAtRisk || entry.surface.queueFlags.waiting).map((entry) => entry.surface.sourceItem);
    const cleanupRows = executionItems.filter((entry) => entry.surface.queueFlags.cleanupRequired || entry.surface.queueFlags.waitingTooLong || entry.surface.queueFlags.orphanedTask).map((entry) => entry.surface.sourceItem);

    return [
      {
        key: 'due_now',
        label: 'Due now',
        count: dueNowRows.length,
        filterSummary: 'Work requiring same-day movement.',
        lane: pickLaneForRows(dueNowRows, 'tasks'),
        section: 'now',
        intentLabel: 'handle due now commitments',
      },
      {
        key: 'ready_close',
        label: 'Ready to close',
        count: readyToCloseRows.length,
        filterSummary: 'Items that can be closed after final verification.',
        lane: 'followups',
        section: 'ready_to_close',
        intentLabel: 'close ready follow-ups',
      },
      {
        key: 'blocked',
        label: 'Blocked / at risk',
        count: blockedRows.length,
        filterSummary: 'Commitments needing unblock or risk intervention.',
        lane: pickLaneForRows(blockedRows, 'tasks'),
        section: 'blocked',
        intentLabel: 'unblock at-risk work',
      },
      {
        key: 'cleanup',
        label: 'Cleanup / review',
        count: cleanupRows.length,
        filterSummary: 'Needs cleanup context before routing.',
        lane: pickLaneForRows(cleanupRows, 'followups'),
        section: 'triage',
        intentLabel: 'review cleanup and routing',
      },
    ];
  }, [executionItems]);

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
    sharedMetrics,
    triageRows,
    selectedFilter,
    selected,
    signalCards,
    openCreateFromCapture: store.openCreateFromCapture,
    setSelectedId: store.setExecutionSelectedId,
    setSelectedFilter,
    routeToLane,
    openSelectedDetail,
  };
}
