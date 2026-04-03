import type { KeyboardEvent, PropsWithChildren, ReactNode } from 'react';

export function AppShellCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`app-shell-card ${className}`.trim()}>{children}</section>;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`section-header ${compact ? 'section-header-compact' : ''}`.trim()}>
      <div>
        <h3 className="section-title">{title}</h3>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

export function StatTile({ label, value, helper, tone = 'default' }: { label: string; value: number | string; helper?: string; tone?: 'default' | 'warn' | 'danger' }) {
  return (
    <div className={`stat-tile stat-tile-${tone}`}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {helper ? <div className="stat-tile-helper">{helper}</div> : null}
    </div>
  );
}

export function FilterBar({ children }: PropsWithChildren) {
  return <div className="filter-bar">{children}</div>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-message">{message}</div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="segmented-control" role="tablist" aria-label="Segmented control">
      {options.map((option, index) => {
        const active = value === option.value;
        const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const nextIndex = event.key === 'ArrowRight'
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
          onChange(options[nextIndex].value);
        };

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            className={active ? 'segmented-control-btn segmented-control-btn-active' : 'segmented-control-btn'}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
