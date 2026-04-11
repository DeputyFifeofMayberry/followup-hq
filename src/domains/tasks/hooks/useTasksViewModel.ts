import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpChildRollup } from '../../../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../../../lib/closeoutReadiness';
import { addDaysIso, formatDate, isTaskDeferred, todayIso } from '../../../lib/utils';
import { isExecutionReady } from '../../records/integrity';
import { deriveTaskRecommendedAction } from '../../shared';
import { useAppStore } from '../../../store/useAppStore';
import type { TaskItem, TaskPriority } from '../../../types';
import { TASK_LANE_DEFINITIONS, type TaskQueueView } from '../lanes';
import { normalizeTaskStatus, selectTaskCounts, selectVisibleTasksForQueue } from '../selectors';
import { getTaskDueBucket, isTaskOverdueByDay } from '../timing';

export type TaskView = TaskQueueView;
export type TaskSort = 'due' | 'priority' | 'updated';

type TimingFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'no_due_date';
type StateFilter = 'all' | 'deferred_only' | 'review_needed_only' | 'blocked_without_unblock';
type LinkageFilter = 'all' | 'linked' | 'unlinked' | 'parent_at_risk';
type PriorityFilter = 'All' | TaskPriority;

const defaultFilterState = {
  project: 'All',
  assignee: 'All',
  linked: 'all' as LinkageFilter,
  sortBy: 'due' as TaskSort,
  view: 'all' as TaskView,
  timingFilter: 'all' as TimingFilter,
  stateFilter: 'all' as StateFilter,
  priorityFilter: 'All' as PriorityFilter,
};

const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function normalizeSearchBlob(parts: Array<string | undefined | null>) {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim().toLowerCase())
    .join(' ');
}

export function resolveTaskOpenProjectFilter(taskProject: string | undefined, requestedProject?: string) {
  if (!taskProject) return 'All';
  const normalizedRequested = requestedProject?.trim();
  if (normalizedRequested && normalizedRequested !== 'All' && normalizedRequested === taskProject) {
    return taskProject;
  }
  return 'All';
}

