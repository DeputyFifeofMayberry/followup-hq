import { CheckCircle2, CircleOff, Info, Link2, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildReviewerActionHints, buildWorkCandidateFieldReviews, summarizeFieldReviews } from '../lib/intakeEvidence';
import { evaluateIntakeImportSafety } from '../lib/intakeImportSafety';
import { buildIntakeReviewQueue } from '../lib/intakeReviewQueue';
import { buildCandidateFieldSuggestions, buildIntakeReviewPlan, type IntakeQuickFixAction } from '../lib/intakeReviewPlan';
import { buildBatchApprovalSummary, buildQueueLaneView, buildQueueOpsSummary, resolveQueueSelectionId } from '../lib/intakeWorkspaceQueueModel';
import { getIntakeFileCapability } from '../lib/intakeFileCapabilities';
import type { IntakeBatchApproveResult } from '../store/types';
import { useAppStore } from '../store/useAppStore';
import { IntakeBatchToolsPanel } from './intake/IntakeBatchToolsPanel';
import { IntakeCandidateWorkbench } from './intake/IntakeCandidateWorkbench';
import { IntakeCapturePanel } from './intake/IntakeCapturePanel';
import { IntakeQueuePanel } from './intake/IntakeQueuePanel';
import { type ActionFeedback, type QueueLane, type SourceTab } from './intake/intakeWorkspaceTypes';

