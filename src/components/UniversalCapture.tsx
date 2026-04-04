import { AlertTriangle, CheckCircle2, ChevronDown, Inbox, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getRecentEntryContext } from '../lib/dataEntryDefaults';
import { parseUniversalCapture } from '../lib/universalCapture';
import { addDaysIso, createId, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { FollowUpItem, IntakeCandidate, TaskItem } from '../types';

export function UniversalCapture({ contextProject, contextOwner, contextFollowUpId }: { contextProject?: string; contextOwner?: string; contextFollowUpId?: string | null; }) {
  const { projects, contacts, addItem, addTask, openEditModal, openEditTaskModal, openCreateFromCapture, addProject, addContact, stageIntakeCandidate, intakeCandidates, approveIntakeCandidate, discardIntakeCandidate, saveIntakeCandidateAsReference } = useAppStore(useShallow((s) => ({
    projects: s.projects,
    contacts: s.contacts,
    addItem: s.addItem,
    addTask: s.addTask,
    openEditModal: s.openEditModal,
    openEditTaskModal: s.openEditTaskModal,
    openCreateFromCapture: s.openCreateFromCapture,
    addProject: s.addProject,
    addContact: s.addContact,
    stageIntakeCandidate: s.stageIntakeCandidate,
    intakeCandidates: s.intakeCandidates,
    approveIntakeCandidate: s.approveIntakeCandidate,
    discardIntakeCandidate: s.discardIntakeCandidate,
    saveIntakeCandidateAsReference: s.saveIntakeCandidateAsReference,
  })));
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [parsedOverride, setParsedOverride] = useState<ReturnType<typeof parseUniversalCapture> | null>(null);
  const [expanded, setExpanded] = useState(false);


  useEffect(() => {
    const onOpenQuickAdd = (event: Event) => {
      const customEvent = event as CustomEvent<{ focus?: boolean; expand?: boolean }>;
      if (customEvent.detail?.expand) {
        setExpanded(true);
      }
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    };
    window.addEventListener('followuphq:open-quick-add', onOpenQuickAdd as EventListener);
    return () => window.removeEventListener('followuphq:open-quick-add', onOpenQuickAdd as EventListener);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const parsed = useMemo(() => {
    const base = parsedOverride ?? parseUniversalCapture(text);
    return { ...base, project: base.project || contextProject, owner: base.owner || contextOwner };
  }, [parsedOverride, text, contextProject, contextOwner]);

  const confidence = parsed.confidence >= 0.82 && parsed.cleanupReasons.length === 0 ? 'high' : parsed.confidence >= 0.6 ? 'medium' : 'low';
  const canDirectSave = !!text.trim() && !!parsed.title.trim();
  const needsCleanup = parsed.cleanupReasons.length > 0;
  const parseReasons = [
    parsed.project ? `Detected project: ${parsed.project}` : 'Project not confidently detected',
    parsed.owner ? `Detected owner: ${parsed.owner}` : 'Owner missing',
    parsed.dueDate ? `Detected due date: ${new Date(parsed.dueDate).toLocaleDateString()}` : 'Due date missing',
    `Detected type: ${parsed.kind}`,
  ];

  const findProject = (name?: string): { id: string; name: string } => {
    const recentContext = getRecentEntryContext();
    const clean = (name || contextProject || recentContext.project || '').trim();
    if (!clean) return { id: '', name: '' };
    const existing = projects.find((project) => project.name.toLowerCase() === clean.toLowerCase() || project.id === clean);
    if (existing) return { id: existing.id, name: existing.name };
    return { id: '', name: clean };
  };

  const findOwner = (name?: string): { id?: string; name: string } => {
    const recentContext = getRecentEntryContext();
    const clean = (name || contextOwner || recentContext.owner || '').trim();
    if (!clean) return { name: '' };
    const existing = contacts.find((contact) => contact.name.toLowerCase() === clean.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };
    return { name: clean };
  };

  const saveDraft = (openDetail = false) => {
    if (!text.trim() || !canDirectSave) return;

    if (confidence !== 'high') {
      const candidate: IntakeCandidate = {
        id: createId('INT'),
        rawText: parsed.rawText,
        createdAt: todayIso(),
        suggestedType: parsed.kind,
        confidenceTier: confidence,
        confidenceScore: parsed.confidence,
        parseReasons,
        missingFields: parsed.cleanupReasons,
        detectedProject: parsed.project,
        detectedOwner: parsed.owner,
        detectedDueDate: parsed.dueDate,
        waitingOn: parsed.waitingOn,
        priority: parsed.priority,
        draft: {
          title: parsed.title,
          summary: parsed.rawText,
          nextAction: parsed.nextAction,
          nextStep: parsed.nextStep,
          status: parsed.status,
        },
      };
      stageIntakeCandidate(candidate);
      setConfirmation('Capture routed to intake review tray.');
      setText('');
      setParsedOverride(null);
      return;
    }

    const project = findProject(parsed.project);
    const owner = findOwner(parsed.owner);
    const shouldCreateProject = !!project.name && !project.id;
    const shouldCreateOwner = !!owner.name && !owner.id;

    const projectId = shouldCreateProject ? addProject({ name: project.name, owner: parsed.owner || contextOwner || 'Unassigned', status: 'Active', notes: '', tags: [] }) : project.id;
    const ownerId = shouldCreateOwner ? addContact({ name: owner.name, role: 'PM', notes: '', tags: [] }) : owner.id;

    if (parsed.kind === 'task') {
      const task: TaskItem = { id: createId('TSK'), title: parsed.title, project: project.name || 'General', projectId: projectId || undefined, owner: owner.name || 'Unassigned', contactId: ownerId, status: 'To do', priority: parsed.priority, dueDate: parsed.dueDate, summary: parsed.rawText, nextStep: parsed.nextStep || parsed.title, notes: '', tags: ['Capture bar'], linkedFollowUpId: contextFollowUpId || undefined, createdAt: todayIso(), updatedAt: todayIso(), needsCleanup, cleanupReasons: parsed.cleanupReasons, recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch' };
      addTask(task);
      if (openDetail) openEditTaskModal(task.id);
      setConfirmation('Task saved (high confidence).');
    } else {
      const followUp: FollowUpItem = { id: createId(), title: parsed.title, source: 'Notes', project: project.name || 'General', projectId: projectId || undefined, owner: owner.name || 'Unassigned', contactId: ownerId, status: parsed.status === 'Waiting on external' ? 'Waiting on external' : 'Needs action', priority: parsed.priority, dueDate: parsed.dueDate || addDaysIso(todayIso(), 1), lastTouchDate: todayIso(), nextTouchDate: parsed.dueDate || addDaysIso(todayIso(), 1), nextAction: parsed.nextAction || parsed.title, summary: parsed.rawText, tags: ['Capture bar'], sourceRef: `Capture bar ${todayIso()}`, sourceRefs: [], mergedItemIds: [], waitingOn: parsed.waitingOn, notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3, needsCleanup, cleanupReasons: parsed.cleanupReasons, recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch', actionState: 'Draft created' };
      addItem(followUp);
      if (openDetail) openEditModal(followUp.id);
      setConfirmation('Follow-up saved (high confidence).');
    }

    setText('');
    setParsedOverride(null);
  };

  const cleanupLabel: Record<string, string> = { missing_project: 'Missing project', missing_owner: 'Missing owner', missing_due_date: 'Missing due date', low_confidence_title: 'Low confidence title', unclear_type: 'Unclear type' };

  return (
    <section className="smart-composer-shell smart-composer-shell-lite">
      <div className="smart-composer-head">
        <div className="flex flex-wrap items-center gap-2">
          <WandSparkles className="h-4 w-4 text-slate-600" />
          <div className="text-sm font-semibold text-slate-900">Quick Add</div>
          <span className="smart-composer-kbd">⌘/Ctrl+J expand</span>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="action-btn !px-2.5 !py-1.5 text-xs">Capture details <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} /></button>
      </div>

      <p className="mt-1 text-xs text-slate-600">Capture work fast. Quick Add creates a follow-up or task when confidence is high, and sends uncertain items to review.</p>

      <div className="mt-2 flex gap-2">
        <input ref={inputRef} value={text} onChange={(event) => { setText(event.target.value); setParsedOverride(null); }} onKeyDown={(event) => {
          if (event.key === 'Escape') { setText(''); setParsedOverride(null); setConfirmation('Capture cleared.'); return; }
          if (event.key === 'Enter') { event.preventDefault(); saveDraft(false); }
        }} placeholder={`Capture a follow-up or task${contextProject ? ` for ${contextProject}` : ''}`} className="field-input smart-composer-input" />
        <button onClick={() => saveDraft(false)} disabled={!canDirectSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">{confidence === 'high' ? 'Add now' : 'Send to review'}</button>
      </div>

      {expanded && text.trim() ? (
        <div className="mt-3 form-section">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" />Parse preview</span>
            <span className={`confidence-chip ${confidence === 'high' ? 'confidence-chip-high' : confidence === 'medium' ? 'confidence-chip-medium' : 'confidence-chip-low'}`}>{confidence} confidence</span>
          </div>
          <div className="grid gap-2 text-xs md:grid-cols-2">
            {parseReasons.map((reason) => <div key={reason} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">{reason}</div>)}
          </div>
          {needsCleanup ? <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-700">{parsed.cleanupReasons.map((reason) => <span key={reason} className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5">{cleanupLabel[reason]}</span>)}</div> : null}
          <div className="mt-2 flex gap-2"><button onClick={() => saveDraft(true)} disabled={!text.trim()} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">{confidence === 'high' ? 'Add now + open' : 'Send to review + open later'}</button><button className="text-xs font-medium text-sky-700" onClick={() => openCreateFromCapture(parsed)}>Open structured form</button></div>
        </div>
      ) : null}

      {intakeCandidates.length > 0 ? (
        <div className="mt-3 form-section">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><Inbox className="h-4 w-4" />Quick Add review tray ({intakeCandidates.length})</div>
          <p className="mb-2 text-xs text-slate-600">Lower-confidence captures wait here until you approve, convert, or save as reference.</p>
          <div className="space-y-2">
            {intakeCandidates.slice(0, 4).map((candidate) => (
              <div key={candidate.id} className="rounded-xl border border-slate-200 bg-white p-2 text-xs">
                <div className="font-semibold text-slate-900">{candidate.draft.title}</div>
                <div className="text-slate-500">{candidate.suggestedType} • {candidate.confidenceTier} confidence • {candidate.detectedProject || 'No project'}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => approveIntakeCandidate(candidate.id)} className="action-btn !px-2 !py-1">Approve</button>
                  <button onClick={() => approveIntakeCandidate(candidate.id, candidate.suggestedType === 'task' ? 'followup' : 'task')} className="action-btn !px-2 !py-1">Convert</button>
                  <button onClick={() => saveIntakeCandidateAsReference(candidate.id)} className="action-btn !px-2 !py-1">Reference</button>
                  <button onClick={() => discardIntakeCandidate(candidate.id)} className="action-btn !px-2 !py-1 text-rose-600">Discard</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {confirmation ? <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-medium ${confidence === 'low' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{confidence === 'low' ? <AlertTriangle className="mr-1 inline h-4 w-4" /> : <CheckCircle2 className="mr-1 inline h-4 w-4" />}{confirmation}</div> : null}
    </section>
  );
}
