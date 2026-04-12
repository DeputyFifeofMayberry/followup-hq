import type { OverviewDashboardKpi } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardKpisProps {
  kpis: OverviewDashboardKpi[];
  onSelectKpi: (kpi: OverviewDashboardKpi) => void;
}

export function OverviewDashboardKpis({ kpis, onSelectKpi }: OverviewDashboardKpisProps) {
  return (
    <section className="overview-dashboard-kpi-grid" aria-label="Overview key performance indicators">
      {kpis.map((kpi) => (
        <button
          key={kpi.key}
          type="button"
          className={`overview-dashboard-kpi-card overview-dashboard-kpi-${kpi.tone}`}
          onClick={() => onSelectKpi(kpi)}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <small>{kpi.helper}</small>
        </button>
      ))}
    </section>
  );
}
