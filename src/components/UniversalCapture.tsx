import { WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseUniversalCapture } from '../lib/universalCapture';
import { useAppStore } from '../store/useAppStore';

export function UniversalCapture() {
  const openCreateFromCapture = useAppStore((s) => s.openCreateFromCapture);
  const [text, setText] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [parsedOverride, setParsedOverride] = useState<ReturnType<typeof parseUniversalCapture> | null>(null);

  const parsed = useMemo(() => parsedOverride ?? parseUniversalCapture(text), [parsedOverride, text]);

  const chipClass = 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <WandSparkles className="h-4 w-4 text-slate-600" />
        <div className="text-sm font-semibold text-slate-900">Quick Capture (assist)</div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Parse a rough note, review the chips, then open Create Work with structured fields prefilled.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setParsedOverride(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && text.trim()) {
              event.preventDefault();
              openCreateFromCapture(parsed);
              setConfirmation('Draft sent to Create Work.');
            }
          }}
          placeholder="Follow up with Alex on B995 sprinkler pricing Friday"
          className="field-input"
        />
        <button
          onClick={() => {
            if (!text.trim()) return;
            openCreateFromCapture(parsed);
            setConfirmation('Draft sent to Create Work.');
          }}
          disabled={!text.trim()}
          className="primary-btn disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fill Create Work
        </button>
      </div>

      {text.trim() ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Parsed fields</div>
          <div className="flex flex-wrap gap-2">
            <button className={chipClass} onClick={() => setParsedOverride({ ...parsed, kind: parsed.kind === 'followup' ? 'task' : 'followup' })}>{parsed.kind === 'followup' ? 'Follow-up' : 'Task'}</button>
            <input className={chipClass} value={parsed.title} onChange={(e) => setParsedOverride({ ...parsed, title: e.target.value })} />
            <input className={chipClass} value={parsed.owner ?? ''} onChange={(e) => setParsedOverride({ ...parsed, owner: e.target.value })} placeholder="Owner" />
            <input className={chipClass} value={parsed.project ?? ''} onChange={(e) => setParsedOverride({ ...parsed, project: e.target.value })} placeholder="Project" />
            <input className={chipClass} type="date" value={parsed.dueDate ? new Date(parsed.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => setParsedOverride({ ...parsed, dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })} />
            <input className={chipClass} value={parsed.kind === 'followup' ? (parsed.nextAction ?? parsed.waitingOn ?? '') : (parsed.nextStep ?? '')} onChange={(e) => setParsedOverride(parsed.kind === 'followup' ? { ...parsed, nextAction: e.target.value, waitingOn: e.target.value } : { ...parsed, nextStep: e.target.value })} placeholder={parsed.kind === 'followup' ? 'Next action' : 'Next step'} />
          </div>
        </div>
      ) : null}

      {confirmation ? <div className="mt-2 text-xs font-medium text-emerald-700">{confirmation}</div> : null}
    </section>
  );
}
