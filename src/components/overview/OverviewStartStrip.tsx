import { SectionHeader, StatTile, WorkspaceSummaryStrip, WorkspaceToolbarRow } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';

interface OverviewStartStripProps {
  stats: ExecutionQueueStats;
  onOpenIntake: () => void;
  onRouteFollowUps: () => void;
  onRouteTasks: () => void;
  onQuickAdd: () => void;
}

export function OverviewStartStrip({ stats, onOpenIntake, onRouteFollowUps, onRouteTasks, onQuickAdd }: OverviewStartStripProps) {
  return (
    <WorkspaceSummaryStrip className="overview-hero-card">
      <SectionHeader title="Start here" subtitle="Scan what matters now, then route execution into the right lane." compact />
      <div className="overview-stat-grid overview-stat-grid-compact">
        <StatTile label="Due now" value={stats.due} tone={stats.due ? 'warn' : 'default'} />
        <StatTile label="Blocked / at risk" value={stats.blocked} tone={stats.blocked ? 'danger' : 'default'} />
        <StatTile label="Cleanup / review" value={stats.cleanup} tone={stats.cleanup ? 'warn' : 'default'} />
        <StatTile label="Ready to close" value={stats.closeable} tone={stats.closeable ? 'info' : 'default'} />
      </div>
      <WorkspaceToolbarRow className="overview-triage-actions">
        <span className="overview-triage-label">Route-first:</span>
        <button onClick={onOpenIntake} className="action-btn !px-2.5 !py-1 text-xs">Open Intake</button>
        <button onClick={onRouteFollowUps} className="action-btn !px-2.5 !py-1 text-xs">Open Follow Ups</button>
        <button onClick={onRouteTasks} className="action-btn !px-2.5 !py-1 text-xs">Open Tasks</button>
        <button onClick={onQuickAdd} className="action-btn !px-2.5 !py-1 text-xs">Quick Add</button>
      </WorkspaceToolbarRow>
    </WorkspaceSummaryStrip>
  );
}
