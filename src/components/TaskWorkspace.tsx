import { CheckCircle2, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { formatDate, fromDateInputValue, priorityTone, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile } from './ui/AppPrimitives';

type TaskMode = 'today' | 'thisWeek' | 'blocked' | 'followUpLinked';

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean }) {
  const { tasks, items, projects, selectedTaskId, taskOwnerFilter, taskStatusFilter, setSelectedTaskId, setTaskOwnerFilter, setTaskStatusFilter, openCreateTaskModal, openEditTaskModal, deleteTask, updateTask } = useAppStore(useShallow((s) => ({
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
  }), [tasks]);

  return (
    <div className="space-y-5">
      <div className="overview-stat-grid overview-stat-grid-compact">
        <StatTile label="Open tasks" value={summary.open} helper="Still in motion" />
        <StatTile label="Due soon" value={summary.dueSoon} helper="Within 2 days" />
        <StatTile label="Blocked" value={summary.blocked} helper="Waiting on dependency" tone={summary.blocked ? 'warn' : 'default'} />
      </div>

      <div className="workspace-master-detail">
        <AppShellCard className="workspace-list-panel">
          <SectionHeader title="Tasks" subtitle="Scan-first queue with essential controls inline." actions={<button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>} />
          <FilterBar>
            <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'today', label: 'Due now' }, { value: 'thisWeek', label: 'This week' }, { value: 'blocked', label: 'Blocked' }, { value: 'followUpLinked', label: 'Linked' }]} />
          </FilterBar>

          <div className={`grid gap-3 ${personalMode ? 'md:grid-cols-[minmax(0,1fr)_180px_180px]' : 'md:grid-cols-[minmax(0,1fr)_180px_180px_180px]'}`}>
            <label className="field-block">
              <span className="field-label">Search</span>
              <div className="search-field-wrap"><Search className="search-field-icon h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, next step, project" className="field-input search-field-input" /></div>
            </label>
            {!personalMode ? <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select> : null}
            <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="field-input"><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="updated">Sort: recently updated</option></select>
          </div>

          <div className="workspace-list-content">
            {filteredTasks.length === 0 ? (
              <EmptyState title="No tasks in this view" message="Try a different filter or add a task." />
            ) : filteredTasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`workspace-data-row workspace-data-row-compact ${selectedTask?.id === task.id ? 'workspace-data-row-active' : ''}`}>
                <div className="workspace-data-row-main">
                  <div>
                    <div className="text-sm font-semibold">{task.title}</div>
                    <div className={`mt-1 text-xs ${selectedTask?.id === task.id ? 'text-slate-300' : 'text-slate-500'}`}>{task.project} • {task.nextStep || 'No next step set'}</div>
                  </div>
                  <div className="workspace-data-row-controls" onClick={(event) => event.stopPropagation()}>
                    <select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as typeof task.status })} className={`field-input !w-[126px] !py-1.5 text-xs ${selectedTask?.id === task.id ? '!bg-white/10 !text-white' : ''}`}>
                      {['To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as typeof task.priority })} className={`field-input !w-[112px] !py-1.5 text-xs ${selectedTask?.id === task.id ? '!bg-white/10 !text-white' : ''}`}>
                      {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                    <input type="date" value={toDateInputValue(task.dueDate)} onChange={(event) => updateTask(task.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className={`field-input !w-[142px] !py-1.5 text-xs ${selectedTask?.id === task.id ? '!bg-white/10 !text-white' : ''}`} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={task.status === 'Blocked' ? 'warn' : task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge>
                  <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                  {task.linkedFollowUpId ? <Badge variant="neutral">Linked follow-up</Badge> : null}
                  <button onClick={(event) => { event.stopPropagation(); updateTask(task.id, { status: 'Done' }); }} className="action-btn !px-2.5 !py-1 text-xs"><CheckCircle2 className="h-4 w-4" />Done</button>
                </div>
              </button>
            ))}
          </div>
        </AppShellCard>

        <aside className="workspace-inspector-panel">
          {selectedTask ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task detail</div>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">{selectedTask.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedTask.project} · {selectedTask.owner}</p>
                </div>
                <div className="flex gap-2"><button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button><button onClick={() => deleteTask(selectedTask.id)} className="action-btn text-rose-600"><Trash2 className="h-4 w-4" />Delete</button></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.status}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due date</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.dueDate)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.priority}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Linked follow-up</div><div className="mt-2 text-sm font-medium text-slate-900">{linkedFollowUp ? linkedFollowUp.title : 'Not linked yet'}</div></div>
              </div>
              {linkedFollowUp ? <div className="rounded-2xl border border-slate-200 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connected workflow</div><div className="mt-2 text-sm text-slate-700">Linked status: <span className="font-medium text-slate-900">{linkedFollowUp.status}</span> • {childTasks.length} sibling task{childTasks.length === 1 ? '' : 's'}</div><button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="mt-3 action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open linked follow-up</button></div> : null}
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Summary</div><p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.summary || 'No summary added yet.'}</p></div>
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project match</div><p className="mt-2 text-sm leading-6 text-slate-700">{projects.find((project) => project.id === selectedTask.projectId)?.notes || 'This task is using the current project record only.'}</p></div>
            </div>
          ) : (<EmptyState title="No task selected" message="Select a task to see details and actions." />)}
        </aside>
      </div>
    </div>
  );
}
