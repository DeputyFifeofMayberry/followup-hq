import type { FollowUpItem } from '../../../types';
import type { FollowUpAttentionSignal } from './attentionSignal';

export type FollowUpNextMoveTone = 'default' | 'info' | 'warn' | 'danger' | 'success';

export interface FollowUpNextMove {
  label: string;
  reason: string;
  tone: FollowUpNextMoveTone;
}

interface NextMoveContext {
  hasDuplicateAttention: boolean;
  linkedTaskBlocked: boolean;
  readyToClose: boolean;
  attentionSignal: FollowUpAttentionSignal;
}

export function deriveFollowUpNextMove(item: FollowUpItem, context: NextMoveContext): FollowUpNextMove {
  if (context.hasDuplicateAttention) {
    return {
      label: 'Resolve duplicate before drafting',
      reason: 'Possible duplicate records need review before outbound updates.',
      tone: 'warn',
    };
  }

  if (context.linkedTaskBlocked) {
    return {
      label: 'Create or unblock linked task first',
      reason: 'Linked work is blocked or overdue and is holding follow-through.',
      tone: 'danger',
    };
  }

  if (context.readyToClose) {
    return {
      label: 'Close after completion note',
      reason: 'Closeout checks are ready; capture a short closure note and close.',
      tone: 'success',
    };
  }

  if (item.status === 'Needs action') {
    return {
      label: 'Draft response and set next touch',
      reason: 'Item is waiting for an outbound move to stay in motion.',
      tone: 'info',
    };
  }

  if (item.status === 'Waiting on external') {
    return {
      label: 'Log touch and wait for reply',
      reason: 'External response is pending; update touch log and timing.',
      tone: 'default',
    };
  }

  if (item.status === 'Waiting internal') {
    return {
      label: 'Snooze until promised response date',
      reason: 'Internal follow-through is parked; set a concrete check-in date.',
      tone: 'default',
    };
  }

  if (item.status === 'At risk' || context.attentionSignal.tone === 'danger') {
    return {
      label: 'Escalate now and assign owner',
      reason: 'Risk is high; confirm ownership and escalate before next touch slips.',
      tone: 'danger',
    };
  }

  return {
    label: 'Advance next action and keep cadence',
    reason: context.attentionSignal.helperText,
    tone: 'default',
  };
}
