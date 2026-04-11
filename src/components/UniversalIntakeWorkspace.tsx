import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildReviewerActionHints, buildWorkCandidateFieldReviews, summarizeFieldReviews } from '../lib/intakeEvidence';
import { evaluateIntakeImportSafety } from '../lib/intakeImportSafety';
import { buildIntakeReviewQueue } from '../lib/intakeReviewQueue';
import { buildCandidateFieldSuggestions, buildIntakeReviewPlan, type IntakeQuickFixAction } from '../lib/intakeReviewPlan';
import { getIntakeFileCapability } from '../lib/intakeFileCapabilities';
import { useAppStore } from '../store/useAppStore';
import { IntakeBatchToolsPanel } from './intake/IntakeBatchToolsPanel';
import { IntakeCandidateWorkbench } from './intake/IntakeCandidateWorkbench';
import { IntakeCapturePanel } from './intake/IntakeCapturePanel';
import { IntakeQueuePanel } from './intake/IntakeQueuePanel';
import { queueLane, type ActionFeedback, type QueueLane, type SourceTab } from './intake/intakeWorkspaceTypes';

export function UniversalIntakeWorkspace() {
  const {
    intakeAssets, intakeWorkCandidates, intakeBatches, ingestIntakeFiles, ingestIntakeText, updateIntakeWorkCandidate,
    decideIntakeWorkCandidate, intakeReviewerFeedback, archiveIntakeBatch, clearFinalizedIntakeCandidates,
    removeIntakeAsset, retryIntakeAssetParse, deleteIntakeBatchIfEmpty,
  } = useAppStore(useShallow((s) => ({
    intakeAssets: s.intakeAssets,
    intakeWorkCandidates: s.intakeWorkCandidates,
    intakeBatches: s.intakeBatches,
    ingestIntakeFiles: s.ingestIntakeFiles,
    ingestIntakeText: s.ingestIntakeText,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
    archiveIntakeBatch: s.archiveIntakeBatch,
    clearFinalizedIntakeCandidates: s.clearFinalizedIntakeCandidates,
    removeIntakeAsset: s.removeIntakeAsset,
    retryIntakeAssetParse: s.retryIntakeAssetParse,
    deleteIntakeBatchIfEmpty: s.deleteIntakeBatchIfEmpty,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<QueueLane>('needs_correction');
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [manualText, setManualText] = useState('');
  const [manualTitleHint, setManualTitleHint] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [selectedSourceTab, setSelectedSourceTab] = useState<SourceTab>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedEvidenceLocator, setSelectedEvidenceLocator] = useState<string | null>(null);
  const [confirmUnsafeCreate, setConfirmUnsafeCreate] = useState(false);

  const activeBatchIds = useMemo(() => new Set(intakeBatches.filter((batch) => batch.status !== 'archived').map((batch) => batch.id)), [intakeBatches]);
  const pendingCandidates = useMemo(() => intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending' && activeBatchIds.has(entry.batchId)), [intakeWorkCandidates, activeBatchIds]);
  const queue = useMemo(() => buildIntakeReviewQueue(pendingCandidates, intakeAssets, intakeBatches, undefined, intakeReviewerFeedback), [pendingCandidates, intakeAssets, intakeBatches, intakeReviewerFeedback]);

  const byLane = useMemo(() => {
    const out: Record<QueueLane, typeof pendingCandidates> = { ready_to_create: [], needs_correction: [], link_duplicate_review: [], reference_only: [] };
    pendingCandidates.forEach((candidate) => {
      const item = queue.find((entry) => entry.id === candidate.id);
      out[item ? queueLane(item) : 'needs_correction'].push(candidate);
    });
    return out;
  }, [pendingCandidates, queue]);

  const visibleCandidates = byLane[activeLane];
  useEffect(() => {
    if (!visibleCandidates.length) { setSelectedCandidateId(null); return; }
    if (!selectedCandidateId || !visibleCandidates.some((entry) => entry.id === selectedCandidateId)) setSelectedCandidateId(visibleCandidates[0].id);
  }, [visibleCandidates, selectedCandidateId]);
  useEffect(() => {
    setSelectedMatchId(null);
    setSelectedEvidenceLocator(null);
    setSelectedSourceTab('overview');
    setConfirmUnsafeCreate(false);
  }, [selectedCandidateId]);

  const selectedCandidate = pendingCandidates.find((entry) => entry.id === selectedCandidateId) ?? null;
  const selectedAsset = selectedCandidate ? intakeAssets.find((entry) => entry.id === selectedCandidate.assetId) ?? null : null;
  const selectedQueueItem = selectedCandidate ? queue.find((entry) => entry.id === selectedCandidate.id) ?? null : null;
  const safety = selectedCandidate ? evaluateIntakeImportSafety(selectedCandidate) : null;
  const selectedFieldSummary = useMemo(() => selectedCandidate ? summarizeFieldReviews(buildWorkCandidateFieldReviews(selectedCandidate)) : null, [selectedCandidate]);
  const selectedActionHints = useMemo(() => selectedFieldSummary ? buildReviewerActionHints(selectedFieldSummary, 20) : [], [selectedFieldSummary]);
  const selectedSuggestions = useMemo(() => (selectedCandidate && selectedFieldSummary && safety ? buildCandidateFieldSuggestions(selectedCandidate, selectedFieldSummary, safety) : []), [selectedCandidate, selectedFieldSummary, safety]);
  const selectedReviewPlan = useMemo(() => {
    if (!selectedQueueItem || !selectedFieldSummary || !safety) return null;
    return buildIntakeReviewPlan({ queueItem: selectedQueueItem, fieldSummary: selectedFieldSummary, safety, suggestions: selectedSuggestions });
  }, [selectedQueueItem, selectedFieldSummary, safety, selectedSuggestions]);

  const createBlocked = Boolean(selectedReviewPlan && selectedReviewPlan.requiredCorrections.length > 0);
  const requiredCorrectionsByStatus = useMemo(() => {
    const groups = { missing: [], weak: [], conflicting: [] } as Record<'missing' | 'weak' | 'conflicting', NonNullable<typeof selectedReviewPlan>['requiredCorrections']>;
    selectedReviewPlan?.requiredCorrections.forEach((field) => {
      if (field.status === 'missing' || field.status === 'weak' || field.status === 'conflicting') groups[field.status].push(field);
    });
    return groups;
  }, [selectedReviewPlan]);
  const suggestedQuickFixes = useMemo(() => selectedReviewPlan?.quickFixActions.slice(0, 3) ?? [], [selectedReviewPlan]);
  const duplicateGroup = selectedCandidate?.suspectedDuplicateGroupId ? pendingCandidates.filter((candidate) => candidate.suspectedDuplicateGroupId === selectedCandidate.suspectedDuplicateGroupId) : [];

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    const all = Array.from(list);
    const blocked = all.filter((file) => getIntakeFileCapability(file.name).state === 'blocked');
    const allowed = all.filter((file) => getIntakeFileCapability(file.name).state !== 'blocked');
    if (blocked.length) {
      const guidance = blocked
        .map((file) => getIntakeFileCapability(file.name).reason)
        .filter(Boolean)
        .slice(0, 2)
        .join(' ');
      setFeedback({ tone: 'error', message: `Rejected ${blocked.length} blocked file(s). ${guidance || 'Use a supported format or paste key text.'}` });
    }
    if (!allowed.length) return;
    setLoading(true);
    try {
      await ingestIntakeFiles(allowed, source);
      setFeedback({ tone: 'success', message: `Uploaded ${allowed.length} file(s). Queue refreshed.` });
    } catch (error) {
      setFeedback({ tone: 'error', message: `Upload failed: ${error instanceof Error ? error.message : 'unexpected error'}` });
    } finally { setLoading(false); }
  };

  const handleDecision = (decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link') => {
    if (!selectedCandidate) return;
    const selectedMatch = selectedCandidate.existingRecordMatches.find((m) => m.id === selectedMatchId) ?? selectedCandidate.existingRecordMatches[0] ?? null;
    const currentIdx = visibleCandidates.findIndex((entry) => entry.id === selectedCandidate.id);
    const nextInLane = currentIdx >= 0 ? visibleCandidates[currentIdx + 1] ?? visibleCandidates[currentIdx - 1] ?? null : null;
    if (decision === 'link') {
      if (!selectedMatch) return setFeedback({ tone: 'error', message: 'Select a matching record first.' });
      decideIntakeWorkCandidate(selectedCandidate.id, 'link', selectedMatch.id);
      if (nextInLane) setSelectedCandidateId(nextInLane.id);
      setFeedback({ tone: 'success', message: `Linked to ${selectedMatch.recordType} ${selectedMatch.id}. ${nextInLane ? 'Loaded next candidate in this lane.' : 'Lane complete.'}` });
      return;
    }
    const unsafe = Boolean(safety && !safety.safeToCreateNew && (decision === 'approve_followup' || decision === 'approve_task'));
    if (unsafe && !confirmUnsafeCreate) return setFeedback({ tone: 'info', message: 'Duplicate-risk override requires confirmation first.' });
    decideIntakeWorkCandidate(selectedCandidate.id, decision, undefined, { overrideUnsafeCreate: unsafe && confirmUnsafeCreate });
    if (nextInLane) setSelectedCandidateId(nextInLane.id);
    setFeedback({ tone: 'success', message: `${decision.replaceAll('_', ' ')} complete. ${nextInLane ? 'Loaded next candidate in this lane.' : 'No more candidates in this lane.'}` });
    setConfirmUnsafeCreate(false);
  };

  const applyQuickFixAction = (action: IntakeQuickFixAction) => {
    if (!selectedCandidate) return;
    if (action.kind === 'apply_suggestion' && action.suggestion) {
      const value = action.suggestion.value;
      if (action.suggestion.field === 'candidateType') updateIntakeWorkCandidate(selectedCandidate.id, { candidateType: value as never });
      if (action.suggestion.field === 'title') updateIntakeWorkCandidate(selectedCandidate.id, { title: value });
      if (action.suggestion.field === 'project') updateIntakeWorkCandidate(selectedCandidate.id, { project: value });
      if (action.suggestion.field === 'owner') updateIntakeWorkCandidate(selectedCandidate.id, { owner: value });
      if (action.suggestion.field === 'assignee') updateIntakeWorkCandidate(selectedCandidate.id, { assignee: value });
      if (action.suggestion.field === 'dueDate') updateIntakeWorkCandidate(selectedCandidate.id, { dueDate: value });
      if (action.suggestion.field === 'nextStep') updateIntakeWorkCandidate(selectedCandidate.id, { nextStep: value });
      return;
    }
    if (action.kind === 'link_best_match') return handleDecision('link');
    if (action.kind === 'save_reference') return handleDecision('reference');
  };

  return (
    <div className="intake-workspace-shell">
      <section className="intake-workspace-intro intake-support-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intake workflow</div>
            <h2 className="text-lg font-semibold text-slate-900">Add source → Review queue → Resolve one candidate → Continue.</h2>
            <p className="mt-1 text-xs text-slate-600">The queue is your operational landing zone. The workbench is for single-candidate resolution.</p>
          </div>
          <div className="intake-intro-metrics">
            <span className="intake-intro-chip"><Info className="h-3.5 w-3.5" />Pending {pendingCandidates.length}</span>
            <span className="intake-intro-chip"><TriangleAlert className="h-3.5 w-3.5" />Needs correction {byLane.needs_correction.length}</span>
            <span className="intake-intro-chip"><XCircle className="h-3.5 w-3.5" />Link review {byLane.link_duplicate_review.length}</span>
            <span className="intake-intro-chip"><CheckCircle2 className="h-3.5 w-3.5" />Ready {byLane.ready_to_create.length}</span>
          </div>
        </div>
      </section>

      {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{feedback.message}</div> : null}

      <IntakeCapturePanel dragging={dragging} loading={loading} manualText={manualText} manualTitleHint={manualTitleHint} pasteLoading={pasteLoading} setManualText={setManualText} setManualTitleHint={setManualTitleHint} setDragging={setDragging} onFiles={onFiles} onSubmitPaste={async () => {
        const trimmed = manualText.trim();
        if (trimmed.length < 12) return setFeedback({ tone: 'error', message: 'Paste at least a short meaningful snippet before ingesting.' });
        setPasteLoading(true);
        try {
          await ingestIntakeText(manualText, manualTitleHint.trim() || `Pasted intake ${new Date().toISOString().slice(0, 10)}`);
          setManualText('');
          setFeedback({ tone: 'success', message: 'Pasted intake queued for review.' });
        } catch (error) {
          setFeedback({ tone: 'error', message: `Paste intake failed: ${error instanceof Error ? error.message : 'unknown error'}` });
        } finally {
          setPasteLoading(false);
        }
      }} />

      <section className="intake-core-grid intake-core-grid-staged">
        <IntakeQueuePanel activeLane={activeLane} byLane={byLane} queue={queue} selectedCandidateId={selectedCandidateId} onSelectCandidate={(id) => setSelectedCandidateId(id)} onSetLane={setActiveLane} />

        <IntakeCandidateWorkbench
          selectedCandidate={selectedCandidate}
          selectedQueueItem={selectedQueueItem}
          selectedAsset={selectedAsset}
          selectedReviewPlan={selectedReviewPlan}
          selectedActionHints={selectedActionHints as Array<{ field: { key: string }; nextStep: string }>}
          requiredCorrectionsByStatus={requiredCorrectionsByStatus}
          suggestedQuickFixes={suggestedQuickFixes}
          selectedMatchId={selectedMatchId}
          createBlocked={createBlocked}
          safety={safety}
          confirmUnsafeCreate={confirmUnsafeCreate}
          selectedSourceTab={selectedSourceTab}
          selectedEvidenceLocator={selectedEvidenceLocator}
          duplicateGroup={duplicateGroup}
          onUpdateCandidate={updateIntakeWorkCandidate}
          onDecision={handleDecision}
          onSetConfirmUnsafeCreate={setConfirmUnsafeCreate}
          onApplyQuickFix={applyQuickFixAction}
          onSelectMatchId={setSelectedMatchId}
          onSelectCandidateId={setSelectedCandidateId}
          onSetSourceTab={setSelectedSourceTab}
          onSelectEvidenceLocator={setSelectedEvidenceLocator}
        />
      </section>

      <IntakeBatchToolsPanel
        intakeBatches={intakeBatches}
        intakeAssets={intakeAssets}
        intakeWorkCandidates={intakeWorkCandidates}
        archiveIntakeBatch={archiveIntakeBatch}
        clearFinalizedIntakeCandidates={clearFinalizedIntakeCandidates}
        removeIntakeAsset={removeIntakeAsset}
        retryIntakeAssetParse={retryIntakeAssetParse}
        deleteIntakeBatchIfEmpty={deleteIntakeBatchIfEmpty}
        onFeedback={(tone, message) => setFeedback({ tone, message })}
      />
    </div>
  );
}
