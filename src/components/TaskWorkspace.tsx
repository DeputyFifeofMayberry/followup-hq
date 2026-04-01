import { CheckCircle2, ClipboardList, Clock3, Link2, Plus, Search, SquarePen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../lib/utils';
import type { TaskRecord, TaskStatus } from '../types';

const taskViews = ['All', 'Mine', 'Due this week', 'Blocked', 'Done'] as const;
type TaskView = (typeof taskViews)[number];

function isTaskOverdue(task: TaskRecord): boolean {
  return task.status !== 'Done' && new Date(task.dueDate).getTime() < Date.now();
}

function dueSoon(task: TaskRecord): boolean {
  if (task.status === 'Done') return false;
  const diff = new Date(task.dueDate).getTime() - Date.now();
  return diff <= 3 * 86400000;
}

function taskStatusTone(status: TaskStatus): 'neutral' | 'warn' | 'danger' | 'success' | 'blue' {
  switch (status) {
    case 'Blocked':
      return 'danger';
    case 'Waiting on input':
      return 'warn';
    case 'Done':
      return 'success';
    case 'In progress':
      return 'blue';
    default:
      return 'neutral';
  }
}

function taskPriorityTone(priority: TaskRecord['priority']): 'neutral' | 'warn' | 'danger' | 'success' {
  switch (priority) {
    case 'Critical':
      return 'danger';
    case 'High':
      return 'warn';
    case 'Low':
      return 'success';
    default:
      return 'neutral';
  }
}

export function TaskWorkspace() {
  const {
    tasks,
    projects,
    items,
    contacts,
    companies,
    selectedTaskId,
    setSelectedTaskId,
    openCreateTaskModal,
    openEditTaskModal,
    updateTask,
    deleteTask,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    projects: s.projects,
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    selectedTaskId: s.selectedTaskId,
    setSelectedTaskId: s.setSelectedTaskId,
    openCreateTaskModal: s.openCreateTaskModal,
    openEditTaskModal: s.openEditTaskModal,
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
  })));

  const [view, setView] = useState<TaskView>('All');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.project,
        task.owner,
        task.summary,
        task.nextStep,
        task.tags.join(' '),
        items.find((item) => item.id === task.linkedFollowUpId)?.title ?? '',
      ].join(' ').toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesProject = projectFilter === 'All' || task.project === projectFilter;
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesView = (() => {
        switch (view) {
          case 'Mine':
            return task.owner.toLowerCase() === 'jared';
          case 'Due this week':
            return dueSoon(task) || isTaskOverdue(task);
          case 'Blocked':
            return task.status === 'Blocked' || task.status === 'Waiting on input';
          case 'Done':
            return task.status === 'Done';
          default:
            return true;
        }
      })();

      return matchesSearch && matchesProject && matchesStatus && matchesView;
    });
  }, [items, projectFilter, search, statusFilter, tasks, view]);

  const selectedTask = useMemo(() => filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null, [filteredTasks, selectedTaskId, tasks]);

  const stats = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter(dueSoon).length,
    blocked: tasks.filter((task) => task.status === 'Blocked' || task.status === 'Waiting on input').length,
    done: tasks.filter((task) => task.status === 'Done').length,
  }), [tasks]);

  const projectOptions = useMemo(() => ['All', ...projects.map((project) => project.name)], [projects]);
  const statuses: Array<'All' | TaskStatus> = ['All', 'To do', 'In progress', 'Waiting on input', 'Blocked', 'Done'];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tasks</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Internal work, kept separate from outside follow-ups.</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">Track what your team actually needs to do, without mixing it into the nudge queue. Link a task to a follow-up when the two are related, but keep the workboards separate.</p>
              </div>
              <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Open tasks', value: stats.open, helper: 'Everything not done yet', icon: ClipboardList },
                { label: 'Due soon', value: stats.dueSoon, helper: 'Due within 3 days', icon: Clock3 },
                { label: 'Blocked / waiting', value: stats.blocked, helper: 'Needs input or is stuck', icon: Link2 },
                { label: 'Done', value: stats.done, helper: 'Closed out cleanly', icon: CheckCircle2 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-500">{stat.label}</div>
                        <div className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</div>
                        <div className="mt-1 text-xs text-slate-500">{stat.helper}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm"><Icon className="h-5 w-5" /></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {taskViews.map((entry) => (
                <button key={entry} onClick={() => setView(entry)} className={view === entry ? 'saved-view-card saved-view-card-active !w-auto !px-4 !py-3' : 'saved-view-card !w-auto !px-4 !py-3'}>
                  {entry}
                </button>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by task, next step, project, or linked follow-up" className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" />
                </label>
                <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100">
                  {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | TaskStatus)} className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100">
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => selectedTask && openEditTaskModal(selectedTask.id)} disabled={!selectedTask} className="action-btn disabled:cursor-not-allowed disabled:opacity-50"><SquarePen className="h-4 w-4" />Edit</button>
                <button onClick={() => selectedTask && updateTask(selectedTask.id, { status: selectedTask.status === 'Done' ? 'To do' : 'Done' })} disabled={!selectedTask} className="action-btn disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{selectedTask?.status === 'Done' ? 'Reopen' : 'Mark done'}</button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Linked follow-up</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const linkedItem = items.find((item) => item.id === task.linkedFollowUpId);
                  const active = selectedTask?.id === task.id;
                  return (
                    <tr key={task.id} className={active ? 'bg-sky-50/70' : 'hover:bg-slate-50'} onClick={() => setSelectedTaskId(task.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{task.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{task.project} • {task.id}</div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={taskStatusTone(task.status)}>{task.status}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={taskPriorityTone(task.priority)}>{task.priority}</Badge></td>
                      <td className="px-4 py-3 text-slate-700">{task.owner}</td>
                      <td className="px-4 py-3">
                        <div className={isTaskOverdue(task) ? 'font-medium text-rose-700' : 'text-slate-700'}>{formatDate(task.dueDate)}</div>
                        <div className="text-xs text-slate-500">{task.status === 'Done' ? 'Completed' : dueSoon(task) ? 'Due soon' : 'Planned'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{linkedItem ? linkedItem.title : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={(event) => { event.stopPropagation(); openEditTaskModal(task.id); }} className="action-btn !px-2.5 !py-1.5 text-xs">Edit</button>
                          <button onClick={(event) => { event.stopPropagation(); updateTask(task.id, { status: task.status === 'Done' ? 'To do' : 'Done' }); }} className="action-btn !px-2.5 !py-1.5 text-xs">{task.status === 'Done' ? 'Reopen' : 'Done'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredTasks.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No tasks match the current filters.</div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task detail</div>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">{selectedTask?.title ?? 'Select a task'}</h3>
            </div>
            {selectedTask ? <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn">Edit</button> : null}
          </div>

          {selectedTask ? (() => {
            const linkedItem = items.find((item) => item.id === selectedTask.linkedFollowUpId);
            const contact = contacts.find((entry) => entry.id === selectedTask.contactId);
            const company = companies.find((entry) => entry.id === selectedTask.companyId);
            return (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={taskStatusTone(selectedTask.status)}>{selectedTask.status}</Badge>
                  <Badge variant={taskPriorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
                  {isTaskOverdue(selectedTask) ? <Badge variant="danger">Overdue</Badge> : null}
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <div><span className="font-medium text-slate-900">Project:</span> {selectedTask.project}</div>
                  <div><span className="font-medium text-slate-900">Owner:</span> {selectedTask.owner}</div>
                  <div><span className="font-medium text-slate-900">Due:</span> {formatDate(selectedTask.dueDate)}</div>
                  <div><span className="font-medium text-slate-900">Start:</span> {formatDate(selectedTask.startDate)}</div>
                  <div><span className="font-medium text-slate-900">Contact:</span> {contact?.name ?? '—'}</div>
                  <div><span className="font-medium text-slate-900">Company:</span> {company?.name ?? '—'}</div>
                  <div><span className="font-medium text-slate-900">Linked follow-up:</span> {linkedItem?.title ?? 'Not linked'}</div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Summary</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTask.summary || 'No summary yet.'}</p>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Next step</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTask.nextStep || 'No next step recorded yet.'}</p>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">{selectedTask.notes || 'No notes yet.'}</div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Timeline</div>
                  <div className="mt-3 space-y-3">
                    {selectedTask.timeline.slice(0, 6).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">{formatDate(entry.at)}</div>
                        <div className="mt-1 text-sm text-slate-700">{entry.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updateTask(selectedTask.id, { status: selectedTask.status === 'Done' ? 'To do' : 'Done' })} className="primary-btn">{selectedTask.status === 'Done' ? 'Reopen task' : 'Mark done'}</button>
                  <button onClick={() => deleteTask(selectedTask.id)} className="action-btn">Delete</button>
                </div>
              </div>
            );
          })() : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Select a task to review the internal work scope, due date, linked follow-up, and next step.</div>}
        </section>
      </aside>
    </div>
  );
}
