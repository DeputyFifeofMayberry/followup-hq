import { addDaysIso, applyLifecycleBundle, buildTouchEvent, createId, todayIso } from '../../../lib/utils';
import type { FollowUpItem, FollowUpStatus } from '../../../types';

export type FollowUpExecutionActionId =
  | 'log_touch'
  | 'mark_nudged'
  | 'confirm_sent'
  | 'snooze'
  | 'mark_waiting_external'
  | 'reply_received'
  | 'close'
  | 'reopen'
  | 'escalate';

export type FollowUpExecutionDraft = {
  note?: string;
  waitingOn?: string;
  nextTouchDate?: string;
  snoozedUntilDate?: string;
  override?: boolean;
};

const toIsoStartOfDay = (value: string) => new Date(`${value}T00:00:00`).toISOString();

export function getDefaultExecutionDraft(item: FollowUpItem, action: FollowUpExecutionActionId): FollowUpExecutionDraft {
  if (action === 'mark_waiting_external') {
    return {
      waitingOn: item.waitingOn || item.owner,
      nextTouchDate: (item.nextTouchDate || addDaysIso(todayIso(), item.cadenceDays || 3)).slice(0, 10),
    };
  }
  if (action === 'snooze') {
    return {
      snoozedUntilDate: addDaysIso(todayIso(), item.cadenceDays || 3).slice(0, 10),
    };
  }
  if (action === 'close') return { note: item.completionNote || '' };
  if (action === 'reopen') return { note: '' };
  if (action === 'reply_received') return { note: '' };
  if (action === 'confirm_sent') return { note: '' };
  if (action === 'escalate') return { note: '' };
  return {};
}

export function buildExecutionPatch(item: FollowUpItem, action: FollowUpExecutionActionId, draft: FollowUpExecutionDraft): {
  targetStatus?: FollowUpStatus;
  patch: Partial<FollowUpItem>;
  override?: boolean;
} {
  if (action === 'mark_waiting_external') {
    return {
      targetStatus: 'Waiting on external',
      patch: {
        ...applyLifecycleBundle(item, 'waiting_on_response'),
        waitingOn: draft.waitingOn?.trim() || undefined,
        nextTouchDate: draft.nextTouchDate ? toIsoStartOfDay(draft.nextTouchDate) : undefined,
      },
    };
  }

  if (action === 'snooze') {
    const iso = draft.snoozedUntilDate ? toIsoStartOfDay(draft.snoozedUntilDate) : undefined;
    return {
      targetStatus: 'Waiting internal',
      patch: {
        nextTouchDate: iso,
        snoozedUntilDate: iso,
        lastActionAt: todayIso(),
        lastCompletedAction: `Snoozed until ${draft.snoozedUntilDate || 'next touch date'}`,
        timeline: [buildTouchEvent(`Snoozed until ${draft.snoozedUntilDate || 'next touch date'}.`, 'snoozed'), ...item.timeline],
      },
    };
  }

  if (action === 'reply_received') {
    return {
      targetStatus: 'In progress',
      patch: {
        ...applyLifecycleBundle(item, 'reply_received'),
        notes: draft.note?.trim() ? `${item.notes}\n\nReply received: ${draft.note.trim()}`.trim() : item.notes,
      },
    };
  }

  if (action === 'close') {
    return {
      targetStatus: 'Closed',
      patch: {
        ...applyLifecycleBundle(item, 'resolve_and_close'),
        completionNote: draft.note?.trim() || item.completionNote,
      },
      override: !!draft.override,
    };
  }

  if (action === 'reopen') {
    return {
      targetStatus: 'Needs action',
      patch: {
        ...applyLifecycleBundle(item, 'reopen'),
        completionNote: undefined,
        notes: draft.note?.trim() ? `${item.notes}\n\nReopen reason: ${draft.note.trim()}`.trim() : item.notes,
      },
    };
  }

  if (action === 'escalate') {
    return {
      targetStatus: 'At risk',
      patch: {
        ...applyLifecycleBundle(item, 'escalate'),
        status: 'At risk',
        escalationLevel: 'Critical',
        notes: draft.note?.trim() ? `${item.notes}\n\nEscalation note: ${draft.note.trim()}`.trim() : item.notes,
      },
    };
  }

  if (action === 'confirm_sent') {
    return {
      targetStatus: 'Waiting on external',
      patch: {
        ...applyLifecycleBundle(item, 'sent_follow_up'),
        actionReceipts: [{ id: createId('ACT'), at: todayIso(), actor: 'Current user', action: 'send_confirmed', confirmed: true, notes: draft.note?.trim() || undefined }, ...(item.actionReceipts || [])],
      },
    };
  }

  return { patch: {} };
}
