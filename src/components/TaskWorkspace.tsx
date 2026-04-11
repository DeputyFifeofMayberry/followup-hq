import { useCallback, useEffect, useState } from 'react';
import { addDaysIso, fromDateInputValue, todayIso } from '../lib/utils';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, ExecutionLaneQueueCard, WorkspaceContentFrame, WorkspacePage, WorkspacePrimaryLayout } from './ui/AppPrimitives';
import { getTaskFlowDefaults, useTasksViewModel } from '../domains/tasks';
import type { AppMode, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useViewportBand } from '../hooks/useViewport';
import { TaskToolbar } from './tasks/TaskToolbar';
import { TaskList } from './tasks/TaskList';
import { TaskInspectorModal } from './tasks/TaskInspectorModal';
import { TaskActionFlow } from './tasks/TaskActionFlow';
import { getExecutionLaneNextSelection } from '../domains/shared/executionLane/helpers';

const taskViewOptions = [
  { value: 'today' as const, label: 'Now' },
  { value: 'overdue' as const, label: 'Overdue' },
  { value: 'upcoming' as const, label: 'Upcoming' },
  { value: 'blocked' as const, label: 'Blocked' },
  { value: 'review' as const, label: 'Review needed' },
  { value: 'deferred' as const, label: 'Deferred' },
  { value: 'unlinked' as const, label: 'Unlinked' },
  { value: 'recent' as const, label: 'Done today' },
  { value: 'all' as const, label: 'All open' },
];

