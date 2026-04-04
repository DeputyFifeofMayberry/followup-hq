import { CheckCircle2, ChevronDown, Link2, Pencil, Plus, Search, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, formatDate, fromDateInputValue, isTaskDeferred, isTaskOverdue, priorityTone, taskWorkflowState, toDateInputValue, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceToolbarRow } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import type { AppMode, FollowUpStatus, TaskItem } from '../types';

type TaskMode = 'dueNow' | 'thisWeek' | 'blocked' | 'deferred' | 'atRiskLinked' | 'cleanup' | 'unlinked' | 'recent';

const modeOptions: Array<{ value: TaskMode; label: string }> = [
  { value: 'dueNow', label: 'Due now' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'atRiskLinked', label: 'Linked risk' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'unlinked', label: 'Unlinked' },
  { value: 'recent', label: 'Recently updated' },
];

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean; appMode?: AppMode }) {
  const { tasks, items, projects, selectedTaskId, taskOwnerFilter, taskStatusFilter, setSelectedTaskId, setTaskOwnerFilter, setTaskStatusFilter, openCreateTaskModal, openEditTaskModal, deleteTask, updateTask, attemptTaskTransition } = useAppStore(useShallow((s) => ({
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
    attemptTaskTransition: s.attemptTaskTransition,
  })));

  const modeConfig = getModeConfig(appMode);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'priority' | 'updated'>('due');
  const [mode, setMode] = useState<TaskMode>('dueNow');
  const [projectFilter, setProjectFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [parentStatusFilter, setParentStatusFilter] = useState<'All' | FollowUpStatus>('All');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [deferredOnly, setDeferredOnly] = useState(false);
  const [cleanupOnly, setCleanupOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');

  const owners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.assigneeDisplayName || task.owner))).sort()], [tasks]);
  const projectOptions = useMemo(() => ['All', ...projects.map((project) => project.name)], [projects]);
  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((task) => task.tags))).sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const weekEnd = now + 7 * 86400000;
    const modeMatched = tasks.filter((task) => {
      const parent = task.linkedFollowUpId ? items.find((item) => item.id === task.linkedFollowUpId) : undefined;
      switch (mode) {
        case 'dueNow':
          return task.status !== 'Done' && !!task.dueDate && new Date(task.dueDate).getTime() <= now + 86400000;
        case 'thisWeek':
          return task.status !== 'Done' && !!task.dueDate && new Date(task.dueDate).getTime() <= weekEnd;
        case 'blocked':
          return task.status === 'Blocked';
        case 'deferred':
          return isTaskDeferred(task);
        case 'atRiskLinked':
          return !!parent && (parent.status === 'At risk' || parent.escalationLevel === 'Critical');
        case 'cleanup':
          return !!task.needsCleanup;
        case 'unlinked':
          return !task.linkedFollowUpId;
        case 'recent':
          return new Date(task.updatedAt).getTime() >= now - 3 * 86400000;
        default:
          return true;
      }
    });

    const withFilters = modeMatched.filter((task) => {
      const parent = task.linkedFollowUpId ? items.find((item) => item.id === task.linkedFollowUpId) : undefined;
      const ownerMatch = taskOwnerFilter === 'All' || task.owner === taskOwnerFilter;
      const statusMatch = taskStatusFilter === 'All' || task.status === taskStatusFilter;
      const projectMatch = projectFilter === 'All' || task.project === projectFilter;
      const assigneeMatch = assigneeFilter === 'All' || (task.assigneeDisplayName || task.owner) === assigneeFilter;
      const linkedMatch = linkedFilter === 'all' || (linkedFilter === 'linked' ? !!task.linkedFollowUpId : !task.linkedFollowUpId);
      const parentStatusMatch = parentStatusFilter === 'All' || parent?.status === parentStatusFilter;
      const blockedMatch = !blockedOnly || task.status === 'Blocked';
      const deferredMatch = !deferredOnly || isTaskDeferred(task);
      const cleanupMatch = !cleanupOnly || !!task.needsCleanup;
      const tagMatch = !tagFilter || task.tags.includes(tagFilter);
      const textMatch = [task.title, task.project, task.summary, task.nextStep, task.notes, task.contextNote, task.blockReason, task.tags.join(' ')].join(' ').toLowerCase().includes(search.toLowerCase());
      return ownerMatch && statusMatch && projectMatch && assigneeMatch && linkedMatch && parentStatusMatch && blockedMatch && deferredMatch && cleanupMatch && tagMatch && textMatch;
    });

    return [...withFilters].sort((a, b) => {
      if (sortBy === 'priority') {
        const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      if (sortBy === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [tasks, items, taskOwnerFilter, taskStatusFilter, search, sortBy, mode, projectFilter, assigneeFilter, linkedFilter, parentStatusFilter, blockedOnly, deferredOnly, cleanupOnly, tagFilter]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const linkedFollowUp = selectedTask?.linkedFollowUpId ? items.find((item) => item.id === selectedTask.linkedFollowUpId) : null;
  const parentWorkflow = selectedTask?.linkedFollowUpId ? tasks.filter((task) => task.linkedFollowUpId === selectedTask.linkedFollowUpId) : [];
  const parentOpen = parentWorkflow.filter((task) => task.status !== 'Done').length;
  const parentBlocked = parentWorkflow.filter((task) => task.status === 'Blocked').length;
  const parentOverdue = parentWorkflow.filter((task) => isTaskOverdue(task)).length;

  const summary = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 2 * 86400000).length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    deferred: tasks.filter((task) => isTaskDeferred(task)).length,
  }), [tasks]);

  const resetFilters = () => {
    setTaskOwnerFilter('All');
    setTaskStatusFilter('All');
    setProjectFilter('All');
    setAssigneeFilter('All');
    setLinkedFilter('all');
    setParentStatusFilter('All');
    setBlockedOnly(false);
    setDeferredOnly(false);
    setCleanupOnly(false);
    setTagFilter('');
    setSearch('');
    setMode('dueNow');
  };

  const updateTaskWithStatus = (task: TaskItem, status: TaskItem['status']) => {
    const now = todayIso();
    const patch: Partial<TaskItem> =
      status === 'Done'
        ? { completionNote: task.completionNote || window.prompt('Completion note:', '') || undefined, completedAt: now }
        : status === 'Blocked'
          ? { blockReason: task.blockReason || window.prompt('Block reason:', '') || undefined, nextReviewAt: task.nextReviewAt || addDaysIso(now, 1) }
          : status === 'In progress'
            ? { startedAt: task.startedAt || now }
            : {};
    const result = attemptTaskTransition(task.id, status, patch);
    if (!result.applied) {
      window.alert(result.validation.blockers.join(' '));
      return;
    }
    if (result.validation.warnings.length) window.alert(result.validation.warnings.join('\n'));
  };

  return (
    <WorkspacePage>
      <WorkspaceSummaryStrip>
        <SectionHeader title="Task execution workspace" subtitle={modeConfig.taskSubtitle} actions={<button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>} compact />
        <div className="overview-stat-grid overview-stat-grid-compact">
          <StatTile label="Open tasks" value={summary.open} helper="Still in motion" />
          <StatTile label="Due soon" value={summary.dueSoon} helper="Within 2 days" />
          <StatTile label="Blocked" value={summary.blocked} helper="Waiting on dependency" tone={summary.blocked ? 'warn' : 'default'} />
          <StatTile label="Deferred" value={summary.deferred} helper="Snoozed out of active queue" />
        </div>
      </WorkspaceSummaryStrip>

      <WorkspacePrimaryLayout inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel" surface="data">
          <FilterBar>
            <SegmentedControl value={mode} onChange={(value) => setMode(value as TaskMode)} options={modeOptions} />
          </FilterBar>

          <WorkspaceToolbarRow className="task-primary-controls">
            <label className="field-block">
              <span className="field-label">Search</span>
              <div className="search-field-wrap"><Search className="search-field-icon h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, block reason, context, tags" className="field-input search-field-input" /></div>
            </label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="field-input"><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="updated">Sort: recently updated</option></select>
            <select value={density} onChange={(event) => setDensity(event.target.value as typeof density)} className="field-input"><option value="compact">Compact rows</option><option value="comfortable">Comfortable rows</option></select>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select>
            <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />Advanced <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
          </WorkspaceToolbarRow>

          {advancedOpen ? (
            <div className="task-advanced-controls advanced-filter-surface">
              <div className={`grid gap-2 ${personalMode ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select>
                {!personalMode ? <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select> : null}
                <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select>
                {!personalMode ? <select value={parentStatusFilter} onChange={(event) => setParentStatusFilter(event.target.value as 'All' | FollowUpStatus)} className="field-input">{['All', 'Needs action', 'Waiting on external', 'Waiting internal', 'In progress', 'At risk', 'Closed'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All parent statuses' : `Parent: ${status}`}</option>)}</select> : null}
                <select value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value as typeof linkedFilter)} className="field-input"><option value="all">All linked states</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select>
                <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="field-input"><option value="">All tags</option>{allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setBlockedOnly((v) => !v)} className={`action-btn !px-2.5 !py-1 text-xs ${blockedOnly ? 'bg-slate-900 text-white' : ''}`}>Blocked only</button>
                <button onClick={() => setDeferredOnly((v) => !v)} className={`action-btn !px-2.5 !py-1 text-xs ${deferredOnly ? 'bg-slate-900 text-white' : ''}`}>Deferred only</button>
                <button onClick={() => setCleanupOnly((v) => !v)} className={`action-btn !px-2.5 !py-1 text-xs ${cleanupOnly ? 'bg-slate-900 text-white' : ''}`}>Cleanup only</button>
                <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset</button>
              </div>
            </div>
          ) : null}

          <div className="workspace-list-content task-list-content">
            {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try a different filter or add a task." /> : filteredTasks.map((task) => {
              const parent = task.linkedFollowUpId ? items.find((item) => item.id === task.linkedFollowUpId) : undefined;
              const workflowState = taskWorkflowState(task);
              return (
                <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`workspace-data-row ${density === 'compact' ? 'workspace-data-row-compact' : ''} task-work-row ${selectedTask?.id === task.id ? 'workspace-data-row-active list-row-family-active' : ''}`}>
                  <div className="workspace-data-row-main">
                    <div>
                      <div className="text-sm font-semibold">{task.title}</div>
                      <div className={`mt-1 text-xs ${selectedTask?.id === task.id ? 'text-slate-300' : 'text-slate-500'}`}>{task.project} • {task.nextStep || 'No next step set'}</div>
                      {task.blockReason && task.status === 'Blocked' ? <div className={`mt-1 text-xs ${selectedTask?.id === task.id ? 'text-amber-200' : 'text-amber-700'}`}>Blocked: {task.blockReason}</div> : null}
                    </div>
                    <div className="workspace-data-row-controls" onClick={(event) => event.stopPropagation()}>
                      <div className="task-row-display-chips">
                        <Badge variant={task.status === 'Blocked' ? 'warn' : task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge>
                        <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                        <Badge variant="neutral">{workflowState}</Badge>
                        <Badge variant="neutral">Due {formatDate(task.dueDate)}</Badge>
                      </div>
                      <div className="task-row-edit-controls">
                        <button onClick={() => updateTaskWithStatus(task, 'Done')} className="action-btn !px-2.5 !py-1 text-xs"><CheckCircle2 className="h-4 w-4" />Mark done</button>
                        <button onClick={() => updateTaskWithStatus(task, task.status === 'Blocked' ? 'In progress' : 'Blocked')} className="action-btn !px-2.5 !py-1 text-xs">{task.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                        <button onClick={() => { const deferTo = addDaysIso(todayIso(), 3); const result = attemptTaskTransition(task.id, task.status === 'Done' ? 'To do' : task.status, { deferredUntil: deferTo, nextReviewAt: deferTo, status: task.status === 'Done' ? 'To do' : task.status }); if (!result.applied) window.alert(result.validation.blockers.join(' ')); }} className="action-btn !px-2.5 !py-1 text-xs">Defer 3d</button>
                      </div>
                    </div>
                  </div>
                  <div className="task-row-footer">
                    {task.linkedFollowUpId ? <Badge variant="neutral">Linked follow-up</Badge> : <Badge variant="neutral">Unlinked</Badge>}
                    {parent ? <Badge variant={parent.status === 'At risk' ? 'danger' : 'neutral'}>Parent {parent.status}</Badge> : null}
                    {isTaskDeferred(task) ? <Badge variant="neutral">Deferred until {formatDate(task.deferredUntil)}</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </AppShellCard>

        <AppShellCard className="workspace-inspector-panel task-inspector-panel premium-inspector" surface="inspector">
          {selectedTask ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inspector-kicker">{personalMode ? 'Task execution panel' : 'Task coordination panel'}</div>
                  <h3 className="inspector-title">{selectedTask.title}</h3>
                  <p className="inspector-meta">{selectedTask.project} · {selectedTask.assigneeDisplayName || selectedTask.owner}</p>
                </div>
                <div className="flex gap-2"><button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button><button onClick={() => deleteTask(selectedTask.id)} className="action-btn text-rose-600"><Trash2 className="h-4 w-4" />Delete</button></div>
              </div>

              <div className="task-inspector-actions">
                <button onClick={() => updateTaskWithStatus(selectedTask, 'Done')} className="primary-btn">Mark done</button>
                <button onClick={() => updateTaskWithStatus(selectedTask, 'Blocked')} className="action-btn">Block</button>
                <button onClick={() => updateTask(selectedTask.id, { status: selectedTask.status === 'Blocked' ? 'In progress' : selectedTask.status, blockReason: undefined })} className="action-btn">Unblock</button>
                <button onClick={() => { const deferTo = addDaysIso(todayIso(), 2); const result = attemptTaskTransition(selectedTask.id, selectedTask.status, { deferredUntil: deferTo, nextReviewAt: deferTo }); if (!result.applied) window.alert(result.validation.blockers.join(' ')); }} className="action-btn">Defer / snooze</button>
                <button onClick={() => updateTask(selectedTask.id, { startDate: todayIso(), startedAt: selectedTask.startedAt || todayIso() })} className="action-btn">Start today</button>
                <button onClick={() => updateTask(selectedTask.id, { dueDate: addDaysIso(todayIso(), 1) })} className="action-btn">Due tomorrow</button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.status}</div></div>
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Impact</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.completionImpact || 'advance_parent'}</div></div>
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Start</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.startDate)}</div></div>
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.dueDate)}</div></div>
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Deferred until</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.deferredUntil)}</div></div>
                <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Block reason</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.blockReason || '—'}</div></div>
              </div>

              <div className="grid gap-3">
                <label className="field-block"><span className="field-label">Block reason</span><input value={selectedTask.blockReason || ''} onChange={(event) => updateTask(selectedTask.id, { blockReason: event.target.value, status: 'Blocked' })} className="field-input" /></label>
                <label className="field-block"><span className="field-label">Completion note</span><input value={selectedTask.completionNote || ''} onChange={(event) => updateTask(selectedTask.id, { completionNote: event.target.value })} className="field-input" /></label>
                <label className="field-block"><span className="field-label">Defer until</span><input type="date" value={toDateInputValue(selectedTask.deferredUntil)} onChange={(event) => updateTask(selectedTask.id, { deferredUntil: event.target.value ? fromDateInputValue(event.target.value) : undefined, nextReviewAt: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                <label className="field-block"><span className="field-label">Assignee</span><input value={selectedTask.assigneeDisplayName || selectedTask.owner} onChange={(event) => updateTask(selectedTask.id, { assigneeDisplayName: event.target.value })} className="field-input" /></label>
                <label className="field-block"><span className="field-label">Next step</span><textarea value={selectedTask.nextStep} onChange={(event) => updateTask(selectedTask.id, { nextStep: event.target.value })} className="field-textarea" /></label>
              </div>

              {linkedFollowUp ? <div className="rounded-2xl tonal-panel"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Parent workflow summary</div><div className="mt-2 text-sm text-slate-700">Parent: <span className="font-medium text-slate-900">{linkedFollowUp.title}</span> ({linkedFollowUp.status})</div><div className="mt-1 text-sm text-slate-700">Workflow summary: {parentWorkflow.length} total • {parentOpen} open • {parentBlocked} blocked • {parentOverdue} overdue</div><div className="mt-1 text-sm text-slate-700">Readiness: {parentOpen === 0 ? 'Ready to close/advance' : parentBlocked > 0 ? 'Blocked child pressure' : 'In progress'}</div><button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="mt-3 action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open detail</button></div> : null}
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Task purpose</div><p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.summary || 'No summary added yet.'}</p></div>
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Why task exists</div><p className="mt-2 text-sm leading-6 text-slate-700">{selectedTask.contextNote || selectedTask.linkedProjectContext || 'Execution support task.'}</p></div>
            </div>
          ) : (<EmptyState title="No task selected" message="Select a task to review details and actions." />)}
        </AppShellCard>
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
