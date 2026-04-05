import { ChevronDown, Link2, Pencil, Plus, Search, SlidersHorizontal, Undo2, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { addDaysIso, formatDate, fromDateInputValue, isTaskDeferred, priorityTone, toDateInputValue, todayIso } from '../lib/utils';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, StatTile, WorkspaceInspectorSection, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceToolbarRow, WorkspaceTopStack } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import { useTasksViewModel } from '../domains/tasks';
import type { AppMode, FollowUpStatus, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { BlockReasonSection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';
import { describeExecutionIntent } from '../lib/executionHandoff';
import { getLinkedFollowUpForTask, getLinkedTasksForFollowUp } from '../lib/recordContext';
import { buildFollowUpChildRollup } from '../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../lib/closeoutReadiness';
import { CloseoutReadinessCard } from './CloseoutReadinessCard';

type TaskMode = 'dueNow' | 'thisWeek' | 'blocked' | 'allOpen' | 'deferred' | 'atRiskLinked' | 'cleanup' | 'unlinked' | 'recent';
type SessionPreset = 'workNow' | 'planWeek' | 'resolveBlockers' | 'cleanup' | 'custom';
type TaskRowDensity = 'standard' | 'compact';
type InspectorTab = 'summary' | 'execute' | 'context';

type TaskWorkspacePreferences = {
  mode: TaskMode;
  sortBy: 'due' | 'priority' | 'updated';
  sessionPreset: SessionPreset;
  density: TaskRowDensity;
  inspectorCollapsed: boolean;
};

const TASK_WORKSPACE_PREFS_KEY = 'setpoint.taskWorkspacePrefs.v1';

const primaryModeOptions: Array<{ value: TaskMode; label: string }> = [
  { value: 'dueNow', label: 'Due now' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'allOpen', label: 'All open' },
];

const secondaryModeOptions: Array<{ value: TaskMode; label: string }> = [
  { value: 'deferred', label: 'Deferred' },
  { value: 'atRiskLinked', label: 'Linked risk' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'unlinked', label: 'Unlinked' },
  { value: 'recent', label: 'Recently updated' },
];

const sessionPresets: Array<{ value: SessionPreset; label: string; mode: TaskMode; sortBy: 'due' | 'priority' | 'updated' }> = [
  { value: 'workNow', label: 'Work now', mode: 'dueNow', sortBy: 'due' },
  { value: 'planWeek', label: 'Plan week', mode: 'thisWeek', sortBy: 'due' },
  { value: 'resolveBlockers', label: 'Resolve blockers', mode: 'blocked', sortBy: 'priority' },
  { value: 'cleanup', label: 'Cleanup', mode: 'cleanup', sortBy: 'updated' },
];

function readTaskWorkspacePrefs(): TaskWorkspacePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TASK_WORKSPACE_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TaskWorkspacePreferences>;
    if (!parsed.mode || !parsed.sortBy || !parsed.sessionPreset || !parsed.density) return null;
    return {
      mode: parsed.mode,
      sortBy: parsed.sortBy,
      sessionPreset: parsed.sessionPreset,
      density: parsed.density,
      inspectorCollapsed: Boolean(parsed.inspectorCollapsed),
    };
  } catch {
    return null;
  }
}

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean; appMode?: AppMode }) {
  const { tasks, items, projects, selectedTaskId, taskOwnerFilter, taskStatusFilter, setSelectedTaskId, setTaskOwnerFilter, setTaskStatusFilter, openCreateTaskModal, openEditTaskModal, deleteTask, updateTask, attemptTaskTransition, executionIntent, clearExecutionIntent } = useTasksViewModel();

  const modeConfig = getModeConfig(appMode);
  const prefs = useMemo(() => readTaskWorkspacePrefs(), []);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'priority' | 'updated'>(prefs?.sortBy ?? 'due');
  const [mode, setMode] = useState<TaskMode>(prefs?.mode ?? 'dueNow');
  const [sessionPreset, setSessionPreset] = useState<SessionPreset>(prefs?.sessionPreset ?? 'workNow');
  const [density, setDensity] = useState<TaskRowDensity>(prefs?.density ?? 'standard');
  const [projectFilter, setProjectFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [parentStatusFilter, setParentStatusFilter] = useState<'All' | FollowUpStatus>('All');
  const [tagFilter, setTagFilter] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(Boolean(prefs?.inspectorCollapsed));
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('summary');
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
  const isRecordDirty = useAppStore((s) => s.isRecordDirty);

  useEffect(() => {
    if (executionIntent?.target !== 'tasks') return;
    if (executionIntent.recordType === 'task' && executionIntent.recordId) {
      setSelectedTaskId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedTaskId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: TaskWorkspacePreferences = { mode, sortBy, sessionPreset, density, inspectorCollapsed };
    window.localStorage.setItem(TASK_WORKSPACE_PREFS_KEY, JSON.stringify(payload));
  }, [mode, sortBy, sessionPreset, density, inspectorCollapsed]);

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
        case 'allOpen':
          return task.status !== 'Done';
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
      const tagMatch = !tagFilter || task.tags.includes(tagFilter);
      const textMatch = [task.title, task.project, task.summary, task.nextStep, task.notes, task.contextNote, task.blockReason, task.tags.join(' ')].join(' ').toLowerCase().includes(search.toLowerCase());
      return ownerMatch && statusMatch && projectMatch && assigneeMatch && linkedMatch && parentStatusMatch && tagMatch && textMatch;
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
  }, [tasks, items, taskOwnerFilter, taskStatusFilter, search, sortBy, mode, projectFilter, assigneeFilter, linkedFilter, parentStatusFilter, tagFilter]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const selectedTaskDirty = selectedTask ? isRecordDirty('task', selectedTask.id) : false;
  const linkedFollowUp = selectedTask ? getLinkedFollowUpForTask(selectedTask, items) : null;
  const linkedTaskOpenCount = linkedFollowUp ? getLinkedTasksForFollowUp(linkedFollowUp.id, tasks).filter((task) => task.status !== 'Done').length : 0;
  const linkedParentRollup = linkedFollowUp ? buildFollowUpChildRollup(linkedFollowUp.id, linkedFollowUp.status, tasks) : null;
  const linkedParentCloseout = linkedFollowUp ? evaluateFollowUpCloseout(linkedFollowUp, tasks) : null;
  const parentCandidates = selectedTask ? items.filter((item) => item.project === selectedTask.project && item.status !== 'Closed') : [];

  const summary = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 2 * 86400000).length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    unlinked: tasks.filter((task) => !task.linkedFollowUpId && task.status !== 'Done').length,
  }), [tasks]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (projectFilter !== 'All') chips.push({ key: 'project', label: `Project: ${projectFilter}`, clear: () => setProjectFilter('All') });
    if (assigneeFilter !== 'All') chips.push({ key: 'assignee', label: `Assignee: ${assigneeFilter}`, clear: () => setAssigneeFilter('All') });
    if (!personalMode && taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${taskOwnerFilter}`, clear: () => setTaskOwnerFilter('All') });
    if (taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${taskStatusFilter}`, clear: () => setTaskStatusFilter('All') });
    if (!personalMode && parentStatusFilter !== 'All') chips.push({ key: 'parent', label: `Parent: ${parentStatusFilter}`, clear: () => setParentStatusFilter('All') });
    if (linkedFilter !== 'all') chips.push({ key: 'linked', label: `Linked: ${linkedFilter === 'linked' ? 'Linked' : 'Unlinked'}`, clear: () => setLinkedFilter('all') });
    if (tagFilter) chips.push({ key: 'tag', label: `Tag: ${tagFilter}`, clear: () => setTagFilter('') });
    if (search.trim()) chips.push({ key: 'search', label: `Search: ${search.trim()}`, clear: () => setSearch('') });
    return chips;
  }, [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, parentStatusFilter, linkedFilter, tagFilter, search, setTaskOwnerFilter, setTaskStatusFilter]);

  const resetFilters = () => {
    setTaskOwnerFilter('All');
    setTaskStatusFilter('All');
    setProjectFilter('All');
    setAssigneeFilter('All');
    setLinkedFilter('all');
    setParentStatusFilter('All');
    setTagFilter('');
    setSearch('');
    setMode('dueNow');
    setSessionPreset('workNow');
  };

  const applySessionPreset = (preset: SessionPreset) => {
    if (preset === 'custom') return;
    const selected = sessionPresets.find((entry) => entry.value === preset);
    if (!selected) return;
    setSessionPreset(preset);
    setMode(selected.mode);
    setSortBy(selected.sortBy);
  };

  const applyMode = (nextMode: TaskMode) => {
    setMode(nextMode);
    setSessionPreset('custom');
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
          <SectionHeader title="Task execution lane" subtitle={modeConfig.taskSubtitle} compact />
          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Open tasks" value={summary.open} helper="In active execution" />
            <StatTile label="Due soon" value={summary.dueSoon} helper="Within 2 days" tone={summary.dueSoon ? 'warn' : 'default'} />
            <StatTile label="Blocked" value={summary.blocked} helper="Need unblock decision" tone={summary.blocked ? 'warn' : 'default'} />
            <StatTile label="Unlinked" value={summary.unlinked} helper="Need follow-up alignment" />
          </div>
          {executionIntent?.target === 'tasks' ? <div className="text-xs text-slate-600">{describeExecutionIntent(executionIntent)}</div> : null}
          <WorkspaceToolbarRow className="overview-support-row">
            <span className="overview-inline-guidance"><strong>Task loop:</strong> Scan queue → decide in inspector execute tab → return to queue.</span>
            <span className="overview-inline-guidance">Use filters only when needed; active filters stay visible as chips.</span>
          </WorkspaceToolbarRow>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>

      <WorkspacePrimaryLayout inspectorWidth="420px" className={inspectorCollapsed ? 'workspace-primary-layout-collapsed' : ''}>
        <AppShellCard className="workspace-list-panel" surface="data">
          <SectionHeader title="Task queue" subtitle="Fast tactical lane for personal-first execution." compact />
          <div className="workspace-control-stack">
            <FilterBar>
              <div className="task-mode-group" role="tablist" aria-label="Primary task modes">
                {primaryModeOptions.map((option) => (
                  <button key={option.value} onClick={() => applyMode(option.value)} className={`task-mode-chip ${mode === option.value ? 'task-mode-chip-active' : ''}`} role="tab" aria-selected={mode === option.value}>{option.label}</button>
                ))}
                <select value={primaryModeOptions.some((option) => option.value === mode) ? '' : mode} onChange={(event) => applyMode(event.target.value as TaskMode)} className="field-input task-secondary-mode-select" aria-label="More views">
                  <option value="">More views…</option>
                  {secondaryModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </FilterBar>

            <WorkspaceToolbarRow className="execution-toolbar-row">
              <label className="field-block">
                <span className="field-label">Search queue</span>
                <div className="search-field-wrap"><Search className="search-field-icon h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, next step, notes, tags" className="field-input search-field-input" /></div>
              </label>
              <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setSessionPreset('custom'); }} className="field-input"><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="updated">Sort: recently updated</option></select>
              <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select>
              <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />Filters <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
              <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
            </WorkspaceToolbarRow>

            <WorkspaceToolbarRow className="overview-support-row !border-t-0 !pt-0 task-session-strip">
              <span className="overview-triage-label">Session</span>
              {sessionPresets.map((preset) => <button key={preset.value} onClick={() => applySessionPreset(preset.value)} className={`action-btn !px-2.5 !py-1 text-xs ${sessionPreset === preset.value ? 'bg-slate-900 !text-white' : ''}`}>{preset.label}</button>)}
              <span className="overview-triage-label">Density</span>
              <button onClick={() => setDensity((current) => (current === 'standard' ? 'compact' : 'standard'))} className="action-btn !px-2.5 !py-1 text-xs">{density === 'compact' ? 'Compact' : 'Standard'}</button>
              <button onClick={() => setInspectorCollapsed((current) => !current)} className="action-btn !px-2.5 !py-1 text-xs">{inspectorCollapsed ? 'Show details' : 'Hide details'}</button>
            </WorkspaceToolbarRow>

            {activeFilterChips.length ? (
              <div className="task-filter-chip-row">
                {activeFilterChips.map((chip) => <button key={chip.key} onClick={chip.clear} className="task-filter-chip">{chip.label} <span aria-hidden="true">×</span></button>)}
                <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset all</button>
              </div>
            ) : null}

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
              </div>
            ) : null}
          </div>

          <div className={`workspace-list-content task-list-content ${density === 'compact' ? 'task-list-density-compact' : ''}`}>
            {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try another mode or adjust filters." /> : filteredTasks.map((task) => {
              const parent = getLinkedFollowUpForTask(task, items) ?? undefined;
              const isUrgent = Boolean(task.dueDate && task.dueDate < todayIso() && task.status !== 'Done');
              return (
                <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`workspace-data-row task-work-row ${selectedTask?.id === task.id ? 'workspace-data-row-active list-row-family-active' : ''}`}>
                  <div className="scan-row-layout scan-row-layout-quiet">
                    <div className="scan-row-content">
                      <div className="scan-row-primary">{task.title}</div>
                      <div className="scan-row-secondary">{task.project} • {task.assigneeDisplayName || task.owner} • Due {formatDate(task.dueDate)} • {task.nextStep || 'No next step'}</div>
                    </div>
                    <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                      <div className="scan-row-badge-cluster">
                        <Badge variant={task.status === 'Blocked' ? 'warn' : task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge>
                        <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                        {isUrgent ? <Badge variant="danger">Overdue</Badge> : null}
                        {parent ? <Badge variant="neutral">Linked</Badge> : <Badge variant="neutral">Unlinked</Badge>}
                      </div>
                      <button onClick={() => openTaskFlow(task, 'done')} className="action-btn !px-2.5 !py-1 text-xs">Done</button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </AppShellCard>

        {!inspectorCollapsed ? (
          <AppShellCard className="workspace-inspector-panel task-inspector-panel premium-inspector" surface="inspector">
            {selectedTask ? (
              <div className="space-y-3">
                <WorkspaceInspectorSection title="Selected task" subtitle={`${selectedTask.project} · ${selectedTask.assigneeDisplayName || selectedTask.owner}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="inspector-title">{selectedTask.title}</h3>
                      <p className="inspector-meta">Focused review-and-act pane</p>
                      {selectedTaskDirty ? <p className="mt-1 text-xs font-medium text-amber-700">Unsaved local task edits</p> : null}
                    </div>
                    <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button>
                  </div>
                  <div className="task-inspector-tab-row" role="tablist" aria-label="Task detail tabs">
                    <button onClick={() => setInspectorTab('summary')} className={`task-inspector-tab ${inspectorTab === 'summary' ? 'task-inspector-tab-active' : ''}`} role="tab" aria-selected={inspectorTab === 'summary'}>Summary</button>
                    <button onClick={() => setInspectorTab('execute')} className={`task-inspector-tab ${inspectorTab === 'execute' ? 'task-inspector-tab-active' : ''}`} role="tab" aria-selected={inspectorTab === 'execute'}>Execute</button>
                    <button onClick={() => setInspectorTab('context')} className={`task-inspector-tab ${inspectorTab === 'context' ? 'task-inspector-tab-active' : ''}`} role="tab" aria-selected={inspectorTab === 'context'}>Context</button>
                  </div>
                </WorkspaceInspectorSection>

                {inspectorTab === 'summary' ? (
                  <WorkspaceInspectorSection title="Summary" subtitle="Fast read of execution-critical details.">
                    <div className="grid gap-2">
                      <div className="tonal-micro">Project: <strong>{selectedTask.project}</strong></div>
                      <div className="tonal-micro">Assignee / owner: <strong>{selectedTask.assigneeDisplayName || selectedTask.owner}</strong></div>
                      <div className="tonal-micro">Status: <strong>{selectedTask.status}</strong> · Due: <strong>{formatDate(selectedTask.dueDate)}</strong></div>
                      <div className="tonal-micro">Next step: <strong>{selectedTask.nextStep || 'Define next step'}</strong></div>
                      <div className="tonal-micro">Blocker summary: <strong>{selectedTask.blockReason || 'No blocker recorded'}</strong></div>
                      <div className="tonal-micro">Linked follow-up: <strong>{linkedFollowUp ? linkedFollowUp.title : 'No linked follow-up'}</strong></div>
                    </div>
                  </WorkspaceInspectorSection>
                ) : null}

                {inspectorTab === 'execute' ? (
                  <WorkspaceInspectorSection title="Execute" subtitle="Single action center for status and task updates.">
                    <div className="task-inspector-actions">
                      <button onClick={() => openTaskFlow(selectedTask, 'done')} className="primary-btn">Mark done</button>
                      <button onClick={() => openTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                      <button onClick={() => openTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
                      <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn">Edit details</button>
                    </div>
                    <div className="grid gap-3">
                      <label className="field-block"><span className="field-label">Next step</span><textarea value={selectedTask.nextStep} onChange={(event) => updateTask(selectedTask.id, { nextStep: event.target.value })} className="field-textarea" /></label>
                      <label className="field-block"><span className="field-label">Due date</span><input type="date" value={toDateInputValue(selectedTask.dueDate)} onChange={(event) => updateTask(selectedTask.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                      <label className="field-block"><span className="field-label">Deferred until</span><input type="date" value={toDateInputValue(selectedTask.deferredUntil)} onChange={(event) => updateTask(selectedTask.id, { deferredUntil: event.target.value ? fromDateInputValue(event.target.value) : undefined, nextReviewAt: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                      <label className="field-block"><span className="field-label">Block reason</span><input value={selectedTask.blockReason || ''} onChange={(event) => updateTask(selectedTask.id, { blockReason: event.target.value, status: event.target.value ? 'Blocked' : selectedTask.status })} className="field-input" /></label>
                      <label className="field-block"><span className="field-label">Completion note</span><input value={selectedTask.completionNote || ''} onChange={(event) => updateTask(selectedTask.id, { completionNote: event.target.value })} className="field-input" /></label>
                      <button onClick={() => deleteTask(selectedTask.id)} className="action-btn text-rose-600">Delete task</button>
                    </div>
                  </WorkspaceInspectorSection>
                ) : null}

                {inspectorTab === 'context' ? (
                  <WorkspaceInspectorSection title="Context" subtitle="Follow-up linkage and impact context.">
                    <div className="rounded-2xl tonal-panel">
                      {linkedFollowUp ? (
                        <>
                          <div className="mt-1 text-sm text-slate-700">Parent: <span className="font-medium text-slate-900">{linkedFollowUp.title}</span> ({linkedFollowUp.status})</div>
                          <div className="mt-1 text-sm text-slate-700">Open linked tasks: {linkedTaskOpenCount}</div>
                          <div className="mt-1 text-sm text-slate-700">Impact rule: {selectedTask.completionImpact || 'advance_parent'}</div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">{(linkedParentRollup?.explanations || []).map((reason) => <div key={reason}>• {reason}</div>)}</div>
                          {linkedParentCloseout ? (
                            <div className="mt-2">
                              <CloseoutReadinessCard
                                evaluation={linkedParentCloseout}
                                onOpenTask={(taskId) => openRecordDrawer({ type: 'task', id: taskId })}
                                onReviewLinkedRecords={() => openRecordDrawer({ type: 'followup', id: linkedFollowUp.id })}
                              />
                            </div>
                          ) : null}
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
                ) : null}
              </div>
            ) : (<EmptyState title="No task selected" message="Select a task to review details and actions." />)}
          </AppShellCard>
        ) : null}
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
