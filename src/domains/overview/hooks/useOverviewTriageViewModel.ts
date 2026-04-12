import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { resolveExecutionLaneSelection } from '../../shared';

const BASE_TRIAGE_LIMIT = 24;
const TRIAGE_INCREMENT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;
type OverviewDashboardSection = Extract<ExecutionSectionKey, 'now' | 'triage' | 'blocked' | 'ready_to_close'>;

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

export interface OverviewDashboardKpi {
  key: 'pressure_now' | 'due_now' | 'blocked' | 'needs_review' | 'ready_to_close';
  label: string;
  value: number;
  helper: string;
  tone: 'default' | 'warn' | 'danger' | 'info';
  filterKey?: OverviewFilterKey;
}

export interface OverviewDashboardNextUpRow {
  id: string;
  title: string;
  recordType: UnifiedQueueItem['recordType'];
  project: string;
  ownerLabel: string;
  dueLabel: string;
  reason: string;
  priority: UnifiedQueueItem['priority'];
  score: number;
  lane: LaneTarget;
  section: OverviewDashboardSection;
}

export interface OverviewDashboardLaneHealth {
  key: 'tasks' | 'followups' | 'blocked' | 'waiting' | 'review';
  label: string;
  value: number;
  helper: string;
  lane: LaneTarget;
  section: OverviewDashboardSection;
  filterKey?: OverviewFilterKey;
}

export interface OverviewDashboardProjectHotspot {
  project: string;
  pressureCount: number;
  blockedCount: number;
  dueNowCount: number;
  readyToCloseCount: number;
  lane: LaneTarget;
  section: OverviewDashboardSection;
  filterKey: OverviewFilterKey;
  sampleRowId?: string;
}

export interface OverviewDashboardCommitments {
  overdue: number;
  dueToday: number;
  dueWithin7Days: number;
  waitingTooLong: number;
  readyToClose: number;
}

export interface OverviewDashboardOwnershipRisk {
  unassigned: number;
  noDate: number;
  cleanupRequired: number;
  orphanedTask: number;
}

export interface OverviewDashboardModel {
  totalQueue: number;
  kpis: OverviewDashboardKpi[];
  nextUpRows: OverviewDashboardNextUpRow[];
  laneHealth: OverviewDashboardLaneHealth[];
  hotspots: OverviewDashboardProjectHotspot[];
  commitments: OverviewDashboardCommitments;
  ownershipRisk: OverviewDashboardOwnershipRisk;
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

function isDueWithinDays(rawDate: string | undefined, days: number, now: number) {
  if (!rawDate) return false;
  const dueAt = Date.parse(rawDate);
  if (Number.isNaN(dueAt)) return false;
  if (dueAt < now) return false;
  return dueAt <= now + (days * DAY_MS);
}

function resolveDashboardSection(row: UnifiedQueueItem): OverviewDashboardSection {
  if (row.queueFlags.blocked || row.queueFlags.parentAtRisk) return 'blocked';
  if (row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday) return 'now';
  if (row.queueFlags.readyToCloseParent) return 'ready_to_close';
  return 'triage';
}

function formatDashboardDueLabel(row: UnifiedQueueItem): string {
  if (row.queueFlags.overdue) return 'Overdue';
  if (row.queueFlags.dueToday || row.queueFlags.needsTouchToday) return 'Due today';
  if (isDueWithinDays(row.dueDate ?? row.promisedDate ?? row.nextTouchDate, 7, Date.now())) return 'Due in 7d';
  if (row.dueDate) return `Due ${new Date(row.dueDate).toLocaleDateString()}`;
  if (row.promisedDate) return `Promised ${new Date(row.promisedDate).toLocaleDateString()}`;
  if (row.nextTouchDate) return `Touch ${new Date(row.nextTouchDate).toLocaleDateString()}`;
  return 'No date';
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

  const dashboard = useMemo<OverviewDashboardModel>(() => {
    const now = Date.now();
    const pressureRows = queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday || row.queueFlags.blocked || row.queueFlags.parentAtRisk);
    const dueNowRows = queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday);
    const blockedRows = queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk);
    const needsReviewRows = queue.filter((row) => row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask);
    const readyRows = queue.filter((row) => row.queueFlags.readyToCloseParent);

