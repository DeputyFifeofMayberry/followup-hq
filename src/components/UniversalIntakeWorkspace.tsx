import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Mail,
  Sheet,
  TriangleAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../types';

const supportedTypes = '.eml,.msg,.txt,.html,.htm,.doc,.docx,.pdf,.csv,.xls,.xlsx';

type Tone = 'success' | 'error' | 'info';

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
    case 'email':
      return 'Email';
    case 'document':
      return 'Word document';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'csv':
      return 'CSV';
    case 'pdf':
      return 'PDF';
    case 'html':
      return 'HTML';
    case 'text':
      return 'Text';
    default:
      return 'File';
  }
}

function parseStatusMeta(asset: IntakeAssetRecord) {
  if (asset.parseStatus === 'failed' || asset.errors.length) {
    return { label: 'Parse failed', tone: 'error' as const, detail: asset.errors[0] || asset.warnings[0] || 'Could not extract readable content.' };
  }
  if (asset.parseStatus === 'reading' || asset.parseStatus === 'queued') {
    return { label: 'Uploaded', tone: 'info' as const, detail: 'Waiting to parse.' };
  }
  if (asset.parseStatus === 'review_needed' || asset.parseQuality === 'weak') {
    return { label: 'Parsed with review needed', tone: 'warn' as const, detail: asset.warnings[0] || 'Extraction succeeded but needs careful review.' };
  }
  if (asset.warnings.length) {
    return { label: 'Parsed with warnings', tone: 'warn' as const, detail: asset.warnings[0] };
  }
  return { label: 'Parsed and ready', tone: 'good' as const, detail: 'Ready for candidate review.' };
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return 'High confidence';
  if (confidence >= 0.72) return 'Moderate confidence';
  return 'Needs review';
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
  return cleaned.length > 36 ? `${cleaned.slice(0, 33)}...` : cleaned;
}

function getSheetKeyFromCandidate(candidate: IntakeWorkCandidate) {
  const rowEvidence = candidate.evidence.find((entry) => entry.locator?.includes('#row') || entry.sourceRef.includes('#row'));
  if (!rowEvidence) return null;
  const locator = rowEvidence.locator || rowEvidence.sourceRef;
  const [sheet] = locator.split('#row');
  return sheet || null;
}

function getRowContext(candidate: IntakeWorkCandidate) {
  const rowEvidence = candidate.evidence.find((entry) => entry.locator?.includes('#row') || entry.sourceRef.includes('#row'));
  if (!rowEvidence) return null;
  const locator = rowEvidence.locator || rowEvidence.sourceRef;
  const [sheet, rowRaw] = locator.split('#row');
  const rowLabel = rowRaw ? `row ${rowRaw}` : null;
  return [sheet ? `Sheet ${displaySheetName(sheet)}` : null, rowLabel].filter(Boolean).join(' • ');
}

