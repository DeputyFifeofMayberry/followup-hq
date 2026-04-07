import { ExecutionLaneSummary, SectionHeader } from '../ui/AppPrimitives';
import type { ExecutionQueueStats } from '../../domains/shared';
import { OverviewSummaryStats } from './OverviewSummaryStats';
import { OverviewRouteActions } from './OverviewRouteActions';

interface OverviewStartStripProps {
  stats: ExecutionQueueStats;
  onOpenIntake: () => void;
  onQuickAdd: () => void;
}

export function OverviewStartStrip({ stats, onOpenIntake, onQuickAdd }: OverviewStartStripProps) {
  return (
    <ExecutionLaneSummary className="overview-hero-card overview-start-band">
      <div className="overview-command-head">
        <SectionHeader title="Queue command strip" subtitle="Use summary signals to focus the queue, then route from the inspector." compact />
      </div>
      <OverviewSummaryStats stats={stats} />
      <OverviewRouteActions
        onOpenIntake={onOpenIntake}
        onQuickAdd={onQuickAdd}
      />
    </ExecutionLaneSummary>
  );
}
