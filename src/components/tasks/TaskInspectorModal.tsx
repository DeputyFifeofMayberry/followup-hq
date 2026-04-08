import { Link2, Pencil, RotateCcw, Save } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import type { TaskRecommendedAction } from '../../domains/shared';
import { editSurfaceCtas, editSurfacePolicy } from '../../lib/editSurfacePolicy';
import { fromDateInputValue, priorityTone, toDateInputValue } from '../../lib/utils';
import type { FollowUpItem, TaskItem } from '../../types';
import { Badge } from '../Badge';
import { CloseoutReadinessCard } from '../CloseoutReadinessCard';
import { AppBadge, AppModal, AppModalBody, AppModalFooter, AppModalHeader, SectionHeader } from '../ui/AppPrimitives';

type TaskInspectorModalProps = {
  open: boolean;
  selectedTask: TaskItem | null;
  linkedFollowUp: FollowUpItem | null;
  linkedTaskOpenCount: number;
  linkedParentRollup: { explanations?: string[] } | null;
  linkedParentCloseout: React.ComponentProps<typeof CloseoutReadinessCard>['evaluation'] | null;
  recommendedAction: TaskRecommendedAction | null;
  renderNowSignal: (task: TaskItem) => { whyNow: string; nextMove: string };
  onClose: () => void;
  onRunRecommendedTaskAction: () => void;
  onOpenTaskFlow: (task: TaskItem, kind: 'done' | 'block' | 'unblock' | 'defer') => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onOpenLinkedFollowUp: (followUpId: string) => void;
  onOpenRecordDrawer: (payload: { type: 'task' | 'followup'; id: string }) => void;
  onOpenRecordEditor: (payload: { type: 'task'; id: string }, mode: 'edit', source: 'workspace') => void;
};

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
  onOpenLinkedFollowUp,
  onOpenRecordDrawer,
  onOpenRecordEditor,
}: TaskInspectorModalProps) {
  const [nextStepDraft, setNextStepDraft] = useState('');
  const [dueDateDraft, setDueDateDraft] = useState('');

  useEffect(() => {
    if (!open || !selectedTask) return;
    setNextStepDraft(selectedTask.nextStep || '');
    setDueDateDraft(toDateInputValue(selectedTask.dueDate));
  }, [open, selectedTask?.id, selectedTask?.nextStep, selectedTask?.dueDate]);

  const hasDraftChanges = useMemo(() => {
    if (!selectedTask) return false;
    const dueDraftIso = dueDateDraft ? fromDateInputValue(dueDateDraft) : undefined;
    return (nextStepDraft || '') !== (selectedTask.nextStep || '') || dueDraftIso !== selectedTask.dueDate;
  }, [selectedTask, nextStepDraft, dueDateDraft]);

  const resetDraft = () => {
    if (!selectedTask) return;
    setNextStepDraft(selectedTask.nextStep || '');
    setDueDateDraft(toDateInputValue(selectedTask.dueDate));
  };

  const saveQuickEdit = () => {
    if (!selectedTask || !hasDraftChanges) return;
    onUpdateTask(selectedTask.id, {
      nextStep: nextStepDraft,
      dueDate: dueDateDraft ? fromDateInputValue(dueDateDraft) : undefined,
    });
  };

  if (!open || !selectedTask) return null;

  const nowSignal = renderNowSignal(selectedTask);

  return (
    <AppModal size="inspector" onBackdropClick={onClose} onClose={onClose}>
      <AppModalHeader
        title={selectedTask.title}
        subtitle={`${selectedTask.project} • ${selectedTask.assigneeDisplayName || selectedTask.owner}`}
        onClose={onClose}
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
          </section>

          <section className="detail-card">
            <SectionHeader title="Why now" subtitle="Scan the signal and take the next move." compact />
            <div className="mt-2 task-execution-focus">
              <div className="tonal-micro"><strong>{nowSignal.whyNow}</strong></div>
              <div className="tonal-micro">Best next move: <strong>{nowSignal.nextMove}</strong></div>
              <div className="mt-2"><AppBadge tone={recommendedAction?.tone === 'default' ? 'info' : (recommendedAction?.tone ?? 'info')}>Recommended: {recommendedAction?.label ?? 'Update next step'}</AppBadge></div>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Primary actions" subtitle={recommendedAction?.reason ?? 'Fast transitions for active work.'} compact />
            <div className="task-inspector-actions mt-2">
              <button onClick={onRunRecommendedTaskAction} className="primary-btn">{recommendedAction?.label ?? 'Update next step'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'done')} className="action-btn">Complete</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Quick edit" subtitle="Save changes intentionally." compact />
            <div className="task-quick-edit-grid mt-2">
              <label className="field-block"><span className="field-label">Next step</span><input value={nextStepDraft} onChange={(event) => setNextStepDraft(event.target.value)} className="field-input" /></label>
              <label className="field-block"><span className="field-label">Due date</span><input type="date" value={dueDateDraft} onChange={(event) => setDueDateDraft(event.target.value)} className="field-input" /></label>
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
              </div>
            </div>
          </section>
        </div>
      </AppModalBody>
      <AppModalFooter>
        <button onClick={onClose} className="action-btn">Close</button>
      </AppModalFooter>
    </AppModal>
  );
});
