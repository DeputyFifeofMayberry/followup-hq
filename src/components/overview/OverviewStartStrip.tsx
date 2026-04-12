import { ExecutionSummaryBand } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';
import { OverviewSummaryStats } from './OverviewSummaryStats';
import { OverviewRouteActions } from './OverviewRouteActions';

interface OverviewStartStripProps {
  stats: ExecutionQueueStats;
  onOpenIntake: () => void;
  onCreateWork: () => void;
}

export function OverviewStartStrip({ stats, onOpenIntake, onCreateWork }: OverviewStartStripProps) {
  return (
    <ExecutionSummaryBand
      className="overview-summary-strip-compact"
      kicker="Daily overview"
      title="Scan pressure, then route the next move."
      supporting="Use Overview to direct follow-ups and tasks into the right execution lane."
      stats={<OverviewSummaryStats stats={stats} />}
      actions={<OverviewRouteActions onOpenIntake={onOpenIntake} onCreateWork={onCreateWork} />}
    />
  );
}
