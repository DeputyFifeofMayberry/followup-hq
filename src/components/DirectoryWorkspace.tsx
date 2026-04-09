import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyProjectFilters, applyProjectSort, buildProjectDerivedRecords, defaultProjectFilters, type ProjectFilterState } from '../lib/projectSelectors';
import { getCompanyLinkedRecords, getContactLinkedRecords } from '../lib/recordContext';
import { formatDate, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { CompanyRecord, ContactRecord, ProjectRecord, ProjectSortKey, ProjectStatus } from '../types';
import { AppModal, AppModalBody, AppModalHeader, SegmentedControl, StatePanel } from './ui/AppPrimitives';

interface DirectoryWorkspaceProps {
  onOpenItem: (itemId: string) => void;
}

type DirectoryTab = 'projects' | 'people' | 'companies';
type ProjectDetailTab = 'profile' | 'operational';
type ProjectViewMode = 'directory' | 'operational';

type ProjectDraft = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>;

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['Active', 'On hold', 'Closeout', 'Complete'];

const blankProjectDraft: ProjectDraft = {
  name: '',
  aliases: [],
  code: '',
  contractReference: '',
  clientOrg: '',
  ownerOrg: '',
  owner: 'Unassigned',
  superintendent: '',
  leadAssignee: '',
  phase: '',
  status: 'Active',
  targetCompletionDate: '',
  nextMilestone: '',
  nextMilestoneDate: '',
  riskSummary: '',
  currentBlocker: '',
  closeoutReadiness: 0,
  projectNextAction: '',
  location: '',
  facility: '',
  building: '',
  lastReviewedAt: '',
  notes: '',
  tags: [],
  archived: false,
};

function isGeneralProject(project: ProjectRecord): boolean {
  return project.name.trim().toLowerCase() === 'general';
}

function toDelimitedArray(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function LinkContactToProjectControl({ projectId }: { projectId: string }) {
  const { contacts, items, tasks, updateItem, updateTask, addContact } = useAppStore(useShallow((s) => ({
    contacts: s.contacts,
    items: s.items,
    tasks: s.tasks,
    updateItem: s.updateItem,
    updateTask: s.updateTask,
    addContact: s.addContact,
  })));
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const linkedContactIds = useMemo(() => new Set([
    ...items.filter((item) => item.projectId === projectId && item.contactId).map((item) => item.contactId as string),
    ...tasks.filter((task) => task.projectId === projectId && task.contactId).map((task) => task.contactId as string),
  ]), [items, tasks, projectId]);

  const candidates = contacts.filter((contact) => contact.name.toLowerCase().includes(query.trim().toLowerCase()) && !linkedContactIds.has(contact.id));

  const linkContact = (contactId: string) => {
    const targetItem = items.find((item) => item.projectId === projectId && !item.contactId);
    if (targetItem) {
      updateItem(targetItem.id, { contactId });
      return;
    }
    const targetTask = tasks.find((task) => task.projectId === projectId && !task.contactId);
    if (targetTask) updateTask(targetTask.id, { contactId });
  };

  const createAndLink = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addContact({ name, role: 'Project contact', notes: '', tags: [], active: true });
    linkContact(id);
    setNewName('');
  };

  return (
    <div className="space-y-2">
      <input className="field-input" placeholder="Search contacts" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-28 overflow-auto rounded-xl border border-slate-200 p-2">
        {candidates.slice(0, 8).map((contact) => (
          <button key={contact.id} className="mb-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-left text-xs hover:bg-slate-50" onClick={() => linkContact(contact.id)}>{contact.name}</button>
        ))}
        {candidates.length === 0 ? <div className="text-xs text-slate-500">No matches.</div> : null}
      </div>
      <div className="flex gap-2">
        <input className="field-input" placeholder="Create contact" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <button className="action-btn" onClick={createAndLink}>Create</button>
      </div>
    </div>
  );
}

export function LinkCompanyToProjectControl({ projectId }: { projectId: string }) {
  const { companies, items, tasks, updateItem, updateTask, addCompany } = useAppStore(useShallow((s) => ({
    companies: s.companies,
    items: s.items,
    tasks: s.tasks,
    updateItem: s.updateItem,
    updateTask: s.updateTask,
    addCompany: s.addCompany,
  })));
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const linkedCompanyIds = useMemo(() => new Set([
    ...items.filter((item) => item.projectId === projectId && item.companyId).map((item) => item.companyId as string),
    ...tasks.filter((task) => task.projectId === projectId && task.companyId).map((task) => task.companyId as string),
  ]), [items, tasks, projectId]);

  const candidates = companies.filter((company) => company.name.toLowerCase().includes(query.trim().toLowerCase()) && !linkedCompanyIds.has(company.id));

  const linkCompany = (companyId: string) => {
    const targetItem = items.find((item) => item.projectId === projectId && !item.companyId);
    if (targetItem) {
      updateItem(targetItem.id, { companyId });
      return;
    }
    const targetTask = tasks.find((task) => task.projectId === projectId && !task.companyId);
    if (targetTask) updateTask(targetTask.id, { companyId });
  };

  const createAndLink = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addCompany({ name, type: 'Other', notes: '', tags: [], active: true });
    linkCompany(id);
    setNewName('');
  };

  return (
    <div className="space-y-2">
      <input className="field-input" placeholder="Search companies" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-28 overflow-auto rounded-xl border border-slate-200 p-2">
        {candidates.slice(0, 8).map((company) => (
          <button key={company.id} className="mb-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-left text-xs hover:bg-slate-50" onClick={() => linkCompany(company.id)}>{company.name}</button>
        ))}
        {candidates.length === 0 ? <div className="text-xs text-slate-500">No matches.</div> : null}
      </div>
      <div className="flex gap-2">
        <input className="field-input" placeholder="Create company" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <button className="action-btn" onClick={createAndLink}>Create</button>
      </div>
    </div>
  );
}

