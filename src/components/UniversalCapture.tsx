import { WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getRecentEntryContext } from '../lib/dataEntryDefaults';
import { parseUniversalCapture } from '../lib/universalCapture';
import { addDaysIso, createId, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { FollowUpItem, TaskItem } from '../types';

export function UniversalCapture({
  contextProject,
  contextOwner,
  contextFollowUpId,
}: {
  contextProject?: string;
  contextOwner?: string;
  contextFollowUpId?: string | null;
}) {
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

  const parsed = useMemo(() => {
    const base = parsedOverride ?? parseUniversalCapture(text);
    return {
      ...base,
      project: base.project || contextProject,
      owner: base.owner || contextOwner,
    };
  }, [parsedOverride, text, contextProject, contextOwner]);

  const canDirectSave = !!text.trim() && !!parsed.title.trim();
  const needsCleanup = parsed.cleanupReasons.length > 0;

  const findOrCreateProject = (name?: string): { id: string; name: string } => {
    const recentContext = getRecentEntryContext();
    const clean = (name || contextProject || recentContext.project || '').trim();
    if (!clean) return { id: '', name: '' };
    const existing = projects.find((project) => project.name.toLowerCase() === clean.toLowerCase() || project.id === clean);
    if (existing) return { id: existing.id, name: existing.name };
    const id = addProject({ name: clean, owner: parsed.owner || contextOwner || recentContext.owner || 'Unassigned', status: 'Active', notes: '', tags: [] });
    return { id, name: clean };
  };

  const findOrCreateOwner = (name?: string): { id?: string; name: string } => {
    const recentContext = getRecentEntryContext();
    const clean = (name || contextOwner || recentContext.owner || '').trim();
    if (!clean) return { name: '' };
    const existing = contacts.find((contact) => contact.name.toLowerCase() === clean.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };
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
        project: project.name || 'General',
        projectId: project.id || undefined,
        owner: owner.name || 'Unassigned',
        contactId: owner.id,
        status: 'To do',
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        summary: parsed.rawText,
        nextStep: parsed.nextStep || parsed.title,
        notes: '',
        tags: ['Capture bar'],
        linkedFollowUpId: contextFollowUpId || undefined,
        createdAt: todayIso(),
        updatedAt: todayIso(),
        needsCleanup,
        cleanupReasons: parsed.cleanupReasons,
        recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch',
      };
      addTask(task);
      if (openDetail) openEditTaskModal(task.id);
      setConfirmation(needsCleanup ? 'Saved to intake. Needs cleanup.' : 'Task saved.');
    } else {
      const followUp: FollowUpItem = {
        id: createId(),
        title: parsed.title,
        source: 'Notes',
        project: project.name || 'General',
        projectId: project.id || undefined,
        owner: owner.name || 'Unassigned',
        contactId: owner.id,
        status: parsed.status === 'Waiting on external' ? 'Waiting on external' : 'Needs action',
        priority: parsed.priority,
        dueDate: parsed.dueDate || addDaysIso(todayIso(), 1),
        lastTouchDate: todayIso(),
        nextTouchDate: parsed.dueDate || addDaysIso(todayIso(), 1),
        nextAction: parsed.nextAction || parsed.title,
        summary: parsed.rawText,
        tags: ['Capture bar'],
        sourceRef: `Capture bar ${todayIso()}`,
        sourceRefs: [],
        mergedItemIds: [],
        waitingOn: parsed.waitingOn,
        notes: '',
        timeline: [],
        category: 'Coordination',
        owesNextAction: 'Unknown',
        escalationLevel: 'None',
        cadenceDays: 3,
        needsCleanup,
        cleanupReasons: parsed.cleanupReasons,
        recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch',
      };
      addItem(followUp);
      if (openDetail) openEditModal(followUp.id);
      setConfirmation(needsCleanup ? 'Saved to intake. Needs cleanup.' : 'Follow-up saved.');
    }

    setText('');
    setParsedOverride(null);
  };

  const cleanupLabel: Record<string, string> = {
    missing_project: 'Missing project',
    missing_owner: 'Missing owner',
    missing_due_date: 'Missing due date',
    low_confidence_title: 'Low confidence title',
    unclear_type: 'Unclear type',
  };

  return (
    <section className="sticky top-2 z-20 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <WandSparkles className="h-4 w-4 text-slate-600" />
        <div className="text-sm font-semibold text-slate-900">Capture Bar</div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Natural language works here. Enter save · Cmd/Ctrl+Enter save+open · Esc clear.</p>
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
              saveDraft(true, true);
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              saveDraft(false, false);
            }
          }}
          placeholder="Waiting on Alex pricing for B995. Need follow-up by Friday."
          className="field-input"
        />
        <button onClick={() => saveDraft(false, false)} disabled={!canDirectSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">Save</button>
      </div>

      {text.trim() ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Instant preview</span>
            <span className={needsCleanup ? 'text-amber-700' : 'text-emerald-700'}>{needsCleanup ? 'Needs cleanup' : 'Ready'}</span>
          </div>
          <div className="grid gap-2 text-xs md:grid-cols-5">
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Type</div>
              <select className="mt-1 w-full bg-transparent text-slate-800 outline-none" value={parsed.kind} onChange={(event) => setParsedOverride({ ...parsed, kind: event.target.value as 'task' | 'followup' })}>
                <option value="followup">Follow-up</option>
                <option value="task">Task</option>
              </select>
            </label>
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Project</div>
              <input className="mt-1 w-full bg-transparent text-slate-800 outline-none" value={parsed.project || ''} onChange={(event) => setParsedOverride({ ...parsed, project: event.target.value })} placeholder="Unset" />
            </label>
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Owner</div>
              <input className="mt-1 w-full bg-transparent text-slate-800 outline-none" value={parsed.owner || ''} onChange={(event) => setParsedOverride({ ...parsed, owner: event.target.value })} placeholder="Unset" />
            </label>
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Due</div>
              <input type="date" className="mt-1 w-full bg-transparent text-slate-800 outline-none" value={parsed.dueDate?.slice(0, 10) || ''} onChange={(event) => setParsedOverride({ ...parsed, dueDate: event.target.value || undefined })} />
            </label>
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Priority</div>
              <select className="mt-1 w-full bg-transparent text-slate-800 outline-none" value={parsed.priority} onChange={(event) => setParsedOverride({ ...parsed, priority: event.target.value as FollowUpItem['priority'] })}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </label>
          </div>
          {needsCleanup ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-700">
              {parsed.cleanupReasons.map((reason) => <span key={reason} className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5">{cleanupLabel[reason]}</span>)}
            </div>
          ) : null}
          <button className="mt-2 text-xs font-medium text-sky-700" onClick={() => openCreateFromCapture(parsed)}>Open fast/full editor</button>
        </div>
      ) : null}

      {confirmation ? <div className="mt-2 text-xs font-medium text-emerald-700">{confirmation}</div> : null}
    </section>
  );
}
