import type { OverviewChartSegment } from '../../domains/overview/hooks/useOverviewTriageViewModel';

const RING_R = 46;
const VIEW = 120;
const CX = VIEW / 2;
const CY = VIEW / 2;
const CIRC = 2 * Math.PI * RING_R;

interface OverviewDonutChartProps {
  title: string;
  segments: OverviewChartSegment[];
  centerLine: string;
  footnote?: string;
  emptyMessage?: string;
  chartClassName?: string;
}

export function OverviewDonutChart({
  title,
  segments,
  centerLine,
  footnote,
  emptyMessage = 'No items in this scope.',
  chartClassName,
}: OverviewDonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const palette = [
    'var(--od-chart-1)',
    'var(--od-chart-2)',
    'var(--od-chart-3)',
    'var(--od-chart-4)',
    'var(--od-chart-5)',
  ];

  const summaryText = total > 0
    ? segments.map((s) => `${s.label} ${s.count}`).join(', ')
    : emptyMessage;

  return (
    <article className={`overview-dashboard-chart-card ${chartClassName ?? ''}`.trim()}>
      <header className="overview-dashboard-chart-card-header">
        <h3>{title}</h3>
      </header>
      <div className="overview-donut-wrap">
        {total === 0 ? (
          <p className="overview-chart-empty">{emptyMessage}</p>
        ) : (
          <>
            <svg
              className="overview-donut-svg"
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              role="img"
              aria-label={summaryText}
            >
              <title>{summaryText}</title>
              {(() => {
                let rotation = -90;
                return segments.map((seg, i) => {
                  const frac = seg.count / total;
                  const len = Math.max(0.01, frac * CIRC);
                  const el = (
                    <circle
                      key={`${seg.key}-${i}`}
                      cx={CX}
                      cy={CY}
                      r={RING_R}
                      fill="none"
                      stroke={palette[i % palette.length]}
                      strokeWidth={12}
                      strokeLinecap="round"
                      strokeDasharray={`${len} ${CIRC}`}
                      transform={`rotate(${rotation} ${CX} ${CY})`}
                    />
                  );
                  rotation += frac * 360;
                  return el;
                });
              })()}
            </svg>
            <div className="overview-donut-center" aria-hidden>
              <span>{centerLine}</span>
            </div>
          </>
        )}
      </div>
      {total > 0 ? (
        <ul className="overview-donut-legend">
          {segments.map((seg, i) => (
            <li key={seg.key}>
              <span className="overview-donut-swatch" style={{ background: palette[i % palette.length] }} />
              <span>{seg.label}</span>
              <strong>{seg.count}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {footnote ? <p className="overview-chart-footnote">{footnote}</p> : null}
    </article>
  );
}
