import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileUp,
  Info,
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
import { buildIntakeReviewQueue, type IntakeQueueItem } from '../lib/intakeReviewQueue';
import { useAppStore } from '../store/useAppStore';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../types';

const supportedTypes = '.eml,.msg,.txt,.html,.htm,.doc,.docx,.pdf,.csv,.xls,.xlsx';
type Tone = 'success' | 'error' | 'info';
type QueueLane = 'ready_to_create' | 'needs_correction' | 'reference_only';

interface ActionFeedback {
  tone: Tone;
  message: string;
}

function prettyFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapAssetKindLabel(asset: IntakeAssetRecord) {
  switch (asset.kind) {
    case 'email': return 'Email';
    case 'document': return 'Word document';
    case 'spreadsheet': return 'Spreadsheet';
    case 'csv': return 'CSV';
    case 'pdf': return 'PDF';
    case 'html': return 'HTML';
    case 'text': return 'Text';
    default: return 'File';
  }
}

function parseStatusMeta(asset: IntakeAssetRecord) {
  if (asset.parseStatus === 'failed' || asset.errors.length) return { label: 'Parse failed', tone: 'error' as const, detail: asset.errors[0] || asset.warnings[0] || 'Could not extract readable content.' };
  if (asset.parseStatus === 'reading' || asset.parseStatus === 'queued') return { label: 'Uploaded', tone: 'info' as const, detail: 'Waiting to parse.' };
  if (asset.parseStatus === 'review_needed' || asset.parseQuality === 'weak') return { label: 'Review needed', tone: 'warn' as const, detail: asset.warnings[0] || 'Extraction succeeded but needs careful review.' };
  if (asset.warnings.length) return { label: 'Parsed with warnings', tone: 'warn' as const, detail: asset.warnings[0] };
  return { label: 'Parsed and ready', tone: 'good' as const, detail: 'Ready for review queue.' };
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.74) return 'Medium';
  return 'Needs correction';
}

function candidateTypeLabel(type: IntakeWorkCandidate['candidateType']) {
  if (type === 'followup') return 'Follow-up';
  if (type === 'task') return 'Task';
  if (type === 'update_existing_followup') return 'Update follow-up';
  if (type === 'update_existing_task') return 'Update task';
  return 'Reference';
}

function displaySheetName(raw: string) {
  if (!raw) return 'Sheet';
  const cleaned = raw.replace(/^\[[^\]]+\]\s*/, '').replace(/^email:/, 'Email ').trim();
  return cleaned.length > 32 ? `${cleaned.slice(0, 29)}...` : cleaned;
}

function getSheetKeyFromCandidate(candidate: IntakeWorkCandidate) {
  const rowEvidence = candidate.evidence.find((entry) => entry.locator?.includes('#row') || entry.sourceRef.includes('#row'));
  if (!rowEvidence) return null;
  const locator = rowEvidence.locator || rowEvidence.sourceRef;
  const [sheet] = locator.split('#row');
  return sheet || null;
}

function queueLane(item: IntakeQueueItem): QueueLane {
  if (item.readiness === 'reference_likely') return 'reference_only';
  if (item.readiness === 'ready_to_approve') return 'ready_to_create';
  return 'needs_correction';
}

function laneLabel(lane: QueueLane) {
  if (lane === 'ready_to_create') return 'Ready to create';
  if (lane === 'needs_correction') return 'Needs correction';
  return 'Reference only';
}

function sanitizeSnippet(value: string) {
  return value.split('').map((char) => {
    const code = char.charCodeAt(0);
    return (code >= 32 || code === 10 || code === 13 || code === 9) ? char : ' ';
  }).join('');
}

