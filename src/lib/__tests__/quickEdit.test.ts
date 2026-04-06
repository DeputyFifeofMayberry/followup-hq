import assert from 'node:assert/strict';
import { applyQuickEditPatchToFollowUp, applyQuickEditPatchToTask } from '../quickEdit';
import type { FollowUpItem, TaskItem } from '../../types';

function sampleFollowUp(): FollowUpItem {
  return {
    id: 'F1',
    title: 'Original follow-up',
    source: 'Notes',
    project: 'Alpha',
    owner: 'Ari',
    status: 'Needs action',
    priority: 'Medium',
    dueDate: '2026-04-07',
    lastTouchDate: '2026-04-05',
    nextTouchDate: '2026-04-07',
    nextAction: 'Call owner',
    summary: '',
    tags: [],
    sourceRef: 'test',
    sourceRefs: [],
    mergedItemIds: [],
    notes: '',
    timeline: [],
    category: 'Coordination',
    owesNextAction: 'Unknown',
    escalationLevel: 'None',
    cadenceDays: 3,
  };
}

function sampleTask(): TaskItem {
  return {
    id: 'T1',
    title: 'Original task',
    project: 'Alpha',
    owner: 'Ari',
    status: 'To do',
    priority: 'Medium',
    summary: '',
    nextStep: 'Do the thing',
    notes: '',
    tags: [],
    createdAt: '2026-04-05',
    updatedAt: '2026-04-05',
  };
}

const followUpPatched = applyQuickEditPatchToFollowUp(sampleFollowUp(), {
  title: '  Better title ',
  dueDate: '2026-04-12',
  owner: 'Morgan',
  nextAction: 'Send revised email',
  project: 'Beta',
});

assert.equal(followUpPatched.title, 'Better title');
assert.equal(followUpPatched.owner, 'Morgan');
assert.equal(followUpPatched.assigneeDisplayName, 'Morgan');
assert.equal(followUpPatched.project, 'Beta');
assert.equal(followUpPatched.projectId, undefined);
assert.equal(followUpPatched.nextAction, 'Send revised email');
assert.equal(followUpPatched.dueDate, '2026-04-12');
assert.equal(followUpPatched.nextTouchDate, '2026-04-12');

const taskPatched = applyQuickEditPatchToTask(sampleTask(), {
  title: 'New task title',
  dueDate: '2026-05-01',
  owner: 'Taylor',
  nextStep: 'Book inspector',
  project: 'Gamma',
});

assert.equal(taskPatched.title, 'New task title');
assert.equal(taskPatched.owner, 'Taylor');
assert.equal(taskPatched.assigneeDisplayName, 'Taylor');
assert.equal(taskPatched.dueDate, '2026-05-01');
assert.equal(taskPatched.nextStep, 'Book inspector');
assert.equal(taskPatched.project, 'Gamma');
assert.equal(taskPatched.projectId, undefined);

console.log('quickEdit.test.ts passed');
