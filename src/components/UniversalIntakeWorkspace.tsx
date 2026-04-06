import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, FileUp, Link2, Loader2, Paperclip, Save, SkipForward, XCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './Badge';
import { getAllowedIntakeActions } from '../lib/intakeLifecycle';
import type { IntakeCandidateType, IntakeWorkCandidate } from '../types';
import {
  buildCandidateMatchCompareRows,
  buildReviewerActionHints,
  buildWorkCandidateFieldReviews,
  describeMatch,
  summarizeFieldReviews,
  type IntakeFieldReview,
} from '../lib/intakeEvidence';
import {
  buildIntakeReviewQueue,
  buildQueueBucketCounts,
  buildQueueMetrics,
  filterReviewQueue,
  sortReviewQueue,
  type IntakeQueueFilters,
  type IntakeReviewBucket,
  type IntakeReviewSort,
} from '../lib/intakeReviewQueue';
import { describeFinalizedOutcome, evaluateIntakeImportSafety } from '../lib/intakeImportSafety';
import { buildIntakeTuningInsights, toneFromReadiness } from '../lib/intakeTuningInsights';
import { buildIntakeTuningModel } from '../lib/intakeTuningModel';
import { buildCandidateFieldSuggestions, buildIntakeReviewPlan } from '../lib/intakeReviewPlan';
import type { WorkspaceKey } from '../lib/appModeConfig';
import { useExecutionQueueViewModel } from '../domains/shared';
import { StructuredActionFlow } from './actions/StructuredActionFlow';

const bucketLabels: Record<IntakeReviewBucket, string> = {
  auto_resolved: 'Auto-resolved',
  ready_to_approve: 'Ready now',
  needs_correction: 'Needs correction',
  link_duplicate_review: 'Needs link decision',
  reference_likely: 'Reference likely',
  finalized_history: 'Finalized',
};

const readinessCopy = {
  ready_to_approve: { tone: 'success' as const, title: 'Ready to create', body: 'Critical fields are strong and duplicate risk is low.' },
  ready_after_correction: { tone: 'warn' as const, title: 'Ready after correction', body: 'Fix weak fields first, then approve.' },
  needs_link_decision: { tone: 'danger' as const, title: 'Needs link decision', body: 'A likely duplicate exists. Link existing before creating new.' },
  reference_likely: { tone: 'neutral' as const, title: 'Reference likely', body: 'This appears informational. Save as reference unless clear new work exists.' },
  unsafe_to_create: { tone: 'danger' as const, title: 'Unsafe to create', body: 'Blockers exist. Resolve issues or choose safer alternatives.' },
};

const statusTone: Record<IntakeFieldReview['status'], 'success' | 'warn' | 'danger' | 'blue' | 'neutral'> = {
  strong: 'success',
  medium: 'blue',
  weak: 'warn',
  missing: 'danger',
  conflicting: 'danger',
};

