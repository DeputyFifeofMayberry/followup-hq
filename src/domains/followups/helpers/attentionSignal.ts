import type { FollowUpChildRollup } from '../../../lib/childWorkRollups';
import type { FollowUpCloseoutEvaluation } from '../../../lib/closeoutReadiness';
import type { FollowUpItem } from '../../../types';
import { daysUntil, needsNudge } from '../../../lib/utils';

export type FollowUpAttentionTone = 'danger' | 'warn' | 'info' | 'success' | 'default';

export interface FollowUpAttentionSignal {
  label: string;
  tone: FollowUpAttentionTone;
  helperText: string;
  tag:
    | 'blocked_by_children'
    | 'needs_duplicate_review'
    | 'ready_to_close'
    | 'touch_due'
    | 'needs_execution_update'
    | 'waiting_clean';
}

interface AttentionContext {
  hasDuplicateAttention: boolean;
  childRollup: FollowUpChildRollup;
  closeout: FollowUpCloseoutEvaluation;
  workflowWarnings: string[];
}

export function deriveFollowUpAttentionSignal(item: FollowUpItem, context: AttentionContext): FollowUpAttentionSignal {
  if (context.hasDuplicateAttention) {
    return {
      label: 'Duplicate review recommended',
      tone: 'warn',
      helperText: 'Review possible duplicates before running outbound actions.',
      tag: 'needs_duplicate_review',
    };
  }

  if (context.childRollup.blockedByChildTasks) {
    return {
      label: 'Blocked by linked work',
      tone: 'danger',
      helperText: context.childRollup.blocked > 0
        ? `${context.childRollup.blocked} linked task${context.childRollup.blocked === 1 ? '' : 's'} blocked.`
        : `${context.childRollup.overdue} linked task${context.childRollup.overdue === 1 ? '' : 's'} overdue.`,
      tag: 'blocked_by_children',
    };
  }

  if (context.closeout.readiness === 'ready_to_close') {
    return {
      label: 'Ready to close',
      tone: 'success',
      helperText: 'Completion context is in place and no closeout blockers remain.',
      tag: 'ready_to_close',
    };
  }

  if (context.workflowWarnings.length > 0) {
    return {
      label: 'Needs execution cleanup',
      tone: 'warn',
      helperText: context.workflowWarnings[0],
      tag: 'needs_execution_update',
    };
  }

  if (needsNudge(item)) {
    const touchDelta = daysUntil(item.nextTouchDate);
    return {
      label: touchDelta < 0 ? 'Touch overdue' : 'Touch due today',
      tone: 'info',
      helperText: touchDelta < 0 ? 'Next touch date is in the past and should be updated now.' : 'Run the next touch action to keep this record moving.',
      tag: 'touch_due',
    };
  }

  return {
    label: 'Waiting cleanly',
    tone: 'default',
    helperText: 'No blockers detected; continue with the planned next move.',
    tag: 'waiting_clean',
  };
}
