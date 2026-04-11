import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AppModal,
  AppModalBody,
  AppModalHeader,
  ExecutionLaneInspectorCard,
  ExecutionLaneQueueCard,
  NoMatchesState,
  WorkspaceContentFrame,
  WorkspacePage,
  WorkspacePrimaryLayout,
} from './ui/AppPrimitives';
import type { AppMode } from '../types';
import { OverviewStartStrip } from './overview/OverviewStartStrip';
import { OverviewSignalCards } from './overview/OverviewSignalCards';
import { OverviewTriageList } from './overview/OverviewTriageList';
import { OverviewRouteInspector } from './overview/OverviewRouteInspector';
import { useOverviewTriageViewModel } from '../domains/overview/hooks/useOverviewTriageViewModel';
import { useViewportBand } from '../hooks/useViewport';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'followups' | 'tasks' | 'intake' | 'directory' | 'outlook' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  personalMode?: boolean;
  appMode?: AppMode;
}

export function OverviewPage({ onOpenWorkspace, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: OverviewPageProps) {
  void appMode;
  const { isMobileLike, isPhone } = useViewportBand();
  const {
    stats,
    selectedFilter,
    selected,
    signalCards,
    searchQuery,
    setSearchQuery,
    visibleRows,
    searchedCount,
    visibleCount,
    hasMoreRows,
    showMoreRows,
    openCreateWorkModal,
    setSelectedId,
    setSelectedFilter,
    routeToLane,
    openSelectedDetail,
  } = useOverviewTriageViewModel();

  const [detailOpen, setDetailOpen] = useState(false);

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
    <ExecutionLaneQueueCard className="overview-command-center">
      <div className="overview-toolbar-row">
        <div className="overview-toolbar-left">
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
          <OverviewSignalCards cards={signalCards} selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
        </div>
      </div>

      <div className="overview-queue-state-line" role="status" aria-live="polite">{queueStateText}</div>

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
          <button type="button" className="action-btn" onClick={() => onOpenWorkspace('queue')}>Open full queue</button>
        </div>
      </section>
    </ExecutionLaneQueueCard>
  );

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        {!isPhone ? <OverviewStartStrip stats={stats} onOpenIntake={() => onOpenWorkspace('intake')} onCreateWork={openCreateWorkModal} /> : null}

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
                <div className="workspace-inspector-section-title">{inspectorTitle}</div>
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
