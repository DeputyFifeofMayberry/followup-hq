import { useEffect, useMemo, useState } from 'react';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader } from '../ui/AppPrimitives';
import type { FollowUpItem } from '../../types';
import { addDaysIso, applyLifecycleBundle, todayIso } from '../../lib/utils';
import type { AppStore } from '../../store/types';
import {
  ActionRecordContext,
  BlockerPanel,
  DateInputSection,
  DestructiveConfirmation,
  InlineTextInput,
  NotesSection,
  OverridePanel,
  WarningPanel,
} from './ActionFormSections';
import type { FollowUpActionCommitResult, FollowUpActionDrafts, FollowUpActionFeedback, FollowUpActionType } from './followUpActionTypes';

interface FollowUpActionModalProps {
  item: FollowUpItem | null;
  action: FollowUpActionType | null;
  onClose: () => void;
  followUpActions: Pick<AppStore, 'attemptFollowUpTransition' | 'deleteItem' | 'updateItem'>;
  onCommitted: (feedback: FollowUpActionFeedback) => void;
}

export function FollowUpActionModal({ item, action, onClose, followUpActions, onCommitted }: FollowUpActionModalProps) {
  const [drafts, setDrafts] = useState<FollowUpActionDrafts>({
    close: { note: '' },
    waiting_on_response: { waitingOn: '', nextTouchDate: '' },
    snooze: { snoozedUntilDate: '' },
    delete: { confirmationText: '' },
  });
  const [blockers, setBlockers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overrideClose, setOverrideClose] = useState(false);
  const [overrideAllowed, setOverrideAllowed] = useState(false);

  useEffect(() => {
    if (!item || !action) return;
    setBlockers([]);
    setWarnings([]);
    setOverrideClose(false);
    setOverrideAllowed(false);
    setDrafts({
      close: { note: item.completionNote || '' },
      waiting_on_response: {
        waitingOn: item.waitingOn || item.owner,
        nextTouchDate: (item.nextTouchDate || addDaysIso(todayIso(), item.cadenceDays || 3)).slice(0, 10),
      },
      snooze: {
        snoozedUntilDate: addDaysIso(todayIso(), item.cadenceDays || 3).slice(0, 10),
      },
      delete: { confirmationText: '' },
    });
  }, [item, action]);

  const actionMeta = useMemo(() => {
    if (!action) return null;
    if (action === 'close') return { title: 'Close follow-up', confirm: overrideClose ? 'Close with override' : 'Close follow-up', subtitle: 'Mark this follow-up complete and capture closure context.' };
    if (action === 'waiting_on_response') return { title: 'Mark waiting on response', confirm: 'Mark waiting', subtitle: 'Capture who owns the next response and when you will check in.' };
    if (action === 'snooze') return { title: 'Snooze follow-up', confirm: 'Snooze', subtitle: 'Move the next review date without losing follow-up context.' };
    if (action === 'delete') return { title: 'Delete follow-up', confirm: 'Delete follow-up', subtitle: 'Permanently remove this follow-up record.' };
    return { title: 'Escalate follow-up', confirm: 'Escalate', subtitle: 'Escalate urgency for this follow-up.' };
  }, [action, overrideClose]);

  if (!item || !action || !actionMeta) return null;

  const toIsoStartOfDay = (date: string) => new Date(`${date}T00:00:00`).toISOString();

  const commit = (): FollowUpActionCommitResult => {
    if (action === 'delete') {
      if (drafts.delete.confirmationText.trim() !== 'DELETE') {
        return { feedback: { tone: 'danger', message: 'Type DELETE to confirm deletion.' } };
      }
      followUpActions.deleteItem(item.id);
      return { feedback: { tone: 'success', message: 'Follow-up deleted.' } };
    }

    if (action === 'close') {
      const patch = {
        ...applyLifecycleBundle(item, 'resolve_and_close'),
        completionNote: drafts.close.note.trim() || undefined,
        actionState: 'Complete' as const,
      };
      const attempt = followUpActions.attemptFollowUpTransition(item.id, 'Closed', patch, overrideClose ? { override: true } : undefined);
      return {
        attempt,
        feedback: {
          tone: attempt.applied ? (attempt.validation.warnings.length ? 'warn' : 'success') : 'danger',
          message: attempt.applied ? (overrideClose ? 'Follow-up closed with override acknowledgement.' : 'Follow-up closed.') : 'Follow-up close blocked.',
        },
      };
    }

    if (action === 'waiting_on_response') {
      const patch = {
        ...applyLifecycleBundle(item, 'waiting_on_response'),
        waitingOn: drafts.waiting_on_response.waitingOn.trim() || undefined,
        nextTouchDate: drafts.waiting_on_response.nextTouchDate ? toIsoStartOfDay(drafts.waiting_on_response.nextTouchDate) : undefined,
      };
      const attempt = followUpActions.attemptFollowUpTransition(item.id, 'Waiting on external', patch);
      return {
        attempt,
        feedback: {
          tone: attempt.applied ? (attempt.validation.warnings.length ? 'warn' : 'success') : 'danger',
          message: attempt.applied ? 'Follow-up marked waiting on response.' : 'Waiting action blocked.',
        },
      };
    }

    if (action === 'snooze') {
      if (!drafts.snooze.snoozedUntilDate) {
        return { feedback: { tone: 'danger', message: 'Choose a snooze date.' } };
      }
      const iso = toIsoStartOfDay(drafts.snooze.snoozedUntilDate);
      const attempt = followUpActions.attemptFollowUpTransition(item.id, 'Waiting internal', {
        nextTouchDate: iso,
        snoozedUntilDate: iso,
        lastCompletedAction: 'Snoozed',
        lastActionAt: todayIso(),
      });
      return {
        attempt,
        feedback: {
          tone: attempt.applied ? (attempt.validation.warnings.length ? 'warn' : 'success') : 'danger',
          message: attempt.applied ? 'Follow-up snoozed.' : 'Snooze blocked.',
        },
      };
    }

    followUpActions.updateItem(item.id, applyLifecycleBundle(item, 'escalate'));
    return { feedback: { tone: 'success', message: 'Escalation updated.' } };
  };

  const handleCommit = () => {
    const result = commit();
    if (!result.attempt) {
      setWarnings([]);
      setBlockers(result.feedback.tone === 'danger' ? [result.feedback.message] : []);
      if (result.feedback.tone !== 'danger') {
        onCommitted(result.feedback);
        onClose();
      }
      return;
    }

    setWarnings(result.attempt.validation.warnings);
    setBlockers(result.attempt.validation.blockers);
    setOverrideAllowed(result.attempt.validation.overrideAllowed);

    if (result.attempt.applied) {
      onCommitted(result.feedback);
      onClose();
      return;
    }
  };

  const overrideEligible = action === 'close' && overrideAllowed;
  const confirmDisabled = action === 'delete' && drafts.delete.confirmationText.trim() !== 'DELETE';

  return (
    <AppModal onBackdropClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <AppModalHeader title={actionMeta.title} subtitle={actionMeta.subtitle} onClose={onClose} />
        <AppModalBody>
          <div className="space-y-3">
            <ActionRecordContext title={item.title} status={item.status} />
            {action === 'close' ? (
              <NotesSection
                label="Completion note"
                value={drafts.close.note}
                onChange={(value) => setDrafts((current) => ({ ...current, close: { note: value } }))}
                placeholder="Record what changed and why this is complete."
              />
            ) : null}
            {action === 'waiting_on_response' ? (
              <>
                <InlineTextInput
                  label="Waiting on"
                  value={drafts.waiting_on_response.waitingOn}
                  onChange={(value) => setDrafts((current) => ({ ...current, waiting_on_response: { ...current.waiting_on_response, waitingOn: value } }))}
                  placeholder="Person or team responsible for the response"
                />
                <DateInputSection
                  label="Next touch date"
                  value={drafts.waiting_on_response.nextTouchDate}
                  onChange={(value) => setDrafts((current) => ({ ...current, waiting_on_response: { ...current.waiting_on_response, nextTouchDate: value } }))}
                />
              </>
            ) : null}
            {action === 'snooze' ? (
              <DateInputSection
                label="Snooze until"
                value={drafts.snooze.snoozedUntilDate}
                onChange={(value) => setDrafts((current) => ({ ...current, snooze: { snoozedUntilDate: value } }))}
              />
            ) : null}
            {action === 'delete' ? (
              <DestructiveConfirmation expected="DELETE" value={drafts.delete.confirmationText} onChange={(value) => setDrafts((current) => ({ ...current, delete: { confirmationText: value } }))} />
            ) : null}

            <BlockerPanel blockers={blockers} />
            <WarningPanel warnings={warnings} />
            {overrideEligible ? (
              <OverridePanel
                enabled={overrideClose}
                onToggle={setOverrideClose}
                message="I understand linked tasks remain open and still want to close this follow-up."
              />
            ) : null}
          </div>
        </AppModalBody>
        <AppModalFooter>
          <button onClick={onClose} className="action-btn">Cancel</button>
          <button onClick={handleCommit} className="primary-btn" disabled={confirmDisabled}>{actionMeta.confirm}</button>
        </AppModalFooter>
      </div>
    </AppModal>
  );
}
