import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpChildRollup } from '../../../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../../../lib/closeoutReadiness';
import { addDaysIso, formatDate, isTaskDeferred, todayIso } from '../../../lib/utils';
import { isExecutionReady } from '../../records/integrity';
import { deriveTaskRecommendedAction } from '../../shared';
import { useAppStore } from '../../../store/useAppStore';
import type { TaskItem } from '../../../types';

export type TaskView = 'today' | 'upcoming' | 'blocked' | 'all';
export type TaskSort = 'due' | 'priority' | 'updated';

const defaultFilterState = {
  project: 'All',
  assignee: 'All',
  linked: 'all' as const,
  sortBy: 'due' as TaskSort,
  view: 'today' as TaskView,
};

const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// Urgency tiers for Today view compound sort (Fix 4).
// Lower number = higher urgency = sorts first.
function getUrgencyTier(task: { dueTs: number | null; status: string; deferredUntil?: string }, nowTs: number): number {
  if (task.dueTs !== null && task.dueTs < nowTs) return 0; // Overdue
  if (task.dueTs !== null && task.dueTs <= nowTs + 86400000) return 1; // Due today/tomorrow
  if (task.status === 'Blocked') return 2; // Blocked (no due date context)
  if (task.deferredUntil && new Date(task.deferredUntil).getTime() <= nowTs) return 3; // Deferred wake-up
  if (task.dueTs !== null) return 4; // Due in future
  return 5; // No due date
}

