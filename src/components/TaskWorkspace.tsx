import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDaysIso, formatDate, isTaskDeferred, todayIso } from '../lib/utils';
import { ExecutionLaneFooterMeta, SectionHeader, WorkspacePage } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import { useTasksViewModel } from '../domains/tasks';
import type { AppMode, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { buildFollowUpChildRollup } from '../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../lib/closeoutReadiness';
import { deriveTaskRecommendedAction } from '../domains/shared';
import { isExecutionReady } from '../domains/records/integrity';
import { useViewportBand } from '../hooks/useViewport';
import { TaskToolbar } from './tasks/TaskToolbar';
import { TaskList } from './tasks/TaskList';
import { TaskInspectorModal } from './tasks/TaskInspectorModal';
import { TaskActionFlow } from './tasks/TaskActionFlow';

type TaskView = 'today' | 'upcoming' | 'blocked' | 'all';
type TaskSort = 'due' | 'priority' | 'updated';

const taskViewOptions: Array<{ value: TaskView; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'all', label: 'All open' },
];

const defaultFilterState = {
  project: 'All',
  assignee: 'All',
  linked: 'all' as const,
};

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean; appMode?: AppMode }) {
  const { tasks, items, projects, selectedTaskId, taskOwnerFilter, taskStatusFilter, setSelectedTaskId, setTaskOwnerFilter, setTaskStatusFilter, openCreateTaskModal, updateTask, attemptTaskTransition, executionIntent, clearExecutionIntent } = useTasksViewModel();
  const { isMobileLike } = useViewportBand();
  const modeConfig = getModeConfig(appMode);
  const openRecordDrawer = useAppStore((s) => s.openRecordDrawer);
  const openRecordEditor = useAppStore((s) => s.openRecordEditor);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TaskSort>('due');
  const [view, setView] = useState<TaskView>('today');
  const [projectFilter, setProjectFilter] = useState(defaultFilterState.project);
  const [assigneeFilter, setAssigneeFilter] = useState(defaultFilterState.assignee);
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>(defaultFilterState.linked);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [laneFeedback, setLaneFeedback] = useState<{ tone: 'success' | 'warn'; message: string } | null>(null);
  const [flowState, setFlowState] = useState<{ kind: 'done' | 'block' | 'unblock' | 'defer'; taskId: string } | null>(null);
  const [completionNoteDraft, setCompletionNoteDraft] = useState('');
  const [blockReasonDraft, setBlockReasonDraft] = useState('');
  const [deferDateDraft, setDeferDateDraft] = useState('');
  const [nextReviewDraft, setNextReviewDraft] = useState('');
  const [flowWarnings, setFlowWarnings] = useState<string[]>([]);
  const [flowBlockers, setFlowBlockers] = useState<string[]>([]);
  const [flowResult, setFlowResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 160);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (executionIntent?.target !== 'tasks') return;
    if (executionIntent.recordType === 'task' && executionIntent.recordId) {
      setSelectedTaskId(executionIntent.recordId);
      setTaskDetailOpen(true);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedTaskId]);

  const owners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.assigneeDisplayName || task.owner))).sort()], [tasks]);
  const projectOptions = useMemo(() => ['All', ...projects.map((project) => project.name)], [projects]);
  const followUpById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const tasksByFollowUpId = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      if (!task.linkedFollowUpId) continue;
      const existing = grouped.get(task.linkedFollowUpId);
      if (existing) {
        existing.push(task);
      } else {
        grouped.set(task.linkedFollowUpId, [task]);
      }
    }
    return grouped;
  }, [tasks]);
  const reviewRequiredTasks = useMemo(() => tasks.filter((task) => !isExecutionReady(task)), [tasks]);
  const executionTasks = useMemo(() => tasks.filter((task) => isExecutionReady(task)), [tasks]);
  const taskDerived = useMemo(() => executionTasks.map((task) => ({
    ...task,
    dueTs: task.dueDate ? new Date(task.dueDate).getTime() : null,
    updatedTs: new Date(task.updatedAt).getTime(),
    searchBlob: [task.title, task.project, task.summary, task.nextStep, task.notes, task.contextNote, task.blockReason, task.tags.join(' ')].join(' ').toLowerCase(),
  })), [executionTasks]);

  const filteredTasks = useMemo(() => {
    const nowTs = Date.now();
    const endTomorrowTs = nowTs + 86400000;
    const endWeekTs = nowTs + 7 * 86400000;
    const searchQueryLower = debouncedSearchQuery.toLowerCase();

    const byView = taskDerived.filter((task) => {
      if (task.status === 'Done') return false;
      if (view === 'today') return task.status === 'Blocked' || (task.dueTs !== null && task.dueTs <= endTomorrowTs);
      if (view === 'upcoming') return task.dueTs !== null && task.dueTs > endTomorrowTs && task.dueTs <= endWeekTs;
      if (view === 'blocked') return task.status === 'Blocked';
      return true;
    });

    const withFilters = byView.filter((task) => {
      const ownerMatch = taskOwnerFilter === 'All' || task.owner === taskOwnerFilter;
      const statusMatch = taskStatusFilter === 'All' || task.status === taskStatusFilter;
      const projectMatch = projectFilter === 'All' || task.project === projectFilter;
      const assigneeMatch = assigneeFilter === 'All' || (task.assigneeDisplayName || task.owner) === assigneeFilter;
      const linkedMatch = linkedFilter === 'all' || (linkedFilter === 'linked' ? !!task.linkedFollowUpId : !task.linkedFollowUpId);
      const textMatch = task.searchBlob.includes(searchQueryLower);
      return ownerMatch && statusMatch && projectMatch && assigneeMatch && linkedMatch && textMatch;
    });

    return [...withFilters].sort((a, b) => {
      if (sortBy === 'priority') {
        const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      if (sortBy === 'updated') return b.updatedTs - a.updatedTs;
      const aDue = a.dueTs ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueTs ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [taskDerived, view, taskOwnerFilter, taskStatusFilter, projectFilter, assigneeFilter, linkedFilter, debouncedSearchQuery, sortBy]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? null;
  const linkedFollowUp = selectedTask ? (followUpById.get(selectedTask.linkedFollowUpId ?? '') ?? null) : null;
  const linkedTasks = linkedFollowUp ? (tasksByFollowUpId.get(linkedFollowUp.id) ?? []) : [];
  const linkedTaskOpenCount = linkedTasks.filter((task) => task.status !== 'Done').length;
  const linkedParentRollup = linkedFollowUp ? buildFollowUpChildRollup(linkedFollowUp.id, linkedFollowUp.status, tasks, linkedTasks) : null;
  const linkedParentCloseout = linkedFollowUp ? evaluateFollowUpCloseout(linkedFollowUp, tasks, undefined, linkedTasks) : null;
  const recommendedAction = selectedTask ? deriveTaskRecommendedAction(selectedTask) : null;

  const summary = useMemo(() => {
    const dueSoonThresholdTs = Date.now() + 2 * 86400000;
    const open = taskDerived.filter((task) => task.status !== 'Done');
    return {
      open: open.length,
      dueSoon: open.filter((task) => task.dueTs !== null && task.dueTs <= dueSoonThresholdTs).length,
      blocked: open.filter((task) => task.status === 'Blocked').length,
      reviewRequired: reviewRequiredTasks.length,
    };
  }, [taskDerived, reviewRequiredTasks.length]);

  const activeFilterCount = useMemo(() => (
    [
      projectFilter !== defaultFilterState.project,
      assigneeFilter !== defaultFilterState.assignee,
      !personalMode && taskOwnerFilter !== 'All',
      taskStatusFilter !== 'All',
      linkedFilter !== defaultFilterState.linked,
      Boolean(searchQuery.trim()),
      sortBy !== 'due',
    ].filter(Boolean).length
  ), [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, linkedFilter, searchQuery, sortBy]);

  const onProjectFilterReset = useCallback(() => setProjectFilter(defaultFilterState.project), []);
  const onAssigneeFilterReset = useCallback(() => setAssigneeFilter(defaultFilterState.assignee), []);
  const onTaskOwnerFilterReset = useCallback(() => setTaskOwnerFilter('All'), [setTaskOwnerFilter]);
  const onTaskStatusFilterReset = useCallback(() => setTaskStatusFilter('All'), [setTaskStatusFilter]);
  const onLinkedFilterReset = useCallback(() => setLinkedFilter(defaultFilterState.linked), []);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (projectFilter !== defaultFilterState.project) chips.push({ key: 'project', label: projectFilter, clear: onProjectFilterReset });
    if (assigneeFilter !== defaultFilterState.assignee) chips.push({ key: 'assignee', label: assigneeFilter, clear: onAssigneeFilterReset });
    if (!personalMode && taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${taskOwnerFilter}`, clear: onTaskOwnerFilterReset });
    if (taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${taskStatusFilter}`, clear: onTaskStatusFilterReset });
    if (linkedFilter !== defaultFilterState.linked) chips.push({ key: 'linked', label: linkedFilter === 'linked' ? 'Linked only' : 'Unlinked only', clear: onLinkedFilterReset });
    return chips;
  }, [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, linkedFilter, onProjectFilterReset, onAssigneeFilterReset, onTaskOwnerFilterReset, onTaskStatusFilterReset, onLinkedFilterReset]);

  const resetFilters = useCallback(() => {
    setTaskOwnerFilter('All');
    setTaskStatusFilter('All');
    setProjectFilter(defaultFilterState.project);
    setAssigneeFilter(defaultFilterState.assignee);
    setLinkedFilter(defaultFilterState.linked);
    setSortBy('due');
    setSearchQuery('');
  }, [setTaskOwnerFilter, setTaskStatusFilter]);

  const openTaskFlow = useCallback((task: TaskItem, kind: 'done' | 'block' | 'unblock' | 'defer') => {
    setFlowState({ kind, taskId: task.id });
    setCompletionNoteDraft(task.completionNote || '');
    setBlockReasonDraft(task.blockReason || '');
    setDeferDateDraft((task.deferredUntil || addDaysIso(todayIso(), 2)).slice(0, 10));
    setNextReviewDraft((task.nextReviewAt || addDaysIso(todayIso(), 1)).slice(0, 10));
    setFlowWarnings([]);
    setFlowBlockers([]);
    setFlowResult(null);
  }, []);

  const closeTaskFlow = useCallback(() => setFlowState(null), []);

  const runTaskFlow = useCallback(() => {
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
          : attemptTaskTransition(task.id, task.status === 'Done' ? 'To do' : task.status, {
            status: task.status === 'Done' ? 'To do' : task.status,
            deferredUntil: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined,
            nextReviewAt: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined,
          });

    setFlowWarnings(result.validation.warnings);
    setFlowBlockers(result.validation.blockers);
    if (!result.applied) {
      setFlowResult({ tone: 'danger', message: 'Action not applied. Resolve blockers and retry.' });
      return;
    }

    setFlowState(null);
    setLaneFeedback({
      tone: result.validation.warnings.length ? 'warn' : 'success',
      message: flowState.kind === 'done'
        ? `Marked "${task.title}" done.`
        : flowState.kind === 'block'
          ? `Blocked "${task.title}".`
          : flowState.kind === 'unblock'
            ? `Unblocked "${task.title}".`
            : `Deferred "${task.title}".`,
    });
  }, [flowState, tasks, attemptTaskTransition, completionNoteDraft, blockReasonDraft, nextReviewDraft, deferDateDraft]);

  const runRecommendedTaskAction = useCallback(() => {
    if (!selectedTask || !recommendedAction) return;
    if (recommendedAction.id === 'complete') return openTaskFlow(selectedTask, 'done');
    if (recommendedAction.id === 'defer') return openTaskFlow(selectedTask, 'defer');
    if (recommendedAction.id === 'block') return openTaskFlow(selectedTask, 'block');
    if (recommendedAction.id === 'unblock') return openTaskFlow(selectedTask, 'unblock');
  }, [selectedTask, recommendedAction, openTaskFlow]);

  const renderNowSignal = useCallback((task: TaskItem) => {
    const dueTimestamp = task.dueDate ? new Date(task.dueDate).getTime() : null;
    const now = Date.now();
    const isOverdue = Boolean(dueTimestamp && dueTimestamp < now && task.status !== 'Done');
    const dueSoon = Boolean(dueTimestamp && dueTimestamp > now && dueTimestamp <= now + (3 * 86400000) && task.status !== 'Done');
    const whyNow = task.status === 'Blocked'
      ? (task.blockReason ? `Blocked: ${task.blockReason}` : 'Blocked — missing unblock reason')
      : isOverdue
        ? `Overdue since ${formatDate(task.dueDate)}`
        : dueSoon
          ? `Due soon: ${formatDate(task.dueDate)}`
          : task.dueDate
            ? `Due ${formatDate(task.dueDate)}`
            : (isTaskDeferred(task) ? `Deferred until ${formatDate(task.deferredUntil)}` : 'No due date set');
    const nextMove = task.status === 'Done'
      ? 'Completed'
      : task.status === 'Blocked'
        ? 'Capture unblock step'
        : (task.nextStep || task.recommendedAction || 'Define next step');

    return { whyNow, nextMove, isOverdue, dueSoon };
  }, []);

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskDetailOpen(true);
  }, [setSelectedTaskId]);

  const handleDoneTask = useCallback((task: TaskItem) => openTaskFlow(task, 'done'), [openTaskFlow]);
  const handleToggleBlockTask = useCallback((task: TaskItem) => openTaskFlow(task, task.status === 'Blocked' ? 'unblock' : 'block'), [openTaskFlow]);
  const hasLinkedParent = useCallback((linkedFollowUpId?: string | null) => Boolean(linkedFollowUpId && followUpById.get(linkedFollowUpId)), [followUpById]);

  const closeTaskDetail = useCallback(() => setTaskDetailOpen(false), []);
  const handleSearchQueryChange = useCallback((value: string) => setSearchQuery(value), []);
  const clearSearch = useCallback(() => setSearchQuery(''), []);
  const toggleViewOptions = useCallback(() => setViewOptionsOpen((prev) => !prev), []);

  return (
    <WorkspacePage>
      <div className="task-workspace-header-slim">
        <SectionHeader title="Tasks" subtitle={modeConfig.taskSubtitle} compact />
        <div className="task-workspace-header-metrics">
          <span>Open {summary.open}</span>
          <span>Due soon {summary.dueSoon}</span>
          <span>Blocked {summary.blocked}</span>
          {summary.reviewRequired ? <span>Review needed {summary.reviewRequired}</span> : null}
        </div>
      </div>

      <section className="detail-card task-workspace-main-card">
        <TaskToolbar
          isMobileLike={isMobileLike}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          onClearSearch={clearSearch}
          view={view}
          onViewChange={setView}
          taskViewOptions={taskViewOptions}
          viewOptionsOpen={viewOptionsOpen}
          onToggleViewOptions={toggleViewOptions}
          onOpenCreateTaskModal={openCreateTaskModal}
          activeFilterCount={activeFilterCount}
          personalMode={personalMode}
          projectFilter={projectFilter}
          projectOptions={projectOptions}
          onProjectFilterChange={setProjectFilter}
          assigneeFilter={assigneeFilter}
          assignees={assignees}
          onAssigneeFilterChange={setAssigneeFilter}
          taskOwnerFilter={taskOwnerFilter}
          owners={owners}
          onTaskOwnerFilterChange={setTaskOwnerFilter}
          taskStatusFilter={taskStatusFilter}
          onTaskStatusFilterChange={setTaskStatusFilter}
          linkedFilter={linkedFilter}
          onLinkedFilterChange={setLinkedFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onResetFilters={resetFilters}
          activeFilterChips={activeFilterChips}
        />

        <TaskList
          filteredTasks={filteredTasks}
          selectedTaskId={selectedTask?.id ?? null}
          laneFeedback={laneFeedback}
          onSelectTask={handleSelectTask}
          onDoneTask={handleDoneTask}
          onToggleBlockTask={handleToggleBlockTask}
          getParentLinkedFollowUpId={hasLinkedParent}
          renderNowSignal={renderNowSignal}
        />

        <ExecutionLaneFooterMeta shownCount={filteredTasks.length} selectedCount={selectedTask ? 1 : 0} scopeSummary={`View: ${taskViewOptions.find((entry) => entry.value === view)?.label || view}`} hint="Open a task when you need more detail." />
      </section>

      <TaskInspectorModal
        open={taskDetailOpen}
        selectedTask={selectedTask}
        linkedFollowUp={linkedFollowUp}
        linkedTaskOpenCount={linkedTaskOpenCount}
        linkedParentRollup={linkedParentRollup}
        linkedParentCloseout={linkedParentCloseout}
        recommendedAction={recommendedAction}
        renderNowSignal={renderNowSignal}
        onClose={closeTaskDetail}
        onRunRecommendedTaskAction={runRecommendedTaskAction}
        onOpenTaskFlow={openTaskFlow}
        onUpdateTask={updateTask}
        onOpenLinkedFollowUp={onOpenLinkedFollowUp}
        onOpenRecordDrawer={openRecordDrawer}
        onOpenRecordEditor={openRecordEditor}
      />

      <TaskActionFlow
        flowState={flowState}
        flowWarnings={flowWarnings}
        flowBlockers={flowBlockers}
        flowResult={flowResult}
        completionNoteDraft={completionNoteDraft}
        blockReasonDraft={blockReasonDraft}
        deferDateDraft={deferDateDraft}
        nextReviewDraft={nextReviewDraft}
        onCancel={closeTaskFlow}
        onConfirm={runTaskFlow}
        onCompletionNoteChange={setCompletionNoteDraft}
        onBlockReasonChange={setBlockReasonDraft}
        onDeferDateChange={setDeferDateDraft}
        onNextReviewChange={setNextReviewDraft}
      />
    </WorkspacePage>
  );
}
