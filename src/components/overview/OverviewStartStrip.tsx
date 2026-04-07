import { SectionHeader, WorkspaceSummaryStrip } from '../ui/AppPrimitives';
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
    <WorkspaceSummaryStrip className="overview-summary-strip-compact">
      <div className="overview-summary-heading-row">
        <SectionHeader title="Daily overview summary" subtitle="Scan pressure, then act from the list." compact />
        <OverviewRouteActions onOpenIntake={onOpenIntake} onCreateWork={onCreateWork} />
      </div>
      <OverviewSummaryStats stats={stats} />
    </WorkspaceSummaryStrip>
  );
}
