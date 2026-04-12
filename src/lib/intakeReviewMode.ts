export type IntakeQueueQuickAction = 'open' | 'quick_create_followup' | 'quick_create_task' | 'quick_save_reference' | 'review_link';

export function queueActionOpensFullReview(action: IntakeQueueQuickAction) {
  return action === 'open';
}

export function shouldResetFullReviewOnSelectionChange(input: {
  previousSelectionId: string | null;
  nextSelectionId: string | null;
  fullReviewOpen: boolean;
}) {
  if (!input.fullReviewOpen) return false;
  return input.previousSelectionId !== input.nextSelectionId;
}
