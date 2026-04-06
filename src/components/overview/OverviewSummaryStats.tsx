import { StatTile } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';

interface OverviewSummaryStatsProps {
  stats: ExecutionQueueStats;
}

export function OverviewSummaryStats({ stats }: OverviewSummaryStatsProps) {
  const totalPressure = stats.due + stats.blocked + stats.cleanup;

  return (
    <section className="overview-command-stats" aria-label="Current pressure summary">
      <div className="overview-pressure-chip">
        <span className="overview-pressure-chip-label">Pressure now</span>
        <strong className="overview-pressure-chip-value">{totalPressure}</strong>
      </div>
      <div className="overview-stat-grid overview-stat-grid-compact">
        <StatTile label="Due now" value={stats.due} tone={stats.due ? 'danger' : 'default'} helper="Requires same-day move" />
        <StatTile label="Blocked" value={stats.blocked} tone={stats.blocked ? 'warn' : 'default'} helper="Need unblock decision" />
        <StatTile label="Cleanup" value={stats.cleanup} tone={stats.cleanup ? 'warn' : 'default'} helper="Needs review before routing" />
        <StatTile label="Ready to close" value={stats.closeable} tone={stats.closeable ? 'info' : 'default'} helper="Can close with verification" />
      </div>
    </section>
  );
}
