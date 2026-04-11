import { memo } from 'react';
import { CompletionNoteSection, DateSection, OverrideConfirmationSection, StructuredActionFlow } from '../actions/StructuredActionFlow';
import type { FollowUpExecutionActionId } from '../../domains/followups/helpers/executionActions';

export type FollowUpFlowState = { action: FollowUpExecutionActionId; itemId: string } | null;

function actionLabel(action: FollowUpExecutionActionId): string {
  if (action === 'confirm_sent') return 'Confirm outreach';
  if (action === 'snooze') return 'Snooze / defer';
  if (action === 'mark_waiting_external') return 'Mark waiting on response';
  if (action === 'reply_received') return 'Reply received';
  if (action === 'close') return 'Close follow-up';
  if (action === 'reopen') return 'Reopen follow-up';
  if (action === 'escalate') return 'Escalate at risk';
  return 'Action flow';
}

type FollowUpActionFlowProps = {
  flowState: FollowUpFlowState;
  waitingOnDraft: string;
  nextTouchDraft: string;
  snoozedUntilDraft: string;
  noteDraft: string;
  overrideClose: boolean;
  warnings: string[];
  blockers: string[];
  result: { tone: 'success' | 'warn' | 'danger'; message: string } | null;
  overrideAllowed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onWaitingOnChange: (value: string) => void;
  onNextTouchChange: (value: string) => void;
  onSnoozedUntilChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onOverrideCloseChange: (value: boolean) => void;
};

export const FollowUpActionFlow = memo(function FollowUpActionFlow({
  flowState,
  waitingOnDraft,
  nextTouchDraft,
  snoozedUntilDraft,
  noteDraft,
  overrideClose,
  warnings,
  blockers,
  result,
  overrideAllowed,
  onCancel,
  onConfirm,
  onWaitingOnChange,
  onNextTouchChange,
  onSnoozedUntilChange,
  onNoteChange,
  onOverrideCloseChange,
}: FollowUpActionFlowProps) {
  const action = flowState?.action;
  const subtitle = action === 'close'
    ? 'Capture closure context and resolve blockers before closeout.'
    : action === 'snooze'
      ? 'Set a concrete date to return this item to active execution.'
      : action === 'mark_waiting_external'
        ? 'Capture who owns the response and when you will follow up.'
        : action === 'confirm_sent'
          ? 'Confirm outreach happened and move this into waiting state.'
          : action === 'reply_received'
            ? 'Clear waiting state and move the record back into active progress.'
            : action === 'escalate'
              ? 'Escalate urgency and capture context for risk ownership.'
              : 'Move this follow-up back into active queue work.';

  return (
    <StructuredActionFlow
      open={!!flowState}
      title={action ? actionLabel(action) : 'Action flow'}
      subtitle={subtitle}
      onCancel={onCancel}
      onConfirm={onConfirm}
      warnings={warnings}
      blockers={blockers}
      result={result}
      confirmLabel="Apply"
    >
      {action === 'mark_waiting_external' ? (
        <>
          <label className="field-block">
            <span className="field-label">Waiting on</span>
            <input className="field-input" value={waitingOnDraft} onChange={(event) => onWaitingOnChange(event.target.value)} placeholder="Person or team expected to respond" />
          </label>
          <DateSection label="Next touch date" value={nextTouchDraft} onChange={onNextTouchChange} />
        </>
      ) : null}
      {action === 'snooze' ? <DateSection label="Snooze until" value={snoozedUntilDraft} onChange={onSnoozedUntilChange} /> : null}
      {action === 'close' || action === 'reply_received' || action === 'reopen' || action === 'escalate' || action === 'confirm_sent'
        ? <CompletionNoteSection value={noteDraft} onChange={onNoteChange} label={action === 'close' ? 'Completion note' : 'Context note'} />
        : null}
      {action === 'close' && overrideAllowed ? (
        <OverrideConfirmationSection
          checked={overrideClose}
          onChange={onOverrideCloseChange}
          message="I understand closeout warnings and want to close with explicit override."
        />
      ) : null}
    </StructuredActionFlow>
  );
});
