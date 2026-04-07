import type { OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  selectedFilter: string;
  onSelectFilter: (filterKey: string) => void;
}

export function OverviewSignalCards({ cards, selectedFilter, onSelectFilter }: OverviewSignalCardsProps) {
  return (
    <div className="overview-signal-grid" aria-label="Queue focus filters">
      <button
        type="button"
        className={`overview-signal-chip ${selectedFilter === 'all' ? 'overview-signal-chip-active' : ''}`}
        onClick={() => onSelectFilter('all')}
      >
        <span className="overview-signal-chip-label">All queue</span>
      </button>
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          className={`overview-signal-chip overview-signal-card-${card.key} ${selectedFilter === card.key ? 'overview-signal-chip-active' : ''}`}
          onClick={() => onSelectFilter(card.key)}
        >
          <span className="overview-signal-chip-label">{card.label}</span>
          <strong className="overview-signal-chip-count">{card.count}</strong>
        </button>
      ))}
    </div>
  );
}