export function UniversalIntakeWorkspace({ setWorkspace }: { setWorkspace: (workspace: WorkspaceKey) => void }) {
  const {
    intakeBatches,
    intakeAssets,
    intakeWorkCandidates,
    intakeReviewerFeedback,
    forwardedCandidates,
    forwardedRules,
    forwardedRoutingAudit,
    items,
    tasks,
    ingestIntakeFiles,
    updateIntakeWorkCandidate,
    decideIntakeWorkCandidate,
    batchApproveHighConfidence,
  } = useAppStore(useShallow((s) => ({
    intakeBatches: s.intakeBatches,
    intakeAssets: s.intakeAssets,
    intakeWorkCandidates: s.intakeWorkCandidates,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
    forwardedCandidates: s.forwardedCandidates,
    forwardedRules: s.forwardedRules,
    forwardedRoutingAudit: s.forwardedRoutingAudit,
    items: s.items,
    tasks: s.tasks,
    ingestIntakeFiles: s.ingestIntakeFiles,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
    batchApproveHighConfidence: s.batchApproveHighConfidence,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<IntakeReviewBucket | 'all'>('all');
  const [sortKey, setSortKey] = useState<IntakeReviewSort>('newest');
  const [queueFilters, setQueueFilters] = useState<IntakeQueueFilters>({ pendingState: 'pending', confidenceTier: 'any' });
  const [guardedApproval, setGuardedApproval] = useState<{ candidateId: string; decision: 'approve_task' | 'approve_followup' } | null>(null);
  const [lastHandoff, setLastHandoff] = useState<{ target: 'followups' | 'tasks'; recordId?: string; label: string } | null>(null);
  const [decisionFlow, setDecisionFlow] = useState<null | 'approve_task' | 'approve_followup' | 'link' | 'reference' | 'reject'>(null);
  const [decisionWarnings, setDecisionWarnings] = useState<string[]>([]);
  const [decisionResult, setDecisionResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { openExecutionLane } = useExecutionQueueViewModel();

  const tuningModel = useMemo(() => buildIntakeTuningModel({
    intakeWorkCandidates,
    forwardedCandidates,
    forwardedRules,
    forwardedRoutingAudit,
    feedback: intakeReviewerFeedback,
  }), [intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, intakeReviewerFeedback]);
  const queue = useMemo(
    () => buildIntakeReviewQueue(intakeWorkCandidates, intakeAssets, tuningModel, intakeReviewerFeedback),
    [intakeWorkCandidates, intakeAssets, tuningModel, intakeReviewerFeedback],
  );
  const tuningInsights = useMemo(() => buildIntakeTuningInsights({
    intakeWorkCandidates,
    forwardedCandidates,
    forwardedRules,
    forwardedRoutingAudit,
    feedback: intakeReviewerFeedback,
  }), [intakeWorkCandidates, forwardedCandidates, forwardedRules, forwardedRoutingAudit, intakeReviewerFeedback]);
  const metrics = useMemo(() => buildQueueMetrics(queue), [queue]);
  const bucketCounts = useMemo(() => buildQueueBucketCounts(queue), [queue]);

  const filteredQueue = useMemo(() => {
    const base = filterReviewQueue(queue, queueFilters);
    const bucketed = activeBucket === 'all' ? base : base.filter((item) => item.bucket === activeBucket);
    return sortReviewQueue(bucketed, sortKey);
  }, [activeBucket, queue, queueFilters, sortKey]);

  const pendingQueue = useMemo(() => filteredQueue.filter((entry) => entry.status === 'pending'), [filteredQueue]);
  const pendingQueueIds = useMemo(() => pendingQueue.map((entry) => entry.id), [pendingQueue]);

  const selectedCandidate = intakeWorkCandidates.find((entry) => entry.id === activeCandidateId && pendingQueueIds.includes(entry.id))
    ?? intakeWorkCandidates.find((entry) => entry.id === pendingQueueIds[0])
    ?? null;
  const selectedQueueItem = pendingQueue.find((entry) => entry.id === selectedCandidate?.id);
  const selectedFieldSummary = useMemo(() => selectedCandidate ? summarizeFieldReviews(buildWorkCandidateFieldReviews(selectedCandidate)) : null, [selectedCandidate]);
  const selectedSafety = selectedCandidate ? evaluateIntakeImportSafety(selectedCandidate) : null;
  const selectedAsset = intakeAssets.find((entry) => entry.id === selectedCandidate?.assetId);
  const actionHints = useMemo(() => selectedFieldSummary ? buildReviewerActionHints(selectedFieldSummary) : [], [selectedFieldSummary]);
  const fieldLookup = useMemo(() => new Map((selectedFieldSummary?.priorityReviewFields ?? []).map((field) => [field.key, field])), [selectedFieldSummary]);
  const selectedIsReadyNow = Boolean(selectedQueueItem?.batchSafe && selectedSafety?.safeToCreateNew);
  const selectedNeedsDeepReview = Boolean(
    selectedQueueItem && (
      selectedQueueItem.readiness === 'ready_after_correction'
      || selectedQueueItem.readiness === 'needs_link_decision'
      || selectedQueueItem.readiness === 'unsafe_to_create'
      || (selectedSafety && (!selectedSafety.safeToCreateNew || selectedSafety.blockers.length > 0))
    ),
  );
  const selectedSuggestions = useMemo(
    () => selectedCandidate && selectedFieldSummary && selectedSafety
      ? buildCandidateFieldSuggestions(selectedCandidate, selectedFieldSummary, selectedSafety)
      : [],
    [selectedCandidate, selectedFieldSummary, selectedSafety],
  );
  const selectedReviewPlan = useMemo(() => {
    if (!selectedQueueItem || !selectedFieldSummary || !selectedSafety) return null;
    const tuningPressure = selectedQueueItem.alerts.some((alert) => ['tuning_review_pressure', 'tuning_due_date_guard', 'tuning_project_guard'].includes(alert.code));
    return buildIntakeReviewPlan({
      queueItem: selectedQueueItem,
      fieldSummary: selectedFieldSummary,
      safety: selectedSafety,
      suggestions: selectedSuggestions,
      tuningPressure,
    });
  }, [selectedFieldSummary, selectedQueueItem, selectedSafety, selectedSuggestions]);

  const applyAndNext = useCallback((candidate: IntakeWorkCandidate, decision: Parameters<typeof decideIntakeWorkCandidate>[1], linkedRecordId?: string, options?: { overrideUnsafeCreate?: boolean }) => {
    const currentIds = pendingQueueIds;
    const idx = currentIds.indexOf(candidate.id);
    const nextId = idx >= 0 ? currentIds[idx + 1] ?? currentIds[idx - 1] ?? null : currentIds[0] ?? null;
    decideIntakeWorkCandidate(candidate.id, decision, linkedRecordId, options);
    const updatedCandidate = useAppStore.getState().intakeWorkCandidates.find((entry) => entry.id === candidate.id);
    if (decision === 'approve_followup') {
      setLastHandoff({ target: 'followups', recordId: updatedCandidate?.createdRecordId, label: candidate.title || 'Intake follow-up' });
    } else if (decision === 'approve_task') {
      setLastHandoff({ target: 'tasks', recordId: updatedCandidate?.createdRecordId, label: candidate.title || 'Intake task' });
    } else if (decision === 'link' && linkedRecordId) {
      const target = candidate.existingRecordMatches.find((entry) => entry.id === linkedRecordId)?.recordType === 'task' ? 'tasks' : 'followups';
      setLastHandoff({ target, recordId: linkedRecordId, label: candidate.title || 'Linked record' });
    }
    setActiveCandidateId(nextId);
  }, [decideIntakeWorkCandidate, pendingQueueIds]);

  const requestCreateApproval = useCallback((candidate: IntakeWorkCandidate, decision: 'approve_task' | 'approve_followup') => {
    const safety = evaluateIntakeImportSafety(candidate);
    if (safety.safeToCreateNew) {
      applyAndNext(candidate, decision);
      return;
    }
    setGuardedApproval({ candidateId: candidate.id, decision });
  }, [applyAndNext]);

  useEffect(() => {
    if (!selectedCandidate && pendingQueueIds[0]) setActiveCandidateId(pendingQueueIds[0]);
  }, [pendingQueueIds, selectedCandidate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedCandidate) return;
      const inField = event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      if (inField) return;
      if (event.key === 'a') requestCreateApproval(selectedCandidate, 'approve_followup');
      if (event.key === 't') requestCreateApproval(selectedCandidate, 'approve_task');
      if (event.key === 's') applyAndNext(selectedCandidate, 'reference');
      if (event.key === 'r') applyAndNext(selectedCandidate, 'reject');
      if (event.key === 'l' && selectedCandidate.existingRecordMatches[0]) applyAndNext(selectedCandidate, 'link', selectedCandidate.existingRecordMatches[0].id);
      if (event.key === 'n') {
        const idx = pendingQueueIds.findIndex((entry) => entry === selectedCandidate.id);
        setActiveCandidateId(pendingQueueIds[Math.min(pendingQueueIds.length - 1, Math.max(0, idx + 1))] ?? null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyAndNext, pendingQueueIds, requestCreateApproval, selectedCandidate]);

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setLoading(true);
    await ingestIntakeFiles(Array.from(list), source);
    setLoading(false);
  };

  const queuePosition = selectedCandidate ? pendingQueueIds.findIndex((id) => id === selectedCandidate.id) + 1 : 0;

  const updateCandidateField = <K extends keyof IntakeWorkCandidate>(key: K, value: IntakeWorkCandidate[K]) => {
    if (!selectedCandidate) return;
    updateIntakeWorkCandidate(selectedCandidate.id, { [key]: value } as Partial<IntakeWorkCandidate>);
  };
  const applySuggestion = (field: string, value: string) => {
    if (!selectedCandidate) return;
    if (field === 'candidateType') {
      updateCandidateField('candidateType', value as IntakeCandidateType);
      return;
    }
    updateIntakeWorkCandidate(selectedCandidate.id, { [field]: value } as Partial<IntakeWorkCandidate>);
  };

  const openDecisionFlow = (decision: NonNullable<typeof decisionFlow>) => {
    setDecisionFlow(decision);
    setDecisionWarnings([]);
    setDecisionResult(null);
  };

  const applyDecisionFlow = () => {
    if (!selectedCandidate || !decisionFlow) return;
    if (decisionFlow === 'approve_task' || decisionFlow === 'approve_followup') {
      requestCreateApproval(selectedCandidate, decisionFlow);
      setDecisionResult({ tone: 'success', message: `Applied ${decisionFlow === 'approve_task' ? 'task' : 'follow-up'} approval decision.` });
      return;
    }
    if (decisionFlow === 'link') {
      if (!selectedCandidate.existingRecordMatches[0]) {
        setDecisionWarnings(['No existing match available to link.']);
        return;
      }
      applyAndNext(selectedCandidate, 'link', selectedCandidate.existingRecordMatches[0].id);
      setDecisionResult({ tone: 'success', message: 'Linked to best existing record.' });
      return;
    }
    applyAndNext(selectedCandidate, decisionFlow);
    setDecisionResult({ tone: decisionFlow === 'reject' ? 'warn' : 'success', message: `Applied ${decisionFlow} decision.` });
  };

  const renderFieldMeta = (key: IntakeFieldReview['key']) => {
    const field = fieldLookup.get(key);
    if (!field) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
        <Badge variant={statusTone[field.status]}>{field.status}</Badge>
        <span className="text-slate-600">{field.reasons[0] || 'Needs verification.'}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-4 transition ${dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void onFiles(event.dataTransfer.files, 'drop'); }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Review queue</div>
            <div className="text-sm text-slate-600">Needs review first. Correct fields only when needed, then approve into Follow Ups or Tasks.</div>
          </div>
          <div className="flex gap-2">
            <button className="action-btn" onClick={() => setWorkspace('worklist')}>Open Overview</button>
            <button className="action-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Add files</button>
            <button className="action-btn" onClick={batchApproveHighConfidence} disabled={metrics.batchSafeCount === 0}>Approve ready now ({metrics.batchSafeCount})</button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </div>

      {lastHandoff ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="font-semibold">Sent to execution: {lastHandoff.label}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              className="action-btn"
              onClick={() => {
                openExecutionLane(lastHandoff.target, { recordId: lastHandoff.recordId, recordType: lastHandoff.target === 'tasks' ? 'task' : 'followup', source: 'outlook', intentLabel: 'review approved intake', section: 'quick_route' });
                setWorkspace(lastHandoff.target === 'tasks' ? 'tasks' : 'followups');
              }}
            >
              Open in {lastHandoff.target === 'tasks' ? 'task lane' : 'follow-up lane'}
            </button>
            <button className="action-btn" onClick={() => setWorkspace('worklist')}>Return to Overview</button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Auto-resolved</div><div className="text-xl font-semibold text-emerald-700">{metrics.autoResolvedCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Ready now</div><div className="text-xl font-semibold text-emerald-700">{bucketCounts.ready_to_approve}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Link review</div><div className="text-xl font-semibold text-rose-700">{metrics.duplicateLinkFirstCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Forced review</div><div className="text-xl font-semibold text-amber-700">{metrics.forcedReviewCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Automation capture</div><div className="text-xl font-semibold text-slate-900">{Math.round(metrics.automationCaptureRate * 100)}%</div></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Review queue</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
          <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(bucketLabels) as IntakeReviewBucket[]).map((bucket) => (
              <button key={bucket} className={`rounded-full border px-2 py-1 ${activeBucket === bucket ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket(bucket)}>
                {bucketLabels[bucket]} ({bucketCounts[bucket]})
              </button>
            ))}
            <button className={`rounded-full border px-2 py-1 ${activeBucket === 'all' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket('all')}>All</button>
          </div>
          <div className="mb-2 grid gap-2 text-xs">
            <select className="field-input" value={queueFilters.confidenceTier ?? 'any'} onChange={(e) => setQueueFilters((f) => ({ ...f, confidenceTier: e.target.value as IntakeQueueFilters['confidenceTier'] }))}>
              <option value="any">Any confidence</option><option value="high">High confidence</option><option value="medium">Medium confidence</option><option value="low">Low confidence</option>
            </select>
            <select className="field-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as IntakeReviewSort)}>
              <option value="newest">Operational priority (default)</option><option value="highest_confidence">Highest confidence first</option><option value="lowest_confidence">Weakest confidence first</option><option value="most_missing_fields">Most missing fields</option><option value="duplicate_risk_first">Duplicate risk first</option>
            </select>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.batchSafeOnly ?? false} onChange={(e) => setQueueFilters((f) => ({ ...f, batchSafeOnly: e.target.checked }))} />Batch-safe only</label>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.duplicateRisk === 'only'} onChange={(e) => setQueueFilters((f) => ({ ...f, duplicateRisk: e.target.checked ? 'only' : 'all' }))} />Duplicate risk only</label>
          </div>

          <div className="max-h-[700px] space-y-2 overflow-auto pr-1">
            {pendingQueue.map((queueEntry, idx) => {
              const candidate = intakeWorkCandidates.find((entry) => entry.id === queueEntry.id);
              if (!candidate) return null;
              const selected = selectedCandidate?.id === candidate.id;
              return (
                <button key={candidate.id} className={`w-full rounded-xl border p-2 text-left ${selected ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => setActiveCandidateId(candidate.id)}>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>#{idx + 1}</span><span>{queueEntry.nextStepHint}</span></div>
                  <div className="truncate text-sm font-medium text-slate-900">{candidate.title || '(untitled candidate)'}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    <Badge variant={readinessCopy[queueEntry.readiness].tone}>{readinessCopy[queueEntry.readiness].title}</Badge>
                    <Badge variant="blue">{candidate.candidateType}</Badge>
                    <Badge variant={candidate.confidence >= 0.9 ? 'success' : candidate.confidence >= 0.7 ? 'warn' : 'danger'}>{candidate.confidence.toFixed(2)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{queueEntry.alerts.slice(0, 2).map((alert) => alert.label).join(' • ') || 'No active warnings.'}</div>
                </button>
              );
            })}
            {pendingQueueIds.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No pending candidates in this queue view.</div> : null}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-3">
          {!selectedCandidate || !selectedQueueItem || !selectedSafety ? <div className="text-sm text-slate-500">Select a queue candidate to start correction.</div> : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Candidate review lane</div>
                  <div className="text-xs text-slate-500">Reviewing {queuePosition} of {pendingQueueIds.length}. {selectedQueueItem.nextStepHint}</div>
                </div>
                <button className="action-btn" onClick={() => {
                  const idx = pendingQueueIds.findIndex((entry) => entry === selectedCandidate.id);
                  setActiveCandidateId(pendingQueueIds[Math.min(pendingQueueIds.length - 1, Math.max(0, idx + 1))] ?? null);
                }}><SkipForward className="h-4 w-4" /> Next</button>
              </div>

              <div className={`rounded-lg border p-2 text-xs text-slate-700 ${selectedIsReadyNow ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="font-semibold">Review readiness</div>
                <div className="mt-1"><Badge variant={readinessCopy[selectedQueueItem.readiness].tone}>{readinessCopy[selectedQueueItem.readiness].title}</Badge> <span className="ml-1">{readinessCopy[selectedQueueItem.readiness].body}</span></div>
                {selectedReviewPlan ? <div className="mt-1 text-slate-600">Suggested decision: <span className="font-semibold">{selectedReviewPlan.suggestedDecision.replaceAll('_', ' ')}</span> • {selectedReviewPlan.suggestedDecisionReason}</div> : null}
                {selectedSafety.blockers[0] ? <div className="mt-2 rounded-md bg-rose-100 px-2 py-1 text-rose-800">{selectedSafety.blockers[0]}</div> : null}
                {selectedCandidate.warnings.length ? (
                  <div className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-amber-900">
                    <div className="font-semibold">Blocked from live approval until repaired:</div>
                    <div className="mt-1">{selectedCandidate.warnings.slice(0, 3).join(' • ')}</div>
                  </div>
                ) : null}
              </div>

              {selectedReviewPlan?.fastApproveEligible ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <div className="font-semibold">Fast-approve candidate</div>
                  <div className="mt-1">This item is safe, batch-eligible, and has no required corrections. Use the primary approve action and move on.</div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision actions</div>
                  {selectedIsReadyNow ? <Badge variant="success">Fast approve recommended</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={selectedQueueItem.readiness === 'ready_to_approve' ? 'primary-btn' : 'action-btn'} onClick={() => openDecisionFlow('approve_task')}><CheckCircle2 className="h-4 w-4" /> Approve into Tasks</button>
                  <button className={selectedQueueItem.readiness === 'ready_to_approve' ? 'primary-btn' : 'action-btn'} onClick={() => openDecisionFlow('approve_followup')}><Paperclip className="h-4 w-4" /> Approve into Follow Ups</button>
                  <button className={selectedQueueItem.readiness === 'needs_link_decision' && selectedCandidate.existingRecordMatches[0] ? 'primary-btn' : 'action-btn'} onClick={() => openDecisionFlow('link')} disabled={!selectedCandidate.existingRecordMatches[0]}><Link2 className="h-4 w-4" /> Link existing</button>
                  <button className={selectedQueueItem.readiness === 'reference_likely' ? 'primary-btn' : 'action-btn'} onClick={() => openDecisionFlow('reference')}><Save className="h-4 w-4" /> Save as reference</button>
                  <button className="action-btn action-btn-danger" onClick={() => openDecisionFlow('reject')}><XCircle className="h-4 w-4" /> Reject</button>
                </div>
                <div className="mt-2 text-xs text-slate-600">Keyboard: [A] follow-up, [T] task, [L] link top match, [S] reference, [R] reject, [N] next.</div>
              </div>

              {selectedNeedsDeepReview ? (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Required to approve</div>
                  {selectedReviewPlan?.requiredCorrections.length ? <div className="mb-2 text-xs text-slate-600">{selectedReviewPlan.requiredCorrections.map((field) => field.label).join(' • ')}</div> : null}
                  {selectedReviewPlan?.quickFixActions.length ? (
                    <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs">
                      <div className="font-semibold text-sky-900">Suggested fixes</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedReviewPlan.quickFixActions.filter((action) => action.kind === 'apply_suggestion').map((action) => (
                          <button key={action.id} className="action-btn" onClick={() => action.suggestion && applySuggestion(action.suggestion.field, action.suggestion.value)}>{action.label}</button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="field-block"><span className="field-label">Type</span>
                      <select className="field-input" value={selectedCandidate.candidateType} onChange={(event) => updateCandidateField('candidateType', event.target.value as IntakeCandidateType)}>
                        <option value="followup">followup</option><option value="task">task</option><option value="reference">reference</option><option value="update_existing_followup">update existing followup</option><option value="update_existing_task">update existing task</option>
                      </select>
                      {renderFieldMeta('type')}
                    </label>
                    <label className="field-block"><span className="field-label">Due date</span><input className="field-input" value={selectedCandidate.dueDate || ''} placeholder="YYYY-MM-DD" onChange={(event) => updateCandidateField('dueDate', event.target.value)} />{renderFieldMeta('dueDate')}</label>
                    <label className="field-block sm:col-span-2"><span className="field-label">Title</span><input className="field-input" value={selectedCandidate.title || ''} onChange={(event) => updateCandidateField('title', event.target.value)} />{renderFieldMeta('title')}</label>
                    <label className="field-block"><span className="field-label">Project</span><input className="field-input" value={selectedCandidate.project || ''} onChange={(event) => updateCandidateField('project', event.target.value)} />{renderFieldMeta('project')}</label>
                    <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={selectedCandidate.owner || ''} onChange={(event) => updateCandidateField('owner', event.target.value)} />{renderFieldMeta('owner')}</label>
                    <label className="field-block"><span className="field-label">Assignee</span><input className="field-input" value={selectedCandidate.assignee || ''} onChange={(event) => updateCandidateField('assignee', event.target.value)} /></label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:col-span-2 text-xs">
                      <div className="font-semibold text-slate-700">Existing link recommendation</div>
                      <div className="mt-1 text-slate-600">{selectedCandidate.existingRecordMatches[0] ? describeMatch(selectedCandidate.existingRecordMatches[0]) : 'No strong match detected.'}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedReviewPlan?.quickFixActions.filter((action) => action.kind !== 'apply_suggestion').map((action) => (
                          <button
                            key={action.id}
                            className={action.kind === 'link_best_match' ? 'primary-btn' : 'action-btn'}
                            onClick={() => {
                              if (action.kind === 'link_best_match' && selectedCandidate.existingRecordMatches[0]) applyAndNext(selectedCandidate, 'link', selectedCandidate.existingRecordMatches[0].id);
                              if (action.kind === 'save_reference') applyAndNext(selectedCandidate, 'reference');
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <details className="rounded-xl border border-slate-200 p-3" open={selectedNeedsDeepReview}>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting fields</summary>
                {selectedReviewPlan?.recommendedCorrections.length ? <div className="mt-2 text-xs text-slate-600">Recommended improvements: {selectedReviewPlan.recommendedCorrections.map((field) => field.label).join(' • ')}</div> : null}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="field-block"><span className="field-label">Priority</span>
                    <select className="field-input" value={selectedCandidate.priority} onChange={(event) => updateCandidateField('priority', event.target.value as IntakeWorkCandidate['priority'])}>
                      <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option>
                    </select>
                  </label>
                  <label className="field-block"><span className="field-label">Waiting on</span><input className="field-input" value={selectedCandidate.waitingOn || ''} onChange={(event) => updateCandidateField('waitingOn', event.target.value)} /></label>
                  <label className="field-block sm:col-span-2"><span className="field-label">Next step / next action</span><input className="field-input" value={selectedCandidate.nextStep || ''} onChange={(event) => updateCandidateField('nextStep', event.target.value)} /></label>
                  <label className="field-block sm:col-span-2"><span className="field-label">Summary</span><textarea className="field-textarea !min-h-[90px]" value={selectedCandidate.summary || ''} onChange={(event) => updateCandidateField('summary', event.target.value)} /></label>
                </div>
              </details>

              {guardedApproval?.candidateId === selectedCandidate.id ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                  <div className="font-semibold text-rose-700"><AlertTriangle className="mr-1 inline h-4 w-4" /> Override required before creating new work</div>
                  <div className="mt-1 text-rose-700">{[...selectedSafety.blockers, ...selectedSafety.warnings].slice(0, 2).join(' ') || 'Use safer alternatives first.'}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCandidate.existingRecordMatches[0] ? <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(selectedCandidate, 'link', selectedCandidate.existingRecordMatches[0].id); }}><Link2 className="h-3 w-3" /> Link best match</button> : null}
                    <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(selectedCandidate, 'reference'); }}>Save reference</button>
                    <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(selectedCandidate, 'reject'); }}>Reject</button>
                    <button className="action-btn action-btn-danger" onClick={() => { setGuardedApproval(null); applyAndNext(selectedCandidate, guardedApproval.decision, undefined, { overrideUnsafeCreate: true }); }}>Override and create anyway</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-3">
          {!selectedCandidate || !selectedFieldSummary || !selectedSafety || !selectedQueueItem ? <div className="text-sm text-slate-500">Evidence and match inspector appears when a candidate is active.</div> : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Evidence + match inspector</div>
                <div className="text-xs text-slate-500">Understand what is weak, why it was inferred, and what action is safest.</div>
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs" open={selectedNeedsDeepReview}>
                <summary className="cursor-pointer font-semibold text-slate-700">Field actions needed</summary>
                <div className="mt-2 space-y-2 max-h-[270px] overflow-auto pr-1">
                  {actionHints.map((hint) => (
                    <div key={hint.field.key} className={`rounded-lg border p-2 ${hint.isBlocker ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{hint.field.label}{hint.isBlocker ? ' (critical)' : ''}</span>
                        <Badge variant={statusTone[hint.field.status]}>{hint.field.status}</Badge>
                      </div>
                      <div className="mt-1 text-slate-700">{hint.field.value || 'Missing value'}</div>
                      <div className="mt-1 text-slate-600">Why: {hint.reason}</div>
                      <div className="mt-1 text-sky-700">Next: {hint.nextStep}</div>
                      {hint.field.sourceRefs[0] ? <div className="mt-1 text-[11px] text-slate-500">Source: {hint.field.sourceRefs[0].sourceRef}{hint.field.sourceRefs[0].locator ? ` (${hint.field.sourceRefs[0].locator})` : ''}</div> : null}
                    </div>
                  ))}
                  {actionHints.length === 0 ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">No weak/missing/conflicting fields. Candidate appears ready.</div> : null}
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs" open={selectedNeedsDeepReview}>
                <summary className="cursor-pointer font-semibold text-slate-700">Link existing guidance</summary>
                <div className="mt-1 text-slate-600">{selectedQueueItem.readiness === 'needs_link_decision' ? 'Duplicate risk is elevated. Linking existing is the safer default.' : 'Create new only after blockers and high-risk mismatches are resolved.'}</div>
                {selectedCandidate.existingRecordMatches.slice(0, 3).map((match, idx) => {
                  const compareRows = buildCandidateMatchCompareRows(selectedCandidate, match);
                  return (
                    <div key={match.id} className={`mt-2 rounded-lg border p-2 ${idx === 0 ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-slate-800">{match.recordType}: {match.title}</div>
                        <button className={idx === 0 ? 'primary-btn' : 'action-btn'} onClick={() => applyAndNext(selectedCandidate, 'link', match.id)}><Link2 className="h-3 w-3" /> Link{idx === 0 ? ' best match' : ' existing'}</button>
                      </div>
                      <div className="mt-1 text-slate-600">{describeMatch(match)}</div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                        <div className="font-semibold text-slate-500">Field</div><div className="font-semibold text-slate-500">Candidate</div><div className="font-semibold text-slate-500">Existing</div>
                        {compareRows.map((row) => (
                          <div key={`${match.id}-${row.field}`} className="contents">
                            <div className="text-slate-700">{row.label}</div>
                            <div className={row.alignment === 'missing_candidate' ? 'text-rose-700' : 'text-slate-700'}>{row.candidateValue}</div>
                            <div className={row.alignment === 'different' ? 'text-amber-700' : 'text-slate-700'}>{row.existingValue}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {selectedCandidate.existingRecordMatches.length === 0 ? <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-600">No existing matches suggested.</div> : null}
              </details>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                <div className="font-semibold">Safety checklist</div>
                <div className="mt-1 space-y-1">
                  {selectedSafety.checklist.map((item) => <div key={item.key} className={item.pass ? 'text-emerald-700' : 'text-rose-700'}>{item.pass ? '✓' : '•'} {item.label}</div>)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                <div className="font-semibold">Source context</div>
                <div className="mt-1">Asset: {selectedAsset?.fileName || selectedCandidate.assetId}</div>
                <div>Parse quality: {selectedAsset?.parseQuality || 'n/a'} • Status: {selectedAsset?.parseStatus || 'n/a'}</div>
                <div className="mt-1">Allowed actions in review: {getAllowedIntakeActions('review_needed').length}</div>
              </div>
            </div>
          )}
        </section>
      </div>

      {filteredQueue.filter((entry) => entry.status === 'finalized').length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Finalized outcomes</summary>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Finalized outcomes</div>
          <div className="space-y-1">
            {filteredQueue.filter((entry) => entry.status === 'finalized').slice(0, 5).map((queueEntry) => {
              const candidate = intakeWorkCandidates.find((entry) => entry.id === queueEntry.id);
              if (!candidate) return null;
              return (
                <div key={candidate.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                  <span className="truncate text-slate-700">{candidate.title}</span>
                  <Badge variant="neutral">{describeFinalizedOutcome(candidate)}</Badge>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Intake admin insights</summary>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Intake tuning snapshot</div>
          <div className="flex flex-wrap gap-1">
            <Badge variant={tuningInsights.trustPosture === 'stable' ? 'success' : tuningInsights.trustPosture === 'caution' ? 'warn' : 'danger'}>Trust posture: {tuningInsights.trustPosture}</Badge>
            <Badge variant={tuningInsights.automationHealth === 'strong' ? 'success' : tuningInsights.automationHealth === 'watch' ? 'warn' : 'danger'}>Automation health: {tuningInsights.automationHealth}</Badge>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-slate-700">Correction hotspots</div>
            {tuningInsights.correctionHotspots.map((chip) => <div key={chip.label} className="mb-1 flex items-center justify-between"><span className="text-slate-600">{chip.label}</span><Badge variant={chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'neutral'}>{chip.value}</Badge></div>)}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-slate-700">Override patterns + weak parse pressure</div>
            {tuningInsights.overridePatterns.map((chip) => <div key={chip.label} className="mb-1 flex items-center justify-between"><span className="text-slate-600">{chip.label}</span><Badge variant={chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'neutral'}>{chip.value}</Badge></div>)}
            <div className="mt-2 flex flex-wrap gap-1">
              {tuningInsights.weakParseHotspots.map((chip) => <Badge key={chip.label} variant={chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'neutral'}>{chip.label}: {chip.value}</Badge>)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-slate-700">Automation thresholds</div>
            {tuningInsights.qualitySummary.map((chip) => <div key={chip.label} className="mb-1 flex items-center justify-between"><span className="text-slate-600">{chip.label}</span><Badge variant={chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : chip.tone === 'success' ? 'success' : 'blue'}>{chip.value}</Badge></div>)}
            <div className="mt-2 space-y-1 text-slate-600">
              <div>Due-date guard: <span className="font-semibold">{tuningInsights.thresholds.requireStrongDueDateEvidence ? 'active' : 'inactive'}</span></div>
              <div>Project guard: <span className="font-semibold">{tuningInsights.thresholds.requireStrongProjectEvidence ? 'active' : 'inactive'}</span></div>
              <div>Duplicate caution: <span className="font-semibold">{tuningInsights.thresholds.duplicateCautionBoost ? 'boosted' : 'normal'}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-slate-700">Direct-import readiness by source</div>
            <div className="space-y-1">
              {tuningInsights.directImportReadiness.map((entry) => (
                <div key={entry.source} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{entry.source}</span>
                    <Badge variant={toneFromReadiness(entry.readiness)}>{entry.readiness.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-1 text-slate-600">{entry.reason}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="mb-1 font-semibold text-slate-700">Noisy forwarding rules + tuning suggestions</div>
            <div className="space-y-1">
              {tuningInsights.ruleInsights.slice(0, 4).map((rule) => (
                <div key={rule.ruleId} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{rule.ruleName}</span>
                    <Badge variant={rule.quality === 'strong' ? 'success' : rule.quality === 'watch' ? 'warn' : 'danger'}>{rule.quality}</Badge>
                  </div>
                  <div className="mt-1 text-slate-600">hits {rule.hits} • approved {rule.approved} • overrides {rule.overrides} • rejected/reference {rule.rejectedOrReference}</div>
                  <div className="mt-1 text-slate-500">{rule.reason}</div>
                </div>
              ))}
              <ul className="list-disc pl-4 text-slate-600">
                {tuningInsights.tuningSuggestions.slice(0, 4).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-600">Linked records available: {items.length} follow-ups • {tasks.length} tasks • Batches: {intakeBatches.length}.</div>
      </details>
      <StructuredActionFlow
        open={!!decisionFlow}
        title="Intake decision review"
        subtitle="Use shared decision handling before creating, linking, or rejecting."
        onCancel={() => setDecisionFlow(null)}
        onConfirm={applyDecisionFlow}
        confirmLabel="Apply decision"
        warnings={decisionWarnings}
        blockers={decisionFlow === 'link' && !selectedCandidate?.existingRecordMatches[0] ? ['Link requires an existing record match.'] : []}
        result={decisionResult}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Decision: {decisionFlow?.replace('_', ' ')}. Candidate: {selectedCandidate?.title || 'No candidate selected'}.
        </div>
      </StructuredActionFlow>
    </div>
  );
}
