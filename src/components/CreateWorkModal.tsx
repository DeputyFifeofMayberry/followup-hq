import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, getRecentWorkMode, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { createId, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpFormInput, TaskFormInput, TaskItem } from '../types';
import { EntityCombobox } from './EntityCombobox';
import { createRecordEditorSession, followUpEditorAdapter, taskEditorAdapter, updateRecordEditorDraft, type RecordEditorSession } from '../domains/editor';
import {
  AppModal,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
  RecordEditorFooter,
  RecordEditorHeader,
  RecordEditorMetaGrid,
  RecordEditorSection,
  RecordEditorShell,
} from './ui/AppPrimitives';

type WorkMode = 'followup' | 'task';

function toTaskDraft(base: TaskItem): TaskItem {
  return { ...base, id: base.id || createId('TSK') };
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
  const [modalMode, setModalMode] = useState<'fast' | 'full'>('fast');

  const followUpForm = followUpSession?.draft ?? buildSmartFollowUpDefaults({ projectFilter });
  const taskForm = taskSession?.draft ?? buildSmartTaskDefaults({ projectFilter });
  const setFollowUpForm = (draft: FollowUpFormInput) => {
    setFollowUpSession((session) => {
      if (!session) return session;
      return updateRecordEditorDraft(session, followUpEditorAdapter, () => draft);
    });
  };
  const setTaskForm = (draft: TaskFormInput) => {
    setTaskSession((session) => {
      if (!session) return session;
      return updateRecordEditorDraft(session, taskEditorAdapter, () => draft);
    });
  };

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
      setModalMode('full');
      return;
    }
    if (currentTask) {
      setMode('task');
      setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: currentTask.id }, mode: 'edit', record: currentTask }));
      setModalMode('full');
      return;
    }

    const defaultFollowUp = buildSmartFollowUpDefaults({ projectFilter });
    const defaultTask = toTaskDraft(buildSmartTaskDefaults({ projectFilter }));
    if (createWorkDraft) {
      const projectMatch = createWorkDraft.project
        ? projects.find((project) => project.name.toLowerCase() === createWorkDraft.project?.toLowerCase() || project.id === createWorkDraft.project)
        : undefined;
      setMode(createWorkDraft.kind);
      const followUpDraft = {
        ...defaultFollowUp,
        title: createWorkDraft.title || defaultFollowUp.title,
        owner: createWorkDraft.owner || defaultFollowUp.owner,
        assigneeDisplayName: createWorkDraft.owner || defaultFollowUp.owner,
        project: projectMatch?.name ?? createWorkDraft.project ?? defaultFollowUp.project,
        projectId: projectMatch?.id ?? defaultFollowUp.projectId,
        dueDate: createWorkDraft.dueDate || defaultFollowUp.dueDate,
        nextTouchDate: createWorkDraft.dueDate || defaultFollowUp.nextTouchDate,
        nextAction: createWorkDraft.nextAction || createWorkDraft.waitingOn || defaultFollowUp.nextAction,
        waitingOn: createWorkDraft.waitingOn || defaultFollowUp.waitingOn,
        summary: createWorkDraft.rawText || defaultFollowUp.summary,
        priority: createWorkDraft.priority,
      };
      const taskDraft = {
        ...defaultTask,
        title: createWorkDraft.title || defaultTask.title,
        owner: createWorkDraft.owner || defaultTask.owner,
        assigneeDisplayName: createWorkDraft.assigneeDisplayName || createWorkDraft.owner || defaultTask.assigneeDisplayName,
        project: projectMatch?.name ?? createWorkDraft.project ?? defaultTask.project,
        projectId: projectMatch?.id ?? createWorkDraft.projectId ?? defaultTask.projectId,
        dueDate: createWorkDraft.dueDate || defaultTask.dueDate,
        nextStep: createWorkDraft.nextStep || createWorkDraft.title || defaultTask.nextStep,
        summary: createWorkDraft.rawText,
        priority: createWorkDraft.priority,
        linkedFollowUpId: createWorkDraft.linkedFollowUpId || defaultTask.linkedFollowUpId,
        contextNote: createWorkDraft.contextNote || defaultTask.contextNote,
        companyId: createWorkDraft.companyId || defaultTask.companyId,
        contactId: createWorkDraft.contactId || defaultTask.contactId,
      };
      setFollowUpSession(createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: 'new-followup' }, mode: 'create', sourceSurface: 'capture' }));
      setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: 'new-task' }, mode: 'create', sourceSurface: 'capture' }));
      setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => followUpDraft) : session);
      setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => taskDraft) : session);
      setModalMode(createWorkDraft.cleanupReasons?.length ? 'full' : 'fast');
      return;
    }
    setMode(itemModal.open ? 'followup' : taskModal.open ? 'task' : getRecentWorkMode());
    setFollowUpSession(createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: 'new-followup' }, mode: 'create', sourceSurface: 'full_editor' }));
    setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: 'new-task' }, mode: 'create', sourceSurface: 'full_editor' }));
    setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => defaultFollowUp) : session);
    setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => defaultTask) : session);
    setModalMode('fast');
  }, [open, currentItem, currentTask, createWorkDraft, projectFilter, projects, itemModal.open, taskModal.open]);

  if (!open) return null;

  const close = () => {
    closeItemModal();
    closeTaskModal();
  };

  const projectOptions = projects.map((project) => ({ id: project.id, label: project.name, meta: project.owner }));
  const contactOptions = contacts.map((contact) => ({ id: contact.id, label: contact.name, meta: contact.role || contact.email }));
  const companyOptions = companies.map((company) => ({ id: company.id, label: company.name, meta: company.type }));

  const canSave = mode === 'followup'
    ? Boolean(followUpSession?.validation.valid)
    : Boolean(taskSession?.validation.valid);

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

    const defaultFollowUp = buildSmartFollowUpDefaults({ projectFilter });
    const defaultTask = toTaskDraft(buildSmartTaskDefaults({ projectFilter }));
    setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => defaultFollowUp) : session);
    setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => defaultTask) : session);
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
          title={followUpEditing ? 'Edit full follow-up' : taskEditing ? 'Edit full task' : 'Create work'}
          subtitle={followUpEditing || taskEditing ? 'Canonical full-record editor for deep editing.' : 'Fast mode for speed, full mode for cleanup/editing.'}
          onClose={close}
        />
        <AppModalBody>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setMode('followup')} className={mode === 'followup' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Follow-up</button>
            <button onClick={() => setMode('task')} className={mode === 'task' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Task</button>
            <button onClick={() => setModalMode('fast')} className={modalMode === 'fast' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Fast mode</button>
            <button onClick={() => setModalMode('full')} className={modalMode === 'full' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Full mode</button>
          </div>

          <RecordEditorShell>
            <RecordEditorHeader
              title={mode === 'followup' ? 'Follow-up record editor' : 'Task record editor'}
              subtitle="Shared grammar: core identity, execution state, workflow context, relationship linkage, notes/detail, maintenance."
            />

            {mode === 'followup' ? (
              <>
                <RecordEditorSection title="1. Core identity">
                  <RecordEditorMetaGrid>
                    <div className="field-block"><label className="field-label">Title</label><input autoFocus value={followUpForm.title} onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Project</label><EntityCombobox label="Project" valueId={followUpForm.projectId} valueLabel={followUpForm.project} options={projectOptions} onSelect={(option) => setFollowUpForm({ ...followUpForm, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: followUpForm.owner || 'Unassigned', status: 'Active', notes: '', tags: [] }); setFollowUpForm({ ...followUpForm, project: label, projectId: id }); }} /></div>
                    <div className="field-block"><label className="field-label">Internal owner</label><input value={followUpForm.owner} onChange={(e) => setFollowUpForm({ ...followUpForm, owner: e.target.value })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Assignee</label><input value={followUpForm.assigneeDisplayName || ''} onChange={(e) => setFollowUpForm({ ...followUpForm, assigneeDisplayName: e.target.value })} className="field-input" /></div>
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="2. Execution state">
                  <RecordEditorMetaGrid>
                    <div className="field-block"><label className="field-label">Status</label><select value={followUpForm.status} onChange={(e) => setFollowUpForm({ ...followUpForm, status: e.target.value as FollowUpFormInput['status'] })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select></div>
                    <div className="field-block"><label className="field-label">Priority</label><select value={followUpForm.priority} onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value as FollowUpFormInput['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
                    <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(followUpForm.dueDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={toDateInputValue(followUpForm.nextTouchDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, nextTouchDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="3. Workflow context">
                  <RecordEditorMetaGrid>
                    <div className="field-block field-block-span-2"><label className="field-label">Next action</label><textarea value={followUpForm.nextAction} onChange={(e) => setFollowUpForm({ ...followUpForm, nextAction: e.target.value })} className="field-textarea" /></div>
                    {modalMode === 'full' ? <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={followUpForm.summary} onChange={(e) => setFollowUpForm({ ...followUpForm, summary: e.target.value })} className="field-textarea" /></div> : null}
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="4. Relationship / linkage">
                  <RecordEditorMetaGrid>
                    <EntityCombobox label="External contact" valueId={followUpForm.contactId} valueLabel={contacts.find((contact) => contact.id === followUpForm.contactId)?.name} options={contactOptions} onSelect={(option) => setFollowUpForm({ ...followUpForm, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setFollowUpForm({ ...followUpForm, contactId: id }); }} />
                    <EntityCombobox label="Company" valueId={followUpForm.companyId} valueLabel={companies.find((company) => company.id === followUpForm.companyId)?.name} options={companyOptions} onSelect={(option) => setFollowUpForm({ ...followUpForm, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setFollowUpForm({ ...followUpForm, companyId: id }); }} />
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                {modalMode === 'full' ? (
                  <RecordEditorSection title="5. Notes / detail">
                    <RecordEditorMetaGrid>
                      <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={followUpForm.notes} onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })} className="field-textarea" /></div>
                    </RecordEditorMetaGrid>
                  </RecordEditorSection>
                ) : null}
              </>
            ) : (
              <>
                <RecordEditorSection title="1. Core identity">
                  <RecordEditorMetaGrid>
                    <div className="field-block"><label className="field-label">Title</label><input autoFocus value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Project</label><EntityCombobox label="Project" valueId={taskForm.projectId} valueLabel={taskForm.project} options={projectOptions} onSelect={(option) => setTaskForm({ ...taskForm, project: option.label, projectId: option.id })} onCreate={(label) => { const id = addProject({ name: label, owner: taskForm.owner || 'Unassigned', status: 'Active', notes: '', tags: [] }); setTaskForm({ ...taskForm, project: label, projectId: id }); }} /></div>
                    <div className="field-block"><label className="field-label">Internal owner</label><input value={taskForm.owner} onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Assignee</label><input value={taskForm.assigneeDisplayName || ''} onChange={(e) => setTaskForm({ ...taskForm, assigneeDisplayName: e.target.value })} className="field-input" /></div>
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="2. Execution state">
                  <RecordEditorMetaGrid>
                    <div className="field-block"><label className="field-label">Status</label><select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskItem['status'] })} className="field-input"><option>To do</option><option>In progress</option><option>Blocked</option><option>Done</option></select></div>
                    <div className="field-block"><label className="field-label">Priority</label><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskItem['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
                    <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(taskForm.dueDate)} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Deferred / snooze until</label><input type="date" value={toDateInputValue(taskForm.deferredUntil)} onChange={(e) => setTaskForm({ ...taskForm, deferredUntil: e.target.value ? fromDateInputValue(e.target.value) : undefined, nextReviewAt: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="3. Workflow context">
                  <RecordEditorMetaGrid>
                    <div className="field-block"><label className="field-label">Block reason</label><input value={taskForm.blockReason || ''} onChange={(e) => setTaskForm({ ...taskForm, blockReason: e.target.value })} className="field-input" /></div>
                    <div className="field-block field-block-span-2"><label className="field-label">Next step</label><textarea value={taskForm.nextStep} onChange={(e) => setTaskForm({ ...taskForm, nextStep: e.target.value })} className="field-textarea" /></div>
                    {modalMode === 'full' ? <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={taskForm.summary} onChange={(e) => setTaskForm({ ...taskForm, summary: e.target.value })} className="field-textarea" /></div> : null}
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                <RecordEditorSection title="4. Relationship / linkage">
                  <RecordEditorMetaGrid>
                    <EntityCombobox label="External contact" valueId={taskForm.contactId} valueLabel={contacts.find((contact) => contact.id === taskForm.contactId)?.name} options={contactOptions} onSelect={(option) => setTaskForm({ ...taskForm, contactId: option.id })} onCreate={(label) => { const id = addContact({ name: label, role: 'PM', notes: '', tags: [] }); setTaskForm({ ...taskForm, contactId: id }); }} />
                    <EntityCombobox label="Company" valueId={taskForm.companyId} valueLabel={companies.find((company) => company.id === taskForm.companyId)?.name} options={companyOptions} onSelect={(option) => setTaskForm({ ...taskForm, companyId: option.id })} onCreate={(label) => { const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] }); setTaskForm({ ...taskForm, companyId: id }); }} />
                    <div className="field-block"><label className="field-label">Linked follow-up ID</label><input value={taskForm.linkedFollowUpId || ''} onChange={(e) => setTaskForm({ ...taskForm, linkedFollowUpId: e.target.value || undefined })} className="field-input" /></div>
                    <div className="field-block"><label className="field-label">Completion impact</label><select value={taskForm.completionImpact || 'advance_parent'} onChange={(e) => setTaskForm({ ...taskForm, completionImpact: e.target.value as TaskItem['completionImpact'] })} className="field-input"><option value="none">none</option><option value="advance_parent">advance_parent</option><option value="close_parent">close_parent</option></select></div>
                  </RecordEditorMetaGrid>
                </RecordEditorSection>

                {modalMode === 'full' ? (
                  <RecordEditorSection title="5. Notes / detail">
                    <RecordEditorMetaGrid>
                      <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} className="field-textarea" /></div>
                      <div className="field-block field-block-span-2"><label className="field-label">Completion note</label><textarea value={taskForm.completionNote || ''} onChange={(e) => setTaskForm({ ...taskForm, completionNote: e.target.value })} className="field-textarea" /></div>
                    </RecordEditorMetaGrid>
                  </RecordEditorSection>
                ) : null}
              </>
            )}

            <RecordEditorSection title="6. Maintenance" subtitle="Destructive/admin workflows are intentionally secondary.">
              <div className="text-xs text-slate-600">Use structured transition or dedicated maintenance flows for high-risk changes.</div>
            </RecordEditorSection>
          </RecordEditorShell>
        </AppModalBody>
        <AppModalFooter>
          <RecordEditorFooter>
            <button onClick={close} className="action-btn">Cancel</button>
            {!(followUpEditing || taskEditing) ? <button onClick={() => save(true)} className="action-btn">Save and add another</button> : null}
            <button onClick={() => save(false)} disabled={!canSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">
              {followUpEditing || taskEditing ? 'Save changes' : 'Save work'}
            </button>
          </RecordEditorFooter>
        </AppModalFooter>
      </div>
    </AppModal>
  );
}
