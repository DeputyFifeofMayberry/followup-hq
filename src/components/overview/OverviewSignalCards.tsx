import type { OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  onRouteCard: (card: OverviewSignalCard) => void;
}

export function OverviewSignalCards({ cards, onRouteCard }: OverviewSignalCardsProps) {
  return (
    <div className="overview-signal-grid" aria-label="Routing signals">
      {cards.map((card) => (
        <div key={card.key} className={`overview-signal-card overview-signal-card-${card.key}`}>
          <div className="overview-signal-topline">
            <span className="overview-signal-label">{card.label}</span>
            <span className="overview-signal-lane">{card.lane === 'tasks' ? 'Tasks lane' : 'Follow Ups lane'}</span>
          </div>
          <strong className="overview-signal-count">{card.count}</strong>
          <p className="overview-signal-intent">{card.intentLabel}</p>
          <button onClick={() => onRouteCard(card)} className="action-btn overview-signal-cta">
            {card.ctaLabel}
          </button>
        </div>
      ))}
    </div>
  );
}
