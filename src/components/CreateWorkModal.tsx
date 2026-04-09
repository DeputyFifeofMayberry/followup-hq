import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, getRecentWorkMode, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { createId, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpFormInput, FollowUpItem, TaskFormInput, TaskItem } from '../types';
import { EntityCombobox } from './EntityCombobox';
import { createRecordEditorSession, followUpEditorAdapter, taskEditorAdapter, updateRecordEditorDraft, type FollowUpSavePayload, type RecordEditorSession, type TaskSavePayload } from '../domains/editor';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, RecordEditorFooter, RecordEditorHeader, RecordEditorMetaGrid, RecordEditorSection, RecordEditorShell, SegmentedControl } from './ui/AppPrimitives';

type WorkMode = 'followup' | 'task';

type EntityOptions = {
  projectOptions: Array<{ id: string; label: string }>;
  contactOptions: Array<{ id: string; label: string; meta?: string }>;
  companyOptions: Array<{ id: string; label: string; meta?: string }>;
};

function toTaskDraft(base: TaskItem): TaskItem {
  return { ...base, id: base.id || createId('TSK') };
}

function buildCreateSessions(projectFilter?: string) {
  const followUpDefaults = buildSmartFollowUpDefaults({ projectFilter });
  const taskDefaults = toTaskDraft(buildSmartTaskDefaults({ projectFilter }));

  const followUpSession = updateRecordEditorDraft(
    createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: 'new-followup' }, mode: 'create', sourceSurface: 'full_editor' }),
    followUpEditorAdapter,
    () => followUpDefaults,
  );
  const taskSession = updateRecordEditorDraft(
    createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: 'new-task' }, mode: 'create', sourceSurface: 'full_editor' }),
    taskEditorAdapter,
    () => taskDefaults,
  );

  return { followUpSession, taskSession, followUpDefaults, taskDefaults };
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function formatTags(tags: string[]) {
  return tags.join(', ');
}

