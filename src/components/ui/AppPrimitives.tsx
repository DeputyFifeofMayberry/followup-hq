import { AlertTriangle, CheckCircle2, CircleAlert, CircleOff, Info, LoaderCircle, SearchX, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AppToast } from '../../store/state/types';

type SurfaceType =
  | 'shell'
  | 'hero'
  | 'command'
  | 'data'
  | 'inspector'
  | 'muted'
  | 'warning'
  | 'modal'
  | 'row'
  | 'deck'
  | 'deckPanel'
  | 'deckInset';

const APP_SHELL_SURFACE_CLASS: Record<SurfaceType, string> = {
  shell: 'app-shell-card-shell',
  hero: 'app-shell-card-hero',
  command: 'app-shell-card-command',
  data: 'app-shell-card-data',
  inspector: 'app-shell-card-inspector',
  muted: 'app-shell-card-muted',
  warning: 'app-shell-card-warning',
  modal: 'app-shell-card-modal',
  row: 'app-shell-card-row',
  deck: 'app-shell-card-deck',
  deckPanel: 'app-shell-card-deck-panel',
  deckInset: 'app-shell-card-deck-inset',
};

/**
 * Semantic surface roles:
 * - shell/data: default readable containers
 * - hero/command: emphasized summary + action surfaces
 * - inspector/muted: supportive side context
 * - warning: attention-required context
 * - modal: highest-elevation dialog surface
 * - row: repeatable list row baseline (hover/active handled in CSS)
 * - deck/deckPanel/deckInset: command-deck canvas, dark panels, light dense islands
 */
