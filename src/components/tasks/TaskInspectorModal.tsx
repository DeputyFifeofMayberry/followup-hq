import { Link2, Pencil, RotateCcw, Save } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { editSurfaceCtas, editSurfacePolicy } from '../../lib/editSurfacePolicy';
import { fromDateInputValue, priorityTone, toDateInputValue, todayIso, addDaysIso } from '../../lib/utils';
import { getTaskDueBucket } from '../../domains/tasks/timing';
import type { FollowUpItem, TaskItem } from '../../types';
import { Badge } from '../Badge';
import { CloseoutReadinessCard } from '../CloseoutReadinessCard';
import { AppBadge, AppModal, AppModalBody, AppModalFooter, AppModalHeader, SectionHeader } from '../ui/AppPrimitives';
import { RecordSaveStatus } from '../save/RecordSaveStatus';

type TaskInspectorModalProps = {
  open: boolean;
  selectedTask: TaskItem | null;
  linkedFollowUp: FollowUpItem | null;
  linkedTaskOpenCount: number;
  linkedParentRollup: { explanations?: string[] } | null;
  linkedParentCloseout: React.ComponentProps<typeof CloseoutReadinessCard>['evaluation'] | null;
  recommendedAction: { id: string; label: string; tone: 'default' | 'info' | 'warn' | 'success' | 'danger'; reason?: string } | null;
  renderNowSignal: (task: TaskItem) => { whyNow: string; nextMove: string };
  onClose: () => void;
  onRunRecommendedTaskAction: () => void;
  onOpenTaskFlow: (task: TaskItem, kind: 'done' | 'block' | 'unblock' | 'defer') => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onRequestDeleteTask: (task: TaskItem) => void;
  onOpenLinkedFollowUp: (followUpId: string) => void;
  onOpenRecordDrawer: (payload: { type: 'task' | 'followup'; id: string }) => void;
  onOpenRecordEditor: (payload: { type: 'task'; id: string }, mode: 'edit', source: 'workspace') => void;
  isMobileLike?: boolean;
};

type EditDraft = {
  nextStep: string;
  dueDate: string;
  priority: TaskItem['priority'];
};

function buildDraft(task: TaskItem): EditDraft {
  return {
    nextStep: task.nextStep || '',
    dueDate: toDateInputValue(task.dueDate),
    priority: task.priority,
  };
}

export const TASK_INSPECTOR_QUICK_EDIT_FIELDS = ['nextStep', 'dueDate', 'priority'] as const;