export function useTasksViewModel({ personalMode = false }: { personalMode?: boolean } = {}) {
  const store = useAppStore(useShallow((s) => ({
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
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
    attemptTaskTransition: s.attemptTaskTransition,
    executionIntent: s.executionIntent,
    clearExecutionIntent: s.clearExecutionIntent,
  })));

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [view, setViewState] = useState<TaskView>(() => {
    const saved = localStorage.getItem('tasks_pref_view');
    return (saved as TaskView) || defaultFilterState.view;
  });
  const [sortBy, setSortByState] = useState<TaskSort>(() => {
    const saved = localStorage.getItem('tasks_pref_sortBy');
    return (saved as TaskSort) || defaultFilterState.sortBy;
  });
  const setView = (v: TaskView) => { setViewState(v); localStorage.setItem('tasks_pref_view', v); };
  const setSortBy = (s: TaskSort) => { setSortByState(s); localStorage.setItem('tasks_pref_sortBy', s); };

  const [projectFilter, setProjectFilter] = useState(defaultFilterState.project);
  const [assigneeFilter, setAssigneeFilter] = useState(defaultFilterState.assignee);
  const [linkedFilter, setLinkedFilter] = useState<LinkageFilter>(defaultFilterState.linked);
  const [timingFilter, setTimingFilter] = useState<TimingFilter>(defaultFilterState.timingFilter);
  const [stateFilter, setStateFilter] = useState<StateFilter>(defaultFilterState.stateFilter);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(defaultFilterState.priorityFilter);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim().toLowerCase()), 160);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const followUpById = useMemo(() => new Map(store.items.map((item) => [item.id, item])), [store.items]);

  const derivedTasks = useMemo(() => store.tasks.map((task) => {
    const linkedFollowUp = task.linkedFollowUpId ? followUpById.get(task.linkedFollowUpId) : undefined;
    const executionReady = isExecutionReady(task);
    const dueTs = task.dueDate ? new Date(task.dueDate).getTime() : null;
    const updatedTs = new Date(task.updatedAt).getTime();
    const needsReview = !executionReady || task.lifecycleState === 'review_required' || task.dataQuality === 'review_required';
    const reviewLabels = [
      ...(task.reviewReasons ?? []),
      ...(task.cleanupReasons ?? []),
      ...(task.lifecycleState ? [`lifecycle:${task.lifecycleState}`] : []),
      ...(task.dataQuality ? [`quality:${task.dataQuality}`] : []),
    ];
    return {
      ...task,
      dueTs,
      updatedTs,
      executionReady,
      needsReview,
      linkedParentAtRisk: linkedFollowUp?.status === 'At risk',
      reviewLabels,
      searchBlob: normalizeSearchBlob([
        task.title,
        task.project,
        task.owner,
        task.assigneeDisplayName,
        task.summary,
        task.nextStep,
        task.notes,
        task.contextNote,
        task.blockReason,
        task.tags.join(' '),
        linkedFollowUp?.title,
        linkedFollowUp?.project,
        task.lifecycleState,
        task.dataQuality,
        reviewLabels.join(' '),
      ]),
    };
  }), [store.tasks, followUpById]);

  const taskSummary = useMemo(() => {
    return selectTaskCounts(derivedTasks, {
      isReviewNeeded: (task) => task.needsReview,
      isExecutionReady: (task) => task.executionReady,
    });
  }, [derivedTasks]);

  const viewScopedTasks = useMemo(() => {
    return selectVisibleTasksForQueue(derivedTasks, view, {
      isReviewNeeded: (task) => task.needsReview,
      isExecutionReady: (task) => task.executionReady,
    });
  }, [derivedTasks, view]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const weekEndTs = now.getTime() + 7 * 86400000;

    const byFilters = viewScopedTasks.filter((task) => {
      const ownerMatch = store.taskOwnerFilter === 'All' || task.owner === store.taskOwnerFilter;
      const taskStatus = normalizeTaskStatus(task.status);
      const statusMatch = store.taskStatusFilter === 'All' || taskStatus === store.taskStatusFilter;
      const projectMatch = projectFilter === 'All' || task.project === projectFilter;
      const assigneeMatch = assigneeFilter === 'All' || (task.assigneeDisplayName || task.owner) === assigneeFilter;
      const textMatch = !debouncedSearchQuery || task.searchBlob.includes(debouncedSearchQuery);
      const linkedMatch = linkedFilter === 'all'
        || (linkedFilter === 'linked' ? Boolean(task.linkedFollowUpId) : linkedFilter === 'unlinked' ? !task.linkedFollowUpId : task.linkedParentAtRisk);
      const dueBucket = getTaskDueBucket(task, now);
      const timingMatch = timingFilter === 'all'
        || (timingFilter === 'overdue' ? dueBucket === 'overdue'
          : timingFilter === 'today' ? dueBucket === 'today'
            : timingFilter === 'this_week' ? task.dueTs !== null && task.dueTs <= weekEndTs && dueBucket !== 'overdue'
              : task.dueTs === null);
      const stateMatch = stateFilter === 'all'
        || (stateFilter === 'deferred_only' ? Boolean(task.deferredUntil) && isTaskDeferred(task)
          : stateFilter === 'review_needed_only' ? task.needsReview
            : taskStatus === 'Blocked' && !(task.nextStep || '').trim());
      const priorityMatch = priorityFilter === 'All' || task.priority === priorityFilter;
      return ownerMatch && statusMatch && projectMatch && assigneeMatch && linkedMatch && textMatch && timingMatch && stateMatch && priorityMatch;
    });

    return [...byFilters].sort((a, b) => {
      if (view === 'today') {
        const aOverdue = isTaskOverdueByDay({ ...a, status: normalizeTaskStatus(a.status) }, now);
        const bOverdue = isTaskOverdueByDay({ ...b, status: normalizeTaskStatus(b.status) }, now);
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      }
      if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority];
      if (sortBy === 'updated') return b.updatedTs - a.updatedTs;
      const aDue = a.dueTs ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueTs ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [viewScopedTasks, view, sortBy, store.taskOwnerFilter, store.taskStatusFilter, projectFilter, assigneeFilter, linkedFilter, debouncedSearchQuery, timingFilter, stateFilter, priorityFilter]);

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === store.selectedTaskId) ?? store.tasks.find((task) => task.id === store.selectedTaskId) ?? null,
    [filteredTasks, store.tasks, store.selectedTaskId],
  );

  const tasksByFollowUpId = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    for (const task of store.tasks) {
      if (!task.linkedFollowUpId) continue;
      const bucket = grouped.get(task.linkedFollowUpId);
      if (bucket) bucket.push(task);
      else grouped.set(task.linkedFollowUpId, [task]);
    }
    return grouped;
  }, [store.tasks]);

  const linkedFollowUpForSelected = selectedTask?.linkedFollowUpId ? (followUpById.get(selectedTask.linkedFollowUpId) ?? null) : null;
  const linkedTasksForSelectedParent = linkedFollowUpForSelected ? (tasksByFollowUpId.get(linkedFollowUpForSelected.id) ?? []) : [];
  const linkedParentRollup = linkedFollowUpForSelected
    ? buildFollowUpChildRollup(linkedFollowUpForSelected.id, linkedFollowUpForSelected.status, store.tasks, linkedTasksForSelectedParent)
    : null;
  const linkedParentCloseout = linkedFollowUpForSelected
    ? evaluateFollowUpCloseout(linkedFollowUpForSelected, store.tasks, undefined, linkedTasksForSelectedParent)
    : null;

  const recommendedAction = selectedTask ? deriveTaskRecommendedAction(selectedTask) : null;

  const owners = useMemo(() => ['All', ...Array.from(new Set(store.tasks.map((task) => task.owner).filter(Boolean))).sort()], [store.tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(store.tasks.map((task) => task.assigneeDisplayName || task.owner).filter(Boolean))).sort()], [store.tasks]);
  const projectOptions = useMemo(() => ['All', ...store.projects.map((project) => project.name)], [store.projects]);

  const queueSummary = useMemo(() => {
    if (view === 'today') return `Now lane: ${filteredTasks.length} execution-ready tasks due today or ready now (${taskSummary.overdue} overdue tracked separately).`;
    if (view === 'review') return `Review lane: ${filteredTasks.length} tasks need trust cleanup (${taskSummary.reviewNotReady} not execution-ready).`;
    if (view === 'overdue') return `Overdue lane: ${filteredTasks.length} late tasks need recovery moves and clear owners.`;
    if (view === 'deferred') return `Deferred lane: ${filteredTasks.length} intentionally snoozed tasks not yet ready to re-enter.`;
    if (view === 'recent') return `Done today lane: ${filteredTasks.length} tasks completed today.`;
    if (view === 'all') return `All open lane: ${taskSummary.open} open · ${taskSummary.overdue} overdue · ${taskSummary.blocked} blocked · ${taskSummary.reviewRequired} review needed.`;
    return `${TASK_LANE_DEFINITIONS[view].label}: ${filteredTasks.length} tasks in this operational queue.`;
  }, [filteredTasks.length, taskSummary, view]);

  const activeFilterCount = useMemo(() => (
    [
      debouncedSearchQuery.length > 0,
      projectFilter !== defaultFilterState.project,
      assigneeFilter !== defaultFilterState.assignee,
      !personalMode && store.taskOwnerFilter !== 'All',
      store.taskStatusFilter !== 'All',
      linkedFilter !== defaultFilterState.linked,
      timingFilter !== defaultFilterState.timingFilter,
      stateFilter !== defaultFilterState.stateFilter,
      priorityFilter !== defaultFilterState.priorityFilter,
    ].filter(Boolean).length
  ), [debouncedSearchQuery.length, projectFilter, assigneeFilter, personalMode, store.taskOwnerFilter, store.taskStatusFilter, linkedFilter, timingFilter, stateFilter, priorityFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchQuery.trim()) chips.push({ key: 'search', label: `Search: ${searchQuery.trim()}`, clear: () => setSearchQuery('') });
    if (projectFilter !== defaultFilterState.project) chips.push({ key: 'project', label: `Project: ${projectFilter}`, clear: () => setProjectFilter(defaultFilterState.project) });
    if (assigneeFilter !== defaultFilterState.assignee) chips.push({ key: 'assignee', label: `Assignee: ${assigneeFilter}`, clear: () => setAssigneeFilter(defaultFilterState.assignee) });
    if (!personalMode && store.taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${store.taskOwnerFilter}`, clear: () => store.setTaskOwnerFilter('All') });
    if (store.taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${store.taskStatusFilter}`, clear: () => store.setTaskStatusFilter('All') });
    if (linkedFilter !== defaultFilterState.linked) chips.push({ key: 'linked', label: `Linkage: ${linkedFilter.replaceAll('_', ' ')}`, clear: () => setLinkedFilter(defaultFilterState.linked) });
    if (timingFilter !== defaultFilterState.timingFilter) chips.push({ key: 'timing', label: `Timing: ${timingFilter.replaceAll('_', ' ')}`, clear: () => setTimingFilter(defaultFilterState.timingFilter) });
    if (stateFilter !== defaultFilterState.stateFilter) chips.push({ key: 'state', label: `State: ${stateFilter.replaceAll('_', ' ')}`, clear: () => setStateFilter(defaultFilterState.stateFilter) });
    if (priorityFilter !== defaultFilterState.priorityFilter) chips.push({ key: 'priority', label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter(defaultFilterState.priorityFilter) });
    return chips;
  }, [searchQuery, projectFilter, assigneeFilter, personalMode, store, linkedFilter, timingFilter, stateFilter, priorityFilter]);

  const sortSummary = sortBy === 'due' ? '' : sortBy === 'priority' ? 'Sorted by priority' : 'Sorted by recently updated';

  const completedToday = useMemo(() => {
    const todayStartTs = new Date().setHours(0, 0, 0, 0);
    return store.tasks.filter((task) => normalizeTaskStatus(task.status) === 'Done' && task.completedAt && new Date(task.completedAt).getTime() >= todayStartTs);
  }, [store.tasks]);

  const reviewRequiredTasks = useMemo(() => derivedTasks.filter((task) => task.needsReview), [derivedTasks]);

  const resetPanelFilters = () => {
    store.setTaskOwnerFilter('All');
    store.setTaskStatusFilter('All');
    setProjectFilter(defaultFilterState.project);
    setAssigneeFilter(defaultFilterState.assignee);
    setLinkedFilter(defaultFilterState.linked);
    setTimingFilter(defaultFilterState.timingFilter);
    setStateFilter(defaultFilterState.stateFilter);
    setPriorityFilter(defaultFilterState.priorityFilter);
    setSortBy(defaultFilterState.sortBy);
  };

  const getTaskSignal = (task: TaskItem) => {
    const dueBucket = getTaskDueBucket(task, new Date());
    const isOverdue = dueBucket === 'overdue';
    const dueSoon = dueBucket === 'today' || dueBucket === 'tomorrow';

    const whyNow = task.needsCleanup || task.lifecycleState === 'review_required' || task.dataQuality === 'review_required'
      ? `Review needed: ${(task.reviewReasons?.[0] || task.cleanupReasons?.[0] || 'Resolve task integrity details').replaceAll('_', ' ')}`
      : task.status === 'Blocked'
        ? (task.blockReason ? `Blocked: ${task.blockReason}` : 'Blocked: capture unblock reason')
        : dueBucket === 'overdue'
          ? `Overdue since ${formatDate(task.dueDate)}`
          : dueBucket === 'today'
            ? `Due today (${formatDate(task.dueDate)})`
            : dueBucket === 'tomorrow'
              ? `Due tomorrow (${formatDate(task.dueDate)})`
          : dueSoon
            ? `Due soon: ${formatDate(task.dueDate)}`
            : task.dueDate
              ? `Due ${formatDate(task.dueDate)}`
              : (isTaskDeferred(task) ? `Deferred until ${formatDate(task.deferredUntil)}` : 'Active queue: no due date yet');

    const nextMove = task.status === 'Done'
      ? 'Completed'
      : (task.nextStep || task.recommendedAction || 'Define next step');

    return { whyNow, nextMove, isOverdue, dueSoon, needsReview: Boolean(task.reviewReasons?.length || task.cleanupReasons?.length || task.lifecycleState === 'review_required' || task.dataQuality === 'review_required') };
  };

  const hasLinkedFollowUp = (linkedFollowUpId?: string | null) => Boolean(linkedFollowUpId && followUpById.get(linkedFollowUpId));

  const openTaskInWorkspace = (taskId: string, options?: { project?: string }) => {
    const task = store.tasks.find((entry) => entry.id === taskId);
    store.setSelectedTaskId(taskId);
    setSearchQuery('');
    setView('all');
    store.setTaskOwnerFilter('All');
    store.setTaskStatusFilter('All');
    setAssigneeFilter('All');
    setLinkedFilter('all');
    setTimingFilter('all');
    setStateFilter('all');
    setPriorityFilter('All');
    setSortBy(defaultFilterState.sortBy);

    if (!task) {
      setProjectFilter('All');
      return;
    }

    setProjectFilter(resolveTaskOpenProjectFilter(task.project, options?.project));
  };

  return {
    ...store,
    tasks: store.tasks,
    items: store.items,
    projects: store.projects,
    selectedTask,
    filteredTasks,
    reviewRequiredTasks,
    taskSummary,
    projectOptions,
    ownerOptions: owners,
    assigneeOptions: assignees,
    activeFilterCount,
    activeFilterChips,
    linkedFollowUpForSelected,
    linkedTasksForSelectedParent,
    linkedParentRollup,
    linkedParentCloseout,
    recommendedAction,
    queueSummary,
    searchQuery,
    setSearchQuery,
    clearSearchQuery: () => setSearchQuery(''),
    sortBy,
    setSortBy,
    view,
    setView,
    projectFilter,
    setProjectFilter,
    assigneeFilter,
    setAssigneeFilter,
    linkedFilter,
    setLinkedFilter,
    timingFilter,
    setTimingFilter,
    stateFilter,
    setStateFilter,
    priorityFilter,
    setPriorityFilter,
    resetPanelFilters,
    sortSummary,
    getTaskSignal,
    hasLinkedFollowUp,
    completedToday,
    openTaskInWorkspace,
  };
}

export function getTaskFlowDefaults(task: TaskItem) {
  return {
    completionNoteDraft: task.completionNote || '',
    blockReasonDraft: task.blockReason || '',
    deferDateDraft: (task.deferredUntil || addDaysIso(todayIso(), 2)).slice(0, 10),
    nextReviewDraft: (task.nextReviewAt || addDaysIso(todayIso(), 1)).slice(0, 10),
  };
}
