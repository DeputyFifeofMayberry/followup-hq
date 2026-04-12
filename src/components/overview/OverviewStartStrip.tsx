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
      className="execution-summary-strip-unified overview-summary-strip-compact"
      kicker="Daily overview"
      title="Command center for today’s routing decisions."
      supporting="Scan today’s pressure and route each item into the right lane with confidence."
      stats={<OverviewSummaryStats stats={stats} />}
      actions={<OverviewRouteActions onOpenIntake={onOpenIntake} onCreateWork={onCreateWork} />}
    />
  );
}
