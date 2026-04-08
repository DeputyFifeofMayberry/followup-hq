import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { resolveExecutionLaneSelection } from '../../shared';

const BASE_TRIAGE_LIMIT = 24;
const TRIAGE_INCREMENT = 24;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;

export type OverviewFilterKey = 'all' | 'due_now' | 'blocked' | 'waiting' | 'ready_close';

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

function normalizeSearchValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeSearchValue(entry))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (!value) return '';
  const normalized = String(value).trim().toLowerCase();
  return normalized;
}

function buildSearchHaystack(row: UnifiedQueueItem): string {
  return [
    row.title,
    row.project,
    row.owner,
    row.assignee,
    row.primaryNextAction,
    row.whyInQueue,
    row.queueReasons,
    row.summary,
    row.notesPreview,
  ]
    .map((part) => normalizeSearchValue(part))
    .filter(Boolean)
    .join(' ');
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
  const [searchQuery, setSearchQuery] = useState('');
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

  const normalizedQuery = useMemo(() => normalizeSearchValue(searchQuery), [searchQuery]);
  const searchedRows = useMemo(() => {
    if (!normalizedQuery) return filteredRows;
    return filteredRows.filter((row) => buildSearchHaystack(row).includes(normalizedQuery));
  }, [filteredRows, normalizedQuery]);

  const visibleRows = useMemo(() => searchedRows.slice(0, visibleLimit), [searchedRows, visibleLimit]);
  const searchedIds = useMemo(() => searchedRows.map((row) => row.id), [searchedRows]);

  useEffect(() => {
    setVisibleLimit(BASE_TRIAGE_LIMIT);
  }, [selectedFilter, normalizedQuery]);

  useEffect(() => {
    const resolved = resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: searchedIds });
    if (resolved !== store.executionSelectedId) {
      store.setExecutionSelectedId(resolved);
    }
  }, [searchedIds, store]);

  const selected = useMemo(() => {
    const selectedId = resolveExecutionLaneSelection({ selectedId: store.executionSelectedId, queueIds: searchedIds });
    if (!selectedId) return null;
    return searchedRows.find((row) => row.id === selectedId) || null;
  }, [store.executionSelectedId, searchedIds, searchedRows]);

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
        intentLabel: 'move due commitments forward now',
      },
      {
        key: 'blocked',
        label: 'Blocked',
        count: blockedRows.length,
        filterSummary: 'Stalled work that needs unblock decisions.',
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
        filterSummary: 'Items ready for close confirmation.',
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
    selectedFilter,
    setSelectedFilter,
    searchQuery,
    setSearchQuery,
    filteredRows,
    searchedRows,
    visibleRows,
    filteredCount: filteredRows.length,
    searchedCount: searchedRows.length,
    visibleCount: visibleRows.length,
    selected,
    signalCards,
    hasMoreRows: searchedRows.length > visibleRows.length,
    showMoreRows: () => setVisibleLimit((current) => current + TRIAGE_INCREMENT),
    openCreateWorkModal: store.openCreateWorkModal,
    setSelectedId: store.setExecutionSelectedId,
    routeToLane,
    openSelectedDetail,
  };
}