export function UniversalIntakeWorkspace() {
  const {
    intakeAssets, intakeWorkCandidates, intakeBatches, ingestIntakeFiles, ingestIntakeText, updateIntakeWorkCandidate,
    decideIntakeWorkCandidate, batchApproveHighConfidence, intakeReviewerFeedback, archiveIntakeBatch, clearFinalizedIntakeCandidates,
    removeIntakeAsset, retryIntakeAssetParse, deleteIntakeBatchIfEmpty,
  } = useAppStore(useShallow((s) => ({
    intakeAssets: s.intakeAssets,
    intakeWorkCandidates: s.intakeWorkCandidates,
    intakeBatches: s.intakeBatches,
    ingestIntakeFiles: s.ingestIntakeFiles,
    ingestIntakeText: s.ingestIntakeText,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
    batchApproveHighConfidence: s.batchApproveHighConfidence,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
    archiveIntakeBatch: s.archiveIntakeBatch,
    clearFinalizedIntakeCandidates: s.clearFinalizedIntakeCandidates,
    removeIntakeAsset: s.removeIntakeAsset,
    retryIntakeAssetParse: s.retryIntakeAssetParse,
    deleteIntakeBatchIfEmpty: s.deleteIntakeBatchIfEmpty,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<QueueLane>('needs_correction');
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [manualText, setManualText] = useState('');
  const [manualTitleHint, setManualTitleHint] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [selectedSourceTab, setSelectedSourceTab] = useState<SourceTab>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedEvidenceLocator, setSelectedEvidenceLocator] = useState<string | null>(null);
  const [confirmUnsafeCreate, setConfirmUnsafeCreate] = useState(false);
  const [batchReceipt, setBatchReceipt] = useState<IntakeBatchApproveResult | null>(null);

  const activeBatchIds = useMemo(() => new Set(intakeBatches.filter((batch) => batch.status !== 'archived').map((batch) => batch.id)), [intakeBatches]);
  const pendingCandidates = useMemo(() => intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending' && activeBatchIds.has(entry.batchId)), [intakeWorkCandidates, activeBatchIds]);
  const queue = useMemo(() => buildIntakeReviewQueue(pendingCandidates, intakeAssets, intakeBatches, undefined, intakeReviewerFeedback), [pendingCandidates, intakeAssets, intakeBatches, intakeReviewerFeedback]);
  const laneView = useMemo(() => buildQueueLaneView(queue), [queue]);
  const opsSummary = useMemo(() => buildQueueOpsSummary(queue), [queue]);
  const batchApprovalSummary = useMemo(() => buildBatchApprovalSummary(queue), [queue]);
  const byLane = laneView.byLane;
  const pendingCandidatesById = useMemo(() => new Map(pendingCandidates.map((candidate) => [candidate.id, candidate])), [pendingCandidates]);
  const queueById = useMemo(() => new Map(queue.map((item) => [item.id, item])), [queue]);

  useEffect(() => {
    const nextSelectedQueueId = resolveQueueSelectionId({
      activeLane,
      byLane,
      previousSelectionId: selectedQueueItemId,
    });
    if (nextSelectedQueueId !== selectedQueueItemId) setSelectedQueueItemId(nextSelectedQueueId);
  }, [activeLane, byLane, selectedQueueItemId]);
  useEffect(() => {
    setSelectedMatchId(null);
    setSelectedEvidenceLocator(null);
    setSelectedSourceTab('overview');
    setConfirmUnsafeCreate(false);
  }, [selectedQueueItemId]);

  const selectedQueueItem = selectedQueueItemId ? queueById.get(selectedQueueItemId) ?? null : null;
  const selectedCandidate = selectedQueueItem ? pendingCandidatesById.get(selectedQueueItem.id) ?? null : null;
  const selectedAsset = selectedCandidate ? intakeAssets.find((entry) => entry.id === selectedCandidate.assetId) ?? null : null;
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

  const runDecision = (candidateId: string, decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link', opts?: { force?: boolean }) => {
    const candidate = pendingCandidatesById.get(candidateId);
    if (!candidate) return;
    const candidateSafety = evaluateIntakeImportSafety(candidate);
    const selectedMatch = candidate.existingRecordMatches.find((m) => m.id === selectedMatchId) ?? candidate.existingRecordMatches[0] ?? null;
    if (decision === 'link') {
      if (!selectedMatch) return setFeedback({ tone: 'error', message: 'Select a matching record first.' });
      decideIntakeWorkCandidate(candidate.id, 'link', selectedMatch.id);
      setFeedback({ tone: 'success', message: `Linked to ${selectedMatch.recordType} ${selectedMatch.id}.` });
      return;
    }
    const unsafe = Boolean(candidateSafety && !candidateSafety.safeToCreateNew && (decision === 'approve_followup' || decision === 'approve_task'));
    if (unsafe && !confirmUnsafeCreate && !opts?.force) return setFeedback({ tone: 'info', message: 'Duplicate-risk override requires confirmation first.' });
    decideIntakeWorkCandidate(candidate.id, decision, undefined, { overrideUnsafeCreate: unsafe && (confirmUnsafeCreate || Boolean(opts?.force)) });
    setFeedback({ tone: 'success', message: `${decision.replaceAll('_', ' ')} complete.` });
    setConfirmUnsafeCreate(false);
  };

  const handleDecision = (decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link') => {
    if (!selectedCandidate) return;
    runDecision(selectedCandidate.id, decision);
  };

  const handleQueueQuickAction = (candidateId: string, action: 'open' | 'quick_create_followup' | 'quick_create_task' | 'quick_save_reference' | 'review_link') => {
    setSelectedQueueItemId(candidateId);
    if (action === 'open') return;
    if (action === 'review_link') {
      setActiveLane('link_duplicate_review');
      return;
    }
    if (action === 'quick_create_followup') return runDecision(candidateId, 'approve_followup', { force: true });
    if (action === 'quick_create_task') return runDecision(candidateId, 'approve_task', { force: true });
    if (action === 'quick_save_reference') return runDecision(candidateId, 'reference');
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

  const handleBatchApproveSafe = () => {
    const result = batchApproveHighConfidence();
    setBatchReceipt(result);
    const skippedOrFailed = result.skippedCount + result.failedCount;
    setFeedback({
      tone: skippedOrFailed > 0 ? 'info' : 'success',
      message: skippedOrFailed > 0
        ? `Batch approval processed ${result.processedCount}/${result.attemptedCount} safe records. Review receipt for skipped items.`
        : `Batch approval processed ${result.processedCount} safe records.`,
    });
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
            <span className="intake-intro-chip"><Info className="h-3.5 w-3.5" />Pending {opsSummary.pendingCount}</span>
            <span className="intake-intro-chip intake-intro-chip-safe"><CheckCircle2 className="h-3.5 w-3.5" />Safe now {opsSummary.safeNowCount}</span>
            <span className="intake-intro-chip"><Link2 className="h-3.5 w-3.5" />Link review {opsSummary.linkReviewCount}</span>
            <span className="intake-intro-chip"><Wrench className="h-3.5 w-3.5" />Needs correction {opsSummary.needsCorrectionCount}</span>
            <span className="intake-intro-chip"><TriangleAlert className="h-3.5 w-3.5" />Reference likely {opsSummary.referenceLikelyCount}</span>
          </div>
        </div>
        <div className="intake-safe-approve-banner mt-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Safe-path approval</div>
            <div className="text-sm font-semibold text-slate-900">Approve safe records ({batchApprovalSummary.includedCount})</div>
            <div className="text-xs text-slate-600">High-confidence records can be approved in one step. {batchApprovalSummary.excludedCount} record(s) still require manual review.</div>
          </div>
          <button
            className="action-btn intake-safe-approve-btn"
            disabled={batchApprovalSummary.includedCount === 0}
            onClick={handleBatchApproveSafe}
          >
            <ShieldCheck className="h-4 w-4" />
            Approve safe records ({batchApprovalSummary.includedCount})
          </button>
        </div>
        <details className="mt-2 intake-safe-exclusions-panel">
          <summary>Included {batchApprovalSummary.includedCount} • Excluded {batchApprovalSummary.excludedCount} (why excluded)</summary>
          <div className="intake-safe-exclusions-body">
            {batchApprovalSummary.topExclusionReasons.length ? <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
              {batchApprovalSummary.topExclusionReasons.map((reason) => (
                <li key={reason.reason}>{reason.reason} <span className="text-slate-500">({reason.count})</span></li>
              ))}
            </ul> : <div className="text-xs text-slate-500">No exclusions right now. All pending records are currently safe-path eligible.</div>}
          </div>
        </details>
      </section>

      {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{feedback.message}</div> : null}
      {batchReceipt ? <section className="intake-batch-receipt-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Batch approval receipt</div>
            <div className="text-sm font-semibold text-slate-900">Processed {batchReceipt.processedCount} of {batchReceipt.attemptedCount} safe records</div>
          </div>
          {(batchReceipt.skippedCount + batchReceipt.failedCount) > 0
            ? <span className="intake-intro-chip"><CircleOff className="h-3.5 w-3.5" />Skipped/failed {batchReceipt.skippedCount + batchReceipt.failedCount}</span>
            : <span className="intake-intro-chip intake-intro-chip-safe"><CheckCircle2 className="h-3.5 w-3.5" />No skipped records</span>}
        </div>
        <div className="mt-2 intake-batch-receipt-grid">
          <div><span className="text-slate-500">Follow-ups created:</span> {batchReceipt.followupsCreated}</div>
          <div><span className="text-slate-500">Tasks created:</span> {batchReceipt.tasksCreated}</div>
          <div><span className="text-slate-500">Remaining review queue:</span> {batchReceipt.remainingPendingCount}</div>
          <div><span className="text-slate-500">Skipped:</span> {batchReceipt.skippedCount} • <span className="text-slate-500">Failed:</span> {batchReceipt.failedCount}</div>
        </div>
      </section> : null}

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
        <IntakeQueuePanel
          activeLane={activeLane}
          byLane={byLane}
          laneCounts={laneView.counts}
          selectedCandidateId={selectedQueueItemId}
          onSelectCandidate={(id) => setSelectedQueueItemId(id)}
          onSetLane={setActiveLane}
          onQuickAction={handleQueueQuickAction}
        />

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
          activeLane={activeLane}
          lanePosition={selectedQueueItem ? (byLane[activeLane].findIndex((item) => item.id === selectedQueueItem.id) + 1) : 0}
          laneTotal={byLane[activeLane].length}
          onUpdateCandidate={updateIntakeWorkCandidate}
          onDecision={handleDecision}
          onSetConfirmUnsafeCreate={setConfirmUnsafeCreate}
          onApplyQuickFix={applyQuickFixAction}
          onSelectMatchId={setSelectedMatchId}
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
