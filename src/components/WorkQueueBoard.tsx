import { useMemo, useState } from 'react';
import { ArrowRight, BellRing, CheckCircle2, ClipboardList, Clock3, ListTodo } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { buildTouchEvent, createId, formatDate, isOverdue, needsNudge, todayIso } from '../lib/utils';

interface QueueCard {
  id: string;
  title: string;
  kind: 'Follow-up' | 'Task';
  owner: string;
  project: string;
  dueDate?: string;
  reason: string;
  score: number;
  nextBestAction: string;
  onOpen: () => void;
  onDone?: () => void;
  onSnooze?: () => void;
  onNudged?: () => void;
  onEscalate?: () => void;
  onCreateTask?: () => void;
  onLogTouch?: () => void;
  onDraft?: () => void;
}

export function WorkQueueBoard({ onOpenFollowUp, onOpenTask }: { onOpenFollowUp: (id: string) => void; onOpenTask: (id: string) => void }) {
  const {
    items,
    tasks,
    updateTask,
    updateItem,
    markNudged,
    snoozeItem,
    cycleEscalation,
    openCreateModal,
    openCreateTaskModal,
    forwardedCandidates,
    approveForwardedCandidate,
    rejectForwardedCandidate,
    addTask,
    openDraftModal,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    updateTask: s.updateTask,
    updateItem: s.updateItem,
    markNudged: s.markNudged,
    snoozeItem: s.snoozeItem,
    cycleEscalation: s.cycleEscalation,
    openCreateModal: s.openCreateModal,
    openCreateTaskModal: s.openCreateTaskModal,
    forwardedCandidates: s.forwardedCandidates,
    approveForwardedCandidate: s.approveForwardedCandidate,
    rejectForwardedCandidate: s.rejectForwardedCandidate,
    addTask: s.addTask,
    openDraftModal: s.openDraftModal,
  })));

  const [ownerFilter, setOwnerFilter] = useState<string>('All');
  const [timeMode, setTimeMode] = useState<'morning' | 'afternoon'>('morning');
  const [focusIndex, setFocusIndex] = useState(0);

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
          nextBestAction: needsNudge(item) ? 'Send nudge' : item.status === 'Waiting on external' ? 'Wait for response' : 'Create task',
          onOpen: () => onOpenFollowUp(item.id),
          onDone: () => updateItem(item.id, { status: 'Closed' }),
          onSnooze: () => snoozeItem(item.id, 2),
          onNudged: () => markNudged(item.id),
          onEscalate: () => cycleEscalation(item.id),
          onCreateTask: () => addTask({
            id: createId('TSK'),
            title: `Task: ${item.title}`,
            project: item.project,
            projectId: item.projectId,
            owner: item.owner,
            status: 'To do',
            priority: item.priority,
            dueDate: item.nextTouchDate || item.dueDate,
            startDate: todayIso(),
            summary: item.summary || item.nextAction,
            nextStep: item.nextAction || 'Complete this follow-up task.',
            notes: '',
            tags: ['From follow-up'],
            linkedFollowUpId: item.id,
            contactId: item.contactId,
            companyId: item.companyId,
            createdAt: todayIso(),
            updatedAt: todayIso(),
          }),
          onLogTouch: () => updateItem(item.id, {
            lastTouchDate: todayIso(),
            nextTouchDate: item.cadenceDays ? new Date(Date.now() + item.cadenceDays * 86400000).toISOString() : item.nextTouchDate,
            timeline: [buildTouchEvent('Quick touch logged from Today queue.'), ...item.timeline],
          }),
          onDraft: () => openDraftModal(item.id),
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
          nextBestAction: task.status === 'Blocked' ? 'Review cleanup' : task.status === 'In progress' ? 'Close out' : 'Create task',
          onOpen: () => onOpenTask(task.id),
          onDone: () => updateTask(task.id, { status: 'Done' }),
        } satisfies QueueCard;
      });

    return [...followUpCards, ...taskCards]
      .filter((card) => ownerFilter === 'All' || card.owner === ownerFilter)
      .sort((a, b) => b.score - a.score)
      .slice(timeMode === 'morning' ? 0 : 5, timeMode === 'morning' ? 10 : 15);
  }, [items, tasks, ownerFilter, onOpenFollowUp, onOpenTask, updateTask, updateItem, timeMode, snoozeItem, markNudged, cycleEscalation, addTask, openDraftModal]);
  const pendingIntake = forwardedCandidates.filter((candidate) => candidate.status === 'pending').slice(0, 4);
  const focused = queue[focusIndex] ?? null;
  const sharedViews = useMemo(() => {
    const activeItems = items.filter((item) => item.status !== 'Closed');
    const waitingTooLong = activeItems.filter((item) => item.status.includes('Waiting') && (Date.now() - new Date(item.lastTouchDate).getTime()) > 7 * 86400000).length;
    return [
      { label: 'My work', value: queue.filter((entry) => entry.owner !== 'Unassigned').length },
      { label: 'Team queue', value: activeItems.length + tasks.filter((task) => task.status !== 'Done').length },
      { label: 'Unassigned', value: activeItems.filter((item) => item.owner === 'Unassigned').length + tasks.filter((task) => task.owner === 'Unassigned' && task.status !== 'Done').length },
      { label: 'Overdue by owner', value: activeItems.filter((item) => isOverdue(item)).length },
      { label: 'Waiting too long', value: waitingTooLong },
    ];
  }, [items, tasks, queue]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Today execution queue</h2>
        <p className="mt-1 text-sm text-slate-500">Recommended next moves across follow-ups and tasks, ordered for fast daily execution.</p>
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
      <div className="px-4 pb-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {sharedViews.map((view) => (
            <div key={view.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <div className="uppercase tracking-[0.12em] text-slate-500">{view.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{view.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreateModal} className="action-btn">New follow-up</button>
          <button onClick={openCreateTaskModal} className="action-btn">New task</button>
          <button onClick={() => setFocusIndex((idx) => Math.min(queue.length - 1, idx + 1))} className="action-btn">Next in triage</button>
          <button onClick={() => setOwnerFilter('All')} className="action-btn">Reset filters</button>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {pendingIntake.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Intake review in queue</div>
                <div className="text-xs text-slate-600">Only exceptions stay here. Safe items auto-route.</div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{pendingIntake.length} pending</div>
            </div>
            <div className="mt-3 space-y-2">
              {pendingIntake.map((candidate) => (
                <div key={candidate.id} className="rounded-xl border border-amber-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">{candidate.normalizedSubject || '(no subject)'}</div>
                  <div className="text-xs text-slate-500">{candidate.originalSender} • confidence {candidate.confidence}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => approveForwardedCandidate(candidate.id, candidate.suggestedType === 'reference' ? 'followup' : candidate.suggestedType)} className="action-btn">Approve</button>
                    <button onClick={() => rejectForwardedCandidate(candidate.id)} className="action-btn">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {queue.map((card, index) => (
          <div key={`${card.kind}-${card.id}`} className={index === focusIndex ? 'rounded-2xl border-2 border-slate-900 p-4' : 'rounded-2xl border border-slate-200 p-4'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.kind}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{card.title}</div>
                <div className="mt-1 text-xs text-slate-500">{card.project} • {card.owner} • {card.reason}{card.dueDate ? ` • ${formatDate(card.dueDate)}` : ''}</div>
                <div className="mt-2 text-xs font-semibold text-sky-700">Next best action: {card.nextBestAction}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={card.onOpen} className="primary-btn"><ArrowRight className="h-4 w-4" />{card.nextBestAction}</button>
                {card.onDone ? <button onClick={card.onDone} className="action-btn"><CheckCircle2 className="h-4 w-4" />Done</button> : null}
                {card.onNudged ? <button onClick={card.onNudged} className="action-btn">Nudged</button> : null}
                {card.onSnooze ? <button onClick={card.onSnooze} className="action-btn">Snooze 2d</button> : null}
                {card.onLogTouch ? <button onClick={card.onLogTouch} className="action-btn">Touch + bump</button> : null}
                {card.onCreateTask ? <button onClick={card.onCreateTask} className="action-btn">Create task</button> : null}
                {card.onDraft ? <button onClick={card.onDraft} className="action-btn">Draft follow-up</button> : null}
                {card.onEscalate ? <button onClick={card.onEscalate} className="action-btn">Escalate</button> : null}
              </div>
            </div>
          </div>
        ))}
        {queue.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No items match this owner and time block.</div> : null}
      </div>

      <div className="grid gap-3 border-t border-slate-200 p-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700"><ListTodo className="mb-2 h-4 w-4" />Today: close commitments first, then execution tasks.</div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700"><ClipboardList className="mb-2 h-4 w-4" />Check blocked handoffs before adding new work.</div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{focused ? `Focused triage: ${focused.title}` : 'No focused item in triage.'}</div>
      </div>
    </section>
  );
}
