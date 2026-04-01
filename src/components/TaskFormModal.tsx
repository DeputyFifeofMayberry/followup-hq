import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { createId, fromDateInputValue, todayIso, toDateInputValue } from '../lib/utils';
import type { TaskFormInput, TaskRecord } from '../types';

function buildDefaultForm(): TaskFormInput {
  const now = new Date().toISOString();
  return {
    title: '',
    project: 'General',
    projectId: '',
    owner: 'Jared',
    status: 'To do',
    priority: 'Medium',
    dueDate: now,
    startDate: now,
    summary: '',
    nextStep: '',
    notes: '',
    tags: [],
    linkedFollowUpId: '',
    contactId: '',
    companyId: '',
  };
}

export function TaskFormModal() {
  const { taskModal, tasks, items, contacts, companies, projects, closeTaskModal, addTask, updateTask, addProject } = useAppStore(useShallow((s) => ({
    taskModal: s.taskModal,
    tasks: s.tasks,
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    projects: s.projects,
    closeTaskModal: s.closeTaskModal,
    addTask: s.addTask,
    updateTask: s.updateTask,
    addProject: s.addProject,
  })));

  const currentTask = useMemo(() => tasks.find((task) => task.id === taskModal.taskId) ?? null, [taskModal.taskId, tasks]);
  const [form, setForm] = useState<TaskFormInput>(buildDefaultForm());
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectOwner, setNewProjectOwner] = useState('Jared');

  useEffect(() => {
    if (!taskModal.open) return;
    if (currentTask) {
      setForm({
        title: currentTask.title,
        project: currentTask.project,
        projectId: currentTask.projectId ?? '',
        owner: currentTask.owner,
        status: currentTask.status,
        priority: currentTask.priority,
        dueDate: currentTask.dueDate,
        startDate: currentTask.startDate ?? '',
        summary: currentTask.summary,
        nextStep: currentTask.nextStep,
        notes: currentTask.notes,
        tags: currentTask.tags,
        linkedFollowUpId: currentTask.linkedFollowUpId ?? '',
        contactId: currentTask.contactId ?? '',
        companyId: currentTask.companyId ?? '',
      });
      return;
    }
    setForm(buildDefaultForm());
  }, [currentTask, taskModal.open]);

  if (!taskModal.open) return null;

  const handleProjectSelect = (value: string) => {
    if (value === '__add__') {
      setShowAddProject(true);
      return;
    }
    const selected = projects.find((project) => project.id === value);
    setShowAddProject(false);
    setForm((prev) => ({ ...prev, projectId: selected?.id ?? '', project: selected?.name ?? 'General' }));
  };

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = addProject({ name, owner: newProjectOwner.trim() || 'Unassigned', status: 'Active', notes: '', tags: [] });
    setForm((prev) => ({ ...prev, projectId: id, project: name }));
    setShowAddProject(false);
    setNewProjectName('');
  };

  const handleSave = () => {
    const now = todayIso();
    if (currentTask) {
      updateTask(currentTask.id, {
        title: form.title.trim(),
        project: form.project,
        projectId: form.projectId || undefined,
        owner: form.owner.trim() || 'Unassigned',
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate,
        startDate: form.startDate?.trim() ? form.startDate : undefined,
        summary: form.summary.trim(),
        nextStep: form.nextStep.trim(),
        notes: form.notes,
        tags: form.tags,
        linkedFollowUpId: form.linkedFollowUpId || undefined,
        contactId: form.contactId || undefined,
        companyId: form.companyId || undefined,
      });
      closeTaskModal();
      return;
    }

    const record: TaskRecord = {
      id: createId('TSK'),
      title: form.title.trim(),
      project: form.project,
      projectId: form.projectId || undefined,
      owner: form.owner.trim() || 'Unassigned',
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate,
      startDate: form.startDate?.trim() ? form.startDate : undefined,
      summary: form.summary.trim(),
      nextStep: form.nextStep.trim(),
      notes: form.notes,
      tags: form.tags,
      linkedFollowUpId: form.linkedFollowUpId || undefined,
      contactId: form.contactId || undefined,
      companyId: form.companyId || undefined,
      createdAt: now,
      updatedAt: now,
      timeline: [
        { id: createId('T'), at: now, type: 'created', summary: 'Task created.' },
      ],
    };
    addTask(record);
    setForm(buildDefaultForm());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">{currentTask ? 'Edit task' : 'Create task'}</div>
            <div className="mt-1 text-sm text-slate-500">Keep internal work separate from follow-ups, but link it when the two support each other.</div>
          </div>
          <button onClick={closeTaskModal} className="action-btn">Close</button>
        </div>

        <div className="form-grid-two">
          <div className="field-block">
            <label className="field-label">Title</label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Project</label>
            <select value={form.projectId || ''} onChange={(event) => handleProjectSelect(event.target.value)} className="field-input">
              <option value="__add__">+ Add project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {showAddProject ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="field-input" placeholder="New project name" />
                <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} className="field-input" placeholder="Project owner" />
                <button type="button" onClick={handleCreateProject} className="primary-btn">Save</button>
              </div>
            ) : null}
          </div>

          <div className="field-block">
            <label className="field-label">Owner</label>
            <input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Status</label>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskFormInput['status'] })} className="field-input">
              <option>To do</option><option>In progress</option><option>Waiting on input</option><option>Blocked</option><option>Done</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Priority</label>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskFormInput['priority'] })} className="field-input">
              <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
            </select>
          </div>
          <div className="field-block">
            <label className="field-label">Due date</label>
            <input type="date" value={toDateInputValue(form.dueDate)} onChange={(event) => setForm({ ...form, dueDate: fromDateInputValue(event.target.value) })} className="field-input" />
          </div>

          <div className="field-block">
            <label className="field-label">Start date</label>
            <input type="date" value={toDateInputValue(form.startDate)} onChange={(event) => setForm({ ...form, startDate: event.target.value ? fromDateInputValue(event.target.value) : '' })} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Link to follow-up</label>
            <select value={form.linkedFollowUpId || ''} onChange={(event) => setForm({ ...form, linkedFollowUpId: event.target.value })} className="field-input">
              <option value="">No linked follow-up</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>

          <div className="field-block field-block-span-2">
            <label className="field-label">Summary</label>
            <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} className="field-textarea" />
          </div>
          <div className="field-block field-block-span-2">
            <label className="field-label">Next step</label>
            <textarea value={form.nextStep} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} className="field-textarea" />
          </div>

          <div className="field-block">
            <label className="field-label">Contact</label>
            <select value={form.contactId || ''} onChange={(event) => setForm({ ...form, contactId: event.target.value })} className="field-input">
              <option value="">No contact</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </div>
          <div className="field-block">
            <label className="field-label">Company</label>
            <select value={form.companyId || ''} onChange={(event) => setForm({ ...form, companyId: event.target.value })} className="field-input">
              <option value="">No company</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>

          <div className="field-block field-block-span-2">
            <label className="field-label">Notes</label>
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="field-textarea min-h-[160px]" />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={closeTaskModal} className="action-btn">Cancel</button>
          <button onClick={handleSave} className="primary-btn">{currentTask ? 'Save task' : 'Create task'}</button>
        </div>
      </div>
    </div>
  );
}
