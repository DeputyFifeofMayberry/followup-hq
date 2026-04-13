import type {
  OverviewCommitmentSnapshotBar,
  OverviewDashboardAction,
  OverviewProjectPressureBar,
} from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewProjectPressureBarsProps {
  bars: OverviewProjectPressureBar[];
  maxCount: number;
  onFocusProject: (project: string) => void;
}

export function OverviewProjectPressureBars({ bars, maxCount, onFocusProject }: OverviewProjectPressureBarsProps) {
  const max = Math.max(maxCount, 1);
  return (
    <article className="overview-dashboard-chart-card overview-dashboard-chart-card-tall">
      <header className="overview-dashboard-chart-card-header">
        <h3>Pressure by project</h3>
        <p className="overview-dashboard-chart-sub">Due or blocked items in scoped queue</p>
      </header>
      {bars.length === 0 ? (
        <p className="overview-chart-empty">No concentrated pressure in this scope.</p>
      ) : (
        <ul className="overview-hbar-list">
          {bars.map((bar) => (
            <li key={bar.project}>
              <button
                type="button"
                className="overview-hbar-row"
                onClick={() => onFocusProject(bar.project)}
              >
                <span className="overview-hbar-label" title={bar.project}>{bar.project}</span>
                <span className="overview-hbar-track">
                  <span
                    className="overview-hbar-fill"
                    style={{ width: `${Math.round((bar.count / max) * 100)}%` }}
                  />
                </span>
                <span className="overview-hbar-value">{bar.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface OverviewCommitmentSnapshotBarsProps {
  bars: OverviewCommitmentSnapshotBar[];
  onAction: (action: OverviewDashboardAction) => void;
}

export function OverviewCommitmentSnapshotBars({ bars, onAction }: OverviewCommitmentSnapshotBarsProps) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <article className="overview-dashboard-chart-card overview-dashboard-chart-card-tall">
      <header className="overview-dashboard-chart-card-header">
        <h3>Commitment snapshot</h3>
        <p className="overview-dashboard-chart-sub">Current scoped counts (not a historical trend)</p>
      </header>
      <ul className="overview-vbar-list" aria-label="Commitment counts">
        {bars.map((bar) => (
          <li key={bar.key}>
            <button
              type="button"
              className="overview-vbar-item"
              onClick={() => onAction({ type: 'focus_commitment', key: bar.key })}
            >
              <span className="overview-vbar-label">{bar.label}</span>
              <span className="overview-vbar-col">
                <span
                  className="overview-vbar-fill"
                  style={{ height: `${Math.max(8, Math.round((bar.count / max) * 100))}%` }}
                />
              </span>
              <span className="overview-vbar-count">{bar.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
