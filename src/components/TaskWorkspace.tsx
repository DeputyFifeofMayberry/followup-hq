import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDaysIso, todayIso } from '../lib/utils';
import {
  AppModal,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
  ExecutionFilterChip,
  ExecutionFilterChipRow,
  ExecutionLaneQueueCard,
  ExecutionSummaryBand,
  ExecutionSummaryStatChip,
  WorkspaceContentFrame,
  WorkspacePage,
  WorkspacePrimaryLayout,
} from './ui/AppPrimitives';
import { getTaskFlowDefaults, TASK_LANE_DEFINITIONS, TASK_QUEUE_VIEWS, type TaskQueueView, useTasksViewModel } from '../domains/tasks';
import type { TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useViewportBand } from '../hooks/useViewport';
import { TaskToolbar } from './tasks/TaskToolbar';
import { TaskList } from './tasks/TaskList';
import { TaskInspectorModal } from './tasks/TaskInspectorModal';
import { TaskActionFlow } from './tasks/TaskActionFlow';
import { getExecutionLaneNextSelection } from '../domains/shared/executionLane/helpers';

const taskViewOptions: Array<{ value: TaskQueueView; label: string }> = TASK_QUEUE_VIEWS.map((view) => ({ value: view, label: TASK_LANE_DEFINITIONS[view].label }));

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean }) {
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
    if (isMobileLike) setTaskDetailOpen(false);
    setFlowState({ kind, taskId: task.id });
    const defaults = getTaskFlowDefaults(task);
    setCompletionNoteDraft(defaults.completionNoteDraft);
    setBlockReasonDraft(defaults.blockReasonDraft);
    setDeferDateDraft(defaults.deferDateDraft);
    setNextReviewDraft(defaults.nextReviewDraft);
    setFlowWarnings([]);
    setFlowBlockers([]);
    setFlowResult(null);
  }, [isMobileLike]);

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
    if (isMobileLike) setTaskDetailOpen(false);
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
  }, [flowState, vm.tasks, vm.attemptTaskTransition, completionNoteDraft, blockReasonDraft, nextReviewDraft, deferDateDraft, isMobileLike]);

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

  const handleCloseTaskDetail = useCallback(() => {
    setTaskDetailOpen(false);
    if (isMobileLike) vm.setSelectedTaskId(null);
  }, [isMobileLike, vm]);

  const filteredTaskIds = useMemo(() => vm.filteredTasks.map((task) => task.id), [vm.filteredTasks]);

  useEffect(() => {
    if (!vm.selectedTaskId || flowState) return;
    if (filteredTaskIds.includes(vm.selectedTaskId)) return;
    const progression = getExecutionLaneNextSelection(filteredTaskIds, vm.selectedTaskId, [vm.selectedTaskId]);
    vm.setSelectedTaskId(progression.nextSelectedId);
    setTaskDetailOpen(Boolean(progression.nextSelectedId));
  }, [vm.selectedTaskId, vm.setSelectedTaskId, filteredTaskIds, flowState]);

  useEffect(() => {
    setLaneFeedback(null);
  }, [vm.view, vm.searchQuery, vm.projectFilter, vm.assigneeFilter, vm.taskOwnerFilter, vm.taskStatusFilter, vm.linkedFilter, vm.timingFilter, vm.stateFilter, vm.priorityFilter, vm.sortBy]);

  const activeQueueLabel = taskViewOptions.find((option) => option.value === vm.view)?.label ?? 'Queue';
  const queueIntent = TASK_LANE_DEFINITIONS[vm.view].intent;
  const queueActionLine = vm.activeFilterCount > 0
    ? `${vm.filteredTasks.length} tasks in focus after ${vm.activeFilterCount} active filter${vm.activeFilterCount === 1 ? '' : 's'}.`
    : `${vm.filteredTasks.length} tasks in this queue. ${vm.sortSummary || 'Sorted by due date.'}`;
  const queueStats: Array<{ label: string; value: number; tone: 'default' | 'warn' | 'danger' }> = [
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
          <ExecutionLaneQueueCard className="task-workspace-main-card execution-lane-queue-surface">
            <ExecutionSummaryBand
              className={`execution-summary-strip-unified task-queue-summary-strip ${isMobileLike ? 'task-queue-summary-strip-mobile' : ''}`.trim()}
              kicker={activeQueueLabel}
              title={isMobileLike ? vm.queueSummary : queueIntent}
              supporting={!isMobileLike ? vm.queueSummary : undefined}
              actions={
                <div className="task-queue-summary-actions" aria-live="polite">
                  <span className="task-queue-summary-action-line">{queueActionLine}</span>
                  {vm.activeFilterCount > 0 ? <span className="task-queue-summary-action-chip">Filters active</span> : null}
                </div>
              }
              stats={(
                <>
                  {queueStats.map((stat) => (
                    <ExecutionSummaryStatChip key={stat.label} label={stat.label} value={stat.value} tone={stat.tone === 'default' ? 'default' : stat.tone} />
                  ))}
                  <ExecutionSummaryStatChip label="Done today" value={vm.completedToday.length} tone="muted" />
                </>
              )}
            />

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
            activeFilterChips={vm.activeFilterChips}
            sortSummary={vm.sortSummary || 'Sorted by due date.'}
            onResetFilters={vm.resetPanelFilters}
          />

            {!isMobileLike ? <ExecutionFilterChipRow muted={vm.activeFilterChips.length === 0} className="execution-family-filter-chip-row">
              {vm.activeFilterChips.length > 0 ? (
                <>
                  {vm.activeFilterChips.map((chip) => (
                    <ExecutionFilterChip key={chip.key} label={chip.label} onClear={chip.clear} />
                  ))}
                  <button type="button" className="execution-filter-chip execution-filter-chip-quiet" onClick={vm.resetPanelFilters}>Clear all filters</button>
                </>
              ) : (
                <span className="task-sort-summary">No active filters. {vm.sortSummary || 'Sorted by due date.'}</span>
              )}
            </ExecutionFilterChipRow> : null}

            <TaskList
            isMobileLike={isMobileLike}
            filteredTasks={vm.filteredTasks}
            selectedTaskId={vm.selectedTask?.id ?? null}
            laneFeedback={laneFeedback}
            onSelectTask={handleSelectTask}
            onDoneTask={handleDoneTask}
            getParentLinkedFollowUpId={vm.hasLinkedFollowUp}
            renderNowSignal={vm.getTaskSignal}
            completedToday={vm.completedToday}
            view={vm.view}
            hasActiveNarrowing={vm.activeFilterCount > 0}
            activeFilterLabels={[
              ...(vm.view !== 'all' ? [`Queue: ${taskViewOptions.find((option) => option.value === vm.view)?.label ?? vm.view}`] : []),
              ...vm.activeFilterChips.map((chip) => chip.label),
            ]}
            onResetFilters={vm.resetPanelFilters}
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
        renderNowSignal={vm.getTaskSignal}
        onClose={handleCloseTaskDetail}
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
        isMobileLike={isMobileLike}
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
