import { Badge } from '../Badge';
import type {
  OverviewDashboardLaneHealth,
  OverviewDashboardModel,
  OverviewDashboardNextUpRow,
  OverviewFilterKey,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';
import type { ExecutionSectionKey } from '../../types';
import { priorityTone } from '../../lib/utils';

interface OverviewDashboardPanelsProps {
  dashboard: OverviewDashboardModel;
  onRouteLane: (lane: 'tasks' | 'followups', section: ExecutionSectionKey, intentLabel: string) => void;
  onSelectFilter: (filterKey: OverviewFilterKey) => void;
  onSelectRow: (rowId: string) => void;
}

function laneLabel(row: OverviewDashboardNextUpRow) {
  return row.lane === 'tasks' ? 'Tasks' : 'Follow Ups';
}

function routeLabel(lane: OverviewDashboardLaneHealth) {
  return lane.lane === 'tasks' ? 'Open Tasks' : 'Open Follow Ups';
}

export function OverviewDashboardPanels({ dashboard, onRouteLane, onSelectFilter, onSelectRow }: OverviewDashboardPanelsProps) {
  return (
    <div className="overview-dashboard-panel-stack">
      <section className="overview-dashboard-panel-grid overview-dashboard-panel-grid-primary" aria-label="Overview primary dashboard panels">
        <article className="overview-dashboard-panel overview-dashboard-next-up">
          <header>
            <p>Main work next up</p>
            <h3>Highest-pressure queue rows</h3>
          </header>
          <div className="overview-dashboard-nextup-table">
            {dashboard.nextUpRows.map((row) => (
              <div key={row.id} className="overview-dashboard-nextup-row">
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.project}</span>
                </div>
                <div className="overview-dashboard-nextup-row-side">
                  <Badge kind="meta" variant="neutral">{row.reason}</Badge>
                  <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => {
                      onRouteLane(row.lane, row.section, `continue ${row.recordType === 'task' ? 'task' : 'follow-up'} execution`);
                    }}
                  >
                    {laneLabel(row)}
                  </button>
                  <button type="button" className="action-btn action-btn-quiet" onClick={() => onSelectRow(row.id)}>Inspect</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Queue composition</p>
            <h3>Lane health and routing balance</h3>
          </header>
          <div className="overview-dashboard-lane-health-grid">
            {dashboard.laneHealth.map((lane) => (
              <div key={lane.key} className="overview-dashboard-lane-card">
                <span>{lane.label}</span>
                <strong>{lane.value}</strong>
                <small>{lane.helper}</small>
                <div className="overview-dashboard-lane-actions">
                  {lane.filterKey ? (
                    <button type="button" className="action-btn action-btn-quiet" onClick={() => { if (lane.filterKey) onSelectFilter(lane.filterKey); }}>Focus queue</button>
                  ) : null}
                  <button type="button" className="action-btn" onClick={() => onRouteLane(lane.lane, lane.section, `review ${lane.label.toLowerCase()}`)}>{routeLabel(lane)}</button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="overview-dashboard-panel-grid overview-dashboard-panel-grid-secondary" aria-label="Overview supporting dashboard panels">
        <article className="overview-dashboard-panel">
          <header>
            <p>Project hotspots</p>
            <h3>Where pressure is concentrated</h3>
          </header>
          <div className="overview-dashboard-hotspot-list">
            {dashboard.hotspots.length ? dashboard.hotspots.map((hotspot) => (
              <div key={hotspot.project} className="overview-dashboard-hotspot-row">
                <strong>{hotspot.project}</strong>
                <span>{hotspot.pressureCount} pressured · {hotspot.blockedCount} blocked · {hotspot.dueNowCount} due now</span>
              </div>
            )) : <p className="overview-dashboard-empty">No concentrated hotspots right now.</p>}
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Weekly momentum</p>
            <h3>Near-term pressure outlook</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <div><span>Overdue</span><strong>{dashboard.trend.overdue}</strong></div>
            <div><span>Due today</span><strong>{dashboard.trend.dueToday}</strong></div>
            <div><span>Due in 7 days</span><strong>{dashboard.trend.dueWithin7Days}</strong></div>
            <div><span>Waiting too long</span><strong>{dashboard.trend.waitingTooLong}</strong></div>
            <div><span>Closeout relief</span><strong>{dashboard.trend.completedRelief}</strong></div>
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Today’s workload mix</p>
            <h3>Coverage and assignment risk</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <div><span>Tasks</span><strong>{dashboard.workload.tasks}</strong></div>
            <div><span>Follow Ups</span><strong>{dashboard.workload.followups}</strong></div>
            <div><span>Unassigned</span><strong>{dashboard.workload.unassigned}</strong></div>
            <div><span>No date set</span><strong>{dashboard.workload.noDate}</strong></div>
          </div>
        </article>
      </section>
    </div>
  );
}
