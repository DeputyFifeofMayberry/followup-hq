import { OverviewDashboardHeader } from './OverviewDashboardHeader';
import { OverviewDashboardKpis } from './OverviewDashboardKpis';
import { OverviewDashboardPanels } from './OverviewDashboardPanels';
import type {
  OverviewDashboardKpi,
  OverviewDashboardLaneHealth,
  OverviewDashboardModel,
  OverviewDashboardNextUpRow,
  OverviewDashboardProjectHotspot,
  OverviewFilterKey,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';
import type { ExecutionSectionKey } from '../../types';

interface OverviewDashboardProps {
  dashboard: OverviewDashboardModel;
  selectedFilter: OverviewFilterKey;
  onFocusFilter: (filterKey: OverviewFilterKey) => void;
  onSelectKpi: (kpi: OverviewDashboardKpi) => void;
  onCreateWork: () => void;
  onOpenIntake: () => void;
  onRouteLane: (lane: 'tasks' | 'followups', section: ExecutionSectionKey, intentLabel: string) => void;
  onFocusNextUp: (row: OverviewDashboardNextUpRow) => void;
  onFocusLaneHealth: (lane: OverviewDashboardLaneHealth) => void;
  onFocusHotspot: (hotspot: OverviewDashboardProjectHotspot) => void;
  onFocusCommitment: (key: keyof OverviewDashboardModel['commitments']) => void;
  onFocusOwnershipRisk: (key: keyof OverviewDashboardModel['ownershipRisk']) => void;
  onResetFocus: () => void;
}

export function OverviewDashboard({
  dashboard,
  selectedFilter,
  onFocusFilter,
  onSelectKpi,
  onCreateWork,
  onOpenIntake,
  onRouteLane,
  onFocusNextUp,
  onFocusLaneHealth,
  onFocusHotspot,
  onFocusCommitment,
  onFocusOwnershipRisk,
  onResetFocus,
}: OverviewDashboardProps) {
  return (
    <section className="overview-dashboard-shell" aria-label="Overview dashboard">
      <OverviewDashboardHeader
        totalQueue={dashboard.totalQueue}
        selectedFilter={selectedFilter}
        onFocusFilter={onFocusFilter}
        onCreateWork={onCreateWork}
        onOpenIntake={onOpenIntake}
      />
      <OverviewDashboardKpis kpis={dashboard.kpis} onSelectKpi={onSelectKpi} />
      <OverviewDashboardPanels
        dashboard={dashboard}
        onRouteLane={onRouteLane}
        onFocusNextUp={onFocusNextUp}
        onFocusLaneHealth={onFocusLaneHealth}
        onFocusHotspot={onFocusHotspot}
        onFocusCommitment={onFocusCommitment}
        onFocusOwnershipRisk={onFocusOwnershipRisk}
        onResetFocus={onResetFocus}
      />
    </section>
  );
}
