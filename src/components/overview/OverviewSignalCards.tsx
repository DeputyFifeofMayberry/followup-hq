import type { OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  selectedFilter: string;
  onSelectFilter: (filterKey: string) => void;
}

export function OverviewSignalCards({ cards, selectedFilter, onSelectFilter }: OverviewSignalCardsProps) {
  return (
    <div className="overview-filter-row" aria-label="Overview focus filters">
      <button
        type="button"
        className={`overview-filter-pill overview-filter-pill-baseline ${selectedFilter === 'all' ? 'overview-filter-pill-active' : ''}`}
        onClick={() => onSelectFilter('all')}
      >
        All queue
      </button>
      <div className="overview-filter-pill-group" role="group" aria-label="Priority focus filters">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`overview-filter-pill overview-filter-pill-${card.key} ${selectedFilter === card.key ? 'overview-filter-pill-active' : ''}`}
            onClick={() => onSelectFilter(card.key)}
          >
            <span>{card.label}</span>
            <strong>{card.count}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
