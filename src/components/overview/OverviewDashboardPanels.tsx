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
            <h3>Execution queue priority table</h3>
          </header>
          <div className="overview-dashboard-nextup-table" role="table" aria-label="Overview next-up action table">
            <div className="overview-dashboard-nextup-head" role="row">
              <span role="columnheader">Work item</span>
              <span role="columnheader">Owner</span>
              <span role="columnheader">Due</span>
              <span role="columnheader">Priority</span>
              <span role="columnheader">Action</span>
            </div>
            {dashboard.nextUpRows.map((row) => (
              <div key={row.id} className="overview-dashboard-nextup-row" role="row">
                <div className="overview-dashboard-nextup-cell-main">
                  <strong>{row.title}</strong>
                  <span>{row.project} · {row.reason}</span>
                </div>
                <div className="overview-dashboard-nextup-cell">{row.ownerLabel}</div>
                <div className="overview-dashboard-nextup-cell">{row.dueLabel}</div>
                <div className="overview-dashboard-nextup-cell">
                  <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                </div>
                <div className="overview-dashboard-nextup-row-side">
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
            <p>Pressure by project</p>
            <h3>Hotspots with queue routing</h3>
          </header>
          <div className="overview-dashboard-hotspot-list">
            {dashboard.hotspots.length ? dashboard.hotspots.map((hotspot) => (
              <button
                key={hotspot.project}
                type="button"
                className="overview-dashboard-hotspot-row"
                onClick={() => {
                  if (hotspot.filterKey !== 'all') onSelectFilter(hotspot.filterKey);
                  if (hotspot.sampleRowId) onSelectRow(hotspot.sampleRowId);
                  onRouteLane(hotspot.lane, hotspot.section, `review ${hotspot.project} hotspot`);
                }}
              >
                <strong>{hotspot.project}</strong>
                <span>{hotspot.pressureCount} pressure · {hotspot.blockedCount} blocked · {hotspot.dueNowCount} due now · {hotspot.readyToCloseCount} closeout</span>
              </button>
            )) : <p className="overview-dashboard-empty">No concentrated hotspots right now.</p>}
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Today and this week</p>
            <h3>Commitment pressure timeline</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <button type="button" onClick={() => onSelectFilter('due_now')}><span>Overdue</span><strong>{dashboard.commitments.overdue}</strong></button>
            <button type="button" onClick={() => onSelectFilter('due_now')}><span>Due today</span><strong>{dashboard.commitments.dueToday}</strong></button>
            <button type="button" onClick={() => onRouteLane('tasks', 'triage', 'plan next 7 days commitments')}><span>Due in 7 days</span><strong>{dashboard.commitments.dueWithin7Days}</strong></button>
            <button type="button" onClick={() => onSelectFilter('waiting')}><span>Waiting too long</span><strong>{dashboard.commitments.waitingTooLong}</strong></button>
            <button type="button" onClick={() => onSelectFilter('ready_close')}><span>Ready to close</span><strong>{dashboard.commitments.readyToClose}</strong></button>
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Ownership and data risk</p>
            <h3>Unassigned and no-date drag</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <button type="button" onClick={() => onRouteLane('followups', 'triage', 'assign unowned commitments')}><span>Unassigned</span><strong>{dashboard.ownershipRisk.unassigned}</strong></button>
            <button type="button" onClick={() => onRouteLane('tasks', 'triage', 'add due dates to undated work')}><span>No date set</span><strong>{dashboard.ownershipRisk.noDate}</strong></button>
            <button type="button" onClick={() => onRouteLane('followups', 'triage', 'review cleanup-required records')}><span>Cleanup required</span><strong>{dashboard.ownershipRisk.cleanupRequired}</strong></button>
            <button type="button" onClick={() => onRouteLane('tasks', 'triage', 'repair orphaned task links')}><span>Orphaned tasks</span><strong>{dashboard.ownershipRisk.orphanedTask}</strong></button>
          </div>
        </article>
      </section>

      <section className="overview-dashboard-execution-bridge" aria-label="Overview queue handoff">
        <div>
          <p>Execution layer</p>
          <h3>Queue below is the operating surface for dashboard decisions</h3>
        </div>
        <button type="button" className="action-btn action-btn-quiet" onClick={() => onSelectFilter('all')}>Reset to full queue</button>
      </section>
    </div>
  );
}
