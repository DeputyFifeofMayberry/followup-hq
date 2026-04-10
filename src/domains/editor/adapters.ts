import { buildSmartFollowUpDefaults, buildSmartTaskDefaults } from '../../lib/dataEntryDefaults';
import { buildItemFromForm, todayIso } from '../../lib/utils';
import type { FollowUpFormInput, FollowUpItem, TaskFormInput, TaskItem } from '../../types';
import type { RecordTypeEditorAdapter } from './types';
import { normalizeIdentity } from '../../lib/entities';

export type FollowUpSavePayload = { action: 'create' | 'update'; record: FollowUpItem; recordId?: string };
export type TaskSavePayload = { action: 'create' | 'update'; record: TaskItem; recordId?: string };

export const followUpEditorAdapter: RecordTypeEditorAdapter<FollowUpItem, FollowUpFormInput, FollowUpSavePayload> = {
  key: 'followup-editor',
  recordType: 'followup',
  label: 'Follow-up',
  sections: [
    { key: 'identity', label: 'Core identity' },
    { key: 'execution', label: 'Execution state' },
    { key: 'workflow', label: 'Workflow context' },
    { key: 'relationships', label: 'Relationship / linkage' },
    { key: 'detail', label: 'Notes / detail' },
  ],
  fields: [
    { key: 'title', label: 'Title', required: true, sectionKey: 'identity' },
    { key: 'project', label: 'Project', required: true, sectionKey: 'identity' },
    { key: 'owner', label: 'Owner', required: true, sectionKey: 'identity' },
    { key: 'dueDate', label: 'Due date', required: true, sectionKey: 'execution' },
    { key: 'nextAction', label: 'Next action', required: true, sectionKey: 'workflow' },
  ],
  createEmptyDraft: () => buildSmartFollowUpDefaults({ projectFilter: 'All' }),
  toDraft: (record) => ({
    title: record.title,
    source: record.source,
    project: record.project,
    projectId: record.projectId,
    owner: record.owner,
    assigneeDisplayName: record.assigneeDisplayName ?? record.owner,
    status: record.status,
    priority: record.priority,
    dueDate: record.dueDate,
    promisedDate: record.promisedDate,
    nextTouchDate: record.nextTouchDate,
    nextAction: record.nextAction,
    summary: record.summary,
    tags: record.tags,
    sourceRef: record.sourceRef,
    waitingOn: record.waitingOn,
    notes: record.notes,
    completionNote: record.completionNote,
    category: record.category,
    owesNextAction: record.owesNextAction,
    escalationLevel: record.escalationLevel,
    cadenceDays: record.cadenceDays,
    contactId: record.contactId,
    companyId: record.companyId,
    threadKey: record.threadKey,
    draftFollowUp: record.draftFollowUp,
    actionState: record.actionState,
    actionReceipts: record.actionReceipts,
    needsCleanup: record.needsCleanup,
    cleanupReasons: record.cleanupReasons,
    recommendedAction: record.recommendedAction,
    lastCompletedAction: record.lastCompletedAction,
    lastActionAt: record.lastActionAt,
  }),
  validateDraft: (draft) => {
    const issues = [] as Array<{ field: keyof FollowUpFormInput; message: string }>;
    if (!draft.title.trim()) issues.push({ field: 'title', message: 'Title is required.' });
    if (!draft.project.trim()) issues.push({ field: 'project', message: 'Project is required.' });
    if (normalizeIdentity(draft.project) === 'general') issues.push({ field: 'project', message: 'General cannot be used for live execution records.' });
    if (!draft.owner.trim()) issues.push({ field: 'owner', message: 'Owner is required.' });
    if (normalizeIdentity(draft.owner) === 'unassigned') issues.push({ field: 'owner', message: 'Unassigned cannot be used for live execution records.' });
    if (!draft.dueDate?.trim()) issues.push({ field: 'dueDate', message: 'Due date is required.' });
    if (!draft.nextAction.trim()) issues.push({ field: 'nextAction', message: 'Next action is required.' });
    if ((draft.status === 'Waiting on external' || draft.status === 'Waiting internal') && !draft.waitingOn?.trim()) {
      issues.push({ field: 'waitingOn', message: 'Waiting statuses require a waiting-on value.' });
    }
    if (!Number.isFinite(draft.cadenceDays) || draft.cadenceDays < 1 || draft.cadenceDays > 30) {
      issues.push({ field: 'cadenceDays', message: 'Cadence must be between 1 and 30 days.' });
    }
    return { valid: issues.length === 0, issues };
  },
  toSavePayload: (draft, context) => {
    const record = buildItemFromForm({ ...draft, nextAction: draft.nextAction.trim() || draft.title.trim() }, context.record ?? undefined);
    return { action: context.mode === 'create' ? 'create' : 'update', record, recordId: context.record?.id };
  },
};

