import { SectionHeader, WorkspaceSummaryStrip } from '../ui/AppPrimitives';
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
    <WorkspaceSummaryStrip className="overview-hero-card overview-start-band">
      <SectionHeader title="Today at a glance" subtitle="Check pressure, then route work to the execution lane." compact />
      <OverviewSummaryStats stats={stats} />
      <OverviewRouteActions
        onOpenIntake={onOpenIntake}
        onRouteFollowUps={onRouteFollowUps}
        onRouteTasks={onRouteTasks}
        onQuickAdd={onQuickAdd}
      />
    </WorkspaceSummaryStrip>
  );
}
