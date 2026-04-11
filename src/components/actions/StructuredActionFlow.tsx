import type { ReactNode } from 'react';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, StatePanel } from '../ui/AppPrimitives';

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
  isMobileLike?: boolean;
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
  isMobileLike = false,
}: StructuredActionFlowProps) {
  if (!open) return null;

  return (
    <AppModal size={isMobileLike ? 'standard' : 'compact'} onClose={onCancel} onBackdropClick={onCancel}>
      <AppModalHeader title={title} subtitle={subtitle} onClose={onCancel} closeLabel={cancelLabel} />
      <AppModalBody>
        {children}
        {blockers.length ? <ActionMessage tone="danger" title="Blockers" lines={blockers} /> : null}
        {warnings.length ? <ActionMessage tone="warn" title="Warnings" lines={warnings} /> : null}
        {result ? <ActionMessage tone={result.tone} title="Result" lines={[result.message]} /> : null}
      </AppModalBody>
      <AppModalFooter>
        <button onClick={onCancel} className="action-btn">{cancelLabel}</button>
        <button onClick={onConfirm} disabled={confirmDisabled} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">{confirmLabel}</button>
      </AppModalFooter>
    </AppModal>
  );
}

function ActionMessage({ tone, title, lines }: { tone: 'success' | 'warn' | 'danger'; title: string; lines: string[] }) {
  return <StatePanel compact tone={tone === 'danger' ? 'error' : tone === 'warn' ? 'warning' : 'success'} title={title} message={lines.join(' • ')} />;
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
