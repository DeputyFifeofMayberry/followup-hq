import type {
  OverviewDashboardAction,
  OverviewFilterKey,
  OverviewTimeWindow,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardHeaderProps {
  totalQueue: number;
  selectedFilter: OverviewFilterKey;
  scopeProject: string;
  scopeTimeWindow: OverviewTimeWindow;
  projectOptions: string[];
  scopeSummaryLine: string;
  onScopeProject: (project: string) => void;
  onScopeTimeWindow: (window: OverviewTimeWindow) => void;
  onWorkSliceChange: (filterKey: OverviewFilterKey) => void;
  onAction: (action: OverviewDashboardAction) => void;
}

const WORK_SLICE_OPTIONS: { value: OverviewFilterKey; label: string }[] = [
  { value: 'all', label: 'All queue' },
  { value: 'due_now', label: 'Due now' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'ready_close', label: 'Ready to close' },
];

const TIME_OPTIONS: { value: OverviewTimeWindow; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

export function OverviewDashboardHeader({
  totalQueue,
  selectedFilter,
  scopeProject,
  scopeTimeWindow,
  projectOptions,
  scopeSummaryLine,
  onScopeProject,
  onScopeTimeWindow,
  onWorkSliceChange,
  onAction,
}: OverviewDashboardHeaderProps) {
  const dashboardSummary = totalQueue > 0
    ? 'Prioritize pressure, route to the correct lane, then execute directly in the queue below.'
    : 'Queue is currently clear for this scope. Adjust filters or capture new work to seed the next execution cycle.';

  return (
    <section className="overview-dashboard-header" aria-label="Overview dashboard header">
      <div className="overview-dashboard-title-wrap">
        <p className="overview-dashboard-kicker">Overview command dashboard</p>
        <h2>Execution control surface</h2>
        <p>{dashboardSummary}</p>
        <p className="overview-dashboard-scope-line" role="status">{scopeSummaryLine}</p>
      </div>
      <div className="overview-dashboard-header-sidecar">
        <div className="overview-dashboard-filter-bar" role="group" aria-label="Dashboard scope">
          <label className="overview-dashboard-filter-field">
            <span>Project</span>
            <select
              className="overview-dashboard-select"
              value={scopeProject}
              onChange={(e) => onScopeProject(e.target.value)}
            >
              <option value="all">All projects</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="overview-dashboard-filter-field">
            <span>Work slice</span>
            <select
              className="overview-dashboard-select"
              value={selectedFilter}
              onChange={(e) => onWorkSliceChange(e.target.value as OverviewFilterKey)}
            >
              {WORK_SLICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="overview-dashboard-filter-field">
            <span>Schedule window</span>
            <select
              className="overview-dashboard-select"
              value={scopeTimeWindow}
              onChange={(e) => onScopeTimeWindow(e.target.value as OverviewTimeWindow)}
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overview-dashboard-header-actions">
          <button type="button" className="action-btn" onClick={() => onAction({ type: 'open_intake' })}>Open intake</button>
          <button type="button" className="primary-btn" onClick={() => onAction({ type: 'open_create_work' })}>Create work item</button>
        </div>
      </div>
    </section>
  );
}
