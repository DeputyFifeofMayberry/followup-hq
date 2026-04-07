import { AlertTriangle, CheckCircle2, ChevronDown, Inbox, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getRecentEntryContext } from '../lib/dataEntryDefaults';
import { getIntakeDecisionLabel, getIntakeLifecycleLabel } from '../lib/intakeLifecycle';
import { parseUniversalCapture } from '../lib/universalCapture';
import { addDaysIso, createId, todayIso } from '../lib/utils';
import { buildCaptureFieldReviews, summarizeFieldReviews } from '../lib/intakeEvidence';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { FollowUpItem, IntakeCandidate, TaskItem } from '../types';
import { Badge } from './Badge';
import { FieldConfidenceChip } from './intake/FieldReview';
import { buildIntakeTuningModel } from '../lib/intakeTuningModel';

export function UniversalCapture({ contextProject, contextOwner, contextFollowUpId, selfIdentity }: { contextProject?: string; contextOwner?: string; contextFollowUpId?: string | null; selfIdentity?: string; }) {
  const { projects, contacts, addItem, addTask, openEditModal, openEditTaskModal, openCreateFromCapture, addProject, addContact, stageIntakeCandidate, intakeCandidates, intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, intakeReviewerFeedback, approveIntakeCandidate, discardIntakeCandidate, saveIntakeCandidateAsReference } = useAppStore(useShallow((s) => ({
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
    intakeWorkCandidates: s.intakeWorkCandidates,
    forwardedCandidates: s.forwardedCandidates,
    forwardedRules: s.forwardedRules,
    forwardedRoutingAudit: s.forwardedRoutingAudit,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
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
    const recentContext = getRecentEntryContext();
    const base = parsedOverride ?? parseUniversalCapture(text, {
      knownProjects: projects,
      knownOwners: contacts,
      contextProject,
      contextOwner,
      recentProject: recentContext.project,
      recentOwner: recentContext.owner,
      defaultOwner: selfIdentity,
    });
    return { ...base, project: base.project || contextProject, owner: base.owner || contextOwner };
  }, [parsedOverride, text, projects, contacts, contextProject, contextOwner, selfIdentity]);


  const tuningModel = useMemo(() => buildIntakeTuningModel({
    intakeWorkCandidates,
    forwardedCandidates,
    forwardedRules,
    forwardedRoutingAudit,
    feedback: intakeReviewerFeedback,
  }), [intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, intakeReviewerFeedback]);

  const fieldEvidence = parsed.fieldEvidence;
  const quickCaptureReadiness = tuningModel.directImportReadiness.find((entry) => entry.source === 'quick_capture');
  const tuningReadyFloor = tuningModel.thresholds.minimumReadyConfidence;
  const tuningDueDateGuard = tuningModel.thresholds.requireStrongDueDateEvidence && !['explicit', 'matched'].includes(fieldEvidence?.dueDate.status ?? 'missing');
  const tuningProjectGuard = tuningModel.thresholds.requireStrongProjectEvidence && !['explicit', 'matched', 'contextual'].includes(fieldEvidence?.project.status ?? 'missing');
  const tuningReviewPressure = quickCaptureReadiness?.readiness === 'review_first';

  const parserNotes = parsed.parserNotes ?? [];
  const kindEvidence = fieldEvidence?.kind ?? { field: 'kind', value: parsed.kind, status: 'weak', confidence: 0.5, source: 'inferred', reasons: ['Field evidence unavailable.'] };
  const titleEvidence = fieldEvidence?.title ?? { field: 'title', value: parsed.title, status: 'weak', confidence: 0.5, source: 'inferred', reasons: ['Field evidence unavailable.'] };
  const hasCriticalConflict = fieldEvidence ? Object.values(fieldEvidence).some((field) => field.status === 'conflicting') : false;
  const completenessMissing = [!parsed.project, !parsed.owner, !parsed.dueDate].filter(Boolean).length;
  const criticalMissing = !parsed.title || !parsed.kind;
  const understandingConfidence = parsed.confidence >= 0.78
    ? 'high'
    : parsed.confidence >= 0.56
      ? 'medium'
      : 'low';
  const canDirectImport = parsed.confidence >= Math.max(0.8, tuningReadyFloor)
    && titleEvidence.confidence >= 0.72
    && kindEvidence.confidence >= 0.7
    && !hasCriticalConflict
    && !criticalMissing
    && completenessMissing === 0
    && !tuningReviewPressure
    && !tuningDueDateGuard
    && !tuningProjectGuard;
  const importReadiness = canDirectImport
    ? 'ready'
    : hasCriticalConflict || understandingConfidence === 'low'
      ? 'review_first'
      : 'needs_context';
  const canDirectSave = !!text.trim() && !!parsed.title.trim();
  const needsCleanup = parsed.cleanupReasons.length > 0;
  const parseReasons = [
    `Type: ${parsed.kind} (${fieldEvidence?.kind.status ?? 'weak'})`,
    parsed.project ? `Project: ${parsed.project} (${fieldEvidence?.project.status ?? 'missing'})` : 'Project: missing',
    parsed.owner ? `Owner: ${parsed.owner} (${fieldEvidence?.owner.status ?? 'missing'})` : 'Owner: missing',
    parsed.dueDate ? `Due date: ${new Date(parsed.dueDate).toLocaleDateString()} (${fieldEvidence?.dueDate.status ?? 'missing'})` : 'Due date: missing',
    ...parserNotes.slice(0, 3),
  ];
  const fieldReviewSummary = useMemo(() => summarizeFieldReviews(buildCaptureFieldReviews({
    kind: parsed.kind,
    title: parsed.title,
    rawText: parsed.rawText,
    project: parsed.project,
    owner: parsed.owner,
    dueDate: parsed.dueDate,
    priority: parsed.priority,
    waitingOn: parsed.waitingOn,
    nextAction: parsed.nextAction,
    nextStep: parsed.nextStep,
    confidence: parsed.confidence,
    cleanupReasons: parsed.cleanupReasons,
    fieldEvidence: fieldEvidence ?? undefined,
  })), [fieldEvidence, parsed]);

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

    if (!canDirectImport) {
      const candidate: IntakeCandidate = {
        id: createId('INT'),
        rawText: parsed.rawText,
        createdAt: todayIso(),
        suggestedType: parsed.kind,
        confidenceTier: understandingConfidence,
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
      setConfirmation(importReadiness === 'review_first'
        ? 'Capture sent to Review because parser confidence needs verification.'
        : 'Capture sent to Review because context is incomplete (project, owner, or due date).');
      setText('');
      setParsedOverride(null);
      return;
    }

    const project = findProject(parsed.project);
    const owner = findOwner(parsed.owner);
    const shouldCreateProject = !!project.name && !project.id;
    const shouldCreateOwner = !!owner.name && !owner.id;

    const projectId = shouldCreateProject ? addProject({ name: project.name, owner: parsed.owner || contextOwner || '', status: 'Active', notes: '', tags: [] }) : project.id;
    const ownerId = shouldCreateOwner ? addContact({ name: owner.name, role: 'PM', notes: '', tags: [] }) : owner.id;

    if (parsed.kind === 'task') {
      const task: TaskItem = { id: createId('TSK'), title: parsed.title, project: project.name || '', projectId: projectId || undefined, owner: owner.name || '', contactId: ownerId, status: 'To do', priority: parsed.priority, dueDate: parsed.dueDate, summary: parsed.rawText, nextStep: parsed.nextStep || parsed.title, notes: '', tags: ['Capture bar'], linkedFollowUpId: contextFollowUpId || undefined, createdAt: todayIso(), updatedAt: todayIso(), needsCleanup, cleanupReasons: parsed.cleanupReasons, recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch', provenance: { sourceType: 'quick_capture', sourceRef: `Capture bar ${todayIso()}`, capturedAt: todayIso() } };
      addTask(task);
      if (openDetail) openEditTaskModal(task.id);
      setConfirmation('Imported now: task approved from Quick Add.');
    } else {
      const followUp: FollowUpItem = { id: createId(), title: parsed.title, source: 'Notes', project: project.name || '', projectId: projectId || undefined, owner: owner.name || '', contactId: ownerId, status: parsed.status === 'Waiting on external' ? 'Waiting on external' : 'Needs action', priority: parsed.priority, dueDate: parsed.dueDate || addDaysIso(todayIso(), 1), lastTouchDate: todayIso(), nextTouchDate: parsed.dueDate || addDaysIso(todayIso(), 1), nextAction: parsed.nextAction || parsed.title, summary: parsed.rawText, tags: ['Capture bar'], sourceRef: `Capture bar ${todayIso()}`, sourceRefs: [], mergedItemIds: [], waitingOn: parsed.waitingOn, notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3, needsCleanup, cleanupReasons: parsed.cleanupReasons, recommendedAction: needsCleanup ? 'Review cleanup' : 'Log touch', actionState: 'Draft created', provenance: { sourceType: 'quick_capture', sourceRef: `Capture bar ${todayIso()}`, capturedAt: todayIso() } };
      addItem(followUp);
      if (openDetail) openEditModal(followUp.id);
      setConfirmation('Imported now: follow-up approved from Quick Add.');
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

      <p className="mt-1 text-xs text-slate-600">Quick Add separates parser understanding from import readiness so “understood but incomplete” routes to context review, not parser-failure warnings.</p>

      <div className="mt-2 flex gap-2">
        <input ref={inputRef} value={text} onChange={(event) => { setText(event.target.value); setParsedOverride(null); }} onKeyDown={(event) => {
          if (event.key === 'Escape') { setText(''); setParsedOverride(null); setConfirmation('Capture cleared.'); return; }
          if (event.key === 'Enter') { event.preventDefault(); saveDraft(false); }
        }} placeholder={`Capture a follow-up or task${contextProject ? ` for ${contextProject}` : ''}`} className="field-input smart-composer-input" />
        <button onClick={() => saveDraft(false)} disabled={!canDirectSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">{importReadiness === 'ready' ? 'Import now' : 'Send to review'}</button>
      </div>

      {expanded && text.trim() ? (
        <div className="mt-3 form-section">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" />Quick Add decision</span>
            <span className={`confidence-chip ${understandingConfidence === 'high' ? 'confidence-chip-high' : understandingConfidence === 'medium' ? 'confidence-chip-medium' : 'confidence-chip-low'}`}>Understanding: {understandingConfidence}</span>
          </div>
          <div className={`mb-2 rounded-xl border px-3 py-2 text-xs ${canDirectImport ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {importReadiness === 'ready' ? 'Import readiness: Ready.' : importReadiness === 'needs_context' ? 'Import readiness: Needs context (parser understood intent, but fields are incomplete).' : 'Import readiness: Review-first (parser ambiguity/conflicts detected).'}
          </div>

          <div className="mb-2 grid gap-2 md:grid-cols-2">
            <button onClick={() => saveDraft(false)} disabled={!text.trim()} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">{importReadiness === 'ready' ? 'Import now' : 'Send to review'}</button>
            <button className="action-btn" onClick={() => openCreateFromCapture(parsed)}>Open full create editor</button>
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold">Quick confidence summary</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {parseReasons.slice(0, 4).map((reason) => <div key={reason} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{reason}</div>)}
            </div>
          </details>

          <details className="mt-2 rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold">Trust & parser evidence</summary>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="font-semibold">Trust posture: {tuningModel.trustPosture} • automation: {tuningModel.automationHealth}</div>
              <div className="mt-1">{quickCaptureReadiness?.reason || 'Using baseline readiness policy for Quick Add.'}</div>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {fieldReviewSummary.priorityReviewFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                  <span className="text-slate-700">{field.label}: <span className="font-medium text-slate-900">{field.value || 'Missing'}</span></span>
                  <FieldConfidenceChip status={field.status} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['project', 'owner', 'dueDate', 'kind'] as const).map((key) => (
                <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">{key}: {fieldEvidence?.[key]?.status ?? 'missing'}</span>
              ))}
            </div>
          </details>

          {needsCleanup ? <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-700">{parsed.cleanupReasons.map((reason) => <span key={reason} className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5">{cleanupLabel[reason]}</span>)}</div> : null}
        </div>
      ) : null}

      {intakeCandidates.length > 0 ? (
        <div className="mt-3 form-section">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><Inbox className="h-4 w-4" />Intake Review queue ({intakeCandidates.length})</div>
          <p className="mb-2 text-xs text-slate-600">These candidates are in {getIntakeLifecycleLabel('review_needed')}. Quick Add shows only the next few; use the Intake workspace for queue health, correction hotspots, and batch-safe review.</p>
          <div className="mb-2"><button className="action-btn !px-2 !py-1" onClick={() => window.dispatchEvent(new CustomEvent('followuphq:open-intake-workspace'))}>Open intake review workspace</button></div>
          <div className="space-y-2">
            {intakeCandidates.slice(0, 3).map((candidate) => (
              <div key={candidate.id} className="rounded-xl border border-slate-200 bg-white p-2 text-xs">
                <div className="font-semibold text-slate-900">{candidate.draft.title}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-slate-500">
                  <Badge variant="warn">{getIntakeLifecycleLabel('review_needed')}</Badge>
                  <span>{candidate.suggestedType} • {candidate.confidenceTier} confidence • {candidate.detectedProject || 'No project'}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => approveIntakeCandidate(candidate.id)} className="action-btn !px-2 !py-1">{candidate.suggestedType === 'task' ? getIntakeDecisionLabel('approve_task') : getIntakeDecisionLabel('approve_followup')}</button>
                  <button onClick={() => approveIntakeCandidate(candidate.id, candidate.suggestedType === 'task' ? 'followup' : 'task')} className="action-btn !px-2 !py-1">{candidate.suggestedType === 'task' ? getIntakeDecisionLabel('approve_followup') : getIntakeDecisionLabel('approve_task')}</button>
                  <button onClick={() => saveIntakeCandidateAsReference(candidate.id)} className="action-btn !px-2 !py-1">{getIntakeDecisionLabel('save_reference')}</button>
                  <button onClick={() => discardIntakeCandidate(candidate.id)} className="action-btn !px-2 !py-1 text-rose-600">{getIntakeDecisionLabel('reject')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {confirmation ? <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-medium ${importReadiness === 'review_first' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{importReadiness === 'review_first' ? <AlertTriangle className="mr-1 inline h-4 w-4" /> : <CheckCircle2 className="mr-1 inline h-4 w-4" />}{confirmation}</div> : null}
    </section>
  );
}
