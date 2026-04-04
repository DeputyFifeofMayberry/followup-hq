import type { FollowUpItem } from '../../types';
import type { WorkflowTransitionAttempt } from '../../store/types';

export type FollowUpActionType = 'close' | 'waiting_on_response' | 'snooze' | 'delete' | 'escalate';

export interface FollowUpActionFeedback {
  tone: 'success' | 'warn' | 'danger';
  message: string;
}

export interface FollowUpActionValidationState {
  blockers: string[];
  warnings: string[];
  overrideAllowed: boolean;
}

export interface FollowUpActionBaseDraft {
  note: string;
}

export interface FollowUpActionDrafts {
  close: FollowUpActionBaseDraft;
  waiting_on_response: {
    waitingOn: string;
    nextTouchDate: string;
  };
  snooze: {
    snoozedUntilDate: string;
  };
  delete: {
    confirmationText: string;
  };
}

export interface FollowUpActionRequest {
  type: FollowUpActionType;
  item: FollowUpItem;
}

export interface FollowUpActionCommitResult {
  attempt?: WorkflowTransitionAttempt;
  feedback: FollowUpActionFeedback;
}