function sanitizeSnippet(value: string) {
  return value.split('').map((char) => {
    const code = char.charCodeAt(0);
    return (code >= 32 || code === 10 || code === 13 || code === 9) ? char : ' ';
  }).join('');
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const assets = useMemo(() => intakeAssets.filter((asset) => !asset.parentAssetId), [intakeAssets]);

  useEffect(() => {
    if (!assets.length) {
      setSelectedAssetId(null);
      return;
    }
    if (!selectedAssetId || !assets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const candidatesForAsset = useMemo(
    () => intakeWorkCandidates.filter((candidate) => candidate.assetId === selectedAsset?.id && candidate.approvalStatus === 'pending'),
    [intakeWorkCandidates, selectedAsset?.id],
  );

  const sheetNames = useMemo(() => {
    if (!selectedAsset || (selectedAsset.kind !== 'spreadsheet' && selectedAsset.kind !== 'csv')) return [];
    const names = new Set<string>();
    candidatesForAsset.forEach((candidate) => {
      const sheet = getSheetKeyFromCandidate(candidate);
      if (sheet) names.add(sheet);
    });
    return Array.from(names);
  }, [selectedAsset, candidatesForAsset]);

  const visibleCandidates = useMemo(() => {
    if (selectedSheet === 'all') return candidatesForAsset;
    return candidatesForAsset.filter((candidate) => getSheetKeyFromCandidate(candidate) === selectedSheet);
  }, [candidatesForAsset, selectedSheet]);

  useEffect(() => {
    if (!visibleCandidates.length) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !visibleCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(visibleCandidates[0].id);
    }
  }, [visibleCandidates, selectedCandidateId]);

  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const pendingCount = intakeWorkCandidates.filter((entry) => entry.approvalStatus === 'pending').length;

  const onFiles = async (list: FileList | null, source: 'drop' | 'file_picker') => {
    if (!list?.length) return;
    setFeedback({ tone: 'info', message: `Uploading ${list.length} file${list.length === 1 ? '' : 's'} for extraction...` });
    setLoading(true);
    try {
      await ingestIntakeFiles(Array.from(list), source);
      const rootAssets = useAppStore.getState().intakeAssets.filter((asset) => !asset.parentAssetId);
      if (rootAssets[0]) setSelectedAssetId(rootAssets[0].id);
      setFeedback({ tone: 'success', message: 'Files parsed. Review extracted candidates and create work when ready.' });
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

    if (!after) {
      setFeedback({ tone: 'error', message: 'Action failed: candidate could not be found after submission.' });
      return;
    }

    if (before?.approvalStatus === after.approvalStatus) {
      setFeedback({ tone: 'error', message: after.warnings[0] || 'Action did not complete. Review warnings and required fields, then try again.' });
      return;
    }

    if (decision === 'approve_task') {
      setFeedback({ tone: 'success', message: `Task created successfully${after.createdRecordId ? ` (ID ${after.createdRecordId})` : ''}.` });
      return;
    }
    if (decision === 'approve_followup') {
      setFeedback({ tone: 'success', message: `Follow-up created successfully${after.createdRecordId ? ` (ID ${after.createdRecordId})` : ''}.` });
      return;
    }
    if (decision === 'reference') {
      setFeedback({ tone: 'success', message: 'Candidate saved as reference document.' });
      return;
    }
    setFeedback({ tone: 'info', message: 'Candidate dismissed from pending intake review.' });
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
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Manual import workbench</div>
            <h2 className="text-xl font-semibold text-slate-900">Upload files, review extraction, and create trusted work records</h2>
            <p className="mt-1 text-sm text-slate-600">Focused workflow: upload → inspect source file → validate candidate → create follow-up or task.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div>Batches: <span className="font-semibold text-slate-900">{intakeBatches.length}</span></div>
            <div>Pending candidates: <span className="font-semibold text-slate-900">{pendingCount}</span></div>
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
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><Upload className="h-4 w-4" />Drop intake files here</div>
            <div className="text-sm text-slate-600">Supported formats are intentionally handled: email (.eml/.msg), Word (.doc/.docx), spreadsheets (.xls/.xlsx), PDF, and CSV/text.</div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {['Email', 'Word', 'Spreadsheet', 'PDF', 'CSV'].map((label) => <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{label}</span>)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" /> Select files</button>
            {loading ? <div className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700"><Loader2 className="h-4 w-4 animate-spin" />Parsing and extracting...</div> : null}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={supportedTypes} className="hidden" onChange={(event) => void onFiles(event.target.files, 'file_picker')} />
      </section>

      {feedback ? <div className={`rounded-xl border px-3 py-2 text-sm ${feedbackClass}`}>{feedback.message}</div> : null}

      <section className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">1) Uploaded files ({assets.length})</div>
          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {assets.map((asset) => {
              const status = parseStatusMeta(asset);
              return (
                <button
                  key={asset.id}
                  className={`w-full rounded-lg border p-3 text-left ${selectedAsset?.id === asset.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}
                  onClick={() => { setSelectedAssetId(asset.id); setSelectedSheet('all'); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2">{asset.fileName}</div>
                    <div className="text-xs text-slate-500">{prettyFileSize(asset.sizeBytes)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{mapAssetKindLabel(asset)} • {asset.fileType || 'unknown type'}</div>
                  <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${status.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : status.tone === 'warn' ? 'bg-amber-100 text-amber-700' : status.tone === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                    {status.tone === 'good' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {status.tone === 'warn' ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
                    {status.tone === 'error' ? <XCircle className="h-3.5 w-3.5" /> : null}
                    {status.tone === 'info' ? <Loader2 className="h-3.5 w-3.5" /> : null}
                    {status.label}
                  </div>
                  {(status.tone === 'warn' || status.tone === 'error') ? <div className="mt-1 text-xs text-slate-600">{status.detail}</div> : null}
                </button>
              );
            })}
            {!assets.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No files uploaded yet. Start by dropping email, Word, spreadsheet, PDF, or CSV files.</div> : null}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">2) Extracted records</div>
          {sheetNames.length ? (
            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Spreadsheet sheets</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === 'all' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet('all')}>All sheets</button>
                {sheetNames.map((sheet) => <button key={sheet} className={`action-btn !px-2 !py-1 text-xs ${selectedSheet === sheet ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => setSelectedSheet(sheet)}><Sheet className="h-3.5 w-3.5" />{displaySheetName(sheet)}</button>)}
              </div>
            </div>
          ) : null}
          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {visibleCandidates.map((candidate) => {
              const rowContext = getRowContext(candidate);
              return (
                <button key={candidate.id} className={`w-full rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedCandidateId(candidate.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 line-clamp-2">{candidate.title || 'Untitled candidate'}</div>
                      <div className="mt-1 text-xs text-slate-600">{candidateTypeLabel(candidate.candidateType)} • {confidenceLabel(candidate.confidence)}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">{Math.round(candidate.confidence * 100)}%</div>
                  </div>
                  {rowContext ? <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><FileSpreadsheet className="h-3 w-3" />{rowContext}</div> : null}
                  <div className="mt-2 text-xs text-slate-600 line-clamp-2">{candidate.summary || 'No summary extracted yet.'}</div>
                  {candidate.warnings[0] ? <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">{candidate.warnings[0]}</div> : null}
                </button>
              );
            })}
            {!selectedAsset ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select a file to inspect extracted records.</div> : null}
            {selectedAsset && !visibleCandidates.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No pending extracted records for this file. If parsing succeeded, this file may be reference-only.</div> : null}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-900">3) Review and create</div>
          {selectedCandidate ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Review checklist</div>
                <div>Confirm title, owner, project, and summary before creating work. Use warnings and source evidence below as validation context.</div>
              </div>

              <label className="field-block"><span className="field-label">Title</span><input className="field-input" value={selectedCandidate.title} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { title: event.target.value })} placeholder="Clear work title" /></label>
              <label className="field-block"><span className="field-label">Project</span><input className="field-input" value={selectedCandidate.project || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { project: event.target.value })} placeholder="Project or job name" /></label>
              <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={selectedCandidate.owner || ''} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { owner: event.target.value })} placeholder="Responsible owner" /></label>
              <label className="field-block"><span className="field-label">Summary</span><textarea className="field-textarea" value={selectedCandidate.summary} onChange={(event) => updateIntakeWorkCandidate(selectedCandidate.id, { summary: event.target.value })} placeholder="What needs to happen and why" /></label>

              {selectedCandidate.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <div className="mb-1 inline-flex items-center gap-1 font-semibold"><AlertCircle className="h-3.5 w-3.5" />Review warnings before create</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {selectedCandidate.warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <div className="mb-1 font-semibold text-slate-700">Source evidence</div>
                <div className="space-y-1.5">
                  {(selectedCandidate.evidence || []).slice(0, 4).map((entry) => (
                    <div key={entry.id} className="rounded border border-slate-200 bg-white p-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{entry.sourceType?.replace('_', ' ') || 'source'} • {entry.sourceRef}</div>
                      <div className="mt-1 text-xs text-slate-700">{sanitizeSnippet(entry.snippet).slice(0, 180)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="primary-btn" onClick={() => handleDecision(selectedCandidate, 'approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'approve_task')}>Create task</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'reference')}>Save reference</button>
                <button className="action-btn" onClick={() => handleDecision(selectedCandidate, 'reject')}>Dismiss</button>
              </div>
            </div>
          ) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No candidate selected. Pick an extracted record to review and create trusted work.</div>}
        </div>
      </section>
    </div>
  );
}