export const TaskInspectorModal = memo(function TaskInspectorModal({
  open,
  selectedTask,
  linkedFollowUp,
  linkedTaskOpenCount,
  linkedParentRollup,
  linkedParentCloseout,
  recommendedAction,
  renderNowSignal,
  onClose,
  onRunRecommendedTaskAction,
  onOpenTaskFlow,
  onUpdateTask,
  onRequestDeleteTask,
  onOpenLinkedFollowUp,
  onOpenRecordDrawer,
  onOpenRecordEditor,
  isMobileLike = false,
}: TaskInspectorModalProps) {
  const [draft, setDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    if (!open || !selectedTask) return;
    setDraft(buildDraft(selectedTask));
  }, [open, selectedTask?.id, selectedTask?.updatedAt]);

  const hasDraftChanges = useMemo(() => {
    if (!selectedTask || !draft) return false;
    const baseline = buildDraft(selectedTask);
    return JSON.stringify(baseline) !== JSON.stringify(draft);
  }, [selectedTask, draft]);

  const resetDraft = () => {
    if (!selectedTask) return;
    setDraft(buildDraft(selectedTask));
  };

  const saveQuickEdit = () => {
    if (!selectedTask || !hasDraftChanges || !draft) return;
    onUpdateTask(selectedTask.id, {
      nextStep: draft.nextStep.trim(),
      dueDate: draft.dueDate ? fromDateInputValue(draft.dueDate) : undefined,
      priority: draft.priority,
    });
  };

  if (!open || !selectedTask || !draft) return null;

  const nowSignal = renderNowSignal(selectedTask);
  const dueBucket = getTaskDueBucket(selectedTask, new Date());

  const desktopInspectorContent = (
    <div className="space-y-3">
          <section className="detail-card">
            <div className="task-inspector-status-strip">
              <Badge variant={selectedTask.status === 'Blocked' ? 'warn' : selectedTask.status === 'Done' ? 'success' : 'neutral'}>{selectedTask.status}</Badge>
              <Badge variant={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
              {dueBucket === 'overdue' ? <Badge variant="danger">Overdue</Badge> : null}
              {dueBucket === 'today' ? <Badge variant="warn">Due today</Badge> : null}
              {dueBucket === 'tomorrow' ? <Badge variant="neutral">Due tomorrow</Badge> : null}
              {selectedTask.lifecycleState === 'review_required' || selectedTask.dataQuality === 'review_required' ? <Badge variant="warn">Review needed</Badge> : null}
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Why now" subtitle={editSurfacePolicy.execution.intent} compact />
            <div className="mt-2 task-execution-focus">
              <div className="tonal-micro"><strong>{nowSignal.whyNow}</strong></div>
              <div className="tonal-micro">Best next move: <strong>{nowSignal.nextMove}</strong></div>
              <div className="mt-2"><AppBadge tone={recommendedAction?.tone === 'default' ? 'info' : (recommendedAction?.tone ?? 'info')}>Recommended: {recommendedAction?.label ?? 'Update next step'}</AppBadge></div>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="What to do next" subtitle={recommendedAction?.reason ?? 'Use structured flows for real workflow transitions.'} compact />
            <div className={`task-inspector-actions mt-2 ${isMobileLike ? 'task-inspector-actions-mobile' : ''}`.trim()}>
              <button onClick={onRunRecommendedTaskAction} className="primary-btn">{recommendedAction?.label ?? 'Update next step'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'done')} className="action-btn">Complete</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
            </div>
            <div className="task-inspector-action-maintenance mt-2">
              <button onClick={() => onUpdateTask(selectedTask.id, { dueDate: fromDateInputValue(todayIso()) })} className="action-btn">Due today</button>
              <button onClick={() => onUpdateTask(selectedTask.id, { dueDate: fromDateInputValue(addDaysIso(todayIso(), 1)) })} className="action-btn">Due tomorrow</button>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Quick edit essentials" subtitle="Only live execution fields are editable here." compact />
            <div className="task-quick-edit-grid mt-2 task-quick-edit-grid-two-up">
              <label className="field-block"><span className="field-label">Priority</span><select value={draft.priority} onChange={(event) => setDraft((prev) => prev ? { ...prev, priority: event.target.value as TaskItem['priority'] } : prev)} className="field-input"><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
              <label className="field-block"><span className="field-label">Due date</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft((prev) => prev ? { ...prev, dueDate: event.target.value } : prev)} className="field-input" /></label>
              <label className="field-block task-quick-edit-grid-full"><span className="field-label">Next step</span><input value={draft.nextStep} onChange={(event) => setDraft((prev) => prev ? { ...prev, nextStep: event.target.value } : prev)} className="field-input" /></label>
            </div>
            <div className="task-quick-edit-actions mt-2">
              <button onClick={resetDraft} className="action-btn !px-2.5 !py-1.5 text-xs" disabled={!hasDraftChanges}><RotateCcw className="h-3.5 w-3.5" />Reset</button>
              <button onClick={saveQuickEdit} className="primary-btn !px-2.5 !py-1.5 text-xs" disabled={!hasDraftChanges}><Save className="h-3.5 w-3.5" />Save updates</button>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Linked context" subtitle="Parent follow-up and linked-task posture." compact />
            <div className="mt-2 rounded-2xl tonal-panel task-link-context-panel">
              <div className="tonal-micro"><strong>{linkedFollowUp ? linkedFollowUp.title : 'No linked follow-up'}</strong>{linkedFollowUp ? ` (${linkedFollowUp.status})` : ''}</div>
              <div className="tonal-micro mt-1">Owner: <strong>{selectedTask.owner}</strong> • Assignee: <strong>{selectedTask.assigneeDisplayName || selectedTask.owner}</strong></div>
              {linkedFollowUp ? <div className="tonal-micro mt-1">Open linked tasks: <strong>{linkedTaskOpenCount}</strong></div> : null}
              {linkedFollowUp && linkedParentRollup?.explanations?.length ? <div className="mt-2 space-y-1 text-xs text-slate-600">{linkedParentRollup.explanations.slice(0, 2).map((reason) => <div key={reason}>• {reason}</div>)}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {linkedFollowUp ? <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open linked follow-up</button> : null}
                <button onClick={() => onOpenRecordDrawer({ type: 'task', id: selectedTask.id })} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />{editSurfacePolicy.context.label}</button>
              </div>
            </div>
          </section>

          <section className="detail-card inspector-block">
            <SectionHeader title="Maintenance & full edit" subtitle="Low-frequency admin and closeout checks." compact />
            <div className="rounded-2xl tonal-panel task-link-context-panel mt-2">
              {linkedParentCloseout ? (
                <CloseoutReadinessCard
                  evaluation={linkedParentCloseout}
                  onOpenTask={(taskId) => onOpenRecordDrawer({ type: 'task', id: taskId })}
                  onReviewLinkedRecords={() => linkedFollowUp ? onOpenRecordDrawer({ type: 'followup', id: linkedFollowUp.id }) : undefined}
                />
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => onOpenRecordEditor({ type: 'task', id: selectedTask.id }, 'edit', 'workspace')} className="action-btn !px-2.5 !py-1.5 text-xs"><Pencil className="h-4 w-4" />{editSurfaceCtas.fullEditTask}</button>
                <button onClick={() => onRequestDeleteTask(selectedTask)} className="action-btn action-btn-danger !px-2.5 !py-1.5 text-xs">Delete task</button>
              </div>
            </div>
          </section>
    </div>
  );

  const mobileInspectorContent = (
    <div className="task-mobile-inspector-flow">
      <section className="detail-card">
        <div className="task-inspector-status-strip">
          <Badge variant={selectedTask.status === 'Blocked' ? 'warn' : selectedTask.status === 'Done' ? 'success' : 'neutral'}>{selectedTask.status}</Badge>
          <Badge variant={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
          {dueBucket === 'overdue' ? <Badge variant="danger">Overdue</Badge> : null}
          {dueBucket === 'today' ? <Badge variant="warn">Due today</Badge> : null}
          {dueBucket === 'tomorrow' ? <Badge variant="neutral">Due tomorrow</Badge> : null}
          {selectedTask.lifecycleState === 'review_required' || selectedTask.dataQuality === 'review_required' ? <Badge variant="warn">Review needed</Badge> : null}
        </div>
        <div className="task-mobile-signal-stack">
          <p className="task-mobile-signal-title">Why this task now</p>
          <p className="task-mobile-signal-line">{nowSignal.whyNow}</p>
          <p className="task-mobile-signal-line"><strong>Next move:</strong> {nowSignal.nextMove}</p>
        </div>
      </section>

      <section className="detail-card">
        <SectionHeader title="Do now" subtitle={recommendedAction?.reason ?? 'Primary actions for execution.'} compact />
        <div className="task-mobile-primary-actions">
          <button onClick={onRunRecommendedTaskAction} className="primary-btn task-mobile-recommended-action">{recommendedAction?.label ?? 'Update next step'}</button>
          <div className="task-mobile-action-grid">
            <button onClick={() => onOpenTaskFlow(selectedTask, 'done')} className="action-btn">Complete</button>
            <button onClick={() => onOpenTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
            <button onClick={() => onOpenTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
          </div>
          <div className="task-mobile-action-grid task-mobile-action-grid-secondary">
            <button onClick={() => onUpdateTask(selectedTask.id, { dueDate: fromDateInputValue(todayIso()) })} className="action-btn">Due today</button>
            <button onClick={() => onUpdateTask(selectedTask.id, { dueDate: fromDateInputValue(addDaysIso(todayIso(), 1)) })} className="action-btn">Due tomorrow</button>
          </div>
        </div>
      </section>

      <section className="detail-card">
        <SectionHeader title="Update essentials" subtitle="Fast edits for active execution." compact />
        <div className="task-mobile-edit-grid mt-2">
          <label className="field-block task-quick-edit-grid-full"><span className="field-label">Next step</span><input value={draft.nextStep} onChange={(event) => setDraft((prev) => prev ? { ...prev, nextStep: event.target.value } : prev)} className="field-input" /></label>
          <label className="field-block"><span className="field-label">Priority</span><select value={draft.priority} onChange={(event) => setDraft((prev) => prev ? { ...prev, priority: event.target.value as TaskItem['priority'] } : prev)} className="field-input"><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
          <label className="field-block"><span className="field-label">Due date</span><input type="date" value={draft.dueDate} onChange={(event) => setDraft((prev) => prev ? { ...prev, dueDate: event.target.value } : prev)} className="field-input" /></label>
          <div className="task-quick-edit-actions mt-1">
            <button onClick={resetDraft} className="action-btn !px-2.5 !py-1.5 text-xs" disabled={!hasDraftChanges}><RotateCcw className="h-3.5 w-3.5" />Reset</button>
            <button onClick={saveQuickEdit} className="primary-btn !px-2.5 !py-1.5 text-xs" disabled={!hasDraftChanges}><Save className="h-3.5 w-3.5" />Save updates</button>
          </div>
        </div>
      </section>

      <details className="detail-card task-mobile-secondary-details">
        <summary>Secondary details</summary>
        <div className="task-mobile-secondary-panel">
          <div className="tonal-micro">Owner: <strong>{selectedTask.owner}</strong></div>
          <div className="tonal-micro">Assignee: <strong>{selectedTask.assigneeDisplayName || selectedTask.owner}</strong></div>
          {linkedFollowUp ? <button onClick={() => onOpenLinkedFollowUp(linkedFollowUp.id)} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />Open linked follow-up</button> : null}
          <div className="mt-1 flex flex-wrap gap-2">
            <button onClick={() => onOpenRecordDrawer({ type: 'task', id: selectedTask.id })} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />{editSurfacePolicy.context.label}</button>
            <button onClick={() => onOpenRecordEditor({ type: 'task', id: selectedTask.id }, 'edit', 'workspace')} className="action-btn !px-2.5 !py-1.5 text-xs"><Pencil className="h-4 w-4" />{editSurfaceCtas.fullEditTask}</button>
            <button onClick={() => onRequestDeleteTask(selectedTask)} className="action-btn action-btn-danger !px-2.5 !py-1.5 text-xs">Delete task</button>
          </div>
          {linkedParentCloseout ? (
            <div className="mt-3">
              <CloseoutReadinessCard
                evaluation={linkedParentCloseout}
                onOpenTask={(taskId) => onOpenRecordDrawer({ type: 'task', id: taskId })}
                onReviewLinkedRecords={() => linkedFollowUp ? onOpenRecordDrawer({ type: 'followup', id: linkedFollowUp.id }) : undefined}
              />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );

  return (
    <AppModal size={isMobileLike ? "standard" : "wide"} onBackdropClick={onClose} onClose={onClose} ariaLabel="Task detail">
      <AppModalHeader
        title={selectedTask.title}
        subtitle={`${selectedTask.project} • ${selectedTask.assigneeDisplayName || selectedTask.owner}`}
        onClose={onClose}
        closeLabel={isMobileLike ? 'Back to queue' : 'Close'}
      />
      <AppModalBody className={isMobileLike ? "task-inspector-modal-mobile" : ""}>
        <RecordSaveStatus record={{ type: 'task', id: selectedTask.id }} />
        {isMobileLike ? mobileInspectorContent : desktopInspectorContent}
      </AppModalBody>
      <AppModalFooter>
        <button onClick={onClose} className="action-btn">{isMobileLike ? 'Back to queue' : 'Close'}</button>
      </AppModalFooter>
    </AppModal>
  );
});
