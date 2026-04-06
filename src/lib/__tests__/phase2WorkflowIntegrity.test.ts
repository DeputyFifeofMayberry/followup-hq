import assert from 'node:assert/strict';
import { enforceFollowUpIntegrity, enforceTaskIntegrity, getIntegrityReasonLabel, isExecutionReady } from '../../domains/records/integrity';
import { selectFollowUpRows, defaultFollowUpFilters } from '../followUpSelectors';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../types';

const projects: ProjectRecord[] = [
  { id: 'P100', name: 'Tower A', owner: 'Dana', status: 'Active', notes: '', tags: [], createdAt: '2026-04-06', updatedAt: '2026-04-06' },
];

const unsafeFollowUp = enforceFollowUpIntegrity({
  id: 'FU-unsafe',
  title: 'Needs cleanup',
  source: 'Notes',
  project: '',
  owner: '',
  status: 'Needs action',
  priority: 'Medium',
  dueDate: '2026-04-07',
  lastTouchDate: '2026-04-06',
  nextTouchDate: '2026-04-07',
  nextAction: 'Confirm owner and project',
  summary: 'raw intake',
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
}, projects);

const safeFollowUp = enforceFollowUpIntegrity({ ...unsafeFollowUp, id: 'FU-safe', project: 'Tower A', projectId: 'P100', owner: 'Dana', sourceRef: 'manual entry' }, projects);

assert.equal(isExecutionReady(unsafeFollowUp), false);
assert.equal(isExecutionReady(safeFollowUp), true);
assert.ok(unsafeFollowUp.reviewReasons?.includes('missing_project_link'));
assert.ok(getIntegrityReasonLabel('missing_project_link').includes('Select a real project'));

const defaultRows = selectFollowUpRows({
  items: [unsafeFollowUp, safeFollowUp],
  contacts: [],
  companies: [],
  search: '',
  activeView: 'All',
  filters: defaultFollowUpFilters,
});
assert.deepEqual(defaultRows.map((entry) => entry.id), ['FU-safe']);

const cleanupRows = selectFollowUpRows({
  items: [unsafeFollowUp, safeFollowUp],
  contacts: [],
  companies: [],
  search: '',
  activeView: 'All',
  filters: { ...defaultFollowUpFilters, cleanupOnly: true },
});
assert.deepEqual(cleanupRows.map((entry) => entry.id), ['FU-unsafe']);

const unsafeTask: TaskItem = enforceTaskIntegrity({
  id: 'TSK-unsafe',
  title: 'Unsafe task',
  project: '',
  owner: '',
  status: 'To do',
  priority: 'High',
  summary: 'draft only',
  nextStep: 'resolve ownership',
  notes: '',
  tags: [],
  createdAt: '2026-04-06',
  updatedAt: '2026-04-06',
}, projects);
assert.equal(isExecutionReady(unsafeTask), false);
assert.ok(unsafeTask.reviewReasons?.includes('missing_accountable_owner'));

console.log('phase2WorkflowIntegrity.test.ts passed');
