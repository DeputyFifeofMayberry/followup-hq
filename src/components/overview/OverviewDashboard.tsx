import { useMemo } from 'react';
import { OverviewDashboardHeader } from './OverviewDashboardHeader';
import { OverviewDashboardHeroKpis } from './OverviewDashboardHeroKpis';
import { OverviewDashboardNextUp } from './OverviewDashboardNextUp';
import { OverviewDashboardPanels } from './OverviewDashboardPanels';
import { OverviewDonutChart } from './OverviewDonutChart';
import { OverviewCommitmentSnapshotBars, OverviewProjectPressureBars } from './OverviewDashboardBarCharts';
import type {
  OverviewDashboardAction,
  OverviewDashboardModel,
  OverviewFilterKey,
  OverviewTimeWindow,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';

const WORK_SLICE_LABELS: Record<OverviewFilterKey, string> = {
  all: 'All queue',
  due_now: 'Due now',
  blocked: 'Blocked',
  waiting: 'Waiting',
  ready_close: 'Ready to close',
};

interface OverviewDashboardProps {
  dashboard: OverviewDashboardModel;
  selectedFilter: OverviewFilterKey;
  scopeProject: string;
  scopeTimeWindow: OverviewTimeWindow;
  projectOptions: string[];
  onScopeProject: (project: string) => void;
  onScopeTimeWindow: (window: OverviewTimeWindow) => void;
  onWorkSliceChange: (filterKey: OverviewFilterKey) => void;
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboard({
  dashboard,
  selectedFilter,
  scopeProject,
  scopeTimeWindow,
  projectOptions,
  onScopeProject,
  onScopeTimeWindow,
  onWorkSliceChange,
  onAction,
}: OverviewDashboardProps) {
  const scopeSummaryLine = useMemo(() => {
    const parts: string[] = [];
    if (scopeProject !== 'all') parts.push(scopeProject);
    if (scopeTimeWindow === 'week') parts.push('schedule: this week (+ overdue)');
    else if (scopeTimeWindow === 'month') parts.push('schedule: this month (+ overdue)');
    const slice = WORK_SLICE_LABELS[selectedFilter];
    parts.push(`slice: ${slice}`);
    return `Showing ${parts.join(' · ')} · ${dashboard.totalQueue} items`;
  }, [scopeProject, scopeTimeWindow, selectedFilter, dashboard.totalQueue]);

  return (
    <section
      className="overview-dashboard-shell overview-dashboard-shell--command overview-alignment-anchor"
      aria-label="Overview dashboard"
    >
      <OverviewDashboardHeader
        totalQueue={dashboard.totalQueue}
        selectedFilter={selectedFilter}
        scopeProject={scopeProject}
        scopeTimeWindow={scopeTimeWindow}
        projectOptions={projectOptions}
        scopeSummaryLine={scopeSummaryLine}
        onScopeProject={onScopeProject}
        onScopeTimeWindow={onScopeTimeWindow}
        onWorkSliceChange={onWorkSliceChange}
        onAction={onAction}
      />
      <OverviewDashboardHeroKpis
        heroKpis={dashboard.heroKpis}
        totalQueue={dashboard.totalQueue}
        onAction={onAction}
      />
      <div className="overview-dashboard-mid-grid">
        <OverviewDonutChart
          title="Work by status"
          segments={dashboard.charts.workComposition}
          centerLine={`Total ${dashboard.totalQueue}`}
          footnote="Each item is counted once (blocked → due now → ready to close → waiting → other)."
        />
        <OverviewDashboardNextUp rows={dashboard.nextUpRows} onAction={onAction} />
      </div>
      <div className="overview-dashboard-bot-grid">
        <OverviewDonutChart
          title="Record mix"
          segments={dashboard.charts.recordTypes}
          centerLine={`${dashboard.totalQueue} items`}
          footnote="Tasks vs follow-ups in the scoped queue."
          chartClassName="overview-dashboard-chart-card-compact"
        />
        <OverviewProjectPressureBars
          bars={dashboard.charts.projectPressure}
          maxCount={dashboard.charts.maxProjectPressure}
          onFocusProject={(project) => onAction({ type: 'focus_hotspot', project })}
        />
        <OverviewCommitmentSnapshotBars
          bars={dashboard.charts.commitmentSnapshot}
          onAction={onAction}
        />
      </div>
      <OverviewDashboardPanels dashboard={dashboard} onAction={onAction} />
    </section>
  );
}