export function UniversalIntakeWorkspace() {
  const { intakeAssets, intakeWorkCandidates, intakeBatches, ingestIntakeFiles, updateIntakeWorkCandidate, decideIntakeWorkCandidate, intakeReviewerFeedback } = useAppStore(useShallow((s) => ({
    intakeAssets: s.intakeAssets,
    intakeWorkCandidates: s.intakeWorkCandidates,
    intakeBatches: s.intakeBatches,
    ingestIntakeFiles: s.ingestIntakeFiles,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [activeLane, setActiveLane] = useState<QueueLane>('needs_correction');
  const [showIssues, setShowIssues] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const rootAssets = useMemo(() => intakeAssets.filter((asset) => !asset.parentAssetId), [intakeAssets]);
  const pendingCandidates = useMemo(() => intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending'), [intakeWorkCandidates]);
  const queue = useMemo(() => buildIntakeReviewQueue(pendingCandidates, intakeAssets, undefined, intakeReviewerFeedback), [pendingCandidates, intakeAssets, intakeReviewerFeedback]);

  const pendingByLane = useMemo(() => {
    const byLane: Record<QueueLane, IntakeWorkCandidate[]> = { ready_to_create: [], needs_correction: [], reference_only: [] };
    pendingCandidates.forEach((candidate) => {
      const item = queue.find((entry) => entry.id === candidate.id);
      const lane = item ? queueLane(item) : 'needs_correction';
      byLane[lane].push(candidate);
    });
    return byLane;
  }, [pendingCandidates, queue]);

  const laneCounts = useMemo(() => ({
    ready_to_create: pendingByLane.ready_to_create.length,
    needs_correction: pendingByLane.needs_correction.length,
    reference_only: pendingByLane.reference_only.length,
  }), [pendingByLane]);

  const laneCandidates = pendingByLane[activeLane] ?? [];
  const sheetNames = useMemo(() => {
    const names = new Set<string>();
    laneCandidates.forEach((candidate) => {
      const sheet = getSheetKeyFromCandidate(candidate);
      if (sheet) names.add(sheet);
    });
    return Array.from(names);
  }, [laneCandidates]);

  const visibleCandidates = useMemo(() => {
    if (selectedSheet === 'all') return laneCandidates;
    return laneCandidates.filter((candidate) => getSheetKeyFromCandidate(candidate) === selectedSheet);
  }, [laneCandidates, selectedSheet]);

  useEffect(() => {
    if (!visibleCandidates.length) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !visibleCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(visibleCandidates[0].id);
    }
  }, [visibleCandidates, selectedCandidateId]);

  const selectedCandidate = pendingCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const selectedAsset = selectedCandidate ? intakeAssets.find((asset) => asset.id === selectedCandidate.assetId) ?? null : null;

  const selectedFieldSummary = useMemo(() => selectedCandidate ? summarizeFieldReviews(buildWorkCandidateFieldReviews(selectedCandidate)) : null, [selectedCandidate]);

  const sessionStats = useMemo(() => {
    const issues = rootAssets.filter((asset) => asset.parseStatus === 'failed' || asset.parseQuality === 'weak' || asset.warnings.length > 0);
    return {
      filesProcessed: rootAssets.length,
      candidatesExtracted: pendingCandidates.length,
      failures: rootAssets.filter((asset) => asset.parseStatus === 'failed').length,
      issues,
      pendingReview: laneCounts.needs_correction + laneCounts.ready_to_create,
    };
  }, [rootAssets, pendingCandidates.length, laneCounts]);

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setFeedback({ tone: 'info', message: `Uploading ${list.length} file${list.length === 1 ? '' : 's'} for extraction...` });
    setLoading(true);
    try {
      await ingestIntakeFiles(Array.from(list), source);
      setFeedback({ tone: 'success', message: 'Files parsed. Intake queue refreshed with extracted records.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: `Upload failed: ${error instanceof Error ? error.message : 'unexpected error'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = (candidate: IntakeWorkCandidate, decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject') => {
    const before = useAppStore.getState().intakeWorkCandidates.find((entry) => entry.id === candidate.id);
    decideIntakeWorkCandidate(candidate.id, decision);
    const after = useAppStore.getState().intakeWorkCandidates.find((entry) => entry.id === candidate.id);
    if (!after) return setFeedback({ tone: 'error', message: 'Action failed: candidate missing after action.' });
    if (before?.approvalStatus === after.approvalStatus) return setFeedback({ tone: 'error', message: after.warnings[0] || 'Action blocked. Resolve required corrections first.' });
    if (decision === 'approve_task') return setFeedback({ tone: 'success', message: `Task created${after.createdRecordId ? ` (ID ${after.createdRecordId})` : ''}.` });
    if (decision === 'approve_followup') return setFeedback({ tone: 'success', message: `Follow-up created${after.createdRecordId ? ` (ID ${after.createdRecordId})` : ''}.` });
    if (decision === 'reference') return setFeedback({ tone: 'success', message: 'Saved as reference.' });
    return setFeedback({ tone: 'info', message: 'Candidate dismissed from review queue.' });
  };

  const feedbackClass = feedback?.tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : feedback?.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Manual ingestion workbench</div>
            <h2 className="text-xl font-semibold text-slate-900">Import source → review extracted records → create trusted work</h2>
            <p className="mt-1 text-sm text-slate-600">Record-first queue: prioritize what is ready, correct uncertain fields, and create clean follow-ups/tasks.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-slate-500">Files this session</div><div className="font-semibold text-slate-900">{sessionStats.filesProcessed}</div></div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-slate-500">Extracted records</div><div className="font-semibold text-slate-900">{sessionStats.candidatesExtracted}</div></div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-slate-500">Pending review</div><div className="font-semibold text-slate-900">{sessionStats.pendingReview}</div></div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-slate-500">Parse failures</div><div className="font-semibold text-slate-900">{sessionStats.failures}</div></div>
          </div>
        </div>
      </section>

      <section
        className={`rounded-2xl border-2 border-dashed p-4 transition ${dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void onFiles(event.dataTransfer.files, 'drop'); }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><Upload className="h-4 w-4" />Drop intake sources</div>
            <div className="text-sm text-slate-600">Email (.eml/.msg), Word, spreadsheets, PDF, and CSV are parsed through extraction-quality pipelines.</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Select files</button>
            {loading ? <div className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700"><Loader2 className="h-4 w-4 animate-spin" />Extracting...</div> : null}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={supportedTypes} className="hidden" onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <button className="flex w-full items-center justify-between text-left" onClick={() => setShowIssues((value) => !value)}>
          <div className="text-sm font-semibold text-slate-900">Session issues ({sessionStats.issues.length})</div>
          <div className="text-xs text-slate-500">{showIssues ? 'Hide' : 'Show'}</div>
        </button>
        {showIssues ? (
          <div className="mt-2 space-y-2">
            {sessionStats.issues.slice(0, 8).map((asset) => {
              const status = parseStatusMeta(asset);
              return <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700"><div className="font-semibold text-slate-900">{asset.fileName}</div><div>{status.label} • {status.detail}</div></div>;
            })}
            {!sessionStats.issues.length ? <div className="text-xs text-slate-500">No active parse issues.</div> : null}
          </div>
        ) : null}
      </section>

      {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedbackClass}`}>{feedback.message}</div> : null}

      <section className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Review queue</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(['ready_to_create', 'needs_correction', 'reference_only'] as QueueLane[]).map((lane) => (
              <button key={lane} className={`action-btn !px-2 !py-1 text-xs ${activeLane === lane ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setActiveLane(lane)}>
                {laneLabel(lane)} ({laneCounts[lane]})
              </button>
            ))}
          </div>

          {sheetNames.length ? (
            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Workbook review</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === 'all' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet('all')}>All sheets</button>
                {sheetNames.map((sheet) => <button key={sheet} className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === sheet ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet(sheet)}><Sheet className="h-3.5 w-3.5" />{displaySheetName(sheet)}</button>)}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
            {visibleCandidates.map((candidate) => {
              const queueItem = queue.find((entry) => entry.id === candidate.id);
              return (
                <button key={candidate.id} className={`w-full rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedCandidateId(candidate.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">{candidate.title || 'Untitled candidate'}</div>
                      <div className="mt-1 text-xs text-slate-600">{candidateTypeLabel(candidate.candidateType)} • {confidenceLabel(candidate.confidence)}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">{Math.round(candidate.confidence * 100)}%</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 line-clamp-2">{candidate.summary || 'No summary extracted yet.'}</div>
                  {queueItem?.nextStepHint ? <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">{queueItem.nextStepHint}</div> : null}
                </button>
              );
            })}
            {!visibleCandidates.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No records in this review lane.</div> : null}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Correction workbench</div>
          {selectedCandidate ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Readiness</div>
                <div>{(queue.find((entry) => entry.id === selectedCandidate.id)?.readiness || 'ready_after_correction').replaceAll('_', ' ')}</div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="field-block md:col-span-2"><span className="field-label">Title</span><input className="field-input" value={selectedCandidate.title} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { title: event.target.value })} placeholder="Clear work title" /></label>
                <label className="field-block"><span className="field-label">Project</span><input className="field-input" value={selectedCandidate.project || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { project: event.target.value })} placeholder="Project / job / contract" /></label>
                <label className="field-block"><span className="field-label">Owner / responsible</span><input className="field-input" value={selectedCandidate.owner || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { owner: event.target.value })} placeholder="Responsible party" /></label>
                <label className="field-block"><span className="field-label">Due date</span><input type="date" className="field-input" value={selectedCandidate.dueDate || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { dueDate: event.target.value })} /></label>
                <label className="field-block"><span className="field-label">Next step</span><input className="field-input" value={selectedCandidate.nextStep || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { nextStep: event.target.value })} placeholder="Action-oriented next move" /></label>
                <label className="field-block md:col-span-2"><span className="field-label">Summary</span><textarea className="field-textarea" value={selectedCandidate.summary} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { summary: event.target.value })} placeholder="What needs to happen and why" /></label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                <div className="mb-1 font-semibold">Confidence by field</div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {['title', 'project', 'owner', 'dueDate'].map((field) => (
                    <div key={field} className="rounded border border-slate-200 bg-white px-2 py-1">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">{field}</div>
                      <div className="font-semibold text-slate-800">{Math.round((selectedCandidate.fieldConfidence?.[field] ?? selectedCandidate.confidence) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCandidate.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <div className="mb-1 inline-flex items-center gap-1 font-semibold"><AlertCircle className="h-3.5 w-3.5" />Actionable warnings</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {selectedCandidate.warnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button className="primary-btn" onClick={() => handleDecision(selectedCandidate, 'approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'approve_task')}><ClipboardCheck className="h-4 w-4" />Create task</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'reference')}>Save reference</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'reject')}>Dismiss</button>
              </div>
            </div>
          ) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No record selected. Choose a queue item to review and create a trusted record.</div>}
        </div>

        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Selected source context</div>
          {selectedAsset ? (
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold text-slate-800">{selectedAsset.fileName}</div>
                <div className="text-slate-600">{mapAssetKindLabel(selectedAsset)} • {prettyFileSize(selectedAsset.sizeBytes)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="mb-1 font-semibold text-slate-700">Parse state</div>
                <div>{parseStatusMeta(selectedAsset).label}</div>
                <div className="text-slate-600">{parseStatusMeta(selectedAsset).detail}</div>
              </div>
              {selectedFieldSummary ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1 font-semibold text-slate-700">Field review pressure</div>
                  <div className="text-slate-600">Strong: {selectedFieldSummary.strong.length} • Weak/missing/conflict: {selectedFieldSummary.weak.length + selectedFieldSummary.missing.length + selectedFieldSummary.conflicting.length}</div>
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="mb-1 font-semibold text-slate-700">Source support</div>
                <div className="space-y-1.5">
                  {(selectedCandidate?.evidence || []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="rounded border border-slate-200 bg-white p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{entry.field} • {entry.sourceRef}</div>
                      <div className="mt-1 text-xs text-slate-700">{sanitizeSnippet(entry.snippet).slice(0, 140)}</div>
                      {entry.locator?.includes('#row') ? <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><FileSpreadsheet className="h-3 w-3" />{entry.locator}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select a record to see source file, parse state, sheet/thread context, and evidence support.</div>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <div className="mb-1 text-sm font-semibold text-slate-900">Current intake session</div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><CheckCircle2 className="h-3.5 w-3.5" />Batches: {intakeBatches.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><Info className="h-3.5 w-3.5" />Pending records: {pendingCandidates.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><TriangleAlert className="h-3.5 w-3.5" />Issues: {sessionStats.issues.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"><XCircle className="h-3.5 w-3.5" />Failures: {sessionStats.failures}</span>
        </div>
      </section>
    </div>
  );
}
