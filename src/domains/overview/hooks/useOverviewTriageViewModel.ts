import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ExecutionRouteTarget, ExecutionSectionKey, UnifiedQueueItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { selectMaterializedUnifiedQueue } from '../../../store/selectors/unifiedQueue';
import { buildExecutionQueueStats } from '../../shared/selectors/executionQueueSelectors';
import { resolveExecutionLaneSelection } from '../../shared';

const BASE_TRIAGE_LIMIT = 24;
const TRIAGE_INCREMENT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

type LaneTarget = Exclude<ExecutionRouteTarget, 'overview'>;
type OverviewDashboardSection = Extract<ExecutionSectionKey, 'now' | 'triage' | 'blocked' | 'ready_to_close'>;

type RowPredicate = (row: UnifiedQueueItem) => boolean;

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

export interface OverviewDashboardMetric {
  count: number;
  sampleRowId?: string;
}

export interface OverviewDashboardCommitments {
  overdue: OverviewDashboardMetric;
  dueToday: OverviewDashboardMetric;
  dueWithin7Days: OverviewDashboardMetric;
  waitingTooLong: OverviewDashboardMetric;
  readyToClose: OverviewDashboardMetric;
}

export interface OverviewDashboardOwnershipRisk {
  unassigned: OverviewDashboardMetric;
  noDate: OverviewDashboardMetric;
  cleanupRequired: OverviewDashboardMetric;
  orphanedTask: OverviewDashboardMetric;
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

export interface OverviewDashboardQueueContext {
  source: string;
  label: string;
  description: string;
  secondaryRouteOut?: {
    lane: LaneTarget;
    section: ExecutionSectionKey;
    intentLabel: string;
  };
}

export interface OverviewDashboardQueueIntent {
  source: string;
  label: string;
  description: string;
  filterKey?: OverviewFilterKey;
  predicate?: RowPredicate;
  preferredRowId?: string;
  clearSearch?: boolean;
  secondaryRouteOut?: {
    lane: LaneTarget;
    section: ExecutionSectionKey;
    intentLabel: string;
  };
}

export type OverviewDashboardAction =
  | { type: 'focus_filter'; filterKey: OverviewFilterKey }
  | { type: 'focus_kpi'; key: OverviewDashboardKpi['key'] }
  | { type: 'focus_lane_health'; key: OverviewDashboardLaneHealth['key'] }
  | { type: 'focus_hotspot'; project: string }
  | { type: 'focus_commitment'; key: keyof OverviewDashboardCommitments }
  | { type: 'focus_ownership_risk'; key: keyof OverviewDashboardOwnershipRisk }
  | { type: 'focus_next_up'; rowId: string }
  | { type: 'reset_focus' }
  | { type: 'route_lane'; lane: LaneTarget; section: ExecutionSectionKey; intentLabel: string; recordId?: string }
  | { type: 'open_create_work' }
  | { type: 'open_intake' };

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

function findSampleRowId(rows: UnifiedQueueItem[], predicate: RowPredicate): string | undefined {
  return rows.find((row) => predicate(row))?.id;
}

const isReviewRow: RowPredicate = (row) => row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask;
const isWaitingRow: RowPredicate = (row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong;
const isDueNowRow: RowPredicate = (row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday;
const isDueTodayRow: RowPredicate = (row) => row.queueFlags.dueToday || row.queueFlags.needsTouchToday;
const isBlockedRow: RowPredicate = (row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk;
const isNoDateRow: RowPredicate = (row) => !row.dueDate && !row.promisedDate && !row.nextTouchDate;
const isUnassignedRow: RowPredicate = (row) => !(row.assignee?.trim() || row.owner?.trim());

export function useOverviewTriageViewModel() {
  const store = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    queuePreset: s.queuePreset,
    executionFilter: s.executionFilter,
    executionSort: s.executionSort,
    hydrated: s.hydrated,
    executionSelectedId: s.executionSelectedId,
    setExecutionSelectedId: s.setExecutionSelectedId,
    openExecutionLane: s.openExecutionLane,
    openRecordDrawer: s.openRecordDrawer,
    openCreateWorkModal: s.openCreateWorkModal,
  })));

