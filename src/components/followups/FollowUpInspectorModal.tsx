import { AlertTriangle, ArrowRight, Clock3, Link2, Pencil, Send } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpChildRollup } from '../../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../../lib/closeoutReadiness';
import { editSurfaceCtas, editSurfacePolicy } from '../../lib/editSurfacePolicy';
import { getLinkedTasksForFollowUp } from '../../lib/recordContext';
import { getWorkflowWarningsForRecord } from '../../lib/workflowPolicy';
import { formatDate, formatDateTime, priorityTone, statusTone } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { FollowUpItem } from '../../types';
import { Badge } from '../Badge';
import { AppBadge, AppModal, AppModalBody, AppModalFooter, AppModalHeader, SectionHeader } from '../ui/AppPrimitives';
import { deriveFollowUpAttentionSignal } from '../../domains/followups/helpers/attentionSignal';
import { deriveFollowUpNextMove } from '../../domains/followups/helpers/nextMove';
import { deriveFollowUpRecommendedAction } from '../../domains/shared/execution/recommendedAction';

type FollowUpInspectorModalProps = {
  open: boolean;
  selectedFollowUp: FollowUpItem | null;
  onClose: () => void;
  onOpenRecordEditor: (payload: { type: 'followup'; id: string }, mode: 'edit', source: 'workspace') => void;
  onOpenRecordDrawer: (payload: { type: 'followup' | 'task'; id: string }) => void;
  onOpenTouchModal: () => void;
  onMarkNudged: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
};

