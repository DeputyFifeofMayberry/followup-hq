import type { OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  onRouteCard: (card: OverviewSignalCard) => void;
}

export function OverviewSignalCards({ cards, onRouteCard }: OverviewSignalCardsProps) {
  return (
    <div className="overview-signal-grid" aria-label="Routing signals">
      {cards.map((card) => (
        <div key={card.key} className="overview-signal-card">
          <strong className="overview-signal-count">{card.count}</strong>
          <span className="overview-signal-label">{card.label}</span>
          <button onClick={() => onRouteCard(card)} className="action-btn overview-signal-cta !px-2 !py-0.5 text-[11px]">
            {card.ctaLabel}
          </button>
        </div>
      ))}
    </div>
  );
}
