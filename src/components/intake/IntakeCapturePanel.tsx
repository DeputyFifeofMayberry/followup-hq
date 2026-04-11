import { FileUp, Loader2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { describeIntakeFileSupport, getIntakeFileInputAccept } from '../../lib/intakeFileCapabilities';

interface Props {
  dragging: boolean;
  loading: boolean;
  manualText: string;
  manualTitleHint: string;
  pasteLoading: boolean;
  setManualText: (value: string) => void;
  setManualTitleHint: (value: string) => void;
  setDragging: (value: boolean) => void;
  onFiles: (list: FileList | null, source: 'drop' | 'file_picker') => Promise<void>;
  onSubmitPaste: () => Promise<void>;
}

export function IntakeCapturePanel(props: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="intake-support-panel intake-capture-panel">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Add intake source</div>
          <p className="mt-0.5 text-xs text-slate-600">Upload files or paste text, then resolve the review queue candidate-by-candidate.</p>
        </div>
        <span className="text-[11px] text-slate-500">{describeIntakeFileSupport()}</span>
      </div>

      <section className={`intake-support-panel border-2 border-dashed transition ${props.dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'}`} onDragOver={(event) => { event.preventDefault(); props.setDragging(true); }} onDragLeave={() => props.setDragging(false)} onDrop={(event) => { event.preventDefault(); props.setDragging(false); void props.onFiles(event.dataTransfer.files, 'drop'); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Upload className="h-4 w-4" />Drop intake sources</div>
            <div className="text-xs text-slate-600">Unsupported formats are blocked automatically.</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4" />Select files</button>
            {props.loading ? <div className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700"><Loader2 className="h-4 w-4 animate-spin" />Extracting...</div> : null}
          </div>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={getIntakeFileInputAccept()} className="hidden" onChange={(event) => void props.onFiles(event.target.files, 'file_picker')} />
      </section>

      <div>
        <label className="field-label">Quick paste source hint</label>
        <input className="field-input" value={props.manualTitleHint} onChange={(event) => props.setManualTitleHint(event.target.value)} placeholder="Optional title (e.g., Weekly meeting notes)" />
      </div>
      <div>
        <label className="field-label">Paste text</label>
        <textarea className="field-textarea min-h-[78px]" value={props.manualText} onChange={(event) => props.setManualText(event.target.value)} placeholder="Paste notes/email text here..." />
      </div>
      <div className="flex justify-end">
        <button className="action-btn" disabled={props.pasteLoading} onClick={() => void props.onSubmitPaste()}>{props.pasteLoading ? 'Ingesting...' : 'Create candidate from paste'}</button>
      </div>
    </section>
  );
}
