import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Edit3, MailPlus, PauseCircle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { addDaysIso, buildTouchEvent, formatDate, isOverdue, needsNudge, todayIso } from '../lib/utils';

type AgendaGroup = 'Now' | 'Waiting' | 'Blocked' | 'Later';
type AgendaKind = 'followup' | 'task';

interface AgendaEntry {
  id: string;
  kind: AgendaKind;
  title: string;
  project: string;
  owner: string;
  dueDate?: string;
  group: AgendaGroup;
  linkedFollowUpId?: string;
  nextAction: string;
  summary: string;
}

export function PersonalAgendaBoard() {
  const {
    items,
    tasks,
    updateItem,
    updateTask,
    snoozeItem,
    openDraftModal,
    setSelectedId,
    setSelectedTaskId,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    updateItem: s.updateItem,
    updateTask: s.updateTask,
    snoozeItem: s.snoozeItem,
    openDraftModal: s.openDraftModal,
    setSelectedId: s.setSelectedId,
    setSelectedTaskId: s.setSelectedTaskId,
  })));

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const agenda = useMemo(() => {
    const followUps: AgendaEntry[] = items
      .filter((item) => item.status !== 'Closed')
      .map((item) => {
        const dueAt = new Date(item.dueDate).getTime();
        const isWaiting = item.status === 'Waiting on external' || item.status === 'Waiting internal';
        const group: AgendaGroup = item.status === 'At risk' || isOverdue(item) || dueAt <= Date.now()
          ? 'Now'
          : isWaiting
            ? 'Waiting'
            : dueAt <= Date.now() + 2 * 86400000
              ? 'Now'
              : 'Later';
        return {
          id: item.id,
          kind: 'followup',
          title: item.title,
          project: item.project,
          owner: item.owner,
          dueDate: item.dueDate,
          group,
          nextAction: item.nextAction,
          summary: item.summary,
        };
      });

    const tasksOpen: AgendaEntry[] = tasks
      .filter((task) => task.status !== 'Done')
      .map((task) => {
        const dueAt = task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const group: AgendaGroup = task.status === 'Blocked'
          ? 'Blocked'
          : dueAt <= Date.now() + 86400000
            ? 'Now'
            : 'Later';
        return {
          id: task.id,
          kind: 'task',
          title: task.title,
          project: task.project,
          owner: task.owner,
          dueDate: task.dueDate,
          group,
          linkedFollowUpId: task.linkedFollowUpId,
          nextAction: task.nextStep,
          summary: task.summary,
        };
      });

    return [...followUps, ...tasksOpen];
  }, [items, tasks]);

  const grouped = useMemo(
    () => ({
      Now: agenda.filter((entry) => entry.group === 'Now'),
      Waiting: agenda.filter((entry) => entry.group === 'Waiting'),
      Blocked: agenda.filter((entry) => entry.group === 'Blocked'),
      Later: agenda.filter((entry) => entry.group === 'Later'),
    }),
    [agenda],
  );

  const selected = selectedKey
    ? agenda.find((entry) => `${entry.kind}:${entry.id}` === selectedKey) ?? null
    : agenda[0] ?? null;

  const selectEntry = (entry: AgendaEntry) => {
    setSelectedKey(`${entry.kind}:${entry.id}`);
    if (entry.kind === 'followup') {
      setSelectedId(entry.id);
      setSelectedTaskId(null);
    } else {
      setSelectedTaskId(entry.id);
    }
    setEditDraft(entry.nextAction);
  };

  const markDone = (entry: AgendaEntry) => {
    if (entry.kind === 'followup') {
      updateItem(entry.id, { status: 'Closed' });
    } else {
      updateTask(entry.id, { status: 'Done' });
    }
  };

  const snooze = (entry: AgendaEntry) => {
    if (entry.kind === 'followup') {
      snoozeItem(entry.id, 2);
    } else {
      const task = tasks.find((candidate) => candidate.id === entry.id);
      updateTask(entry.id, { dueDate: addDaysIso(task?.dueDate || todayIso(), 2) });
    }
  };

  const defer = (entry: AgendaEntry, days: number) => {
    if (entry.kind === 'followup') {
      updateItem(entry.id, { nextTouchDate: addDaysIso(todayIso(), days) });
      return;
    }
    updateTask(entry.id, { dueDate: addDaysIso(todayIso(), days) });
  };

  const saveNextAction = (entry: AgendaEntry) => {
    if (entry.kind === 'followup') {
      updateItem(entry.id, { nextAction: editDraft, timeline: [buildTouchEvent('Next action updated from personal agenda.'), ...items.find((x) => x.id === entry.id)!.timeline] });
    } else {
      updateTask(entry.id, { nextStep: editDraft });
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-950">My overview</h2>
        <p className="text-sm text-slate-500">One place for follow-ups and tasks. Type stays in the background.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {(['Now', 'Waiting', 'Blocked', 'Later'] as AgendaGroup[]).map((group) => (
            <div key={group} className="rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{group} <span className="text-xs text-slate-500">({grouped[group].length})</span></div>
              <div className="space-y-2 p-2">
                {grouped[group].map((entry) => (
                  <button key={`${entry.kind}:${entry.id}`} onClick={() => selectEntry(entry)} className={`w-full rounded-xl border p-3 text-left ${selected && selected.id === entry.id && selected.kind === entry.kind ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="text-sm font-semibold">{entry.title}</div>
                    <div className={`mt-1 text-xs ${selected && selected.id === entry.id && selected.kind === entry.kind ? 'text-slate-300' : 'text-slate-500'}`}>
                      {entry.project} · {formatDate(entry.dueDate)} · {entry.owner}
                      {entry.linkedFollowUpId ? ' · Linked thread' : ''}
                    </div>
                  </button>
                ))}
                {grouped[group].length === 0 ? <div className="px-2 py-4 text-xs text-slate-500">Nothing here right now.</div> : null}
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {!selected ? <div className="text-sm text-slate-500">Select an item to see actions.</div> : (
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Focused item</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{selected.title}</div>
                <div className="text-xs text-slate-600">{selected.project} · {selected.kind === 'followup' ? 'Follow-up' : 'Task'}</div>
              </div>
              <div className="grid gap-2">
                <button onClick={() => markDone(selected)} className="action-btn justify-start"><CheckCircle2 className="h-4 w-4" />Done / Close</button>
                <button onClick={() => snooze(selected)} className="action-btn justify-start"><Clock3 className="h-4 w-4" />Snooze</button>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">Defer</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => defer(selected, 1)} className="action-btn !px-2 !py-1 text-xs">Not today</button>
                  <button onClick={() => defer(selected, 2)} className="action-btn !px-2 !py-1 text-xs">Tomorrow</button>
                  <button onClick={() => defer(selected, 7)} className="action-btn !px-2 !py-1 text-xs">Next week</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Edit next action</label>
                <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} className="field-textarea mt-1 !min-h-[80px]" />
                <button onClick={() => saveNextAction(selected)} className="mt-2 action-btn"><Edit3 className="h-4 w-4" />Save</button>
              </div>
              {selected.kind === 'followup' || selected.linkedFollowUpId ? (
                <button
                  onClick={() => openDraftModal(selected.kind === 'followup' ? selected.id : selected.linkedFollowUpId!)}
                  className="action-btn justify-start"
                >
                  <MailPlus className="h-4 w-4" />Draft follow-up
                </button>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                  <PauseCircle className="mr-1 inline h-3 w-3" />
                  No linked follow-up yet for drafting.
                </div>
              )}
              <div className="rounded-xl bg-white p-2 text-xs text-slate-600">
                Suggested next move: {selected.kind === 'followup' && needsNudge(items.find((item) => item.id === selected.id)!) ? 'You likely need to follow up here.' : (selected.nextAction || 'Capture a clear next action.')}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
