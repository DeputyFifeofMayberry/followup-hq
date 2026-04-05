import { createRecordEditorSession, updateRecordEditorDraft } from '../engine';
import { followUpEditorAdapter, taskEditorAdapter } from '../adapters';
import type { FollowUpItem, TaskItem } from '../../../types';

const followup: FollowUpItem = {
  id: 'FUP-1',
  title: 'Follow up owner decision',
  source: 'Email',
  project: 'Alpha',
  owner: 'Dana',
  status: 'Needs action',
  priority: 'High',
  dueDate: '2026-04-10',
  lastTouchDate: '2026-04-01',
  nextTouchDate: '2026-04-08',
  nextAction: 'Confirm final owner',
  summary: 'Need final owner decision',
  tags: [],
  sourceRef: 'mail://1',
  sourceRefs: [],
  mergedItemIds: [],
  notes: '',
  timeline: [],
  category: 'General',
  owesNextAction: 'Internal',
  escalationLevel: 'Watch',
  cadenceDays: 3,
};

const task: TaskItem = {
  id: 'TSK-1',
  title: 'Create draft response',
  project: 'Alpha',
  owner: 'Dana',
  status: 'To do',
  priority: 'Medium',
  summary: 'Draft response for customer',
  nextStep: 'Create first draft',
  notes: '',
  tags: [],
  createdAt: '2026-04-01',
  updatedAt: '2026-04-01',
};

const session = createRecordEditorSession({
  adapter: followUpEditorAdapter,
  recordRef: { type: 'followup', id: 'FUP-1' },
  mode: 'edit',
  record: followup,
});

if (session.dirty) throw new Error('new follow-up session should start clean');

const dirtySession = updateRecordEditorDraft(session, followUpEditorAdapter, (draft) => ({ ...draft, title: 'Follow up owner decision now' }));
if (!dirtySession.dirty || dirtySession.dirtyFieldKeys.length === 0) throw new Error('draft update should set dirty state');
if (!dirtySession.savePayload || dirtySession.savePayload.changedFieldCount !== 1) throw new Error('dirty follow-up session should expose save payload');

const invalidTaskSession = updateRecordEditorDraft(
  createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: 'TSK-1' }, mode: 'edit', record: task }),
  taskEditorAdapter,
  (draft) => ({ ...draft, status: 'Blocked' as TaskItem['status'], blockReason: '' }),
);

if (invalidTaskSession.validation.valid) throw new Error('blocked task without block reason should fail validation');
if (!invalidTaskSession.validation.issues.some((issue) => issue.field === 'blockReason')) throw new Error('validation issue should point to blockReason');

console.log('record editor engine tests passed');
