import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fromDateInputValue, toDateInputValue, createId, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { TaskItem, TaskStatus } from '../types';

const statuses: TaskStatus[] = ['To do', 'In progress', 'Blocked', 'Done'];
const priorities = ['Low', 'Medium', 'High', 'Critical'] as const;

function blankTask(): TaskItem {
  return {
    id: createId('TSK'),
    title: '',
    project: 'General',
    owner: 'Jared',
    status: 'To do',
    priority: 'Medium',
    dueDate: undefined,
    startDate: todayIso(),
    summary: '',
    nextStep: '',
    notes: '',
    tags: [],
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}

export function TaskFormModal() {
  const {
    taskModal,
    tasks,
    items,
    projects,
    contacts,
    companies,
    closeTaskModal,
    addTask,
    updateTask,
  } = useAppStore(useShallow((s) => ({
    taskModal: s.taskModal,
    tasks: s.tasks,
    items: s.items,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    closeTaskModal: s.closeTaskModal,
    addTask: s.addTask,
    updateTask: s.updateTask,
  })));

  const existing = useMemo(() => tasks.find((task) => task.id === taskModal.taskId) ?? null, [tasks, taskModal.taskId]);
  const [draft, setDraft] = useState<TaskItem>(blankTask());

  useEffect(() => {
    if (!taskModal.open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [taskModal.open]);

  useEffect(() => {
    if (!taskModal.open) return;
    setDraft(existing ? existing : blankTask());
  }, [existing, taskModal.open]);

  if (!taskModal.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tasks</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{taskModal.mode === 'create' ? 'Add task' : 'Edit task'}</h2>
            <p className="mt-1 text-sm text-slate-500">Track internal work without mixing it into the follow-up list.</p>
          </div>
          <button onClick={closeTaskModal} className="action-btn">Close</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Owner</span>
            <input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Project</span>
            <select value={draft.projectId ?? ''} onChange={(e) => {
              const project = projects.find((entry) => entry.id === e.target.value);
              setDraft({ ...draft, projectId: project?.id || undefined, project: project?.name || draft.project });
            }} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              <option value="">No linked project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Priority</span>
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskItem['priority'] })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Due date</span>
            <input type="date" value={toDateInputValue(draft.dueDate)} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Linked follow-up</span>
            <select value={draft.linkedFollowUpId ?? ''} onChange={(e) => setDraft({ ...draft, linkedFollowUpId: e.target.value || undefined })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              <option value="">No linked follow-up</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Related contact</span>
            <select value={draft.contactId ?? ''} onChange={(e) => setDraft({ ...draft, contactId: e.target.value || undefined })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              <option value="">None</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Related company</span>
            <select value={draft.companyId ?? ''} onChange={(e) => setDraft({ ...draft, companyId: e.target.value || undefined })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400">
              <option value="">None</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Summary</span>
            <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Next step</span>
            <textarea value={draft.nextStep} onChange={(e) => setDraft({ ...draft, nextStep: e.target.value })} rows={2} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <input value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="buyout, scope, reporting" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={closeTaskModal} className="action-btn">Cancel</button>
          <button
            onClick={() => {
              if (!draft.title.trim()) return;
              if (taskModal.mode === 'create') addTask(draft);
              else updateTask(draft.id, draft);
            }}
            className="primary-btn"
          >
            {taskModal.mode === 'create' ? 'Create task' : 'Save task'}
          </button>
        </div>
      </div>
    </div>
  );
}
