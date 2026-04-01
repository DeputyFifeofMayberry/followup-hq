import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FollowUpFormInput } from '../types';
import { buildDefaultForm, buildItemFromForm, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

const stopSpacebarBubble = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  if (event.key === ' ') event.stopPropagation();
};

export function ItemFormModal() {
  const {
    itemModal,
    items,
    projects,
    contacts,
    companies,
    closeItemModal,
    addItem,
    updateItem,
    addProject,
  } = useAppStore(useShallow((s) => ({
    itemModal: s.itemModal,
    items: s.items,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    closeItemModal: s.closeItemModal,
    addItem: s.addItem,
    updateItem: s.updateItem,
    addProject: s.addProject,
  })));

  const currentItem = useMemo(() => items.find((item) => item.id === itemModal.itemId) ?? null, [items, itemModal.itemId]);
  const [form, setForm] = useState<FollowUpFormInput>(buildDefaultForm());
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectOwner, setNewProjectOwner] = useState('Jared');

  useEffect(() => {
    if (!itemModal.open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [itemModal.open]);

  useEffect(() => {
    if (!itemModal.open) return;
    if (currentItem) {
      setForm({
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
      return;
    }
    setForm(buildDefaultForm());
  }, [itemModal.open, currentItem]);

  if (!itemModal.open) return null;

  const handleSave = () => {
    const built = buildItemFromForm(form, currentItem ?? undefined);
    if (currentItem) {
      updateItem(currentItem.id, built);
      closeItemModal();
      return;
    }
    addItem(built);
    setForm(buildDefaultForm());
  };

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
    setForm((prev) => ({ ...prev, projectId: id, project: name, owner: prev.owner || newProjectOwner || 'Jared' }));
    setShowAddProject(false);
    setNewProjectName('');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <div>
            <div className="text-lg font-semibold text-slate-950">{currentItem ? 'Edit follow-up' : 'Create follow-up'}</div>
            <div className="mt-1 text-sm text-slate-500">Capture a clear owner, real project link, and the next accountable move.</div>
          </div>
          <button onClick={closeItemModal} className="action-btn">Close</button>
        </div>

        <div className="form-grid-two">
          <div className="field-block">
            <label className="field-label">Title</label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Project</label>
            <select value={form.projectId || ''} onChange={(event) => handleProjectSelect(event.target.value)} onKeyDown={stopSpacebarBubble} className="field-input">
              <option value="__add__">+ Add project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {showAddProject ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={stopSpacebarBubble} className="field-input" placeholder="New project name" />
                <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} onKeyDown={stopSpacebarBubble} className="field-input" placeholder="Project owner" />
                <button type="button" onClick={handleCreateProject} className="primary-btn">Save</button>
              </div>
            ) : null}
          </div>

          <div className="field-block">
            <label className="field-label">Owner</label>
            <input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Source</label>
            <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as FollowUpFormInput['source'] })} onKeyDown={stopSpacebarBubble} className="field-input">
              <option>Email</option><option>Notes</option><option>To-do</option><option>Excel</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Status</label>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FollowUpFormInput['status'] })} onKeyDown={stopSpacebarBubble} className="field-input">
              <option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
            </select>
          </div>
          <div className="field-block">
            <label className="field-label">Priority</label>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as FollowUpFormInput['priority'] })} onKeyDown={stopSpacebarBubble} className="field-input">
              <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
            </select>
          </div>

          <div className="field-block">
            <label className="field-label">Due date</label>
            <input type="date" value={toDateInputValue(form.dueDate)} onChange={(event) => setForm({ ...form, dueDate: fromDateInputValue(event.target.value) })} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Next touch date</label>
            <input type="date" value={toDateInputValue(form.nextTouchDate)} onChange={(event) => setForm({ ...form, nextTouchDate: fromDateInputValue(event.target.value) })} className="field-input" />
          </div>

          <div className="field-block">
            <label className="field-label">Promised date</label>
            <input type="date" value={toDateInputValue(form.promisedDate)} onChange={(event) => setForm({ ...form, promisedDate: event.target.value ? fromDateInputValue(event.target.value) : '' })} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Follow up every (days)</label>
            <input type="number" min={1} value={form.cadenceDays} onChange={(event) => setForm({ ...form, cadenceDays: Number(event.target.value) || 1 })} className="field-input" />
          </div>

          <div className="field-block field-block-span-2">
            <label className="field-label">Next action</label>
            <textarea value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-textarea" />
          </div>
          <div className="field-block field-block-span-2">
            <label className="field-label">Summary</label>
            <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-textarea" />
          </div>

          <div className="field-block">
            <label className="field-label">Waiting on</label>
            <input value={form.waitingOn} onChange={(event) => setForm({ ...form, waitingOn: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input" />
          </div>
          <div className="field-block">
            <label className="field-label">Source reference</label>
            <input value={form.sourceRef} onChange={(event) => setForm({ ...form, sourceRef: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input" />
          </div>

          <div className="field-block">
            <label className="field-label">Contact</label>
            <select value={form.contactId} onChange={(event) => setForm({ ...form, contactId: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input">
              <option value="">No contact linked</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </div>
          <div className="field-block">
            <label className="field-label">Company</label>
            <select value={form.companyId} onChange={(event) => setForm({ ...form, companyId: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-input">
              <option value="">No company linked</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>

          <div className="field-block field-block-span-2">
            <label className="field-label">Notes</label>
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} onKeyDown={stopSpacebarBubble} className="field-textarea" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={closeItemModal} className="action-btn">Cancel</button>
          <button onClick={handleSave} className="primary-btn">{currentItem ? 'Save changes' : 'Create follow-up'}</button>
        </div>
      </div>
    </div>
  );
}
