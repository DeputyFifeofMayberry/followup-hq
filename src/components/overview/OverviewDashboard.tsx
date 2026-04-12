import { OverviewDashboardHeader } from './OverviewDashboardHeader';
import { OverviewDashboardKpis } from './OverviewDashboardKpis';
import { OverviewDashboardPanels } from './OverviewDashboardPanels';
import type {
  OverviewDashboardAction,
  OverviewDashboardModel,
  OverviewFilterKey,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardProps {
  dashboard: OverviewDashboardModel;
  selectedFilter: OverviewFilterKey;
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboard({
  dashboard,
  selectedFilter,
  onAction,
}: OverviewDashboardProps) {
  return (
    <section className="overview-dashboard-shell" aria-label="Overview dashboard">
      <OverviewDashboardHeader
        totalQueue={dashboard.totalQueue}
        selectedFilter={selectedFilter}
        onAction={onAction}
      />
      <OverviewDashboardKpis kpis={dashboard.kpis} onAction={onAction} />
      <OverviewDashboardPanels
        dashboard={dashboard}
        onAction={onAction}
      />
    </section>
  );
}
