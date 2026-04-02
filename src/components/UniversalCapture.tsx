import { WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseUniversalCapture } from '../lib/universalCapture';
import { addDaysIso, createId, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { FollowUpItem, TaskItem } from '../types';

export function UniversalCapture() {
  const {
    projects,
    contacts,
    addItem,
    addTask,
    openEditModal,
    openEditTaskModal,
    openCreateFromCapture,
    addProject,
    addContact,
  } = useAppStore(useShallow((s) => ({
    projects: s.projects,
    contacts: s.contacts,
    addItem: s.addItem,
    addTask: s.addTask,
    openEditModal: s.openEditModal,
    openEditTaskModal: s.openEditTaskModal,
    openCreateFromCapture: s.openCreateFromCapture,
    addProject: s.addProject,
    addContact: s.addContact,
  })));
  const [text, setText] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [parsedOverride, setParsedOverride] = useState<ReturnType<typeof parseUniversalCapture> | null>(null);

  const parsed = useMemo(() => parsedOverride ?? parseUniversalCapture(text), [parsedOverride, text]);
  const highConfidence = parsed.confidence >= 0.72;
  const canDirectSave = !!text.trim() && !!parsed.title.trim() && highConfidence;

  const findOrCreateProject = (name?: string): { id: string; name: string } => {
    const clean = (name || 'General').trim() || 'General';
    const existing = projects.find((project) => project.name.toLowerCase() === clean.toLowerCase() || project.id === clean);
    if (existing) return { id: existing.id, name: existing.name };
    const id = addProject({ name: clean, owner: parsed.owner || 'Unassigned', status: 'Active', notes: '', tags: [] });
    return { id, name: clean };
  };

  const findOrCreateOwner = (name?: string): { id?: string; name: string } => {
    const clean = (name || 'Unassigned').trim() || 'Unassigned';
    const existing = contacts.find((contact) => contact.name.toLowerCase() === clean.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };
    if (clean === 'Unassigned') return { name: clean };
    const id = addContact({ name: clean, role: 'PM', notes: '', tags: [] });
    return { id, name: clean };
  };

  const saveDraft = (openDetail = false, force = false) => {
    if (!text.trim()) return;
    if (!force && !canDirectSave) return;

    const project = findOrCreateProject(parsed.project);
    const owner = findOrCreateOwner(parsed.owner);

    if (parsed.kind === 'task') {
      const task: TaskItem = {
        id: createId('TSK'),
        title: parsed.title,
        project: project.name,
        projectId: project.id,
        owner: owner.name,
        contactId: owner.id,
        status: 'To do',
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        summary: parsed.rawText,
        nextStep: parsed.nextStep || parsed.title,
        notes: '',
        tags: ['Quick capture'],
        createdAt: todayIso(),
        updatedAt: todayIso(),
      };
      addTask(task);
      if (openDetail) openEditTaskModal(task.id);
      setConfirmation(openDetail ? 'Saved task and opened detail.' : 'Task saved.');
    } else {
      const followUp: FollowUpItem = {
        id: createId(),
        title: parsed.title,
        source: 'Notes',
        project: project.name,
        projectId: project.id,
        owner: owner.name,
        contactId: owner.id,
        status: parsed.status === 'Waiting on external' ? 'Waiting on external' : 'Needs action',
        priority: parsed.priority,
        dueDate: parsed.dueDate || addDaysIso(todayIso(), 2),
        lastTouchDate: todayIso(),
        nextTouchDate: parsed.dueDate || addDaysIso(todayIso(), 1),
        nextAction: parsed.nextAction || parsed.title,
        summary: parsed.rawText,
        tags: ['Quick capture'],
        sourceRef: `Quick capture ${todayIso()}`,
        sourceRefs: [],
        mergedItemIds: [],
        waitingOn: parsed.waitingOn,
        notes: '',
        timeline: [],
        category: 'Coordination',
        owesNextAction: 'Unknown',
        escalationLevel: 'None',
        cadenceDays: 3,
      };
      addItem(followUp);
      if (openDetail) openEditModal(followUp.id);
      setConfirmation(openDetail ? 'Saved follow-up and opened detail.' : 'Follow-up saved.');
    }

    setText('');
    setParsedOverride(null);
  };

  const chipClass = 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <WandSparkles className="h-4 w-4 text-slate-600" />
        <div className="text-sm font-semibold text-slate-900">Quick Add</div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Type once, preview, then Enter to save. Cmd/Ctrl+Enter forces save. Esc clears.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setParsedOverride(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setText('');
              setParsedOverride(null);
              setConfirmation('Capture cleared.');
              return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              saveDraft(false, true);
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              saveDraft(false, false);
            }
          }}
          placeholder="Waiting on Alex for B995 sprinkler pricing by Friday"
          className="field-input"
        />
        <button onClick={() => saveDraft(false, false)} disabled={!canDirectSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">Save silently</button>
        <button onClick={() => saveDraft(true, true)} disabled={!text.trim()} className="action-btn">Save + open detail</button>
      </div>

      {text.trim() ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Preview</span>
            <span className={highConfidence ? 'text-emerald-700' : 'text-amber-700'}>{highConfidence ? 'High confidence' : 'Needs review'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={chipClass} onClick={() => setParsedOverride({ ...parsed, kind: parsed.kind === 'followup' ? 'task' : 'followup' })}>{parsed.kind === 'followup' ? 'Follow-up' : 'Task'}</button>
            <input className={chipClass} value={parsed.title} onChange={(e) => setParsedOverride({ ...parsed, title: e.target.value })} />
            <input className={chipClass} value={parsed.owner ?? ''} onChange={(e) => setParsedOverride({ ...parsed, owner: e.target.value })} placeholder="Owner" />
            <input className={chipClass} value={parsed.project ?? ''} onChange={(e) => setParsedOverride({ ...parsed, project: e.target.value })} placeholder="Project" />
          </div>
          {!highConfidence ? (
            <div className="mt-2 text-xs text-amber-700">Tip: add owner/project/due wording for one-key save, or expand to full edit.</div>
          ) : null}
          <button className="mt-2 text-xs font-medium text-sky-700" onClick={() => openCreateFromCapture(parsed)}>Expand for full edit</button>
        </div>
      ) : null}

      {confirmation ? <div className="mt-2 text-xs font-medium text-emerald-700">{confirmation}</div> : null}
    </section>
  );
}
