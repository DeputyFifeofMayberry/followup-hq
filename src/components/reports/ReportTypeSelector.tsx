import type { ReportSelectorItem } from '../../lib/reports';
import type { ReportType } from '../../types';

interface ReportTypeSelectorProps {
  items: ReportSelectorItem[];
  value: ReportType;
  onChange: (value: ReportType) => void;
}

export function ReportTypeSelector({ items, value, onChange }: ReportTypeSelectorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={active
              ? 'rounded-2xl border border-slate-900 bg-slate-900 px-3 py-3 text-left text-white shadow-sm transition'
              : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50'}
            aria-pressed={active}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className={active ? 'mt-1 text-xs text-slate-200' : 'mt-1 text-xs text-slate-500'}>{item.description}</div>
          </button>
        );
      })}
    </div>
  );
}
