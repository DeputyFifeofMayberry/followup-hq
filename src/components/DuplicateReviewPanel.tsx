import { CopyCheck, ExternalLink, GitMerge, ShieldX } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

export function DuplicateReviewPanel() {
  const { items, duplicateReviews, selectedId, setSelectedId, dismissDuplicatePair, openMergeModal } = useAppStore(useShallow((s) => ({
    items: s.items,
    duplicateReviews: s.duplicateReviews,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    dismissDuplicatePair: s.dismissDuplicatePair,
    openMergeModal: s.openMergeModal,
  })))

  const currentReview = duplicateReviews.find((review) => review.itemId === selectedId) ?? duplicateReviews[0] ?? null;
  const baseItem = items.find((item) => item.id === currentReview?.itemId) ?? null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Duplicate review</h2>
            <p className="mt-1 text-sm text-slate-500">Potential overlaps across sources so one issue does not become several competing records.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
            <CopyCheck className="h-4 w-4" />
            {duplicateReviews.length} item{duplicateReviews.length === 1 ? '' : 's'} flagged
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!currentReview || !baseItem ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No likely duplicates are currently flagged.</div>
        ) : (
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
    </section>
  );
}
