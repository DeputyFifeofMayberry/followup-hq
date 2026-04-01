import { useMemo, useState } from 'react';
import { BellRing, CalendarClock, Clock3, PauseCircle, Siren } from 'lucide-react';
import { Badge } from './Badge';
import { buildReviewBuckets, escalationTone, formatDate, followUpHealthScore, isOverdue, needsNudge, priorityTone, statusTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { ReviewBucketKey } from '../types';

const icons: Record<ReviewBucketKey, typeof BellRing> = {
  needsNudge: BellRing,
  dueThisWeek: CalendarClock,
  staleWaiting: Clock3,
  escalated: Siren,
  snoozed: PauseCircle,
};

export function DailyReviewBoard() {
  const { items, selectedId, setSelectedId, markNudged, snoozeItem, openDraftModal, cycleEscalation } = useAppStore(useShallow((s) => ({
    items: s.items,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    markNudged: s.markNudged,
    snoozeItem: s.snoozeItem,
    openDraftModal: s.openDraftModal,
    cycleEscalation: s.cycleEscalation,
  })));
  const buckets = useMemo(() => buildReviewBuckets(items), [items]);
  const [activeBucket, setActiveBucket] = useState<ReviewBucketKey>('needsNudge');
  const bucket = buckets.find((entry) => entry.key === activeBucket) ?? buckets[0];
  const bucketItems = items.filter((item) => bucket.itemIds.includes(item.id)).sort((a, b) => followUpHealthScore(b) - followUpHealthScore(a));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Accountability engine</h2>
        <p className="mt-1 text-sm text-slate-500">Work this queue daily. It is built around next touch, promised dates, nudges, and escalation—not generic tasks.</p>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-5">
        {buckets.map((entry) => {
          const Icon = icons[entry.key];
          return (
            <button
              key={entry.key}
              onClick={() => setActiveBucket(entry.key)}
              className={activeBucket === entry.key ? 'saved-view-card saved-view-card-active text-left' : 'saved-view-card text-left'}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700"><Icon className="h-4 w-4" /></div>
                <div className="text-2xl font-semibold text-slate-950">{entry.itemIds.length}</div>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-900">{entry.label}</div>
              <div className="mt-1 text-xs text-slate-500">{entry.helper}</div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">{bucket.label}</div>
            <div className="text-xs text-slate-500">{bucket.helper}</div>
          </div>
        </div>
        <div className="grid gap-3">
          {bucketItems.map((item) => (
            <div key={item.id} className={selectedId === item.id ? 'rounded-2xl border border-sky-300 bg-sky-50 p-4' : 'rounded-2xl border border-slate-200 p-4'}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <button onClick={() => setSelectedId(item.id)} className="text-left">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.project} • {item.owner} • next touch {formatDate(item.nextTouchDate)}</div>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusTone(item.status)}>{item.status}</Badge>
                  <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                  <Badge variant={escalationTone(item.escalationLevel)}>{item.escalationLevel}</Badge>
                  {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
                  {needsNudge(item) ? <Badge variant="warn">Nudge now</Badge> : null}
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600">{item.nextAction}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => openDraftModal(item.id)} className="action-btn">Draft follow-up</button>
                <button onClick={() => markNudged(item.id)} className="action-btn">Mark nudged</button>
                <button onClick={() => cycleEscalation(item.id)} className="action-btn">Cycle escalation</button>
                <button onClick={() => snoozeItem(item.id, 1)} className="action-btn">Snooze 1d</button>
                <button onClick={() => snoozeItem(item.id, 3)} className="action-btn">Snooze 3d</button>
                <button onClick={() => snoozeItem(item.id, 7)} className="action-btn">Snooze 7d</button>
              </div>
            </div>
          ))}
          {bucketItems.length === 0 ? <div className="text-sm text-slate-500">Nothing in this queue right now.</div> : null}
        </div>
      </div>
    </section>
  );
}
