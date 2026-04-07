import type { BatchWorkflowResult } from '../store/types';
import type { FollowUpItem, FollowUpStatus, TaskItem, TaskStatus } from '../types';

export const FOLLOW_UP_TOAST_WORTHY_KEYS: Array<keyof FollowUpItem> = [
  'status',
  'dueDate',
  'nextTouchDate',
  'promisedDate',
  'assigneeDisplayName',
  'assigneeUserId',
  'owner',
  'escalationLevel',
  'snoozedUntilDate',
  'actionState',
  'waitingOn',
  'lastNudgedAt',
];

export const TASK_TOAST_WORTHY_KEYS: Array<keyof TaskItem> = [
  'status',
  'dueDate',
  'assigneeDisplayName',
  'assigneeUserId',
  'owner',
  'priority',
  'project',
  'blockReason',
  'deferredUntil',
];

const FOLLOW_UP_STATUS_VERB: Partial<Record<FollowUpStatus, string>> = {
  Closed: 'closed',
};

export function shouldToastFollowUpPatch(patch: Partial<FollowUpItem>): boolean {
  return FOLLOW_UP_TOAST_WORTHY_KEYS.some((key) => patch[key] !== undefined);
}

export function shouldToastTaskPatch(patch: Partial<TaskItem>): boolean {
  return TASK_TOAST_WORTHY_KEYS.some((key) => patch[key] !== undefined);
}

export function buildFollowUpUpdateTitle(before: FollowUpItem, patch: Partial<FollowUpItem>): string {
  if (patch.status && patch.status !== before.status) {
    return patch.status === 'Closed' ? 'Follow-up closed' : `Follow-up moved to ${patch.status}`;
  }
  if (patch.dueDate !== undefined && patch.dueDate !== before.dueDate) return 'Follow-up due date updated';
  if (patch.nextTouchDate !== undefined && patch.nextTouchDate !== before.nextTouchDate) return 'Next touch updated';
  if (patch.assigneeDisplayName !== undefined && patch.assigneeDisplayName !== before.assigneeDisplayName) return 'Follow-up reassigned';
  return 'Follow-up updated';
}

export function buildTaskUpdateTitle(before: TaskItem, patch: Partial<TaskItem>): string {
  if (patch.status && patch.status !== before.status) {
    if (patch.status === 'Done') return 'Task marked done';
    return `Task moved to ${patch.status}`;
  }
  if (patch.assigneeDisplayName !== undefined && patch.assigneeDisplayName !== before.assigneeDisplayName) return 'Task reassigned';
  if (patch.dueDate !== undefined && patch.dueDate !== before.dueDate) return 'Task due date updated';
  return 'Task updated';
}

export function buildBulkResultToast(result: BatchWorkflowResult, status: FollowUpStatus): { title: string; message?: string; tone: 'success' | 'warning' } {
  const verb = FOLLOW_UP_STATUS_VERB[status] ?? 'updated';
  if (result.affected > 0 && result.skipped === 0) {
    return { title: `${result.affected} follow-ups ${verb}`, tone: 'success' };
  }
  if (result.affected > 0 && result.skipped > 0) {
    return {
      title: `${result.affected} follow-ups ${verb}, ${result.skipped} skipped`,
      message: `${result.skipped} were skipped because they failed workflow validation.`,
      tone: 'warning',
    };
  }
  return {
    title: `${result.skipped} follow-ups skipped`,
    message: 'The action was blocked by workflow validation.',
    tone: 'warning',
  };
}

export function buildBlockedTransitionToast(entity: 'followup' | 'task', attemptedStatus: FollowUpStatus | TaskStatus, blockedCount = 1): { title: string; message: string } {
  const noun = entity === 'followup' ? 'follow-up' : 'task';
  return {
    title: `${attemptedStatus} action blocked for ${blockedCount} ${noun}${blockedCount === 1 ? '' : 's'}`,
    message: blockedCount === 1 ? 'This record did not pass workflow validation.' : 'These records did not pass workflow validation.',
  };
}
