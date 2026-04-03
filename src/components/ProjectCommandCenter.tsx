import {
  AlertTriangle,
  ClipboardCopy,
  FileText,
  Filter,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Timer,
} from 'lucide-react';
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

export function ProjectCommandCenter({ onFocusTracker, onOpenItem }: { onFocusTracker: (view: SavedViewKey, project?: string) => void; onOpenItem: (itemId: string, view?: SavedViewKey, project?: string) => void }) {
  const {
    items,
    contacts,
    companies,
    projects,
    tasks,
    intakeDocuments,
    addProject,
    updateProject,
    deleteProject,
    reassignProjectRecords,
    addTask,
    addItem,
    addIntakeDocument,
    updateTask,
    batchUpdateFollowUps,
    setProjectFilter,
    setActiveView,
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
      id: createId(),
      title: 'New project follow-up',
      source: 'Notes',
      project: selectedProject.name,
      projectId: selectedProject.id,
      owner: selectedProject.owner,
      status: 'Needs action',
      priority: 'Medium',
      dueDate: addDaysIso(todayIso(), 2),
      lastTouchDate: todayIso(),
      nextTouchDate: addDaysIso(todayIso(), 2),
      nextAction: 'Define next action and assignee.',
      summary: '',
      tags: ['Project scoped'],
      sourceRef: 'Project command center',
      sourceRefs: [],
      mergedItemIds: [],
      notes: '',
      timeline: [],
      category: 'General',
      owesNextAction: 'Unknown',
      escalationLevel: 'None',
      cadenceDays: 3,
    });
  };

  const createProjectTask = () => {
    if (!selectedProject) return;
    addTask({
      id: createId('TSK'),
      title: 'New project task',
      project: selectedProject.name,
      projectId: selectedProject.id,
      owner: selectedProject.owner,
      status: 'To do',
      priority: 'Medium',
      summary: '',
      nextStep: 'Define first execution step.',
      notes: '',
      tags: ['Project scoped'],
      createdAt: todayIso(),
      updatedAt: todayIso(),
    });
  };

  const createProjectDoc = () => {
    if (!selectedProject) return;
    addIntakeDocument({ name: `Reference - ${selectedProject.name}`, kind: 'Document', projectId: selectedProject.id, owner: selectedProject.owner, sourceRef: 'Project command center', notes: '' });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Project command center</h2>
        <p className="mt-1 text-sm text-slate-500">Scan the portfolio, isolate pressure, and run project-level reviews without leaving this tab.</p>
      </div>

      <div className="grid gap-6 p-4 xl:grid-cols-[0.96fr_1.04fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Add project</div>
            <div className="grid gap-2 sm:grid-cols-[1.15fr_1fr_auto]">
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="field-input" placeholder="Project name" />
              <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} className="field-input" placeholder="Owner" />
              <button onClick={createProject} className="primary-btn"><Plus className="h-4 w-4" />Add</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
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
            <div className="grid gap-2 md:grid-cols-3">
              <select value={filters.hasNeedsNudge} onChange={(e) => setFilters((prev) => ({ ...prev, hasNeedsNudge: e.target.value as ProjectFilterState['hasNeedsNudge'] }))} className="field-input"><option value="all">Any nudge state</option><option value="yes">Needs nudge exists</option><option value="no">No nudge pressure</option></select>
              <select value={filters.intakeReview} onChange={(e) => setFilters((prev) => ({ ...prev, intakeReview: e.target.value as ProjectFilterState['intakeReview'] }))} className="field-input"><option value="all">Any intake review state</option><option value="needs_review">Needs review</option><option value="stale_docs">Stale docs</option><option value="none">No doc pressure</option></select>
              <button onClick={() => { setFilters(defaultProjectFilters); setSavedView('All projects'); }} className="action-btn"><Filter className="h-4 w-4" />Reset</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {projectSavedViews.map((view) => (
                <button key={view.key} onClick={() => applySavedView(view.key)} className={savedView === view.key ? 'action-btn !bg-slate-900 !text-white' : 'action-btn'}>{view.label}</button>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as ProjectSortKey)} className="field-input"><option value="health">Sort: health</option><option value="name">Sort: name</option><option value="updated">Sort: updated</option><option value="targetDate">Sort: target date</option><option value="overdueWork">Sort: overdue work</option></select>
              <button onClick={() => setSortDirection((prev) => prev === 'desc' ? 'asc' : 'desc')} className="action-btn">{sortDirection === 'desc' ? 'Desc' : 'Asc'}</button>
              <button onClick={() => setDisplayMode((prev) => prev === 'compact' ? 'expanded' : 'compact')} className="action-btn">{displayMode === 'compact' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}{displayMode}</button>
            </div>
          </div>

          <div className="grid gap-2 max-h-[52rem] overflow-auto pr-1">
            {sortedRows.map((row) => (
              <button key={row.project.id} onClick={() => setSelectedProjectId(row.project.id)} className={selectedProjectId === row.project.id ? 'rounded-2xl border border-sky-300 bg-sky-50 p-3 text-left' : 'rounded-2xl border border-slate-200 p-3 text-left'}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{row.project.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.project.owner} • {row.project.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Health</div>
                    <div className="text-sm font-semibold text-slate-900">{row.health.score} ({row.health.tier})</div>
                  </div>
                </div>
                {displayMode === 'expanded' ? (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-slate-600">
                    <div>FU open: {row.openFollowUps.length}</div><div>Task open: {row.openTasks.length}</div><div>Docs: {row.intakeDocs.length}</div>
                    <div>FU overdue: {row.overdueFollowUpCount}</div><div>Task blocked: {row.blockedTaskCount}</div><div>Task overdue: {row.overdueTaskCount}</div>
                  </div>
                ) : null}
                <div className="mt-2 text-[11px] text-slate-500">{row.health.reasons.slice(0, 2).join(' • ') || 'No pressure signals'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {selectedProject && selectedRow ? (
            <>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{selectedProject.name}</div>
                    <div className="mt-1 text-sm text-slate-500">PM snapshot with follow-up pressure, task pressure, blockers, stale signals, and next action context.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onFocusTracker('By project', selectedProject.name)} className="action-btn"><RefreshCcw className="h-4 w-4" />Focus tracker</button>
                    <button onClick={async () => { await navigator.clipboard.writeText(reportText); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="primary-btn"><ClipboardCopy className="h-4 w-4" />{copied ? 'Copied' : 'Copy report'}</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
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
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Health breakdown</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-700">
                  <div>Open FU: {selectedRow.health.breakdown.openFollowUps}</div><div>Overdue FU: {selectedRow.health.breakdown.overdueFollowUps}</div><div>Needs nudge: {selectedRow.health.breakdown.needsNudge}</div>
                  <div>Blocked tasks: {selectedRow.health.breakdown.blockedTasks}</div><div>Overdue tasks: {selectedRow.health.breakdown.overdueTasks}</div><div>Deferred tasks: {selectedRow.health.breakdown.deferredTasks}</div>
                  <div>Ready-close signals: {selectedRow.health.breakdown.readyToCloseSignals}</div><div>Docs need review: {selectedRow.health.breakdown.docsNeedingReview}</div><div>Stale docs: {selectedRow.health.breakdown.staleIntakeDocs}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {selectedRow.health.indicators.blocked ? <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">blocked</span> : null}
                  {selectedRow.health.indicators.overdue ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">overdue</span> : null}
                  {selectedRow.health.indicators.stale ? <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700">stale</span> : null}
                  {selectedRow.health.indicators.waitingHeavy ? <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">waiting-heavy</span> : null}
                  {selectedRow.health.indicators.closeoutReady ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">closeout-ready</span> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">Project-scoped actions</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={createProjectFollowUp} className="action-btn"><FileText className="h-4 w-4" />New follow-up</button>
                  <button onClick={createProjectTask} className="action-btn"><Plus className="h-4 w-4" />New task</button>
                  <button onClick={createProjectDoc} className="action-btn"><FolderOpen className="h-4 w-4" />Add intake doc</button>
                  <button onClick={() => openProjectScopedQueue('blocked')} className="action-btn"><ShieldAlert className="h-4 w-4" />Open blocked work</button>
                  <button onClick={() => openProjectScopedQueue('overdue')} className="action-btn"><AlertTriangle className="h-4 w-4" />Open overdue work</button>
                  <button onClick={() => openProjectScopedQueue('waiting')} className="action-btn"><Timer className="h-4 w-4" />Open waiting work</button>
                  <button onClick={() => openProjectScopedQueue('closeout')} className="action-btn">Open closeout-ready work</button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open follow-ups</span><button onClick={() => setSelectedFollowUpIds(selectedRow.openFollowUps.map((item) => item.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {selectedRow.openFollowUps.map((item) => (
                      <label key={item.id} className="block rounded-xl border border-slate-200 p-2 text-sm">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={selectedFollowUpIds.includes(item.id)} onChange={(e) => setSelectedFollowUpIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} />
                          <button onClick={() => onOpenItem(item.id, 'By project', selectedProject.name)} className="text-left">
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500">Due {formatDate(item.dueDate)} • {item.status}</div>
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { status: 'Closed', actionState: 'Complete' }, 'Bulk closed from project center')} className="action-btn">Bulk close</button>
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { escalationLevel: 'Critical' }, 'Bulk escalated from project center')} className="action-btn">Bulk escalate</button>
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { nextTouchDate: addDaysIso(todayIso(), 2) }, 'Bulk snoozed +2 days from project center')} className="action-btn">Bulk snooze</button>
                    <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { tags: ['Project review'] }, 'Bulk tagged from project center')} className="action-btn">Bulk tag</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open tasks</span><button onClick={() => setSelectedTaskIds(selectedRow.openTasks.map((task) => task.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {selectedRow.openTasks.map((task) => (
                      <label key={task.id} className="block rounded-xl border border-slate-200 p-2 text-sm">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={(e) => setSelectedTaskIds((prev) => e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id))} />
                          <div>
                            <div className="font-medium text-slate-900">{task.title}</div>
                            <div className="text-xs text-slate-500">{task.status} • Due {formatDate(task.dueDate)}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { status: 'Done' }))} className="action-btn">Bulk close</button>
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { status: 'Blocked' }))} className="action-btn">Bulk escalate</button>
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { deferredUntil: addDaysIso(todayIso(), 2), status: 'To do' }))} className="action-btn">Bulk snooze</button>
                    <button onClick={() => selectedTaskIds.forEach((id) => updateTask(id, { tags: ['Project review'] }))} className="action-btn">Bulk tag</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Project relationships</div>
                  <div className="mt-2 text-sm text-slate-700">Contacts ({selectedRow.contacts.length}): {selectedRow.contacts.map((contact) => contact.name).join(', ') || '—'}</div>
                  <div className="mt-1 text-sm text-slate-700">Companies ({selectedRow.companies.length}): {selectedRow.companies.map((company) => company.name).join(', ') || '—'}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Project activity feed</div>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto text-xs text-slate-600">
                    {[...selectedRow.openFollowUps.map((item) => ({ at: item.lastTouchDate, label: `[Follow-up] ${item.title}` })), ...selectedRow.openTasks.map((task) => ({ at: task.updatedAt, label: `[Task] ${task.title}` })), ...selectedRow.intakeDocs.map((doc) => ({ at: doc.uploadedAt, label: `[Doc] ${doc.name}` })), { at: selectedProject.updatedAt, label: '[Project] Metadata updated' }]
                      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                      .slice(0, 16)
                      .map((event, index) => <div key={`${event.at}-${index}`}>{formatDate(event.at)} • {event.label}</div>)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">Project review workflow</div>
                <div className="grid gap-2 md:grid-cols-2 text-sm text-slate-700">
                  <div>Top risks: {selectedRow.health.reasons.slice(0, 3).join(', ') || 'None'}</div>
                  <div>Blockers: {selectedProject.currentBlocker || `${selectedRow.blockedTaskCount} blocked tasks`}</div>
                  <div>Stale items: {selectedRow.health.breakdown.staleActivityDays >= 10 ? `${selectedRow.health.breakdown.staleActivityDays} days since major update` : 'No stale signal'}</div>
                  <button onClick={() => updateProject(selectedProject.id, { lastReviewedAt: todayIso() })} className="action-btn justify-center">Mark reviewed now</button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Project status output</label>
                <textarea value={reportText} readOnly className="field-textarea" style={{ minHeight: 240 }} />
              </div>

              <div className="rounded-2xl border border-rose-200 p-4">
                <div className="mb-2 text-sm font-semibold text-rose-700">Archive / delete project</div>
                <button onClick={() => { setDeleteFlowOpen((prev) => !prev); setDeleteTargetProjectId(projects.find((project) => project.name === 'General')?.id || ''); }} className="action-btn action-btn-danger">{deleteFlowOpen ? 'Hide delete workflow' : 'Open safe delete workflow'}</button>
                {deleteFlowOpen ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div>Impacted records: {selectedRow.openFollowUps.length} follow-ups, {selectedRow.openTasks.length} tasks, {selectedRow.intakeDocs.length} docs.</div>
                    <select value={deleteTargetProjectId} onChange={(e) => setDeleteTargetProjectId(e.target.value)} className="field-input">
                      {projects.filter((project) => project.id !== selectedProject.id).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => reassignProjectRecords(selectedProject.id, deleteTargetProjectId, ['followups', 'tasks', 'docs'])} className="action-btn">Reassign child records</button>
                      <button onClick={() => deleteProject(selectedProject.id, deleteTargetProjectId)} className="action-btn action-btn-danger">Confirm delete</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
