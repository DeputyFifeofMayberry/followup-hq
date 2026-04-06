import type { FollowUpNextMove, FollowUpNextMoveTone } from '../../followups/helpers/nextMove';
import type { FollowUpAttentionSignal } from '../../followups/helpers/attentionSignal';
import type { FollowUpItem, TaskItem } from '../../../types';

export type RecommendedActionTone = Exclude<FollowUpNextMoveTone, 'default'> | 'default';

export interface RecommendedActionChoice<ActionId extends string> {
  id: ActionId;
  label: string;
  reason: string;
  tone: RecommendedActionTone;
}

export type FollowUpRecommendedActionId = 'draft' | 'log_touch' | 'waiting_on_response' | 'snooze' | 'escalate' | 'close' | 'update_next_move';

export type TaskRecommendedActionId = 'complete' | 'defer' | 'block' | 'unblock' | 'update_next_step';

interface FollowUpRecommendationContext {
  nextMove: FollowUpNextMove | null;
  attentionSignal: FollowUpAttentionSignal | null;
  closeoutReady: boolean;
  hasDuplicateAttention: boolean;
  linkedBlocked: boolean;
}

export function deriveFollowUpRecommendedAction(
  item: FollowUpItem,
  context: FollowUpRecommendationContext,
): RecommendedActionChoice<FollowUpRecommendedActionId> {
  if (context.closeoutReady || item.status === 'Closed') {
    return { id: 'close', label: 'Close now', reason: 'Closeout checks look ready.', tone: 'success' };
  }

  if (context.hasDuplicateAttention) {
    return { id: 'update_next_move', label: 'Review duplicates first', reason: 'Potential duplicates should be reviewed before outbound action.', tone: 'warn' };
  }

  if (context.linkedBlocked || item.status === 'At risk' || context.attentionSignal?.tone === 'danger') {
    return { id: 'escalate', label: 'Escalate now', reason: context.nextMove?.reason || 'Risk is elevated and needs immediate escalation.', tone: 'danger' };
  }

  if (item.status === 'Waiting on external') {
    return { id: 'log_touch', label: 'Log touch', reason: context.nextMove?.reason || 'Capture outreach and keep the response loop active.', tone: 'info' };
  }

  if (item.status === 'Waiting internal') {
    return { id: 'snooze', label: 'Snooze with date', reason: context.nextMove?.reason || 'Set a deliberate review date to protect cadence.', tone: 'info' };
  }

  if ((item.nextAction || '').trim().length === 0) {
    return { id: 'update_next_move', label: 'Update next move', reason: 'No clear next action is captured yet.', tone: 'info' };
  }

  if (item.status === 'Needs action') {
    return { id: 'draft', label: 'Draft follow-up', reason: context.nextMove?.reason || 'This item needs an outbound move.', tone: 'info' };
  }

  return {
    id: 'waiting_on_response',
    label: 'Mark waiting on response',
    reason: context.nextMove?.reason || 'Use waiting state to keep follow-through explicit.',
    tone: context.nextMove?.tone ?? 'default',
  };
}

export function deriveTaskRecommendedAction(task: TaskItem): RecommendedActionChoice<TaskRecommendedActionId> {
  if (task.status === 'Done') {
    return { id: 'update_next_step', label: 'Update next step', reason: 'Task is done; capture the next tactical move or reopen intentionally.', tone: 'default' };
  }

  if (task.status === 'Blocked') {
    return {
      id: task.blockReason ? 'unblock' : 'update_next_step',
      label: task.blockReason ? 'Unblock task' : 'Capture block reason',
      reason: task.blockReason ? 'A blocker is documented, so resume flow when ready.' : 'Blocked tasks move faster when the reason is explicit.',
      tone: 'warn',
    };
  }

  if (task.dueDate && new Date(task.dueDate).getTime() < Date.now()) {
    return { id: 'complete', label: 'Complete now', reason: 'Task is overdue and should be resolved or explicitly deferred.', tone: 'danger' };
  }

  if (!task.nextStep?.trim()) {
    return { id: 'update_next_step', label: 'Update next step', reason: 'No explicit next step is captured.', tone: 'info' };
  }

  if (task.deferredUntil) {
    return { id: 'defer', label: 'Adjust defer date', reason: 'Task is deferred; verify the date still matches reality.', tone: 'default' };
  }

  return {
    id: 'complete',
    label: 'Complete',
    reason: task.recommendedAction || 'Resolve this task and move to the next item.',
    tone: 'info',
  };
}
