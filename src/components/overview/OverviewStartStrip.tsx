import { ExecutionLaneSummary, SectionHeader } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';
import { OverviewSummaryStats } from './OverviewSummaryStats';
import { OverviewRouteActions } from './OverviewRouteActions';

interface OverviewStartStripProps {
  stats: ExecutionQueueStats;
  onOpenIntake: () => void;
  onRouteFollowUps: () => void;
  onRouteTasks: () => void;
  onQuickAdd: () => void;
}

export function OverviewStartStrip({ stats, onOpenIntake, onRouteFollowUps, onRouteTasks, onQuickAdd }: OverviewStartStripProps) {
  return (
    <ExecutionLaneSummary className="overview-hero-card overview-start-band">
      <SectionHeader title="Overview lane" subtitle="Scan pressure, select an item, and route it to the right execution lane." compact />
      <OverviewSummaryStats stats={stats} />
      <OverviewRouteActions
        onOpenIntake={onOpenIntake}
        onRouteFollowUps={onRouteFollowUps}
        onRouteTasks={onRouteTasks}
        onQuickAdd={onQuickAdd}
      />
    </ExecutionLaneSummary>
  );
}