export function AppShellCard({ children, className = '', surface = 'shell' }: PropsWithChildren<{ className?: string; surface?: SurfaceType }>) {
  const surfaceClass = APP_SHELL_SURFACE_CLASS[surface];
  return <section className={`app-shell-card ${surfaceClass} ${className}`.trim()}>{children}</section>;
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

export function WorkspaceContentFrame({
  children,
  className = '',
  variant = 'default',
}: PropsWithChildren<{ className?: string; variant?: 'default' | 'deck' }>) {
  const deckClass = variant === 'deck' ? 'app-command-deck' : '';
  return <div className={`workspace-content-frame ${deckClass} ${className}`.trim()}>{children}</div>;
}

export function WorkspaceSummaryStrip({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <AppShellCard className={`workspace-summary-strip ${className}`.trim()} surface="hero">{children}</AppShellCard>;
}

export function ExecutionLaneSummary({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <WorkspaceSummaryStrip className={`execution-lane-summary ${className}`.trim()}>{children}</WorkspaceSummaryStrip>;
}

export function ExecutionSummaryBand({
  kicker,
  title,
  supporting,
  stats,
  actions,
  className = '',
  tone = 'default',
}: {
  kicker: string;
  title: string;
  supporting?: string;
  stats?: ReactNode;
  actions?: ReactNode;
  className?: string;
  tone?: 'default' | 'warn' | 'calm';
}) {
  return (
    <ExecutionLaneSummary className={`execution-summary-band execution-summary-band-${tone} ${className}`.trim()}>
      <div className="execution-summary-band-head">
        <div className="execution-summary-band-copy">
          <div className="execution-summary-band-kicker">{kicker}</div>
          <p className="execution-summary-band-title">{title}</p>
          {supporting ? <p className="execution-summary-band-supporting">{supporting}</p> : null}
        </div>
        {actions ? <div className="execution-summary-band-actions">{actions}</div> : null}
      </div>
      {stats ? <div className="execution-summary-band-stats">{stats}</div> : null}
    </ExecutionLaneSummary>
  );
}

export function ExecutionSummaryStatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'danger' | 'info' | 'muted';
}) {
  return (
    <div className={`execution-summary-stat-chip control-chip control-chip-summary execution-summary-stat-chip-${tone}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

export function SupportWorkspaceSummary({
  title,
  subtitle,
  supportSentence,
  metrics,
}: {
  title: string;
  subtitle: string;
  supportSentence: string;
  metrics: ReactNode;
}) {
  return (
    <WorkspaceSummaryStrip className="space-y-3">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="overview-stat-grid overview-stat-grid-compact">{metrics}</div>
      <p className="text-xs text-slate-600">{supportSentence}</p>
    </WorkspaceSummaryStrip>
  );
}

export function SupportWorkspaceToolbar({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <AppShellCard className="advanced-filter-surface space-y-3" surface="command">
      <div className="grid gap-2 md:grid-cols-4">{primary}</div>
      {secondary ? (
        <details className="task-maintenance-disclosure">
          <summary>More filters and support actions</summary>
          <div className="task-maintenance-body">{secondary}</div>
        </details>
      ) : null}
    </AppShellCard>
  );
}

export function SupportWorkspacePortfolioCard({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <AppShellCard className="space-y-3" surface="data">
      <SectionHeader title={title} subtitle={subtitle} compact />
      {children}
    </AppShellCard>
  );
}

export function SupportWorkspaceSelectedContextCard({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <AppShellCard className="space-y-4" surface="inspector">
      <SectionHeader title={title} subtitle={subtitle} compact />
      {children}
    </AppShellCard>
  );
}

export function SupportWorkspaceRouteActions({
  title = 'Route into execution',
  support,
  children,
}: PropsWithChildren<{ title?: string; support?: string }>) {
  return (
    <div className="space-y-2 rounded-2xl tonal-panel">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      {support ? <p className="text-xs text-slate-600">{support}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SupportWorkspaceRelatedList({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <div className="space-y-2 rounded-2xl tonal-panel">
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <p className="text-xs text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SupportWorkspaceMaintenanceTray({
  title = 'Maintenance',
  subtitle,
  children,
}: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <details className="task-maintenance-disclosure">
      <summary>{title}</summary>
      <div className="task-maintenance-body">
        {subtitle ? <p className="mb-2 text-xs text-slate-600">{subtitle}</p> : null}
        {children}
      </div>
    </details>
  );
}

export function ExecutionLaneToolbar({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <WorkspaceToolbarRow className={`execution-lane-toolbar ${className}`.trim()}>{children}</WorkspaceToolbarRow>;
}

export function ExecutionToolbarSurface({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`workspace-control-stack execution-toolbar-surface execution-toolbar-deck-surface ${className}`.trim()}>{children}</div>
  );
}

export function ExecutionFilterChip({
  label,
  onClear,
  quiet = false,
}: {
  label: string;
  onClear: () => void;
  quiet?: boolean;
}) {
  return (
    <button type="button" className={`execution-filter-chip control-chip control-chip-filter ${quiet ? 'execution-filter-chip-quiet' : ''}`.trim()} onClick={onClear} aria-label={`Remove filter ${label}`}>
      {label}
      <span aria-hidden>×</span>
    </button>
  );
}

export function ExecutionFilterChipRow({
  children,
  muted = false,
  className = '',
}: PropsWithChildren<{ muted?: boolean; className?: string }>) {
  return <div className={`execution-filter-chip-row ${muted ? 'execution-filter-chip-row-muted' : ''} ${className}`.trim()}>{children}</div>;
}

export function ExecutionLaneFeedbackStrip({
  message,
  tone = 'info',
}: {
  message: string;
  tone?: 'info' | 'success' | 'warn';
}) {
  return <div className={`execution-lane-feedback execution-lane-feedback-${tone}`.trim()} role="status">{message}</div>;
}

export function ExecutionMobileCardShell({
  children,
  active = false,
  className = '',
}: PropsWithChildren<{ active?: boolean; className?: string }>) {
  return <article className={`tracker-mobile-card execution-mobile-card-shell ${active ? 'tracker-mobile-card-active execution-mobile-card-shell-active' : ''} ${className}`.trim()}>{children}</article>;
}


export function ExecutionLaneToolbarScaffold({
  left,
  middle,
  right,
  className = '',
}: {
  left?: ReactNode;
  middle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <ExecutionLaneToolbar className={`execution-lane-toolbar-scaffold ${className}`.trim()}>
      <div className="execution-lane-toolbar-zone execution-lane-toolbar-zone-left">{left}</div>
      <div className="execution-lane-toolbar-zone execution-lane-toolbar-zone-middle">{middle}</div>
      <div className="execution-lane-toolbar-zone execution-lane-toolbar-zone-right">{right}</div>
    </ExecutionLaneToolbar>
  );
}

export function ExecutionLaneHandoffStrip({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div className="execution-lane-handoff-strip" role="status" aria-live="polite">
      <div className="execution-lane-handoff-title">{title}</div>
      <div className="execution-lane-handoff-summary">{summary}</div>
    </div>
  );
}

export function ExecutionLaneQueueCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <AppShellCard className={`workspace-list-panel execution-lane-queue-card ${className}`.trim()} surface="deckInset">
      {children}
    </AppShellCard>
  );
}

export function ExecutionLaneInspectorCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <AppShellCard className={`workspace-inspector-panel execution-lane-inspector-card ${className}`.trim()} surface="deckInset">
      {children}
    </AppShellCard>
  );
}

export function ExecutionLaneSelectionStrip({
  title,
  helper,
  badges,
  emptyMessage = 'Select an item to continue.',
}: {
  title?: string;
  helper?: string;
  badges?: ReactNode;
  emptyMessage?: string;
}) {
  if (!title) {
    return <div className="execution-lane-selection-strip"><div className="execution-lane-selection-empty">{emptyMessage}</div></div>;
  }
  return (
    <div className="execution-lane-selection-strip">
      <div>
        <div className="execution-lane-selection-kicker">Selected item</div>
        <div className="execution-lane-selection-title">{title}</div>
        {helper ? <div className="execution-lane-selection-helper">{helper}</div> : null}
      </div>
      {badges ? <div className="execution-lane-selection-badges">{badges}</div> : null}
    </div>
  );
}


export function WorkspaceInspectorSection({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <section className="workspace-inspector-section inspector-block inspector-block-quiet">
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
  return <span className={`app-badge control-chip control-chip-status app-badge-${tone}`}>{children}</span>;
}

export function AttentionPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'info' | 'warn' | 'success' | 'danger';
}) {
  return <AppBadge tone={tone}>{label}</AppBadge>;
}

export function WorkspaceHeaderMetaPill({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'info' | 'warn' }>) {
  return <div className={`workspace-meta-pill control-chip control-chip-metadata workspace-meta-pill-${tone}`}>{children}</div>;
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
  ariaLabel = 'Segmented control',
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; ariaLabel?: string }>;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`segmented-control control-segmented ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const active = value === option.value;
        const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : event.key === 'ArrowRight'
                ? (index + 1) % options.length
                : (index - 1 + options.length) % options.length;
          onChange(options[nextIndex].value);
          const sibling = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')?.[nextIndex];
          sibling?.focus();
        };

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            className={active ? 'segmented-control-btn control-segmented-btn segmented-control-btn-active control-segmented-btn-active' : 'segmented-control-btn control-segmented-btn'}
            role="tab"
            aria-selected={active}
            aria-label={option.ariaLabel}
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
  ariaLabel = 'Modal dialog',
}: PropsWithChildren<{ size?: 'compact' | 'standard' | 'wide' | 'inspector'; onBackdropClick?: () => void; onClose?: () => void; closeOnEscape?: boolean; ariaLabel?: string }>) {
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

  const modalBody = (
    <div className="modal-backdrop" onClick={onBackdropClick} role="presentation">
      <div
        className={`modal-panel app-shell-card app-shell-card-modal modal-panel-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <AppModalContentShell>{children}</AppModalContentShell>
      </div>
    </div>
  );

  return createPortal(modalBody, document.body);
}

export function AppModalContentShell({ children }: PropsWithChildren) {
  return <div className="modal-content-shell">{children}</div>;
}

export function AppModalHeader({ title, subtitle, onClose, closeLabel = 'Close' }: { title: string; subtitle?: string; onClose: () => void; closeLabel?: string }) {
  return (
    <div className="modal-header">
      <div>
        <div className="modal-title">{title}</div>
        {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
      </div>
      <button onClick={onClose} className="action-btn action-btn-quiet">{closeLabel}</button>
    </div>
  );
}

export function AppModalBody({
  children,
  scrollable = true,
  className = '',
}: PropsWithChildren<{ scrollable?: boolean; className?: string }>) {
  return <div className={`${scrollable ? 'modal-body modal-body-scroll' : 'modal-body modal-body-static'} ${className}`.trim()}>{children}</div>;
}

export function AppModalFooter({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`modal-footer ${className}`.trim()}>{children}</div>;
}

export function RecordEditorShell({ children }: PropsWithChildren) {
  return <div className="record-editor-shell">{children}</div>;
}

export function RecordEditorHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
        </div>
        {badge ? <div>{badge}</div> : null}
      </div>
    </div>
  );
}

export function RecordEditorSection({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function RecordEditorMetaGrid({ children }: PropsWithChildren) {
  return <div className="form-grid-two">{children}</div>;
}

export function RecordEditorFooter({ children }: PropsWithChildren) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

export function RecordContextDrawerShell({ children }: PropsWithChildren) {
  return <div className="record-drawer-body">{children}</div>;
}

export function RecordContextDrawerSection({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <section className="inspector-block">
      <div className="workspace-inspector-section-title">{title}</div>
      {children}
    </section>
  );
}

function toastToneIcon(tone: AppToast['tone']) {
  if (tone === 'success') return <CheckCircle2 size={16} />;
  if (tone === 'warning') return <AlertTriangle size={16} />;
  if (tone === 'error') return <CircleAlert size={16} />;
  return <Info size={16} />;
}

export function AppToastViewport({ children }: PropsWithChildren) {
  return <div className="app-toast-viewport" aria-live="polite" aria-relevant="additions text">{children}</div>;
}

export function AppToastStack({ children }: PropsWithChildren) {
  return <div className="app-toast-stack">{children}</div>;
}

export function AppToastCard({
  toast,
  onDismiss,
  onAction,
  onPause,
  onResume,
}: {
  toast: AppToast;
  onDismiss: () => void;
  onAction?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}) {
  return (
    <article
      className={`app-toast-card app-toast-card-${toast.tone}`}
      role={toast.tone === 'warning' || toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocusCapture={onPause}
      onBlurCapture={onResume}
    >
      <div className="app-toast-icon" aria-hidden="true">{toastToneIcon(toast.tone)}</div>
      <div className="app-toast-content">
        <div className="app-toast-title">{toast.title}</div>
        {toast.message ? <div className="app-toast-message">{toast.message}</div> : null}
        {toast.action ? <button type="button" className="app-toast-action" onClick={onAction}>{toast.action.label}</button> : null}
      </div>
      {toast.dismissible !== false ? <button type="button" className="app-toast-dismiss" onClick={onDismiss} aria-label="Dismiss notification"><X size={14} /></button> : null}
    </article>
  );
}
