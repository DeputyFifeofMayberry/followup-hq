import { useMemo, useState } from 'react';
import { parseDelimitedText } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ImportPreviewRow } from '../types';
import { useShallow } from 'zustand/react/shallow';

async function parseWorkbookFile(file: File): Promise<ImportPreviewRow[]> {
  const buffer = await file.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(firstSheet);
  return parseDelimitedText(csv, ',');
}

export function ImportWizardModal() {
  const { importModalOpen, closeImportModal, importItems } = useAppStore(useShallow((s) => ({
    importModalOpen: s.importModalOpen,
    closeImportModal: s.closeImportModal,
    importItems: s.importItems,
  })))
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [error, setError] = useState('');

  const previewColumns = useMemo(() => preview.slice(0, 5), [preview]);

  if (!importModalOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">CSV / Excel import wizard</div>
            <div className="mt-1 text-sm text-slate-500">Load CSV, TSV, pasted Excel rows, or a direct .xlsx workbook.</div>
          </div>
          <button onClick={closeImportModal} className="action-btn">Close</button>
        </div>

        <div className="import-dropzone">
          <div className="text-sm font-medium text-slate-900">Upload a file</div>
          <div className="mt-1 text-sm text-slate-500">Supported now: .csv, .tsv, .xlsx, .xls</div>
          <input
            type="file"
            accept=".csv,.tsv,.xlsx,.xls"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                setError('');
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                  setPreview(await parseWorkbookFile(file));
                  return;
                }
                const text = await file.text();
                setPreview(parseDelimitedText(text, file.name.endsWith('.tsv') ? '\t' : ','));
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Failed to parse import file.');
              }
            }}
            className="mt-3"
          />
        </div>

        <div className="field-block">
          <label className="field-label">Or paste rows from Excel / CSV</label>
          <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} className="field-textarea import-textarea" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setPreview(parseDelimitedText(pastedText))} className="action-btn">Preview pasted rows</button>
            <button onClick={() => { setPastedText(''); setPreview([]); setError(''); }} className="action-btn">Clear</button>
          </div>
        </div>

        {error ? <div className="import-error">{error}</div> : null}

        <div className="rounded-2xl border border-slate-200">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Preview ({preview.length} rows ready)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due</th>
                </tr>
              </thead>
              <tbody>
                {previewColumns.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-700">{row.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.project}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.owner}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.status}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
                {previewColumns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">Nothing parsed yet. Upload a file or paste rows to generate a preview.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={closeImportModal} className="action-btn">Cancel</button>
          <button onClick={() => importItems(preview)} className="primary-btn" disabled={preview.length === 0}>Import rows</button>
        </div>
      </div>
    </div>
  );
}