  const queue = useMemo(() => selectMaterializedUnifiedQueue({
    items: store.items,
    tasks: store.tasks,
    queuePreset: store.queuePreset,
    executionFilter: store.executionFilter,
    executionSort: store.executionSort,
  }), [store.items, store.tasks, store.queuePreset, store.executionFilter, store.executionSort]);
  const [selectedFilter, setSelectedFilter] = useState<OverviewFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(BASE_TRIAGE_LIMIT);
  const [dashboardQueueContext, setDashboardQueueContext] = useState<OverviewDashboardQueueContext | null>(null);
  const [dashboardPredicate, setDashboardPredicate] = useState<RowPredicate | null>(null);

  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);

  const signalPredicates: Record<Exclude<OverviewFilterKey, 'all'>, RowPredicate> = useMemo(() => ({
    due_now: isDueNowRow,
    blocked: isBlockedRow,
    waiting: isWaitingRow,
    ready_close: (row) => row.queueFlags.readyToCloseParent,
  }), []);

  const matchesFilter = (row: UnifiedQueueItem, filterKey: OverviewFilterKey) => {
    if (filterKey === 'all') return true;
    return signalPredicates[filterKey](row);
  };

  const filteredRows = useMemo(() => {
    const baseRows = selectedFilter === 'all' ? queue : queue.filter((row) => signalPredicates[selectedFilter]?.(row));
    if (!dashboardPredicate) return baseRows;
    return baseRows.filter((row) => dashboardPredicate(row));
  }, [queue, selectedFilter, signalPredicates, dashboardPredicate]);

  const normalizedQuery = useMemo(() => normalizeSearchValue(searchQuery), [searchQuery]);
  const searchedRows = useMemo(() => {
    if (!normalizedQuery) return filteredRows;
    return filteredRows.filter((row) => buildSearchHaystack(row).includes(normalizedQuery));
  }, [filteredRows, normalizedQuery]);

  const visibleRows = useMemo(() => searchedRows.slice(0, visibleLimit), [searchedRows, visibleLimit]);
  const searchedIds = useMemo(() => searchedRows.map((row) => row.id), [searchedRows]);

  useEffect(() => {
    setVisibleLimit(BASE_TRIAGE_LIMIT);
  }, [selectedFilter, normalizedQuery, dashboardQueueContext]);

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
    const dueNowRows = queue.filter(isDueNowRow);
    const blockedRows = queue.filter(isBlockedRow);
    const waitingRows = queue.filter(isWaitingRow);
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
    const pressureRows = queue.filter((row) => isDueNowRow(row) || isBlockedRow(row));
    const dueNowRows = queue.filter(isDueNowRow);
    const blockedRows = queue.filter(isBlockedRow);
    const needsReviewRows = queue.filter(isReviewRow);
    const dueWithin7DaysPredicate: RowPredicate = (row) => isDueWithinDays(row.dueDate ?? row.promisedDate ?? row.nextTouchDate, 7, Date.now());
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
        const blockedCount = hotspot.rows.filter(isBlockedRow).length;
        const dueNowCount = hotspot.rows.filter(isDueNowRow).length;
        const waitingCount = hotspot.rows.filter(isWaitingRow).length;
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
      overdue: {
        count: queue.filter((row) => row.queueFlags.overdue).length,
        sampleRowId: findSampleRowId(queue, (row) => row.queueFlags.overdue),
      },
      dueToday: {
        count: queue.filter(isDueTodayRow).length,
        sampleRowId: findSampleRowId(queue, isDueTodayRow),
      },
      dueWithin7Days: {
        count: queue.filter(dueWithin7DaysPredicate).length,
        sampleRowId: findSampleRowId(queue, dueWithin7DaysPredicate),
      },
      waitingTooLong: {
        count: queue.filter((row) => row.queueFlags.waitingTooLong).length,
        sampleRowId: findSampleRowId(queue, (row) => row.queueFlags.waitingTooLong),
      },
      readyToClose: {
        count: readyRows.length,
        sampleRowId: findSampleRowId(queue, (row) => row.queueFlags.readyToCloseParent),
      },
    };

    const ownershipRisk: OverviewDashboardOwnershipRisk = {
      unassigned: {
        count: queue.filter(isUnassignedRow).length,
        sampleRowId: findSampleRowId(queue, isUnassignedRow),
      },
      noDate: {
        count: queue.filter(isNoDateRow).length,
        sampleRowId: findSampleRowId(queue, isNoDateRow),
      },
      cleanupRequired: {
        count: queue.filter((row) => row.queueFlags.cleanupRequired).length,
        sampleRowId: findSampleRowId(queue, (row) => row.queueFlags.cleanupRequired),
      },
      orphanedTask: {
        count: queue.filter((row) => row.queueFlags.orphanedTask).length,
        sampleRowId: findSampleRowId(queue, (row) => row.queueFlags.orphanedTask),
      },
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
      { key: 'waiting', label: 'Waiting lane', value: queue.filter(isWaitingRow).length, helper: 'Dependencies waiting on response.', lane: 'followups', section: 'triage', filterKey: 'waiting' },
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

  const applyDashboardQueueIntent = (intent: OverviewDashboardQueueIntent) => {
    const filterKey = intent.filterKey ?? 'all';
    const predicate = intent.predicate ?? (() => true);

    if (intent.clearSearch ?? true) {
      setSearchQuery('');
    }

    setSelectedFilter(filterKey);
    setDashboardPredicate(() => predicate);
    setDashboardQueueContext({
      source: intent.source,
      label: intent.label,
      description: intent.description,
      secondaryRouteOut: intent.secondaryRouteOut,
    });

    const focusedRows = queue.filter((row) => matchesFilter(row, filterKey) && predicate(row));
    const nextSelectedId = focusedRows.find((row) => row.id === intent.preferredRowId)?.id ?? focusedRows[0]?.id ?? null;
    store.setExecutionSelectedId(nextSelectedId);
  };

  const clearDashboardQueueFocus = (resetToFull = false) => {
    setDashboardPredicate(null);
    setDashboardQueueContext(null);
    if (resetToFull) {
      setSelectedFilter('all');
      setSearchQuery('');
    }
  };

  const selectQueueFilter = (filterKey: OverviewFilterKey) => {
    setSelectedFilter(filterKey);
    clearDashboardQueueFocus(false);
  };

  const resolveDashboardQueueIntent = (action: OverviewDashboardAction): OverviewDashboardQueueIntent | null => {
    switch (action.type) {
      case 'focus_filter': {
        const label = action.filterKey === 'all'
          ? 'Full queue'
          : action.filterKey === 'due_now'
            ? 'Due now'
            : action.filterKey === 'blocked'
              ? 'Blocked'
              : action.filterKey === 'waiting'
                ? 'Waiting'
                : 'Ready to close';
        return {
          source: 'Dashboard filter',
          label,
          description: action.filterKey === 'all' ? 'Showing the full overview queue.' : `Focused to ${label.toLowerCase()} work from dashboard controls.`,
          filterKey: action.filterKey,
        };
      }
      case 'focus_kpi': {
        const kpi = dashboard.kpis.find((entry) => entry.key === action.key);
        if (!kpi) return null;
        if (kpi.key === 'needs_review') {
          return {
            source: 'KPI',
            label: 'Needs review',
            description: 'Focused to cleanup-required or orphaned records from the KPI panel.',
            predicate: isReviewRow,
          };
        }
        return {
          source: 'KPI',
          label: kpi.label,
          description: `Focused from KPI: ${kpi.helper}`,
          filterKey: kpi.filterKey ?? 'all',
        };
      }
      case 'focus_lane_health': {
        const lane = dashboard.laneHealth.find((entry) => entry.key === action.key);
        if (!lane) return null;
        return {
          source: 'Lane health',
          label: lane.label,
          description: lane.helper,
          filterKey: lane.filterKey ?? 'all',
          predicate: lane.key === 'tasks'
            ? (row) => row.recordType === 'task'
            : lane.key === 'followups'
              ? (row) => row.recordType === 'followup'
              : lane.key === 'review'
                ? isReviewRow
                : undefined,
          secondaryRouteOut: { lane: lane.lane, section: lane.section, intentLabel: `review ${lane.label.toLowerCase()}` },
        };
      }
      case 'focus_hotspot': {
        const hotspot = dashboard.hotspots.find((entry) => entry.project === action.project);
        if (!hotspot) return null;
        return {
          source: 'Project hotspot',
          label: hotspot.project,
          description: `Focused to ${hotspot.project} pressure slice from hotspot panel.`,
          filterKey: hotspot.filterKey,
          preferredRowId: hotspot.sampleRowId,
          predicate: (row) => (row.project?.trim() || 'No project') === hotspot.project,
          secondaryRouteOut: { lane: hotspot.lane, section: hotspot.section, intentLabel: `review ${hotspot.project} hotspot` },
        };
      }
      case 'focus_commitment': {
        const commitmentMap: Record<keyof OverviewDashboardCommitments, OverviewDashboardQueueIntent> = {
          overdue: {
            source: 'Commitment pressure',
            label: 'Overdue commitments',
            description: 'Items already overdue and needing immediate action.',
            filterKey: 'due_now',
            preferredRowId: dashboard.commitments.overdue.sampleRowId,
            predicate: (row) => row.queueFlags.overdue,
          },
          dueToday: {
            source: 'Commitment pressure',
            label: 'Due today commitments',
            description: 'Items due today or touch-due today.',
            filterKey: 'due_now',
            preferredRowId: dashboard.commitments.dueToday.sampleRowId,
            predicate: isDueTodayRow,
          },
          dueWithin7Days: {
            source: 'Commitment pressure',
            label: 'Due in 7 days',
            description: 'Upcoming commitments due in the next 7 days.',
            filterKey: 'all',
            preferredRowId: dashboard.commitments.dueWithin7Days.sampleRowId,
            predicate: (row) => isDueWithinDays(row.dueDate ?? row.promisedDate ?? row.nextTouchDate, 7, Date.now()),
          },
          waitingTooLong: {
            source: 'Commitment pressure',
            label: 'Waiting too long',
            description: 'Items stalled on dependency responses for too long.',
            filterKey: 'waiting',
            preferredRowId: dashboard.commitments.waitingTooLong.sampleRowId,
            predicate: (row) => row.queueFlags.waitingTooLong,
          },
          readyToClose: {
            source: 'Commitment pressure',
            label: 'Ready to close',
            description: 'Follow-ups and tasks with closeout opportunity now.',
            filterKey: 'ready_close',
            preferredRowId: dashboard.commitments.readyToClose.sampleRowId,
            predicate: (row) => row.queueFlags.readyToCloseParent,
          },
        };
        return commitmentMap[action.key];
      }
      case 'focus_ownership_risk': {
        const ownershipMap: Record<keyof OverviewDashboardOwnershipRisk, OverviewDashboardQueueIntent> = {
          unassigned: {
            source: 'Ownership/data risk',
            label: 'Unassigned',
            description: 'Records without an owner or assignee.',
            preferredRowId: dashboard.ownershipRisk.unassigned.sampleRowId,
            predicate: isUnassignedRow,
          },
          noDate: {
            source: 'Ownership/data risk',
            label: 'No date set',
            description: 'Records missing due, promised, and next-touch dates.',
            preferredRowId: dashboard.ownershipRisk.noDate.sampleRowId,
            predicate: isNoDateRow,
          },
          cleanupRequired: {
            source: 'Ownership/data risk',
            label: 'Cleanup required',
            description: 'Records marked as cleanup-required.',
            preferredRowId: dashboard.ownershipRisk.cleanupRequired.sampleRowId,
            predicate: (row) => row.queueFlags.cleanupRequired,
          },
          orphanedTask: {
            source: 'Ownership/data risk',
            label: 'Orphaned tasks',
            description: 'Tasks missing valid parent linkage.',
            preferredRowId: dashboard.ownershipRisk.orphanedTask.sampleRowId,
            predicate: (row) => row.queueFlags.orphanedTask,
          },
        };
        return ownershipMap[action.key];
      }
      case 'focus_next_up': {
        const row = dashboard.nextUpRows.find((entry) => entry.id === action.rowId);
        if (!row) return null;
        return {
          source: 'Next up',
          label: row.title,
          description: `Inspecting prioritized ${row.recordType === 'task' ? 'task' : 'follow-up'} in queue.`,
          filterKey: row.section === 'blocked' ? 'blocked' : row.section === 'now' ? 'due_now' : 'all',
          preferredRowId: row.id,
          secondaryRouteOut: { lane: row.lane, section: row.section, intentLabel: `continue ${row.recordType === 'task' ? 'task' : 'follow-up'} execution` },
        };
      }
      default:
        return null;
    }
  };

  const runDashboardAction = (action: OverviewDashboardAction): 'focused' | 'reset' | 'noop' => {
    if (action.type === 'reset_focus') {
      clearDashboardQueueFocus(true);
      return 'reset';
    }

    if (action.type === 'focus_filter' && action.filterKey === 'all') {
      clearDashboardQueueFocus(true);
      return 'focused';
    }

    const intent = resolveDashboardQueueIntent(action);
    if (!intent) return 'noop';
    applyDashboardQueueIntent(intent);
    return 'focused';
  };

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
    hydrated: store.hydrated,
    stats,
    dashboard,
    selectedFilter,
    selectQueueFilter,
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
    dashboardQueueContext,
    hasMoreRows: searchedRows.length > visibleRows.length,
    showMoreRows: () => setVisibleLimit((current) => current + TRIAGE_INCREMENT),
    openCreateWorkModal: store.openCreateWorkModal,
    setSelectedId: store.setExecutionSelectedId,
    applyDashboardQueueIntent,
    clearDashboardQueueFocus,
    runDashboardAction,
    routeToLane,
    openSelectedDetail,
  };
}
