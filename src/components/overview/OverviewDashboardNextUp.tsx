import { Badge } from '../Badge';
import type { OverviewDashboardAction, OverviewDashboardNextUpRow } from '../../domains/overview/hooks/useOverviewTriageViewModel';
import { priorityTone } from '../../lib/utils';

interface OverviewDashboardNextUpProps {
  rows: OverviewDashboardNextUpRow[];
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboardNextUp({ rows, onAction }: OverviewDashboardNextUpProps) {
  return (
    <article className="overview-dashboard-panel overview-dashboard-next-up overview-dashboard-next-up-elevated">
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
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="overview-dashboard-nextup-row" role="row">
            <div className="overview-dashboard-nextup-cell-main">
              <strong title={row.title}>{row.title}</strong>
              <span title={`${row.project} · ${row.reason}`}>{row.project} · {row.reason}</span>
            </div>
            <div className="overview-dashboard-nextup-cell" title={row.ownerLabel}>{row.ownerLabel}</div>
            <div className="overview-dashboard-nextup-cell">{row.dueLabel}</div>
            <div className="overview-dashboard-nextup-cell">
              <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
            </div>
            <div className="overview-dashboard-nextup-row-side">
              <button type="button" className="action-btn action-btn-quiet" onClick={() => onAction({ type: 'focus_next_up', rowId: row.id })}>Inspect in queue</button>
              <button
                type="button"
                className="action-btn"
                onClick={() => onAction({
                  type: 'route_lane',
                  lane: row.lane,
                  section: row.section,
                  intentLabel: `continue ${row.recordType === 'task' ? 'task' : 'follow-up'} execution`,
                  recordId: row.id,
                })}
              >
                {row.lane === 'tasks' ? 'Open Tasks' : 'Open Follow Ups'}
              </button>
            </div>
          </div>
        )) : (
          <p className="overview-dashboard-empty">
            Nothing is queued for the next-up table yet. Capture new work from intake or create a work item to seed today&rsquo;s run list.
          </p>
        )}
      </div>
    </article>
  );
}
