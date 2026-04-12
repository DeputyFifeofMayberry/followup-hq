import type { OverviewFilterKey, OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  selectedFilter: OverviewFilterKey;
  onSelectFilter: (filterKey: OverviewFilterKey) => void;
}

export function OverviewSignalCards({ cards, selectedFilter, onSelectFilter }: OverviewSignalCardsProps) {
  return (
    <div className="overview-filter-row" aria-label="Overview focus filters">
      <button
        type="button"
        className={`task-mobile-view-chip overview-filter-pill overview-filter-pill-all ${selectedFilter === 'all' ? 'task-mobile-view-chip-active' : ''}`}
        onClick={() => onSelectFilter('all')}
        aria-pressed={selectedFilter === 'all'}
      >
        <span>All queue</span>
        <strong>View all</strong>
      </button>
      <div className="overview-filter-pill-group" role="group" aria-label="Priority focus filters">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`task-mobile-view-chip overview-filter-pill overview-filter-pill-${card.key} ${selectedFilter === card.key ? 'task-mobile-view-chip-active' : ''}`}
            onClick={() => onSelectFilter(card.key)}
            aria-pressed={selectedFilter === card.key}
          >
            <span>{card.label}</span>
            <strong>{card.count}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
