import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, FileUp, Link2, Loader2, Paperclip, Save, XCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './Badge';
import { getAllowedIntakeActions, getIntakeLifecycleLabel, normalizeAssetStatus, normalizeWorkCandidateStatus } from '../lib/intakeLifecycle';
import type { IntakeLifecycleStatus } from '../lib/intakeLifecycle';
import type { IntakeWorkCandidate } from '../types';
import { buildWorkCandidateFieldReviews, describeMatch, summarizeFieldReviews } from '../lib/intakeEvidence';
import { FieldReviewRow, WeakFieldWarningGroup } from './intake/FieldReview';
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

const parseStatusTone: Record<IntakeLifecycleStatus, 'neutral' | 'warn' | 'success' | 'danger' | 'blue'> = {
  received: 'neutral',
  parsing: 'blue',
  parsed: 'success',
  review_needed: 'warn',
  ready_high_confidence: 'success',
  imported: 'success',
  linked: 'blue',
  reference: 'neutral',
  rejected: 'danger',
  failed: 'danger',
};

const bucketLabels: Record<IntakeReviewBucket, string> = {
  ready_to_approve: 'Ready to approve',
  needs_correction: 'Needs correction',
  link_duplicate_review: 'Link / duplicate review',
  reference_likely: 'Reference likely',
  finalized_history: 'Rejected / finalized history',
};

