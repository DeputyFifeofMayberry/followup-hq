import { FileUp, Loader2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../types';

const supportedTypes = '.eml,.msg,.txt,.html,.htm,.doc,.docx,.pdf,.csv,.xls,.xlsx';

function prettyStatus(asset: IntakeAssetRecord) {
  if (asset.parseStatus === 'failed') return 'Failed';
  if (asset.parseStatus === 'parsed' || asset.parseStatus === 'ready_high_confidence' || asset.parseStatus === 'review_needed') return 'Parsed';
  return 'Processing';
}

export function UniversalIntakeWorkspace() {
  const { intakeAssets, intakeWorkCandidates, intakeBatches, ingestIntakeFiles, updateIntakeWorkCandidate, decideIntakeWorkCandidate } = useAppStore(useShallow((s) => ({
    intakeAssets: s.intakeAssets,
    intakeWorkCandidates: s.intakeWorkCandidates,
    intakeBatches: s.intakeBatches,
    ingestIntakeFiles: s.ingestIntakeFiles,
    updateIntakeWorkCandidate: s.updateIntakeWorkCandidate,
    decideIntakeWorkCandidate: s.decideIntakeWorkCandidate,
  })));

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(intakeAssets[0]?.id ?? null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(intakeWorkCandidates[0]?.id ?? null);
  const [selectedSheet, setSelectedSheet] = useState<string>('All sheets');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setLoading(true);
    await ingestIntakeFiles(Array.from(list), source);
    setLoading(false);
  };

  const assets = useMemo(() => intakeAssets.filter((asset) => !asset.parentAssetId), [intakeAssets]);
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;
  const candidatesForAsset = useMemo(() => intakeWorkCandidates.filter((candidate) => candidate.assetId === selectedAsset?.id && candidate.approvalStatus === 'pending'), [intakeWorkCandidates, selectedAsset?.id]);

  const sheetNames = useMemo(() => {
    if (!selectedAsset || selectedAsset.kind !== 'spreadsheet') return [];
    const names = new Set<string>();
    candidatesForAsset.forEach((candidate) => {
      candidate.evidence.forEach((entry) => {
        const sheet = entry.sourceRef.split('#row')[0];
        if (sheet) names.add(sheet);
      });
    });
    return Array.from(names);
  }, [selectedAsset, candidatesForAsset]);

  const visibleCandidates = useMemo(() => {
    if (selectedSheet === 'All sheets') return candidatesForAsset;
    return candidatesForAsset.filter((candidate) => candidate.evidence.some((entry) => entry.sourceRef.startsWith(selectedSheet)));
  }, [candidatesForAsset, selectedSheet]);

  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? visibleCandidates[0] ?? null;

  const renderCandidate = (candidate: IntakeWorkCandidate) => (
    <button key={candidate.id} className={`rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedCandidateId(candidate.id)}>
      <div className="text-sm font-semibold text-slate-900">{candidate.title}</div>
      <div className="mt-1 text-xs text-slate-600">{candidate.candidateType} · confidence {Math.round(candidate.confidence * 100)}%</div>
      <div className="mt-1 text-xs text-slate-500 line-clamp-2">{candidate.summary || 'No summary extracted yet.'}</div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-5 transition ${dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void onFiles(event.dataTransfer.files, 'drop'); }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Manual intake workspace</div>
            <div className="text-sm text-slate-600">Drag and drop files here, or choose files manually. Supports email files, Word docs, spreadsheets (multi-sheet), PDF, and CSV.</div>
          </div>
          <div className="flex gap-2">
            <button className="action-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Select files</button>
            {loading ? <div className="inline-flex items-center gap-1 text-xs text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Parsing</div> : null}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={supportedTypes} className="hidden" onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Uploaded files ({assets.length})</div>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {assets.map((asset) => (
              <button key={asset.id} className={`w-full rounded-lg border p-2 text-left ${selectedAsset?.id === asset.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`} onClick={() => { setSelectedAssetId(asset.id); setSelectedSheet('All sheets'); }}>
                <div className="text-sm font-medium text-slate-900">{asset.fileName}</div>
                <div className="text-xs text-slate-600">{asset.kind} · {prettyStatus(asset)} · {asset.mimeType || 'unknown mime'}</div>
                {asset.warnings[0] ? <div className="mt-1 text-xs text-amber-700">{asset.warnings[0]}</div> : null}
              </button>
            ))}
            {!assets.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No files uploaded yet.</div> : null}
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Extraction results</div>
          {sheetNames.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <button className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === 'All sheets' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet('All sheets')}>All sheets</button>
              {sheetNames.map((sheet) => <button key={sheet} className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === sheet ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet(sheet)}>{sheet}</button>)}
            </div>
          ) : null}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {visibleCandidates.map(renderCandidate)}
            {!visibleCandidates.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No pending extracted records for this file.</div> : null}
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">Manual review and create</div>
          {selectedCandidate ? (
            <div className="space-y-3">
              <label className="field-block"><span className="field-label">Title</span><input className="field-input" value={selectedCandidate.title} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { title: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Project</span><input className="field-input" value={selectedCandidate.project || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { project: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={selectedCandidate.owner || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { owner: event.target.value })} /></label>
              <label className="field-block"><span className="field-label">Summary</span><textarea className="field-textarea" value={selectedCandidate.summary} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { summary: event.target.value })} /></label>
              {selectedCandidate.warnings?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {selectedCandidate.warnings[0]}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                {(selectedCandidate.evidence || []).slice(0, 4).map((entry) => <div key={entry.id}>• {entry.sourceRef}: {entry.snippet.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, ' ').slice(0, 120)}</div>)}
              </div>
              {actionMessage ? <div className="text-xs text-slate-600">{actionMessage}</div> : null}
              <div className="flex flex-wrap gap-2">
                <button className="primary-btn" onClick={() => decideIntakeWorkCandidate(selectedCandidate.id, 'approve_followup')}>Create follow-up</button>
                <button className="action-btn" onClick={() => {
                  const beforeStatus = selectedCandidate.approvalStatus;
                  decideIntakeWorkCandidate(selectedCandidate.id, 'approve_task');
                  const after = useAppStore.getState().intakeWorkCandidates.find((entry) => entry.id === selectedCandidate.id);
                  if (after && after.approvalStatus === beforeStatus) {
                    setActionMessage(after.warnings?.[0] || 'Task was not created. Review candidate fields and warnings.');
                    return;
                  }
                  setActionMessage('Task created from intake candidate.');
                }}>Create task</button>
                <button className="action-btn" onClick={() => decideIntakeWorkCandidate(selectedCandidate.id, 'reference')}>Save reference</button>
                <button className="action-btn" onClick={() => decideIntakeWorkCandidate(selectedCandidate.id, 'reject')}>Dismiss</button>
              </div>
            </div>
          ) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select an extracted candidate to review and create work.</div>}
        </section>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <Upload className="mr-1 inline h-4 w-4" />
        Batches: {intakeBatches.length} · Pending candidates: {intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending').length}
      </div>
    </div>
  );
}
