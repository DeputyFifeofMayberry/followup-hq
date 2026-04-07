import { buildBulkResultToast, shouldToastFollowUpPatch, shouldToastTaskPatch } from '../actionFeedback';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

(function run() {
  const full = buildBulkResultToast({ affected: 12, skipped: 0, warnings: [] }, 'Closed');
  assert(full.title === '12 follow-ups closed', 'bulk toast should summarize full success');

  const partial = buildBulkResultToast({ affected: 12, skipped: 3, warnings: ['a'] }, 'Closed');
  assert(partial.title === '12 follow-ups closed, 3 skipped', 'bulk toast should summarize partial success');
  assert(partial.tone === 'warning', 'partial success should be warning tone');

  const none = buildBulkResultToast({ affected: 0, skipped: 2, warnings: ['a'] }, 'Closed');
  assert(none.title === '2 follow-ups skipped', 'bulk toast should summarize all skipped');

  assert(shouldToastFollowUpPatch({ status: 'Closed' }), 'status change should be toast-worthy for follow-ups');
  assert(shouldToastFollowUpPatch({ dueDate: '2026-04-08' }), 'due date change should be toast-worthy for follow-ups');
  assert(!shouldToastFollowUpPatch({ draftFollowUp: 'draft' }), 'draft-only follow-up changes should be silent');

  assert(shouldToastTaskPatch({ status: 'Done' }), 'status change should be toast-worthy for tasks');
  assert(!shouldToastTaskPatch({ completionNote: 'x' }), 'minor task notes should be silent');
})();