export function UniversalIntakeWorkspace() {
  const {
    intakeBatches,
    intakeAssets,
    intakeWorkCandidates,
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
    items: s.items,
    tasks: s.tasks,
    ingestIntakeFiles: s.ingestIntakeFiles,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
    batchApproveHighConfidence: s.batchApproveHighConfidence,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(intakeAssets[0]?.id ?? null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<IntakeReviewBucket | 'all'>('all');
  const [sortKey, setSortKey] = useState<IntakeReviewSort>('newest');
  const [queueFilters, setQueueFilters] = useState<IntakeQueueFilters>({ pendingState: 'pending', confidenceTier: 'any' });
  const [guardedApproval, setGuardedApproval] = useState<{ candidateId: string; decision: 'approve_task' | 'approve_followup' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queue = useMemo(() => buildIntakeReviewQueue(intakeWorkCandidates, intakeAssets), [intakeWorkCandidates, intakeAssets]);
  const metrics = useMemo(() => buildQueueMetrics(queue), [queue]);
  const bucketCounts = useMemo(() => buildQueueBucketCounts(queue), [queue]);
  const filteredQueue = useMemo(() => {
    const base = filterReviewQueue(queue, queueFilters);
    const bucketed = activeBucket === 'all' ? base : base.filter((item) => item.bucket === activeBucket);
    return sortReviewQueue(bucketed, sortKey);
  }, [queue, queueFilters, activeBucket, sortKey]);

  const pendingQueueIds = useMemo(() => filteredQueue.filter((entry) => entry.status === 'pending').map((entry) => entry.id), [filteredQueue]);
  const selectedAsset = intakeAssets.find((entry) => entry.id === activeAssetId) ?? intakeAssets[0];
  const selectedCandidate = intakeWorkCandidates.find((entry) => entry.id === activeCandidateId && pendingQueueIds.includes(entry.id))
    ?? intakeWorkCandidates.find((entry) => entry.id === pendingQueueIds[0])
    ?? null;
  const selectedCandidateFieldSummary = useMemo(() => selectedCandidate
    ? summarizeFieldReviews(buildWorkCandidateFieldReviews(selectedCandidate))
    : null, [selectedCandidate]);
  const childAssets = selectedAsset ? intakeAssets.filter((entry) => entry.parentAssetId === selectedAsset.id) : [];

  const byStatus = useMemo(() => ({
    parsed: intakeAssets.filter((asset) => asset.parseStatus === 'parsed').length,
    review: intakeAssets.filter((asset) => asset.parseStatus === 'review_needed').length,
    failed: intakeAssets.filter((asset) => asset.parseStatus === 'failed').length,
  }), [intakeAssets]);

  const applyAndNext = useCallback((candidate: IntakeWorkCandidate, decision: Parameters<typeof decideIntakeWorkCandidate>[1], linkedRecordId?: string, options?: { overrideUnsafeCreate?: boolean }) => {
    const currentIds = pendingQueueIds;
    const idx = currentIds.indexOf(candidate.id);
    const nextId = idx >= 0 ? currentIds[idx + 1] ?? currentIds[idx - 1] ?? null : currentIds[0] ?? null;
    decideIntakeWorkCandidate(candidate.id, decision, linkedRecordId, options);
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

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setLoading(true);
    await ingestIntakeFiles(Array.from(list), source);
    setLoading(false);
    const firstNew = useAppStore.getState().intakeAssets[0]?.id;
    if (firstNew) setActiveAssetId(firstNew);
  };

  useEffect(() => {
    if (!selectedCandidate && pendingQueueIds[0]) setActiveCandidateId(pendingQueueIds[0]);
  }, [pendingQueueIds, selectedCandidate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedCandidate) return;
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
  }, [pendingQueueIds, selectedCandidate, applyAndNext, requestCreateApproval]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-5 transition ${dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void onFiles(event.dataTransfer.files, 'drop');
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Universal Intake Workspace</div>
            <div className="text-sm text-slate-600">Reviewer queue cockpit: triage by bucket, filter by risk, and move decision-to-decision with review-next flow.</div>
          </div>
          <div className="flex gap-2">
            <button className="action-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Choose files</button>
            <button className="action-btn" onClick={batchApproveHighConfidence} disabled={metrics.batchSafeCount === 0}>Batch approve batch-safe ({metrics.batchSafeCount})</button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Pending</div><div className="text-xl font-semibold text-amber-700">{metrics.pendingCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Batch-safe</div><div className="text-xl font-semibold text-emerald-700">{metrics.batchSafeCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Link / duplicate review</div><div className="text-xl font-semibold text-rose-700">{metrics.duplicateReviewCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Weak/conflicting</div><div className="text-xl font-semibold text-amber-700">{metrics.weakOrConflictingCount}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Finalized</div><div className="text-xl font-semibold text-slate-900">{metrics.finalizedCount}</div></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Batch assets</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
          <div className="mb-2 text-xs text-slate-500">Batches: {intakeBatches.length} • Assets: {intakeAssets.length}</div>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <Badge variant="success">Parsed {byStatus.parsed}</Badge>
            <Badge variant="warn">Review {byStatus.review}</Badge>
            <Badge variant="danger">Failed {byStatus.failed}</Badge>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {intakeAssets.map((asset) => (
              <button key={asset.id} className={`w-full rounded-xl border p-2 text-left ${selectedAsset?.id === asset.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`} onClick={() => setActiveAssetId(asset.id)}>
                <div className="truncate text-sm font-medium text-slate-900">{asset.fileName}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{asset.kind}</span>
                  <Badge variant={parseStatusTone[normalizeAssetStatus(asset.parseStatus)]}>{getIntakeLifecycleLabel(normalizeAssetStatus(asset.parseStatus))}</Badge>
                </div>
              </button>
            ))}
            {intakeAssets.length === 0 ? <div className="text-xs text-slate-500">No assets ingested yet.</div> : null}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Source inspector</div>
          {!selectedAsset ? <div className="text-sm text-slate-500">Select an asset to inspect metadata, extracted text, and evidence.</div> : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <div><span className="font-semibold text-slate-900">File:</span> {selectedAsset.fileName}</div>
                <div><span className="font-semibold text-slate-900">Type:</span> {selectedAsset.fileType} • {Math.round(selectedAsset.sizeBytes / 1024)} KB</div>
                <div><span className="font-semibold text-slate-900">Parse quality:</span> {selectedAsset.parseQuality} ({selectedAsset.extractionConfidence ?? 'n/a'})</div>
                <div><span className="font-semibold text-slate-900">Source refs:</span> {selectedAsset.sourceRefs.slice(0, 4).join(', ') || 'n/a'}</div>
                <div><span className="font-semibold text-slate-900">Stages:</span> {selectedAsset.parserStages?.join(' → ') || 'n/a'}</div>
              </div>
              {childAssets.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                  <div className="mb-1 font-semibold text-slate-900">Attachments / child assets ({childAssets.length})</div>
                  <div className="space-y-1">
                    {childAssets.map((child) => (
                      <button key={child.id} className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-left hover:border-sky-300" onClick={() => setActiveAssetId(child.id)}>
                        {child.fileName} <span className="text-slate-500">({child.kind}, {child.parseStatus})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedAsset.warnings.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{selectedAsset.warnings.join(' • ')}</div> : null}
              {selectedAsset.errors.length > 0 ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{selectedAsset.errors.join(' • ')}</div> : null}
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted content preview</div>
                <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">{selectedAsset.extractedText || '(no extracted text)'}</pre>
              </div>
            </div>
          )}
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Intake review queue</div>
          <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(bucketLabels) as IntakeReviewBucket[]).map((bucket) => (
              <button key={bucket} className={`rounded-full border px-2 py-1 ${activeBucket === bucket ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket(bucket)}>
                {bucketLabels[bucket]} ({bucketCounts[bucket]})
              </button>
            ))}
            <button className={`rounded-full border px-2 py-1 ${activeBucket === 'all' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket('all')}>All</button>
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-2 text-xs">
            <select className="field-input" value={queueFilters.confidenceTier ?? 'any'} onChange={(e) => setQueueFilters((f) => ({ ...f, confidenceTier: e.target.value as IntakeQueueFilters['confidenceTier'] }))}>
              <option value="any">Any confidence</option><option value="high">High confidence</option><option value="medium">Medium confidence</option><option value="low">Low confidence</option>
            </select>
            <select className="field-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as IntakeReviewSort)}>
              <option value="newest">Newest first</option><option value="highest_confidence">Highest confidence first</option><option value="lowest_confidence">Weakest confidence first</option><option value="most_missing_fields">Most missing fields</option><option value="duplicate_risk_first">Duplicate risk first</option>
            </select>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.batchSafeOnly ?? false} onChange={(e) => setQueueFilters((f) => ({ ...f, batchSafeOnly: e.target.checked }))} />Batch-safe only</label>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.duplicateRisk === 'only'} onChange={(e) => setQueueFilters((f) => ({ ...f, duplicateRisk: e.target.checked ? 'only' : 'all' }))} />Duplicate risk only</label>
          </div>

          <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
            {filteredQueue.filter((entry) => entry.status === 'pending').map((queueEntry) => {
              const candidate = intakeWorkCandidates.find((entry) => entry.id === queueEntry.id);
              if (!candidate) return null;
              const candidateFieldSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(candidate));
              const safety = evaluateIntakeImportSafety(candidate);
              const isGuarded = guardedApproval?.candidateId === candidate.id;
              const isPriorityField = (key: 'title' | 'project') => candidateFieldSummary.weak.some((field) => field.key === key)
                || candidateFieldSummary.missing.some((field) => field.key === key)
                || candidateFieldSummary.conflicting.some((field) => field.key === key);
              return (
                <article key={candidate.id} className={`rounded-xl border p-2 ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`} onClick={() => setActiveCandidateId(candidate.id)}>
                  <div className="text-sm font-medium text-slate-900">{candidate.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    <Badge variant="blue">{bucketLabels[queueEntry.bucket]}</Badge>
                    <Badge variant={queueEntry.batchSafe ? 'success' : 'warn'}>{queueEntry.batchSafe ? 'Safe to batch import' : 'Manual safety review'}</Badge>
                    <Badge variant={candidate.confidence >= 0.9 ? 'success' : candidate.confidence >= 0.7 ? 'warn' : 'danger'}>{candidate.confidence}</Badge>
                    <Badge variant={safety.duplicateRiskLevel === 'high' ? 'danger' : safety.duplicateRiskLevel === 'medium' ? 'warn' : 'success'}>
                      {safety.duplicateRiskLevel === 'high' ? 'Likely duplicate' : safety.duplicateRiskLevel === 'medium' ? 'Likely update' : 'Safe new record'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    {queueEntry.alerts.slice(0, 4).map((alert) => <Badge key={alert.code} variant={alert.tone}>{alert.label}</Badge>)}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{candidate.summary.slice(0, 140)}</div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <input className={`field-input ${isPriorityField('title') ? 'intake-field-input-priority' : ''}`} value={candidate.title} onChange={(event) => updateIntakeWorkCandidate(candidate.id, { title: event.target.value })} />
                    <input className={`field-input ${isPriorityField('project') ? 'intake-field-input-priority' : ''}`} value={candidate.project || ''} placeholder="Project" onChange={(event) => updateIntakeWorkCandidate(candidate.id, { project: event.target.value })} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button className="action-btn" onClick={() => requestCreateApproval(candidate, 'approve_task')}><CheckCircle2 className="h-4 w-4" /> Approve as task</button>
                    <button className="action-btn" onClick={() => requestCreateApproval(candidate, 'approve_followup')}><Paperclip className="h-4 w-4" /> Approve as follow-up</button>
                    <button className="action-btn" onClick={() => applyAndNext(candidate, 'reference')}><Save className="h-4 w-4" /> Save as reference</button>
                    <button className="action-btn action-btn-danger" onClick={() => applyAndNext(candidate, 'reject')}><XCircle className="h-4 w-4" /> Reject</button>
                  </div>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="font-semibold text-slate-700">Safe import checks</div>
                    <div className="mt-1 grid gap-1">
                      {safety.checklist.slice(0, 4).map((item) => <div key={item.key} className={item.pass ? 'text-emerald-700' : 'text-rose-700'}>{item.pass ? '✓' : '•'} {item.label}</div>)}
                    </div>
                    {safety.blockers[0] ? <div className="mt-1 text-rose-700">{safety.blockers[0]}</div> : <div className="mt-1 text-emerald-700">Safe to create new.</div>}
                  </div>
                  {isGuarded ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs">
                      <div className="font-semibold text-rose-700">Override required before creating new work</div>
                      <div className="mt-1 text-rose-700">{[...safety.blockers, ...safety.warnings].slice(0, 2).join(' ') || 'Review link/reference/reject alternatives first.'}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {candidate.existingRecordMatches[0] ? <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(candidate, 'link', candidate.existingRecordMatches[0].id); }}><Link2 className="h-3 w-3" /> Link best match</button> : null}
                        <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(candidate, 'reference'); }}>Save reference</button>
                        <button className="action-btn" onClick={() => { setGuardedApproval(null); applyAndNext(candidate, 'reject'); }}>Reject</button>
                        <button className="action-btn action-btn-danger" onClick={() => { setGuardedApproval(null); applyAndNext(candidate, guardedApproval.decision, undefined, { overrideUnsafeCreate: true }); }}>Override and create anyway</button>
                      </div>
                    </div>
                  ) : null}
                  {candidate.existingRecordMatches.length > 0 ? (
                    <div className={`mt-2 rounded-lg border p-2 text-xs ${safety.strongMatches.length ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="font-semibold text-slate-700">{safety.strongMatches.length ? 'Likely duplicate / update matches' : 'Existing matches'}</div>
                      {candidate.existingRecordMatches.slice(0, 2).map((match) => (
                        <div key={match.id} className="mt-1 flex items-center justify-between gap-2">
                          <div className="truncate text-slate-600">{match.recordType}: {match.title} ({match.score}{match.strategy ? `, ${match.strategy}` : ''}) • {describeMatch(match)}</div>
                          <button className="action-btn" onClick={() => applyAndNext(candidate, 'link', match.id)}><Link2 className="h-3 w-3" /> Link existing</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {pendingQueueIds.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No pending candidates in this queue view.</div> : null}
          </div>

          {filteredQueue.filter((entry) => entry.status === 'finalized').length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Finalized outcomes</div>
              <div className="space-y-1">
                {filteredQueue.filter((entry) => entry.status === 'finalized').slice(0, 5).map((queueEntry) => {
                  const candidate = intakeWorkCandidates.find((entry) => entry.id === queueEntry.id);
                  if (!candidate) return null;
                  const status = normalizeWorkCandidateStatus(candidate.approvalStatus);
                  return (
                    <div key={candidate.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                      <span className="truncate text-slate-700">{candidate.title}</span>
                      <Badge variant={parseStatusTone[status]}>{describeFinalizedOutcome(candidate)}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Linked records available: {items.length} follow-ups • {tasks.length} tasks.
            <div className="mt-1 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> Batch-safe excludes weak/conflicting fields and duplicate-risk candidates.</div>
            <div className="mt-1">Keyboard flow: [A] approve follow-up, [T] approve task, [S] save reference, [R] reject, [L] link top match, [N] next.</div>
            <div className="mt-1">Pending review candidates allow: {getAllowedIntakeActions('review_needed').length} decisions.</div>
          </div>
          {selectedCandidate && selectedCandidateFieldSummary ? (
            <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review this parse</div>
              <WeakFieldWarningGroup fields={[...selectedCandidateFieldSummary.weak, ...selectedCandidateFieldSummary.missing, ...selectedCandidateFieldSummary.conflicting]} />
              <div className="space-y-2">
                {selectedCandidateFieldSummary.priorityReviewFields.map((field) => (
                  <FieldReviewRow key={field.key} field={field} onEdit={() => setActiveCandidateId(selectedCandidate.id)} />
                ))}
              </div>
              {selectedCandidate.existingRecordMatches.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  <div className="font-semibold text-slate-700">Match explainability</div>
                  {selectedCandidate.existingRecordMatches.slice(0, 2).map((match) => (
                    <div key={match.id} className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{describeMatch(match)}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
