import { ExecutionSummaryStatChip } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';

interface OverviewSummaryStatsProps {
  stats: ExecutionQueueStats;
}

export function OverviewSummaryStats({ stats }: OverviewSummaryStatsProps) {
  const pressureNow = stats.due + stats.blocked;

  return (
    <section className="overview-summary-stats" aria-label="Overview summary">
      <ExecutionSummaryStatChip label="Pressure now" value={pressureNow} tone="info" />
      <ExecutionSummaryStatChip label="Due now" value={stats.due} />
      <ExecutionSummaryStatChip label="Blocked" value={stats.blocked} tone={stats.blocked > 0 ? 'warn' : 'default'} />
      <ExecutionSummaryStatChip label="Needs review" value={stats.cleanup} />
      <ExecutionSummaryStatChip label="Ready to close" value={stats.closeable} />
    </section>
  );
}
