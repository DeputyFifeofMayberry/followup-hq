import type { ReactNode } from 'react';
import { AppShellCard } from '../ui/AppPrimitives';

interface StructuredActionFlowProps {
  open: boolean;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
  warnings?: string[];
  blockers?: string[];
  result?: { tone: 'success' | 'warn' | 'danger'; message: string } | null;
}

export function StructuredActionFlow({
  open,
  title,
  subtitle,
  confirmLabel = 'Apply',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled,
  children,
  warnings = [],
  blockers = [],
  result,
}: StructuredActionFlowProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <AppShellCard className="w-full max-w-xl space-y-3 p-4" surface="inspector">
        <div>
          <div className="text-base font-semibold text-slate-950">{title}</div>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {children}
        {blockers.length ? <ActionMessage tone="danger" title="Blockers" lines={blockers} /> : null}
        {warnings.length ? <ActionMessage tone="warn" title="Warnings" lines={warnings} /> : null}
        {result ? <ActionMessage tone={result.tone} title="Result" lines={[result.message]} /> : null}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="action-btn">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={confirmDisabled} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">{confirmLabel}</button>
        </div>
      </AppShellCard>
    </div>
  );
}

function ActionMessage({ tone, title, lines }: { tone: 'success' | 'warn' | 'danger'; title: string; lines: string[] }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <div className={`rounded-xl border p-2 text-xs ${toneClass}`}>
      <div className="font-semibold">{title}</div>
      {lines.map((line) => <div key={line}>{line}</div>)}
    </div>
  );
}

export function CompletionNoteSection({ value, onChange, label = 'Completion note' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="field-textarea" placeholder="Record what changed and why this is complete." />
    </label>
  );
}

export function BlockReasonSection({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-block">
      <span className="field-label">Block reason</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="field-textarea" placeholder="What is blocking this task and what should happen next?" />
    </label>
  );
}

export function DateSection({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="field-input" />
    </label>
  );
}

export function BatchSummarySection({ selected, affected, skipped, warnings = [] }: { selected: number; affected: number; skipped: number; warnings?: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
      <div><strong>{selected}</strong> selected</div>
      <div>Affected: {affected} • Skipped: {skipped}</div>
      {warnings.length ? <div className="mt-1 text-amber-800">Warnings: {warnings.join(' • ')}</div> : null}
    </div>
  );
}

export function OverrideConfirmationSection({ checked, onChange, message }: { checked: boolean; onChange: (value: boolean) => void; message: string }) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      <span><strong>Allow override</strong><br />{message}</span>
    </label>
  );
}
