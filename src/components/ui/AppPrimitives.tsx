import { AlertTriangle, CheckCircle2, CircleAlert, CircleOff, LoaderCircle, SearchX, Sparkles } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PropsWithChildren, type ReactNode } from 'react';

type SurfaceType = 'shell' | 'hero' | 'command' | 'data' | 'inspector' | 'muted' | 'warning' | 'modal' | 'row';

/**
 * Semantic surface roles:
 * - shell/data: default readable containers
 * - hero/command: emphasized summary + action surfaces
 * - inspector/muted: supportive side context
 * - warning: attention-required context
 * - modal: highest-elevation dialog surface
 * - row: repeatable list row baseline (hover/active handled in CSS)
 */
export function AppShellCard({ children, className = '', surface = 'shell' }: PropsWithChildren<{ className?: string; surface?: SurfaceType }>) {
  return <section className={`app-shell-card app-shell-card-${surface} ${className}`.trim()}>{children}</section>;
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
  tone?: 'default' | 'warn' | 'danger' | 'info';
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

export function WorkspacePage({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`workspace-page workspace-page-contract ${className}`.trim()}>{children}</div>;
}

export function WorkspaceSummaryStrip({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <AppShellCard className={`workspace-summary-strip ${className}`.trim()} surface="hero">{children}</AppShellCard>;
}

export function WorkspacePrimaryLayout({
  children,
  inspectorWidth = '380px',
  className = '',
}: PropsWithChildren<{ inspectorWidth?: string; className?: string }>) {
  return <div className={`workspace-primary-layout ${className}`.trim()} style={{ ['--workspace-inspector-width' as string]: inspectorWidth }}>{children}</div>;
}

export function WorkspaceTopStack({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`workspace-top-stack ${className}`.trim()}>{children}</div>;
}

export function WorkspaceToolbarRow({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`workspace-toolbar-row toolbar-row ${className}`.trim()}>{children}</div>;
}

export function WorkspaceInspectorSection({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <section className="workspace-inspector-section inspector-block">
      <div>
        <div className="workspace-inspector-section-title">{title}</div>
        {subtitle ? <p className="workspace-inspector-section-subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PageSection({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`page-section ${className}`.trim()}>{children}</section>;
}

export function SurfaceBlock({
  children,
  surface = 'muted',
  className = '',
}: PropsWithChildren<{ surface?: Extract<SurfaceType, 'muted' | 'inspector' | 'row' | 'warning'>; className?: string }>) {
  return <div className={`surface-block surface-block-${surface} ${className}`.trim()}>{children}</div>;
}

export function AppBadge({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'info' | 'warn' | 'success' | 'danger' }>) {
  return <span className={`app-badge app-badge-${tone}`}>{children}</span>;
}

export function WorkspaceHeaderMetaPill({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'info' | 'warn' }>) {
  return <div className={`workspace-meta-pill workspace-meta-pill-${tone}`}>{children}</div>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state-panel state-panel-empty" role="status" aria-live="polite">
      <div className="state-panel-icon" aria-hidden="true"><CircleOff size={18} /></div>
      <div className="state-panel-title">{title}</div>
      <div className="state-panel-message">{message}</div>
    </div>
  );
}

type StateTone = 'empty' | 'loading' | 'error' | 'warning' | 'success' | 'neutral';

const stateIconByTone: Record<StateTone, ReactNode> = {
  empty: <CircleOff size={18} />,
  loading: <LoaderCircle size={18} className="state-spin" />,
  error: <CircleAlert size={18} />,
  warning: <AlertTriangle size={18} />,
  success: <CheckCircle2 size={18} />,
  neutral: <Sparkles size={18} />,
};

export function StatePanel({
  title,
  message,
  tone = 'neutral',
  compact = false,
  action,
}: {
  title: string;
  message: string;
  tone?: StateTone;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`state-panel state-panel-${tone} ${compact ? 'state-panel-compact' : ''}`.trim()} role="status" aria-live="polite">
      <div className="state-panel-icon" aria-hidden="true">{stateIconByTone[tone]}</div>
      <div className="state-panel-title">{title}</div>
      <div className="state-panel-message">{message}</div>
      {action ? <div className="state-panel-action">{action}</div> : null}
    </div>
  );
}

export function NoMatchesState({ title = 'No matches', message }: { title?: string; message: string }) {
  return (
    <div className="state-panel state-panel-empty" role="status" aria-live="polite">
      <div className="state-panel-icon" aria-hidden="true"><SearchX size={18} /></div>
      <div className="state-panel-title">{title}</div>
      <div className="state-panel-message">{message}</div>
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
        const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
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

export function AppModal({
  children,
  size = 'standard',
  onBackdropClick,
  onClose,
  closeOnEscape = true,
}: PropsWithChildren<{ size?: 'compact' | 'standard' | 'wide' | 'inspector'; onBackdropClick?: () => void; onClose?: () => void; closeOnEscape?: boolean }>) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!closeOnEscape || !onClose) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div className="modal-backdrop" onClick={onBackdropClick} role="presentation">
      <div
        className={`modal-panel app-shell-card app-shell-card-modal modal-panel-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label="Modal dialog"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function AppModalHeader({ title, subtitle, onClose, closeLabel = 'Close' }: { title: string; subtitle?: string; onClose: () => void; closeLabel?: string }) {
  return (
    <div className="modal-header">
      <div>
        <div className="modal-title">{title}</div>
        {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
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
