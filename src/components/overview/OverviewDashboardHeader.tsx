import type { OverviewFilterKey } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardHeaderProps {
  totalQueue: number;
  selectedFilter: OverviewFilterKey;
  onSelectFilter: (filterKey: OverviewFilterKey) => void;
  onCreateWork: () => void;
  onOpenIntake: () => void;
}

export function OverviewDashboardHeader({ totalQueue, selectedFilter, onSelectFilter, onCreateWork, onOpenIntake }: OverviewDashboardHeaderProps) {
  return (
    <section className="overview-dashboard-header" aria-label="Overview dashboard header">
      <div className="overview-dashboard-title-wrap">
        <p className="overview-dashboard-kicker">Overview dashboard</p>
        <h2>Project controls command surface</h2>
        <p>Prioritize pressure, route to the correct lane, then execute directly in the queue below.</p>
      </div>
      <div className="overview-dashboard-header-sidecar">
        <div className="overview-dashboard-context-pills" role="group" aria-label="Overview context">
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'all' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onSelectFilter('all')}
          >
            Full queue · {totalQueue}
          </button>
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'due_now' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onSelectFilter('due_now')}
          >
            Due-now focus
          </button>
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'blocked' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onSelectFilter('blocked')}
          >
            Blocked focus
          </button>
        </div>
        <div className="overview-dashboard-header-actions">
          <button type="button" className="action-btn" onClick={onOpenIntake}>Open intake</button>
          <button type="button" className="primary-btn" onClick={onCreateWork}>Create work item</button>
        </div>
      </div>
    </section>
  );
}
