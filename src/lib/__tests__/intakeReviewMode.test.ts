import { queueActionOpensFullReview, shouldResetFullReviewOnSelectionChange } from '../intakeReviewMode';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(queueActionOpensFullReview('open'), 'open action should enter full review mode');
assert(!queueActionOpensFullReview('quick_create_followup'), 'quick create follow-up should keep triage mode');
assert(!queueActionOpensFullReview('quick_create_task'), 'quick create task should keep triage mode');
assert(!queueActionOpensFullReview('quick_save_reference'), 'quick save reference should keep triage mode');
assert(!queueActionOpensFullReview('review_link'), 'review_link lane jump should keep triage mode until reviewer opens full review');

assert(
  shouldResetFullReviewOnSelectionChange({ previousSelectionId: 'a', nextSelectionId: 'b', fullReviewOpen: true }),
  'full review should reset when selection changes while modal is open',
);
assert(
  !shouldResetFullReviewOnSelectionChange({ previousSelectionId: 'a', nextSelectionId: 'a', fullReviewOpen: true }),
  'full review should stay open when selection does not change',
);
assert(
  !shouldResetFullReviewOnSelectionChange({ previousSelectionId: 'a', nextSelectionId: 'b', fullReviewOpen: false }),
  'full review reset should be a no-op when modal is already closed',
);

console.log('intake review mode checks passed');
