import type { PropsWithChildren, ReactNode } from 'react';

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
    <div className="empty-state">
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
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={value === option.value ? 'segmented-control-btn segmented-control-btn-active' : 'segmented-control-btn'}
          role="tab"
          aria-selected={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AppModal({ children, size = 'standard' }: PropsWithChildren<{ size?: 'compact' | 'standard' | 'wide' | 'inspector' }>) {
  return (
    <div className="modal-backdrop">
      <div className={`modal-panel modal-panel-${size}`}>{children}</div>
    </div>
  );
}

export function AppModalHeader({ title, subtitle, onClose, closeLabel = 'Close' }: { title: string; subtitle?: string; onClose: () => void; closeLabel?: string }) {
  return (
    <div className="modal-header">
      <div>
        <div className="text-lg font-semibold text-slate-950">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      <button onClick={onClose} className="action-btn">{closeLabel}</button>
    </div>
  );
}

export function AppModalBody({ children, scrollable = true }: PropsWithChildren<{ scrollable?: boolean }>) {
  return <div className={scrollable ? 'modal-body modal-body-scroll' : 'modal-body'}>{children}</div>;
}

export function AppModalFooter({ children }: PropsWithChildren) {
  return <div className="modal-footer">{children}</div>;
}
