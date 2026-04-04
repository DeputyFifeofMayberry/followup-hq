import type { ReactNode } from 'react';

export function ActionRecordContext({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected follow-up</div>
      <div className="mt-1 font-semibold text-slate-900">{title}</div>
      <div className="text-xs text-slate-600">Current status: {status}</div>
    </div>
  );
}

function ActionMessagePanel({ tone, title, lines }: { tone: 'warn' | 'danger'; title: string; lines: string[] }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${toneClass}`}>
      <div className="font-semibold">{title}</div>
      {lines.map((line) => <div key={line}>{line}</div>)}
    </div>
  );
}

export function BlockerPanel({ blockers }: { blockers: string[] }) {
  if (!blockers.length) return null;
  return <ActionMessagePanel tone="danger" title="Blockers" lines={blockers} />;
}

export function WarningPanel({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <ActionMessagePanel tone="warn" title="Warnings" lines={warnings} />;
}

export function OverridePanel({
  enabled,
  onToggle,
  message,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  message?: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} className="mt-1" />
      <span>
        <span className="font-semibold">Allow override</span>
        <span className="mt-1 block text-xs">{message || 'I understand this action bypasses clean-close checks.'}</span>
      </span>
    </label>
  );
}

export function DateInputSection({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="field-input" />
    </label>
  );
}

export function NotesSection({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="field-textarea" placeholder={placeholder} />
    </label>
  );
}

export function InlineTextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="field-input" placeholder={placeholder} />
    </label>
  );
}

export function DestructiveConfirmation({
  expected,
  value,
  onChange,
  children,
}: {
  expected: string;
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <div className="font-semibold">This action cannot be undone.</div>
      <div className="mt-1 text-xs">Type <span className="font-bold">{expected}</span> to confirm deletion.</div>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="field-input mt-2" placeholder={expected} />
      {children}
    </div>
  );
}
