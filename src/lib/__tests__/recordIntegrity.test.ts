import assert from 'node:assert/strict';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../types';
import { enforceFollowUpIntegrity, enforceTaskIntegrity, isExecutionReady, isReviewRecord, isTrustedLiveRecord } from '../../domains/records/integrity';
import { buildUnifiedQueue } from '../unifiedQueue';

const projects: ProjectRecord[] = [
  { id: 'P1', name: 'Alpha', owner: 'Owner A', status: 'Active', notes: '', tags: [], createdAt: '2026-04-06', updatedAt: '2026-04-06' },
  { id: 'P2', name: 'Beta', owner: 'Owner B', status: 'Complete', notes: '', tags: [], createdAt: '2026-04-06', updatedAt: '2026-04-06' },
];

const followUpBase: FollowUpItem = {
  id: 'F1',
  title: 'FU',
  source: 'Notes',
  project: 'General',
  owner: 'Unassigned',
  status: 'Needs action',
  priority: 'Medium',
  dueDate: '2026-04-07',
  lastTouchDate: '2026-04-06',
  nextTouchDate: '2026-04-07',
  nextAction: 'Do it',
  summary: 'test',
  tags: [],
  sourceRef: '',
  sourceRefs: [],
  mergedItemIds: [],
  notes: '',
  timeline: [],
  category: 'Coordination',
  owesNextAction: 'Unknown',
  escalationLevel: 'None',
  cadenceDays: 3,
};

const unsafe = enforceFollowUpIntegrity(followUpBase, projects);
assert.equal(unsafe.lifecycleState, 'review_required');
assert.ok(unsafe.reviewReasons?.includes('placeholder_project'));
assert.ok(!isExecutionReady(unsafe));

const safe = enforceFollowUpIntegrity({ ...followUpBase, projectId: 'P1', project: 'Alpha', owner: 'Dana', sourceRef: 'manual' }, projects);
assert.equal(safe.lifecycleState, 'ready');
assert.equal(safe.project, 'Alpha');
assert.ok(isExecutionReady(safe));
assert.ok(!safe.reviewReasons?.length);
assert.ok(isTrustedLiveRecord(safe));

const archivedTask = enforceTaskIntegrity({
  id: 'T1',
  title: 'Task',
  projectId: 'P2',
  project: 'Beta',
  owner: 'Dana',
  status: 'To do',
  priority: 'Medium',
  summary: 'summary',
  nextStep: 'step',
  notes: '',
  tags: [],
  createdAt: '2026-04-06',
  updatedAt: '2026-04-06',
}, projects);
assert.equal(archivedTask.lifecycleState, 'review_required');
assert.ok(archivedTask.reviewReasons?.includes('archived_project'));
assert.ok(isReviewRecord(archivedTask));

const legacy = enforceFollowUpIntegrity({
  ...followUpBase,
  projectId: 'P1',
  project: 'Alpha',
  owner: 'Dana',
  sourceRef: 'legacy-import-row',
  lifecycleState: undefined,
  dataQuality: undefined,
  provenance: undefined,
}, projects);
assert.ok(legacy.reviewReasons?.includes('legacy_record_requires_cleanup'));
assert.equal(legacy.provenance?.sourceType, 'migration');
assert.ok(!isTrustedLiveRecord(legacy));

const queue = buildUnifiedQueue([unsafe, safe], [archivedTask]);
assert.equal(queue.length, 1);
assert.equal(queue[0].id, safe.id);

console.log('recordIntegrity.test.ts passed');
