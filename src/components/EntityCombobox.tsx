import { useMemo, useState } from 'react';

interface Option {
  id: string;
  label: string;
  meta?: string;
}

interface EntityComboboxProps {
  label: string;
  valueId?: string;
  valueLabel?: string;
  options: Option[];
  placeholder?: string;
  onSelect: (option: Option) => void;
  onCreate?: (label: string) => void;
}

export function EntityCombobox({ label, valueId, valueLabel, options, placeholder, onSelect, onCreate }: EntityComboboxProps) {
  const [query, setQuery] = useState('');
  const currentText = query || valueLabel || '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter((option) => option.label.toLowerCase().includes(q) || option.meta?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, query]);

  const hasExact = !!options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="field-block">
      <label className="field-label">{label}</label>
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <input
          className="field-input border-0 p-0"
          value={currentText}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
        {(query || filtered.length > 0) ? (
          <div className="mt-2 max-h-40 space-y-1 overflow-auto">
            {filtered.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onSelect(option);
                  setQuery('');
                }}
                className={`w-full rounded-lg px-2 py-1 text-left text-sm ${valueId === option.id ? 'bg-sky-100 text-sky-900' : 'hover:bg-slate-100'}`}
              >
                <span>{option.label}</span>
                {option.meta ? <span className="ml-2 text-xs text-slate-500">{option.meta}</span> : null}
              </button>
            ))}
            {onCreate && query.trim() && !hasExact ? (
              <button
                onClick={() => {
                  onCreate(query.trim());
                  setQuery('');
                }}
                className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                + Create “{query.trim()}”
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
