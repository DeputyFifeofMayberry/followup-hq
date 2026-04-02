import { CheckCircle2, Clock3, Link2, ListTodo, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDate, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

type TaskMode = 'today' | 'thisWeek' | 'blocked' | 'followUpLinked';

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean }) {
  const {
    tasks,
    items,
    projects,
    selectedTaskId,
    taskOwnerFilter,
    taskStatusFilter,
    setSelectedTaskId,
    setTaskOwnerFilter,
    setTaskStatusFilter,
    openCreateTaskModal,
    openEditTaskModal,
    deleteTask,
    updateTask,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    items: s.items,
    projects: s.projects,
    selectedTaskId: s.selectedTaskId,
    taskOwnerFilter: s.taskOwnerFilter,
    taskStatusFilter: s.taskStatusFilter,
    setSelectedTaskId: s.setSelectedTaskId,
    setTaskOwnerFilter: s.setTaskOwnerFilter,
    setTaskStatusFilter: s.setTaskStatusFilter,
    openCreateTaskModal: s.openCreateTaskModal,
    openEditTaskModal: s.openEditTaskModal,
    deleteTask: s.deleteTask,
    updateTask: s.updateTask,
  })));

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'priority' | 'updated'>('due');
  const [mode, setMode] = useState<TaskMode>('today');

  const owners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const weekEnd = now + 7 * 86400000;
    const withFilters = tasks.filter((task) => {
      const ownerMatch = taskOwnerFilter === 'All' || task.owner === taskOwnerFilter;
      const statusMatch = taskStatusFilter === 'All' || task.status === taskStatusFilter;
      const textMatch = [task.title, task.project, task.summary, task.nextStep, task.notes, task.tags.join(' ')].join(' ').toLowerCase().includes(search.toLowerCase());
      const modeMatch = mode === 'today'
        ? task.status !== 'Done' && !!task.dueDate && new Date(task.dueDate).getTime() <= now + 86400000
        : mode === 'thisWeek'
          ? task.status !== 'Done' && !!task.dueDate && new Date(task.dueDate).getTime() <= weekEnd
          : mode === 'blocked'
            ? task.status === 'Blocked'
            : !!task.linkedFollowUpId;
      return ownerMatch && statusMatch && textMatch && modeMatch;
    });

    return [...withFilters].sort((a, b) => {
      if (sortBy === 'priority') {
        const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      if (sortBy === 'updated') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [tasks, taskOwnerFilter, taskStatusFilter, search, sortBy, mode]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const linkedFollowUp = selectedTask?.linkedFollowUpId ? items.find((item) => item.id === selectedTask.linkedFollowUpId) : null;
  const childTasks = selectedTask?.linkedFollowUpId ? tasks.filter((task) => task.linkedFollowUpId === selectedTask.linkedFollowUpId && task.id !== selectedTask.id) : [];

  const summary = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 2 * 86400000).length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    done: tasks.filter((task) => task.status === 'Done').length,
  }), [tasks]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open tasks', value: summary.open, helper: 'Internal work still in motion', icon: ListTodo },
          { label: 'Due soon', value: summary.dueSoon, helper: 'Due within the next 2 days', icon: Clock3 },
          { label: 'Blocked', value: summary.blocked, helper: 'Waiting on input or access', icon: Link2 },
          { label: 'Done', value: summary.done, helper: 'Completed items kept for record', icon: CheckCircle2 },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500">{card.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</div>
                  <div className="mt-2 text-xs text-slate-500">{card.helper}</div>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><Icon className="h-5 w-5" /></div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Tasks</h2>
              <p className="mt-1 text-sm text-slate-500">Work by mode: today, this week, blocked, or linked to a follow-up.</p>
            </div>
            <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            {[
              { key: 'today', label: 'Today' },
              { key: 'thisWeek', label: 'Due this week' },
              { key: 'blocked', label: 'Blocked by' },
              { key: 'followUpLinked', label: 'From follow-ups' },
            ].map((entry) => (
              <button key={entry.key} onClick={() => setMode(entry.key as TaskMode)} className={mode === entry.key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
                {entry.label}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 ${personalMode ? 'md:grid-cols-[minmax(0,1fr)_180px_180px]' : 'md:grid-cols-[minmax(0,1fr)_180px_180px_180px]'}`}>
            <label className="field-block">
              <span className="field-label">Search tasks</span>
              <div className="search-field-wrap">
                <Search className="search-field-icon h-4 w-4" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, project, next step, notes" className="field-input search-field-input" />
              </div>
            </label>
            {!personalMode ? (
              <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="field-input">
                {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
              </select>
            ) : null}
            <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">
              {['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="field-input">
              <option value="due">Sort: due date</option>
              <option value="priority">Sort: priority</option>
              <option value="updated">Sort: recently updated</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No tasks match the current filters and work mode.</div>
            ) : filteredTasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`w-full rounded-3xl border p-4 text-left transition ${selectedTask?.id === task.id ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{task.title}</div>
                    <div className={`mt-1 text-sm ${selectedTask?.id === task.id ? 'text-slate-300' : 'text-slate-500'}`}>{task.project}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium" onClick={(event) => event.stopPropagation()}>
                    <select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as typeof task.status })} className={`field-input !w-[130px] !py-1.5 text-xs ${selectedTask?.id === task.id ? '!bg-white/10 !text-white' : ''}`}>
                      {['To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as typeof task.priority })} className={`field-input !w-[120px] !py-1.5 text-xs ${selectedTask?.id === task.id ? '!bg-white/10 !text-white' : ''}`}>
                      {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </div>
                </div>
                <div className={`mt-3 grid gap-2 text-sm md:grid-cols-3 ${selectedTask?.id === task.id ? 'text-slate-200' : 'text-slate-600'}`} onClick={(event) => event.stopPropagation()}>
                  <label className="text-xs">{personalMode ? 'Contact' : 'Owner'}
                    {personalMode ? (
                      <div className="mt-1 rounded-xl bg-slate-100 px-2 py-2 text-xs text-slate-700">{task.owner || '—'}</div>
                    ) : (
                      <select value={task.owner} onChange={(event) => updateTask(task.id, { owner: event.target.value })} className="field-input !mt-1 !py-1.5 text-xs">
                        {owners.filter((entry) => entry !== 'All').map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                        <option value="Unassigned">Unassigned</option>
                      </select>
                    )}
                  </label>
                  <label className="text-xs">Due
                    <input type="date" value={toDateInputValue(task.dueDate)} onChange={(event) => updateTask(task.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input !mt-1 !py-1.5 text-xs" />
                  </label>
                  <label className="text-xs">Next step
                    <input value={task.nextStep} onChange={(event) => updateTask(task.id, { nextStep: event.target.value })} className="field-input !mt-1 !py-1.5 text-xs" placeholder="Next step" />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      updateTask(task.id, { status: 'Done' });
                    }}
                    className="action-btn !px-2.5 !py-1.5 text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />Quick complete
                  </button>
                  {task.linkedFollowUpId ? (
                    <button onClick={(event) => {
                      event.stopPropagation();
                      onOpenLinkedFollowUp(task.linkedFollowUpId!);
                    }} className="action-btn !px-2.5 !py-1.5 text-xs">
                      Jump to linked follow-up
                    </button>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedTask ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task detail</div>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">{selectedTask.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedTask.project} · {selectedTask.owner}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button>
                  <button onClick={() => deleteTask(selectedTask.id)} className="action-btn text-rose-600"><Trash2 className="h-4 w-4" />Delete</button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.status}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due date</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.dueDate)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.priority}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Linked follow-up</div><div className="mt-2 text-sm font-medium text-slate-900">{linkedFollowUp ? linkedFollowUp.title : 'Not linked yet'}</div></div>
              </div>

              {linkedFollowUp ? (
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connected workflow</div>
                  <div className="mt-2 text-sm text-slate-700">This task came from follow-up <span className="font-medium text-slate-900">{linkedFollowUp.title}</span>.</div>
                  <div className="mt-1 text-sm text-slate-700">Linked status: <span className="font-medium text-slate-900">{linkedFollowUp.status}</span> • Next action: <span className="font-medium text-slate-900">{linkedFollowUp.nextAction || 'Not set'}</span></div>
                  <div className="mt-1 text-sm text-slate-700">{childTasks.length} sibling task{childTasks.length === 1 ? '' : 's'} linked to this same follow-up.</div>
                  <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="mt-3 action-btn !px-2.5 !py-1.5 text-xs">Open linked follow-up</button>
                </div>
              ) : null}

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Summary</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.summary || 'No summary added yet.'}</p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next step</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.nextStep || 'No next step captured yet.'}</p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTask.notes || 'No notes yet.'}</p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project match</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{projects.find((project) => project.id === selectedTask.projectId)?.notes || 'This task is using the current project record only.'}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">Select a task to see details.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
