import { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, Send, WandSparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { addDaysIso, buildTouchEvent, todayIso } from '../lib/utils';

export function FollowUpDraftModal() {
  const { item, draftModal, closeDraftModal, updateDraftForItem, generateDraftForItem, updateItem } = useAppStore(useShallow((s) => ({
    item: s.items.find((entry) => entry.id === s.draftModal.itemId) ?? null,
    draftModal: s.draftModal,
    closeDraftModal: s.closeDraftModal,
    updateDraftForItem: s.updateDraftForItem,
    generateDraftForItem: s.generateDraftForItem,
    updateItem: s.updateItem,
  })));
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState<'firm' | 'neutral' | 'friendly'>('neutral');

  useEffect(() => {
    if (!draftModal.open || !item) return;
    setSubject(`Follow up: ${item.project} - ${item.title}`);
    setDraft(item.draftFollowUp || '');
    setCopied(false);
  }, [draftModal.open, item]);

  const tonedDraft = useMemo(() => {
    if (!draft.trim()) return '';
    if (tone === 'firm') return `Quick status check:\n\n${draft}`;
    if (tone === 'friendly') return `Hi team,\n\n${draft}\n\nThanks!`;
    return draft;
  }, [draft, tone]);

  if (!draftModal.open || !item) return null;

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tonedDraft)}`;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">Follow-up composer</div>
            <div className="mt-1 text-sm text-slate-500">Generate, tune tone, launch email, then mark sent in one flow.</div>
          </div>
          <button onClick={closeDraftModal} className="action-btn">Close</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">{item.title}</div>
          <div className="mt-1">{item.project} • {item.owner}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="field-block"><span className="field-label">Subject line</span><input value={subject} onChange={(event) => setSubject(event.target.value)} className="field-input" /></label>
          <label className="field-block"><span className="field-label">Tone</span><select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)} className="field-input"><option value="firm">Firm</option><option value="neutral">Neutral</option><option value="friendly">Friendly</option></select></label>
        </div>
        <div className="mt-4 field-block">
          <label className="field-label">Body</label>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="field-textarea" style={{ minHeight: 260 }} />
        </div>
        <div className="modal-footer">
          <button onClick={() => { generateDraftForItem(item.id); setCopied(false); }} className="action-btn"><WandSparkles className="h-4 w-4" />Generate draft</button>
          <button onClick={async () => { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${tonedDraft}`); setCopied(true); }} className="action-btn"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy'}</button>
          <a href={mailtoHref} className="action-btn"><Mail className="h-4 w-4" />Open in compose</a>
          <button
            onClick={() => {
              updateDraftForItem(item.id, tonedDraft);
              updateItem(item.id, {
                draftFollowUp: tonedDraft,
                status: 'Waiting on external',
                lastTouchDate: todayIso(),
                nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3),
                lastCompletedAction: 'Sent follow-up',
                lastActionAt: todayIso(),
                timeline: [buildTouchEvent('Sent follow-up from composer.', 'bundle_action'), ...item.timeline],
              });
              closeDraftModal();
            }}
            className="primary-btn"
          ><Send className="h-4 w-4" />Mark as sent</button>
        </div>
      </div>
    </div>
  );
}
