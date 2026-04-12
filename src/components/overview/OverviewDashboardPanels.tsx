import { Badge } from '../Badge';
import type {
  OverviewDashboardLaneHealth,
  OverviewDashboardModel,
  OverviewDashboardNextUpRow,
  OverviewDashboardProjectHotspot,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';
import type { ExecutionSectionKey } from '../../types';
import { priorityTone } from '../../lib/utils';

interface OverviewDashboardPanelsProps {
  dashboard: OverviewDashboardModel;
  onRouteLane: (lane: 'tasks' | 'followups', section: ExecutionSectionKey, intentLabel: string) => void;
  onFocusNextUp: (row: OverviewDashboardNextUpRow) => void;
  onFocusLaneHealth: (lane: OverviewDashboardLaneHealth) => void;
  onFocusHotspot: (hotspot: OverviewDashboardProjectHotspot) => void;
  onFocusCommitment: (key: keyof OverviewDashboardModel['commitments']) => void;
  onFocusOwnershipRisk: (key: keyof OverviewDashboardModel['ownershipRisk']) => void;
  onResetFocus: () => void;
}

function laneLabel(row: OverviewDashboardNextUpRow) {
  return row.lane === 'tasks' ? 'Open Tasks' : 'Open Follow Ups';
}

function routeLabel(lane: OverviewDashboardLaneHealth) {
  return lane.lane === 'tasks' ? 'Open Tasks' : 'Open Follow Ups';
}

export function OverviewDashboardPanels({
  dashboard,
  onRouteLane,
  onFocusNextUp,
  onFocusLaneHealth,
  onFocusHotspot,
  onFocusCommitment,
  onFocusOwnershipRisk,
  onResetFocus,
}: OverviewDashboardPanelsProps) {
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
                  <button type="button" className="action-btn action-btn-quiet" onClick={() => onFocusNextUp(row)}>Inspect in queue</button>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onRouteLane(row.lane, row.section, `continue ${row.recordType === 'task' ? 'task' : 'follow-up'} execution`)}
                  >
                    {laneLabel(row)}
                  </button>
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
                  <button type="button" className="action-btn action-btn-quiet" onClick={() => onFocusLaneHealth(lane)}>Focus queue</button>
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
              <div key={hotspot.project} className="overview-dashboard-hotspot-row">
                <strong>{hotspot.project}</strong>
                <span>{hotspot.pressureCount} pressure · {hotspot.blockedCount} blocked · {hotspot.dueNowCount} due now · {hotspot.readyToCloseCount} closeout</span>
                <div className="overview-dashboard-lane-actions">
                  <button type="button" className="action-btn action-btn-quiet" onClick={() => onFocusHotspot(hotspot)}>Show in queue</button>
                  <button type="button" className="action-btn" onClick={() => onRouteLane(hotspot.lane, hotspot.section, `review ${hotspot.project} hotspot`)}>
                    {hotspot.lane === 'tasks' ? 'Open Tasks' : 'Open Follow Ups'}
                  </button>
                </div>
              </div>
            )) : <p className="overview-dashboard-empty">No concentrated hotspots right now.</p>}
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Today and this week</p>
            <h3>Commitment pressure timeline</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <button type="button" onClick={() => onFocusCommitment('overdue')}><span>Overdue</span><strong>{dashboard.commitments.overdue.count}</strong></button>
            <button type="button" onClick={() => onFocusCommitment('dueToday')}><span>Due today</span><strong>{dashboard.commitments.dueToday.count}</strong></button>
            <button type="button" onClick={() => onFocusCommitment('dueWithin7Days')}><span>Due in 7 days</span><strong>{dashboard.commitments.dueWithin7Days.count}</strong></button>
            <button type="button" onClick={() => onFocusCommitment('waitingTooLong')}><span>Waiting too long</span><strong>{dashboard.commitments.waitingTooLong.count}</strong></button>
            <button type="button" onClick={() => onFocusCommitment('readyToClose')}><span>Ready to close</span><strong>{dashboard.commitments.readyToClose.count}</strong></button>
          </div>
        </article>

        <article className="overview-dashboard-panel">
          <header>
            <p>Ownership and data risk</p>
            <h3>Unassigned and no-date drag</h3>
          </header>
          <div className="overview-dashboard-trend-grid">
            <button type="button" onClick={() => onFocusOwnershipRisk('unassigned')}><span>Unassigned</span><strong>{dashboard.ownershipRisk.unassigned.count}</strong></button>
            <button type="button" onClick={() => onFocusOwnershipRisk('noDate')}><span>No date set</span><strong>{dashboard.ownershipRisk.noDate.count}</strong></button>
            <button type="button" onClick={() => onFocusOwnershipRisk('cleanupRequired')}><span>Cleanup required</span><strong>{dashboard.ownershipRisk.cleanupRequired.count}</strong></button>
            <button type="button" onClick={() => onFocusOwnershipRisk('orphanedTask')}><span>Orphaned tasks</span><strong>{dashboard.ownershipRisk.orphanedTask.count}</strong></button>
          </div>
        </article>
      </section>

      <section className="overview-dashboard-execution-bridge" aria-label="Overview queue handoff">
        <div>
          <p>Execution layer</p>
          <h3>Queue below is the operating surface for dashboard decisions</h3>
        </div>
        <button type="button" className="action-btn action-btn-quiet" onClick={onResetFocus}>Reset to full queue</button>
      </section>
    </div>
  );
}
