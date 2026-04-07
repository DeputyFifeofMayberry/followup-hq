import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppModal, AppModalBody, AppModalHeader, AppShellCard, NoMatchesState, SectionHeader, WorkspacePage } from './ui/AppPrimitives';
import type { AppMode } from '../types';
import { OverviewStartStrip } from './overview/OverviewStartStrip';
import { OverviewSignalCards } from './overview/OverviewSignalCards';
import { OverviewTriageList } from './overview/OverviewTriageList';
import { OverviewRouteInspector } from './overview/OverviewRouteInspector';
import { useOverviewTriageViewModel } from '../domains/overview/hooks/useOverviewTriageViewModel';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'followups' | 'tasks' | 'outlook' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  personalMode?: boolean;
  appMode?: AppMode;
}

export function OverviewPage({ onOpenWorkspace, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: OverviewPageProps) {
  void appMode;
  const {
    stats,
    triageRows,
    selectedFilter,
    selected,
    signalCards,
    totalFilteredCount,
    hasMoreRows,
    showMoreRows,
    openCreateWorkModal,
    setSelectedId,
    setSelectedFilter,
    routeToLane,
    openSelectedDetail,
  } = useOverviewTriageViewModel();

  const [searchQuery, setSearchQuery] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const visibleRows = useMemo(
    () => triageRows.filter((row) => [row.title, row.project, row.owner, row.assignee, row.primaryNextAction, row.whyInQueue].join(' ').toLowerCase().includes(searchQuery.toLowerCase())),
    [triageRows, searchQuery],
  );
  const activeFilterMeta = signalCards.find((card) => card.key === selectedFilter);

  return (
    <WorkspacePage>
      <OverviewStartStrip stats={stats} onOpenIntake={() => onOpenWorkspace('outlook')} onCreateWork={openCreateWorkModal} />

      <AppShellCard className="overview-command-center" surface="data">
        <div className="overview-toolbar-row">
          <div className="overview-toolbar-left">
            <label className="field-block overview-search-block">
              <div className="search-field-wrap">
                <Search className="search-field-icon h-4 w-4" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search queue"
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
          <div className="overview-live-context" role="status" aria-live="polite">
            <strong>{activeFilterMeta?.label ?? 'All queue'}</strong>
            <span>{visibleRows.length} visible · {totalFilteredCount} in scope</span>
            <span>{selected ? `Focused: ${selected.title}` : 'No item selected'}</span>
          </div>
        </div>

        <section className="overview-triage-main" aria-label="Overview triage queue">
          <SectionHeader title="Priority queue" subtitle="Open → scan → decide → move." compact />
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
          {hasMoreRows ? (
            <div className="overview-show-more-row">
              <button type="button" className="action-btn" onClick={showMoreRows}>Show more</button>
              <button type="button" className="action-btn" onClick={() => onOpenWorkspace('queue')}>Open full queue</button>
            </div>
          ) : null}
        </section>
      </AppShellCard>

      {detailOpen ? (
        <AppModal size="inspector" onClose={() => setDetailOpen(false)} onBackdropClick={() => setDetailOpen(false)}>
          <AppModalHeader
            title="Selected item"
            subtitle="Record context first, then choose the best next move."
            onClose={() => setDetailOpen(false)}
          />
          <AppModalBody>
            <OverviewRouteInspector
              selected={selected}
              onRouteDestination={(destination) => {
                routeToLane(destination, {
                  record: selected,
                  section: destination === 'tasks' ? 'now' : 'triage',
                  intentLabel: `route selected overview item to ${destination}`,
                });
                setDetailOpen(false);
                onOpenWorkspace(destination);
              }}
              onOpenDetail={openSelectedDetail}
              onOpenIntake={() => {
                setDetailOpen(false);
                onOpenWorkspace('outlook');
              }}
            />
          </AppModalBody>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
