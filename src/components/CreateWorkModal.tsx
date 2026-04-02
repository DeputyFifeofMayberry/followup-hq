import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { buildItemFromForm, createId, fromDateInputValue, toDateInputValue, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpFormInput, TaskItem } from '../types';
import { EntityCombobox } from './EntityCombobox';

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

  const [mode, setMode] = useState<WorkMode>('followup');
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormInput>(buildSmartFollowUpDefaults({ projectFilter }));
  const [taskForm, setTaskForm] = useState<TaskItem>(toTaskDraft(buildSmartTaskDefaults({ projectFilter })));
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (currentItem) {
      setMode('followup');
      setFollowUpForm({
        title: currentItem.title,
        source: currentItem.source,
        project: currentItem.project,
        projectId: currentItem.projectId ?? '',
        owner: currentItem.owner,
        status: currentItem.status,
        priority: currentItem.priority,
        dueDate: currentItem.dueDate,
        promisedDate: currentItem.promisedDate ?? '',
        nextTouchDate: currentItem.nextTouchDate,
        nextAction: currentItem.nextAction,
        summary: currentItem.summary,
        tags: currentItem.tags,
        sourceRef: currentItem.sourceRef,
        waitingOn: currentItem.waitingOn ?? '',
        notes: currentItem.notes,
        category: currentItem.category,
        owesNextAction: currentItem.owesNextAction,
        escalationLevel: currentItem.escalationLevel,
        cadenceDays: currentItem.cadenceDays,
        contactId: currentItem.contactId ?? '',
        companyId: currentItem.companyId ?? '',
        threadKey: currentItem.threadKey ?? '',
        draftFollowUp: currentItem.draftFollowUp ?? '',
      });
      setShowAdvanced(true);
      return;
    }
    if (currentTask) {
      setMode('task');
      setTaskForm(currentTask);
      setShowAdvanced(true);
      return;
    }

    const defaultFollowUp = buildSmartFollowUpDefaults({ projectFilter });
    const defaultTask = toTaskDraft(buildSmartTaskDefaults({ projectFilter }));
    if (createWorkDraft) {
      const projectMatch = createWorkDraft.project
        ? projects.find((project) => project.name.toLowerCase() === createWorkDraft.project?.toLowerCase() || project.id === createWorkDraft.project)
        : undefined;
      setMode(createWorkDraft.kind);
      setFollowUpForm({
        ...defaultFollowUp,
        title: createWorkDraft.title || defaultFollowUp.title,
        owner: createWorkDraft.owner || defaultFollowUp.owner,
        project: projectMatch?.name ?? createWorkDraft.project ?? defaultFollowUp.project,
        projectId: projectMatch?.id ?? defaultFollowUp.projectId,
        dueDate: createWorkDraft.dueDate || defaultFollowUp.dueDate,
        nextTouchDate: createWorkDraft.dueDate || defaultFollowUp.nextTouchDate,
        nextAction: createWorkDraft.nextAction || createWorkDraft.waitingOn || defaultFollowUp.nextAction,
        waitingOn: createWorkDraft.waitingOn || defaultFollowUp.waitingOn,
        summary: createWorkDraft.rawText || defaultFollowUp.summary,
        priority: createWorkDraft.priority,
      });
      setTaskForm({
        ...defaultTask,
        title: createWorkDraft.title || defaultTask.title,
        owner: createWorkDraft.owner || defaultTask.owner,
        project: projectMatch?.name ?? createWorkDraft.project ?? defaultTask.project,
        projectId: projectMatch?.id ?? defaultTask.projectId,
        dueDate: createWorkDraft.dueDate || defaultTask.dueDate,
        nextStep: createWorkDraft.nextStep || createWorkDraft.title || defaultTask.nextStep,
        summary: createWorkDraft.rawText,
        priority: createWorkDraft.priority,
      });
      return;
    }
    setMode(itemModal.open ? 'followup' : 'task');
    setFollowUpForm(defaultFollowUp);
    setTaskForm(defaultTask);
    setShowAdvanced(false);
  }, [open, currentItem, currentTask, createWorkDraft, projectFilter, projects, itemModal.open]);

  if (!open) return null;

  const close = () => {
    closeItemModal();
    closeTaskModal();
  };

  const projectOptions = projects.map((project) => ({ id: project.id, label: project.name, meta: project.owner }));
  const contactOptions = contacts.map((contact) => ({ id: contact.id, label: contact.name, meta: contact.role || contact.email }));
  const companyOptions = companies.map((company) => ({ id: company.id, label: company.name, meta: company.type }));

  const canSave = mode === 'followup'
    ? !!followUpForm.title.trim() && !!followUpForm.owner.trim() && !!followUpForm.projectId && !!followUpForm.nextAction.trim() && (!!followUpForm.dueDate || !!followUpForm.nextTouchDate)
    : !!taskForm.title.trim() && !!taskForm.owner.trim() && !!taskForm.projectId && !!taskForm.nextStep.trim() && !!taskForm.dueDate;

  const save = (addAnother = false) => {
    if (!canSave) return;
    if (mode === 'followup') {
      const built = buildItemFromForm(followUpForm, currentItem ?? undefined);
      rememberFollowUpDefaults(followUpForm);
      if (currentItem) updateItem(currentItem.id, built);
      else addItem(built);
    } else {
      const payload = { ...taskForm, updatedAt: todayIso() };
      rememberTaskDefaults(payload);
      if (currentTask) updateTask(currentTask.id, payload);
      else addTask(payload);
    }

    if (!addAnother || followUpEditing || taskEditing) {
      close();
      return;
    }

    setFollowUpForm(buildSmartFollowUpDefaults({ projectFilter }));
    setTaskForm(toTaskDraft(buildSmartTaskDefaults({ projectFilter })));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide" onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          save(false);
        }
      }}>
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">Create work</div>
            <div className="mt-1 text-sm text-slate-500">Capture the minimum first, then add detail only when needed.</div>
          </div>
          <button onClick={close} className="action-btn">Close</button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setMode('followup')} className={mode === 'followup' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Follow-up</button>
          <button onClick={() => setMode('task')} className={mode === 'task' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Task</button>
        </div>

        {mode === 'followup' ? (
          <div className="form-grid-two">
            <div className="field-block"><label className="field-label">Title</label><input autoFocus value={followUpForm.title} onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })} className="field-input" /></div>
            <EntityCombobox
              label="Owner (contact)"
              valueId={followUpForm.contactId}
              valueLabel={followUpForm.owner}
              options={contactOptions}
              onSelect={(option) => setFollowUpForm({ ...followUpForm, owner: option.label, contactId: option.id })}
              onCreate={(label) => {
                const id = addContact({ name: label, role: 'PM', notes: '', tags: [] });
                setFollowUpForm({ ...followUpForm, owner: label, contactId: id });
              }}
            />
            <EntityCombobox
              label="Project"
              valueId={followUpForm.projectId}
              valueLabel={followUpForm.project}
              options={projectOptions}
              onSelect={(option) => setFollowUpForm({ ...followUpForm, project: option.label, projectId: option.id })}
              onCreate={(label) => {
                const id = addProject({ name: label, owner: followUpForm.owner || 'Unassigned', status: 'Active', notes: '', tags: [] });
                setFollowUpForm({ ...followUpForm, project: label, projectId: id });
              }}
            />
            <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(followUpForm.dueDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
            <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={toDateInputValue(followUpForm.nextTouchDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, nextTouchDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
            <div className="field-block field-block-span-2"><label className="field-label">Next action</label><textarea value={followUpForm.nextAction} onChange={(e) => setFollowUpForm({ ...followUpForm, nextAction: e.target.value })} className="field-textarea" /></div>
          </div>
        ) : (
          <div className="form-grid-two">
            <div className="field-block"><label className="field-label">Title</label><input autoFocus value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="field-input" /></div>
            <EntityCombobox
              label="Owner (contact)"
              valueId={taskForm.contactId}
              valueLabel={taskForm.owner}
              options={contactOptions}
              onSelect={(option) => setTaskForm({ ...taskForm, owner: option.label, contactId: option.id })}
              onCreate={(label) => {
                const id = addContact({ name: label, role: 'PM', notes: '', tags: [] });
                setTaskForm({ ...taskForm, owner: label, contactId: id });
              }}
            />
            <EntityCombobox
              label="Project"
              valueId={taskForm.projectId}
              valueLabel={taskForm.project}
              options={projectOptions}
              onSelect={(option) => setTaskForm({ ...taskForm, project: option.label, projectId: option.id })}
              onCreate={(label) => {
                const id = addProject({ name: label, owner: taskForm.owner || 'Unassigned', status: 'Active', notes: '', tags: [] });
                setTaskForm({ ...taskForm, project: label, projectId: id });
              }}
            />
            <div className="field-block"><label className="field-label">Due date</label><input type="date" value={toDateInputValue(taskForm.dueDate)} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
            <div className="field-block field-block-span-2"><label className="field-label">Next step</label><textarea value={taskForm.nextStep} onChange={(e) => setTaskForm({ ...taskForm, nextStep: e.target.value })} className="field-textarea" /></div>
          </div>
        )}

        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" open={showAdvanced}>
          <summary onClick={() => setShowAdvanced((v) => !v)} className="cursor-pointer text-sm font-semibold text-slate-700">Advanced fields (optional)</summary>
          {mode === 'followup' ? (
            <div className="form-grid-two mt-4">
              <div className="field-block"><label className="field-label">Status</label><select value={followUpForm.status} onChange={(e) => setFollowUpForm({ ...followUpForm, status: e.target.value as FollowUpFormInput['status'] })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select></div>
              <div className="field-block"><label className="field-label">Priority</label><select value={followUpForm.priority} onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value as FollowUpFormInput['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
              <EntityCombobox
                label="Company"
                valueId={followUpForm.companyId}
                valueLabel={companies.find((company) => company.id === followUpForm.companyId)?.name}
                options={companyOptions}
                onSelect={(option) => setFollowUpForm({ ...followUpForm, companyId: option.id })}
                onCreate={(label) => {
                  const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] });
                  setFollowUpForm({ ...followUpForm, companyId: id });
                }}
              />
              <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={followUpForm.summary} onChange={(e) => setFollowUpForm({ ...followUpForm, summary: e.target.value })} className="field-textarea" /></div>
            </div>
          ) : (
            <div className="form-grid-two mt-4">
              <div className="field-block"><label className="field-label">Status</label><select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskItem['status'] })} className="field-input"><option>To do</option><option>In progress</option><option>Blocked</option><option>Done</option></select></div>
              <div className="field-block"><label className="field-label">Priority</label><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskItem['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
              <EntityCombobox
                label="Company"
                valueId={taskForm.companyId}
                valueLabel={companies.find((company) => company.id === taskForm.companyId)?.name}
                options={companyOptions}
                onSelect={(option) => setTaskForm({ ...taskForm, companyId: option.id })}
                onCreate={(label) => {
                  const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] });
                  setTaskForm({ ...taskForm, companyId: id });
                }}
              />
              <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={taskForm.summary} onChange={(e) => setTaskForm({ ...taskForm, summary: e.target.value })} className="field-textarea" /></div>
            </div>
          )}
        </details>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={close} className="action-btn">Cancel</button>
          {!(followUpEditing || taskEditing) ? <button onClick={() => save(true)} className="action-btn">Save and add another</button> : null}
          <button onClick={() => save(false)} disabled={!canSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">
            {followUpEditing || taskEditing ? 'Save changes' : 'Save work'}
          </button>
        </div>
      </div>
    </div>
  );
}
