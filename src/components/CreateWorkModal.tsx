import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, getRecentWorkMode, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { createId, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpFormInput, TaskFormInput, TaskItem } from '../types';
import { EntityCombobox } from './EntityCombobox';
import { createRecordEditorSession, followUpEditorAdapter, taskEditorAdapter, updateRecordEditorDraft, type RecordEditorSession } from '../domains/editor';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, RecordEditorFooter, RecordEditorHeader, RecordEditorMetaGrid, RecordEditorSection, RecordEditorShell } from './ui/AppPrimitives';

type WorkMode = 'followup' | 'task';

type EntityOptions = {
  projectOptions: Array<{ id: string; label: string; meta?: string }>;
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

function FollowUpEditorBody({ form, setForm, entityOptions, addProject, addContact, addCompany, showFullFields }: {
  form: FollowUpFormInput;
  setForm: (next: FollowUpFormInput) => void;
  entityOptions: EntityOptions;
  addProject: (input: { name: string; owner: string; status: 'Active'; notes: string; tags: string[] }) => string;
  addContact: (input: { name: string; role: string; notes: string; tags: string[] }) => string;
  addCompany: (input: { name: string; type: 'Other'; notes: string; tags: string[] }) => string;
  showFullFields: boolean;
}) {
  return (
    <>
      <RecordEditorSection title="Core fields">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Title</label><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Project</label><EntityCombobox label="Project" valueId={form.projectId} valueLabel={form.project} options={entityOptions.projectOptions} onSelect={(option) => setForm({ ...form, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: form.owner || '', status: 'Active', notes: '', tags: [] }); setForm({ ...form, project: label, projectId: id }); }} /></div>
          <div className="field-block"><label className="field-label">Owner / assignee</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value, assigneeDisplayName: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(form.dueDate)} onChange={(e) => setForm({ ...form, dueDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Next action</label><textarea value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className="field-textarea" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      {showFullFields ? (
        <>
          <RecordEditorSection title="Execution and detail">
            <RecordEditorMetaGrid>
              <div className="field-block"><label className="field-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FollowUpFormInput['status'] })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select></div>
              <div className="field-block"><label className="field-label">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as FollowUpFormInput['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
              <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={toDateInputValue(form.nextTouchDate)} onChange={(e) => setForm({ ...form, nextTouchDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
              <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="field-textarea" /></div>
              <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field-textarea" /></div>
            </RecordEditorMetaGrid>
          </RecordEditorSection>

          <RecordEditorSection title="Relationship / linkage">
            <RecordEditorMetaGrid>
              <EntityCombobox label="External contact" valueId={form.contactId} valueLabel={entityOptions.contactOptions.find((contact) => contact.id === form.contactId)?.label} options={entityOptions.contactOptions} onSelect={(option) => setForm({ ...form, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setForm({ ...form, contactId: id }); }} />
              <EntityCombobox label="Company" valueId={form.companyId} valueLabel={entityOptions.companyOptions.find((company) => company.id === form.companyId)?.label} options={entityOptions.companyOptions} onSelect={(option) => setForm({ ...form, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setForm({ ...form, companyId: id }); }} />
            </RecordEditorMetaGrid>
          </RecordEditorSection>
        </>
      ) : null}
    </>
  );
}

function TaskEditorBody({ form, setForm, entityOptions, addProject, addContact, addCompany, showFullFields }: {
  form: TaskFormInput;
  setForm: (next: TaskFormInput) => void;
  entityOptions: EntityOptions;
  addProject: (input: { name: string; owner: string; status: 'Active'; notes: string; tags: string[] }) => string;
  addContact: (input: { name: string; role: string; notes: string; tags: string[] }) => string;
  addCompany: (input: { name: string; type: 'Other'; notes: string; tags: string[] }) => string;
  showFullFields: boolean;
}) {
  return (
    <>
      <RecordEditorSection title="Core fields">
        <RecordEditorMetaGrid>
          <div className="field-block"><label className="field-label">Title</label><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Project</label><EntityCombobox label="Project" valueId={form.projectId} valueLabel={form.project} options={entityOptions.projectOptions} onSelect={(option) => setForm({ ...form, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: form.owner || '', status: 'Active', notes: '', tags: [] }); setForm({ ...form, project: label, projectId: id }); }} /></div>
          <div className="field-block"><label className="field-label">Owner / assignee</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value, assigneeDisplayName: e.target.value })} className="field-input" /></div>
          <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(form.dueDate)} onChange={(e) => setForm({ ...form, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
          <div className="field-block field-block-span-2"><label className="field-label">Next step</label><textarea value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })} className="field-textarea" /></div>
        </RecordEditorMetaGrid>
      </RecordEditorSection>

      {showFullFields ? (
        <>
          <RecordEditorSection title="Execution and detail">
            <RecordEditorMetaGrid>
              <div className="field-block"><label className="field-label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskItem['status'] })} className="field-input"><option>To do</option><option>In progress</option><option>Blocked</option><option>Done</option></select></div>
              <div className="field-block"><label className="field-label">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
              <div className="field-block"><label className="field-label">Deferred until</label><input type="date" value={toDateInputValue(form.deferredUntil)} onChange={(e) => setForm({ ...form, deferredUntil: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
              <div className="field-block"><label className="field-label">Block reason</label><input value={form.blockReason || ''} onChange={(e) => setForm({ ...form, blockReason: e.target.value })} className="field-input" /></div>
              <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="field-textarea" /></div>
              <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="field-textarea" /></div>
            </RecordEditorMetaGrid>
          </RecordEditorSection>

          <RecordEditorSection title="Relationship / linkage">
            <RecordEditorMetaGrid>
              <EntityCombobox label="External contact" valueId={form.contactId} valueLabel={entityOptions.contactOptions.find((contact) => contact.id === form.contactId)?.label} options={entityOptions.contactOptions} onSelect={(option) => setForm({ ...form, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setForm({ ...form, contactId: id }); }} />
              <EntityCombobox label="Company" valueId={form.companyId} valueLabel={entityOptions.companyOptions.find((company) => company.id === form.companyId)?.label} options={entityOptions.companyOptions} onSelect={(option) => setForm({ ...form, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setForm({ ...form, companyId: id }); }} />
            </RecordEditorMetaGrid>
          </RecordEditorSection>
        </>
      ) : null}
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
    closeItemModal: s.closeItemModal,
    closeTaskModal: s.closeTaskModal,
  })));

  const open = itemModal.open || taskModal.open;
  const followUpEditing = itemModal.mode === 'edit';
  const taskEditing = taskModal.mode === 'edit';
  const currentItem = useMemo(() => items.find((entry) => entry.id === itemModal.itemId) ?? null, [items, itemModal.itemId]);
  const currentTask = useMemo(() => tasks.find((entry) => entry.id === taskModal.taskId) ?? null, [tasks, taskModal.taskId]);

  const [mode, setMode] = useState<WorkMode>(getRecentWorkMode());
  const [followUpSession, setFollowUpSession] = useState<RecordEditorSession<any, FollowUpFormInput, any> | null>(null);
  const [taskSession, setTaskSession] = useState<RecordEditorSession<any, TaskFormInput, any> | null>(null);
  const [showFullFields, setShowFullFields] = useState(false);

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
      setFollowUpSession(createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: currentItem.id }, mode: 'edit', record: currentItem }));
      setShowFullFields(true);
      return;
    }

    if (currentTask) {
      setMode('task');
      setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: currentTask.id }, mode: 'edit', record: currentTask }));
      setShowFullFields(true);
      return;
    }

    const { followUpSession: freshFollowUpSession, taskSession: freshTaskSession, followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);

    if (createWorkDraft) {
      const projectMatch = createWorkDraft.project
        ? projects.find((project) => project.name.toLowerCase() === createWorkDraft.project?.toLowerCase() || project.id === createWorkDraft.project)
        : undefined;

      setMode(createWorkDraft.kind);

      const followUpDraft = {
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
        priority: createWorkDraft.priority,
      };

      const taskDraft = {
        ...taskDefaults,
        title: createWorkDraft.title || taskDefaults.title,
        owner: createWorkDraft.owner || taskDefaults.owner,
        assigneeDisplayName: createWorkDraft.assigneeDisplayName || createWorkDraft.owner || taskDefaults.assigneeDisplayName,
        project: projectMatch?.name ?? createWorkDraft.project ?? taskDefaults.project,
        projectId: projectMatch?.id ?? createWorkDraft.projectId ?? taskDefaults.projectId,
        dueDate: createWorkDraft.dueDate || taskDefaults.dueDate,
        nextStep: createWorkDraft.nextStep || createWorkDraft.title || taskDefaults.nextStep,
        summary: createWorkDraft.rawText,
        priority: createWorkDraft.priority,
        linkedFollowUpId: createWorkDraft.linkedFollowUpId || taskDefaults.linkedFollowUpId,
      };

      setFollowUpSession(updateRecordEditorDraft(freshFollowUpSession, followUpEditorAdapter, () => followUpDraft));
      setTaskSession(updateRecordEditorDraft(freshTaskSession, taskEditorAdapter, () => taskDraft));
      setShowFullFields(Boolean(createWorkDraft.cleanupReasons?.length));
      return;
    }

    setMode(itemModal.open ? 'followup' : taskModal.open ? 'task' : getRecentWorkMode());
    setFollowUpSession(freshFollowUpSession);
    setTaskSession(freshTaskSession);
    setShowFullFields(false);
  }, [open, currentItem, currentTask, createWorkDraft, projectFilter, projects, itemModal.open, taskModal.open]);

  if (!open) return null;

  const close = () => {
    closeItemModal();
    closeTaskModal();
  };

  const entityOptions: EntityOptions = {
    projectOptions: projects.map((project) => ({ id: project.id, label: project.name, meta: project.owner })),
    contactOptions: contacts.map((contact) => ({ id: contact.id, label: contact.name, meta: contact.role || contact.email })),
    companyOptions: companies.map((company) => ({ id: company.id, label: company.name, meta: company.type })),
  };

  const canSave = mode === 'followup' ? Boolean(followUpSession?.validation.valid) : Boolean(taskSession?.validation.valid);

  const save = (addAnother = false) => {
    if (!canSave) return;

    if (mode === 'followup') {
      if (!followUpSession?.savePayload) return;
      const payload = followUpSession.savePayload.payload;
      rememberFollowUpDefaults(followUpSession.draft);
      if (payload.action === 'update' && payload.recordId) updateItem(payload.recordId, payload.record);
      else addItem(payload.record);
    } else {
      if (!taskSession?.savePayload) return;
      const payload = taskSession.savePayload.payload;
      rememberTaskDefaults(taskSession.draft as TaskItem);
      if (payload.action === 'update' && payload.recordId) updateTask(payload.recordId, payload.record);
      else addTask({ ...payload.record, id: payload.record.id || createId('TSK') });
    }

    if (!addAnother || followUpEditing || taskEditing) {
      close();
      return;
    }

    const { followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);
    setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => followUpDefaults) : session);
    setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => taskDefaults) : session);
    setShowFullFields(false);
  };

  return (
    <AppModal size="wide">
      <div onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          save(false);
        }
      }}>
        <AppModalHeader
          title={followUpEditing ? 'Edit full follow-up' : taskEditing ? 'Edit full task' : 'Create work item'}
          subtitle={followUpEditing || taskEditing ? 'Full edit is the deep destination for broad record changes.' : 'Choose a work type, then start with quick create fields. Open full editor fields only if needed.'}
          onClose={close}
        />
        <AppModalBody>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work type</span>
            <button onClick={() => setMode('followup')} className={mode === 'followup' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Follow-up</button>
            <button onClick={() => setMode('task')} className={mode === 'task' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Task</button>
            <button onClick={() => setShowFullFields((value) => !value)} className={showFullFields ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
              {showFullFields ? 'Hide full fields' : 'Open full editor fields'}
            </button>
          </div>

          <RecordEditorShell>
            <RecordEditorHeader
              title={mode === 'followup' ? 'Work type: Follow-up' : 'Work type: Task'}
              subtitle={showFullFields ? 'Full fields are visible for this work item.' : 'Quick fields only: title, due date, ownership, and next move.'}
            />

            {mode === 'followup' ? (
              <FollowUpEditorBody
                form={followUpForm}
                setForm={setFollowUpForm}
                entityOptions={entityOptions}
                addProject={addProject}
                addContact={addContact}
                addCompany={addCompany}
                showFullFields={showFullFields}
              />
            ) : (
              <TaskEditorBody
                form={taskForm}
                setForm={setTaskForm}
                entityOptions={entityOptions}
                addProject={addProject}
                addContact={addContact}
                addCompany={addCompany}
                showFullFields={showFullFields}
              />
            )}
          </RecordEditorShell>
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
