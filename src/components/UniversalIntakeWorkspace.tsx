import {
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileUp,
  Info,
  Link2,
  Loader2,
  Mail,
  Sheet,
  TriangleAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildWorkCandidateFieldReviews, summarizeFieldReviews } from '../lib/intakeEvidence';
import { evaluateIntakeImportSafety } from '../lib/intakeImportSafety';
import { buildIntakeReviewQueue, type IntakeQueueItem } from '../lib/intakeReviewQueue';
import { describeIntakeFileSupport, getIntakeFileCapability, getIntakeFileInputAccept } from '../lib/intakeFileCapabilities';
import { toDateInputValue } from '../lib/intakeDates';
import { useAppStore } from '../store/useAppStore';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../types';

type Tone = 'success' | 'error' | 'info';
type QueueLane = 'ready_to_create' | 'needs_correction' | 'link_duplicate_review' | 'reference_only';
type SourceTab = 'overview' | 'preview' | 'evidence' | 'metadata';

interface ActionFeedback { tone: Tone; message: string; }

function prettyFileSize(sizeBytes: number) { if (sizeBytes < 1024) return `${sizeBytes} B`; if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`; return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`; }
function candidateTypeLabel(type: IntakeWorkCandidate['candidateType']) { if (type === 'followup') return 'Follow-up'; if (type === 'task') return 'Task'; if (type === 'update_existing_followup') return 'Update follow-up'; if (type === 'update_existing_task') return 'Update task'; return 'Reference'; }
function sanitizeSnippet(value: string) { return value.split('').map((char) => { const code = char.charCodeAt(0); return (code >= 32 || code === 10 || code === 13 || code === 9) ? char : ' '; }).join(''); }
function laneLabel(lane: QueueLane) { if (lane === 'ready_to_create') return 'Ready to create'; if (lane === 'link_duplicate_review') return 'Link / duplicate review'; if (lane === 'needs_correction') return 'Needs correction'; return 'Reference only'; }

