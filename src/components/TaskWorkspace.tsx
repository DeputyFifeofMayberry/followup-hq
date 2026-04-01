import { CheckCircle2, Clock3, Link2, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDate } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

function toneForStatus(status: string): string {
  switch (status) {
    case 'Done':
      return 'bg-emerald-100 text-emerald-700';
    case 'Blocked':
      return 'bg-rose-100 text-rose-700';
    case 'In progress':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function toneForPriority(priority: string): string {
  switch (priority) {
    case 'Critical':
      return 'bg-rose-100 text-rose-700';
    case 'High':
      return 'bg-amber-100 text-amber-700';
    case 'Medium':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
}

export function TaskWorkspace() {
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
  })));

  const owners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const ownerMatch = taskOwnerFilter === 'All' || task.owner === taskOwnerFilter;
    const statusMatch = taskStatusFilter === 'All' || task.status === taskStatusFilter;
    return ownerMatch && statusMatch;
  }), [tasks, taskOwnerFilter, taskStatusFilter]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const linkedFollowUp = selectedTask?.linkedFollowUpId ? items.find((item) => item.id === selectedTask.linkedFollowUpId) : null;

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
              <p className="mt-1 text-sm text-slate-500">Keep internal execution work separate from external follow-ups.</p>
            </div>
            <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_180px]">
            <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-slate-400">
              {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
            </select>
            <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as any)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-slate-400">
              {['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}
            </select>
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">{filteredTasks.length} visible</div>
          </div>

          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No tasks match the current filters.</div>
            ) : filteredTasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`w-full rounded-3xl border p-4 text-left transition ${selectedTask?.id === task.id ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{task.title}</div>
                    <div className={`mt-1 text-sm ${selectedTask?.id === task.id ? 'text-slate-300' : 'text-slate-500'}`}>{task.project}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className={`rounded-full px-2.5 py-1 ${selectedTask?.id === task.id ? 'bg-white/10 text-white' : toneForStatus(task.status)}`}>{task.status}</span>
                    <span className={`rounded-full px-2.5 py-1 ${selectedTask?.id === task.id ? 'bg-white/10 text-white' : toneForPriority(task.priority)}`}>{task.priority}</span>
                  </div>
                </div>
                <div className={`mt-3 grid gap-2 text-sm md:grid-cols-3 ${selectedTask?.id === task.id ? 'text-slate-200' : 'text-slate-600'}`}>
                  <div><span className="font-medium">Owner:</span> {task.owner}</div>
                  <div><span className="font-medium">Due:</span> {formatDate(task.dueDate)}</div>
                  <div><span className="font-medium">Next:</span> {task.nextStep || '—'}</div>
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
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.status}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due date</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.dueDate)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.priority}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Linked follow-up</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{linkedFollowUp ? linkedFollowUp.title : 'Not linked yet'}</div>
                </div>
              </div>

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
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTask.tags.length ? selectedTask.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{tag}</span>) : <span className="text-sm text-slate-500">No tags yet.</span>}
                </div>
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
