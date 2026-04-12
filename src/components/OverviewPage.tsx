import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppModal,
  AppModalBody,
  AppModalHeader,
  ExecutionFilterChipRow,
  ExecutionLaneInspectorCard,
  ExecutionLaneQueueCard,
  ExecutionToolbarSurface,
  NoMatchesState,
  WorkspaceContentFrame,
  WorkspacePage,
  WorkspacePrimaryLayout,
} from './ui/AppPrimitives';
import type { AppMode } from '../types';
import { OverviewDashboard } from './overview/OverviewDashboard';
import { OverviewSignalCards } from './overview/OverviewSignalCards';
import { OverviewTriageList } from './overview/OverviewTriageList';
import { OverviewRouteInspector } from './overview/OverviewRouteInspector';
import {
  useOverviewTriageViewModel,
  type OverviewDashboardLaneHealth,
  type OverviewDashboardModel,
  type OverviewDashboardProjectHotspot,
  type OverviewFilterKey,
} from '../domains/overview/hooks/useOverviewTriageViewModel';
import { useViewportBand } from '../hooks/useViewport';

type WorkspaceKey = 'overview' | 'followups' | 'tasks' | 'intake' | 'directory';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  personalMode?: boolean;
  appMode?: AppMode;
}

export function OverviewPage({ onOpenWorkspace, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: OverviewPageProps) {
  void appMode;
  const { isMobileLike } = useViewportBand();
  const {
    dashboard,
    selectedFilter,
    selectQueueFilter,
    selected,
    signalCards,
    dashboardQueueContext,
    searchQuery,
    setSearchQuery,
    visibleRows,
    searchedCount,
    visibleCount,
    hasMoreRows,
    showMoreRows,
    openCreateWorkModal,
    setSelectedId,
    applyDashboardQueueFocus,
    clearDashboardQueueFocus,
    routeToLane,
    openSelectedDetail,
  } = useOverviewTriageViewModel();

  const [detailOpen, setDetailOpen] = useState(false);
  const queueSurfaceRef = useRef<HTMLDivElement | null>(null);

  const focusQueueSurface = () => {
    queueSurfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (detailOpen && !selected) {
      setDetailOpen(false);
    }
  }, [detailOpen, selected]);

  const activeFilterMeta = signalCards.find((card) => card.key === selectedFilter);
  const queueStateText = useMemo(() => {
    const activeLabel = activeFilterMeta?.label ?? 'All queue';
    const summary = activeFilterMeta?.filterSummary ?? 'Highest-priority work across follow-ups and tasks.';
    const countPhrase = activeFilterMeta ? `${searchedCount} matches` : `${searchedCount} items`;
    const visiblePhrase = searchedCount > visibleCount ? ` · showing ${visibleCount}` : '';
    return `${activeLabel} · ${countPhrase}${visiblePhrase}. ${summary}`;
  }, [activeFilterMeta, searchedCount, visibleCount]);

  const inspectorTitle = selected ? `Route ${selected.recordType === 'task' ? 'task' : 'follow-up'}` : 'Route item';

  const handleDashboardFilterFocus = (filterKey: OverviewFilterKey) => {
    const filterLabel = filterKey === 'all' ? 'Full queue' : filterKey === 'due_now' ? 'Due now' : filterKey === 'blocked' ? 'Blocked' : filterKey === 'waiting' ? 'Waiting' : 'Ready to close';
    applyDashboardQueueFocus({
      source: 'Dashboard filter',
      label: filterLabel,
      description: filterKey === 'all' ? 'Showing the full overview queue.' : `Focused to ${filterLabel.toLowerCase()} work from dashboard controls.`,
      filterKey,
    });
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleKpiFocus = (kpi: OverviewDashboardModel['kpis'][number]) => {
    if (kpi.key === 'needs_review') {
      applyDashboardQueueFocus({
        source: 'KPI',
        label: 'Needs review',
        description: 'Focused to cleanup-required or orphaned records from the KPI panel.',
        predicate: (row) => row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask,
      });
    } else {
      applyDashboardQueueFocus({
        source: 'KPI',
        label: kpi.label,
        description: `Focused from KPI: ${kpi.helper}`,
        filterKey: kpi.filterKey ?? 'all',
      });
    }
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleLaneHealthFocus = (lane: OverviewDashboardLaneHealth) => {
    applyDashboardQueueFocus({
      source: 'Lane health',
      label: lane.label,
      description: lane.helper,
      filterKey: lane.filterKey ?? 'all',
      predicate: lane.key === 'tasks'
        ? (row) => row.recordType === 'task'
        : lane.key === 'followups'
          ? (row) => row.recordType === 'followup'
          : lane.key === 'review'
            ? (row) => row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask
            : undefined,
    });
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleHotspotFocus = (hotspot: OverviewDashboardProjectHotspot) => {
    applyDashboardQueueFocus({
      source: 'Project hotspot',
      label: hotspot.project,
      description: `Focused to ${hotspot.project} pressure slice from hotspot panel.`,
      filterKey: hotspot.filterKey,
      preferredRowId: hotspot.sampleRowId,
      predicate: (row) => (row.project?.trim() || 'No project') === hotspot.project,
    });
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleCommitmentFocus = (key: keyof OverviewDashboardModel['commitments']) => {
    const meta = {
      overdue: {
        label: 'Overdue commitments',
        description: 'Items already overdue and needing immediate action.',
        filterKey: 'due_now' as OverviewFilterKey,
        sampleRowId: dashboard.commitments.overdue.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.overdue,
      },
      dueToday: {
        label: 'Due today commitments',
        description: 'Items due today or touch-due today.',
        filterKey: 'due_now' as OverviewFilterKey,
        sampleRowId: dashboard.commitments.dueToday.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.dueToday || row.queueFlags.needsTouchToday,
      },
      dueWithin7Days: {
        label: 'Due in 7 days',
        description: 'Upcoming commitments due in the next 7 days.',
        filterKey: 'all' as OverviewFilterKey,
        sampleRowId: dashboard.commitments.dueWithin7Days.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => {
          const target = row.dueDate ?? row.promisedDate ?? row.nextTouchDate;
          if (!target) return false;
          const dueAt = Date.parse(target);
          if (Number.isNaN(dueAt)) return false;
          const now = Date.now();
          return dueAt >= now && dueAt <= now + (7 * 24 * 60 * 60 * 1000);
        },
      },
      waitingTooLong: {
        label: 'Waiting too long',
        description: 'Items stalled on dependency responses for too long.',
        filterKey: 'waiting' as OverviewFilterKey,
        sampleRowId: dashboard.commitments.waitingTooLong.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.waitingTooLong,
      },
      readyToClose: {
        label: 'Ready to close',
        description: 'Follow-ups and tasks with closeout opportunity now.',
        filterKey: 'ready_close' as OverviewFilterKey,
        sampleRowId: dashboard.commitments.readyToClose.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.readyToCloseParent,
      },
    }[key];

    applyDashboardQueueFocus({
      source: 'Commitment pressure',
      label: meta.label,
      description: meta.description,
      filterKey: meta.filterKey,
      preferredRowId: meta.sampleRowId,
      predicate: meta.predicate,
    });
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleOwnershipFocus = (key: keyof OverviewDashboardModel['ownershipRisk']) => {
    const meta = {
      unassigned: {
        label: 'Unassigned',
        description: 'Records without an owner or assignee.',
        sampleRowId: dashboard.ownershipRisk.unassigned.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => !(row.assignee?.trim() || row.owner?.trim()),
      },
      noDate: {
        label: 'No date set',
        description: 'Records missing due, promised, and next-touch dates.',
        sampleRowId: dashboard.ownershipRisk.noDate.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => !row.dueDate && !row.promisedDate && !row.nextTouchDate,
      },
      cleanupRequired: {
        label: 'Cleanup required',
        description: 'Records marked as cleanup-required.',
        sampleRowId: dashboard.ownershipRisk.cleanupRequired.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.cleanupRequired,
      },
      orphanedTask: {
        label: 'Orphaned tasks',
        description: 'Tasks missing valid parent linkage.',
        sampleRowId: dashboard.ownershipRisk.orphanedTask.sampleRowId,
        predicate: (row: typeof visibleRows[number]) => row.queueFlags.orphanedTask,
      },
    }[key];

    applyDashboardQueueFocus({
      source: 'Ownership/data risk',
      label: meta.label,
      description: meta.description,
      preferredRowId: meta.sampleRowId,
      predicate: meta.predicate,
    });
    setDetailOpen(true);
    focusQueueSurface();
  };

  const handleRouteDestination = (destination: 'tasks' | 'followups') => {
    if (!selected) return;
    const isRecordOpenRoute = (destination === 'followups' && selected.recordType === 'followup') || (destination === 'tasks' && selected.recordType === 'task');
    routeToLane(destination, {
      record: selected,
      section: isRecordOpenRoute ? undefined : destination === 'tasks' ? 'now' : 'triage',
      intentLabel: `continue in ${destination === 'tasks' ? 'Tasks' : 'Follow Ups'}`,
    });
    setDetailOpen(false);
    onOpenWorkspace(destination);
  };

  const handleOpenDetail = () => {
    setDetailOpen(false);
    openSelectedDetail();
  };

  const queueSurface = (
    <div ref={queueSurfaceRef}>
      <ExecutionLaneQueueCard className="overview-command-center execution-lane-queue-surface">
      <ExecutionToolbarSurface className="overview-toolbar-surface">
        <div className="execution-lane-toolbar-scaffold overview-toolbar-scaffold">
          <div className="execution-lane-toolbar-zone execution-lane-toolbar-zone-left">
            <label className="field-block overview-search-block">
              <div className="search-field-wrap">
                <Search className="search-field-icon h-4 w-4" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search triage queue"
                  className="field-input search-field-input"
                />
                {searchQuery ? (
                  <button type="button" onClick={() => setSearchQuery('')} className="search-clear-btn" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </label>
          </div>
          <div className="execution-lane-toolbar-zone execution-lane-toolbar-zone-middle">
            <OverviewSignalCards cards={signalCards} selectedFilter={selectedFilter} onSelectFilter={(filterKey) => {
              selectQueueFilter(filterKey);
              if (filterKey === 'all') {
                clearDashboardQueueFocus(false);
              }
            }} />
          </div>
        </div>
        <ExecutionFilterChipRow muted={!searchQuery && selectedFilter === 'all'} className="overview-filter-chip-row">
          {selectedFilter !== 'all' ? (
            <button type="button" className="execution-filter-chip" onClick={() => selectQueueFilter('all')}>Queue: {activeFilterMeta?.label ?? 'All queue'} <span aria-hidden>×</span></button>
          ) : null}
          {searchQuery ? <button type="button" className="execution-filter-chip" onClick={() => setSearchQuery('')}>Search: {searchQuery} <span aria-hidden>×</span></button> : null}
          {!searchQuery && selectedFilter === 'all' ? <span className="task-sort-summary">No active narrowing. Showing full overview queue.</span> : null}
        </ExecutionFilterChipRow>
      </ExecutionToolbarSurface>

      {dashboardQueueContext ? (
        <section className="overview-dashboard-context-strip" role="status" aria-live="polite">
          <div>
            <p>{dashboardQueueContext.source}</p>
            <strong>{dashboardQueueContext.label}</strong>
            <span>{dashboardQueueContext.description}</span>
          </div>
          <button
            type="button"
            className="action-btn action-btn-quiet"
            onClick={() => {
              clearDashboardQueueFocus(true);
              setDetailOpen(false);
            }}
          >
            Clear focus
          </button>
        </section>
      ) : null}

      <div className="overview-queue-header">
        <div className="overview-queue-header-title">Triage queue</div>
        <div className="overview-queue-state-line" role="status" aria-live="polite">{queueStateText}</div>
      </div>

      <section className="overview-triage-main" aria-label="Overview triage queue">
        {visibleRows.length === 0 && searchQuery ? (
          <NoMatchesState message="Nothing matches this overview search." />
        ) : (
          <OverviewTriageList
            rows={visibleRows}
            selectedId={selected?.id || null}
            onSelect={(id) => {
              setSelectedId(id);
              setDetailOpen(true);
            }}
          />
        )}
        <div className="overview-show-more-row">
          {hasMoreRows ? (
            <button type="button" className="action-btn" onClick={showMoreRows}>Show more</button>
          ) : <span />}
          <button type="button" className="action-btn" onClick={() => onOpenWorkspace('followups')}>Open Follow Ups queue</button>
        </div>
      </section>
      </ExecutionLaneQueueCard>
    </div>
  );

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        <OverviewDashboard
          dashboard={dashboard}
          selectedFilter={selectedFilter}
          onFocusFilter={handleDashboardFilterFocus}
          onSelectKpi={handleKpiFocus}
          onCreateWork={openCreateWorkModal}
          onOpenIntake={() => onOpenWorkspace('intake')}
          onRouteLane={(lane, section, intentLabel) => {
            routeToLane(lane, { section, intentLabel });
            onOpenWorkspace(lane);
          }}
          onFocusNextUp={(row) => {
            applyDashboardQueueFocus({
              source: 'Next up',
              label: row.title,
              description: `Inspecting prioritized ${row.recordType === 'task' ? 'task' : 'follow-up'} in queue.`,
              filterKey: row.section === 'blocked' ? 'blocked' : row.section === 'now' ? 'due_now' : 'all',
              preferredRowId: row.id,
            });
            setDetailOpen(true);
            focusQueueSurface();
          }}
          onFocusLaneHealth={handleLaneHealthFocus}
          onFocusHotspot={handleHotspotFocus}
          onFocusCommitment={handleCommitmentFocus}
          onFocusOwnershipRisk={handleOwnershipFocus}
          onResetFocus={() => {
            clearDashboardQueueFocus(true);
            setDetailOpen(false);
            focusQueueSurface();
          }}
        />

        {isMobileLike ? (
          <>
            {queueSurface}
            {detailOpen ? (
              <AppModal size="inspector" ariaLabel="Overview route item" onClose={() => setDetailOpen(false)} onBackdropClick={() => setDetailOpen(false)}>
                <AppModalHeader
                  title={inspectorTitle}
                  subtitle="Review context and route without leaving Overview."
                  onClose={() => setDetailOpen(false)}
                  closeLabel="Back to queue"
                />
                <AppModalBody>
                  <OverviewRouteInspector
                    selected={selected}
                    onRouteDestination={handleRouteDestination}
                    onOpenDetail={handleOpenDetail}
                    onOpenIntake={() => {
                      setDetailOpen(false);
                      onOpenWorkspace('intake');
                    }}
                  />
                </AppModalBody>
              </AppModal>
            ) : null}
          </>
        ) : (
          <WorkspacePrimaryLayout
            inspectorWidth="320px"
            className={`overview-surface-layout ${detailOpen ? '' : 'workspace-primary-layout-collapsed'}`.trim()}
          >
            {queueSurface}

            {detailOpen ? (
              <ExecutionLaneInspectorCard className="overview-inspector-shell">
                <div className="workspace-inspector-section-title overview-inspector-kicker">{inspectorTitle}</div>
                <p className="workspace-inspector-section-subtitle">Review context and route without leaving Overview.</p>
                <OverviewRouteInspector
                  selected={selected}
                  onRouteDestination={handleRouteDestination}
                  onOpenDetail={handleOpenDetail}
                  onOpenIntake={() => {
                    setDetailOpen(false);
                    onOpenWorkspace('intake');
                  }}
                />
              </ExecutionLaneInspectorCard>
            ) : null}
          </WorkspacePrimaryLayout>
        )}
      </WorkspaceContentFrame>
    </WorkspacePage>
  );
}
