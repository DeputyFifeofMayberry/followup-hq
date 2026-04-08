import { Link2, Pencil } from 'lucide-react';
import { memo } from 'react';
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
  if (!open || !selectedTask) return null;

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
            <div className="mt-3 task-execution-focus">
              <div className="tonal-micro">Why now: <strong>{renderNowSignal(selectedTask).whyNow}</strong></div>
              <div className="tonal-micro">Best next move: <strong>{renderNowSignal(selectedTask).nextMove}</strong></div>
              <div className="mt-2"><AppBadge tone={recommendedAction?.tone === 'default' ? 'info' : (recommendedAction?.tone ?? 'info')}>Recommended: {recommendedAction?.label ?? 'Update next step'}</AppBadge></div>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Actions" subtitle={recommendedAction?.reason ?? 'Focused execution actions first.'} compact />
            <div className="task-inspector-actions mt-2">
              <button onClick={onRunRecommendedTaskAction} className="primary-btn">{recommendedAction?.label ?? 'Update next step'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'done')} className="action-btn">Complete</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, selectedTask.status === 'Blocked' ? 'unblock' : 'block')} className="action-btn">{selectedTask.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
              <button onClick={() => onOpenTaskFlow(selectedTask, 'defer')} className="action-btn">Defer</button>
            </div>
            <div className="task-quick-edit-grid mt-3">
              <label className="field-block"><span className="field-label">Next step</span><input value={selectedTask.nextStep || ''} onChange={(event) => onUpdateTask(selectedTask.id, { nextStep: event.target.value })} className="field-input" /></label>
              <label className="field-block"><span className="field-label">Due date</span><input type="date" value={toDateInputValue(selectedTask.dueDate)} onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value ? fromDateInputValue(event.target.value) : undefined })} className="field-input" /></label>
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
                <button onClick={() => onOpenRecordDrawer({ type: 'task', id: selectedTask.id })} className="action-btn !px-2.5 !py-1.5 text-xs"><Link2 className="h-4 w-4" />{editSurfacePolicy.context.label}</button>
              </div>
            </div>
          </section>

          <details className="detail-card inspector-block">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Maintenance & full edit</summary>
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
          </details>
        </div>
      </AppModalBody>
      <AppModalFooter>
        <button onClick={onClose} className="action-btn">Close</button>
      </AppModalFooter>
    </AppModal>
  );
});
