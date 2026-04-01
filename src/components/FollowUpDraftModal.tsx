import { useEffect, useState } from 'react';
import { Copy, WandSparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

export function FollowUpDraftModal() {
  const { item, draftModal, closeDraftModal, updateDraftForItem, generateDraftForItem } = useAppStore(useShallow((s) => ({
    item: s.items.find((entry) => entry.id === s.draftModal.itemId) ?? null,
    draftModal: s.draftModal,
    closeDraftModal: s.closeDraftModal,
    updateDraftForItem: s.updateDraftForItem,
    generateDraftForItem: s.generateDraftForItem,
  })));
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!draftModal.open || !item) return;
    setDraft(item.draftFollowUp || '');
    setCopied(false);
  }, [draftModal.open, item]);

  if (!draftModal.open || !item) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">Follow-up draft</div>
            <div className="mt-1 text-sm text-slate-500">Generate, refine, and copy a clean outbound follow-up.</div>
          </div>
          <button onClick={closeDraftModal} className="action-btn">Close</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">{item.title}</div>
          <div className="mt-1">{item.project} • {item.owner}</div>
          <div className="mt-2">{item.nextAction}</div>
        </div>
        <div className="mt-4 field-block">
          <label className="field-label">Draft text</label>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="field-textarea" style={{ minHeight: 260 }} />
        </div>
        <div className="modal-footer">
          <button onClick={() => { generateDraftForItem(item.id); setCopied(false); }} className="action-btn"><WandSparkles className="h-4 w-4" />Generate draft</button>
          <button onClick={async () => { await navigator.clipboard.writeText(draft); setCopied(true); }} className="action-btn"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy'}</button>
          <button onClick={() => updateDraftForItem(item.id, draft)} className="primary-btn">Save draft</button>
        </div>
      </div>
    </div>
  );
}