function queueLane(item: IntakeQueueItem): QueueLane {
  if (item.readiness === 'reference_likely') return 'reference_only';
  if (item.readiness === 'needs_link_decision') return 'link_duplicate_review';
  if (item.readiness === 'ready_to_approve') return 'ready_to_create';
  return 'needs_correction';
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeBatchIds = useMemo(() => new Set(intakeBatches.filter((batch) => batch.status !== 'archived').map((batch) => batch.id)), [intakeBatches]);
  const pendingCandidates = useMemo(() => intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending' && activeBatchIds.has(entry.batchId)), [intakeWorkCandidates, activeBatchIds]);
  const queue = useMemo(() => buildIntakeReviewQueue(pendingCandidates, intakeAssets, intakeBatches, undefined, intakeReviewerFeedback), [pendingCandidates, intakeAssets, intakeBatches, intakeReviewerFeedback]);
  const byLane = useMemo(() => {
    const out: Record<QueueLane, IntakeWorkCandidate[]> = { ready_to_create: [], needs_correction: [], link_duplicate_review: [], reference_only: [] };
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

  const selectedCandidate = pendingCandidates.find((entry) => entry.id === selectedCandidateId) ?? null;
  const selectedAsset = selectedCandidate ? intakeAssets.find((entry) => entry.id === selectedCandidate.assetId) ?? null : null;
  const safety = selectedCandidate ? evaluateIntakeImportSafety(selectedCandidate) : null;
  const selectedFieldSummary = useMemo(() => selectedCandidate ? summarizeFieldReviews(buildWorkCandidateFieldReviews(selectedCandidate)) : null, [selectedCandidate]);
  const selectedMatch = selectedCandidate?.existingRecordMatches.find((m) => m.id === selectedMatchId) ?? selectedCandidate?.existingRecordMatches[0] ?? null;

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    const all = Array.from(list);
    const blocked = all.filter((file) => getIntakeFileCapability(file.name).state === 'blocked');
    const allowed = all.filter((file) => getIntakeFileCapability(file.name).state !== 'blocked');
    if (blocked.length) {
      const reason = blocked.slice(0, 2).map((file) => `${file.name}: ${getIntakeFileCapability(file.name).reason || 'Unsupported'}`).join(' · ');
      setFeedback({ tone: 'error', message: `Rejected ${blocked.length} unsupported file(s). ${reason}` });
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
    if (decision === 'link') {
      if (!selectedMatch) return setFeedback({ tone: 'error', message: 'Select a matching record first.' });
      decideIntakeWorkCandidate(selectedCandidate.id, 'link', selectedMatch.id);
      return setFeedback({ tone: 'success', message: `Linked to ${selectedMatch.recordType} ${selectedMatch.id} with intake provenance and context note.` });
    }
    const unsafe = safety && !safety.safeToCreateNew && (decision === 'approve_followup' || decision === 'approve_task');
    if (unsafe && !confirmUnsafeCreate) {
      setFeedback({ tone: 'info', message: 'Duplicate-risk override requires confirmation. Check override then retry create.' });
      return;
    }
    decideIntakeWorkCandidate(selectedCandidate.id, decision === 'approve_followup' ? 'approve_followup' : decision === 'approve_task' ? 'approve_task' : decision, undefined, { overrideUnsafeCreate: unsafe && confirmUnsafeCreate });
    setConfirmUnsafeCreate(false);
  };

  const activeBatches = intakeBatches.filter((batch) => batch.status !== 'archived');
  const archivedBatches = intakeBatches.filter((batch) => batch.status === 'archived');

  const duplicateGroup = selectedCandidate?.suspectedDuplicateGroupId
    ? pendingCandidates.filter((candidate) => candidate.suspectedDuplicateGroupId === selectedCandidate.suspectedDuplicateGroupId)
    : [];

  return (
    <div className="intake-workspace-shell">
      <section className="intake-support-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Universal Intake Workspace</div>
            <h2 className="text-xl font-semibold text-slate-900">Import or paste source → review evidence → create trusted work</h2>
            <p className="mt-1 text-sm text-slate-600">{describeIntakeFileSupport()}</p>
          </div>
        </div>
      </section>

      <section className={`intake-support-panel border-2 border-dashed transition ${dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void onFiles(event.dataTransfer.files, 'drop'); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><Upload className="h-4 w-4" />Drop intake sources</div>
            <div className="text-sm text-slate-600">Unsupported formats (.msg/.doc) are rejected with guidance.</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Select files</button>
            {loading ? <div className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700"><Loader2 className="h-4 w-4 animate-spin" />Extracting...</div> : null}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={getIntakeFileInputAccept()} className="hidden" onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </section>

      <section className="intake-support-panel">
        <div className="mb-1 text-sm font-semibold text-slate-900">Quick paste intake</div>
        <p className="mb-2 text-xs text-slate-600">Paste meeting notes, copied email, or issue snippets. This runs through the same review pipeline.</p>
        <div className="mb-2"><input className="field-input" value={manualTitleHint} onChange={(event) => setManualTitleHint(event.target.value)} placeholder="Optional source/title hint (e.g., OAC meeting notes)" /></div>
        <textarea className="field-textarea min-h-[88px]" value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Paste notes/email text here..." />
        <div className="mt-2"><button className="action-btn" disabled={pasteLoading} onClick={async () => {
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
        }}>{pasteLoading ? 'Ingesting...' : 'Create intake candidate from pasted text'}</button></div>
      </section>

      {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{feedback.message}</div> : null}

      <section className="intake-support-panel">
        <div className="mb-2 text-sm font-semibold text-slate-900">Batch/session lifecycle</div>
        <div className="space-y-2">
          {activeBatches.slice(0, 8).map((batch) => {
            const batchAssets = intakeAssets.filter((asset) => asset.batchId === batch.id && !asset.parentAssetId);
            const batchCandidates = intakeWorkCandidates.filter((candidate) => candidate.batchId === batch.id);
            const failures = batchAssets.filter((asset) => asset.parseStatus === 'failed');
            return <div key={batch.id} className="rounded-lg border border-slate-200 p-2 text-xs">
              <div className="font-semibold text-slate-900">{batch.id} • {batch.createdAt}</div>
              <div className="text-slate-600">Files {batch.stats.filesProcessed} • Candidates {batch.stats.candidatesCreated} • Pending {batch.stats.activeCandidates ?? batchCandidates.filter((entry) => entry.approvalStatus === 'pending').length} • Finalized {batch.stats.finalizedCandidates ?? batchCandidates.filter((entry) => entry.approvalStatus !== 'pending').length} • Failures {batch.stats.failedParses} • Status {batch.status}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button className="action-btn !px-2 !py-1 text-xs" onClick={() => clearFinalizedIntakeCandidates(batch.id)}>Clear finalized candidates</button>
                <button className="action-btn !px-2 !py-1 text-xs" onClick={() => archiveIntakeBatch(batch.id)}>Archive batch</button>
                <button className="action-btn !px-2 !py-1 text-xs" onClick={() => deleteIntakeBatchIfEmpty(batch.id)}>Delete if empty</button>
              </div>
              {failures.map((asset) => <div key={asset.id} className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1">{asset.fileName}: {asset.errors[0] || asset.warnings[0]}
                <div className="mt-1 flex gap-1">{asset.retrySource ? <button className="action-btn !px-2 !py-0.5 text-[11px]" onClick={async () => { await retryIntakeAssetParse(asset.id); const next = useAppStore.getState().intakeAssets.find((entry) => entry.id === asset.id); setFeedback({ tone: next?.lastRetryStatus === 'success' ? 'success' : 'error', message: next?.lastRetryMessage || 'Retry completed.' }); }}>Retry parse</button> : <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Retry unavailable: {asset.retryUnavailableReason || 'Legacy asset without cached upload bytes.'}</span>}<button className="action-btn !px-2 !py-0.5 text-[11px]" onClick={() => removeIntakeAsset(asset.id)}>Remove failed asset</button></div>
              </div>)}
            </div>;
          })}
          {!activeBatches.length ? <div className="text-xs text-slate-500">No active batches.</div> : null}
          {archivedBatches.length ? <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">Archived history: {archivedBatches.map((batch) => `${batch.id} (${batch.stats.candidatesCreated} candidates)`).slice(0, 4).join(' · ')}</div> : null}
        </div>
      </section>

      <section className="intake-core-grid">
        <div className="intake-lane-panel">
          <div className="mb-2 text-sm font-semibold text-slate-900">Review queue</div>
          <div className="mb-2 intake-lane-tabs">{(['ready_to_create', 'needs_correction', 'link_duplicate_review', 'reference_only'] as QueueLane[]).map((lane) => <button key={lane} className={`action-btn intake-lane-tab !px-2 !py-1 text-xs ${activeLane === lane ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setActiveLane(lane)}>{laneLabel(lane)} • {byLane[lane].length}</button>)}</div>
          <div className="space-y-2 max-h-[560px] overflow-auto">{visibleCandidates.map((candidate) => <button key={candidate.id} className={`w-full rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => { setSelectedCandidateId(candidate.id); setSelectedMatchId(null); }}>
            <div className="text-sm font-semibold text-slate-900 line-clamp-2">{candidate.title || 'Untitled candidate'}</div>
            <div className="mt-1 text-xs text-slate-600">{candidateTypeLabel(candidate.candidateType)} • {Math.round(candidate.confidence * 100)}%</div>
            {candidate.suspectedDuplicateGroupId ? <div className="mt-1 text-[11px] text-amber-700">Suspected within-batch duplicate group</div> : null}
          </button>)}{!visibleCandidates.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No records in this queue.</div> : null}</div>
        </div>

        <div className="intake-workbench-panel">
          <div className="mb-2 text-sm font-semibold text-slate-900">Reviewer workbench</div>
          {selectedCandidate ? <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="field-block md:col-span-2"><span className="field-label">Title (required)</span><input className="field-input" value={selectedCandidate.title} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { title: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Type</span><select className="field-input" value={selectedCandidate.candidateType} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { candidateType: event.target.value as IntakeWorkCandidate['candidateType'] })}><option value="followup">Follow-up</option><option value="task">Task</option><option value="reference">Reference</option><option value="update_existing_followup">Update follow-up</option><option value="update_existing_task">Update task</option></select></label>
              <label className="field-block"><span className="field-label">Priority</span><select className="field-input" value={selectedCandidate.priority} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { priority: event.target.value as IntakeWorkCandidate['priority'] })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
              <label className="field-block"><span className="field-label">Project (required)</span><input className="field-input" value={selectedCandidate.project || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { project: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={selectedCandidate.owner || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { owner: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Assignee</span><input className="field-input" value={selectedCandidate.assignee || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { assignee: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Due date</span><input type="date" className="field-input" value={toDateInputValue(selectedCandidate.dueDate)} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { dueDate: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Waiting on</span><input className="field-input" value={selectedCandidate.waitingOn || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { waitingOn: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Next step</span><input className="field-input" value={selectedCandidate.nextStep || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { nextStep: event.target.value })} /></label>
              <label className="field-block md:col-span-2"><span className="field-label">Summary</span><textarea className="field-textarea" value={selectedCandidate.summary} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { summary: event.target.value })} /></label>
            </div>

            {selectedFieldSummary ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><div className="font-semibold">Field confidence / review pressure</div><div>Weak+missing+conflict: {selectedFieldSummary.weak.length + selectedFieldSummary.missing.length + selectedFieldSummary.conflicting.length}</div>{!selectedCandidate.title || !selectedCandidate.project ? <div className="mt-1 text-rose-700">Review required: missing critical title/project.</div> : null}</div> : null}

            {safety && (safety.requiresLinkReview || selectedCandidate.existingRecordMatches.length > 0) ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
              <div className="mb-1 font-semibold">Link / duplicate review</div>
              <div className="space-y-1">{selectedCandidate.existingRecordMatches.map((match) => <button key={match.id} className={`w-full rounded border px-2 py-1 text-left ${selectedMatch?.id === match.id ? 'border-sky-300 bg-white' : 'border-amber-200 bg-amber-100/30'}`} onClick={() => setSelectedMatchId(match.id)}>{match.recordType} • {match.title} • {match.project} • {Math.round(match.score * 100)}%<div className="text-[11px]">{match.reason}</div></button>)}</div>
              {selectedMatch ? <div className="mt-2 rounded border border-slate-200 bg-white p-2">Compare: <strong>{selectedCandidate.title}</strong> ↔ <strong>{selectedMatch.title}</strong> ({selectedMatch.project})</div> : null}
            </div> : null}
            {duplicateGroup.length > 1 ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
              <div className="mb-1 font-semibold">Within-batch suspected duplicates ({duplicateGroup.length})</div>
              <div className="space-y-1">{duplicateGroup.map((entry) => <button key={entry.id} className={`w-full rounded border px-2 py-1 text-left ${entry.id === selectedCandidate.id ? 'border-sky-300 bg-white' : 'border-amber-200 bg-amber-100/30'}`} onClick={() => setSelectedCandidateId(entry.id)}>{entry.title} • {entry.project || 'No project'} • due {entry.dueDate || '—'}</button>)}</div>
            </div> : null}

            <div className="flex flex-wrap gap-2">
              <button className="action-btn" onClick={() => handleDecision('link')}><Link2 className="h-4 w-4" />Link existing</button>
              <button className={`primary-btn ${safety?.duplicateRiskLevel === 'high' ? 'opacity-80' : ''}`} onClick={() => handleDecision('approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
              <button className="action-btn" onClick={() => handleDecision('approve_task')}><ClipboardCheck className="h-4 w-4" />Create task</button>
              <button className="action-btn" onClick={() => handleDecision('reference')}>Save reference</button>
              <button className="action-btn" onClick={() => handleDecision('reject')}>Dismiss</button>
            </div>
            {safety && !safety.safeToCreateNew ? <label className="flex items-center gap-2 text-xs text-rose-700"><input type="checkbox" checked={confirmUnsafeCreate} onChange={(event) => setConfirmUnsafeCreate(event.target.checked)} />Confirm override: create new despite duplicate risk.</label> : null}
          </div> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No record selected.</div>}
        </div>

        <div className="intake-source-panel">
          <div className="mb-2 text-sm font-semibold text-slate-900">Source evidence</div>
          <div className="mb-2 flex gap-1.5">{(['overview', 'preview', 'evidence', 'metadata'] as SourceTab[]).map((tab) => <button key={tab} className={`action-btn !px-2 !py-1 text-xs ${selectedSourceTab === tab ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSourceTab(tab)}>{tab}</button>)}</div>
          {selectedAsset ? <div className="space-y-2 text-xs">
            {selectedSourceTab === 'overview' ? <>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2"><div className="font-semibold text-slate-800">{selectedAsset.fileName}</div><div className="text-slate-600">{prettyFileSize(selectedAsset.sizeBytes)} • {selectedAsset.kind}</div></div>
              {selectedCandidate?.dateSignals ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">Source date: {selectedCandidate.dateSignals.sourceDate || selectedCandidate.dateSignals.dueDateRaw || '—'}<br />Due: {selectedCandidate.dateSignals.dueDate || selectedCandidate.dateSignals.dueDateRaw || '—'}<br />Promised: {selectedCandidate.dateSignals.promisedDate || selectedCandidate.dateSignals.promisedDateRaw || '—'}<br />Next touch: {selectedCandidate.dateSignals.nextTouchDate || selectedCandidate.dateSignals.nextTouchDateRaw || '—'}</div> : null}
            </> : null}
            {selectedSourceTab === 'preview' ? <div className="space-y-1.5 max-h-[420px] overflow-auto">{(selectedAsset.extractionChunks?.length ? selectedAsset.extractionChunks : [{ id: 'fallback', sourceRef: selectedAsset.fileName, kind: 'text', text: selectedAsset.extractedPreview || selectedAsset.extractedText.slice(0, 2000) }]).map((chunk) => <div key={chunk.id} className={`rounded border p-2 whitespace-pre-wrap ${selectedEvidenceLocator && (chunk.locator === selectedEvidenceLocator || chunk.sourceRef === selectedEvidenceLocator) ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}><div className="text-[11px] uppercase tracking-wide text-slate-500">{chunk.kind} • {chunk.locator || chunk.sourceRef}</div>{chunk.sheetName ? <div className="mb-1 text-[11px] text-slate-600">Sheet: {chunk.sheetName} • Row {chunk.rowNumber || '—'}</div> : null}<div>{chunk.text}</div>{chunk.rowContext?.length ? <div className="mt-1 border-t border-slate-200 pt-1 text-[11px] text-slate-600">Nearby rows: {chunk.rowContext.join(' || ')}</div> : null}</div>)}</div> : null}
            {selectedSourceTab === 'evidence' ? <div className="space-y-1.5">{(selectedCandidate?.evidence || []).map((entry) => <button key={entry.id} className="w-full rounded border border-slate-200 bg-slate-50 p-2 text-left" onClick={() => setSelectedEvidenceLocator(entry.locator || entry.sourceRef)}><div className="text-[11px] uppercase tracking-wide text-slate-500">{entry.field} • {entry.locator || entry.sourceRef}</div><div>{sanitizeSnippet(entry.snippet).slice(0, 220)}</div>{entry.locator?.includes('#row') ? <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><FileSpreadsheet className="h-3 w-3" />{entry.locator}</div> : null}</button>)}</div> : null}
            {selectedSourceTab === 'metadata' ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">{Object.entries(selectedAsset.metadata).map(([key, value]) => <div key={key}><strong>{key}:</strong> {String(value)}</div>)}</div> : null}
          </div> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select a record to inspect source preview/evidence.</div>}
        </div>
      </section>

      <section className="intake-support-panel text-xs text-slate-600">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><CheckCircle2 className="h-3.5 w-3.5" />Batches: {intakeBatches.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><Info className="h-3.5 w-3.5" />Pending records: {pendingCandidates.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><TriangleAlert className="h-3.5 w-3.5" />Needs correction: {byLane.needs_correction.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><XCircle className="h-3.5 w-3.5" />Link review: {byLane.link_duplicate_review.length}</span>
        </div>
      </section>
    </div>
  );
}
