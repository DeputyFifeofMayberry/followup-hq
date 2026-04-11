import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpChildRollup } from '../../../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../../../lib/closeoutReadiness';
import { addDaysIso, formatDate, isTaskDeferred, todayIso } from '../../../lib/utils';
import { isExecutionReady } from '../../records/integrity';
import { deriveTaskRecommendedAction } from '../../shared';
import { useAppStore } from '../../../store/useAppStore';
import type { TaskItem, TaskStatus } from '../../../types';
import { TASK_LANE_DEFINITIONS } from '../lanes';
import { normalizeTaskStatus, selectTaskCounts, selectVisibleTasksForQueue } from '../selectors';
import { getTaskDueBucket, isTaskOverdueByDay } from '../timing';
import {
  defaultTaskWorkspaceSession,
  type TaskLinkageFilter,
  type TaskPriorityFilter,
  type TaskQueueView,
  type TaskSort,
  type TaskStateFilter,
  type TaskTimingFilter,
} from '../types';

export type { TaskQueueView, TaskSort };

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
    taskWorkspaceSession: s.taskWorkspaceSession,
    setSelectedTaskId: s.setSelectedTaskId,
    setTaskWorkspaceSession: s.setTaskWorkspaceSession,
    resetTaskWorkspaceSession: s.resetTaskWorkspaceSession,
    openCreateTaskModal: s.openCreateTaskModal,
    openEditTaskModal: s.openEditTaskModal,
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
    attemptTaskTransition: s.attemptTaskTransition,
    executionIntent: s.executionIntent,
    clearExecutionIntent: s.clearExecutionIntent,
  })));
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const session = store.taskWorkspaceSession;
  const view = session.view;
  const sortBy = session.sortBy;
  const searchQuery = session.searchQuery;
  const projectFilter = session.projectFilter;
  const assigneeFilter = session.assigneeFilter;
  const linkedFilter = session.linkedFilter;
  const timingFilter = session.timingFilter;
  const stateFilter = session.stateFilter;
  const priorityFilter = session.priorityFilter;
  const taskOwnerFilter = session.ownerFilter;
  const taskStatusFilter = session.statusFilter;

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
      const ownerMatch = taskOwnerFilter === 'All' || task.owner === taskOwnerFilter;
      const taskStatus = normalizeTaskStatus(task.status);
      const statusMatch = taskStatusFilter === 'All' || taskStatus === taskStatusFilter;
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
  }, [viewScopedTasks, view, sortBy, taskOwnerFilter, taskStatusFilter, projectFilter, assigneeFilter, linkedFilter, debouncedSearchQuery, timingFilter, stateFilter, priorityFilter]);

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
    if (view === 'today') return `Now queue: ${filteredTasks.length} execution-ready tasks due today or ready to pull now.`;
    if (view === 'review') return `Review needed queue: ${filteredTasks.length} tasks require trust cleanup (${taskSummary.reviewNotReady} not execution-ready).`;
    if (view === 'overdue') return `Overdue queue: ${filteredTasks.length} late tasks need recovery moves and clear ownership.`;
    if (view === 'deferred') return `Deferred queue: ${filteredTasks.length} intentionally snoozed tasks waiting to re-enter execution.`;
    if (view === 'recent') return `Done today queue: ${filteredTasks.length} tasks completed today.`;
    if (view === 'all') return `All open queue: ${taskSummary.open} open · ${taskSummary.overdue} overdue · ${taskSummary.blocked} blocked · ${taskSummary.reviewRequired} review needed.`;
    return `${TASK_LANE_DEFINITIONS[view].label} queue: ${filteredTasks.length} tasks in this operational scope.`;
  }, [filteredTasks.length, taskSummary, view]);

  const activeFilterCount = useMemo(() => (
    [
      debouncedSearchQuery.length > 0,
      projectFilter !== defaultTaskWorkspaceSession.projectFilter,
      assigneeFilter !== defaultTaskWorkspaceSession.assigneeFilter,
      !personalMode && taskOwnerFilter !== 'All',
      taskStatusFilter !== 'All',
      linkedFilter !== defaultTaskWorkspaceSession.linkedFilter,
      timingFilter !== defaultTaskWorkspaceSession.timingFilter,
      stateFilter !== defaultTaskWorkspaceSession.stateFilter,
      priorityFilter !== defaultTaskWorkspaceSession.priorityFilter,
    ].filter(Boolean).length
  ), [debouncedSearchQuery.length, projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, linkedFilter, timingFilter, stateFilter, priorityFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchQuery.trim()) chips.push({ key: 'search', label: `Search: ${searchQuery.trim()}`, clear: () => store.setTaskWorkspaceSession({ searchQuery: '' }) });
    if (projectFilter !== defaultTaskWorkspaceSession.projectFilter) chips.push({ key: 'project', label: `Project: ${projectFilter}`, clear: () => store.setTaskWorkspaceSession({ projectFilter: defaultTaskWorkspaceSession.projectFilter }) });
    if (assigneeFilter !== defaultTaskWorkspaceSession.assigneeFilter) chips.push({ key: 'assignee', label: `Assignee: ${assigneeFilter}`, clear: () => store.setTaskWorkspaceSession({ assigneeFilter: defaultTaskWorkspaceSession.assigneeFilter }) });
    if (!personalMode && taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${taskOwnerFilter}`, clear: () => store.setTaskWorkspaceSession({ ownerFilter: 'All' }) });
    if (taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${taskStatusFilter}`, clear: () => store.setTaskWorkspaceSession({ statusFilter: 'All' }) });
    if (linkedFilter !== defaultTaskWorkspaceSession.linkedFilter) chips.push({ key: 'linked', label: `Linkage: ${linkedFilter.replaceAll('_', ' ')}`, clear: () => store.setTaskWorkspaceSession({ linkedFilter: defaultTaskWorkspaceSession.linkedFilter }) });
    if (timingFilter !== defaultTaskWorkspaceSession.timingFilter) chips.push({ key: 'timing', label: `Timing: ${timingFilter.replaceAll('_', ' ')}`, clear: () => store.setTaskWorkspaceSession({ timingFilter: defaultTaskWorkspaceSession.timingFilter }) });
    if (stateFilter !== defaultTaskWorkspaceSession.stateFilter) chips.push({ key: 'state', label: `State: ${stateFilter.replaceAll('_', ' ')}`, clear: () => store.setTaskWorkspaceSession({ stateFilter: defaultTaskWorkspaceSession.stateFilter }) });
    if (priorityFilter !== defaultTaskWorkspaceSession.priorityFilter) chips.push({ key: 'priority', label: `Priority: ${priorityFilter}`, clear: () => store.setTaskWorkspaceSession({ priorityFilter: defaultTaskWorkspaceSession.priorityFilter }) });
    return chips;
  }, [searchQuery, projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, store, linkedFilter, timingFilter, stateFilter, priorityFilter]);

  const sortSummary = sortBy === 'due' ? '' : sortBy === 'priority' ? 'Sorted by priority' : 'Sorted by recently updated';

  const completedToday = useMemo(() => {
    const todayStartTs = new Date().setHours(0, 0, 0, 0);
    return store.tasks.filter((task) => normalizeTaskStatus(task.status) === 'Done' && task.completedAt && new Date(task.completedAt).getTime() >= todayStartTs);
  }, [store.tasks]);

  const reviewRequiredTasks = useMemo(() => derivedTasks.filter((task) => task.needsReview), [derivedTasks]);

  const resetPanelFilters = () => {
    store.resetTaskWorkspaceSession({ preserveView: true });
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
    store.resetTaskWorkspaceSession();
    store.setTaskWorkspaceSession({
      view: 'all',
      projectFilter: task ? resolveTaskOpenProjectFilter(task.project, options?.project) : 'All',
    });
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
    setSearchQuery: (value: string) => store.setTaskWorkspaceSession({ searchQuery: value }),
    clearSearchQuery: () => store.setTaskWorkspaceSession({ searchQuery: '' }),
    sortBy,
    setSortBy: (value: TaskSort) => store.setTaskWorkspaceSession({ sortBy: value }),
    view,
    setView: (value: TaskQueueView) => store.setTaskWorkspaceSession({ view: value }),
    projectFilter,
    setProjectFilter: (value: string) => store.setTaskWorkspaceSession({ projectFilter: value }),
    assigneeFilter,
    setAssigneeFilter: (value: string) => store.setTaskWorkspaceSession({ assigneeFilter: value }),
    taskOwnerFilter,
    setTaskOwnerFilter: (value: string) => store.setTaskWorkspaceSession({ ownerFilter: value }),
    taskStatusFilter,
    setTaskStatusFilter: (value: 'All' | TaskStatus) => store.setTaskWorkspaceSession({ statusFilter: value }),
    linkedFilter,
    setLinkedFilter: (value: TaskLinkageFilter) => store.setTaskWorkspaceSession({ linkedFilter: value }),
    timingFilter,
    setTimingFilter: (value: TaskTimingFilter) => store.setTaskWorkspaceSession({ timingFilter: value }),
    stateFilter,
    setStateFilter: (value: TaskStateFilter) => store.setTaskWorkspaceSession({ stateFilter: value }),
    priorityFilter,
    setPriorityFilter: (value: TaskPriorityFilter) => store.setTaskWorkspaceSession({ priorityFilter: value }),
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
