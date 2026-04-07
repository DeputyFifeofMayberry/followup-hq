import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Option {
  id: string;
  label: string;
  meta?: string;
}

interface EntityComboboxProps {
  label?: string;
  valueId?: string;
  valueLabel?: string;
  options: Option[];
  placeholder?: string;
  onSelect: (option: Option) => void;
  onCreate?: (label: string) => void;
  hideMeta?: boolean;
}

export function EntityCombobox({ label, valueId, valueLabel, options, placeholder, onSelect, onCreate, hideMeta = false }: EntityComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const currentText = open ? query : (valueLabel || '');

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter((option) => option.label.toLowerCase().includes(q) || option.meta?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, query]);

  const hasExact = !!options.find((option) => option.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="field-block" ref={shellRef}>
      {label ? <label className="field-label">{label}</label> : null}
      <button
        type="button"
        className="field-input flex items-center justify-between text-left"
        onClick={() => {
          setOpen((value) => !value);
          setQuery('');
        }}
      >
        <span className={valueLabel ? 'text-slate-900' : 'text-slate-400'}>{valueLabel || placeholder || `Select ${label || 'value'}`}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <input
            className="field-input"
            value={currentText}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder || `Search ${label || 'options'}`}
            autoFocus
          />
          <div className="mt-2 max-h-48 space-y-1 overflow-auto">
            {filtered.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onSelect(option);
                  setQuery('');
                  setOpen(false);
                }}
                className={`w-full rounded-lg px-2 py-1 text-left text-sm ${valueId === option.id ? 'bg-sky-100 text-sky-900' : 'hover:bg-slate-100'}`}
              >
                <span>{option.label}</span>
                {!hideMeta && option.meta ? <span className="ml-2 text-xs text-slate-500">{option.meta}</span> : null}
              </button>
            ))}
            {onCreate && query.trim() && !hasExact ? (
              <button
                type="button"
                onClick={() => {
                  onCreate(query.trim());
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                + Create “{query.trim()}”
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
