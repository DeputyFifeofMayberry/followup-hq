import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, FileUp, Link2, Loader2, Paperclip, Save, XCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './Badge';
import { getAllowedIntakeActions, getIntakeLifecycleGroup, getIntakeLifecycleLabel, normalizeAssetStatus, normalizeWorkCandidateStatus } from '../lib/intakeLifecycle';
import type { IntakeLifecycleStatus } from '../lib/intakeLifecycle';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pending = intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending');
  const finalized = intakeWorkCandidates.filter((entry) => {
    const status = normalizeWorkCandidateStatus(entry.approvalStatus);
    return getIntakeLifecycleGroup(status) === 'finalized';
  });
  const highConfidence = pending.filter((entry) => entry.confidence >= 0.9);
  const selectedAsset = intakeAssets.find((entry) => entry.id === activeAssetId) ?? intakeAssets[0];
  const selectedAssetCandidates = intakeWorkCandidates.filter((entry) => entry.assetId === selectedAsset?.id);
  const selectedCandidate = pending.find((entry) => entry.id === activeCandidateId) ?? pending[0] ?? null;
  const needsReview = pending.filter((entry) => entry.confidence < 0.9);
  const childAssets = selectedAsset ? intakeAssets.filter((entry) => entry.parentAssetId === selectedAsset.id) : [];

  const byStatus = useMemo(() => ({
    parsed: intakeAssets.filter((asset) => asset.parseStatus === 'parsed').length,
    review: intakeAssets.filter((asset) => asset.parseStatus === 'review_needed').length,
    failed: intakeAssets.filter((asset) => asset.parseStatus === 'failed').length,
  }), [intakeAssets]);

  const applyAndNext = useCallback((decision: Parameters<typeof decideIntakeWorkCandidate>[1], linkedRecordId?: string) => {
    if (!selectedCandidate) return;
    decideIntakeWorkCandidate(selectedCandidate.id, decision, linkedRecordId);
    const next = useAppStore.getState().intakeWorkCandidates.find((entry) => entry.approvalStatus === 'pending');
    setActiveCandidateId(next?.id ?? null);
  }, [decideIntakeWorkCandidate, selectedCandidate]);

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setLoading(true);
    await ingestIntakeFiles(Array.from(list), source);
    setLoading(false);
    const firstNew = useAppStore.getState().intakeAssets[0]?.id;
    if (firstNew) setActiveAssetId(firstNew);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedCandidate) return;
      if (event.key === 'a') applyAndNext('approve_followup');
      if (event.key === 't') applyAndNext('approve_task');
      if (event.key === 'r') applyAndNext('reject');
      if (event.key === 'l' && selectedCandidate.existingRecordMatches[0]) applyAndNext('link', selectedCandidate.existingRecordMatches[0].id);
      if (event.key === 'n') {
        const idx = pending.findIndex((entry) => entry.id === selectedCandidate.id);
        setActiveCandidateId(pending[Math.min(pending.length - 1, Math.max(0, idx + 1))]?.id ?? null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, selectedCandidate, applyAndNext]);

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
            <div className="text-sm text-slate-600">Drop mixed files (emails, Word, Excel, CSV, PDFs, text, HTML). Intake moves each item from received → parsed → review → decision.</div>
          </div>
          <div className="flex gap-2">
            <button className="action-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Choose files</button>
            <button className="action-btn" onClick={batchApproveHighConfidence} disabled={highConfidence.length === 0}>Batch approve high confidence ({highConfidence.length})</button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
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
              {selectedAssetCandidates.length > 0 ? (
                <div className="rounded-xl border border-slate-200 p-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence snippets</div>
                  <div className="space-y-2 text-xs">
                    {Object.entries(selectedAssetCandidates
                      .flatMap((candidate) => candidate.evidence)
                      .reduce<Record<string, typeof selectedAssetCandidates[number]['evidence']>>((acc, evidence) => {
                        acc[evidence.field] = acc[evidence.field] ? [...acc[evidence.field], evidence] : [evidence];
                        return acc;
                      }, {})).slice(0, 6).map(([field, evidences]) => (
                      <div key={field} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-800">{field}</div>
                        {evidences.slice(0, 2).map((evidence) => (
                          <div key={evidence.id} className="mt-1">
                            <div className="text-slate-600">{evidence.snippet}</div>
                            <div className="text-[11px] text-slate-500">{evidence.sourceRef} {evidence.score ? `• score ${evidence.score}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Intake review queue</div>
            <Badge variant="warn">Pending {pending.length}</Badge>
          </div>
          <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
            <Badge variant="success">High confidence queue {highConfidence.length}</Badge>
            <Badge variant="warn">Needs review queue {needsReview.length}</Badge>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
            {pending.map((candidate) => (
              <article key={candidate.id} className={`rounded-xl border p-2 ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`} onClick={() => setActiveCandidateId(candidate.id)}>
                <div className="text-sm font-medium text-slate-900">{candidate.title}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  <Badge variant="blue">{candidate.candidateType}</Badge>
                  <Badge variant="warn">{getIntakeLifecycleLabel(normalizeWorkCandidateStatus(candidate.approvalStatus))}</Badge>
                  <Badge variant={candidate.confidence >= 0.9 ? 'success' : candidate.confidence >= 0.7 ? 'warn' : 'danger'}>{candidate.confidence}</Badge>
                  {candidate.duplicateMatches.length > 0 ? <Badge variant="danger">duplicate risk</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-slate-600">{candidate.summary.slice(0, 160)}</div>
                <div className="mt-1 text-[11px] text-slate-500">Project: {candidate.project || 'Unknown'} • Owner: {candidate.owner || 'Unknown'} • Due: {candidate.dueDate || 'n/a'}</div>
                <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                  {candidate.explanation.slice(0, 2).map((reason) => <div key={reason}>• {reason}</div>)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button className="action-btn" onClick={() => { setActiveCandidateId(candidate.id); applyAndNext('approve_task'); }}><CheckCircle2 className="h-4 w-4" /> Approve as task</button>
                  <button className="action-btn" onClick={() => { setActiveCandidateId(candidate.id); applyAndNext('approve_followup'); }}><Paperclip className="h-4 w-4" /> Approve as follow-up</button>
                  <button className="action-btn" onClick={() => { setActiveCandidateId(candidate.id); applyAndNext('reference'); }}><Save className="h-4 w-4" /> Save as reference</button>
                  <button className="action-btn action-btn-danger" onClick={() => { setActiveCandidateId(candidate.id); applyAndNext('reject'); }}><XCircle className="h-4 w-4" /> Reject</button>
                </div>
                {candidate.existingRecordMatches.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="font-semibold text-slate-700">Existing matches</div>
                    {candidate.existingRecordMatches.slice(0, 2).map((match) => (
                      <div key={match.id} className="mt-1 flex items-center justify-between gap-2">
                        <div className="truncate text-slate-600">{match.recordType}: {match.title} ({match.score}{match.strategy ? `, ${match.strategy}` : ''})</div>
                        <button className="action-btn" onClick={() => decideIntakeWorkCandidate(candidate.id, 'link', match.id)}><Link2 className="h-3 w-3" /> Link to existing</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <input
                    className="field-input"
                    value={candidate.title}
                    onChange={(event) => updateIntakeWorkCandidate(candidate.id, { title: event.target.value })}
                  />
                  <input
                    className="field-input"
                    value={candidate.project || ''}
                    placeholder="Project"
                    onChange={(event) => updateIntakeWorkCandidate(candidate.id, { project: event.target.value })}
                  />
                </div>
              </article>
            ))}
            {pending.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No pending candidates. Intake history is preserved in batch/asset records.</div> : null}
          </div>

          {finalized.length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Finalized outcomes ({finalized.length})</div>
              <div className="space-y-1">
                {finalized.slice(0, 5).map((candidate) => {
                  const status = normalizeWorkCandidateStatus(candidate.approvalStatus);
                  return (
                    <div key={candidate.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                      <span className="truncate text-slate-700">{candidate.title}</span>
                      <Badge variant={parseStatusTone[status]}>{getIntakeLifecycleLabel(status)}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Linked records available: {items.length} follow-ups • {tasks.length} tasks.
            <div className="mt-1 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> Pending review candidates allow: {getAllowedIntakeActions('review_needed').length} decisions (approve, link, reference, reject).</div>
          </div>
        </section>
      </div>
    </div>
  );
}
