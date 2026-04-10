import { useCallback, useEffect, useState } from 'react';
import { addDaysIso, createId, fromDateInputValue, todayIso } from '../lib/utils';
import { ExecutionLaneInspectorCard, ExecutionLaneQueueCard, WorkspaceContentFrame, WorkspacePage, WorkspacePrimaryLayout } from './ui/AppPrimitives';
import { getTaskFlowDefaults, useTasksViewModel } from '../domains/tasks';
import type { AppMode, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useViewportBand } from '../hooks/useViewport';
import { TaskToolbar } from './tasks/TaskToolbar';
import { TaskList } from './tasks/TaskList';
import { TaskInspectorModal } from './tasks/TaskInspectorModal';
import { TaskActionFlow } from './tasks/TaskActionFlow';

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

export function TaskWorkspace({ onOpenLinkedFollowUp, personalMode = false }: { onOpenLinkedFollowUp: (followUpId: string) => void; personalMode?: boolean; appMode?: AppMode }) {
  const vm = useTasksViewModel({ personalMode });
  const { isMobileLike } = useViewportBand();
    const openRecordDrawer = useAppStore((s) => s.openRecordDrawer);
  const openRecordEditor = useAppStore((s) => s.openRecordEditor);
  const addTask = useAppStore((s) => s.addTask);

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
    if (vm.executionIntent?.target !== 'tasks') return;
    if (vm.executionIntent.recordType === 'task' && vm.executionIntent.recordId) {
      vm.setSelectedTaskId(vm.executionIntent.recordId);
      setTaskDetailOpen(true);
    }
    vm.clearExecutionIntent();
  }, [vm.executionIntent, vm.clearExecutionIntent, vm.setSelectedTaskId]);

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

  const handleQuickAdd = useCallback((payload: { title: string; project: string; owner: string; assignee?: string; nextStep: string }) => {
    if (!payload.title || !payload.project || !payload.owner || !payload.nextStep) {
      return { ok: false, message: 'Title, project, owner, and next step are required.' };
    }
    const now = todayIso();
    const newTaskId = createId('TSK');
    addTask({
      id: newTaskId,
      title: payload.title,
      summary: payload.title,
      project: payload.project,
      owner: payload.owner,
      assigneeDisplayName: payload.assignee,
      status: 'To do',
      priority: 'Medium',
      nextStep: payload.nextStep,
      notes: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
      lifecycleState: 'ready',
      dataQuality: 'valid_live',
      reviewReasons: [],
      cleanupReasons: [],
      provenance: { sourceType: 'quick_capture', sourceRef: 'Tasks lane fast capture', capturedAt: now },
      auditHistory: [],
    });
    vm.setSelectedTaskId(newTaskId);
    setTaskDetailOpen(true);
    setLaneFeedback({ tone: 'success', message: `Created "${payload.title}" and queued it for execution.` });
    return { ok: true };
  }, [addTask, vm]);

  const setDueToday = useCallback((task: TaskItem) => {
    vm.updateTask(task.id, { dueDate: fromDateInputValue(todayIso()) });
    setLaneFeedback({ tone: 'success', message: `Set "${task.title}" due today.` });
  }, [vm]);

  const setDueTomorrow = useCallback((task: TaskItem) => {
    vm.updateTask(task.id, { dueDate: fromDateInputValue(addDaysIso(todayIso(), 1)) });
    setLaneFeedback({ tone: 'success', message: `Set "${task.title}" due tomorrow.` });
  }, [vm]);

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        <WorkspacePrimaryLayout
          inspectorWidth="330px"
          className={`task-workspace-layout ${!isMobileLike && taskDetailOpen && vm.selectedTask ? '' : 'workspace-primary-layout-collapsed'}`.trim()}
        >
          <ExecutionLaneQueueCard className="task-workspace-main-card">
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
            onOpenCreateTaskModal={vm.openCreateTaskModal}
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

            <TaskList
            filteredTasks={vm.filteredTasks}
            selectedTaskId={vm.selectedTask?.id ?? null}
            laneFeedback={laneFeedback}
            projectOptions={vm.projectOptions}
            ownerOptions={vm.ownerOptions}
            assigneeOptions={vm.assigneeOptions}
            quickCaptureDefaults={vm.quickCaptureDefaults}
            onSelectTask={handleSelectTask}
            onDoneTask={handleDoneTask}
            onSetDueToday={setDueToday}
            onSetDueTomorrow={setDueTomorrow}
            onOpenLinkedFollowUp={(task) => task.linkedFollowUpId ? onOpenLinkedFollowUp(task.linkedFollowUpId) : undefined}
            onQuickAdd={handleQuickAdd}
            getParentLinkedFollowUpId={vm.hasLinkedFollowUp}
            renderNowSignal={vm.getTaskSignal}
          />

          </ExecutionLaneQueueCard>

          {!isMobileLike && taskDetailOpen && vm.selectedTask ? (
            <ExecutionLaneInspectorCard>
              <TaskInspectorModal
                open={taskDetailOpen}
                presentation="panel"
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
                onOpenLinkedFollowUp={onOpenLinkedFollowUp}
                onOpenRecordDrawer={openRecordDrawer}
                onOpenRecordEditor={openRecordEditor}
              />
            </ExecutionLaneInspectorCard>
          ) : null}
        </WorkspacePrimaryLayout>
      </WorkspaceContentFrame>

      {isMobileLike ? (
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
          onOpenLinkedFollowUp={onOpenLinkedFollowUp}
          onOpenRecordDrawer={openRecordDrawer}
          onOpenRecordEditor={openRecordEditor}
        />
      ) : null}

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
