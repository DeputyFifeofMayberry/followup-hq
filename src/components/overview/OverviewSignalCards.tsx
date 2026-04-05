import type { OverviewSignalCard } from '../../domains/overview/hooks/useOverviewTriageViewModel';

interface OverviewSignalCardsProps {
  cards: OverviewSignalCard[];
  onRouteCard: (card: OverviewSignalCard) => void;
}

export function OverviewSignalCards({ cards, onRouteCard }: OverviewSignalCardsProps) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {cards.map((card) => (
        <div key={card.key} className="rounded-xl border border-slate-200 bg-white/85 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <strong className="text-lg text-slate-950">{card.count}</strong>
            <button onClick={() => onRouteCard(card)} className="action-btn !px-2.5 !py-1 text-xs">
              {card.ctaLabel}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
