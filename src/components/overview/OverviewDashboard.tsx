import { OverviewDashboardHeader } from './OverviewDashboardHeader';
import { OverviewDashboardKpis } from './OverviewDashboardKpis';
import { OverviewDashboardPanels } from './OverviewDashboardPanels';
import type { OverviewDashboardModel, OverviewFilterKey } from '../../domains/overview/hooks/useOverviewTriageViewModel';
import type { ExecutionSectionKey } from '../../types';

interface OverviewDashboardProps {
  dashboard: OverviewDashboardModel;
  selectedFilter: OverviewFilterKey;
  onSelectFilter: (filterKey: OverviewFilterKey) => void;
  onCreateWork: () => void;
  onOpenIntake: () => void;
  onRouteLane: (lane: 'tasks' | 'followups', section: ExecutionSectionKey, intentLabel: string) => void;
  onSelectRow: (rowId: string) => void;
}

export function OverviewDashboard({
  dashboard,
  selectedFilter,
  onSelectFilter,
  onCreateWork,
  onOpenIntake,
  onRouteLane,
  onSelectRow,
}: OverviewDashboardProps) {
  return (
    <section className="overview-dashboard-shell" aria-label="Overview dashboard">
      <OverviewDashboardHeader
        totalQueue={dashboard.totalQueue}
        selectedFilter={selectedFilter}
        onSelectFilter={onSelectFilter}
        onCreateWork={onCreateWork}
        onOpenIntake={onOpenIntake}
      />
      <OverviewDashboardKpis kpis={dashboard.kpis} onSelectFilter={(key) => { if (key) onSelectFilter(key); }} />
      <OverviewDashboardPanels dashboard={dashboard} onRouteLane={onRouteLane} onSelectFilter={onSelectFilter} onSelectRow={onSelectRow} />
    </section>
  );
}
