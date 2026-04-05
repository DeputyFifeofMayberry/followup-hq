import { ChevronDown, Link2, Pencil, Plus, Search, SlidersHorizontal, Undo2, Unlink2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { addDaysIso, formatDate, fromDateInputValue, isTaskDeferred, priorityTone, toDateInputValue, todayIso } from '../lib/utils';
import { AppShellCard, AppBadge, EmptyState, SectionHeader, StatTile, WorkspaceInspectorSection, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceToolbarRow, WorkspaceTopStack } from './ui/AppPrimitives';
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
type TaskSort = 'due' | 'priority' | 'updated';

type TaskWorkspacePreferences = {
  mode: TaskMode;
  sortBy: TaskSort;
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

const sessionPresets: Array<{ value: SessionPreset; label: string; mode: TaskMode; sortBy: TaskSort; description: string }> = [
  { value: 'workNow', label: 'Work now', mode: 'dueNow', sortBy: 'due', description: 'Due-now queue sorted by due date.' },
  { value: 'planWeek', label: 'Plan week', mode: 'thisWeek', sortBy: 'due', description: 'This-week scope sorted by due date.' },
  { value: 'resolveBlockers', label: 'Resolve blockers', mode: 'blocked', sortBy: 'priority', description: 'Blocked queue sorted by priority.' },
  { value: 'cleanup', label: 'Cleanup', mode: 'cleanup', sortBy: 'updated', description: 'Cleanup scope sorted by latest updates.' },
];

const defaultFilterState = {
  project: 'All',
  assignee: 'All',
  linked: 'all' as const,
  parentStatus: 'All' as const,
  tag: '',
};

const defaultWorkspacePrefs = {
  density: 'standard' as TaskRowDensity,
  inspectorCollapsed: false,
};

function readTaskWorkspacePrefs(): TaskWorkspacePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TASK_WORKSPACE_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TaskWorkspacePreferences>;
    if (!parsed.mode || !parsed.sortBy || !parsed.density) return null;
    return {
      mode: parsed.mode,
      sortBy: parsed.sortBy,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TaskSort>(prefs?.sortBy ?? 'due');
  const [mode, setMode] = useState<TaskMode>(prefs?.mode ?? 'dueNow');
  const [sessionPreset, setSessionPreset] = useState<SessionPreset>('custom');
  const [density, setDensity] = useState<TaskRowDensity>(prefs?.density ?? defaultWorkspacePrefs.density);
  const [projectFilter, setProjectFilter] = useState(defaultFilterState.project);
  const [assigneeFilter, setAssigneeFilter] = useState(defaultFilterState.assignee);
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>(defaultFilterState.linked);
  const [parentStatusFilter, setParentStatusFilter] = useState<'All' | FollowUpStatus>(defaultFilterState.parentStatus);
  const [tagFilter, setTagFilter] = useState(defaultFilterState.tag);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(Boolean(prefs?.inspectorCollapsed ?? defaultWorkspacePrefs.inspectorCollapsed));
  const [quickNextStepDraft, setQuickNextStepDraft] = useState('');
  const [quickDueDateDraft, setQuickDueDateDraft] = useState('');
  const [quickBlockReasonDraft, setQuickBlockReasonDraft] = useState('');
  const [laneFeedback, setLaneFeedback] = useState<{ tone: 'success' | 'warn'; message: string } | null>(null);
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
    const payload: TaskWorkspacePreferences = { mode, sortBy, density, inspectorCollapsed };
    window.localStorage.setItem(TASK_WORKSPACE_PREFS_KEY, JSON.stringify(payload));
  }, [mode, sortBy, density, inspectorCollapsed]);

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
      const textMatch = [task.title, task.project, task.summary, task.nextStep, task.notes, task.contextNote, task.blockReason, task.tags.join(' ')].join(' ').toLowerCase().includes(searchQuery.toLowerCase());
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
  }, [tasks, items, taskOwnerFilter, taskStatusFilter, searchQuery, sortBy, mode, projectFilter, assigneeFilter, linkedFilter, parentStatusFilter, tagFilter]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const selectedTaskDirty = selectedTask ? isRecordDirty('task', selectedTask.id) : false;
  const linkedFollowUp = selectedTask ? getLinkedFollowUpForTask(selectedTask, items) : null;
  const linkedTaskOpenCount = linkedFollowUp ? getLinkedTasksForFollowUp(linkedFollowUp.id, tasks).filter((task) => task.status !== 'Done').length : 0;
  const linkedParentRollup = linkedFollowUp ? buildFollowUpChildRollup(linkedFollowUp.id, linkedFollowUp.status, tasks) : null;
  const linkedParentCloseout = linkedFollowUp ? evaluateFollowUpCloseout(linkedFollowUp, tasks) : null;
  const parentCandidates = selectedTask ? items.filter((item) => item.project === selectedTask.project && item.status !== 'Closed') : [];

  useEffect(() => {
    if (!selectedTask) {
      setQuickNextStepDraft('');
      setQuickDueDateDraft('');
      setQuickBlockReasonDraft('');
      return;
    }
    setQuickNextStepDraft(selectedTask.nextStep || '');
    setQuickDueDateDraft(toDateInputValue(selectedTask.dueDate));
    setQuickBlockReasonDraft(selectedTask.blockReason || '');
  }, [selectedTask?.id, selectedTask?.nextStep, selectedTask?.dueDate, selectedTask?.blockReason]);

  const summary = useMemo(() => ({
    open: tasks.filter((task) => task.status !== 'Done').length,
    dueSoon: tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() <= Date.now() + 2 * 86400000).length,
    blocked: tasks.filter((task) => task.status === 'Blocked').length,
    unlinked: tasks.filter((task) => !task.linkedFollowUpId && task.status !== 'Done').length,
  }), [tasks]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (projectFilter !== defaultFilterState.project) chips.push({ key: 'project', label: `Project: ${projectFilter}`, clear: () => setProjectFilter(defaultFilterState.project) });
    if (assigneeFilter !== defaultFilterState.assignee) chips.push({ key: 'assignee', label: `Assignee: ${assigneeFilter}`, clear: () => setAssigneeFilter(defaultFilterState.assignee) });
    if (!personalMode && taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${taskOwnerFilter}`, clear: () => setTaskOwnerFilter('All') });
    if (taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${taskStatusFilter}`, clear: () => setTaskStatusFilter('All') });
    if (!personalMode && parentStatusFilter !== defaultFilterState.parentStatus) chips.push({ key: 'parent', label: `Parent: ${parentStatusFilter}`, clear: () => setParentStatusFilter(defaultFilterState.parentStatus) });
    if (linkedFilter !== defaultFilterState.linked) chips.push({ key: 'linked', label: `Linked: ${linkedFilter === 'linked' ? 'Linked' : 'Unlinked'}`, clear: () => setLinkedFilter(defaultFilterState.linked) });
    if (tagFilter) chips.push({ key: 'tag', label: `Tag: ${tagFilter}`, clear: () => setTagFilter(defaultFilterState.tag) });
    if (searchQuery.trim()) chips.push({ key: 'search', label: `Search: ${searchQuery.trim()}`, clear: () => setSearchQuery('') });
    return chips;
  }, [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, parentStatusFilter, linkedFilter, tagFilter, searchQuery, setTaskOwnerFilter, setTaskStatusFilter]);

  const activeQueueFilterCount = useMemo(() => (
    [
      projectFilter !== defaultFilterState.project,
      assigneeFilter !== defaultFilterState.assignee,
      !personalMode && taskOwnerFilter !== 'All',
      taskStatusFilter !== 'All',
      !personalMode && parentStatusFilter !== defaultFilterState.parentStatus,
      linkedFilter !== defaultFilterState.linked,
      Boolean(tagFilter),
      Boolean(searchQuery.trim()),
    ].filter(Boolean).length
  ), [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, parentStatusFilter, linkedFilter, tagFilter, searchQuery]);

  const activeQueueShapeCount = useMemo(() => (
    [
      !primaryModeOptions.some((option) => option.value === mode),
      sortBy !== 'due',
    ].filter(Boolean).length
  ), [mode, sortBy]);

  const activeWorkspacePreferenceCount = useMemo(() => (
    [
      density !== defaultWorkspacePrefs.density,
      inspectorCollapsed !== defaultWorkspacePrefs.inspectorCollapsed,
    ].filter(Boolean).length
  ), [density, inspectorCollapsed]);

  const resetFilters = () => {
    setTaskOwnerFilter('All');
    setTaskStatusFilter('All');
    setProjectFilter(defaultFilterState.project);
    setAssigneeFilter(defaultFilterState.assignee);
    setLinkedFilter(defaultFilterState.linked);
    setParentStatusFilter(defaultFilterState.parentStatus);
    setTagFilter(defaultFilterState.tag);
    setSearchQuery('');
  };

  const resetWorkspacePreferences = () => {
    setDensity(defaultWorkspacePrefs.density);
    setInspectorCollapsed(defaultWorkspacePrefs.inspectorCollapsed);
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

  const applySort = (nextSort: TaskSort) => {
    setSortBy(nextSort);
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
    const activeFlow = flowState;
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
    const nextTask = (() => {
      const currentIndex = filteredTasks.findIndex((entry) => entry.id === task.id);
      if (currentIndex < 0) return null;
      return [...filteredTasks.slice(currentIndex + 1), ...filteredTasks.slice(0, currentIndex)].find((entry) => entry.id !== task.id) ?? null;
    })();
    if (nextTask) {
      setSelectedTaskId(nextTask.id);
    }
    setFlowState(null);
    setLaneFeedback({
      tone: result.validation.warnings.length ? 'warn' : 'success',
      message: activeFlow.kind === 'done'
        ? `Marked "${task.title}" done${nextTask ? ` · next up: ${nextTask.title}` : ''}.`
        : activeFlow.kind === 'block'
          ? `Blocked "${task.title}" and kept queue focus${nextTask ? ` on ${nextTask.title}` : ''}.`
          : activeFlow.kind === 'unblock'
            ? `Unblocked "${task.title}" so it can move again.`
            : `Deferred "${task.title}" to ${deferDateDraft || 'a later date'}.`,
    });
    setFlowResult({ tone: result.validation.warnings.length ? 'warn' : 'success', message: result.validation.warnings.length ? 'Applied with warnings.' : 'Task action applied.' });
  };

  const saveQuickExecutionUpdate = () => {
    if (!selectedTask) return;
    updateTask(selectedTask.id, {
      nextStep: quickNextStepDraft.trim(),
      dueDate: quickDueDateDraft ? fromDateInputValue(quickDueDateDraft) : undefined,
      blockReason: quickBlockReasonDraft.trim() || undefined,
    });
    setLaneFeedback({ tone: 'success', message: 'Quick execution update saved.' });
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
          <WorkspaceToolbarRow className="followup-summary-meta-row">
            <span className="workspace-support-copy">Task loop: scan queue → select task → execute in inspector.</span>
            {executionIntent?.target === 'tasks' ? <span className="workspace-support-copy">{describeExecutionIntent(executionIntent)}</span> : null}
          </WorkspaceToolbarRow>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>

      <WorkspacePrimaryLayout inspectorWidth="420px" className={inspectorCollapsed ? 'workspace-primary-layout-collapsed' : ''}>
        <AppShellCard className="workspace-list-panel" surface="data">
          <SectionHeader title="Task queue" subtitle="Fast tactical lane for personal-first execution." compact />
          <div className="workspace-control-stack task-control-stack-calm">
            <WorkspaceToolbarRow className="execution-toolbar-row task-primary-toolbar">
              <div className="task-mode-group" role="tablist" aria-label="Primary task modes">
                {primaryModeOptions.map((option) => (
                  <button key={option.value} onClick={() => applyMode(option.value)} className={`task-mode-chip ${mode === option.value ? 'task-mode-chip-active' : ''}`} role="tab" aria-selected={mode === option.value}>{option.label}</button>
                ))}
              </div>

              <label className="field-block task-search-block">
                <span className="field-label">Search queue</span>
                <div className="search-field-wrap">
                  <Search className="search-field-icon h-4 w-4" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Title, next step, notes, tags" className="field-input search-field-input" />
                  {searchQuery ? <button type="button" onClick={() => setSearchQuery('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
                </div>
              </label>

              <button onClick={() => setViewOptionsOpen((prev) => !prev)} className="action-btn">
                <SlidersHorizontal className="h-4 w-4" />
                Filters & layout
                {(activeQueueFilterCount + activeQueueShapeCount + activeWorkspacePreferenceCount) > 0 ? <AppBadge tone="info">{activeQueueFilterCount + activeQueueShapeCount + activeWorkspacePreferenceCount}</AppBadge> : null}
                <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
            </WorkspaceToolbarRow>

            {activeFilterChips.length ? (
              <div className="task-filter-chip-row task-filter-chip-row-muted">
                {activeFilterChips.map((chip) => <button key={chip.key} onClick={chip.clear} className="task-filter-chip">{chip.label} <span aria-hidden="true">×</span></button>)}
                <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset filters</button>
              </div>
            ) : null}

            {viewOptionsOpen ? (
              <div className="task-view-options-surface advanced-filter-surface">
                <div className="task-view-options-panel-head">
                  <p className="workspace-support-copy">One place for non-default controls. Filters shape the queue, while preferences change workspace behavior.</p>
                </div>
                <section className="task-view-options-section">
                  <div className="task-view-options-section-head">
                    <span className="task-view-options-title">Queue filters</span>
                    <span className="workspace-support-copy">Refine which tasks appear in the queue.</span>
                  </div>
                  <div className={`task-view-options-grid ${personalMode ? 'task-view-options-grid-personal' : ''}`}>
                    <label className="field-block"><span className="field-label">Project</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select></label>
                    <label className="field-block"><span className="field-label">Assignee</span><select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select></label>
                    {!personalMode ? <label className="field-block"><span className="field-label">Owner</span><select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select></label> : null}
                    <label className="field-block"><span className="field-label">Status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
                    {!personalMode ? <label className="field-block"><span className="field-label">Parent status</span><select value={parentStatusFilter} onChange={(event) => setParentStatusFilter(event.target.value as 'All' | FollowUpStatus)} className="field-input">{['All', 'Needs action', 'Waiting on external', 'Waiting internal', 'In progress', 'At risk', 'Closed'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All parent statuses' : status}</option>)}</select></label> : null}
                    <label className="field-block"><span className="field-label">Linked state</span><select value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value as typeof linkedFilter)} className="field-input"><option value="all">All linked states</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select></label>
                    <label className="field-block"><span className="field-label">Tag</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="field-input"><option value="">All tags</option>{allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
                  </div>
                  <div className="task-view-options-reset-row">
                    <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset filters</button>
                  </div>
                </section>

                <section className="task-view-options-section">
                  <div className="task-view-options-section-head">
                    <span className="task-view-options-title">Queue ordering & scope</span>
                    <span className="workspace-support-copy">Change how the queue is shaped without changing display preferences.</span>
                  </div>
                  <div className="task-view-options-grid task-view-options-grid-personal">
                    <label className="field-block">
                      <span className="field-label">Sort queue</span>
                      <select value={sortBy} onChange={(event) => applySort(event.target.value as TaskSort)} className="field-input">
                        <option value="due">Due date</option>
                        <option value="priority">Priority</option>
                        <option value="updated">Recently updated</option>
                      </select>
                    </label>
                    <label className="field-block">
                      <span className="field-label">Additional modes</span>
                      <select value={primaryModeOptions.some((option) => option.value === mode) ? '' : mode} onChange={(event) => applyMode(event.target.value as TaskMode)} className="field-input">
                        <option value="">None selected</option>
                        {secondaryModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="task-view-options-section task-view-options-section-preferences">
                  <div className="task-view-options-section-head">
                    <span className="task-view-options-title">Workspace preferences</span>
                    <span className="workspace-support-copy">Calm defaults with optional shortcuts and layout settings.</span>
                  </div>
                  <div className="task-workspace-prefs-row">
                    <div className="task-preset-list" role="list" aria-label="Session presets">
                      {sessionPresets.map((preset) => (
                        <button key={preset.value} onClick={() => applySessionPreset(preset.value)} className={`task-preset-chip ${sessionPreset === preset.value ? 'task-preset-chip-active' : ''}`} type="button">
                          <span>{preset.label}</span>
                          <small>{preset.description}</small>
                        </button>
                      ))}
                    </div>
                    <label className="field-block task-preset-block">
                      <span className="field-label">Preset state</span>
                      <input value={sessionPreset === 'custom' ? 'Custom queue shape' : 'Preset applied'} className="field-input" readOnly />
                    </label>
                    <button onClick={() => setDensity((current) => (current === 'standard' ? 'compact' : 'standard'))} className="action-btn">Density: {density === 'compact' ? 'Compact' : 'Standard'}</button>
                    <button onClick={() => setInspectorCollapsed((current) => !current)} className="action-btn">{inspectorCollapsed ? 'Show details panel' : 'Hide details panel'}</button>
                    <button onClick={resetWorkspacePreferences} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset preferences</button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>

          <div className={`workspace-list-content task-list-content ${density === 'compact' ? 'task-list-density-compact' : ''}`}>
            {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}
            {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try another mode or adjust filters." /> : filteredTasks.map((task) => {
              const parent = getLinkedFollowUpForTask(task, items) ?? undefined;
              const dueTimestamp = task.dueDate ? new Date(task.dueDate).getTime() : null;
              const now = Date.now();
              const isOverdue = Boolean(dueTimestamp && dueTimestamp < now && task.status !== 'Done');
              const isDueToday = Boolean(dueTimestamp && Math.abs(dueTimestamp - now) <= 86400000 && task.status !== 'Done' && !isOverdue);
              const isDueSoon = Boolean(dueTimestamp && dueTimestamp > now && dueTimestamp <= now + (3 * 86400000) && task.status !== 'Done');
              const nextMove = task.status === 'Blocked'
                ? (task.blockReason ? `Unblock: ${task.blockReason}` : 'Capture unblock step')
                : task.status === 'Done'
                  ? (task.completionNote || 'Closed')
                  : (task.nextStep || task.recommendedAction || 'Define next move');
              const dueLabel = task.status === 'Done'
                ? `Done ${formatDate(task.completedAt || task.updatedAt)}`
                : task.dueDate
                  ? `${isOverdue ? 'Overdue' : isDueToday ? 'Due today' : 'Due'} ${formatDate(task.dueDate)}`
                  : 'No due date';
              return (
                <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`workspace-data-row task-work-row ${selectedTask?.id === task.id ? 'workspace-data-row-active list-row-family-active' : ''}`}>
                  <div className="scan-row-layout scan-row-layout-quiet">
                    <div className="scan-row-content">
                      <div className="scan-row-primary">{task.title}</div>
                      <div className="scan-row-secondary">{dueLabel} • {(task.assigneeDisplayName || task.owner)} • Next: {nextMove}</div>
                      <div className="scan-row-meta">{task.project}{task.summary ? ` • ${task.summary}` : ''}</div>
                    </div>
                    <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                      <div className="scan-row-badge-cluster">
                        <Badge variant={task.status === 'Blocked' ? 'warn' : task.status === 'Done' ? 'success' : 'neutral'}>{task.status}</Badge>
                        <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                        {isOverdue ? <Badge variant="danger">Overdue</Badge> : null}
                        {!isOverdue && isDueToday ? <Badge variant="warn">Due today</Badge> : null}
                        {!isOverdue && !isDueToday && isDueSoon ? <Badge variant="neutral">Due soon</Badge> : null}
                        {task.status === 'Blocked' ? <Badge variant="warn">Blocked</Badge> : null}
                        {parent ? <Badge variant="neutral">Linked</Badge> : <Badge variant="neutral">Unlinked</Badge>}
                      </div>
                      <div className="scan-row-action-cluster">
                        {task.status !== 'Done' ? <button onClick={() => openTaskFlow(task, 'done')} className="action-btn !px-2.5 !py-1 text-xs">Done</button> : null}
                        <button onClick={() => openTaskFlow(task, task.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn !px-2.5 !py-1 text-xs">{task.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                      </div>
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
                      <p className="inspector-meta">Command surface: decide, act, continue.</p>
                      {selectedTaskDirty ? <p className="mt-1 text-xs font-medium text-amber-700">Unsaved local task edits</p> : null}
                    </div>
                    <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit</button>
                  </div>
                  <div className="task-inspector-status-strip">
                    <Badge variant={selectedTask.status === 'Blocked' ? 'warn' : selectedTask.status === 'Done' ? 'success' : 'neutral'}>{selectedTask.status}</Badge>
                    <Badge variant={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
                    {selectedTask.dueDate && new Date(selectedTask.dueDate).getTime() < Date.now() && selectedTask.status !== 'Done' ? <Badge variant="danger">Overdue</Badge> : null}
                    {linkedFollowUp ? <Badge variant="neutral">Linked to follow-up</Badge> : <Badge variant="neutral">Unlinked</Badge>}
                  </div>
                </WorkspaceInspectorSection>

                <WorkspaceInspectorSection title="What matters now" subtitle="Urgency and next move first.">
                  <div className={`task-execution-focus ${selectedTask.status === 'Blocked' ? 'task-execution-focus-blocked' : selectedTask.dueDate && new Date(selectedTask.dueDate).getTime() < Date.now() && selectedTask.status !== 'Done' ? 'task-execution-focus-urgent' : ''}`}>
                    <div className="tonal-micro">Due timing: <strong>{formatDate(selectedTask.dueDate)}</strong></div>
                    <div className="tonal-micro">Next step: <strong>{selectedTask.nextStep || 'Define next step'}</strong></div>
                    {selectedTask.status === 'Blocked' ? <div className="tonal-micro">Blocker: <strong>{selectedTask.blockReason || 'No blocker reason captured yet'}</strong></div> : null}
                    {selectedTask.status !== 'Blocked' && selectedTask.blockReason ? <div className="tonal-micro">Previous blocker: <strong>{selectedTask.blockReason}</strong></div> : null}
                  </div>
                </WorkspaceInspectorSection>

                <WorkspaceInspectorSection title="Take action now" subtitle="Primary actions are optimized for rapid throughput.">
                  <div className="task-inspector-actions">
                    <button onClick={() => openTaskFlow(selectedTask, 'done')} className="primary-btn">Mark done</button>
                    <button onClick={() => openTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                    <button onClick={() => openTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
                    <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn task-action-secondary">Edit details</button>
                  </div>
                  <div className="task-quick-edit-grid">
                    <label className="field-block"><span className="field-label">Quick next step</span><textarea value={quickNextStepDraft} onChange={(event) => setQuickNextStepDraft(event.target.value)} className="field-textarea" /></label>
                    <label className="field-block"><span className="field-label">Due date</span><input type="date" value={quickDueDateDraft} onChange={(event) => setQuickDueDateDraft(event.target.value)} className="field-input" /></label>
                    <label className="field-block"><span className="field-label">Block reason (if blocked)</span><input value={quickBlockReasonDraft} onChange={(event) => setQuickBlockReasonDraft(event.target.value)} className="field-input" /></label>
                    <div className="task-quick-edit-actions">
                      <button onClick={saveQuickExecutionUpdate} className="action-btn">Save quick update</button>
                    </div>
                  </div>
                </WorkspaceInspectorSection>

                <WorkspaceInspectorSection title="Linked follow-up context" subtitle="Visible and actionable, but intentionally secondary.">
                  <div className="rounded-2xl tonal-panel task-link-context-panel">
                    <div className="tonal-micro"><strong>{linkedFollowUp ? linkedFollowUp.title : 'No linked follow-up'}</strong>{linkedFollowUp ? ` (${linkedFollowUp.status})` : ''}</div>
                    {linkedFollowUp ? <div className="tonal-micro">Open linked tasks: <strong>{linkedTaskOpenCount}</strong></div> : null}
                    {linkedFollowUp ? <div className="tonal-micro">Impact rule: <strong>{selectedTask.completionImpact || 'advance_parent'}</strong></div> : null}
                    {linkedFollowUp && linkedParentRollup?.explanations?.length ? <div className="mt-2 space-y-1 text-xs text-slate-600">{linkedParentRollup.explanations.map((reason) => <div key={reason}>• {reason}</div>)}</div> : null}
                    {linkedParentCloseout ? (
                      <div className="mt-2">
                        <CloseoutReadinessCard
                          evaluation={linkedParentCloseout}
                          onOpenTask={(taskId) => openRecordDrawer({ type: 'task', id: taskId })}
                          onReviewLinkedRecords={() => linkedFollowUp ? openRecordDrawer({ type: 'followup', id: linkedFollowUp.id }) : undefined}
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {linkedFollowUp ? <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open parent lane</button> : null}
                      {linkedFollowUp ? <button onClick={() => updateTask(selectedTask.id, { linkedFollowUpId: undefined, contextNote: 'Unlinked from parent follow-up' })} className="action-btn !px-2.5 !py-1.5 text-xs"><Unlink2 className="h-4 w-4" />Unlink parent</button> : null}
                      <select value={linkParentDraft} onChange={(event) => setLinkParentDraft(event.target.value)} className="field-input !w-auto">
                        <option value="">Link to follow-up…</option>
                        {parentCandidates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                      <button onClick={() => { if (!linkParentDraft) return; updateTask(selectedTask.id, { linkedFollowUpId: linkParentDraft, contextNote: 'Linked from task workspace' }); setLinkParentDraft(''); }} className="action-btn !px-2.5 !py-1.5 text-xs" disabled={!linkParentDraft}>Link parent</button>
                    </div>
                  </div>
                </WorkspaceInspectorSection>

                <WorkspaceInspectorSection title="Maintenance" subtitle="Deep edit and destructive actions are available but de-emphasized.">
                  <details className="task-maintenance-disclosure">
                    <summary>Open full maintenance controls</summary>
                    <div className="task-maintenance-body">
                      <div className="text-xs text-slate-600">Completion note: {selectedTask.completionNote || 'None recorded'}</div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openEditTaskModal(selectedTask.id)} className="action-btn"><Pencil className="h-4 w-4" />Edit full record</button>
                        <button onClick={() => deleteTask(selectedTask.id)} className="action-btn task-action-danger">Delete task</button>
                      </div>
                    </div>
                  </details>
                </WorkspaceInspectorSection>
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
