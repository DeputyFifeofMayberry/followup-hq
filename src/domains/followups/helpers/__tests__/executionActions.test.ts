import { normalizeItem } from '../../../../lib/utils';
import { buildExecutionPatch } from '../executionActions';
import { resolveFollowUpInspectorProgression } from '../executionProgression';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const item = normalizeItem({
  id: 'fu-exec-1',
  title: 'Permit follow-up',
  source: 'Email',
  project: 'Bridge',
  owner: 'Alex',
  status: 'In progress',
  priority: 'Medium',
  dueDate: '2026-04-12',
  lastTouchDate: '2026-04-10T00:00:00.000Z',
  nextTouchDate: '2026-04-12T00:00:00.000Z',
  nextAction: 'Confirm permit response',
  summary: 'Awaiting city confirmation',
  tags: [],
  sourceRef: 'mail',
  sourceRefs: [],
  mergedItemIds: [],
  notes: '',
  timeline: [],
  category: 'Coordination',
  owesNextAction: 'Government',
  escalationLevel: 'None',
  cadenceDays: 3,
  draftFollowUp: '',
});

(function run() {
  const closePlan = buildExecutionPatch(item, 'close', { note: 'Delivered and approved.' });
  assert(closePlan.targetStatus === 'Closed', 'close should target Closed');
  assert(closePlan.patch.actionState === 'Complete', 'close should set complete action state');
  assert(closePlan.patch.completionNote === 'Delivered and approved.', 'close should preserve completion note');

  const snoozePlan = buildExecutionPatch(item, 'snooze', { snoozedUntilDate: '2026-04-20' });
  assert(snoozePlan.targetStatus === 'Waiting internal', 'snooze should move to waiting internal');
  assert(typeof snoozePlan.patch.snoozedUntilDate === 'string', 'snooze should set snoozed date');

  const waitingPlan = buildExecutionPatch(item, 'mark_waiting_external', { waitingOn: 'City inspector', nextTouchDate: '2026-04-15' });
  assert(waitingPlan.targetStatus === 'Waiting on external', 'waiting flow should set waiting external status');
  assert(waitingPlan.patch.actionState === 'Waiting for reply', 'waiting flow should update action state');

  const escalated = buildExecutionPatch(item, 'escalate', { note: 'Critical permit blocker.' });
  assert(escalated.targetStatus === 'At risk', 'escalation should move to At risk');
  assert(escalated.patch.escalationLevel === 'Critical', 'escalation should elevate escalation level');

  const keepSelection = resolveFollowUpInspectorProgression(['a', 'b'], 'a', true);
  assert(keepSelection.nextId === 'a' && keepSelection.reason === 'kept_current', 'should keep same record when still visible');

  const advancedSelection = resolveFollowUpInspectorProgression(['b', 'c'], 'a', false);
  assert(Boolean(advancedSelection.nextId) && ['b', 'c'].includes(advancedSelection.nextId || ''), 'should advance to an available queue record when current is removed');
})();
