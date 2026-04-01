import type { SavedViewKey } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

const views: Array<{ key: SavedViewKey; label: string; helper: string }> = [
  { key: 'All', label: 'All', helper: 'Everything in the system' },
  { key: 'Today', label: 'Today', helper: 'Due, overdue, or ready for touch' },
  { key: 'Waiting', label: 'Waiting', helper: 'Waiting internal or external' },
  { key: 'Needs nudge', label: 'Needs nudge', helper: 'Follow-up due now' },
  { key: 'At risk', label: 'At risk', helper: 'Critical and slipping items' },
  { key: 'Overdue', label: 'Overdue', helper: 'Past due now' },
  { key: 'By project', label: 'By project', helper: 'Grouped operational view' },
];

export function SavedViewsBar() {
  const { activeView, setActiveView } = useAppStore(useShallow((s) => ({ activeView: s.activeView, setActiveView: s.setActiveView })));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-medium text-slate-700">Saved views</div>
      <div className="saved-view-grid">
        {views.map((view) => (
          <button
            key={view.key}
            onClick={() => setActiveView(view.key)}
            className={activeView === view.key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}
          >
            <div className="text-sm font-semibold text-slate-900">{view.label}</div>
            <div className="mt-1 text-xs text-slate-500">{view.helper}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
