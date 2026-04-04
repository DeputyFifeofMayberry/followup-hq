import type { IntakeFieldReview, IntakeFieldReviewStatus } from '../../lib/intakeEvidence';

const statusTone: Record<IntakeFieldReviewStatus, string> = {
  strong: 'intake-field-chip intake-field-chip-strong',
  medium: 'intake-field-chip intake-field-chip-medium',
  weak: 'intake-field-chip intake-field-chip-weak',
  missing: 'intake-field-chip intake-field-chip-missing',
  conflicting: 'intake-field-chip intake-field-chip-conflicting',
};

export function FieldConfidenceChip({ status }: { status: IntakeFieldReviewStatus }) {
  return <span className={statusTone[status]}>{status}</span>;
}

export function FieldReviewRow({ field, onEdit }: { field: IntakeFieldReview; onEdit?: () => void }) {
  const warn = field.status === 'weak' || field.status === 'missing' || field.status === 'conflicting';
  return (
    <div className={`intake-field-row ${warn ? 'intake-field-row-warn' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</div>
        <div className="flex items-center gap-2">
          <FieldConfidenceChip status={field.status} />
          {onEdit ? <button className="text-[11px] font-semibold text-sky-700" onClick={onEdit}>Resolve</button> : null}
        </div>
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{field.value || 'Missing'}</div>
      {field.evidenceSnippets.length ? (
        <div className="mt-1 space-y-1 text-xs text-slate-600">
          {field.evidenceSnippets.slice(0, 2).map((snippet) => <div key={snippet} className="rounded-md border border-slate-200 bg-white px-2 py-1">“{snippet}”</div>)}
        </div>
      ) : null}
      {field.reasons.length ? <div className="mt-1 text-[11px] text-slate-500">{field.reasons.slice(0, 2).join(' • ')}</div> : null}
    </div>
  );
}

export function WeakFieldWarningGroup({ fields }: { fields: IntakeFieldReview[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <div className="font-semibold">Needs reviewer attention</div>
      <div className="mt-1">{fields.map((field) => field.label).join(' • ')}</div>
    </div>
  );
}
