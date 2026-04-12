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
  StatePanel,
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
  type OverviewDashboardAction,
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
    clearDashboardQueueFocus,
    runDashboardAction,
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
    if (dashboardQueueContext) {
      return `${activeLabel} · ${countPhrase}${visiblePhrase}. Dashboard focus: ${dashboardQueueContext.label}.`;
    }
    return `${activeLabel} · ${countPhrase}${visiblePhrase}. ${summary}`;
  }, [activeFilterMeta, searchedCount, visibleCount, dashboardQueueContext]);
  const isSearchEmpty = visibleRows.length === 0 && Boolean(searchQuery);
  const isDashboardFocusedEmpty = visibleRows.length === 0 && !searchQuery && Boolean(dashboardQueueContext);
  const isSignalFilterEmpty = visibleRows.length === 0 && !searchQuery && selectedFilter !== 'all' && !dashboardQueueContext;
  const isFullQueueEmpty = visibleRows.length === 0 && !searchQuery && selectedFilter === 'all' && !dashboardQueueContext;

  const inspectorTitle = selected ? `Route ${selected.recordType === 'task' ? 'task' : 'follow-up'}` : 'Route item';

  const handleDashboardAction = (action: OverviewDashboardAction) => {
    if (action.type === 'open_create_work') {
      openCreateWorkModal();
      return;
    }
    if (action.type === 'open_intake') {
      setDetailOpen(false);
      onOpenWorkspace('intake');
      return;
    }
    if (action.type === 'route_lane') {
      const routedRecord = action.recordId ? visibleRows.find((row) => row.id === action.recordId) ?? selected ?? null : selected;
      routeToLane(action.lane, {
        record: routedRecord,
        section: action.section,
        intentLabel: action.intentLabel,
      });
      setDetailOpen(false);
      onOpenWorkspace(action.lane);
      return;
    }

    const outcome = runDashboardAction(action);
    if (outcome === 'focused') {
      setDetailOpen(true);
      focusQueueSurface();
    }
    if (outcome === 'reset') {
      setDetailOpen(false);
      focusQueueSurface();
    }
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
        {isSearchEmpty ? (
          <NoMatchesState message="Nothing matches this overview search." />
        ) : isDashboardFocusedEmpty ? (
          <StatePanel
            tone="empty"
            title="This dashboard focus has no queue rows right now"
            message={`${dashboardQueueContext?.label ?? 'Selected focus'} is currently clear. Reset to full queue or choose a different focus slice to continue triage.`}
            action={(
              <div className="overview-empty-state-actions">
                <button
                  type="button"
                  className="action-btn action-btn-quiet"
                  onClick={() => clearDashboardQueueFocus(true)}
                >
                  Reset to full queue
                </button>
              </div>
            )}
          />
        ) : isSignalFilterEmpty ? (
          <StatePanel
            tone="empty"
            title={`No ${activeFilterMeta?.label?.toLowerCase() ?? 'filtered'} rows right now`}
            message={(activeFilterMeta?.filterSummary ?? 'This focus is currently clear.') + ' Switch back to full queue to keep triaging.'}
            action={(
              <div className="overview-empty-state-actions">
                <button type="button" className="action-btn action-btn-quiet" onClick={() => selectQueueFilter('all')}>View full queue</button>
              </div>
            )}
          />
        ) : isFullQueueEmpty ? (
          <StatePanel
            tone="empty"
            title="Overview queue is currently clear"
            message="No tasks or follow-ups need triage right now. Capture new requests in intake or create a work item to keep momentum."
            action={(
              <div className="overview-empty-state-actions">
                <button type="button" className="action-btn action-btn-quiet" onClick={() => onOpenWorkspace('intake')}>Open intake</button>
                <button type="button" className="action-btn" onClick={openCreateWorkModal}>Create work item</button>
              </div>
            )}
          />
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
          onAction={handleDashboardAction}
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
