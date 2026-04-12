import type { OverviewDashboardAction, OverviewFilterKey } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardHeaderProps {
  totalQueue: number;
  selectedFilter: OverviewFilterKey;
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboardHeader({ totalQueue, selectedFilter, onAction }: OverviewDashboardHeaderProps) {
  const dashboardSummary = totalQueue > 0
    ? 'Prioritize pressure, route to the correct lane, then execute directly in the queue below.'
    : 'Queue is currently clear. Use intake or create work to seed the next execution cycle.';

  return (
    <section className="overview-dashboard-header" aria-label="Overview dashboard header">
      <div className="overview-dashboard-title-wrap">
        <p className="overview-dashboard-kicker">Overview dashboard</p>
        <h2>Project controls command surface</h2>
        <p>{dashboardSummary}</p>
      </div>
      <div className="overview-dashboard-header-sidecar">
        <div className="overview-dashboard-context-pills" role="group" aria-label="Overview context">
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'all' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onAction({ type: 'focus_filter', filterKey: 'all' })}
          >
            Full queue · {totalQueue}
          </button>
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'due_now' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onAction({ type: 'focus_filter', filterKey: 'due_now' })}
          >
            Due-now focus
          </button>
          <button
            type="button"
            className={`overview-dashboard-context-pill ${selectedFilter === 'blocked' ? 'overview-dashboard-context-pill-active' : ''}`}
            onClick={() => onAction({ type: 'focus_filter', filterKey: 'blocked' })}
          >
            Blocked focus
          </button>
        </div>
        <div className="overview-dashboard-header-actions">
          <button type="button" className="action-btn" onClick={() => onAction({ type: 'open_intake' })}>Open intake</button>
          <button type="button" className="primary-btn" onClick={() => onAction({ type: 'open_create_work' })}>Create work item</button>
        </div>
      </div>
    </section>
  );
}