function normalizeSearchBlob(parts: Array<string | undefined | null>) {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim().toLowerCase())
    .join(' ');
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

  // Fix 3: Persist view and sort preferences across sessions via localStorage.
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
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>(defaultFilterState.linked);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim().toLowerCase()), 160);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const followUpById = useMemo(() => new Map(store.items.map((item) => [item.id, item])), [store.items]);

  const derivedTasks = useMemo(() => store.tasks
    .filter((task) => isExecutionReady(task))
    .map((task) => {
      const linkedFollowUp = task.linkedFollowUpId ? followUpById.get(task.linkedFollowUpId) : undefined;
      return {
        ...task,
        dueTs: task.dueDate ? new Date(task.dueDate).getTime() : null,
        updatedTs: new Date(task.updatedAt).getTime(),
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
        ]),
      };
    }), [store.tasks, followUpById]);

  const viewScopedTasks = useMemo(() => {
    const nowTs = Date.now();
    const endTomorrowTs = nowTs + 86400000;
    const endWeekTs = nowTs + 7 * 86400000;

    return derivedTasks.filter((task) => {
      if (task.status === 'Done') return false;
      if (view === 'today') {
        if (task.status === 'Blocked') return true;
        if (task.dueTs !== null && task.dueTs <= endTomorrowTs) return true;
        // Fix 1: Surface tasks whose deferral snooze has expired — they are actionable again.
        if (task.deferredUntil && !isTaskDeferred(task)) return true;
        return false;
      }
      if (view === 'upcoming') return task.dueTs !== null && task.dueTs > endTomorrowTs && task.dueTs <= endWeekTs;
      if (view === 'blocked') return task.status === 'Blocked';
      return true;
    });
  }, [derivedTasks, view]);

  const filteredTasks = useMemo(() => {
    const byFilters = viewScopedTasks.filter((task) => {
      const ownerMatch = store.taskOwnerFilter === 'All' || task.owner === store.taskOwnerFilter;
      const statusMatch = store.taskStatusFilter === 'All' || task.status === store.taskStatusFilter;
      const projectMatch = projectFilter === 'All' || task.project === projectFilter;
      const assigneeMatch = assigneeFilter === 'All' || (task.assigneeDisplayName || task.owner) === assigneeFilter;
      const linkedMatch = linkedFilter === 'all' || (linkedFilter === 'linked' ? Boolean(task.linkedFollowUpId) : !task.linkedFollowUpId);
      const textMatch = !debouncedSearchQuery || task.searchBlob.includes(debouncedSearchQuery);
      return ownerMatch && statusMatch && projectMatch && assigneeMatch && linkedMatch && textMatch;
    });

    // Fix 4: In the Today view, apply urgency tiers before the user-selected sort so that
    // overdue tasks always surface above due-today tasks, which surface above blocked/deferred.
    return [...byFilters].sort((a, b) => {
      if (view === 'today') {
        const nowTs = Date.now();
        const tierDiff = getUrgencyTier(a, nowTs) - getUrgencyTier(b, nowTs);
        if (tierDiff !== 0) return tierDiff;
      }
      if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority];
      if (sortBy === 'updated') return b.updatedTs - a.updatedTs;
      const aDue = a.dueTs ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueTs ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [viewScopedTasks, view, store.taskOwnerFilter, store.taskStatusFilter, projectFilter, assigneeFilter, linkedFilter, debouncedSearchQuery, sortBy]);

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

  const owners = useMemo(() => ['All', ...Array.from(new Set(store.tasks.map((task) => task.owner))).sort()], [store.tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(store.tasks.map((task) => task.assigneeDisplayName || task.owner))).sort()], [store.tasks]);
  const projectOptions = useMemo(() => ['All', ...store.projects.map((project) => project.name)], [store.projects]);

  const reviewRequiredTasks = useMemo(() => store.tasks.filter((task) => !isExecutionReady(task)), [store.tasks]);

  const taskSummary = useMemo(() => {
    const dueSoonThresholdTs = Date.now() + 2 * 86400000;
    const open = derivedTasks.filter((task) => task.status !== 'Done');
    return {
      open: open.length,
      shown: filteredTasks.length,
      dueSoon: open.filter((task) => task.dueTs !== null && task.dueTs <= dueSoonThresholdTs).length,
      blocked: open.filter((task) => task.status === 'Blocked').length,
      reviewRequired: reviewRequiredTasks.length,
      dueThisWeekShown: filteredTasks.filter((task) => task.dueTs !== null && task.dueTs <= (Date.now() + 7 * 86400000)).length,
      blockedNeedUnblockStep: filteredTasks.filter((task) => task.status === 'Blocked' && !task.nextStep.trim()).length,
    };
  }, [derivedTasks, filteredTasks, reviewRequiredTasks]);

  const queueSummary = useMemo(() => {
    if (view === 'blocked') return `Blocked ${taskSummary.shown} shown · ${taskSummary.blockedNeedUnblockStep} need unblock step`;
    if (view === 'upcoming') return `Upcoming ${taskSummary.shown} shown · ${taskSummary.dueThisWeekShown} due this week`;
    if (view === 'all') return `All open ${taskSummary.shown} shown · due soon ${taskSummary.dueSoon} · blocked ${taskSummary.blocked}`;
    return `Open ${taskSummary.open} · due soon ${taskSummary.dueSoon} · blocked ${taskSummary.blocked} · review needed ${taskSummary.reviewRequired}`;
  }, [view, taskSummary]);

  const activeFilterCount = useMemo(() => (
    [
      projectFilter !== defaultFilterState.project,
      assigneeFilter !== defaultFilterState.assignee,
      !personalMode && store.taskOwnerFilter !== 'All',
      store.taskStatusFilter !== 'All',
      linkedFilter !== defaultFilterState.linked,
      sortBy !== defaultFilterState.sortBy,
    ].filter(Boolean).length
  ), [projectFilter, assigneeFilter, personalMode, store.taskOwnerFilter, store.taskStatusFilter, linkedFilter, sortBy]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (projectFilter !== defaultFilterState.project) chips.push({ key: 'project', label: `Project: ${projectFilter}`, clear: () => setProjectFilter(defaultFilterState.project) });
    if (assigneeFilter !== defaultFilterState.assignee) chips.push({ key: 'assignee', label: `Assignee: ${assigneeFilter}`, clear: () => setAssigneeFilter(defaultFilterState.assignee) });
    if (!personalMode && store.taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${store.taskOwnerFilter}`, clear: () => store.setTaskOwnerFilter('All') });
    if (store.taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${store.taskStatusFilter}`, clear: () => store.setTaskStatusFilter('All') });
    if (linkedFilter !== defaultFilterState.linked) chips.push({ key: 'linked', label: linkedFilter === 'linked' ? 'Linked only' : 'Unlinked only', clear: () => setLinkedFilter(defaultFilterState.linked) });
    return chips;
  }, [projectFilter, assigneeFilter, personalMode, store, linkedFilter]);

  const sortSummary = sortBy === 'due' ? '' : sortBy === 'priority' ? 'Sorted by priority' : 'Sorted by recently updated';

  // Fix 5: Compute tasks completed today for the "Done today" footer in the Today view.
  const completedToday = useMemo(() => {
    if (view !== 'today') return [];
    const todayStartTs = new Date().setHours(0, 0, 0, 0);
    return store.tasks.filter(
      (task) => task.status === 'Done' && task.completedAt && new Date(task.completedAt).getTime() >= todayStartTs,
    );
  }, [store.tasks, view]);

  const resetPanelFilters = () => {
    store.setTaskOwnerFilter('All');
    store.setTaskStatusFilter('All');
    setProjectFilter(defaultFilterState.project);
    setAssigneeFilter(defaultFilterState.assignee);
    setLinkedFilter(defaultFilterState.linked);
    setSortBy(defaultFilterState.sortBy);
  };

  const getTaskSignal = (task: TaskItem) => {
    const dueTimestamp = task.dueDate ? new Date(task.dueDate).getTime() : null;
    const now = Date.now();
    const isOverdue = Boolean(dueTimestamp && dueTimestamp < now && task.status !== 'Done');
    const dueSoon = Boolean(dueTimestamp && dueTimestamp > now && dueTimestamp <= now + (3 * 86400000) && task.status !== 'Done');

    const whyNow = task.status === 'Blocked'
      ? (task.blockReason ? `Blocked: ${task.blockReason}` : 'Blocked: capture unblock reason')
      : isOverdue
        ? `Overdue since ${formatDate(task.dueDate)}`
        : dueSoon
          ? `Due soon: ${formatDate(task.dueDate)}`
          : task.dueDate
            ? `Due ${formatDate(task.dueDate)}`
            : (isTaskDeferred(task) ? `Deferred until ${formatDate(task.deferredUntil)}` : 'No due date set');

    const nextMove = task.status === 'Done'
      ? 'Completed'
      : (task.nextStep || task.recommendedAction || 'Define next step');

    return { whyNow, nextMove, isOverdue, dueSoon };
  };

  const hasLinkedFollowUp = (linkedFollowUpId?: string | null) => Boolean(linkedFollowUpId && followUpById.get(linkedFollowUpId));

  return {
    ...store,
    tasks: store.tasks,
    items: store.items,
    projects: store.projects,
    selectedTask: selectedTask,
    filteredTasks,
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
    resetPanelFilters,
    sortSummary,
    getTaskSignal,
    hasLinkedFollowUp,
    completedToday,
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
