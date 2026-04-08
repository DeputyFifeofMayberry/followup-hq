import { CopyCheck, ExternalLink, GitMerge, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useFollowUpLaneContext } from '../domains/followups';

export function DuplicateReviewPanel({ presentation = 'inline' }: { presentation?: 'inline' | 'modal' }) {
  const { items, duplicateReviews, setSelectedId, dismissDuplicatePair, openMergeModal } = useAppStore(useShallow((s) => ({
    items: s.items,
    duplicateReviews: s.duplicateReviews,
    setSelectedId: s.setSelectedId,
    dismissDuplicatePair: s.dismissDuplicatePair,
    openMergeModal: s.openMergeModal,
  })));
  const laneContext = useFollowUpLaneContext();
  const [expanded, setExpanded] = useState(true);

  if (duplicateReviews.length === 0) return null;

  const selectedReview = laneContext.selectedDuplicateReview;
  const selectedHasDuplicates = !!selectedReview;
  const fallbackReview = duplicateReviews.find((review) => review.candidates.length > 0) ?? duplicateReviews[0] ?? null;
  const currentReview = selectedReview ?? fallbackReview;
  const baseItem = items.find((item) => item.id === currentReview?.itemId) ?? null;
  const content = (
    <div className="p-4 space-y-3">
      {!currentReview || !baseItem ? null : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{selectedHasDuplicates ? 'Selected base item' : 'Next duplicate queue item'}</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{baseItem.title}</div>
            <div className="mt-1 text-xs text-slate-500">{baseItem.project} • {baseItem.source} • due {formatDate(baseItem.dueDate)}</div>
          </div>

          {currentReview.candidates.map((candidate) => {
            const other = items.find((item) => item.id === candidate.itemId);
            if (!other) return null;
            return (
              <div key={candidate.itemId} className="rounded-2xl border border-slate-200 p-4 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{other.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{other.project} • {other.source} • due {formatDate(other.dueDate)}</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">Match score {candidate.score}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500">{candidate.reasons.join(' • ')}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setSelectedId(other.id)} className="action-btn"><ExternalLink className="h-4 w-4" />Open item</button>
                  <button onClick={() => openMergeModal(baseItem.id, other.id)} className="primary-btn"><GitMerge className="h-4 w-4" />Merge into base</button>
                  <button onClick={() => dismissDuplicatePair(baseItem.id, other.id)} className="action-btn"><ShieldX className="h-4 w-4" />Dismiss pair</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  if (presentation === 'modal') {
    return <section className="duplicate-review-panel duplicate-review-panel-modal">{content}</section>;
  }

  return (
    <section className={`rounded-2xl border shadow-sm duplicate-review-panel ${selectedHasDuplicates ? 'duplicate-review-panel-selected' : 'duplicate-review-panel-muted'}`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700" onClick={() => setExpanded((value) => !value)}>
          <CopyCheck className="h-4 w-4" />
          {duplicateReviews.length} duplicate flag{duplicateReviews.length === 1 ? '' : 's'}
        </button>
        <span className="text-xs text-slate-500">
          {selectedHasDuplicates ? 'Possible duplicates for selected follow-up.' : 'Review flagged duplicates when needed.'}
        </span>
      </div>
      {expanded ? <div className="border-t border-slate-200">{content}</div> : null}
    </section>
  );
}
