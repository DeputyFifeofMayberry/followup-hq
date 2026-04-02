import { WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { parseUniversalCapture } from '../lib/universalCapture';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { buildItemFromForm, createId, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

export function UniversalCapture() {
  const { addItem, addTask, projectFilter, projects } = useAppStore(useShallow((s) => ({
    addItem: s.addItem,
    addTask: s.addTask,
    projectFilter: s.projectFilter,
    projects: s.projects,
  })));
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseUniversalCapture(''));
  const [confirmation, setConfirmation] = useState<string>('');

  const openReview = () => {
    if (!text.trim()) return;
    setDraft(parseUniversalCapture(text));
    setOpen(true);
  };

  const save = (entry: typeof draft) => {
    const projectRecord = entry.project ? projects.find((project) => project.name.toLowerCase() === entry.project?.toLowerCase() || project.id === entry.project) : undefined;
    if (entry.kind === 'followup') {
      const base = buildSmartFollowUpDefaults({ projectFilter, projectId: projectRecord?.id, projectName: projectRecord?.name ?? entry.project });
      const input = {
        ...base,
        title: entry.title,
        project: projectRecord?.name ?? entry.project ?? base.project,
        projectId: projectRecord?.id ?? base.projectId,
        owner: entry.owner || base.owner,
        status: (entry.status as typeof base.status) || base.status,
        priority: entry.priority,
        dueDate: entry.dueDate || base.dueDate,
        nextTouchDate: entry.dueDate || base.nextTouchDate,
        waitingOn: entry.waitingOn || base.waitingOn,
        nextAction: entry.nextAction || base.nextAction,
        summary: entry.rawText,
      };
      rememberFollowUpDefaults(input);
      addItem(buildItemFromForm(input));
      setConfirmation(`Saved follow-up: ${input.title}`);
    } else {
      const base = buildSmartTaskDefaults({ projectFilter, projectId: projectRecord?.id, projectName: projectRecord?.name ?? entry.project });
      const task = {
        ...base,
        id: createId('TSK'),
        title: entry.title,
        project: projectRecord?.name ?? entry.project ?? base.project,
        projectId: projectRecord?.id ?? base.projectId,
        owner: entry.owner || base.owner,
        status: (entry.status as typeof base.status) || base.status,
        priority: entry.priority,
        dueDate: entry.dueDate || base.dueDate,
        nextStep: entry.nextStep || entry.title,
        summary: entry.rawText,
        createdAt: todayIso(),
        updatedAt: todayIso(),
      };
      rememberTaskDefaults(task);
      addTask(task);
      setConfirmation(`Saved task: ${task.title}`);
    }
    setOpen(false);
    setText('');
  };

  const canQuickSave = useMemo(() => {
    const parsed = parseUniversalCapture(text);
    return !!text.trim() && parsed.title.trim().length >= 3 && parsed.confidence >= 0.55;
  }, [text]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <WandSparkles className="h-4 w-4 text-slate-600" />
        <div className="text-sm font-semibold text-slate-900">Quick Capture</div>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type: Follow up with Alex on B995 sprinkler pricing Friday"
          className="field-input"
        />
        <button onClick={() => save(parseUniversalCapture(text))} disabled={!canQuickSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">Quick save</button>
        <button onClick={openReview} className="action-btn">Review details</button>
      </div>
      {confirmation ? <div className="mt-2 text-xs font-medium text-emerald-700">{confirmation}</div> : null}

      {open ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <div className="text-lg font-semibold text-slate-950">Review capture draft</div>
                <div className="mt-1 text-sm text-slate-500">Confirm or tweak before saving.</div>
              </div>
              <button onClick={() => setOpen(false)} className="action-btn">Close</button>
            </div>
            <div className="form-grid-two">
              <label className="field-block"><span className="field-label">Type</span>
                <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as 'followup' | 'task' })} className="field-input"><option value="followup">Follow-up</option><option value="task">Task</option></select>
              </label>
              <label className="field-block"><span className="field-label">Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-input" /></label>
              <label className="field-block"><span className="field-label">Project</span><input value={draft.project ?? ''} onChange={(event) => setDraft({ ...draft, project: event.target.value })} className="field-input" /></label>
              <label className="field-block"><span className="field-label">Owner</span><input value={draft.owner ?? ''} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} className="field-input" /></label>
              <label className="field-block"><span className="field-label">Priority</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as typeof draft.priority })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
              <label className="field-block"><span className="field-label">Due date</span><input type="date" value={draft.dueDate ? new Date(draft.dueDate).toISOString().slice(0,10) : ''} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : undefined })} className="field-input" /></label>
              {draft.kind === 'followup' ? <label className="field-block field-block-span-2"><span className="field-label">Waiting on / Next action</span><input value={draft.waitingOn ?? draft.nextAction ?? ''} onChange={(event) => setDraft({ ...draft, waitingOn: event.target.value, nextAction: event.target.value })} className="field-input" /></label> : null}
              {draft.kind === 'task' ? <label className="field-block field-block-span-2"><span className="field-label">Next step</span><input value={draft.nextStep ?? ''} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} className="field-input" /></label> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="action-btn">Cancel</button>
              <button onClick={() => save(draft)} className="primary-btn">Save {draft.kind === 'followup' ? 'follow-up' : 'task'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
