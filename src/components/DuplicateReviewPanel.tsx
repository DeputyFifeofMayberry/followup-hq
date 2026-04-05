import { CopyCheck, ExternalLink, GitMerge, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

export function DuplicateReviewPanel() {
  const { items, duplicateReviews, selectedId, setSelectedId, dismissDuplicatePair, openMergeModal, followUpDuplicateModule } = useAppStore(useShallow((s) => ({
    items: s.items,
    duplicateReviews: s.duplicateReviews,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    dismissDuplicatePair: s.dismissDuplicatePair,
    openMergeModal: s.openMergeModal,
    followUpDuplicateModule: s.followUpDuplicateModule,
  })));
  const [expanded, setExpanded] = useState(followUpDuplicateModule === 'expanded');

  if (duplicateReviews.length === 0) return null;

  const currentReview = duplicateReviews.find((review) => review.itemId === selectedId) ?? duplicateReviews[0] ?? null;
  const baseItem = items.find((item) => item.id === currentReview?.itemId) ?? null;
  const isExpanded = followUpDuplicateModule === 'expanded' || (followUpDuplicateModule === 'auto' ? expanded : false);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/75 shadow-sm duplicate-review-panel">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700" onClick={() => setExpanded((value) => !value)}>
          <CopyCheck className="h-4 w-4" />
          {duplicateReviews.length} duplicate flag{duplicateReviews.length === 1 ? '' : 's'}
        </button>
        <span className="text-xs text-slate-500">Review only when needed.</span>
      </div>

      {isExpanded ? (
        <div className="p-4 space-y-3 border-t border-slate-200">
          {!currentReview || !baseItem ? null : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base item</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{baseItem.title}</div>
                <div className="mt-1 text-xs text-slate-500">{baseItem.project} • {baseItem.source} • due {formatDate(baseItem.dueDate)}</div>
              </div>

              {currentReview.candidates.map((candidate) => {
                const other = items.find((item) => item.id === candidate.itemId);
                if (!other) return null;
                return (
                  <div key={candidate.itemId} className="rounded-2xl border border-slate-200 p-4">
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
      ) : null}
    </section>
  );
}