export function DirectoryWorkspace({ onOpenItem }: DirectoryWorkspaceProps) {
  const {
    projects, items, tasks, contacts, companies, intakeDocuments,
    addProject, updateProject, deleteProject, reassignProjectRecords,
  } = useAppStore(useShallow((s) => ({
    projects: s.projects,
    items: s.items,
    tasks: s.tasks,
    contacts: s.contacts,
    companies: s.companies,
    intakeDocuments: s.intakeDocuments,
    addProject: s.addProject,
    updateProject: s.updateProject,
    deleteProject: s.deleteProject,
    reassignProjectRecords: s.reassignProjectRecords,
  })));

  const [tab, setTab] = useState<DirectoryTab>('projects');
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('directory');
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>(defaultProjectFilters);
  const [archivedFilter, setArchivedFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortKey, setSortKey] = useState<ProjectSortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProjectDraft>(blankProjectDraft);
  const [createWarnings, setCreateWarnings] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<ProjectDetailTab>('profile');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const rows = useMemo(() => buildProjectDerivedRecords(projects, items, tasks, intakeDocuments, contacts, companies), [projects, items, tasks, intakeDocuments, contacts, companies]);
  const filteredRows = useMemo(() => applyProjectFilters(rows, projectFilters), [rows, projectFilters]);
  const activeRows = filteredRows.filter((row) => !row.project.archived);
  const archivedRows = filteredRows.filter((row) => !!row.project.archived);
  const displayRows = (archivedFilter === 'active' ? activeRows : archivedFilter === 'archived' ? archivedRows : filteredRows);
  const sortedRows = useMemo(() => applyProjectSort(displayRows, sortKey, sortDirection), [displayRows, sortKey, sortDirection]);

  useEffect(() => {
    if (!sortedRows.length) {
      setSelectedProjectId('');
      return;
    }
    if (!selectedProjectId || !sortedRows.some((row) => row.project.id === selectedProjectId)) setSelectedProjectId(sortedRows[0].project.id);
  }, [selectedProjectId, sortedRows]);

  const selectedRow = sortedRows.find((row) => row.project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!selectedRow) return;
    if (!editing) setDraft(selectedRow.project);
  }, [editing, selectedRow]);

  const saveCreate = () => {
    const normalizedName = createDraft.name.trim();
    const normalizedCode = createDraft.code?.trim();
    const warnings: string[] = [];
    if (!normalizedName) warnings.push('Project name is required.');
    if (projects.some((project) => project.name.trim().toLowerCase() === normalizedName.toLowerCase())) warnings.push('A project with this name already exists.');
    if (normalizedCode && projects.some((project) => project.code?.trim().toLowerCase() === normalizedCode.toLowerCase())) warnings.push('A project with this code already exists.');
    setCreateWarnings(warnings);
    if (warnings.some((entry) => entry.includes('required'))) return;

    const id = addProject({
      ...createDraft,
      name: normalizedName,
      code: normalizedCode,
      owner: createDraft.owner.trim() || 'Unassigned',
      notes: createDraft.notes.trim(),
      tags: createDraft.tags ?? [],
      aliases: createDraft.aliases ?? [],
    });
    setSelectedProjectId(id);
    setShowCreateModal(false);
    setCreateDraft(blankProjectDraft);
  };

  const saveDraft = () => {
    if (!selectedRow || !draft) return;
    updateProject(selectedRow.project.id, { ...draft, name: draft.name.trim(), code: draft.code?.trim(), notes: draft.notes.trim() });
    setEditing(false);
  };

  const linkedContactRecords: ContactRecord[] = selectedRow ? selectedRow.contacts : [];
  const linkedCompanyRecords: CompanyRecord[] = selectedRow ? selectedRow.companies : [];

  const unlinkContact = (contactId: string) => {
    items.filter((item) => item.projectId === selectedProjectId && item.contactId === contactId).forEach((item) => updateProject(item.projectId || '', {}));
  };
  void unlinkContact;

  return (
    <div className="workspace-page">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Directory</h2>
          <p className="text-sm text-slate-600">Master data for projects, people, and companies. Operational pressure is available as secondary context.</p>
        </div>
        <SegmentedControl
          options={[
            { key: 'projects', label: 'Projects' },
            { key: 'people', label: 'People' },
            { key: 'companies', label: 'Companies' },
          ]}
          value={tab}
          onChange={(value) => setTab(value as DirectoryTab)}
          size="sm"
        />
      </div>

      {tab === 'projects' ? (
        <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className="primary-btn" onClick={() => setShowCreateModal(true)}>New Project</button>
              <SegmentedControl options={[{ key: 'directory', label: 'Directory view' }, { key: 'operational', label: 'Operational pressure view' }]} value={projectViewMode} onChange={(value) => setProjectViewMode(value as ProjectViewMode)} size="sm" />
              <select className="field-input max-w-44" value={archivedFilter} onChange={(event) => setArchivedFilter(event.target.value as typeof archivedFilter)}>
                <option value="active">Active only</option>
                <option value="archived">Archived only</option>
                <option value="all">Active + archived</option>
              </select>
              <input className="field-input max-w-56" placeholder="Search projects" value={projectFilters.query} onChange={(event) => setProjectFilters((prev) => ({ ...prev, query: event.target.value }))} />
              <select className="field-input max-w-44" value={projectFilters.status} onChange={(event) => setProjectFilters((prev) => ({ ...prev, status: event.target.value as ProjectFilterState['status'] }))}><option value="All">All status</option>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
              <select className="field-input max-w-44" value={projectFilters.owner} onChange={(event) => setProjectFilters((prev) => ({ ...prev, owner: event.target.value }))}><option value="All">All owners</option>{[...new Set(projects.map((project) => project.owner))].filter(Boolean).map((owner) => <option key={owner}>{owner}</option>)}</select>
              <select className="field-input max-w-44" value={sortKey} onChange={(event) => setSortKey(event.target.value as ProjectSortKey)}>
                <option value="name">Sort: name</option>
                <option value="updated">Sort: last activity</option>
                <option value="targetDate">Sort: target completion</option>
                <option value="overdueWork">Sort: overdue work</option>
                <option value="health">Sort: health</option>
              </select>
              <button className="action-btn" onClick={() => setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')}>Order: {sortDirection === 'asc' ? 'Ascending' : 'Descending'}</button>
            </div>

            {sortedRows.length === 0 ? (
              <StatePanel tone="empty" title={projects.length === 0 ? 'No projects yet' : 'No matching projects'} message={projects.length === 0 ? 'Create your first project to start building the directory.' : 'Try adjusting search, status, owner, or archive filters.'} />
            ) : projectViewMode === 'directory' ? (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      {[
                        ['name', 'Name'], ['code', 'Code'], ['owner', 'Owner'], ['status', 'Status'], ['clientOrg', 'Client / Owner org'], ['phase', 'Phase'], ['targetCompletionDate', 'Target completion'], ['lastReviewedAt', 'Last reviewed'], ['linkedContacts', 'Linked contacts'], ['linkedCompanies', 'Linked companies'], ['health', 'Health'],
                      ].map(([id, label]) => <th key={id} className="px-2 py-2">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...sortedRows.filter((row) => isGeneralProject(row.project)), ...sortedRows.filter((row) => !isGeneralProject(row.project))].map((row) => (
                      <tr key={row.project.id} className={selectedProjectId === row.project.id ? 'cursor-pointer border-b border-slate-100 bg-slate-50' : 'cursor-pointer border-b border-slate-100'} onClick={() => setSelectedProjectId(row.project.id)}>
                        <td className="px-2 py-2 font-medium">{isGeneralProject(row.project) ? 'Unclassified (General)' : row.project.name}</td>
                        <td className="px-2 py-2">{row.project.code || '—'}</td>
                        <td className="px-2 py-2">{row.project.owner || '—'}</td>
                        <td className="px-2 py-2">{row.project.archived ? 'Archived' : row.project.status}</td>
                        <td className="px-2 py-2">{row.project.clientOrg || row.project.ownerOrg || '—'}</td>
                        <td className="px-2 py-2">{row.project.phase || '—'}</td>
                        <td className="px-2 py-2">{formatDate(row.project.targetCompletionDate)}</td>
                        <td className="px-2 py-2">{formatDate(row.project.lastReviewedAt)}</td>
                        <td className="px-2 py-2">{row.contacts.length}</td>
                        <td className="px-2 py-2">{row.companies.length}</td>
                        <td className="px-2 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.health.tier} ({row.health.score})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sortedRows.map((row) => (
                  <button key={row.project.id} className="rounded-xl border border-slate-200 p-3 text-left" onClick={() => setSelectedProjectId(row.project.id)}>
                    <div className="font-semibold text-slate-900">{row.project.name}</div>
                    <div className="mt-1 text-xs text-slate-600">Pressure {row.health.score} • {row.health.tier}</div>
                    <div className="mt-2 text-xs text-slate-600">Overdue {row.overdueFollowUpCount + row.overdueTaskCount} • Blocked {row.blockedTaskCount}</div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            {!selectedRow ? <StatePanel tone="empty" title="Select a project" message="Choose a project to review its profile and operational context." /> : (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{selectedRow.project.name}</div>
                    <div className="text-xs text-slate-600">{selectedRow.project.code || 'No code'} • {selectedRow.project.status}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="action-btn" onClick={() => { if (editing && draft && JSON.stringify(draft) !== JSON.stringify(selectedRow.project) && !window.confirm('Discard unsaved project changes?')) return; setEditing((prev) => !prev); }}>{editing ? 'View mode' : 'Edit project'}</button>
                    {editing ? <><button className="action-btn" onClick={() => { setEditing(false); setDraft(selectedRow.project); }}>Cancel</button><button className="primary-btn" onClick={saveDraft}>Save</button></> : null}
                  </div>
                </div>

                <SegmentedControl options={[{ key: 'profile', label: 'Project profile' }, { key: 'operational', label: 'Operational context' }]} value={detailTab} onChange={(value) => setDetailTab(value as ProjectDetailTab)} size="sm" />

                {detailTab === 'profile' ? (
                  <div className="mt-3 space-y-3 text-sm">
                    {editing && draft ? (
                      <>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 font-semibold">Identity</div><div className="grid gap-2 md:grid-cols-2"><label className="field-block"><span className="field-label">Project name *</span><input className="field-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={(draft.aliases ?? []).join(', ')} onChange={(event) => setDraft({ ...draft, aliases: toDelimitedArray(event.target.value) })} /></label><label className="field-block"><span className="field-label">Project code</span><input className="field-input" value={draft.code ?? ''} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></label><label className="field-block"><span className="field-label">Status</span><select className="field-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ProjectStatus })}>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label></div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 font-semibold">Ownership</div><div className="grid gap-2 md:grid-cols-2"><label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label><label className="field-block"><span className="field-label">Owner org</span><input className="field-input" value={draft.ownerOrg ?? ''} onChange={(event) => setDraft({ ...draft, ownerOrg: event.target.value })} /></label><label className="field-block"><span className="field-label">Superintendent</span><input className="field-input" value={draft.superintendent ?? ''} onChange={(event) => setDraft({ ...draft, superintendent: event.target.value })} /></label><label className="field-block"><span className="field-label">Lead assignee</span><input className="field-input" value={draft.leadAssignee ?? ''} onChange={(event) => setDraft({ ...draft, leadAssignee: event.target.value })} /></label></div></div>
                        <details className="rounded-xl border border-slate-200 p-3" open><summary className="cursor-pointer font-semibold">More project details</summary><div className="mt-2 grid gap-2 md:grid-cols-2"><label className="field-block"><span className="field-label">Contract reference</span><input className="field-input" value={draft.contractReference ?? ''} onChange={(event) => setDraft({ ...draft, contractReference: event.target.value })} /></label><label className="field-block"><span className="field-label">Client org</span><input className="field-input" value={draft.clientOrg ?? ''} onChange={(event) => setDraft({ ...draft, clientOrg: event.target.value })} /></label><label className="field-block"><span className="field-label">Phase</span><input className="field-input" value={draft.phase ?? ''} onChange={(event) => setDraft({ ...draft, phase: event.target.value })} /></label><label className="field-block"><span className="field-label">Target completion</span><input type="date" className="field-input" value={(draft.targetCompletionDate || '').slice(0, 10)} onChange={(event) => setDraft({ ...draft, targetCompletionDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' })} /></label><label className="field-block"><span className="field-label">Next milestone</span><input className="field-input" value={draft.nextMilestone ?? ''} onChange={(event) => setDraft({ ...draft, nextMilestone: event.target.value })} /></label><label className="field-block"><span className="field-label">Milestone date</span><input type="date" className="field-input" value={(draft.nextMilestoneDate || '').slice(0, 10)} onChange={(event) => setDraft({ ...draft, nextMilestoneDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' })} /></label><label className="field-block"><span className="field-label">Risk summary</span><input className="field-input" value={draft.riskSummary ?? ''} onChange={(event) => setDraft({ ...draft, riskSummary: event.target.value })} /></label><label className="field-block"><span className="field-label">Current blocker</span><input className="field-input" value={draft.currentBlocker ?? ''} onChange={(event) => setDraft({ ...draft, currentBlocker: event.target.value })} /></label><label className="field-block"><span className="field-label">Closeout readiness (0-100)</span><input type="number" min={0} max={100} className="field-input" value={draft.closeoutReadiness ?? 0} onChange={(event) => setDraft({ ...draft, closeoutReadiness: Number(event.target.value) || 0 })} /></label><label className="field-block"><span className="field-label">Next action</span><input className="field-input" value={draft.projectNextAction ?? ''} onChange={(event) => setDraft({ ...draft, projectNextAction: event.target.value })} /></label><label className="field-block"><span className="field-label">Location</span><input className="field-input" value={draft.location ?? ''} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><label className="field-block"><span className="field-label">Facility / Building</span><input className="field-input" value={[draft.facility, draft.building].filter(Boolean).join(' / ')} onChange={(event) => { const [facility, building] = event.target.value.split('/').map((entry) => entry.trim()); setDraft({ ...draft, facility: facility ?? '', building: building ?? '' }); }} /></label><label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[84px]" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label><label className="field-block md:col-span-2"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={(draft.tags ?? []).join(', ')} onChange={(event) => setDraft({ ...draft, tags: toDelimitedArray(event.target.value) })} /></label></div></details>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Identity</div><div className="mt-1 text-xs text-slate-600">{selectedRow.project.code || 'No project code'} • {selectedRow.project.phase || 'No phase set'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Ownership</div><div className="mt-1 text-xs text-slate-600">Owner: {selectedRow.project.owner || 'Unassigned'} • Superintendent: {selectedRow.project.superintendent || '—'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Contract / client</div><div className="mt-1 text-xs text-slate-600">Client: {selectedRow.project.clientOrg || '—'} • Owner org: {selectedRow.project.ownerOrg || '—'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Schedule / milestones</div><div className="mt-1 text-xs text-slate-600">Target completion: {formatDate(selectedRow.project.targetCompletionDate)} • Next milestone: {selectedRow.project.nextMilestone || '—'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Location</div><div className="mt-1 text-xs text-slate-600">{[selectedRow.project.location, selectedRow.project.facility, selectedRow.project.building].filter(Boolean).join(' • ') || '—'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Operational notes</div><div className="mt-1 text-xs text-slate-600">{selectedRow.project.notes || 'No notes yet.'}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="mb-1 font-semibold">Linked records</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Linked contacts ({linkedContactRecords.length})</div>
                              <div className="space-y-1">{linkedContactRecords.map((contact) => <button key={contact.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenItem(contact.id)}>{contact.name}</button>)}</div>
                              <LinkContactToProjectControl projectId={selectedProjectId} />
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Linked companies ({linkedCompanyRecords.length})</div>
                              <div className="space-y-1">{linkedCompanyRecords.map((company) => <button key={company.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenItem(company.id)}>{company.name}</button>)}</div>
                              <LinkCompanyToProjectControl projectId={selectedProjectId} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                      <button className="action-btn" onClick={() => updateProject(selectedRow.project.id, { archived: !selectedRow.project.archived, lastReviewedAt: todayIso() })}>{selectedRow.project.archived ? 'Unarchive project' : 'Archive project'}</button>
                      <button className="action-btn action-btn-danger" onClick={() => { setDeleteTargetId(projects.find((project) => isGeneralProject(project) && project.id !== selectedRow.project.id)?.id || ''); setDeleteModalOpen(true); }}>Delete project</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="font-semibold">Operational context (secondary)</div>
                    <div className="mt-2 text-xs text-slate-600">Health: {selectedRow.health.tier} ({selectedRow.health.score})</div>
                    <div className="mt-1 text-xs text-slate-600">Open follow-ups: {selectedRow.openFollowUps.length} • Open tasks: {selectedRow.openTasks.length}</div>
                    <div className="mt-1 text-xs text-slate-600">Overdue: {selectedRow.overdueFollowUpCount + selectedRow.overdueTaskCount} • Blocked tasks: {selectedRow.blockedTaskCount}</div>
                    <div className="mt-3 space-y-1">{selectedRow.health.reasons.map((reason) => <div key={reason} className="text-xs text-slate-700">• {reason}</div>)}</div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'people' ? <DirectoryRelationshipsView kind="people" projectId={selectedProjectId} /> : null}
      {tab === 'companies' ? <DirectoryRelationshipsView kind="companies" projectId={selectedProjectId} /> : null}

      {showCreateModal ? (
        <AppModal size="xl" onClose={() => setShowCreateModal(false)} onBackdropClick={() => setShowCreateModal(false)}>
          <AppModalHeader title="New Project" subtitle="Capture clean project directory metadata before routing operational work." onClose={() => setShowCreateModal(false)} />
          <AppModalBody>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="field-block"><span className="field-label">Project name *</span><input className="field-input" placeholder="e.g. North Plant Retrofit" value={createDraft.name} onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))} /><span className="text-xs text-slate-500">Use the official project title.</span></label>
              <label className="field-block"><span className="field-label">Project code</span><input className="field-input" value={createDraft.code ?? ''} onChange={(event) => setCreateDraft((prev) => ({ ...prev, code: event.target.value }))} /><span className="text-xs text-slate-500">Internal contract or ERP code.</span></label>
              <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={createDraft.owner} onChange={(event) => setCreateDraft((prev) => ({ ...prev, owner: event.target.value }))} /><span className="text-xs text-slate-500">Accountable project owner.</span></label>
              <label className="field-block"><span className="field-label">Status</span><select className="field-input" value={createDraft.status} onChange={(event) => setCreateDraft((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="field-block"><span className="field-label">Client / owner org</span><input className="field-input" value={createDraft.clientOrg ?? ''} onChange={(event) => setCreateDraft((prev) => ({ ...prev, clientOrg: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">Phase</span><input className="field-input" value={createDraft.phase ?? ''} onChange={(event) => setCreateDraft((prev) => ({ ...prev, phase: event.target.value }))} /></label>
              <label className="field-block"><span className="field-label">Target completion date</span><input type="date" className="field-input" value={(createDraft.targetCompletionDate || '').slice(0, 10)} onChange={(event) => setCreateDraft((prev) => ({ ...prev, targetCompletionDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' }))} /></label>
              <label className="field-block"><span className="field-label">Location / facility / building</span><input className="field-input" value={[createDraft.location, createDraft.facility, createDraft.building].filter(Boolean).join(' / ')} onChange={(event) => { const [location, facility, building] = event.target.value.split('/').map((entry) => entry.trim()); setCreateDraft((prev) => ({ ...prev, location: location ?? '', facility: facility ?? '', building: building ?? '' })); }} /></label>
              <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[80px]" value={createDraft.notes} onChange={(event) => setCreateDraft((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            </div>
            {createWarnings.length > 0 ? <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{createWarnings.map((warning) => <div key={warning}>• {warning}</div>)}</div> : null}
            <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={() => setShowCreateModal(false)}>Cancel</button><button className="primary-btn" onClick={saveCreate}>Save project</button></div>
          </AppModalBody>
        </AppModal>
      ) : null}

      {deleteModalOpen && selectedRow ? (
        <AppModal size="md" onClose={() => setDeleteModalOpen(false)} onBackdropClick={() => setDeleteModalOpen(false)}>
          <AppModalHeader title="Delete project" subtitle="Archive is recommended unless this was created in error." onClose={() => setDeleteModalOpen(false)} />
          <AppModalBody>
            <div className="space-y-2 text-sm">
              <div>Impacted follow-ups: {items.filter((item) => item.projectId === selectedRow.project.id).length}</div>
              <div>Impacted tasks: {tasks.filter((task) => task.projectId === selectedRow.project.id).length}</div>
              <div>Impacted docs: {intakeDocuments.filter((doc) => doc.projectId === selectedRow.project.id).length}</div>
              <label className="field-block"><span className="field-label">Reassign linked records to</span><select className="field-input" value={deleteTargetId} onChange={(event) => setDeleteTargetId(event.target.value)}>{projects.filter((project) => project.id !== selectedRow.project.id).map((project) => <option key={project.id} value={project.id}>{isGeneralProject(project) ? 'Unclassified (General)' : project.name}</option>)}</select></label>
              {projects.find((project) => project.id === deleteTargetId && isGeneralProject(project)) ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Warning: assigning to General/Unclassified should be temporary.</div> : null}
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />I understand this removes the project record and reassigns linked work.</label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={() => setDeleteModalOpen(false)}>Cancel</button><button className="action-btn action-btn-danger" disabled={!deleteTargetId || !deleteConfirm} onClick={() => { reassignProjectRecords(selectedRow.project.id, deleteTargetId, ['followups', 'tasks', 'docs']); deleteProject(selectedRow.project.id, deleteTargetId); setDeleteModalOpen(false); }}>Delete project</button></div>
          </AppModalBody>
        </AppModal>
      ) : null}
    </div>
  );
}

function DirectoryRelationshipsView({ kind, projectId }: { kind: 'people' | 'companies'; projectId?: string }) {
  const { contacts, companies, items, tasks, projects } = useAppStore(useShallow((s) => ({ contacts: s.contacts, companies: s.companies, items: s.items, tasks: s.tasks, projects: s.projects })));
  const [query, setQuery] = useState('');
  const records = useMemo(() => {
    if (kind === 'people') {
      return contacts
        .filter((contact) => contact.name.toLowerCase().includes(query.trim().toLowerCase()))
        .map((contact) => ({
          id: contact.id,
          name: contact.name,
          subtitle: contact.role || 'Contact',
          linkedProjects: getContactLinkedRecords(contact.id, { items, tasks, contacts, companies, projects }).projects,
        }));
    }
    return companies
      .filter((company) => company.name.toLowerCase().includes(query.trim().toLowerCase()))
      .map((company) => ({
        id: company.id,
        name: company.name,
        subtitle: company.type,
        linkedProjects: getCompanyLinkedRecords(company.id, { items, tasks, contacts, companies, projects }).projects,
      }));
  }, [companies, contacts, items, kind, projects, query, tasks]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-950">{kind === 'people' ? 'People directory' : 'Company directory'}</div>
          <div className="text-xs text-slate-600">Linked projects are visible here to keep directory context bi-directional.</div>
        </div>
        <input className="field-input max-w-56" placeholder={`Search ${kind}`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {records.length === 0 ? <StatePanel tone="empty" title={`No ${kind}`} message="No records match your current search." /> : (
        <div className="grid gap-2 md:grid-cols-2">
          {records.map((record) => (
            <div key={record.id} className="rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-slate-900">{record.name}</div>
              <div className="text-xs text-slate-600">{record.subtitle}</div>
              <div className="mt-2 text-xs text-slate-600">Linked projects: {record.linkedProjects.length === 0 ? '—' : record.linkedProjects.map((project) => project.name).join(', ')}</div>
              {projectId ? <div className="mt-2 text-[11px] text-slate-500">Current project in context: {projects.find((project) => project.id === projectId)?.name || 'None selected'}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
