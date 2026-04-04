import type { FollowUpItem, FollowUpStatus, TaskItem, TaskStatus } from '../types';

export interface WorkflowValidationResult {
  allowed: boolean;
  warnings: string[];
  blockers: string[];
  requiredFields: string[];
  overrideAllowed: boolean;
  recommendedNextActions: string[];
  readyToClose: boolean;
}

interface TransitionContext {
  tasks?: TaskItem[];
}

interface TransitionInput<TStatus, TRecord> {
  record: TRecord;
  from: TStatus;
  to: TStatus;
  patch?: Partial<TRecord>;
  context?: TransitionContext;
  override?: boolean;
}

const FOLLOW_UP_TRANSITIONS: Record<FollowUpStatus, FollowUpStatus[]> = {
  'Needs action': ['In progress', 'Waiting on external', 'Waiting internal', 'At risk', 'Closed'],
  'In progress': ['Needs action', 'Waiting on external', 'Waiting internal', 'At risk', 'Closed'],
  'Waiting on external': ['Needs action', 'In progress', 'At risk', 'Closed'],
  'Waiting internal': ['Needs action', 'In progress', 'At risk', 'Closed'],
  'At risk': ['Needs action', 'In progress', 'Waiting on external', 'Waiting internal', 'Closed'],
  Closed: ['Needs action', 'In progress'],
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'To do': ['In progress', 'Blocked', 'Done'],
  'In progress': ['To do', 'Blocked', 'Done'],
  Blocked: ['In progress', 'To do'],
  Done: ['In progress', 'To do'],
};

const withDefaults = (partial: Partial<WorkflowValidationResult>): WorkflowValidationResult => ({
  allowed: partial.allowed ?? true,
  warnings: partial.warnings ?? [],
  blockers: partial.blockers ?? [],
  requiredFields: partial.requiredFields ?? [],
  overrideAllowed: partial.overrideAllowed ?? false,
  recommendedNextActions: partial.recommendedNextActions ?? [],
  readyToClose: partial.readyToClose ?? false,
});

export function validateFollowUpTransition({ record, from, to, patch, context, override = false }: TransitionInput<FollowUpStatus, FollowUpItem>): WorkflowValidationResult {
  const allowedTargets = FOLLOW_UP_TRANSITIONS[from] ?? [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredFields: string[] = [];
  const recommendedNextActions: string[] = [];

  if (from !== to && !allowedTargets.includes(to)) {
    blockers.push(`Transition ${from} → ${to} is not allowed.`);
  }

  const tasks = (context?.tasks ?? []).filter((task) => task.linkedFollowUpId === record.id);
  const openTasks = tasks.filter((task) => task.status !== 'Done');
  const blockedTasks = tasks.filter((task) => task.status === 'Blocked');
  const allDone = tasks.length > 0 && openTasks.length === 0;

  if (to === 'Closed') {
    const closureNote = (patch?.completionNote ?? record.completionNote ?? '').trim();
    const hasReceipt = (patch?.actionReceipts ?? record.actionReceipts ?? []).some((receipt) => receipt.confirmed);
    const hasAcknowledge = override;

    if (!closureNote && !hasReceipt && !hasAcknowledge) {
      blockers.push('Closing follow-up needs completion note, confirmation receipt, or explicit override acknowledgement.');
      requiredFields.push('completionNote or action receipt');
    }

    if (openTasks.length > 0) {
      warnings.push(`Cannot close cleanly: ${openTasks.length} linked task${openTasks.length === 1 ? '' : 's'} still open.`);
    }

    if (blockedTasks.length > 0) {
      warnings.push(`Strong warning: ${blockedTasks.length} linked task${blockedTasks.length === 1 ? ' is' : 's are'} blocked.`);
    }

    if (openTasks.length > 0 && !override) {
      blockers.push('Review linked tasks first or close with explicit override.');
    }
  }

  if (to === 'Waiting on external') {
    if (!(patch?.waitingOn ?? record.waitingOn)?.trim()) {
      warnings.push('Waiting on external should include who you are waiting on.');
      requiredFields.push('waitingOn');
    }
    if (!(patch?.nextTouchDate ?? record.nextTouchDate)) {
      warnings.push('Waiting on external should include the next touch date.');
      requiredFields.push('nextTouchDate');
    }
    recommendedNextActions.push('Set follow-up owner and next touch date.');
  }

  if (patch?.snoozedUntilDate !== undefined || (to !== from && to === 'Waiting internal')) {
    const nextDate = patch?.snoozedUntilDate ?? patch?.nextTouchDate ?? record.snoozedUntilDate ?? record.nextTouchDate;
    if (!nextDate) {
      blockers.push('Deferring / snoozing requires a next review date.');
      requiredFields.push('nextTouchDate');
    }
  }

  if (to === 'At risk') {
    recommendedNextActions.push('Add concrete next action and owner intervention plan.');
  }

  if (allDone && to !== 'Closed') {
    warnings.push('Ready to close: all linked tasks are complete.');
  }

  return withDefaults({
    allowed: blockers.length === 0,
    blockers,
    warnings,
    requiredFields,
    overrideAllowed: to === 'Closed' && openTasks.length > 0,
    recommendedNextActions,
    readyToClose: allDone,
  });
}

export function validateTaskTransition({ record, from, to, patch, override = false }: TransitionInput<TaskStatus, TaskItem>): WorkflowValidationResult {
  const allowedTargets = TASK_TRANSITIONS[from] ?? [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredFields: string[] = [];

  if (from !== to && !allowedTargets.includes(to)) {
    blockers.push(`Transition ${from} → ${to} is not allowed.`);
  }

  if (to === 'Done' && !(patch?.completionNote ?? record.completionNote)?.trim()) {
    blockers.push('Done task needs completion context or completion note.');
    requiredFields.push('completionNote');
  }

  if (to === 'Blocked' && !(patch?.blockReason ?? record.blockReason)?.trim()) {
    blockers.push('Blocked task needs a block reason.');
    requiredFields.push('blockReason');
  }

  if (patch?.deferredUntil !== undefined) {
    if (!patch.deferredUntil) {
      blockers.push('Defer / snooze requires a next review date.');
      requiredFields.push('deferredUntil');
    } else if (!(patch.nextReviewAt ?? record.nextReviewAt)) {
      warnings.push('Deferred task should include next review date.');
    }
  }

  return withDefaults({
    allowed: blockers.length === 0 || override,
    blockers,
    warnings,
    requiredFields,
    overrideAllowed: false,
    recommendedNextActions: to === 'Blocked' ? ['Set owner action and next review date.'] : [],
    readyToClose: to === 'Done',
  });
}

export function getFollowUpTransitionOptions(status: FollowUpStatus): FollowUpStatus[] {
  return FOLLOW_UP_TRANSITIONS[status] ?? [];
}

export function getTaskTransitionOptions(status: TaskStatus): TaskStatus[] {
  return TASK_TRANSITIONS[status] ?? [];
}

export function getWorkflowWarningsForRecord(record: FollowUpItem | TaskItem, context?: TransitionContext): string[] {
  if ('source' in record) {
    const evaluation = validateFollowUpTransition({ record, from: record.status, to: record.status, context });
    return evaluation.warnings;
  }
  const evaluation = validateTaskTransition({ record, from: record.status, to: record.status });
  return evaluation.warnings;
}