function CompletionPill({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className={complete ? 'create-work-check-item create-work-check-item-complete' : 'create-work-check-item'}>
      {complete ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}

function FollowUpEditorBody({
  form,
  setForm,
  entityOptions,
  addProject,
  addContact,
  addCompany,
}: {
  form: FollowUpFormInput;
  setForm: (next: FollowUpFormInput) => void;
  entityOptions: EntityOptions;
  addProject: (input: { name: string; owner: string; status: 'Active'; notes: string; tags: string[] }) => string;
  addContact: (input: { name: string; role: string; notes: string; tags: string[] }) => string;
  addCompany: (input: { name: string; type: 'Other'; notes: string; tags: string[] }) => string;
}) {
  return (
    <>
      <RecordEditorSection title="Required to save" subtitle="These fields drive ownership and daily follow-through.">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Title *</label><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" placeholder="What needs to happen?" /></div>
          <EntityCombobox label="Project *" valueId={form.projectId} valueLabel={form.project} options={entityOptions.projectOptions} placeholder="Select or create project" hideMeta onSelect={(option) => setForm({ ...form, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: form.owner || '', status: 'Active', notes: '', tags: [] }); setForm({ ...form, project: label, projectId: id }); }} />
          <div className="field-block"><label className="field-label">Owner / assignee *</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value, assigneeDisplayName: e.target.value })} className="field-input" placeholder="Who is accountable?" /></div>
          <div className="field-block"><label className="field-label">Due date *</label><input type="date" value={toDateInputValue(form.dueDate)} onChange={(e) => setForm({ ...form, dueDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Next move *</label><textarea value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className="field-textarea" placeholder="Explicit next step to move this forward" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      <RecordEditorSection title="Execution context" subtitle="Capture enough detail to make this usable tomorrow without rework.">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FollowUpFormInput['status'] })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select></div>
          <div className="field-block"><label className="field-label">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as FollowUpFormInput['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
          <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={toDateInputValue(form.nextTouchDate)} onChange={(e) => setForm({ ...form, nextTouchDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Promised date</label><input type="date" value={toDateInputValue(form.promisedDate)} onChange={(e) => setForm({ ...form, promisedDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FollowUpFormInput['category'] })} className="field-input"><option>General</option><option>RFI</option><option>Submittal</option><option>Procurement</option><option>Issue</option><option>Coordination</option><option>Closeout</option></select></div>
          <div className="field-block"><label className="field-label">Owes next action</label><select value={form.owesNextAction} onChange={(e) => setForm({ ...form, owesNextAction: e.target.value as FollowUpFormInput['owesNextAction'] })} className="field-input"><option>Internal</option><option>Client</option><option>Government</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Unknown</option></select></div>
          <div className="field-block"><label className="field-label">Escalation</label><select value={form.escalationLevel} onChange={(e) => setForm({ ...form, escalationLevel: e.target.value as FollowUpFormInput['escalationLevel'] })} className="field-input"><option>None</option><option>Watch</option><option>Escalate</option><option>Critical</option></select></div>
          <div className="field-block"><label className="field-label">Cadence days</label><input type="number" min={1} max={30} value={form.cadenceDays} onChange={(e) => setForm({ ...form, cadenceDays: Number(e.target.value || 1) })} className="field-input" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Waiting on</label><input value={form.waitingOn || ''} onChange={(e) => setForm({ ...form, waitingOn: e.target.value })} className="field-input" placeholder="Person/team blocking this item" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="field-textarea" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field-textarea" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      <RecordEditorSection title="Relationship / metadata" subtitle="Link context now so reporting and handoffs stay clean.">
        <RecordEditorMetaGrid>
          <EntityCombobox label="External contact" valueId={form.contactId} valueLabel={entityOptions.contactOptions.find((contact) => contact.id === form.contactId)?.label} options={entityOptions.contactOptions} onSelect={(option) => setForm({ ...form, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setForm({ ...form, contactId: id }); }} />
          <EntityCombobox label="Company" valueId={form.companyId} valueLabel={entityOptions.companyOptions.find((company) => company.id === form.companyId)?.label} options={entityOptions.companyOptions} onSelect={(option) => setForm({ ...form, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setForm({ ...form, companyId: id }); }} />
          <div className="field-block"><label className="field-label">Source</label><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as FollowUpFormInput['source'] })} className="field-input"><option>Email</option><option>Notes</option><option>To-do</option><option>Excel</option></select></div>
          <div className="field-block"><label className="field-label">Source ref</label><input value={form.sourceRef} onChange={(e) => setForm({ ...form, sourceRef: e.target.value })} className="field-input" placeholder="Message id, file, or context" /></div>
          <div className="field-block"><label className="field-label">Thread key</label><input value={form.threadKey || ''} onChange={(e) => setForm({ ...form, threadKey: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Tags</label><input value={formatTags(form.tags)} onChange={(e) => setForm({ ...form, tags: parseTags(e.target.value) })} className="field-input" placeholder="comma, separated, tags" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>
    </>
  );
}

function TaskEditorBody({
  form,
  setForm,
  entityOptions,
  linkedFollowUpOptions,
  addProject,
  addContact,
  addCompany,
}: {
  form: TaskFormInput;
  setForm: (next: TaskFormInput) => void;
  entityOptions: EntityOptions;
  linkedFollowUpOptions: Array<{ id: string; label: string }>;
  addProject: (input: { name: string; owner: string; status: 'Active'; notes: string; tags: string[] }) => string;
  addContact: (input: { name: string; role: string; notes: string; tags: string[] }) => string;
  addCompany: (input: { name: string; type: 'Other'; notes: string; tags: string[] }) => string;
}) {
  return (
    <>
      <RecordEditorSection title="Required to save" subtitle="Lean input for fast daily task entry.">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Title *</label><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" /></div>
          <EntityCombobox label="Project *" valueId={form.projectId} valueLabel={form.project} options={entityOptions.projectOptions} placeholder="Select or create project" hideMeta onSelect={(option) => setForm({ ...form, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: form.owner || '', status: 'Active', notes: '', tags: [] }); setForm({ ...form, project: label, projectId: id }); }} />
          <div className="field-block"><label className="field-label">Owner / assignee *</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value, assigneeDisplayName: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(form.dueDate)} onChange={(e) => setForm({ ...form, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Next step *</label><textarea value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })} className="field-textarea" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      <RecordEditorSection title="Execution context" subtitle="Include scheduling and dependency signals that matter for repeated use.">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskItem['status'] })} className="field-input"><option>To do</option><option>In progress</option><option>Blocked</option><option>Done</option></select></div>
          <div className="field-block"><label className="field-label">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
          <div className="field-block"><label className="field-label">Start date</label><input type="date" value={toDateInputValue(form.startDate)} onChange={(e) => setForm({ ...form, startDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Next review</label><input type="date" value={toDateInputValue(form.nextReviewAt)} onChange={(e) => setForm({ ...form, nextReviewAt: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Deferred until</label><input type="date" value={toDateInputValue(form.deferredUntil)} onChange={(e) => setForm({ ...form, deferredUntil: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Block reason</label><input value={form.blockReason || ''} onChange={(e) => setForm({ ...form, blockReason: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Completion impact</label><select value={form.completionImpact || 'none'} onChange={(e) => setForm({ ...form, completionImpact: e.target.value as TaskFormInput['completionImpact'] })} className="field-input"><option value="none">None</option><option value="advance_parent">Advance parent</option><option value="close_parent">Close parent</option></select></div>
          <div className="field-block"><label className="field-label">Tags</label><input value={formatTags(form.tags)} onChange={(e) => setForm({ ...form, tags: parseTags(e.target.value) })} className="field-input" placeholder="comma, separated, tags" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="field-textarea" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Context note</label><textarea value={form.contextNote || ''} onChange={(e) => setForm({ ...form, contextNote: e.target.value })} className="field-textarea" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field-textarea" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      <RecordEditorSection title="Relationship / linkage" subtitle="Bind task context to the execution graph.">
        <RecordEditorMetaGrid>
          <div className="field-block field-block-span-2">
            <label className="field-label">Linked follow-up</label>
            <select className="field-input" value={form.linkedFollowUpId || ''} onChange={(e) => setForm({ ...form, linkedFollowUpId: e.target.value || undefined })}>
              <option value="">None</option>
              {linkedFollowUpOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <EntityCombobox label="External contact" valueId={form.contactId} valueLabel={entityOptions.contactOptions.find((contact) => contact.id === form.contactId)?.label} options={entityOptions.contactOptions} onSelect={(option) => setForm({ ...form, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setForm({ ...form, contactId: id }); }} />
          <EntityCombobox label="Company" valueId={form.companyId} valueLabel={entityOptions.companyOptions.find((company) => company.id === form.companyId)?.label} options={entityOptions.companyOptions} onSelect={(option) => setForm({ ...form, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setForm({ ...form, companyId: id }); }} />
        </RecordEditorMetaGrid>
      </RecordEditorSection>
    </>
  );
}

export function CreateWorkModal() {
  const {
    itemModal,
    taskModal,
    createWorkDraft,
    items,
    tasks,
    projects,
    contacts,
    companies,
    projectFilter,
    addItem,
    updateItem,
    addTask,
    updateTask,
    addProject,
    addContact,
    addCompany,
    pushToast,
    closeItemModal,
    closeTaskModal,
  } = useAppStore(useShallow((s) => ({
    itemModal: s.itemModal,
    taskModal: s.taskModal,
    createWorkDraft: s.createWorkDraft,
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    projectFilter: s.projectFilter,
    addItem: s.addItem,
    updateItem: s.updateItem,
    addTask: s.addTask,
    updateTask: s.updateTask,
    addProject: s.addProject,
    addContact: s.addContact,
    addCompany: s.addCompany,
    pushToast: s.pushToast,
    closeItemModal: s.closeItemModal,
    closeTaskModal: s.closeTaskModal,
  })));

  const open = itemModal.open || taskModal.open;
  const followUpEditing = itemModal.mode === 'edit';
  const taskEditing = taskModal.mode === 'edit';
  const currentItem = useMemo(() => items.find((entry) => entry.id === itemModal.itemId) ?? null, [items, itemModal.itemId]);
  const currentTask = useMemo(() => tasks.find((entry) => entry.id === taskModal.taskId) ?? null, [tasks, taskModal.taskId]);

  const [mode, setMode] = useState<WorkMode>(getRecentWorkMode());
  const [saveAndContinue, setSaveAndContinue] = useState(true);
  const [followUpSession, setFollowUpSession] = useState<RecordEditorSession<FollowUpItem, FollowUpFormInput, FollowUpSavePayload> | null>(null);
  const [taskSession, setTaskSession] = useState<RecordEditorSession<TaskItem, TaskFormInput, TaskSavePayload> | null>(null);

  const followUpForm = followUpSession?.draft ?? buildSmartFollowUpDefaults({ projectFilter });
  const taskForm = taskSession?.draft ?? buildSmartTaskDefaults({ projectFilter });

  const setFollowUpForm = (draft: FollowUpFormInput) => setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => draft) : session);
  const setTaskForm = (draft: TaskFormInput) => setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => draft) : session);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (currentItem) {
      setMode('followup');
      setSaveAndContinue(false);
      setFollowUpSession(createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: currentItem.id }, mode: 'edit', record: currentItem }));
      return;
    }

    if (currentTask) {
      setMode('task');
      setSaveAndContinue(false);
      setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: currentTask.id }, mode: 'edit', record: currentTask }));
      return;
    }

    setSaveAndContinue(true);
    const { followUpSession: freshFollowUpSession, taskSession: freshTaskSession, followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);

    if (createWorkDraft) {
      const projectMatch = createWorkDraft.project
        ? projects.find((project) => project.name.toLowerCase() === createWorkDraft.project?.toLowerCase() || project.id === createWorkDraft.project)
        : undefined;

      setMode(createWorkDraft.kind);

      const followUpDraft: FollowUpFormInput = {
        ...followUpDefaults,
        title: createWorkDraft.title || followUpDefaults.title,
        owner: createWorkDraft.owner || followUpDefaults.owner,
        assigneeDisplayName: createWorkDraft.owner || followUpDefaults.owner,
        project: projectMatch?.name ?? createWorkDraft.project ?? followUpDefaults.project,
        projectId: projectMatch?.id ?? followUpDefaults.projectId,
        dueDate: createWorkDraft.dueDate || followUpDefaults.dueDate,
        nextTouchDate: createWorkDraft.dueDate || followUpDefaults.nextTouchDate,
        nextAction: createWorkDraft.nextAction || createWorkDraft.waitingOn || followUpDefaults.nextAction,
        waitingOn: createWorkDraft.waitingOn || followUpDefaults.waitingOn,
        summary: createWorkDraft.rawText || followUpDefaults.summary,
        notes: createWorkDraft.contextNote || followUpDefaults.notes,
        priority: createWorkDraft.priority,
        contactId: createWorkDraft.contactId || followUpDefaults.contactId,
        companyId: createWorkDraft.companyId || followUpDefaults.companyId,
      };

      const taskDraft: TaskFormInput = {
        ...taskDefaults,
        title: createWorkDraft.title || taskDefaults.title,
        owner: createWorkDraft.owner || taskDefaults.owner,
        assigneeDisplayName: createWorkDraft.assigneeDisplayName || createWorkDraft.owner || taskDefaults.assigneeDisplayName,
        project: projectMatch?.name ?? createWorkDraft.project ?? taskDefaults.project,
        projectId: projectMatch?.id ?? createWorkDraft.projectId ?? taskDefaults.projectId,
        dueDate: createWorkDraft.dueDate || taskDefaults.dueDate,
        nextStep: createWorkDraft.nextStep || createWorkDraft.title || taskDefaults.nextStep,
        summary: createWorkDraft.rawText,
        contextNote: createWorkDraft.contextNote,
        priority: createWorkDraft.priority,
        linkedFollowUpId: createWorkDraft.linkedFollowUpId || taskDefaults.linkedFollowUpId,
        contactId: createWorkDraft.contactId || taskDefaults.contactId,
        companyId: createWorkDraft.companyId || taskDefaults.companyId,
      };

      setFollowUpSession(updateRecordEditorDraft(freshFollowUpSession, followUpEditorAdapter, () => followUpDraft));
      setTaskSession(updateRecordEditorDraft(freshTaskSession, taskEditorAdapter, () => taskDraft));
      return;
    }

    setMode(itemModal.open ? 'followup' : taskModal.open ? 'task' : getRecentWorkMode());
    setFollowUpSession(freshFollowUpSession);
    setTaskSession(freshTaskSession);
  }, [open, currentItem, currentTask, createWorkDraft, projectFilter, projects, itemModal.open, taskModal.open]);

  if (!open) return null;

  const close = () => {
    closeItemModal();
    closeTaskModal();
  };

  const entityOptions: EntityOptions = {
    projectOptions: projects.map((project) => ({ id: project.id, label: project.name })),
    contactOptions: contacts.map((contact) => ({ id: contact.id, label: contact.name, meta: contact.role || contact.email })),
    companyOptions: companies.map((company) => ({ id: company.id, label: company.name, meta: company.type })),
  };

  const canSave = mode === 'followup' ? Boolean(followUpSession?.validation.valid) : Boolean(taskSession?.validation.valid);
  const validationIssues = mode === 'followup' ? (followUpSession?.validation.issues ?? []) : (taskSession?.validation.issues ?? []);
  const dirty = mode === 'followup' ? Boolean(followUpSession?.dirty) : Boolean(taskSession?.dirty);

  const requiredChecklist = mode === 'followup'
    ? [
      { label: 'Title', done: Boolean(followUpForm.title.trim()) },
      { label: 'Project', done: Boolean(followUpForm.project.trim()) },
      { label: 'Owner', done: Boolean(followUpForm.owner.trim()) },
      { label: 'Due date', done: Boolean(followUpForm.dueDate) },
      { label: 'Next move', done: Boolean(followUpForm.nextAction.trim()) },
    ]
    : [
      { label: 'Title', done: Boolean(taskForm.title.trim()) },
      { label: 'Project', done: Boolean(taskForm.project.trim()) },
      { label: 'Owner', done: Boolean(taskForm.owner.trim()) },
      { label: 'Next step', done: Boolean(taskForm.nextStep.trim()) },
    ];

  const completedCount = requiredChecklist.filter((item) => item.done).length;

  const save = (forceAddAnother?: boolean) => {
    if (!canSave) return;

    if (mode === 'followup') {
      if (!followUpSession?.savePayload) return;
      const payload = followUpSession.savePayload.payload;
      rememberFollowUpDefaults(followUpSession.draft);
      if (payload.action === 'update' && payload.recordId) updateItem(payload.recordId, payload.record);
      else addItem(payload.record);
      pushToast({ tone: 'success', title: payload.action === 'update' ? 'Follow-up updated' : 'Follow-up created', message: `Saved "${payload.record.title}" with full execution context.`, recordType: 'followup', recordIds: [payload.record.id] });
    } else {
      if (!taskSession?.savePayload) return;
      const payload = taskSession.savePayload.payload;
      rememberTaskDefaults(taskSession.draft as TaskItem);
      const taskId = payload.record.id || createId('TSK');
      if (payload.action === 'update' && payload.recordId) updateTask(payload.recordId, payload.record);
      else addTask({ ...payload.record, id: taskId });
      pushToast({ tone: 'success', title: payload.action === 'update' ? 'Task updated' : 'Task created', message: `Saved "${payload.record.title}" and kept workflow metadata attached.`, recordType: 'task', recordIds: [taskId] });
    }

    const shouldAddAnother = forceAddAnother ?? (saveAndContinue && !(followUpEditing || taskEditing));
    if (!shouldAddAnother) {
      close();
      return;
    }

    const { followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);
    setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => followUpDefaults) : session);
    setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => taskDefaults) : session);
  };

  const linkedFollowUpOptions = items
    .filter((item) => !taskEditing || item.id !== taskModal.taskId)
    .slice(0, 200)
    .map((item) => ({ id: item.id, label: `${item.title} · ${item.project}` }));

  return (
    <AppModal size="wide" ariaLabel="Create or edit work item">
      <div className="flex h-full min-h-0 flex-col" onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          save(false);
        }
      }}>
        <AppModalHeader
          title={followUpEditing ? 'Edit follow-up' : taskEditing ? 'Edit task' : 'Create work item'}
          subtitle={followUpEditing || taskEditing ? 'Update details and save changes.' : 'Capture complete execution context once, then save with confidence.'}
          onClose={close}
        />
        <AppModalBody>
          <div className="create-work-controls">
            <div className="create-work-controls-group">
              <label className="create-work-controls-label" id="create-work-type-label">Work type</label>
              <SegmentedControl
                value={mode}
                onChange={setMode}
                ariaLabel="Work type selector"
                className="create-work-segmented"
                options={[
                  { value: 'followup', label: 'Follow-up' },
                  { value: 'task', label: 'Task' },
                ]}
              />
            </div>
            {!(followUpEditing || taskEditing) ? (
              <label className="create-work-toggle">
                <input type="checkbox" checked={saveAndContinue} onChange={(event) => setSaveAndContinue(event.target.checked)} />
                <span>Keep modal open and start another after save</span>
              </label>
            ) : null}
          </div>

          <div className="create-work-layout">
            <RecordEditorShell>
              <RecordEditorHeader
                title={mode === 'followup' ? 'Follow-up details' : 'Task details'}
                subtitle="Required fields are marked with *; optional context makes recurring daily use faster and safer."
                badge={<span className={dirty ? 'workspace-meta-pill workspace-meta-pill-warn' : 'workspace-meta-pill'}>{dirty ? 'Unsaved changes' : 'No changes'}</span>}
              />

              {validationIssues.length > 0 ? (
                <div className="create-work-alert" role="alert">
                  <div className="font-semibold">Please resolve before saving:</div>
                  <ul className="mt-1 list-disc pl-4">
                    {validationIssues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
                  </ul>
                </div>
              ) : null}

              {mode === 'followup' ? (
                <FollowUpEditorBody
                  form={followUpForm}
                  setForm={setFollowUpForm}
                  entityOptions={entityOptions}
                  addProject={addProject}
                  addContact={addContact}
                  addCompany={addCompany}
                />
              ) : (
                <TaskEditorBody
                  form={taskForm}
                  setForm={setTaskForm}
                  entityOptions={entityOptions}
                  linkedFollowUpOptions={linkedFollowUpOptions}
                  addProject={addProject}
                  addContact={addContact}
                  addCompany={addCompany}
                />
              )}
            </RecordEditorShell>

            <aside className="create-work-sidebar">
              <div className="create-work-sidebar-card">
                <div className="create-work-sidebar-title">Save confidence</div>
                <p className="create-work-sidebar-copy">{completedCount}/{requiredChecklist.length} required fields complete</p>
                <div className="create-work-checklist">
                  {requiredChecklist.map((item) => <CompletionPill key={item.label} complete={item.done} label={item.label} />)}
                </div>
              </div>
              <div className="create-work-sidebar-card">
                <div className="create-work-sidebar-title">Daily-driver tips</div>
                <ul className="create-work-tip-list">
                  <li><Sparkles size={14} /> Capture linkage (project/contact/company) now to avoid cleanup passes later.</li>
                  <li><Sparkles size={14} /> Use summary + notes to preserve decision context for tomorrow.</li>
                  <li><Sparkles size={14} /> Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to save quickly.</li>
                </ul>
              </div>
            </aside>
          </div>
        </AppModalBody>
        <AppModalFooter>
          <RecordEditorFooter>
            <button onClick={close} className="action-btn">Cancel</button>
            {!(followUpEditing || taskEditing) ? <button onClick={() => save(true)} className="action-btn">Save and create another</button> : null}
            <button onClick={() => save(false)} disabled={!canSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">
              {followUpEditing || taskEditing ? 'Save changes' : 'Save work item'}
            </button>
          </RecordEditorFooter>
        </AppModalFooter>
      </div>
    </AppModal>
  );
}