export const FollowUpInspectorModal = memo(function FollowUpInspectorModal({
  open,
  selectedFollowUp,
  onClose,
  onOpenRecordEditor,
  onOpenRecordDrawer,
  onOpenTouchModal,
  onMarkNudged,
  onSnooze,
}: FollowUpInspectorModalProps) {
  const { tasks, duplicateReviews } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    duplicateReviews: s.duplicateReviews,
  })));

  const context = useMemo(() => {
    if (!selectedFollowUp) return null;
    const childRollup = buildFollowUpChildRollup(selectedFollowUp.id, selectedFollowUp.status, tasks);
    const closeout = evaluateFollowUpCloseout(selectedFollowUp, tasks);
    const linkedTasks = getLinkedTasksForFollowUp(selectedFollowUp.id, tasks);
    const hasDuplicateAttention = duplicateReviews.some((review) => review.itemId === selectedFollowUp.id && review.candidates.length > 0);
    const workflowWarnings = getWorkflowWarningsForRecord(selectedFollowUp, { tasks });
    const attentionSignal = deriveFollowUpAttentionSignal(selectedFollowUp, { hasDuplicateAttention, childRollup, closeout, workflowWarnings });
    const nextMove = deriveFollowUpNextMove(selectedFollowUp, {
      hasDuplicateAttention,
      linkedTaskBlocked: childRollup.blockedByChildTasks,
      readyToClose: closeout.readiness === 'ready_to_close',
      attentionSignal,
    });
    const recommendedAction = deriveFollowUpRecommendedAction(selectedFollowUp, {
      nextMove,
      attentionSignal,
      closeoutReady: closeout.readiness === 'ready_to_close',
      hasDuplicateAttention,
      linkedBlocked: childRollup.blockedByChildTasks,
    });

    return {
      childRollup,
      closeout,
      linkedTasks,
      hasDuplicateAttention,
      workflowWarnings,
      attentionSignal,
      nextMove,
      recommendedAction,
    };
  }, [selectedFollowUp, tasks, duplicateReviews]);

  if (!open || !selectedFollowUp || !context) return null;

  const timelineRows = [
    ...selectedFollowUp.timeline.map((event) => ({ id: event.id, at: event.at, label: `[${event.type}] ${event.summary}` })),
    ...(selectedFollowUp.auditHistory ?? []).map((event) => ({ id: event.id, at: event.at, label: `[${event.action}] ${event.summary}` })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <AppModal size="wide" onBackdropClick={onClose} onClose={onClose} ariaLabel="Follow-up inspector">
      <AppModalHeader
        title={selectedFollowUp.title}
        subtitle={`${selectedFollowUp.project} • ${selectedFollowUp.assigneeDisplayName || selectedFollowUp.owner}`}
        onClose={onClose}
      />
      <AppModalBody>
        <div className="space-y-3">
          <section className="detail-card">
            <div className="task-inspector-status-strip">
              <Badge kind="status" variant={statusTone(selectedFollowUp.status)} withDot>{selectedFollowUp.status}</Badge>
              <Badge kind="priority" variant={priorityTone(selectedFollowUp.priority)}>{selectedFollowUp.priority}</Badge>
              <Badge kind="meta" variant="neutral">Escalation: {selectedFollowUp.escalationLevel}</Badge>
              {selectedFollowUp.lifecycleState === 'review_required' || selectedFollowUp.dataQuality === 'review_required' || selectedFollowUp.needsCleanup ? <Badge variant="warn">Review required</Badge> : null}
            </div>
            <div className="mt-2 text-xs text-slate-600">Owner: <strong>{selectedFollowUp.owner}</strong> • Assignee: <strong>{selectedFollowUp.assigneeDisplayName || selectedFollowUp.owner}</strong></div>
            <div className="mt-1 text-xs text-slate-600">Due {formatDate(selectedFollowUp.dueDate)} • Next touch {formatDate(selectedFollowUp.nextTouchDate)} • Promised {formatDate(selectedFollowUp.promisedDate)}</div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Execution focus" subtitle={editSurfacePolicy.execution.intent} compact />
            <div className="mt-2 space-y-2">
              <div className="tonal-micro"><strong>{context.attentionSignal.label}</strong> — {context.attentionSignal.helperText}</div>
              <div className="tonal-micro">Recommended next move: <strong>{context.nextMove.label}</strong></div>
              <div className="text-xs text-slate-600">Waiting on: <strong>{selectedFollowUp.waitingOn || 'Not set'}</strong> • Action state: <strong>{selectedFollowUp.actionState || 'Draft created'}</strong></div>
              <AppBadge tone={context.recommendedAction.tone === 'default' ? 'info' : context.recommendedAction.tone}>Recommended: {context.recommendedAction.label}</AppBadge>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Primary actions" subtitle="Execution-first actions; deeper edits are secondary." compact />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="primary-btn" onClick={() => onOpenTouchModal()}>Log touch</button>
              <button type="button" className="action-btn" onClick={() => onMarkNudged(selectedFollowUp.id)}><Send className="h-4 w-4" />Mark nudged</button>
              <button type="button" className="action-btn" onClick={() => onSnooze(selectedFollowUp.id, 2)}><Clock3 className="h-4 w-4" />Snooze 2d</button>
              <button type="button" className="action-btn" disabled title="Prompt 3 will wire structured transitions."><ArrowRight className="h-4 w-4" />Run recommended flow</button>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Linked work and context" subtitle="Context is available, but not the default queue-open path." compact />
            <div className="mt-2 space-y-2">
              <div className="text-xs text-slate-600">{context.childRollup.summaryLabel}</div>
              <div className="text-xs text-slate-600">Linked tasks: {context.linkedTasks.filter((task) => task.status !== 'Done').length}/{context.linkedTasks.length} open</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="action-btn !px-2.5 !py-1.5 text-xs" onClick={() => onOpenRecordDrawer({ type: 'followup', id: selectedFollowUp.id })}><Link2 className="h-4 w-4" />{editSurfaceCtas.openContext}</button>
                {context.linkedTasks.slice(0, 2).map((task) => (
                  <button key={task.id} type="button" className="action-btn !px-2.5 !py-1.5 text-xs" onClick={() => onOpenRecordDrawer({ type: 'task', id: task.id })}>Open task: {task.title}</button>
                ))}
              </div>
            </div>
          </section>

          {(selectedFollowUp.reviewReasons?.length || context.workflowWarnings.length || context.hasDuplicateAttention) ? (
            <section className="detail-card">
              <SectionHeader title="Trust / lifecycle" subtitle="Resolve these to keep execution confidence high." compact />
              <div className="mt-2 space-y-1 text-xs text-amber-800 rounded-xl border border-amber-200 bg-amber-50 p-3">
                {selectedFollowUp.reviewReasons?.slice(0, 3).map((reason) => <div key={reason}>• {reason}</div>)}
                {context.workflowWarnings.slice(0, 2).map((warning) => <div key={warning}>• {warning}</div>)}
                {context.hasDuplicateAttention ? <div>• Duplicate review is pending.</div> : null}
              </div>
            </section>
          ) : null}

          <section className="detail-card inspector-block">
            <SectionHeader title="Maintenance & full edit" subtitle={editSurfacePolicy.full_edit.intent} compact />
            <div className="mt-2 rounded-2xl tonal-panel p-3">
              <div className="text-xs text-slate-600">Use full edit for schema-level updates, fields not shown in execution view, and deeper record maintenance.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="action-btn !px-2.5 !py-1.5 text-xs" onClick={() => onOpenRecordEditor({ type: 'followup', id: selectedFollowUp.id }, 'edit', 'workspace')}><Pencil className="h-4 w-4" />{editSurfaceCtas.fullEditFollowUp}</button>
                <button type="button" className="action-btn !px-2.5 !py-1.5 text-xs" disabled title="Prompt 3 will wire close/escalate flow actions."><AlertTriangle className="h-4 w-4" />Maintenance actions (Prompt 3)</button>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <SectionHeader title="Recent activity" subtitle="Latest timeline and audit context." compact />
            <div className="mt-2 space-y-1.5">
              {timelineRows.length > 0 ? timelineRows.map((event) => (
                <div key={event.id} className="text-xs text-slate-600"><strong>{formatDateTime(event.at)}</strong> — {event.label}</div>
              )) : <div className="text-xs text-slate-500">No recent timeline events.</div>}
            </div>
          </section>
        </div>
      </AppModalBody>
      <AppModalFooter>
        <button type="button" className="action-btn" onClick={onClose}>Back to queue</button>
      </AppModalFooter>
    </AppModal>
  );
});
