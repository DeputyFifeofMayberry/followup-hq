import { useEffect, useMemo, useState } from 'react';
import { buildMergeDraft, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { MergeDraft } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader } from './ui/AppPrimitives';

export function MergeModal() {
  const { mergeModal, items, closeMergeModal, mergeItems } = useAppStore(useShallow((s) => ({
    mergeModal: s.mergeModal,
    items: s.items,
    closeMergeModal: s.closeMergeModal,
    mergeItems: s.mergeItems,
  })))

  const baseItem = useMemo(() => items.find((item) => item.id === mergeModal.baseId) ?? null, [items, mergeModal.baseId]);
  const candidateItem = useMemo(() => items.find((item) => item.id === mergeModal.candidateId) ?? null, [items, mergeModal.candidateId]);
  const [draft, setDraft] = useState<MergeDraft | null>(null);

  useEffect(() => {
    if (!mergeModal.open || !baseItem || !candidateItem) return;
    setDraft(buildMergeDraft(baseItem, candidateItem));
  }, [mergeModal.open, baseItem, candidateItem]);

  if (!mergeModal.open || !baseItem || !candidateItem || !draft) return null;

  const handleMerge = () => mergeItems(baseItem.id, candidateItem.id, draft);

  return (
    <AppModal size="wide">
      <AppModalHeader
        title="Merge duplicates"
        subtitle={`Keep ${baseItem.id} and absorb ${candidateItem.id}.`}
        onClose={closeMergeModal}
      />
      <AppModalBody>

        <div className="grid gap-4 xl:grid-cols-2 mb-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="font-semibold text-slate-900">Base item</div>
            <div className="mt-1 text-slate-700">{baseItem.title}</div>
            <div className="mt-1 text-xs text-slate-500">{baseItem.project} • {baseItem.source} • {baseItem.owner}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="font-semibold text-slate-900">Duplicate item</div>
            <div className="mt-1 text-slate-700">{candidateItem.title}</div>
            <div className="mt-1 text-xs text-slate-500">{candidateItem.project} • {candidateItem.source} • {candidateItem.owner}</div>
          </div>
        </div>

        <div className="form-grid-two">
          <div className="field-block"><label className="field-label">Merged title</label><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Project</label><input value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Owner</label><input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Source</label><select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as typeof draft.source })} className="field-input"><option>Email</option><option>Notes</option><option>To-do</option><option>Excel</option></select></div>
          <div className="field-block"><label className="field-label">Status</label><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as typeof draft.status })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select></div>
          <div className="field-block"><label className="field-label">Priority</label><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as typeof draft.priority })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
          <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(draft.dueDate)} onChange={(e) => setDraft({ ...draft, dueDate: fromDateInputValue(e.target.value) })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Waiting on</label><input value={draft.waitingOn ?? ''} onChange={(e) => setDraft({ ...draft, waitingOn: e.target.value })} className="field-input" /></div>
          <div className="field-block span-two"><label className="field-label">Summary</label><textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="field-textarea" /></div>
          <div className="field-block span-two"><label className="field-label">Next action</label><textarea value={draft.nextAction} onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })} className="field-textarea" /></div>
          <div className="field-block span-two"><label className="field-label">Source refs</label><input value={draft.sourceRefs.join(' | ')} onChange={(e) => setDraft({ ...draft, sourceRefs: e.target.value.split('|').map((v) => v.trim()).filter(Boolean), sourceRef: e.target.value.split('|').map((v) => v.trim()).filter(Boolean)[0] ?? draft.sourceRef })} className="field-input" /></div>
          <div className="field-block span-two"><label className="field-label">Tags</label><input value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} className="field-input" /></div>
          <div className="field-block span-two"><label className="field-label">Merged notes</label><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="field-textarea" /></div>
        </div>

      </AppModalBody>

      <AppModalFooter>
          <div className="text-xs text-slate-500">This keeps the base record ID, rolls up source refs, preserves timeline history, and removes the duplicate record.</div>
          <div className="detail-actions-row">
            <button onClick={closeMergeModal} className="action-btn">Cancel</button>
            <button onClick={handleMerge} className="primary-btn">Merge records</button>
          </div>
      </AppModalFooter>
    </AppModal>
  );
}
