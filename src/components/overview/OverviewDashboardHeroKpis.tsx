import type { OverviewDashboardAction, OverviewDashboardHeroKpi } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardHeroKpisProps {
  heroKpis: OverviewDashboardHeroKpi[];
  totalQueue: number;
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboardHeroKpis({ heroKpis, totalQueue, onAction }: OverviewDashboardHeroKpisProps) {
  return (
    <section className="overview-dashboard-hero-kpi-row" aria-label="Overview priority metrics">
      {heroKpis.map((kpi) => (
        <button
          key={kpi.key}
          type="button"
          className={`overview-dashboard-hero-kpi overview-dashboard-hero-kpi-${kpi.tone}`}
          onClick={() => onAction({ type: 'focus_kpi', key: kpi.key })}
        >
          <span className="overview-dashboard-hero-kpi-label">{kpi.label}</span>
          <span className="overview-dashboard-hero-kpi-pct">{kpi.percentOfQueue}%</span>
          <span className="overview-dashboard-hero-kpi-count">
            {kpi.value} of {totalQueue} in scope
          </span>
          <span className="overview-dashboard-hero-kpi-helper">{kpi.helper}</span>
          <span className="overview-dashboard-hero-kpi-bar" aria-hidden>
            <span className="overview-dashboard-hero-kpi-bar-fill" style={{ width: `${Math.min(100, kpi.percentOfQueue)}%` }} />
          </span>
        </button>
      ))}
    </section>
  );
}