    const sortedByScore = [...queue].sort((a, b) => b.score - a.score);
    const nextUpRows = sortedByScore.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.title,
      recordType: row.recordType,
      project: row.project || 'No project',
      ownerLabel: row.assignee?.trim() || row.owner?.trim() || 'Unassigned',
      dueLabel: formatDashboardDueLabel(row),
      reason: row.queueReasons[0] || row.whyInQueue,
      priority: row.priority,
      score: row.score,
      lane: row.recordType === 'task' ? 'tasks' as LaneTarget : 'followups' as LaneTarget,
      section: resolveDashboardSection(row),
    }));

    const hotspotMap = new Map<string, OverviewDashboardProjectHotspot & { rows: UnifiedQueueItem[] }>();
    pressureRows.forEach((row) => {
      const project = row.project?.trim() || 'No project';
      const current = hotspotMap.get(project) ?? {
        project,
        pressureCount: 0,
        blockedCount: 0,
        dueNowCount: 0,
        readyToCloseCount: 0,
        lane: row.recordType === 'task' ? 'tasks' as LaneTarget : 'followups' as LaneTarget,
        section: resolveDashboardSection(row),
        filterKey: 'due_now' as OverviewFilterKey,
        sampleRowId: row.id,
        rows: [],
      };
      current.pressureCount += 1;
      if (row.queueFlags.blocked || row.queueFlags.parentAtRisk) current.blockedCount += 1;
      if (row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday) current.dueNowCount += 1;
      if (row.queueFlags.readyToCloseParent) current.readyToCloseCount += 1;
      current.rows.push(row);
      hotspotMap.set(project, current);
    });

    const hotspots = [...hotspotMap.values()]
      .map((hotspot) => {
        const blockedCount = hotspot.rows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length;
        const dueNowCount = hotspot.rows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length;
        const waitingCount = hotspot.rows.filter((row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong).length;
        const lane = pickLaneForRows(hotspot.rows, 'tasks');
        const section: OverviewDashboardSection = blockedCount > 0 ? 'blocked' : dueNowCount > 0 ? 'now' : 'triage';
        const filterKey: OverviewFilterKey = blockedCount > 0 ? 'blocked' : dueNowCount > 0 ? 'due_now' : waitingCount > 0 ? 'waiting' : 'all';
        return {
          project: hotspot.project,
          pressureCount: hotspot.pressureCount,
          blockedCount: hotspot.blockedCount,
          dueNowCount: hotspot.dueNowCount,
          readyToCloseCount: hotspot.readyToCloseCount,
          lane,
          section,
          filterKey,
          sampleRowId: hotspot.rows[0]?.id,
        };
      })
      .sort((a, b) => {
        if (b.pressureCount !== a.pressureCount) return b.pressureCount - a.pressureCount;
        if (b.blockedCount !== a.blockedCount) return b.blockedCount - a.blockedCount;
        return a.project.localeCompare(b.project);
      })
      .slice(0, 5);

    const commitments: OverviewDashboardCommitments = {
      overdue: queue.filter((row) => row.queueFlags.overdue).length,
      dueToday: queue.filter((row) => row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
      dueWithin7Days: queue.filter((row) => isDueWithinDays(row.dueDate ?? row.promisedDate ?? row.nextTouchDate, 7, now)).length,
      waitingTooLong: queue.filter((row) => row.queueFlags.waitingTooLong).length,
      readyToClose: readyRows.length,
    };

    const ownershipRisk: OverviewDashboardOwnershipRisk = {
      unassigned: queue.filter((row) => !(row.assignee?.trim() || row.owner?.trim())).length,
      noDate: queue.filter((row) => !row.dueDate && !row.promisedDate && !row.nextTouchDate).length,
      cleanupRequired: queue.filter((row) => row.queueFlags.cleanupRequired).length,
      orphanedTask: queue.filter((row) => row.queueFlags.orphanedTask).length,
    };

    const kpis: OverviewDashboardKpi[] = [
      { key: 'pressure_now', label: 'Pressure now', value: pressureRows.length, helper: 'Due or blocked commitments needing attention.', tone: pressureRows.length > 0 ? 'danger' : 'default' },
      { key: 'due_now', label: 'Due now', value: dueNowRows.length, helper: 'Overdue, due today, or touch due today.', tone: dueNowRows.length > 0 ? 'warn' : 'default', filterKey: 'due_now' },
      { key: 'blocked', label: 'Blocked', value: blockedRows.length, helper: 'Execution blocked or parent at risk.', tone: blockedRows.length > 0 ? 'warn' : 'default', filterKey: 'blocked' },
      { key: 'needs_review', label: 'Needs review', value: needsReviewRows.length, helper: 'Cleanup-required or orphaned work.', tone: needsReviewRows.length > 0 ? 'info' : 'default' },
      { key: 'ready_to_close', label: 'Ready to close', value: readyRows.length, helper: 'Closeout opportunities available now.', tone: readyRows.length > 0 ? 'info' : 'default', filterKey: 'ready_close' },
    ];

    const laneHealth: OverviewDashboardLaneHealth[] = [
      { key: 'tasks', label: 'Tasks lane', value: queue.filter((row) => row.recordType === 'task').length, helper: 'Task records in current queue.', lane: 'tasks', section: 'now' },
      { key: 'followups', label: 'Follow Ups lane', value: queue.filter((row) => row.recordType === 'followup').length, helper: 'Follow-ups requiring movement.', lane: 'followups', section: 'triage' },
      { key: 'blocked', label: 'Blocked lane', value: blockedRows.length, helper: 'Route to unblock decisions.', lane: pickLaneForRows(blockedRows, 'tasks'), section: 'blocked', filterKey: 'blocked' },
      { key: 'waiting', label: 'Waiting lane', value: queue.filter((row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong).length, helper: 'Dependencies waiting on response.', lane: 'followups', section: 'triage', filterKey: 'waiting' },
      { key: 'review', label: 'Review lane', value: needsReviewRows.length, helper: 'Cleanup and structural review pressure.', lane: pickLaneForRows(needsReviewRows, 'followups'), section: 'triage' },
    ];

    return {
      totalQueue: queue.length,
      kpis,
      nextUpRows,
      laneHealth,
      hotspots,
      commitments,
      ownershipRisk,
    };
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
    dashboard,
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
