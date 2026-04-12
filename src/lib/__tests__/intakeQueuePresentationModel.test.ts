import { laneDescription, recommendedActionCue, triageStateTone } from '../../components/intake/intakeWorkspaceTypes';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(laneDescription('ready_to_create').includes('safe'), 'ready lane description should explain safe-now workflow');
assert(laneDescription('link_duplicate_review').includes('existing-record'), 'link lane description should explain link verification goal');
assert(recommendedActionCue('create_new') === 'Create new work', 'recommended cue should map create actions');
assert(recommendedActionCue('save_reference') === 'Route as reference', 'recommended cue should map reference actions');

assert(triageStateTone({ readiness: 'ready_to_approve', batchSafe: true }) === 'safe', 'batch-safe ready rows should be safe tone');
assert(triageStateTone({ readiness: 'needs_link_decision', batchSafe: false }) === 'link', 'link decisions should use link tone');
assert(triageStateTone({ readiness: 'reference_likely', batchSafe: false }) === 'reference', 'reference-likely rows should use reference tone');
assert(triageStateTone({ readiness: 'unsafe_to_create', batchSafe: false }) === 'correction', 'unsafe rows should use correction tone');
