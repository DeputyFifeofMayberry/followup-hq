import assert from 'node:assert/strict';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../types';
import {
  enforceFollowUpIntegrity,
  enforceTaskIntegrity,
  isExecutionReady,
  isReviewRecord,
  isTrustedLiveRecord,
  repairLegacyFollowUpForHydration,
  repairLegacyTaskForHydration,
} from '../../domains/records/integrity';
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

const safe = enforceFollowUpIntegrity({
  ...followUpBase,
  projectId: 'P1',
  project: 'Alpha',
  owner: 'Dana',
  sourceRef: 'manual',
  lifecycleState: 'ready',
  dataQuality: 'valid_live',
  provenance: { sourceType: 'quick_capture', sourceRef: 'manual', capturedAt: '2026-04-06' },
}, projects);
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

const repairedLegacyFollowUp = repairLegacyFollowUpForHydration({
  ...followUpBase,
  id: 'F-legacy-repair',
  projectId: 'P1',
  project: 'Alpha',
  owner: 'Dana',
  sourceRef: 'legacy-row-1',
  lifecycleState: undefined,
  dataQuality: undefined,
  provenance: undefined,
  needsCleanup: true,
}, projects);
assert.equal(repairedLegacyFollowUp.lifecycleState, 'ready');
assert.equal(repairedLegacyFollowUp.dataQuality, 'valid_live');
assert.equal(repairedLegacyFollowUp.needsCleanup, false);
assert.equal(repairedLegacyFollowUp.provenance?.sourceType, 'migration');
const normalizedRepairedFollowUp = enforceFollowUpIntegrity(repairedLegacyFollowUp, projects);
assert.ok(isTrustedLiveRecord(normalizedRepairedFollowUp));

const unrepairedLegacyFollowUp = repairLegacyFollowUpForHydration({
  ...followUpBase,
  id: 'F-legacy-unrepaired',
  projectId: 'P1',
  project: 'Alpha',
  owner: '',
  sourceRef: 'legacy-row-2',
  lifecycleState: undefined,
  dataQuality: undefined,
  provenance: undefined,
}, projects);
const normalizedUnrepairedFollowUp = enforceFollowUpIntegrity(unrepairedLegacyFollowUp, projects);
assert.equal(normalizedUnrepairedFollowUp.lifecycleState, 'review_required');
assert.ok(normalizedUnrepairedFollowUp.reviewReasons?.includes('missing_owner'));

const repairedLegacyTask = repairLegacyTaskForHydration({
  id: 'T-legacy-repair',
  title: 'Legacy task',
  projectId: 'P1',
  project: 'Alpha',
  owner: 'Dana',
  status: 'To do',
  priority: 'Medium',
  summary: 'legacy summary',
  nextStep: 'do work',
  notes: '',
  tags: [],
  createdAt: '2026-04-06',
  updatedAt: '2026-04-06',
  lifecycleState: undefined,
  dataQuality: undefined,
  provenance: undefined,
  needsCleanup: true,
}, projects);
assert.equal(repairedLegacyTask.lifecycleState, 'ready');
assert.equal(repairedLegacyTask.dataQuality, 'valid_live');
assert.equal(repairedLegacyTask.needsCleanup, false);
const normalizedRepairedTask = enforceTaskIntegrity(repairedLegacyTask, projects);
assert.ok(isTrustedLiveRecord(normalizedRepairedTask));

console.log('recordIntegrity.test.ts passed');
