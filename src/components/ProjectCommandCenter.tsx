import { AlertTriangle, ChevronDown, ClipboardCopy, FolderOpen, LayoutGrid, List, Plus, RefreshCcw, ShieldAlert, Timer } from 'lucide-react';
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
import { addDaysIso, formatDate, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { AppMode, ProjectCardDisplayMode, ProjectSortKey, SavedViewKey } from '../types';
import {
  AppShellCard,
  StatTile,
  SupportWorkspaceMaintenanceTray,
  SupportWorkspacePortfolioCard,
  SupportWorkspaceRelatedList,
  SupportWorkspaceRouteActions,
  SupportWorkspaceSelectedContextCard,
  SupportWorkspaceSummary,
  SupportWorkspaceToolbar,
} from './ui/AppPrimitives';
import { getModeConfig, type WorkspaceKey } from '../lib/appModeConfig';
import { useExecutionQueueViewModel } from '../domains/shared';
import { BatchSummarySection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';
import { editSurfaceCtas, editSurfacePolicy } from '../lib/editSurfacePolicy';

export function ProjectCommandCenter({ onFocusTracker, onOpenItem, appMode = 'team', setWorkspace }: { onFocusTracker: (view: SavedViewKey, project?: string) => void; onOpenItem: (itemId: string, view?: SavedViewKey, project?: string) => void; appMode?: AppMode; setWorkspace: (workspace: WorkspaceKey) => void }) {
  const {
    items, contacts, companies, projects, tasks, intakeDocuments,
    addProject, updateProject, deleteProject,
    addIntakeDocument, updateTask, batchUpdateFollowUps, runValidatedBatchFollowUpTransition,
    openCreateFromCapture,
    openRecordDrawer,
    openRecordEditor,
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
    addIntakeDocument: s.addIntakeDocument,
    updateTask: s.updateTask,
    batchUpdateFollowUps: s.batchUpdateFollowUps,
    runValidatedBatchFollowUpTransition: s.runValidatedBatchFollowUpTransition,
    openCreateFromCapture: s.openCreateFromCapture,
    openRecordDrawer: s.openRecordDrawer,
    openRecordEditor: s.openRecordEditor,
    setProjectFilter: s.setProjectFilter,
    setActiveView: s.setActiveView,
  })));
  const { openExecutionLane } = useExecutionQueueViewModel();

  const modeConfig = getModeConfig(appMode);
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
  const [bulkFlow, setBulkFlow] = useState<null | 'followup_close' | 'followup_escalate' | 'followup_snooze' | 'task_close' | 'task_escalate' | 'task_snooze'>(null);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkWarnings, setBulkWarnings] = useState<string[]>([]);
  const [bulkBlockers, setBulkBlockers] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);
  const [bulkAffected, setBulkAffected] = useState(0);
  const [bulkSkipped, setBulkSkipped] = useState(0);
  const [deleteWarnings, setDeleteWarnings] = useState<string[]>([]);
  const [deleteResult, setDeleteResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);
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
  const pressureSummary = useMemo(() => {
    const totals = allRows.reduce((acc, row) => {
      acc.overdue += row.overdueFollowUpCount + row.overdueTaskCount;
      acc.blocked += row.blockedTaskCount;
      acc.closeout += row.health.breakdown.readyToCloseSignals > 0 ? 1 : 0;
      acc.critical += row.health.tier === 'Critical' || row.health.tier === 'High' ? 1 : 0;
      return acc;
    }, { overdue: 0, blocked: 0, closeout: 0, critical: 0 });
    return totals;
  }, [allRows]);

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
    openExecutionLane('followups', { project: selectedProject.name, source: 'projects', sourceRecordId: selectedProject.id, section: kind === 'closeout' ? 'ready_to_close' : kind === 'blocked' ? 'blocked' : kind === 'waiting' ? 'triage' : 'quick_route', intentLabel: `${kind} project queue` });
    onFocusTracker('By project', selectedProject.name);
  };

  const createProjectDoc = () => {
    if (!selectedProject) return;
    addIntakeDocument({ name: `Reference - ${selectedProject.name}`, kind: 'Document', projectId: selectedProject.id, owner: selectedProject.owner, sourceRef: 'Projects workspace', notes: '' });
  };

  const openCreateFlow = (kind: 'followup' | 'task') => {
    if (!selectedProject) return;
    openCreateFromCapture({
      kind,
      rawText: `Created from project command center (${selectedProject.name})`,
      title: '',
      project: selectedProject.name,
      projectId: selectedProject.id,
      owner: selectedProject.owner,
      assigneeDisplayName: selectedProject.owner,
      priority: 'Medium',
      confidence: 1,
      cleanupReasons: [],
      contextNote: `Origin: Projects workspace (${selectedProject.name}).`,
    });
  };

  const openBulkFlow = (flow: NonNullable<typeof bulkFlow>) => {
    setBulkFlow(flow);
    setBulkWarnings([]);
    setBulkBlockers([]);
    setBulkResult(null);
    setBulkSkipped(0);
    const selectedCount = flow.startsWith('followup') ? selectedFollowUpIds.length : selectedTaskIds.length;
    setBulkAffected(selectedCount);
    if (flow.includes('snooze')) setBulkDate(addDaysIso(todayIso(), 2).slice(0, 10));
  };

  const applyBulkFlow = () => {
    if (!bulkFlow) return;
    if (bulkFlow.startsWith('followup')) {
      if (bulkFlow === 'followup_close') {
        const result = runValidatedBatchFollowUpTransition(selectedFollowUpIds, 'Closed', { status: 'Closed', actionState: 'Complete' });
        setBulkWarnings(result.warnings);
        setBulkAffected(result.affected);
        setBulkSkipped(result.skipped);
        setBulkResult({ tone: result.skipped || result.warnings.length ? 'warn' : 'success', message: `Closed ${result.affected} follow-up(s), skipped ${result.skipped}.` });
        return;
      }
      if (bulkFlow === 'followup_escalate') {
        batchUpdateFollowUps(selectedFollowUpIds, { escalationLevel: 'Critical' }, 'Bulk escalated from project center');
        setBulkResult({ tone: 'success', message: `Escalated ${selectedFollowUpIds.length} follow-up(s).` });
        return;
      }
      if (!bulkDate) {
        setBulkBlockers(['Snooze requires a target date.']);
        return;
      }
      batchUpdateFollowUps(selectedFollowUpIds, { nextTouchDate: new Date(`${bulkDate}T00:00:00`).toISOString() }, `Bulk snoozed to ${bulkDate} from project center`);
      setBulkResult({ tone: 'success', message: `Snoozed ${selectedFollowUpIds.length} follow-up(s).` });
      return;
    }
    if (bulkFlow === 'task_close') {
      selectedTaskIds.forEach((id) => updateTask(id, { status: 'Done' }));
      setBulkResult({ tone: 'success', message: `Closed ${selectedTaskIds.length} task(s).` });
      return;
    }
    if (bulkFlow === 'task_escalate') {
      selectedTaskIds.forEach((id) => updateTask(id, { status: 'Blocked' }));
      setBulkResult({ tone: 'success', message: `Escalated ${selectedTaskIds.length} task(s) to Blocked.` });
      return;
    }
    if (!bulkDate) {
      setBulkBlockers(['Snooze requires a target date.']);
      return;
    }
    const iso = new Date(`${bulkDate}T00:00:00`).toISOString();
    selectedTaskIds.forEach((id) => updateTask(id, { deferredUntil: iso, status: 'To do' }));
    setBulkResult({ tone: 'success', message: `Deferred ${selectedTaskIds.length} task(s) until ${bulkDate}.` });
  };

  return (
    <AppShellCard className="project-command-surface" surface="shell">
      <SupportWorkspaceSummary
        title="Project support workspace"
        subtitle={modeConfig.projectsSubtitle}
        supportSentence="Projects are a context-and-routing lens: read pressure quickly, select the target project, then route into execution lanes."
        metrics={(
          <>
            <StatTile label="Projects under pressure" value={pressureSummary.critical} helper="High + critical health signals" tone={pressureSummary.critical > 0 ? 'warn' : 'default'} />
            <StatTile label="Overdue work" value={pressureSummary.overdue} helper="Follow-ups + tasks overdue" tone={pressureSummary.overdue > 0 ? 'warn' : 'default'} />
            <StatTile label="Blocked tasks" value={pressureSummary.blocked} helper="Execution blockers to route" tone={pressureSummary.blocked > 0 ? 'danger' : 'default'} />
            <StatTile label="Closeout candidates" value={pressureSummary.closeout} helper="Projects showing closeout signals" />
          </>
        )}
      />
      <div className="project-command-layout">
        <div className="project-list-rail page-section">
          <SupportWorkspaceToolbar
            primary={(
              <>
            <div className="grid gap-2 md:grid-cols-3">
              <input value={filters.query} onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))} className="field-input md:col-span-2" placeholder="Search by project, owner, code, phase" />
              <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as ProjectFilterState['status'] }))} className="field-input"><option value="All">All statuses</option><option>Active</option><option>On hold</option><option>Closeout</option><option>Complete</option></select>
              <select value={filters.healthTier} onChange={(e) => setFilters((prev) => ({ ...prev, healthTier: e.target.value as ProjectFilterState['healthTier'] }))} className="field-input"><option value="All">Any health</option><option>Critical</option><option>High</option><option>Moderate</option><option>Low</option></select>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as ProjectSortKey)} className="field-input"><option value="health">Sort: health</option><option value="name">Sort: name</option><option value="updated">Sort: updated</option><option value="targetDate">Sort: target date</option><option value="overdueWork">Sort: overdue work</option></select>
            </div>
              </>
            )}
            secondary={(
              <>
            <div className="project-filter-foot">
              <div className="flex flex-wrap gap-2">
                {projectSavedViews.map((view) => <button key={view.key} onClick={() => applySavedView(view.key)} className={savedView === view.key ? 'action-btn !border-amber-500 !bg-amber-50' : 'action-btn'}>{view.label}</button>)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSortDirection((prev) => prev === 'desc' ? 'asc' : 'desc')} className="action-btn">{sortDirection === 'desc' ? 'Desc' : 'Asc'}</button>
                <button onClick={() => setDisplayMode((prev) => prev === 'compact' ? 'expanded' : 'compact')} className="action-btn">{displayMode === 'compact' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}</button>
                <button onClick={() => { setFilters(defaultProjectFilters); setSavedView('All projects'); }} className="action-btn">Reset</button>
              </div>
            </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select value={filters.owner} onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))} className="field-input"><option value="All">All owners</option>{[...new Set(projects.map((project) => project.owner))].map((owner) => <option key={owner}>{owner}</option>)}</select>
                  <select value={filters.activity} onChange={(e) => setFilters((prev) => ({ ...prev, activity: e.target.value as ProjectFilterState['activity'] }))} className="field-input"><option value="all">Any activity</option><option value="recent">Recently updated</option><option value="stale">Stale</option></select>
                  <select value={filters.hasOverdueFollowUp} onChange={(e) => setFilters((prev) => ({ ...prev, hasOverdueFollowUp: e.target.value as ProjectFilterState['hasOverdueFollowUp'] }))} className="field-input"><option value="all">Any overdue follow-up</option><option value="yes">Has overdue follow-up</option><option value="no">No overdue follow-up</option></select>
                  <select value={filters.hasBlockedTask} onChange={(e) => setFilters((prev) => ({ ...prev, hasBlockedTask: e.target.value as ProjectFilterState['hasBlockedTask'] }))} className="field-input"><option value="all">Any blocked tasks</option><option value="yes">Has blocked task</option><option value="no">No blocked task</option></select>
                  <select value={filters.hasOverdueTask} onChange={(e) => setFilters((prev) => ({ ...prev, hasOverdueTask: e.target.value as ProjectFilterState['hasOverdueTask'] }))} className="field-input"><option value="all">Any overdue tasks</option><option value="yes">Has overdue task</option><option value="no">No overdue task</option></select>
                </div>
                <div className="project-create-row mt-3">
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="field-input" placeholder="Project name" />
                  <input value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value)} className="field-input" placeholder="Owner" />
                  <button onClick={createProject} className="action-btn"><Plus className="h-4 w-4" />Quick add project</button>
                </div>
              </>
            )}
          />

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
              <SupportWorkspaceSelectedContextCard title={selectedProject.name} subtitle="Project pressure lens: understand why this record needs attention now, then route into execution.">
              <div className="project-detail-top !p-0 !bg-transparent !border-0">
                <div>
                  <h3 className="inspector-title">Identity + why it matters</h3>
                  <p className="inspector-meta">{selectedProject.name} • {selectedRow.health.reasons[0] || 'No immediate pressure signal; review open commitments.'}</p>
                </div>
                <SupportWorkspaceRouteActions support="Route actions stay primary; maintenance stays secondary below.">
                  <button onClick={() => { openExecutionLane('followups', { project: selectedProject.name, source: 'projects', sourceRecordId: selectedProject.id, intentLabel: 'review project commitments' }); setWorkspace('followups'); }} className="primary-btn"><RefreshCcw className="h-4 w-4" />Open follow-up lane</button>
                  <button onClick={() => { openExecutionLane('tasks', { project: selectedProject.name, source: 'projects', sourceRecordId: selectedProject.id, intentLabel: 'review project tasks' }); setWorkspace('tasks'); }} className="primary-btn">Open task lane</button>
                  <button onClick={() => openProjectScopedQueue('blocked')} className="action-btn"><ShieldAlert className="h-4 w-4" />Open blocked work</button>
                  <button onClick={() => openProjectScopedQueue('overdue')} className="action-btn"><AlertTriangle className="h-4 w-4" />Open overdue work</button>
                  <button onClick={() => openProjectScopedQueue('waiting')} className="action-btn"><Timer className="h-4 w-4" />Open waiting work</button>
                  <button onClick={() => openProjectScopedQueue('closeout')} className="action-btn">Open closeout work</button>
                  <button onClick={() => openCreateFlow('followup')} className="action-btn">Create follow-up</button>
                  <button onClick={() => openCreateFlow('task')} className="action-btn">Create task</button>
                  <button onClick={createProjectDoc} className="action-btn"><FolderOpen className="h-4 w-4" />Add project-scoped doc</button>
                  <button onClick={() => openRecordDrawer({ type: 'project', id: selectedProject.id })} className="action-btn">{editSurfaceCtas.openContext}</button>
                  <button onClick={() => openRecordEditor({ type: 'project', id: selectedProject.id }, 'edit', 'workspace')} className="action-btn">{editSurfaceCtas.fullEditProject}</button>
                  <button onClick={async () => { await navigator.clipboard.writeText(reportText); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className={modeConfig.supportActionsSecondary ? 'action-btn' : 'primary-btn'}><ClipboardCopy className="h-4 w-4" />{copied ? 'Copied' : 'Copy report'}</button>
                </SupportWorkspaceRouteActions>
              </div>

              <div className="project-subpanel inspector-block">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project context routing</div>
                <div className="mt-2 text-xs text-slate-600">Use context + lane routing here. Deeper metadata editing stays in secondary maintenance flows.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => openRecordDrawer({ type: 'project', id: selectedProject.id })} className="action-btn !px-2.5 !py-1.5 text-xs">{editSurfaceCtas.openContext}</button>
                  <button onClick={() => { openExecutionLane('followups', { project: selectedProject.name, source: 'projects', sourceRecordId: selectedProject.id, intentLabel: 'review project commitments' }); setWorkspace('followups'); }} className="action-btn !px-2.5 !py-1.5 text-xs">Open follow-up lane</button>
                  <button onClick={() => { openExecutionLane('tasks', { project: selectedProject.name, source: 'projects', sourceRecordId: selectedProject.id, intentLabel: 'review project tasks' }); setWorkspace('tasks'); }} className="action-btn !px-2.5 !py-1.5 text-xs">Open task lane</button>
                </div>
              </div>

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
                <div className="w-full text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next best routing move</div>
                <div className="rounded-xl tonal-micro text-xs text-slate-700">
                  Main pressure: {selectedRow.health.reasons[0] || 'No immediate pressure signal; review open commitments.'}
                </div>
                <button onClick={() => openProjectScopedQueue('waiting')} className="action-btn"><Timer className="h-4 w-4" />Open waiting work</button>
                <button onClick={createProjectDoc} className="action-btn !px-2.5 !py-1.5 text-xs"><FolderOpen className="h-4 w-4" />Add project-scoped doc</button>
              </div>

              <SupportWorkspaceMaintenanceTray title={`${editSurfacePolicy.maintenance.label} (project metadata + admin controls)`} subtitle="Projects remain a context lens first. Use maintenance only for deeper metadata/admin updates.">
                  <div className="grid gap-2 md:grid-cols-2">
                    <input value={selectedProject.name} onChange={(e) => updateProject(selectedProject.id, { name: e.target.value })} className="field-input" placeholder="Project name" />
                    <input value={selectedProject.owner} onChange={(e) => updateProject(selectedProject.id, { owner: e.target.value })} className="field-input" placeholder="Project owner" />
                    <input value={selectedProject.code || ''} onChange={(e) => updateProject(selectedProject.id, { code: e.target.value })} className="field-input" placeholder="Project code" />
                    <input value={selectedProject.contractReference || ''} onChange={(e) => updateProject(selectedProject.id, { contractReference: e.target.value })} className="field-input" placeholder="Contract/reference" />
                    <input value={selectedProject.clientOrg || ''} onChange={(e) => updateProject(selectedProject.id, { clientOrg: e.target.value })} className="field-input" placeholder="Client / owner org" />
                    <input value={selectedProject.phase || ''} onChange={(e) => updateProject(selectedProject.id, { phase: e.target.value })} className="field-input" placeholder="Phase" />
                    <input type="date" value={(selectedProject.targetCompletionDate || '').slice(0, 10)} onChange={(e) => updateProject(selectedProject.id, { targetCompletionDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })} className="field-input" />
                    <input value={selectedProject.nextMilestone || ''} onChange={(e) => updateProject(selectedProject.id, { nextMilestone: e.target.value })} className="field-input" placeholder="Next milestone" />
                  </div>
                  <textarea value={selectedProject.currentBlocker || ''} onChange={(e) => updateProject(selectedProject.id, { currentBlocker: e.target.value })} className="field-textarea mt-3" placeholder="Current blocker" />
                  <textarea value={selectedProject.notes} onChange={(e) => updateProject(selectedProject.id, { notes: e.target.value })} className="field-textarea mt-2" placeholder="Project notes" />
                  <div className="rounded-2xl border border-rose-200 p-4 mt-3">
                    <div className="mb-2 text-sm font-semibold text-rose-700">Archive / delete project</div>
                    <button onClick={() => { setDeleteFlowOpen((prev) => !prev); setDeleteTargetProjectId(projects.find((project) => project.name === 'General')?.id || ''); }} className="action-btn action-btn-danger">{deleteFlowOpen ? 'Hide delete workflow' : 'Open safe delete workflow'}</button>
                  </div>
              </SupportWorkspaceMaintenanceTray>
              </SupportWorkspaceSelectedContextCard>

              <div className="grid gap-4 lg:grid-cols-2">
                <SupportWorkspaceRelatedList title="Linked follow-ups" subtitle="Supporting preview for pressure context and routing decisions.">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open follow-ups</span><button onClick={() => setSelectedFollowUpIds(selectedRow.openFollowUps.map((item) => item.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="project-entity-list">
                    {selectedRow.openFollowUps.map((item) => (
                      <label key={item.id} className="project-entity-row">
                        <div className="flex items-start gap-2"><input type="checkbox" checked={selectedFollowUpIds.includes(item.id)} onChange={(e) => setSelectedFollowUpIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} /><button onClick={() => onOpenItem(item.id, 'By project', selectedProject.name)} className="text-left"><div className="font-medium text-slate-900">{item.title}</div><div className="text-xs text-slate-500">Due {formatDate(item.dueDate)} • {item.status}</div></button><button onClick={() => openRecordDrawer({ type: 'followup', id: item.id })} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.openContext}</button><button onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.fullEditFollowUp}</button></div>
                      </label>
                    ))}
                  </div>
                  <details className="task-maintenance-disclosure mt-2">
                    <summary>Maintenance: bulk follow-up actions</summary>
                    <div className="task-maintenance-body flex flex-wrap gap-2">
                      <button onClick={() => openBulkFlow('followup_close')} className="action-btn">Bulk close</button>
                      <button onClick={() => openBulkFlow('followup_escalate')} className="action-btn">Bulk escalate</button>
                      <button onClick={() => openBulkFlow('followup_snooze')} className="action-btn">Bulk snooze</button>
                    </div>
                  </details>
                </SupportWorkspaceRelatedList>

                <SupportWorkspaceRelatedList title="Linked tasks" subtitle="Compact preview only; route into Tasks lane for full queue execution.">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900"><span>Open tasks</span><button onClick={() => setSelectedTaskIds(selectedRow.openTasks.map((task) => task.id))} className="action-btn !px-2 !py-1 text-xs">Select all</button></div>
                  <div className="project-entity-list">
                    {selectedRow.openTasks.map((task) => (
                      <label key={task.id} className="project-entity-row">
                        <div className="flex items-start gap-2"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={(e) => setSelectedTaskIds((prev) => e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id))} /><div><div className="font-medium text-slate-900">{task.title}</div><div className="text-xs text-slate-500">{task.status} • Due {formatDate(task.dueDate)}</div></div><button onClick={() => openRecordDrawer({ type: 'task', id: task.id })} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.openContext}</button><button onClick={() => openRecordEditor({ type: 'task', id: task.id }, 'edit', 'workspace')} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.fullEditTask}</button></div>
                      </label>
                    ))}
                  </div>
                  <details className="task-maintenance-disclosure mt-2">
                    <summary>Maintenance: bulk task actions</summary>
                    <div className="task-maintenance-body flex flex-wrap gap-2">
                      <button onClick={() => openBulkFlow('task_close')} className="action-btn">Bulk close</button>
                      <button onClick={() => openBulkFlow('task_escalate')} className="action-btn">Bulk escalate</button>
                      <button onClick={() => openBulkFlow('task_snooze')} className="action-btn">Bulk snooze</button>
                    </div>
                  </details>
                </SupportWorkspaceRelatedList>
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

            </>
          ) : null}
        </div>
      </div>
      <StructuredActionFlow
        open={!!bulkFlow}
        title={bulkFlow?.startsWith('followup') ? 'Project follow-up bulk action' : 'Project task bulk action'}
        subtitle="Use structured review for high-impact project-wide actions."
        onCancel={() => setBulkFlow(null)}
        onConfirm={applyBulkFlow}
        confirmLabel="Apply action"
        warnings={bulkWarnings}
        blockers={bulkBlockers}
        result={bulkResult}
      >
        <BatchSummarySection selected={bulkFlow?.startsWith('followup') ? selectedFollowUpIds.length : selectedTaskIds.length} affected={bulkAffected} skipped={bulkSkipped} />
        {bulkFlow?.includes('snooze') ? <DateSection label="Snooze until" value={bulkDate} onChange={setBulkDate} /> : null}
      </StructuredActionFlow>
      <StructuredActionFlow
        open={deleteFlowOpen}
        title="Project delete / reassign workflow"
        subtitle="High-risk workflow: review impacted records and reassignment target."
        onCancel={() => setDeleteFlowOpen(false)}
        onConfirm={() => {
          if (!selectedProject || !deleteTargetProjectId) {
            setDeleteWarnings(['Pick a reassignment target before running delete.']);
            return;
          }
          deleteProject(selectedProject.id, deleteTargetProjectId);
          setDeleteResult({ tone: 'warn', message: `Deleted ${selectedProject.name} after reassignment.` });
          setDeleteFlowOpen(false);
        }}
        confirmLabel="Delete project safely"
        warnings={deleteWarnings}
        blockers={!deleteTargetProjectId ? ['Reassignment target is required.'] : []}
        result={deleteResult}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Impacted records: {selectedRow?.openFollowUps.length ?? 0} follow-ups, {selectedRow?.openTasks.length ?? 0} tasks, {selectedRow?.intakeDocs.length ?? 0} docs.
        </div>
      </StructuredActionFlow>
    </AppShellCard>
  );
}
