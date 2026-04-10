import { createRecordEditorSession, updateRecordEditorDraft } from '../engine';
import { followUpEditorAdapter, taskEditorAdapter } from '../adapters';
import { enforceFollowUpIntegrity, enforceTaskIntegrity } from '../../records/integrity';
import { defaultFollowUpFilters, selectFollowUpRows } from '../../../lib/followUpSelectors';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../../types';

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

const projects: ProjectRecord[] = [
  {
    id: 'P-ALPHA',
    name: 'Alpha',
    owner: 'Dana',
    status: 'Active',
    notes: '',
    tags: [],
    createdAt: '2026-04-01',
    updatedAt: '2026-04-01',
  },
];

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

const createdFollowUpPayload = followUpEditorAdapter.toSavePayload({
  ...followUpEditorAdapter.createEmptyDraft(),
  title: 'Ship permit update',
  project: 'Alpha',
  owner: 'Dana',
  dueDate: '2026-04-12',
  nextAction: 'Send permit package',
  sourceRef: '',
}, {
  mode: 'create',
  record: null,
  changedFields: ['title', 'project', 'owner', 'dueDate', 'nextAction', 'sourceRef'],
});

if (!createdFollowUpPayload.record.sourceRef.trim()) throw new Error('manual follow-up create should auto-fill sourceRef');
if (!createdFollowUpPayload.record.provenance || createdFollowUpPayload.record.provenance.sourceType !== 'quick_capture') {
  throw new Error('manual follow-up create should stamp quick-capture provenance');
}
const normalizedFollowUp = enforceFollowUpIntegrity(createdFollowUpPayload.record, projects);
if (normalizedFollowUp.lifecycleState !== 'ready') throw new Error('created follow-up should remain execution-ready after integrity enforcement');
const followUpRows = selectFollowUpRows({
  items: [normalizedFollowUp],
  contacts: [],
  companies: [],
  search: '',
  activeView: 'All',
  filters: defaultFollowUpFilters,
});
if (followUpRows.length !== 1) throw new Error('execution-ready created follow-up should appear in Follow Ups All view');

const createdTaskPayload = taskEditorAdapter.toSavePayload({
  ...taskEditorAdapter.createEmptyDraft(),
  title: 'Submit permit packet',
  project: 'Alpha',
  owner: 'Dana',
  status: 'To do',
  nextStep: 'Prepare submittal docs',
  contextNote: '',
  summary: '',
}, {
  mode: 'create',
  record: null,
  changedFields: ['title', 'project', 'owner', 'status', 'nextStep', 'contextNote', 'summary'],
});

if (!createdTaskPayload.record.provenance?.sourceRef?.trim()) throw new Error('manual task create should stamp provenance sourceRef');
const normalizedTask = enforceTaskIntegrity(createdTaskPayload.record, projects);
if (normalizedTask.lifecycleState !== 'ready') throw new Error('created task should remain execution-ready after integrity enforcement');
if ((normalizedTask.reviewReasons?.length ?? 0) > 0) throw new Error('created task should not be flagged as review-needed');

console.log('record editor engine tests passed');
