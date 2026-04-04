import { CheckCircle2, ChevronDown, Link2, Pencil, Plus, Search, SlidersHorizontal, Trash2, Undo2, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { addDaysIso, formatDate, fromDateInputValue, isTaskDeferred, priorityTone, toDateInputValue, todayIso } from '../lib/utils';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile, WorkspaceInspectorSection, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceToolbarRow, WorkspaceTopStack } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import { useTasksViewModel } from '../domains/tasks';
import type { AppMode, FollowUpStatus, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { BlockReasonSection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';
import { describeExecutionIntent } from '../lib/executionHandoff';
import { getLinkedFollowUpForTask, getLinkedTasksForFollowUp } from '../lib/recordContext';
import { buildFollowUpChildRollup } from '../lib/childWorkRollups';

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
  const { tasks, items, projects, selectedTaskId, taskOwnerFilter, taskStatusFilter, setSelectedTaskId, setTaskOwnerFilter, setTaskStatusFilter, openCreateTaskModal, openEditTaskModal, deleteTask, updateTask, attemptTaskTransition, executionIntent, clearExecutionIntent } = useTasksViewModel();

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
  const [flowState, setFlowState] = useState<{ kind: 'done' | 'block' | 'unblock' | 'defer'; taskId: string } | null>(null);
  const [completionNoteDraft, setCompletionNoteDraft] = useState('');
  const [blockReasonDraft, setBlockReasonDraft] = useState('');
  const [deferDateDraft, setDeferDateDraft] = useState('');
  const [nextReviewDraft, setNextReviewDraft] = useState('');
  const [flowWarnings, setFlowWarnings] = useState<string[]>([]);
  const [flowBlockers, setFlowBlockers] = useState<string[]>([]);
  const [flowResult, setFlowResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);
  const [linkParentDraft, setLinkParentDraft] = useState('');
  const openRecordDrawer = useAppStore((s) => s.openRecordDrawer);

  useEffect(() => {
    if (executionIntent?.target !== 'tasks') return;
    if (executionIntent.recordType === 'task' && executionIntent.recordId) {
      setSelectedTaskId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedTaskId]);

  const owners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.assigneeDisplayName || task.owner))).sort()], [tasks]);
  const projectOptions = useMemo(() => ['All', ...projects.map((project) => project.name)], [projects]);
  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((task) => task.tags))).sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const weekEnd = now + 7 * 86400000;
    const modeMatched = tasks.filter((task) => {
      const parent = getLinkedFollowUpForTask(task, items) ?? undefined;
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
      const parent = getLinkedFollowUpForTask(task, items) ?? undefined;
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
  const linkedFollowUp = selectedTask ? getLinkedFollowUpForTask(selectedTask, items) : null;
  const linkedTaskOpenCount = linkedFollowUp ? getLinkedTasksForFollowUp(linkedFollowUp.id, tasks).filter((task) => task.status !== 'Done').length : 0;
  const linkedParentRollup = linkedFollowUp ? buildFollowUpChildRollup(linkedFollowUp.id, linkedFollowUp.status, tasks) : null;
  const parentCandidates = selectedTask ? items.filter((item) => item.project === selectedTask.project && item.status !== 'Closed') : [];

  const summary = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 2 * 86400000).length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    unlinked: tasks.filter((task) => !task.linkedFollowUpId && task.status !== 'Done').length,
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

  const openTaskFlow = (task: TaskItem, kind: 'done' | 'block' | 'unblock' | 'defer') => {
    setFlowState({ kind, taskId: task.id });
    setCompletionNoteDraft(task.completionNote || '');
    setBlockReasonDraft(task.blockReason || '');
    setDeferDateDraft((task.deferredUntil || addDaysIso(todayIso(), 2)).slice(0, 10));
    setNextReviewDraft((task.nextReviewAt || addDaysIso(todayIso(), 1)).slice(0, 10));
    setFlowWarnings([]);
    setFlowBlockers([]);
    setFlowResult(null);
  };

  const runTaskFlow = () => {
    if (!flowState) return;
    const task = tasks.find((entry) => entry.id === flowState.taskId);
    if (!task) return;
    const now = todayIso();
    const result = flowState.kind === 'done'
      ? attemptTaskTransition(task.id, 'Done', { completionNote: completionNoteDraft.trim() || undefined, completedAt: now })
      : flowState.kind === 'block'
        ? attemptTaskTransition(task.id, 'Blocked', {
          blockReason: blockReasonDraft.trim() || undefined,
          nextReviewAt: nextReviewDraft ? new Date(`${nextReviewDraft}T00:00:00`).toISOString() : (task.nextReviewAt || addDaysIso(now, 1)),
        })
        : flowState.kind === 'unblock'
          ? attemptTaskTransition(task.id, 'In progress', { startedAt: task.startedAt || now })
          : attemptTaskTransition(task.id, task.status === 'Done' ? 'To do' : task.status, { status: task.status === 'Done' ? 'To do' : task.status, deferredUntil: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined, nextReviewAt: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined });
    setFlowWarnings(result.validation.warnings);
    setFlowBlockers(result.validation.blockers);
    if (!result.applied) {
      setFlowResult({ tone: 'danger', message: 'Action not applied. Resolve blockers and retry.' });
      return;
    }
    setFlowResult({ tone: result.validation.warnings.length ? 'warn' : 'success', message: result.validation.warnings.length ? 'Applied with warnings.' : 'Task action applied.' });
  };

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <WorkspaceSummaryStrip className="overview-hero-card">
          <SectionHeader title="Task execution lane" subtitle={modeConfig.taskSubtitle} actions={<button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>} compact />
          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Open tasks" value={summary.open} helper="In active execution" />
            <StatTile label="Due soon" value={summary.dueSoon} helper="Within 2 days" tone={summary.dueSoon ? 'warn' : 'default'} />
            <StatTile label="Blocked" value={summary.blocked} helper="Need unblock decision" tone={summary.blocked ? 'warn' : 'default'} />
            <StatTile label="Unlinked" value={summary.unlinked} helper="Need follow-up alignment" />
          </div>
          {executionIntent?.target === 'tasks' ? <div className="text-xs text-slate-600">{describeExecutionIntent(executionIntent)}</div> : null}
          <WorkspaceToolbarRow className="overview-support-row">
            <span className="overview-inline-guidance"><strong>Task loop:</strong> Scan queue → update status → resolve blocker/due date in inspector.</span>
            <span className="overview-inline-guidance">Follow-up relationship details stay in the right pane.</span>
          </WorkspaceToolbarRow>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>

      <WorkspacePrimaryLayout inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel" surface="data">
          <SectionHeader title="Task queue" subtitle="Matching execution lane structure with focused quick actions." compact />
          <div className="workspace-control-stack">
            <FilterBar>
              <SegmentedControl value={mode} onChange={(value) => setMode(value as TaskMode)} options={modeOptions} />
            </FilterBar>

            <WorkspaceToolbarRow className="execution-toolbar-row">
              <label className="field-block">
                <span className="field-label">Search queue</span>
                <div className="search-field-wrap"><Search className="search-field-icon h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, block reason, context, tags" className="field-input search-field-input" /></div>
              </label>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="field-input"><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="updated">Sort: recently updated</option></select>
              <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select>
              <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />View options <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
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
                  <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset filters</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="workspace-list-content task-list-content">
            {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try a different filter or add a task." /> : filteredTasks.map((task) => {
              const parent = getLinkedFollowUpForTask(task, items) ?? undefined;
              const isUrgent = Boolean(task.dueDate && task.dueDate < todayIso() && task.status !== 'Done');
              return (
                <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`workspace-data-row task-work-row ${selectedTask?.id === task.id ? 'workspace-data-row-active list-row-family-active' : ''}`}>
                  <div className="scan-row-layout scan-row-layout-quiet">
                    <div className="scan-row-content">
                      <div className="scan-row-primary">{task.title}</div>
                      <div className="scan-row-secondary">{task.project} • Due {formatDate(task.dueDate)} • {task.assigneeDisplayName || task.owner}</div>
                      <div className="scan-row-meta">{task.nextStep || 'No next step set'}{parent ? ` • Linked: ${parent.status}` : ' • Unlinked task'}</div>
                      {task.status === 'Blocked' && task.blockReason ? <div className={`scan-row-meta ${selectedTask?.id === task.id ? 'text-amber-200' : 'text-amber-700'}`}>Blocked: {task.blockReason}</div> : null}
                    </div>
                    <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                      <div className="scan-row-badge-cluster">
                        <Badge variant={task.status === 'Blocked' ? 'warn' : task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge>
                        <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                        {isUrgent ? <Badge variant="danger">Overdue</Badge> : null}
                      </div>
                      <div className="scan-row-action-cluster">
                        <button onClick={() => openTaskFlow(task, 'done')} className="action-btn !px-2.5 !py-1 text-xs"><CheckCircle2 className="h-4 w-4" />Done</button>
                        <button onClick={() => openTaskFlow(task, task.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn !px-2.5 !py-1 text-xs">{task.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                        <button onClick={() => openRecordDrawer({ type: 'task', id: task.id })} className="action-btn !px-2.5 !py-1 text-xs">Open</button>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </AppShellCard>

        <AppShellCard className="workspace-inspector-panel task-inspector-panel premium-inspector" surface="inspector">
          {selectedTask ? (
            <div className="space-y-3">
              <WorkspaceInspectorSection title="Selected task" subtitle={`${selectedTask.project} · ${selectedTask.assigneeDisplayName || selectedTask.owner}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="inspector-title">{selectedTask.title}</h3>
                    <p className="inspector-meta">Task execution detail</p>
                  </div>
                  <div className="flex gap-2"><button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button><button onClick={() => deleteTask(selectedTask.id)} className="action-btn text-rose-600"><Trash2 className="h-4 w-4" />Delete</button></div>
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Execution actions" subtitle="Primary decisions for status, timing, and blockers.">
                <div className="task-inspector-actions">
                  <button onClick={() => openTaskFlow(selectedTask, 'done')} className="primary-btn">Mark done</button>
                  <button onClick={() => openTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                  <button onClick={() => openTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
                  <button onClick={() => updateTask(selectedTask.id, { dueDate: addDaysIso(todayIso(), 1) })} className="action-btn">Due tomorrow</button>
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Status and next step">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.status}</div></div>
                  <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due date</div><div className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedTask.dueDate)}</div></div>
                  <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Blocker</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.blockReason || 'None recorded'}</div></div>
                  <div className="rounded-2xl tonal-micro"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next step</div><div className="mt-2 text-sm font-medium text-slate-900">{selectedTask.nextStep || 'Define next step'}</div></div>
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Task details">
                <div className="grid gap-3">
                  <label className="field-block"><span className="field-label">Block reason</span><input value={selectedTask.blockReason || ''} onChange={(event) => updateTask(selectedTask.id, { blockReason: event.target.value, status: event.target.value ? 'Blocked' : selectedTask.status })} className="field-input" /></label>
                  <label className="field-block"><span className="field-label">Completion note</span><input value={selectedTask.completionNote || ''} onChange={(event) => updateTask(selectedTask.id, { completionNote: event.target.value })} className="field-input" /></label>
                  <label className="field-block"><span className="field-label">Due date</span><input type="date" value={toDateInputValue(selectedTask.dueDate)} onChange={(event) => updateTask(selectedTask.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                  <label className="field-block"><span className="field-label">Deferred until</span><input type="date" value={toDateInputValue(selectedTask.deferredUntil)} onChange={(event) => updateTask(selectedTask.id, { deferredUntil: event.target.value ? fromDateInputValue(event.target.value) : undefined, nextReviewAt: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                  <label className="field-block"><span className="field-label">Next step</span><textarea value={selectedTask.nextStep} onChange={(event) => updateTask(selectedTask.id, { nextStep: event.target.value })} className="field-textarea" /></label>
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Linked follow-up impact" subtitle="How this task affects follow-up readiness.">
                <div className="rounded-2xl tonal-panel">
                  {linkedFollowUp ? (
                    <>
                      <div className="mt-1 text-sm text-slate-700">Parent: <span className="font-medium text-slate-900">{linkedFollowUp.title}</span> ({linkedFollowUp.status})</div>
                      <div className="mt-1 text-sm text-slate-700">Open linked tasks: {linkedTaskOpenCount}</div>
                      <div className="mt-1 text-sm text-slate-700">Impact rule: {selectedTask.completionImpact || 'advance_parent'}</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">{(linkedParentRollup?.explanations || []).map((reason) => <div key={reason}>• {reason}</div>)}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open parent lane</button>
                        <button onClick={() => updateTask(selectedTask.id, { linkedFollowUpId: undefined, contextNote: 'Unlinked from parent follow-up' })} className="action-btn !px-2.5 !py-1.5 text-xs"><Unlink2 className="h-4 w-4" />Unlink parent</button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-600">This task is not linked to a parent follow-up.</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select value={linkParentDraft} onChange={(event) => setLinkParentDraft(event.target.value)} className="field-input !w-auto">
                      <option value="">Link to follow-up…</option>
                      {parentCandidates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                    <button onClick={() => { if (!linkParentDraft) return; updateTask(selectedTask.id, { linkedFollowUpId: linkParentDraft, contextNote: 'Linked from task workspace' }); setLinkParentDraft(''); }} className="action-btn !px-2.5 !py-1.5 text-xs" disabled={!linkParentDraft}>Link parent</button>
                  </div>
                </div>
              </WorkspaceInspectorSection>
            </div>
          ) : (<EmptyState title="No task selected" message="Select a task to review details and actions." />)}
        </AppShellCard>
      </WorkspacePrimaryLayout>
      <StructuredActionFlow
        open={!!flowState}
        title={flowState?.kind === 'done' ? 'Mark task done' : flowState?.kind === 'block' ? 'Block task' : flowState?.kind === 'unblock' ? 'Resume task' : 'Defer task'}
        subtitle="Structured task transition with validation and in-app feedback."
        onCancel={() => setFlowState(null)}
        onConfirm={runTaskFlow}
        confirmLabel="Apply action"
        warnings={flowWarnings}
        blockers={flowBlockers}
        result={flowResult}
      >
        {flowState?.kind === 'done' ? <CompletionNoteSection value={completionNoteDraft} onChange={setCompletionNoteDraft} /> : null}
        {flowState?.kind === 'block' ? <BlockReasonSection value={blockReasonDraft} onChange={setBlockReasonDraft} /> : null}
        {flowState?.kind === 'block' ? <DateSection label="Next review date" value={nextReviewDraft} onChange={setNextReviewDraft} /> : null}
        {flowState?.kind === 'defer' ? <DateSection label="Deferred until" value={deferDateDraft} onChange={setDeferDateDraft} /> : null}
      </StructuredActionFlow>
    </WorkspacePage>
  );
}
