import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

type ButtonTone = 'primary' | 'secondary' | 'danger';

function getButtonClass(tone: ButtonTone) {
  switch (tone) {
    case 'primary':
      return 'primary-btn';
    case 'danger':
      return 'action-btn action-btn-danger';
    default:
      return 'action-btn';
  }
}

export function AppButton({
  tone = 'secondary',
  className = '',
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }>) {
  return (
    <button {...props} className={`${getButtonClass(tone)} ${className}`.trim()}>
      {children}
    </button>
  );
}

export function AppShellCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`app-shell-card ${className}`.trim()}>{children}</section>;
}

export function ElevatedPanel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`elevated-panel ${className}`.trim()}>{children}</section>;
}

export function MutedPanel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`muted-panel ${className}`.trim()}>{children}</section>;
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

export function StatTile({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  helper?: string;
  tone?: 'default' | 'warn' | 'danger';
}) {
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

export function AppBadge({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'info' | 'warn' | 'success' | 'danger' }>) {
  return <span className={`app-badge app-badge-${tone}`}>{children}</span>;
}

export function WorkspaceHeaderMetaPill({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'info' | 'warn' }>) {
  return <div className={`workspace-meta-pill workspace-meta-pill-${tone}`}>{children}</div>;
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

export function NavItem({
  label,
  icon,
  active,
  deemphasized,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  deemphasized?: boolean;
  badge?: string | number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`app-nav-item ${active ? 'app-nav-item-active' : ''} ${deemphasized ? 'app-nav-item-muted' : ''}`.trim()}>
      <span className="app-nav-item-main">
        <span className="app-nav-item-icon">{icon}</span>
        <span>{label}</span>
      </span>
      {badge ? <span className="app-nav-count-pill">{badge}</span> : null}
    </button>
  );
}
