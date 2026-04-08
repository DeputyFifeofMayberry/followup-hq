import { ChevronDown, Link2, Pencil, Plus, Search, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { addDaysIso, formatDate, fromDateInputValue, isTaskDeferred, priorityTone, toDateInputValue, todayIso } from '../lib/utils';
import {
  AppBadge,
  AppModal,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
  EmptyState,
  ExecutionLaneFooterMeta,
  SectionHeader,
  WorkspacePage,
} from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import { useTasksViewModel } from '../domains/tasks';
import type { AppMode, TaskItem } from '../types';
import { useAppStore } from '../store/useAppStore';
import { BlockReasonSection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';
import { buildFollowUpChildRollup } from '../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../lib/closeoutReadiness';
import { CloseoutReadinessCard } from './CloseoutReadinessCard';
import { deriveTaskRecommendedAction } from '../domains/shared';
import { editSurfaceCtas, editSurfacePolicy } from '../lib/editSurfacePolicy';
import { isExecutionReady } from '../domains/records/integrity';
import { useViewportBand } from '../hooks/useViewport';

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
    const searchQueryLower = searchQuery.toLowerCase();

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
  }, [taskDerived, view, taskOwnerFilter, taskStatusFilter, projectFilter, assigneeFilter, linkedFilter, searchQuery, sortBy]);

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

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (projectFilter !== defaultFilterState.project) chips.push({ key: 'project', label: projectFilter, clear: () => setProjectFilter(defaultFilterState.project) });
    if (assigneeFilter !== defaultFilterState.assignee) chips.push({ key: 'assignee', label: assigneeFilter, clear: () => setAssigneeFilter(defaultFilterState.assignee) });
    if (!personalMode && taskOwnerFilter !== 'All') chips.push({ key: 'owner', label: `Owner: ${taskOwnerFilter}`, clear: () => setTaskOwnerFilter('All') });
    if (taskStatusFilter !== 'All') chips.push({ key: 'status', label: `Status: ${taskStatusFilter}`, clear: () => setTaskStatusFilter('All') });
    if (linkedFilter !== defaultFilterState.linked) chips.push({ key: 'linked', label: linkedFilter === 'linked' ? 'Linked only' : 'Unlinked only', clear: () => setLinkedFilter(defaultFilterState.linked) });
    return chips;
  }, [projectFilter, assigneeFilter, personalMode, taskOwnerFilter, taskStatusFilter, linkedFilter, setTaskOwnerFilter, setTaskStatusFilter]);

  const resetFilters = () => {
    setTaskOwnerFilter('All');
    setTaskStatusFilter('All');
    setProjectFilter(defaultFilterState.project);
    setAssigneeFilter(defaultFilterState.assignee);
    setLinkedFilter(defaultFilterState.linked);
    setSortBy('due');
    setSearchQuery('');
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
  };

  const runRecommendedTaskAction = () => {
    if (!selectedTask || !recommendedAction) return;
    if (recommendedAction.id === 'complete') return openTaskFlow(selectedTask, 'done');
    if (recommendedAction.id === 'defer') return openTaskFlow(selectedTask, 'defer');
    if (recommendedAction.id === 'block') return openTaskFlow(selectedTask, 'block');
    if (recommendedAction.id === 'unblock') return openTaskFlow(selectedTask, 'unblock');
  };

  const renderNowSignal = (task: TaskItem) => {
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
  };

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
        <div className="workspace-control-stack task-control-stack-calm">
          <div className={`task-primary-toolbar-slim ${isMobileLike ? 'task-primary-toolbar-slim-mobile' : ''}`}>
            <label className="field-block task-search-block">
              <span className="field-label">Search</span>
              <div className="search-field-wrap">
                <Search className="search-field-icon h-4 w-4" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Title, next step, notes" className="field-input search-field-input" />
                {searchQuery ? <button type="button" onClick={() => setSearchQuery('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
              </div>
            </label>

            <label className="field-block task-view-picker">
              <span className="field-label">View</span>
              <select value={view} onChange={(event) => setView(event.target.value as TaskView)} className="field-input">
                {taskViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <div className="task-toolbar-actions">
              <button onClick={() => setViewOptionsOpen((prev) => !prev)} className="action-btn">
                <SlidersHorizontal className="h-4 w-4" />
                Options
                {activeFilterCount > 0 ? <AppBadge tone="info">{activeFilterCount}</AppBadge> : null}
                <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={openCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
            </div>
          </div>

          {viewOptionsOpen ? (
            <div className="task-filters-panel-slim">
              <div className={`task-view-options-grid ${personalMode ? 'task-view-options-grid-personal' : ''}`}>
                <label className="field-block"><span className="field-label">Project</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select></label>
                <label className="field-block"><span className="field-label">Assignee</span><select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select></label>
                {!personalMode ? <label className="field-block"><span className="field-label">Owner</span><select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select></label> : null}
                <label className="field-block"><span className="field-label">Status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
                <label className="field-block"><span className="field-label">Linked</span><select value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value as typeof linkedFilter)} className="field-input"><option value="all">All</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select></label>
                <label className="field-block"><span className="field-label">Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as TaskSort)} className="field-input"><option value="due">Due date</option><option value="priority">Priority</option><option value="updated">Recently updated</option></select></label>
              </div>
              <div className="task-view-options-reset-row">
                <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset</button>
              </div>
            </div>
          ) : null}

          {activeFilterChips.length > 1 ? (
            <div className="task-filter-chip-row task-filter-chip-row-muted">
              {activeFilterChips.map((chip) => <button key={chip.key} onClick={chip.clear} className="task-filter-chip task-filter-chip-quiet">{chip.label} <span aria-hidden="true">×</span></button>)}
            </div>
          ) : null}
        </div>

        <div className="workspace-list-content task-list-content">
          {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}
          {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try another view or open Options to adjust filters." /> : filteredTasks.map((task) => {
            const parent = followUpById.get(task.linkedFollowUpId ?? '') ?? undefined;
            const signal = renderNowSignal(task);
            return (
              <button
                key={task.id}
                onClick={() => { setSelectedTaskId(task.id); setTaskDetailOpen(true); }}
                className={`workspace-data-row task-work-row ${selectedTask?.id === task.id ? 'workspace-data-row-active list-row-family-active' : ''}`}
                aria-current={selectedTask?.id === task.id ? 'true' : undefined}
              >
                <div className="scan-row-layout scan-row-layout-quiet">
                  <div className="scan-row-content">
                    <div className="scan-row-primary">{task.title}</div>
                    <div className="scan-row-secondary">{signal.whyNow} • Next: {signal.nextMove}</div>
                    <div className="scan-row-meta">{(task.assigneeDisplayName || task.owner)} • {task.project}{task.summary ? ` • ${task.summary}` : ''}</div>
                  </div>
                  <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                    <div className="scan-row-badge-cluster">
                      {task.status === 'Blocked' ? <Badge variant="warn">Blocked</Badge> : null}
                      {signal.isOverdue ? <Badge variant="danger">Overdue</Badge> : signal.dueSoon ? <Badge variant="neutral">Due soon</Badge> : null}
                      <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                      {!parent ? <Badge variant="neutral">Unlinked</Badge> : null}
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

        <ExecutionLaneFooterMeta shownCount={filteredTasks.length} selectedCount={selectedTask ? 1 : 0} scopeSummary={`View: ${taskViewOptions.find((entry) => entry.value === view)?.label || view}`} hint="Open a task when you need more detail." />
      </section>

      {taskDetailOpen && selectedTask ? (
        <AppModal size="inspector" onBackdropClick={() => setTaskDetailOpen(false)} onClose={() => setTaskDetailOpen(false)}>
          <AppModalHeader
            title={selectedTask.title}
            subtitle={`${selectedTask.project} • ${selectedTask.assigneeDisplayName || selectedTask.owner}`}
            onClose={() => setTaskDetailOpen(false)}
            closeLabel="Close"
          />
          <AppModalBody>
            <div className="space-y-3">
              <section className="detail-card">
                <div className="task-inspector-status-strip">
                  <Badge variant={selectedTask.status === 'Blocked' ? 'warn' : selectedTask.status === 'Done' ? 'success' : 'neutral'}>{selectedTask.status}</Badge>
                  <Badge variant={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
                  {selectedTask.dueDate && new Date(selectedTask.dueDate).getTime() < Date.now() && selectedTask.status !== 'Done' ? <Badge variant="danger">Overdue</Badge> : null}
                </div>
                <div className="mt-3 task-execution-focus">
                  <div className="tonal-micro">Why now: <strong>{renderNowSignal(selectedTask).whyNow}</strong></div>
                  <div className="tonal-micro">Best next move: <strong>{renderNowSignal(selectedTask).nextMove}</strong></div>
                  <div className="mt-2"><AppBadge tone={recommendedAction?.tone === 'default' ? 'info' : (recommendedAction?.tone ?? 'info')}>Recommended: {recommendedAction?.label ?? 'Update next step'}</AppBadge></div>
                </div>
              </section>

              <section className="detail-card">
                <SectionHeader title="Actions" subtitle={recommendedAction?.reason ?? 'Focused execution actions first.'} compact />
                <div className="task-inspector-actions mt-2">
                  <button onClick={runRecommendedTaskAction} className="primary-btn">{recommendedAction?.label ?? 'Update next step'}</button>
                  <button onClick={() => openTaskFlow(selectedTask, 'done')} className="action-btn">Complete</button>
                  <button onClick={() => openTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                  <button onClick={() => openTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
                </div>
                <div className="task-quick-edit-grid mt-3">
                  <label className="field-block"><span className="field-label">Next step</span><input value={selectedTask.nextStep || ''} onChange={(event) => updateTask(selectedTask.id, { nextStep: event.target.value })} className="field-input" /></label>
                  <label className="field-block"><span className="field-label">Due date</span><input type="date" value={toDateInputValue(selectedTask.dueDate)} onChange={(event) => updateTask(selectedTask.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
                </div>
              </section>

              <section className="detail-card">
                <SectionHeader title="Linked context" subtitle="Related follow-up details when available." compact />
                <div className="mt-2 rounded-2xl tonal-panel task-link-context-panel">
                  <div className="tonal-micro"><strong>{linkedFollowUp ? linkedFollowUp.title : 'No linked follow-up'}</strong>{linkedFollowUp ? ` (${linkedFollowUp.status})` : ''}</div>
                  {linkedFollowUp ? <div className="tonal-micro mt-1">Open linked tasks: <strong>{linkedTaskOpenCount}</strong></div> : null}
                  {linkedFollowUp && linkedParentRollup?.explanations?.length ? <div className="mt-2 space-y-1 text-xs text-slate-600">{linkedParentRollup.explanations.slice(0, 2).map((reason) => <div key={reason}>• {reason}</div>)}</div> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {linkedFollowUp ? <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open linked follow-up</button> : null}
                    <button onClick={() => openRecordDrawer({ type: 'task', id: selectedTask.id })} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />{editSurfacePolicy.context.label}</button>
                  </div>
                </div>
              </section>

              <details className="detail-card inspector-block">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Maintenance & full edit</summary>
                <div className="rounded-2xl tonal-panel task-link-context-panel mt-2">
                  {linkedParentCloseout ? (
                    <CloseoutReadinessCard
                      evaluation={linkedParentCloseout}
                      onOpenTask={(taskId) => openRecordDrawer({ type: 'task', id: taskId })}
                      onReviewLinkedRecords={() => linkedFollowUp ? openRecordDrawer({ type: 'followup', id: linkedFollowUp.id }) : undefined}
                    />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openRecordEditor({ type: 'task', id: selectedTask.id }, 'edit', 'workspace')} className="action-btn !px-2.5 !py-1.5 text-xs"><Pencil className="h-4 w-4" />{editSurfaceCtas.fullEditTask}</button>
                  </div>
                </div>
              </details>
            </div>
          </AppModalBody>
          <AppModalFooter>
            <button onClick={() => setTaskDetailOpen(false)} className="action-btn">Close</button>
          </AppModalFooter>
        </AppModal>
      ) : null}

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
