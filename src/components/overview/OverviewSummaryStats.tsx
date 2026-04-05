import { StatTile } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';

interface OverviewSummaryStatsProps {
  stats: ExecutionQueueStats;
}

export function OverviewSummaryStats({ stats }: OverviewSummaryStatsProps) {
  return (
    <div className="overview-stat-grid overview-stat-grid-compact">
      <StatTile label="Due now" value={stats.due} tone={stats.due ? 'danger' : 'default'} helper="Pressure" />
      <StatTile label="Blocked" value={stats.blocked} tone={stats.blocked ? 'warn' : 'default'} />
      <StatTile label="Cleanup" value={stats.cleanup} tone={stats.cleanup ? 'warn' : 'default'} />
      <StatTile label="Ready to close" value={stats.closeable} tone={stats.closeable ? 'info' : 'default'} />
    </div>
  );
}