export const taskEditorAdapter: RecordTypeEditorAdapter<TaskItem, TaskFormInput, TaskSavePayload> = {
  key: 'task-editor',
  recordType: 'task',
  label: 'Task',
  sections: [
    { key: 'identity', label: 'Core identity' },
    { key: 'execution', label: 'Execution state' },
    { key: 'workflow', label: 'Workflow context' },
    { key: 'relationships', label: 'Relationship / linkage' },
    { key: 'detail', label: 'Notes / detail' },
  ],
  fields: [
    { key: 'title', label: 'Title', required: true, sectionKey: 'identity' },
    { key: 'project', label: 'Project', required: true, sectionKey: 'identity' },
    { key: 'owner', label: 'Owner', required: true, sectionKey: 'identity' },
    { key: 'status', label: 'Status', required: true, sectionKey: 'execution' },
    { key: 'nextStep', label: 'Next step', required: true, sectionKey: 'workflow' },
  ],
  createEmptyDraft: () => buildSmartTaskDefaults({ projectFilter: 'All' }),
  toDraft: (record) => ({
    title: record.title,
    project: record.project,
    projectId: record.projectId,
    owner: record.owner,
    assigneeDisplayName: record.assigneeDisplayName ?? record.owner,
    status: record.status,
    priority: record.priority,
    dueDate: record.dueDate,
    startDate: record.startDate,
    startedAt: record.startedAt,
    deferredUntil: record.deferredUntil,
    nextReviewAt: record.nextReviewAt,
    summary: record.summary,
    nextStep: record.nextStep,
    notes: record.notes,
    completionNote: record.completionNote,
    tags: record.tags,
    linkedFollowUpId: record.linkedFollowUpId,
    linkedProjectContext: record.linkedProjectContext,
    contextNote: record.contextNote,
    blockReason: record.blockReason,
    completionImpact: record.completionImpact,
    contactId: record.contactId,
    companyId: record.companyId,
  }),
  validateDraft: (draft) => {
    const issues = [] as Array<{ field: keyof TaskFormInput; message: string }>;
    if (!draft.title.trim()) issues.push({ field: 'title', message: 'Title is required.' });
    if (!draft.project.trim()) issues.push({ field: 'project', message: 'Project is required.' });
    if (normalizeIdentity(draft.project) === 'general') issues.push({ field: 'project', message: 'General cannot be used for live execution records.' });
    if (!draft.owner.trim()) issues.push({ field: 'owner', message: 'Owner is required.' });
    if (normalizeIdentity(draft.owner) === 'unassigned') issues.push({ field: 'owner', message: 'Unassigned cannot be used for live execution records.' });
    if (!draft.nextStep.trim()) issues.push({ field: 'nextStep', message: 'Next step is required.' });
    if (draft.status === 'Blocked' && !draft.blockReason?.trim()) issues.push({ field: 'blockReason', message: 'Blocked tasks need a block reason.' });
    if (draft.dueDate && draft.deferredUntil && draft.deferredUntil > draft.dueDate) {
      issues.push({ field: 'deferredUntil', message: 'Deferred until cannot be later than due date.' });
    }
    return { valid: issues.length === 0, issues };
  },
  toSavePayload: (draft, context) => {
    const now = todayIso();
    const base = context.record;
    const record: TaskItem = {
      id: base?.id ?? '',
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
      assigneeDisplayName: draft.assigneeDisplayName ?? base?.assigneeDisplayName ?? base?.owner ?? draft.owner,
      ...base,
      ...draft,
      nextStep: draft.nextStep.trim() || draft.title.trim(),
    };
    return { action: context.mode === 'create' ? 'create' : 'update', record, recordId: base?.id };
  },
};
