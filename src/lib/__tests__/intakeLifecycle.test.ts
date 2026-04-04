import { getAllowedIntakeActions, getIntakeLifecycleGroup, normalizeForwardedCandidateStatus } from '../intakeLifecycle';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runIntakeLifecycleChecks() {
  const status = normalizeForwardedCandidateStatus('pending');
  assert(status === 'review_needed', 'pending forwarded candidate should normalize to review_needed');
  assert(getIntakeLifecycleGroup(status) === 'pending_review', 'review_needed should remain pending_review group');
  const actions = getAllowedIntakeActions(status);
  assert(actions.includes('approve_task'), 'pending review should allow approve task');
  assert(actions.includes('approve_followup'), 'pending review should allow approve follow-up');
  assert(actions.includes('link_existing'), 'pending review should allow link existing');
}

runIntakeLifecycleChecks();
