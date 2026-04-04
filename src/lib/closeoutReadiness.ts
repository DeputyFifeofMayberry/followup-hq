import type { FollowUpItem, TaskItem } from '../types';
import { buildFollowUpChildRollup } from './childWorkRollups';
import { isTaskOverdue } from './utils';

export type CloseoutConditionSeverity = 'hard_blocker' | 'override_required' | 'warning' | 'ready_signal';

export interface CloseoutCondition {
  code:
    | 'open_child_tasks'
    | 'blocked_child_tasks'
    | 'overdue_child_tasks'
    | 'missing_completion_note'
    | 'unresolved_waiting_state'
    | 'intake_review_ambiguity'
    | 'all_child_tasks_done'
    | 'closure_context_present';
  severity: CloseoutConditionSeverity;
  title: string;
  detail: string;
  actionLabel?: string;
  relatedRecordIds?: string[];
}

export type FollowUpCloseoutReadiness = 'ready_to_close' | 'not_ready_to_close' | 'close_with_override';

export interface FollowUpCloseoutEvaluation {
  readiness: FollowUpCloseoutReadiness;
  hardBlockers: CloseoutCondition[];
  overrideRequired: CloseoutCondition[];
  warnings: CloseoutCondition[];
  readySignals: CloseoutCondition[];
  summary: string;
  allConditions: CloseoutCondition[];
}

function pluralize(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function hasCompletionContext(item: FollowUpItem, patch?: Partial<FollowUpItem>) {
  const completionNote = (patch?.completionNote ?? item.completionNote ?? '').trim();
  const receipts = patch?.actionReceipts ?? item.actionReceipts ?? [];
  return Boolean(completionNote) || receipts.some((receipt) => receipt.confirmed);
}

export function evaluateFollowUpCloseout(item: FollowUpItem, tasks: TaskItem[], patch?: Partial<FollowUpItem>): FollowUpCloseoutEvaluation {
  const childRollup = buildFollowUpChildRollup(item.id, item.status, tasks);
  const linkedTasks = tasks.filter((task) => task.linkedFollowUpId === item.id);
  const openLinked = linkedTasks.filter((task) => task.status !== 'Done');
  const blockedLinked = linkedTasks.filter((task) => task.status === 'Blocked');
  const overdueLinked = linkedTasks.filter((task) => task.status !== 'Done' && isTaskOverdue(task));

  const hardBlockers: CloseoutCondition[] = [];
  const overrideRequired: CloseoutCondition[] = [];
  const warnings: CloseoutCondition[] = [];
  const readySignals: CloseoutCondition[] = [];

  if (!hasCompletionContext(item, patch)) {
    hardBlockers.push({
      code: 'missing_completion_note',
      severity: 'hard_blocker',
      title: 'Missing completion context',
      detail: 'Add a completion note or confirm an action receipt before closing.',
      actionLabel: 'Add completion note',
    });
  } else {
    readySignals.push({
      code: 'closure_context_present',
      severity: 'ready_signal',
      title: 'Completion context captured',
      detail: 'Completion note or receipt is already recorded.',
    });
  }

  if (openLinked.length > 0) {
    overrideRequired.push({
      code: 'open_child_tasks',
      severity: 'override_required',
      title: 'Open child tasks remain',
      detail: `${pluralize(openLinked.length, 'linked task')} still open. Close now only with override acknowledgement.`,
      actionLabel: 'Open blocking child tasks',
      relatedRecordIds: openLinked.map((task) => task.id),
    });
  }

  if (blockedLinked.length > 0) {
    overrideRequired.push({
      code: 'blocked_child_tasks',
      severity: 'override_required',
      title: 'Blocked child tasks remain',
      detail: `${pluralize(blockedLinked.length, 'linked task')} blocked. Resolve block reasons or close with override.`,
      actionLabel: 'Resolve blocked child tasks',
      relatedRecordIds: blockedLinked.map((task) => task.id),
    });
  }

  if (childRollup.overdue > 0) {
    warnings.push({
      code: 'overdue_child_tasks',
      severity: 'warning',
      title: 'Overdue child tasks',
      detail: `${pluralize(childRollup.overdue, 'linked task')} overdue and should be reviewed before closeout.`,
      actionLabel: 'Review overdue tasks',
      relatedRecordIds: overdueLinked.map((task) => task.id),
    });
  }

  const waitingOn = (patch?.waitingOn ?? item.waitingOn ?? '').trim();
  const status = patch?.status ?? item.status;
  if (status === 'Waiting on external' || status === 'Waiting internal' || waitingOn) {
    overrideRequired.push({
      code: 'unresolved_waiting_state',
      severity: 'override_required',
      title: 'Unresolved waiting state',
      detail: 'This follow-up is still marked as waiting. Confirm the response or clear waiting state before closeout.',
      actionLabel: 'Resolve waiting state',
    });
  }

  if (item.needsCleanup) {
    warnings.push({
      code: 'intake_review_ambiguity',
      severity: 'warning',
      title: 'Intake/review ambiguity still flagged',
      detail: 'This record still has cleanup flags from intake review. Verify project/owner/context before final closeout.',
      actionLabel: 'Review linked records',
    });
  }

  if (childRollup.allDone) {
    readySignals.push({
      code: 'all_child_tasks_done',
      severity: 'ready_signal',
      title: 'All child tasks are done',
      detail: 'Linked execution work is complete.',
    });
  }

  const readiness: FollowUpCloseoutReadiness = hardBlockers.length > 0
    ? 'not_ready_to_close'
    : overrideRequired.length > 0 || warnings.length > 0
      ? 'close_with_override'
      : 'ready_to_close';

  const summary = readiness === 'ready_to_close'
    ? 'Ready to close. No blockers found.'
    : readiness === 'not_ready_to_close'
      ? `Not ready to close: ${hardBlockers[0]?.title || 'resolve blockers first'}.`
      : 'Close with override available after reviewing unresolved work.';

  return {
    readiness,
    hardBlockers,
    overrideRequired,
    warnings,
    readySignals,
    summary,
    allConditions: [...hardBlockers, ...overrideRequired, ...warnings, ...readySignals],
  };
}
