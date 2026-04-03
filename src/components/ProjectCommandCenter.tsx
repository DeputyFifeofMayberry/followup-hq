import { AlertTriangle, ClipboardCopy, FileText, FolderOpen, LayoutGrid, List, Plus, RefreshCcw, ShieldAlert, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  applyProjectFilters,
  applyProjectSort,
  buildProjectDerivedRecords,
  buildProjectStatusReport,
  defaultProjectFilters,
  projectSavedViews,
  type ProjectFilterState,
  type ProjectSavedViewKey,
} from '../lib/projectSelectors';
import { addDaysIso, createId, formatDate, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { ProjectCardDisplayMode, ProjectSortKey, SavedViewKey } from '../types';
import { AppShellCard, SectionHeader, StatTile } from './ui/AppPrimitives';

export function ProjectCommandCenter({ onFocusTracker, onOpenItem }: { onFocusTracker: (view: SavedViewKey, project?: string) => void; onOpenItem: (itemId: string, view?: SavedViewKey, project?: string) => void }) {
  const {
    items, contacts, companies, projects, tasks, intakeDocuments,
    addProject, updateProject, deleteProject, reassignProjectRecords,
    addTask, addItem, addIntakeDocument, updateTask, batchUpdateFollowUps,
    setProjectFilter, setActiveView,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    projects: s.projects,
    tasks: s.tasks,
    intakeDocuments: s.intakeDocuments,
    addProject: s.addProject,
    updateProject: s.updateProject,
    deleteProject: s.deleteProject,
    reassignProjectRecords: s.reassignProjectRecords,
    addTask: s.addTask,
    addItem: s.addItem,
    addIntakeDocument: s.addIntakeDocument,
    updateTask: s.updateTask,
    batchUpdateFollowUps: s.batchUpdateFollowUps,
    setProjectFilter: s.setProjectFilter,
    setActiveView: s.setActiveView,
  })));

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [displayMode, setDisplayMode] = useState<ProjectCardDisplayMode>('expanded');
  const [sortKey, setSortKey] = useState<ProjectSortKey>('health');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [savedView, setSavedView] = useState<ProjectSavedViewKey>('All projects');
  const [filters, setFilters] = useState<ProjectFilterState>(defaultProjectFilters);
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [deleteTargetProjectId, setDeleteTargetProjectId] = useState('');
  const [selectedFollowUpIds, setSelectedFollowUpIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectOwner, setNewProjectOwner] = useState('Jared');

  const allRows = useMemo(() => buildProjectDerivedRecords(projects, items, tasks, intakeDocuments, contacts, companies), [projects, items, tasks, intakeDocuments, contacts, companies]);
  const filteredRows = useMemo(() => applyProjectFilters(allRows, filters), [allRows, filters]);
  const sortedRows = useMemo(() => applyProjectSort(filteredRows, sortKey, sortDirection), [filteredRows, sortKey, sortDirection]);

  useEffect(() => {
    if (!sortedRows.length) return;
    if (!selectedProjectId || !sortedRows.some((row) => row.project.id === selectedProjectId)) {
      setSelectedProjectId(sortedRows[0].project.id);
    }
  }, [selectedProjectId, sortedRows]);

  const selectedRow = sortedRows.find((row) => row.project.id === selectedProjectId) || null;
  const selectedProject = selectedRow?.project || null;

  useEffect(() => {
    setSelectedFollowUpIds([]);
    setSelectedTaskIds([]);
  }, [selectedProjectId]);

  const reportText = useMemo(() => (selectedRow ? buildProjectStatusReport(selectedRow) : ''), [selectedRow]);

  const createProject = () => {
    if (!newProjectName.trim()) return;
    const id = addProject({ name: newProjectName.trim(), owner: newProjectOwner.trim() || 'Unassigned', status: 'Active', notes: '', tags: [] });
    setSelectedProjectId(id);
    setNewProjectName('');
  };

  const applySavedView = (key: ProjectSavedViewKey) => {
    const preset = projectSavedViews.find((view) => view.key === key);
    if (!preset) return;
    setSavedView(key);
    setFilters({ ...defaultProjectFilters, ...preset.filters });
    setSortKey(preset.sortKey);
    setSortDirection(preset.sortDirection);
  };

  const openProjectScopedQueue = (kind: 'overdue' | 'waiting' | 'blocked' | 'closeout') => {
    if (!selectedProject) return;
    setProjectFilter(selectedProject.name);
    if (kind === 'waiting') setActiveView('Waiting on others');
    if (kind === 'overdue') setActiveView('Overdue');
    if (kind === 'blocked') setActiveView('Blocked by child tasks');
    if (kind === 'closeout') setActiveView('Ready to close');
    onFocusTracker('By project', selectedProject.name);
  };

  const createProjectFollowUp = () => {
    if (!selectedProject) return;
    addItem({
      id: createId(), title: 'New project follow-up', source: 'Notes', project: selectedProject.name, projectId: selectedProject.id,
      owner: selectedProject.owner, status: 'Needs action', priority: 'Medium', dueDate: addDaysIso(todayIso(), 2),
      lastTouchDate: todayIso(), nextTouchDate: addDaysIso(todayIso(), 2), nextAction: 'Define next action and assignee.', summary: '',
      tags: ['Project scoped'], sourceRef: 'Project command center', sourceRefs: [], mergedItemIds: [], notes: '', timeline: [],
      category: 'General', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3,
    });
  };

  const createProjectTask = () => {
    if (!selectedProject) return;
    addTask({
      id: createId('TSK'), title: 'New project task', project: selectedProject.name, projectId: selectedProject.id, owner: selectedProject.owner,
      status: 'To do', priority: 'Medium', summary: '', nextStep: 'Define first execution step.', notes: '', tags: ['Project scoped'],
      createdAt: todayIso(), updatedAt: todayIso(),
    });
  };

  const createProjectDoc = () => {
    if (!selectedProject) return;
    addIntakeDocument({ name: `Reference - ${selectedProject.name}`, kind: 'Document', projectId: selectedProject.id, owner: selectedProject.owner, sourceRef: 'Project command center', notes: '' });
  };

  return (
    <AppShellCard className="project-command-surface" surface="command">
      <SectionHeader title="Project command center" subtitle="Curated command surface for portfolio scan, project health, and execution workflows." />
      <div className="project-command-layout">
        <div className="project-list-rail page-section">
          <div className="project-create-row">
            <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="field-input" placeholder="Project name" />
            <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} className="field-input" placeholder="Owner" />
            <button onClick={createProject} className="primary-btn"><Plus className="h-4 w-4" />Add</button>
          </div>

          <div className="project-filter-panel advanced-filter-surface">
            <input value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))} className="field-input" placeholder="Search by project, owner, code, phase" />
            <div className="grid gap-2 md:grid-cols-2">
              <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as ProjectFilterState['status'] }))} className="field-input"><option value="All">All statuses</option><option>Active</option><option>On hold</option><option>Closeout</option><option>Complete</option></select>
              <select value={filters.owner} onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))} className="field-input"><option value="All">All owners</option>{[...new Set(projects.map((project) => project.owner))].map((owner) => <option key={owner}>{owner}</option>)}</select>
              <select value={filters.healthTier} onChange={(e) => setFilters((prev) => ({ ...prev, healthTier: e.target.value as ProjectFilterState['healthTier'] }))} className="field-input"><option value="All">Any health</option><option>Critical</option><option>High</option><option>Moderate</option><option>Low</option></select>
              <select value={filters.activity} onChange={(e) => setFilters((prev) => ({ ...prev, activity: e.target.value as ProjectFilterState['activity'] }))} className="field-input"><option value="all">Any activity</option><option value="recent">Recently updated</option><option value="stale">Stale</option></select>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select value={filters.hasOverdueFollowUp} onChange={(e) => setFilters((prev) => ({ ...prev, hasOverdueFollowUp: e.target.value as ProjectFilterState['hasOverdueFollowUp'] }))} className="field-input"><option value="all">Any overdue follow-up</option><option value="yes">Has overdue follow-up</option><option value="no">No overdue follow-up</option></select>
              <select value={filters.hasBlockedTask} onChange={(e) => setFilters((prev) => ({ ...prev, hasBlockedTask: e.target.value as ProjectFilterState['hasBlockedTask'] }))} className="field-input"><option value="all">Any blocked tasks</option><option value="yes">Has blocked task</option><option value="no">No blocked task</option></select>
              <select value={filters.hasOverdueTask} onChange={(e) => setFilters((prev) => ({ ...prev, hasOverdueTask: e.target.value as ProjectFilterState['hasOverdueTask'] }))} className="field-input"><option value="all">Any overdue tasks</option><option value="yes">Has overdue task</option><option value="no">No overdue task</option></select>
            </div>
            <div className="project-filter-foot">
              <div className="flex flex-wrap gap-2">
                {projectSavedViews.map((view) => <button key={view.key} onClick={() => applySavedView(view.key)} className={savedView === view.key ? 'action-btn !border-amber-500 !bg-amber-50' : 'action-btn'}>{view.label}</button>)}
              </div>
              <div className="flex gap-2">
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as ProjectSortKey)} className="field-input"><option value="health">Sort: health</option><option value="name">Sort: name</option><option value="updated">Sort: updated</option><option value="targetDate">Sort: target date</option><option value="overdueWork">Sort: overdue work</option></select>
                <button onClick={() => setSortDirection((prev) => prev === 'desc' ? 'asc' : 'desc')} className="action-btn">{sortDirection === 'desc' ? 'Desc' : 'Asc'}</button>
                <button onClick={() => setDisplayMode((prev) => prev === 'compact' ? 'expanded' : 'compact')} className="action-btn">{displayMode === 'compact' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}</button>
                <button onClick={() => { setFilters(defaultProjectFilters); setSavedView('All projects'); }} className="action-btn">Reset</button>
              </div>
            </div>
          </div>

          <div className="project-card-list">
            {sortedRows.map((row) => (
              <button key={row.project.id} onClick={() => setSelectedProjectId(row.project.id)} className={selectedProjectId === row.project.id ? 'project-card project-card-active list-row-family-active' : 'project-card'}>
                <div className="project-card-head">
                  <div>
                    <div className="font-medium text-slate-900">{row.project.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.project.owner} • {row.project.status}</div>
                  </div>
                  <div className="text-right"><div className="text-xs text-slate-500">Health</div><div className="text-sm font-semibold text-slate-900">{row.health.score} ({row.health.tier})</div></div>
                </div>
                {displayMode === 'expanded' ? <div className="project-card-grid"><span>FU open {row.openFollowUps.length}</span><span>Task open {row.openTasks.length}</span><span>Docs {row.intakeDocs.length}</span><span>FU overdue {row.overdueFollowUpCount}</span><span>Task blocked {row.blockedTaskCount}</span><span>Task overdue {row.overdueTaskCount}</span></div> : null}
                <div className="mt-2 text-[11px] text-slate-500">{row.health.reasons.slice(0, 2).join(' • ') || 'No pressure signals'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="project-detail-pane">
          {selectedProject && selectedRow ? (
            <>
              <div className="project-detail-top">
                <div>
                  <h3 className="inspector-title">{selectedProject.name}</h3>
                  <p className="inspector-meta">Project-centered command view with health, open work, and execution actions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onFocusTracker('By project', selectedProject.name)} className="action-btn"><RefreshCcw className="h-4 w-4" />Focus tracker</button>
                  <button onClick={async () => { await navigator.clipboard.writeText(reportText); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="primary-btn"><ClipboardCopy className="h-4 w-4" />{copied ? 'Copied' : 'Copy report'}</button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <input value={selectedProject.name} onChange={(e) => updateProject(selectedProject.id, { name: e.target.value })} className="field-input" placeholder="Project name" />
                <input value={selectedProject.owner} onChange={(e) => updateProject(selectedProject.id, { owner: e.target.value })} className="field-input" placeholder="Project owner" />
                <input value={selectedProject.code || ''} onChange={(e) => updateProject(selectedProject.id, { code: e.target.value })} className="field-input" placeholder="Project code" />
                <input value={selectedProject.contractReference || ''} onChange={(e) => updateProject(selectedProject.id, { contractReference: e.target.value })} className="field-input" placeholder="Contract/reference" />
                <input value={selectedProject.clientOrg || ''} onChange={(e) => updateProject(selectedProject.id, { clientOrg: e.target.value })} className="field-input" placeholder="Client / owner org" />
                <input value={selectedProject.phase || ''} onChange={(e) => updateProject(selectedProject.id, { phase: e.target.value })} className="field-input" placeholder="Phase" />
                <input type="date" value={(selectedProject.targetCompletionDate || '').slice(0, 10)} onChange={(e) => updateProject(selectedProject.id, { targetCompletionDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })} className="field-input" />
                <input value={selectedProject.nextMilestone || ''} onChange={(e) => updateProject(selectedProject.id, { nextMilestone: e.target.value })} className="field-input" placeholder="Next milestone" />
                <input value={selectedProject.projectNextAction || ''} onChange={(e) => updateProject(selectedProject.id, { projectNextAction: e.target.value })} className="field-input" placeholder="Project-level next action" />
                <select value={selectedProject.status} onChange={(e) => updateProject(selectedProject.id, { status: e.target.value as typeof selectedProject.status })} className="field-input"><option>Active</option><option>On hold</option><option>Closeout</option><option>Complete</option></select>
              </div>
              <textarea value={selectedProject.currentBlocker || ''} onChange={(e) => updateProject(selectedProject.id, { currentBlocker: e.target.value })} className="field-textarea mt-3" placeholder="Current blocker" />
              <textarea value={selectedProject.notes} onChange={(e) => updateProject(selectedProject.id, { notes: e.target.value })} className="field-textarea mt-2" placeholder="Project notes" />

              <div className="overview-stat-grid overview-stat-grid-compact">
                <StatTile label="Open follow-ups" value={selectedRow.health.breakdown.openFollowUps} helper="Requires project attention" />
                <StatTile label="Overdue + blocked" value={selectedRow.health.breakdown.overdueFollowUps + selectedRow.health.breakdown.blockedTasks} helper="Urgent pressure" tone={selectedRow.health.breakdown.overdueFollowUps + selectedRow.health.breakdown.blockedTasks > 0 ? 'warn' : 'default'} />
                <StatTile label="Doc review" value={selectedRow.health.breakdown.docsNeedingReview + selectedRow.health.breakdown.staleIntakeDocs} helper="Intake quality pressure" />
              </div>

              <div className="project-health-grid">
                <div>Overdue FU: <strong>{selectedRow.health.breakdown.overdueFollowUps}</strong></div>
                <div>Needs nudge: <strong>{selectedRow.health.breakdown.needsNudge}</strong></div>
                <div>Blocked tasks: <strong>{selectedRow.health.breakdown.blockedTasks}</strong></div>
                <div>Overdue tasks: <strong>{selectedRow.health.breakdown.overdueTasks}</strong></div>
                <div>Deferred tasks: <strong>{selectedRow.health.breakdown.deferredTasks}</strong></div>
                <div>Ready-close signals: <strong>{selectedRow.health.breakdown.readyToCloseSignals}</strong></div>
              </div>

              <div className="project-action-groups">
                <button onClick={createProjectFollowUp} className="action-btn"><FileText className="h-4 w-4" />New follow-up</button>
                <button onClick={createProjectTask} className="action-btn"><Plus className="h-4 w-4" />New task</button>
                <button onClick={createProjectDoc} className="action-btn"><FolderOpen className="h-4 w-4" />Add intake doc</button>
                <button onClick={() => openProjectScopedQueue('blocked')} className="action-btn"><ShieldAlert className="h-4 w-4" />Blocked work</button>
                <button onClick={() => openProjectScopedQueue('overdue')} className="action-btn"><AlertTriangle className="h-4 w-4" />Overdue work</button>
                <button onClick={() => openProjectScopedQueue('waiting')} className="action-btn"><Timer className="h-4 w-4" />Waiting work</button>
                <button onClick={() => openProjectScopedQueue('closeout')} className="action-btn">Closeout ready</button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="project-subpanel inspector-block">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open follow-ups</span><button onClick={() => setSelectedFollowUpIds(selectedRow.openFollowUps.map((item) => item.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="project-entity-list">
                    {selectedRow.openFollowUps.map((item) => (
                      <label key={item.id} className="project-entity-row">
                        <div className="flex items-start gap-2"><input type="checkbox" checked={selectedFollowUpIds.includes(item.id)} onChange={(e) => setSelectedFollowUpIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} /><button onClick={() => onOpenItem(item.id, 'By project', selectedProject.name)} className="text-left"><div className="font-medium text-slate-900">{item.title}</div><div className="text-xs text-slate-500">Due {formatDate(item.dueDate)} • {item.status}</div></button></div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { status: 'Closed', actionState: 'Complete' }, 'Bulk closed from project center')} className="action-btn">Bulk close</button>
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { escalationLevel: 'Critical' }, 'Bulk escalated from project center')} className="action-btn">Bulk escalate</button>
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { nextTouchDate: addDaysIso(todayIso(), 2) }, 'Bulk snoozed +2 days from project center')} className="action-btn">Bulk snooze</button>
                  </div>
                </div>

                <div className="project-subpanel inspector-block">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open tasks</span><button onClick={() => setSelectedTaskIds(selectedRow.openTasks.map((task) => task.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="project-entity-list">
                    {selectedRow.openTasks.map((task) => (
                      <label key={task.id} className="project-entity-row">
                        <div className="flex items-start gap-2"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={(e) => setSelectedTaskIds((prev) => e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id))} /><div><div className="font-medium text-slate-900">{task.title}</div><div className="text-xs text-slate-500">{task.status} • Due {formatDate(task.dueDate)}</div></div></div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { status: 'Done' }))} className="action-btn">Bulk close</button>
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { status: 'Blocked' }))} className="action-btn">Bulk escalate</button>
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { deferredUntil: addDaysIso(todayIso(), 2), status: 'To do' }))} className="action-btn">Bulk snooze</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="project-subpanel inspector-block"><div className="text-sm font-semibold text-slate-900">Project relationships</div><div className="mt-2 text-sm text-slate-700">Contacts ({selectedRow.contacts.length}): {selectedRow.contacts.map((contact) => contact.name).join(', ') || '—'}</div><div className="mt-1 text-sm text-slate-700">Companies ({selectedRow.companies.length}): {selectedRow.companies.map((company) => company.name).join(', ') || '—'}</div></div>
                <div className="project-subpanel inspector-block"><div className="text-sm font-semibold text-slate-900">Project activity feed</div><div className="mt-2 max-h-56 space-y-1 overflow-auto text-xs text-slate-600">{[...selectedRow.openFollowUps.map((item) => ({ at: item.lastTouchDate, label: `[Follow-up] ${item.title}` })), ...selectedRow.openTasks.map((task) => ({ at: task.updatedAt, label: `[Task] ${task.title}` })), ...selectedRow.intakeDocs.map((doc) => ({ at: doc.uploadedAt, label: `[Doc] ${doc.name}` })), { at: selectedProject.updatedAt, label: '[Project] Metadata updated' }].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 16).map((event, index) => <div key={`${event.at}-${index}`}>{formatDate(event.at)} • {event.label}</div>)}</div></div>
              </div>

              <div className="project-subpanel inspector-block">
                <div className="mb-2 text-sm font-semibold text-slate-900">Project review workflow</div>
                <div className="grid gap-2 md:grid-cols-2 text-sm text-slate-700">
                  <div>Top risks: {selectedRow.health.reasons.slice(0, 3).join(', ') || 'None'}</div>
                  <div>Blockers: {selectedProject.currentBlocker || `${selectedRow.blockedTaskCount} blocked tasks`}</div>
                  <div>Stale items: {selectedRow.health.breakdown.staleActivityDays >= 10 ? `${selectedRow.health.breakdown.staleActivityDays} days since major update` : 'No stale signal'}</div>
                  <button onClick={() => updateProject(selectedProject.id, { lastReviewedAt: todayIso() })} className="action-btn justify-center">Mark reviewed now</button>
                </div>
              </div>

              <div className="project-subpanel inspector-block"><label className="mb-2 block text-sm font-medium text-slate-700">Project status output</label><textarea value={reportText} readOnly className="field-textarea" style={{ minHeight: 220 }} /></div>

              <div className="rounded-2xl border border-rose-200 p-4">
                <div className="mb-2 text-sm font-semibold text-rose-700">Archive / delete project</div>
                <button onClick={() => { setDeleteFlowOpen((prev) => !prev); setDeleteTargetProjectId(projects.find((project) => project.name === 'General')?.id || ''); }} className="action-btn action-btn-danger">{deleteFlowOpen ? 'Hide delete workflow' : 'Open safe delete workflow'}</button>
                {deleteFlowOpen ? <div className="mt-3 space-y-2 text-sm"><div>Impacted records: {selectedRow.openFollowUps.length} follow-ups, {selectedRow.openTasks.length} tasks, {selectedRow.intakeDocs.length} docs.</div><select value={deleteTargetProjectId} onChange={(e) => setDeleteTargetProjectId(e.target.value)} className="field-input">{projects.filter((project) => project.id !== selectedProject.id).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><div className="flex flex-wrap gap-2"><button onClick={() => reassignProjectRecords(selectedProject.id, deleteTargetProjectId, ['followups', 'tasks', 'docs'])} className="action-btn">Reassign child records</button><button onClick={() => deleteProject(selectedProject.id, deleteTargetProjectId)} className="action-btn action-btn-danger">Confirm delete</button></div></div> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AppShellCard>
  );
}
