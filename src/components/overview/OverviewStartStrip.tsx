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
      <div className="overview-command-head">
        <SectionHeader title="Operational command deck" subtitle="Scan pressure, prioritize what matters now, and route work into the right lane." compact />
        <p className="overview-command-caption">Use this surface to make fast routing decisions across tasks, follow-ups, and intake cleanup.</p>
      </div>
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
