import { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, Send, ShieldCheck, WandSparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { buildTouchEvent, createId, todayIso } from '../lib/utils';

export function FollowUpDraftModal() {
  const { item, draftModal, closeDraftModal, updateDraftForItem, generateDraftForItem, updateItem, confirmFollowUpSent } = useAppStore(useShallow((s) => ({
    item: s.items.find((entry) => entry.id === s.draftModal.itemId) ?? null,
    draftModal: s.draftModal,
    closeDraftModal: s.closeDraftModal,
    updateDraftForItem: s.updateDraftForItem,
    generateDraftForItem: s.generateDraftForItem,
    updateItem: s.updateItem,
    confirmFollowUpSent: s.confirmFollowUpSent,
  })));
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState<'firm' | 'neutral' | 'friendly'>('neutral');
  const [confirming, setConfirming] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [recipients, setRecipients] = useState('');
  const [template, setTemplate] = useState<'status_ping' | 'blocker_clear' | 'decision_needed'>('status_ping');

  useEffect(() => {
    if (!draftModal.open || !item) return;
    setSubject(`Follow up: ${item.project} - ${item.title}`);
    setDraft(item.draftFollowUp || '');
    setCopied(false);
    setConfirming(false);
    setConfirmNote('');
    setRecipients(item.waitingOn || '');
    setTemplate('status_ping');
  }, [draftModal.open, item]);

  const tonedDraft = useMemo(() => {
    if (!draft.trim()) return '';
    const templateHeader = template === 'blocker_clear'
      ? 'Blocking item check:\n'
      : template === 'decision_needed'
        ? 'Decision needed:\n'
        : 'Status update request:\n';
    if (tone === 'firm') return `${templateHeader}\nQuick status check:\n\n${draft}`;
    if (tone === 'friendly') return `${templateHeader}\nHi team,\n\n${draft}\n\nThanks!`;
    return draft;
  }, [draft, tone, template]);

  if (!draftModal.open || !item) return null;

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tonedDraft)}`;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">Follow-up composer</div>
            <div className="mt-1 text-sm text-slate-500">Draft first, send externally, then explicitly confirm send receipt.</div>
          </div>
          <button onClick={closeDraftModal} className="action-btn">Close</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">{item.title}</div>
          <div className="mt-1">{item.project} • {item.owner}</div>
          <div className="mt-2 text-xs text-slate-500">Current state: {item.actionState || 'Draft created'}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="field-block"><span className="field-label">Subject line</span><input value={subject} onChange={(event) => setSubject(event.target.value)} className="field-input" /></label>
          <label className="field-block"><span className="field-label">Tone</span><select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)} className="field-input"><option value="firm">Firm</option><option value="neutral">Neutral</option><option value="friendly">Friendly</option></select></label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="field-block"><span className="field-label">Recipients</span><input value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="name@company.com, team@..." className="field-input" /></label>
          <label className="field-block"><span className="field-label">Template</span><select value={template} onChange={(event) => setTemplate(event.target.value as typeof template)} className="field-input"><option value="status_ping">Status ping</option><option value="blocker_clear">Blocker clear</option><option value="decision_needed">Decision needed</option></select></label>
        </div>
        <div className="mt-4 field-block">
          <label className="field-label">Body</label>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="field-textarea" style={{ minHeight: 240 }} />
        </div>
        <div className="modal-footer">
          <button onClick={() => { generateDraftForItem(item.id); setCopied(false); }} className="action-btn"><WandSparkles className="h-4 w-4" />Generate draft</button>
          <button onClick={async () => { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${tonedDraft}`); setCopied(true); }} className="action-btn"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy'}</button>
          <a href={mailtoHref} className="action-btn"><Mail className="h-4 w-4" />Open in compose</a>
          <button onClick={() => {
            updateDraftForItem(item.id, tonedDraft);
            updateItem(item.id, {
              draftFollowUp: tonedDraft,
              actionState: 'Ready to send',
              timeline: [buildTouchEvent('Draft prepared and ready to send.', 'bundle_action'), ...item.timeline],
              actionReceipts: [{ id: createId('ACT'), at: todayIso(), actor: 'Current user', action: 'draft_created', confirmed: true }, ...(item.actionReceipts || [])],
            });
            setConfirming(true);
          }} className="primary-btn"><Send className="h-4 w-4" />Prepare send confirmation</button>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">Recent send history / proof</div>
          <div className="mt-1 space-y-1">
            {(item.actionReceipts || []).slice(0, 4).map((receipt) => (
              <div key={receipt.id}>{receipt.at.slice(0, 10)} • {receipt.action} • {receipt.confirmed ? 'confirmed' : 'unconfirmed'}{receipt.notes ? ` • ${receipt.notes}` : ''}</div>
            ))}
            {!item.actionReceipts?.length ? <div>No proof receipts yet.</div> : null}
          </div>
        </div>
        {confirming ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4" />Confirm external send</div>
            <div className="mt-1 text-emerald-800">Only confirm once sent from your mail app. This creates a verified action receipt and moves to waiting state.</div>
            <input value={confirmNote} onChange={(event) => setConfirmNote(event.target.value)} placeholder="Evidence source (provider, timestamp, thread/message id)" className="field-input mt-2" />
            <div className="mt-2 flex gap-2">
              <button onClick={() => { confirmFollowUpSent(item.id, JSON.stringify({ confirmationSource: confirmNote || 'manual', recipients })); closeDraftModal(); }} className="primary-btn">I sent this externally</button>
              <button onClick={() => setConfirming(false)} className="action-btn">Not yet</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
