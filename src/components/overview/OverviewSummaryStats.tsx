import type { ExecutionQueueStats } from '../../domains/shared';

interface OverviewSummaryStatsProps {
  stats: ExecutionQueueStats;
}

export function OverviewSummaryStats({ stats }: OverviewSummaryStatsProps) {
  const pressureNow = stats.due + stats.blocked;

  return (
    <section className="overview-summary-stats" aria-label="Overview summary">
      <div className="overview-summary-chip overview-summary-chip-pressure">
        <span>Pressure now</span>
        <strong>{pressureNow}</strong>
      </div>
      <div className="overview-summary-chip"><span>Due now</span><strong>{stats.due}</strong></div>
      <div className="overview-summary-chip"><span>Blocked</span><strong>{stats.blocked}</strong></div>
      <div className="overview-summary-chip"><span>Waiting cleanup</span><strong>{stats.cleanup}</strong></div>
      <div className="overview-summary-chip"><span>Ready to close</span><strong>{stats.closeable}</strong></div>
    </section>
  );
}
