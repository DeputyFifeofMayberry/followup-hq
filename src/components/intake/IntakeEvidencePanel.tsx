import { FileSpreadsheet } from 'lucide-react';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../../types';
import { prettyFileSize, sanitizeSnippet, type SourceTab } from './intakeWorkspaceTypes';

interface Props {
  selectedAsset: IntakeAssetRecord | null;
  selectedCandidate: IntakeWorkCandidate | null;
  selectedSourceTab: SourceTab;
  selectedEvidenceLocator: string | null;
  evidenceFocusLabel?: string | null;
  onSetTab: (tab: SourceTab) => void;
  onSelectLocator: (locator: string | null) => void;
}

export function IntakeEvidencePanel(props: Props) {
  const tabs: SourceTab[] = ['overview', 'preview', 'evidence', 'metadata'];
  return (
    <section className="intake-evidence-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
          <div className="text-xs text-slate-600">Inspect source only when needed for decision confidence.</div>
        </div>
        {props.evidenceFocusLabel ? <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => props.onSetTab('evidence')}>Focused: {props.evidenceFocusLabel}</button> : null}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">{tabs.map((tab) => <button key={tab} className={`action-btn !px-2 !py-1 text-xs ${props.selectedSourceTab === tab ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => props.onSetTab(tab)}>{tab}</button>)}</div>
      {props.selectedAsset ? <div className="space-y-2 text-xs max-h-[320px] overflow-auto">
        {props.selectedSourceTab === 'overview' ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-2"><div className="font-semibold text-slate-800">{props.selectedAsset.fileName}</div><div className="text-slate-600">{prettyFileSize(props.selectedAsset.sizeBytes)} • {props.selectedAsset.kind}</div></div> : null}
        {props.selectedSourceTab === 'preview' ? <div className="space-y-1.5">{(props.selectedAsset.extractionChunks?.length ? props.selectedAsset.extractionChunks : [{ id: 'fallback', sourceRef: props.selectedAsset.fileName, kind: 'text', text: props.selectedAsset.extractedPreview || props.selectedAsset.extractedText.slice(0, 2000), locator: undefined, sheetName: undefined, rowNumber: undefined, rowContext: undefined }]).map((chunk) => <div key={chunk.id} className={`rounded border p-2 whitespace-pre-wrap ${props.selectedEvidenceLocator && (chunk.locator === props.selectedEvidenceLocator || chunk.sourceRef === props.selectedEvidenceLocator) ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}><div className="text-[11px] uppercase tracking-wide text-slate-500">{chunk.kind} • {chunk.locator || chunk.sourceRef}</div><div>{chunk.text}</div></div>)}</div> : null}
        {props.selectedSourceTab === 'evidence' ? <div className="space-y-1.5">{(props.selectedCandidate?.evidence || []).map((entry) => <button key={entry.id} className={`w-full rounded border p-2 text-left ${props.selectedEvidenceLocator && (entry.locator === props.selectedEvidenceLocator || entry.sourceRef === props.selectedEvidenceLocator) ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => props.onSelectLocator(entry.locator || entry.sourceRef)}><div className="text-[11px] uppercase tracking-wide text-slate-500">{entry.field} • {entry.locator || entry.sourceRef}</div><div>{sanitizeSnippet(entry.snippet).slice(0, 220)}</div>{entry.locator?.includes('#row') ? <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><FileSpreadsheet className="h-3 w-3" />{entry.locator}</div> : null}</button>)}</div> : null}
        {props.selectedSourceTab === 'metadata' ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">{Object.entries(props.selectedAsset.metadata).map(([key, value]) => <div key={key}><strong>{key}:</strong> {String(value)}</div>)}</div> : null}
      </div> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Select a candidate to inspect source evidence.</div>}
    </section>
  );
}