const queueIntentByView: Record<(typeof taskViewOptions)[number]['value'], string> = {
  today: 'Immediate execution queue: due work plus ready unscheduled tasks that can move now.',
  overdue: 'Pressure-removal queue: late commitments that need a recovery move and clear owner.',
  upcoming: 'Look-ahead queue: near-term tasks due this week to keep delivery smooth.',
  blocked: 'Unblock queue: work that cannot progress until constraints are removed.',
  review: 'Trust cleanup queue: task integrity needs repair before confident execution.',
  deferred: 'Re-entry queue: snoozed work that should be intentionally reactivated.',
  unlinked: 'Coverage queue: tasks missing a parent follow-up linkage and context.',
  recent: 'Momentum queue: tasks completed today to confirm execution progress.',
  all: 'Full open workload queue across all active execution states.',
};

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean; appMode?: AppMode }) {
  const vm = useTasksViewModel({ personalMode });
  const { isMobileLike } = useViewportBand();
    const openRecordDrawer = useAppStore((s) => s.openRecordDrawer);
  const openRecordEditor = useAppStore((s) => s.openRecordEditor);

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
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    if (vm.executionIntent?.target !== 'tasks') return;
    if (vm.executionIntent.recordType === 'task' && vm.executionIntent.recordId) {
      vm.openTaskInWorkspace(vm.executionIntent.recordId, { project: vm.executionIntent.project });
      setTaskDetailOpen(true);
    }
    vm.clearExecutionIntent();
  }, [vm.executionIntent, vm.clearExecutionIntent, vm.openTaskInWorkspace]);

  useEffect(() => {
    if (!taskDetailOpen) return;
    if (!vm.selectedTaskId || !vm.selectedTask) {
      setTaskDetailOpen(false);
    }
  }, [taskDetailOpen, vm.selectedTaskId, vm.selectedTask]);

  const openTaskFlow = useCallback((task: TaskItem, kind: 'done' | 'block' | 'unblock' | 'defer') => {
    setFlowState({ kind, taskId: task.id });
    const defaults = getTaskFlowDefaults(task);
    setCompletionNoteDraft(defaults.completionNoteDraft);
    setBlockReasonDraft(defaults.blockReasonDraft);
    setDeferDateDraft(defaults.deferDateDraft);
    setNextReviewDraft(defaults.nextReviewDraft);
    setFlowWarnings([]);
    setFlowBlockers([]);
    setFlowResult(null);
  }, []);

  const closeTaskFlow = useCallback(() => setFlowState(null), []);

  const runTaskFlow = useCallback(() => {
    if (!flowState) return;
    const task = vm.tasks.find((entry) => entry.id === flowState.taskId);
    if (!task) return;

    const now = todayIso();
    const result = flowState.kind === 'done'
      ? vm.attemptTaskTransition(task.id, 'Done', { completionNote: completionNoteDraft.trim() || undefined, completedAt: now })
      : flowState.kind === 'block'
        ? vm.attemptTaskTransition(task.id, 'Blocked', {
          blockReason: blockReasonDraft.trim() || undefined,
          nextReviewAt: nextReviewDraft ? new Date(`${nextReviewDraft}T00:00:00`).toISOString() : (task.nextReviewAt || addDaysIso(now, 1)),
        })
        : flowState.kind === 'unblock'
          ? vm.attemptTaskTransition(task.id, 'In progress', { startedAt: task.startedAt || now })
          : vm.attemptTaskTransition(task.id, task.status === 'Done' ? 'To do' : task.status, {
            status: task.status === 'Done' ? 'To do' : task.status,
            deferredUntil: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined,
            nextReviewAt: deferDateDraft ? new Date(`${deferDateDraft}T00:00:00`).toISOString() : undefined,
          });

    setFlowWarnings(result.validation.warnings);
    setFlowBlockers(result.validation.blockers);
    if (!result.applied) {
      setFlowResult({ tone: 'danger', message: 'Transition not applied. Resolve blockers, then retry.' });
      return;
    }

    setFlowState(null);
    setLaneFeedback({
      tone: result.validation.warnings.length ? 'warn' : 'success',
      message: flowState.kind === 'done'
        ? `Marked "${task.title}" done.`
        : flowState.kind === 'block'
          ? `Blocked "${task.title}" and scheduled review.`
          : flowState.kind === 'unblock'
            ? `Unblocked "${task.title}".`
            : `Deferred "${task.title}" until ${deferDateDraft}.`,
    });
  }, [flowState, vm.tasks, vm.attemptTaskTransition, completionNoteDraft, blockReasonDraft, nextReviewDraft, deferDateDraft]);

  const runRecommendedTaskAction = useCallback(() => {
    if (!vm.selectedTask || !vm.recommendedAction) return;
    if (vm.recommendedAction.id === 'complete') return openTaskFlow(vm.selectedTask, 'done');
    if (vm.recommendedAction.id === 'defer') return openTaskFlow(vm.selectedTask, 'defer');
    if (vm.recommendedAction.id === 'block') return openTaskFlow(vm.selectedTask, 'block');
    if (vm.recommendedAction.id === 'unblock') return openTaskFlow(vm.selectedTask, 'unblock');
  }, [vm.selectedTask, vm.recommendedAction, openTaskFlow]);

  const handleSelectTask = useCallback((taskId: string) => {
    vm.setSelectedTaskId(taskId);
    setTaskDetailOpen(true);
  }, [vm.setSelectedTaskId]);

  const handleDoneTask = useCallback((task: TaskItem) => openTaskFlow(task, 'done'), [openTaskFlow]);

  const requestDeleteTask = useCallback((task: TaskItem) => {
    setPendingDeleteTask(task);
  }, []);

  const confirmDeleteTask = useCallback(() => {
    if (!pendingDeleteTask) return;
    const queueTaskIds = vm.filteredTasks.map((task) => task.id).filter((id) => id !== pendingDeleteTask.id);
    const progression = getExecutionLaneNextSelection(queueTaskIds, vm.selectedTaskId, [pendingDeleteTask.id]);
    vm.deleteTask(pendingDeleteTask.id);
    vm.setSelectedTaskId(progression.nextSelectedId);
    setPendingDeleteTask(null);
    setTaskDetailOpen(Boolean(progression.nextSelectedId));
    setLaneFeedback({ tone: 'success', message: `Deleted "${pendingDeleteTask.title}".` });
  }, [pendingDeleteTask, vm]);

  const setDueToday = useCallback((task: TaskItem) => {
    vm.updateTask(task.id, { dueDate: fromDateInputValue(todayIso()) });
    setLaneFeedback({ tone: 'success', message: `Set "${task.title}" due today.` });
  }, [vm]);

  const setDueTomorrow = useCallback((task: TaskItem) => {
    vm.updateTask(task.id, { dueDate: fromDateInputValue(addDaysIso(todayIso(), 1)) });
    setLaneFeedback({ tone: 'success', message: `Set "${task.title}" due tomorrow.` });
  }, [vm]);

  const activeQueueLabel = taskViewOptions.find((option) => option.value === vm.view)?.label ?? 'Queue';
  const queueIntent = queueIntentByView[vm.view];
  const queueStats = [
    { label: 'Open', value: vm.taskSummary.open, tone: 'default' },
    { label: 'Overdue', value: vm.taskSummary.overdue, tone: vm.taskSummary.overdue > 0 ? 'danger' : 'default' },
    { label: 'Blocked', value: vm.taskSummary.blocked, tone: vm.taskSummary.blocked > 0 ? 'warn' : 'default' },
    { label: 'Review needed', value: vm.taskSummary.reviewRequired, tone: vm.taskSummary.reviewRequired > 0 ? 'warn' : 'default' },
  ];

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        <WorkspacePrimaryLayout
          className="task-workspace-layout workspace-primary-layout-collapsed"
        >
          <ExecutionLaneQueueCard className="task-workspace-main-card">
            <section className={`task-queue-summary-strip ${isMobileLike ? 'task-queue-summary-strip-mobile' : ''}`.trim()} aria-label="Task queue summary">
              <div className="task-queue-summary-head">
                <div className="task-queue-summary-kicker">{activeQueueLabel}</div>
                <p className="task-queue-summary-text">{isMobileLike ? vm.queueSummary : queueIntent}</p>
                {!isMobileLike ? <p className="task-queue-summary-subtext">{vm.queueSummary}</p> : null}
              </div>
              <div className="task-queue-summary-stats">
                {queueStats.map((stat) => (
                  <div key={stat.label} className={`task-queue-summary-chip ${stat.tone !== 'default' ? `task-queue-summary-chip-${stat.tone}` : ''}`.trim()}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
                <div className="task-queue-summary-chip task-queue-summary-chip-muted">
                  <span>Done today</span>
                  <strong>{vm.completedToday.length}</strong>
                </div>
              </div>
            </section>

            <TaskToolbar
            isMobileLike={isMobileLike}
            searchQuery={vm.searchQuery}
            onSearchQueryChange={vm.setSearchQuery}
            onClearSearch={vm.clearSearchQuery}
            view={vm.view}
            onViewChange={vm.setView}
            taskViewOptions={taskViewOptions}
            viewOptionsOpen={viewOptionsOpen}
            onToggleViewOptions={() => setViewOptionsOpen((prev) => !prev)}
            activeFilterCount={vm.activeFilterCount}
            personalMode={personalMode}
            projectFilter={vm.projectFilter}
            projectOptions={vm.projectOptions}
            onProjectFilterChange={vm.setProjectFilter}
            assigneeFilter={vm.assigneeFilter}
            assignees={vm.assigneeOptions}
            onAssigneeFilterChange={vm.setAssigneeFilter}
            taskOwnerFilter={vm.taskOwnerFilter}
            owners={vm.ownerOptions}
            onTaskOwnerFilterChange={vm.setTaskOwnerFilter}
            taskStatusFilter={vm.taskStatusFilter}
            onTaskStatusFilterChange={vm.setTaskStatusFilter}
            linkedFilter={vm.linkedFilter}
            onLinkedFilterChange={vm.setLinkedFilter}
            timingFilter={vm.timingFilter}
            onTimingFilterChange={vm.setTimingFilter}
            stateFilter={vm.stateFilter}
            onStateFilterChange={vm.setStateFilter}
            priorityFilter={vm.priorityFilter}
            onPriorityFilterChange={vm.setPriorityFilter}
            sortBy={vm.sortBy}
            onSortByChange={vm.setSortBy}
            onResetFilters={vm.resetPanelFilters}
          />

            <div className={`task-filter-chip-row ${vm.activeFilterChips.length > 0 ? '' : 'task-filter-chip-row-muted'} ${isMobileLike ? 'task-filter-chip-row-mobile' : ''}`.trim()}>
              {vm.activeFilterChips.length > 0 ? (
                <>
                  {(isMobileLike ? vm.activeFilterChips.slice(0, 2) : vm.activeFilterChips).map((chip) => (
                    <button key={chip.key} type="button" className="task-filter-chip" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                      {chip.label}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                  {isMobileLike && vm.activeFilterChips.length > 2 ? <span className="task-sort-summary">+{vm.activeFilterChips.length - 2} more</span> : null}
                  <button type="button" className="task-filter-chip task-filter-chip-quiet" onClick={vm.resetPanelFilters}>Clear all filters</button>
                </>
              ) : (
                <span className="task-sort-summary">No active filters. {vm.sortSummary || 'Sorted by due date.'}</span>
              )}
            </div>

            <TaskList
            isMobileLike={isMobileLike}
            filteredTasks={vm.filteredTasks}
            selectedTaskId={vm.selectedTask?.id ?? null}
            laneFeedback={laneFeedback}
            onSelectTask={handleSelectTask}
            onDoneTask={handleDoneTask}
            onSetDueToday={setDueToday}
            onSetDueTomorrow={setDueTomorrow}
            onOpenLinkedFollowUp={(task) => task.linkedFollowUpId ? onOpenLinkedFollowUp(task.linkedFollowUpId) : undefined}
            onRequestDeleteTask={requestDeleteTask}
            getParentLinkedFollowUpId={vm.hasLinkedFollowUp}
            renderNowSignal={vm.getTaskSignal}
            completedToday={vm.completedToday}
            view={vm.view}
            hasActiveNarrowing={vm.activeFilterCount > 0 || vm.view !== 'all'}
            activeFilterLabels={[
              ...(vm.view !== 'all' ? [`Queue: ${taskViewOptions.find((option) => option.value === vm.view)?.label ?? vm.view}`] : []),
              ...vm.activeFilterChips.map((chip) => chip.label),
            ]}
            onResetFilters={() => {
              vm.setView('all');
              vm.clearSearchQuery();
              vm.resetPanelFilters();
            }}
          />

          </ExecutionLaneQueueCard>
        </WorkspacePrimaryLayout>
      </WorkspaceContentFrame>

      <TaskInspectorModal
        open={taskDetailOpen}
        selectedTask={vm.selectedTask}
        linkedFollowUp={vm.linkedFollowUpForSelected}
        linkedTaskOpenCount={vm.linkedTasksForSelectedParent.filter((task) => task.status !== 'Done').length}
        linkedParentRollup={vm.linkedParentRollup}
        linkedParentCloseout={vm.linkedParentCloseout}
        recommendedAction={vm.recommendedAction}
        ownerOptions={vm.ownerOptions}
        assigneeOptions={vm.assigneeOptions}
        renderNowSignal={vm.getTaskSignal}
        onClose={() => setTaskDetailOpen(false)}
        onRunRecommendedTaskAction={runRecommendedTaskAction}
        onOpenTaskFlow={openTaskFlow}
        onUpdateTask={vm.updateTask}
        onRequestDeleteTask={requestDeleteTask}
        onOpenLinkedFollowUp={onOpenLinkedFollowUp}
        onOpenRecordDrawer={openRecordDrawer}
        onOpenRecordEditor={openRecordEditor}
        isMobileLike={isMobileLike}
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
      {pendingDeleteTask ? (
        <AppModal onClose={() => setPendingDeleteTask(null)} onBackdropClick={() => setPendingDeleteTask(null)}>
          <AppModalHeader
            title="Delete task"
            subtitle={`Permanently remove “${pendingDeleteTask.title}”.`}
            onClose={() => setPendingDeleteTask(null)}
          />
          <AppModalBody>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <div className="font-semibold">Delete this task?</div>
              <p className="mt-1 text-xs">
                This removes <strong>{pendingDeleteTask.title}</strong> from all task queues and dashboard counts.
              </p>
            </div>
          </AppModalBody>
          <AppModalFooter>
            <button type="button" className="action-btn" onClick={() => setPendingDeleteTask(null)}>Cancel</button>
            <button type="button" className="action-btn action-btn-danger" onClick={confirmDeleteTask}>Delete task</button>
          </AppModalFooter>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
