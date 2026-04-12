import type { OverviewDashboardAction, OverviewDashboardKpi } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewDashboardKpisProps {
  kpis: OverviewDashboardKpi[];
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewDashboardKpis({ kpis, onAction }: OverviewDashboardKpisProps) {
  return (
    <section className="overview-dashboard-kpi-grid" aria-label="Overview key performance indicators">
      {kpis.map((kpi) => (
        <button
          key={kpi.key}
          type="button"
          className={`overview-dashboard-kpi-card overview-dashboard-kpi-${kpi.tone}`}
          onClick={() => onAction({ type: 'focus_kpi', key: kpi.key })}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <small>{kpi.helper}</small>
        </button>
      ))}
    </section>
  );
}
