import { useMemo, useState } from 'react';
import { ArrowRight, BellRing, CheckCircle2, ClipboardList, Clock3, ListTodo } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { formatDate, isOverdue, needsNudge, todayIso } from '../lib/utils';

interface QueueCard {
  id: string;
  title: string;
  kind: 'Follow-up' | 'Task';
  owner: string;
  project: string;
  dueDate?: string;
  reason: string;
  score: number;
  onOpen: () => void;
  onDone?: () => void;
}

export function WorkQueueBoard({ onOpenFollowUp, onOpenTask }: { onOpenFollowUp: (id: string) => void; onOpenTask: (id: string) => void }) {
  const {
    items,
    tasks,
    updateTask,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    updateTask: s.updateTask,
  })));

  const [ownerFilter, setOwnerFilter] = useState<string>('All');
  const [timeMode, setTimeMode] = useState<'morning' | 'afternoon'>('morning');

  const owners = useMemo(
    () => ['All', ...Array.from(new Set([...items.map((item) => item.owner), ...tasks.map((task) => task.owner)])).sort()],
    [items, tasks],
  );

  const queue = useMemo(() => {
    const today = new Date(todayIso());
    const followUpCards: QueueCard[] = items
      .filter((item) => item.status !== 'Closed')
      .map((item) => {
        const touchAt = new Date(item.nextTouchDate).getTime();
        const overdueBoost = isOverdue(item) ? 12 : 0;
        const nudgeBoost = needsNudge(item) ? 7 : 0;
        const score = overdueBoost + nudgeBoost + (item.priority === 'Critical' ? 8 : item.priority === 'High' ? 5 : 2) + (Date.now() - touchAt > 0 ? 3 : 0);
        return {
          id: item.id,
          title: item.title,
          kind: 'Follow-up',
          owner: item.owner,
          project: item.project,
          dueDate: item.dueDate,
          reason: isOverdue(item) ? 'Overdue commitment' : needsNudge(item) ? 'Needs nudge' : 'Upcoming touch',
          score,
          onOpen: () => onOpenFollowUp(item.id),
        } satisfies QueueCard;
      });

    const taskCards: QueueCard[] = tasks
      .filter((task) => task.status !== 'Done')
      .map((task) => {
        const dueAt = task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const withinWeek = task.dueDate ? dueAt <= today.getTime() + 7 * 86400000 : false;
        const score = (task.status === 'Blocked' ? 10 : 0) + (task.priority === 'Critical' ? 8 : task.priority === 'High' ? 5 : 2) + (withinWeek ? 5 : 1);
        return {
          id: task.id,
          title: task.title,
          kind: 'Task',
          owner: task.owner,
          project: task.project,
          dueDate: task.dueDate,
          reason: task.status === 'Blocked' ? 'Blocked handoff' : withinWeek ? 'Due this week' : 'Backlog execution',
          score,
          onOpen: () => onOpenTask(task.id),
          onDone: () => updateTask(task.id, { status: 'Done' }),
        } satisfies QueueCard;
      });

    return [...followUpCards, ...taskCards]
      .filter((card) => ownerFilter === 'All' || card.owner === ownerFilter)
      .sort((a, b) => b.score - a.score)
      .slice(timeMode === 'morning' ? 0 : 5, timeMode === 'morning' ? 10 : 15);
  }, [items, tasks, ownerFilter, onOpenFollowUp, onOpenTask, updateTask, timeMode]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">One work-this-now queue</h2>
        <p className="mt-1 text-sm text-slate-500">Single execution list across follow-ups and tasks. Use this to answer: what are my next moves today?</p>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto]">
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="field-input">
          {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
        </select>
        <button onClick={() => setTimeMode('morning')} className={timeMode === 'morning' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
          <Clock3 className="h-4 w-4" />Morning top 10
        </button>
        <button onClick={() => setTimeMode('afternoon')} className={timeMode === 'afternoon' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
          <BellRing className="h-4 w-4" />Afternoon reset
        </button>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {queue.map((card) => (
          <div key={`${card.kind}-${card.id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.kind}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{card.title}</div>
                <div className="mt-1 text-xs text-slate-500">{card.project} • {card.owner} • {card.reason}{card.dueDate ? ` • ${formatDate(card.dueDate)}` : ''}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={card.onOpen} className="action-btn"><ArrowRight className="h-4 w-4" />Open</button>
                {card.onDone ? <button onClick={card.onDone} className="action-btn"><CheckCircle2 className="h-4 w-4" />Done</button> : null}
              </div>
            </div>
          </div>
        ))}
        {queue.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No items match this owner and time block.</div> : null}
      </div>

      <div className="grid gap-3 border-t border-slate-200 p-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700"><ListTodo className="mb-2 h-4 w-4" />Today: close commitments first, then execution tasks.</div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700"><ClipboardList className="mb-2 h-4 w-4" />Check blocked handoffs before adding new work.</div>
      </div>
    </section>
  );
}
