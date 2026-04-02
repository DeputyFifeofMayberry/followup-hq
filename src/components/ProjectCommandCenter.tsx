import { ClipboardCopy, FileText, FolderOpen, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildProjectDashboard, buildWeeklyProjectReport, formatDate, isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { SavedViewKey } from '../types';

export function ProjectCommandCenter({ onFocusTracker, onOpenItem }: { onFocusTracker: (view: SavedViewKey, project?: string) => void; onOpenItem: (itemId: string, view?: SavedViewKey, project?: string) => void }) {
  const { items, contacts, companies, projects, tasks, intakeDocuments, addProject, updateProject, deleteProject } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    projects: s.projects,
    tasks: s.tasks,
    intakeDocuments: s.intakeDocuments,
    addProject: s.addProject,
    updateProject: s.updateProject,
    deleteProject: s.deleteProject,
  })));

  const documentCounts = useMemo(
    () => intakeDocuments.reduce<Record<string, number>>((acc, doc) => {
      if (doc.projectId) acc[doc.projectId] = (acc[doc.projectId] ?? 0) + 1;
      return acc;
    }, {}),
    [intakeDocuments],
  );
  const projectSummary = useMemo(() => buildProjectDashboard(items, projects, documentCounts), [items, projects, documentCounts]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectSummary[0]?.projectId ?? projects[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectOwner, setNewProjectOwner] = useState('Jared');

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedItems = useMemo(
    () => items.filter((item) => item.projectId === selectedProject?.id && item.status !== 'Closed').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [items, selectedProject],
  );
  const selectedDocs = useMemo(
    () => intakeDocuments.filter((doc) => doc.projectId === selectedProject?.id),
    [intakeDocuments, selectedProject],
  );
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProject?.id && task.status !== 'Done'),
    [tasks, selectedProject],
  );
  const linkedContacts = useMemo(
    () => contacts.filter((contact) => selectedItems.some((item) => item.contactId === contact.id)),
    [contacts, selectedItems],
  );
  const linkedCompanies = useMemo(
    () => companies.filter((company) => selectedItems.some((item) => item.companyId === company.id)),
    [companies, selectedItems],
  );
  const reportText = useMemo(
    () => buildWeeklyProjectReport(selectedProject?.name ?? 'General', items, contacts, companies),
    [selectedProject, items, contacts, companies],
  );

  const createProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = addProject({ name, owner: newProjectOwner.trim() || 'Unassigned', status: 'Active', notes: '', tags: [] });
    setSelectedProjectId(id);
    setNewProjectName('');
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Project directory</h2>
        <p className="mt-1 text-sm text-slate-500">Manage project records, then open a full project workspace with actions, risks, relationships, and intake docs.</p>
      </div>
      <div className="grid gap-6 p-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Add project</div>
            <div className="grid gap-2 sm:grid-cols-[1.15fr_1fr_auto]">
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="field-input" placeholder="Project name" />
              <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} className="field-input" placeholder="Owner" />
              <button onClick={createProject} className="primary-btn">Add</button>
            </div>
          </div>

          <div className="grid gap-3">
            {projectSummary.map((project) => (
              <button
                key={project.projectId || project.project}
                onClick={() => setSelectedProjectId(project.projectId ?? '')}
                className={selectedProjectId === project.projectId ? 'rounded-2xl border border-sky-300 bg-sky-50 p-4 text-left' : 'rounded-2xl border border-slate-200 p-4 text-left'}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{project.project}</div>
                    <div className="mt-1 text-xs text-slate-500">{project.owner} • {project.status}</div>
                  </div>
                  <div className="text-xs text-slate-500">Health {project.healthScore}</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <div>Open: {project.openCount}</div>
                  <div>Waiting: {project.waitingCount}</div>
                  <div>Overdue: {project.overdueCount}</div>
                  <div>At risk: {project.atRiskCount}</div>
                  <div>Need nudge: {project.needsNudgeCount}</div>
                  <div>Docs: {project.documentCount}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {selectedProject ? (
            <>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{selectedProject.name}</div>
                    <div className="mt-1 text-sm text-slate-500">Project workspace with linked follow-ups, intake docs, and copy-ready reporting.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onFocusTracker('By project', selectedProject.name)} className="action-btn"><RefreshCcw className="h-4 w-4" />Focus tracker</button>
                    <button onClick={async () => { await navigator.clipboard.writeText(reportText); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="primary-btn"><ClipboardCopy className="h-4 w-4" />{copied ? 'Copied' : 'Copy report'}</button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input value={selectedProject.name} onChange={(e) => updateProject(selectedProject.id, { name: e.target.value })} className="field-input" placeholder="Project name" />
                  <input value={selectedProject.owner} onChange={(e) => updateProject(selectedProject.id, { owner: e.target.value })} className="field-input" placeholder="Project owner" />
                  <select value={selectedProject.status} onChange={(e) => updateProject(selectedProject.id, { status: e.target.value as typeof selectedProject.status })} className="field-input">
                    <option>Active</option><option>On hold</option><option>Closeout</option><option>Complete</option>
                  </select>
                  <button onClick={() => { if (window.confirm('Delete this project? Linked items will move to General.')) deleteProject(selectedProject.id); }} className="action-btn action-btn-danger justify-center">Delete project</button>
                </div>
                <textarea value={selectedProject.notes} onChange={(e) => updateProject(selectedProject.id, { notes: e.target.value })} className="field-textarea mt-3" placeholder="Project notes" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4" />Open follow-ups</div>
                  <div className="space-y-3">
                    {selectedItems.map((item) => (
                      <button key={item.id} onClick={() => onOpenItem(item.id, 'By project', selectedProject.name)} className="w-full rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500">{item.owner}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Due {formatDate(item.dueDate)} • Next touch {formatDate(item.nextTouchDate)}</div>
                        <div className="mt-2 text-sm text-slate-600">{item.nextAction}</div>
                        <div className="mt-2 text-xs text-slate-500">{item.waitingOn ? `Waiting on ${item.waitingOn}` : item.owesNextAction}{needsNudge(item) ? ' • Needs nudge' : ''}{isOverdue(item) ? ' • OVERDUE' : ''}</div>
                      </button>
                    ))}
                    {selectedItems.length === 0 ? <div className="text-sm text-slate-500">No open follow-ups on this project.</div> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><RefreshCcw className="h-4 w-4" />Project action board</div>
                  <div className="space-y-3">
                    {selectedTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">{task.title}</div>
                          <div className="text-xs text-slate-500">{task.owner}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{task.status} • Due {formatDate(task.dueDate)}</div>
                        <div className="mt-2 text-sm text-slate-600">{task.nextStep || 'No next step'}</div>
                      </div>
                    ))}
                    {selectedTasks.length === 0 ? <div className="text-sm text-slate-500">No open project tasks.</div> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><FolderOpen className="h-4 w-4" />Linked intake docs</div>
                  <div className="space-y-3">
                    {selectedDocs.map((doc) => (
                      <div key={doc.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-900">{doc.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{doc.kind} • {doc.disposition} • {formatDate(doc.uploadedAt)}</div>
                        {doc.notes ? <div className="mt-2 text-sm text-slate-600">{doc.notes}</div> : null}
                      </div>
                    ))}
                    {selectedDocs.length === 0 ? <div className="text-sm text-slate-500">No intake documents linked yet.</div> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Project relationships</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div><span className="font-medium text-slate-900">Contacts:</span> {linkedContacts.map((contact) => contact.name).join(', ') || '—'}</div>
                    <div><span className="font-medium text-slate-900">Companies:</span> {linkedCompanies.map((company) => company.name).join(', ') || '—'}</div>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Copy-ready weekly report</label>
                  <textarea value={reportText} readOnly className="field-textarea" style={{ minHeight: 220 }} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
