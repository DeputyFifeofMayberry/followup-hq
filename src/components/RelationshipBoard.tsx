import { AlertTriangle, ArrowRightLeft, Building2, Clock3, Filter, Flame, PlusCircle, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildOwnerSummary } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  buildRelationshipSummaries,
  defaultRelationshipFilter,
  filterRelationshipSummaries,
  relationshipSavedViews,
  sortRelationshipSummaries,
  type RelationshipSortKey,
} from '../lib/relationshipSelectors';
import {
  AppShellCard,
  StatePanel,
  SupportWorkspaceMaintenanceTray,
  SupportWorkspacePortfolioCard,
  SupportWorkspaceRelatedList,
  SupportWorkspaceRouteActions,
  SupportWorkspaceSelectedContextCard,
  SupportWorkspaceSummary,
  SupportWorkspaceToolbar,
} from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import type { AppMode } from '../types';
import { useExecutionQueueViewModel } from '../domains/shared';
import type { WorkspaceKey } from '../lib/appModeConfig';
import { StructuredActionFlow } from './actions/StructuredActionFlow';
import { getCompanyLinkedRecords, getContactLinkedRecords } from '../lib/recordContext';
import { editSurfaceCtas, editSurfacePolicy } from '../lib/editSurfacePolicy';

export function RelationshipBoard({ appMode = 'team', setWorkspace }: { appMode?: AppMode; setWorkspace: (workspace: WorkspaceKey) => void }) {
  const {
    items,
    tasks,
    contacts,
    companies,
    addContact,
    addCompany,
    updateContact,
    updateCompany,
    deleteContact,
    deleteCompany,
    reassignContactLinks,
    reassignCompanyLinks,
    mergeContacts,
    mergeCompanies,
    projects,
    openCreateFromCapture,
    openRecordDrawer,
    openRecordEditor,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    contacts: s.contacts,
    companies: s.companies,
    addContact: s.addContact,
    addCompany: s.addCompany,
    updateContact: s.updateContact,
    updateCompany: s.updateCompany,
    deleteContact: s.deleteContact,
    deleteCompany: s.deleteCompany,
    reassignContactLinks: s.reassignContactLinks,
    reassignCompanyLinks: s.reassignCompanyLinks,
    mergeContacts: s.mergeContacts,
    mergeCompanies: s.mergeCompanies,
    projects: s.projects,
    openCreateFromCapture: s.openCreateFromCapture,
    openRecordDrawer: s.openRecordDrawer,
    openRecordEditor: s.openRecordEditor,
  })));
  const { openExecutionLane } = useExecutionQueueViewModel();

  const modeConfig = getModeConfig(appMode);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<'Government' | 'Owner' | 'Vendor' | 'Subcontractor' | 'Consultant' | 'Internal' | 'Other'>('Vendor');
  const [filters, setFilters] = useState(defaultRelationshipFilter);
  const [sortBy, setSortBy] = useState<RelationshipSortKey>('pressure');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'contact' | 'company'>('contact');
  const [relationshipFlow, setRelationshipFlow] = useState<null | 'watch' | 'log_touch' | 'delete_contact' | 'delete_company' | 'reassign_contact' | 'reassign_company' | 'merge_contact' | 'merge_company'>(null);
  const [relationshipTargetId, setRelationshipTargetId] = useState('');
  const [relationshipWarnings, setRelationshipWarnings] = useState<string[]>([]);
  const [relationshipResult, setRelationshipResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);

  const ownerSummary = useMemo(() => buildOwnerSummary(items, tasks), [items, tasks]);
  const relationshipRows = useMemo(() => buildRelationshipSummaries(items, tasks, contacts, companies), [items, tasks, contacts, companies]);
  const filteredRows = useMemo(() => sortRelationshipSummaries(filterRelationshipSummaries(relationshipRows, filters), sortBy, sortDirection), [relationshipRows, filters, sortBy, sortDirection]);
  const selected = useMemo(() => filteredRows.find((row) => row.id === selectedId && row.entityType === selectedEntityType) || filteredRows[0], [filteredRows, selectedId, selectedEntityType]);

  const bottlenecks = useMemo(() => relationshipRows
    .filter((row) => row.waitingFollowUps + row.blockedTasks + row.overdueFollowUps + row.overdueTasks > 0)
    .sort((a, b) => b.pressureScore - a.pressureScore)
    .slice(0, 6), [relationshipRows]);

  const selectedLinkedRecords = useMemo(() => {
    if (!selected) return { followups: [], tasks: [], contacts: [], projects: [] as typeof projects };
    if (selected.entityType === 'contact') {
      const linked = getContactLinkedRecords(selected.id, { items, tasks, contacts, companies, projects });
      return { followups: linked.followups, tasks: linked.tasks, contacts: linked.contact ? [linked.contact] : [], projects: linked.projects };
    }
    return getCompanyLinkedRecords(selected.id, { items, tasks, contacts, companies, projects });
  }, [selected, items, tasks, contacts, companies, projects]);

  const selectedFollowUps = useMemo(() => selectedLinkedRecords.followups.slice(0, 8), [selectedLinkedRecords.followups]);
  const selectedTasks = useMemo(() => selectedLinkedRecords.tasks.slice(0, 8), [selectedLinkedRecords.tasks]);
  const selectedProjects = useMemo(() => selectedLinkedRecords.projects, [selectedLinkedRecords.projects]);

  const contactOptions = contacts.map((contact) => ({ id: contact.id, label: contact.name }));
  const companyOptions = companies.map((company) => ({ id: company.id, label: company.name }));

  const selectedContact = selected && selected.entityType === 'contact' ? contacts.find((entry) => entry.id === selected.id) : null;
  const selectedCompany = selected && selected.entityType === 'company' ? companies.find((entry) => entry.id === selected.id) : null;

  const linkedCounts = selected ? {
    followUps: selectedLinkedRecords.followups.length,
    tasks: selectedLinkedRecords.tasks.length,
    contacts: selected.entityType === 'company' ? selectedLinkedRecords.contacts.length : 0,
  } : { followUps: 0, tasks: 0, contacts: 0 };

  const openCreateWorkFromRelationship = (kind: 'followup' | 'task') => {
    if (!selected) return;
    openCreateFromCapture({
      kind,
      rawText: `Created from relationship board (${selected.name})`,
      title: '',
      project: selectedProjects[0]?.name,
      projectId: selectedProjects[0]?.id,
      owner: selected.internalOwner || (selected.entityType === 'contact' ? selectedContact?.internalOwner : selectedCompany?.internalOwner) || 'Unassigned',
      assigneeDisplayName: selected.internalOwner || 'Unassigned',
      priority: selected.riskTier === 'Critical' ? 'Critical' : selected.riskTier === 'High' ? 'High' : 'Medium',
      contactId: selected.entityType === 'contact' ? selected.id : undefined,
      companyId: selected.entityType === 'company' ? selected.id : selectedContact?.companyId,
      confidence: 1,
      cleanupReasons: [],
      contextNote: `Origin: Relationship board (${selected.entityType}:${selected.name}).`,
    });
  };

  const runRelationshipFlow = () => {
    if (!selected) return;
    if (relationshipFlow === 'watch') {
      if (selected.entityType === 'contact') updateContact(selected.id, { relationshipStatus: 'Watch' });
      else updateCompany(selected.id, { relationshipStatus: 'Watch' });
      setRelationshipResult({ tone: 'warn', message: `${selected.name} moved to Watch.` });
      return;
    }
    if (relationshipFlow === 'log_touch') {
      if (selected.entityType === 'contact') updateContact(selected.id, { lastContactedAt: new Date().toISOString(), lastResponseAt: new Date().toISOString() });
      else updateCompany(selected.id, { lastReviewedAt: new Date().toISOString() });
      setRelationshipResult({ tone: 'success', message: `Logged interaction for ${selected.name}.` });
      return;
    }
    if (relationshipFlow === 'delete_contact' && selectedContact) {
      deleteContact(selectedContact.id);
      setRelationshipResult({ tone: 'warn', message: `Deleted ${selectedContact.name} with safe unlinking.` });
      return;
    }
    if (relationshipFlow === 'delete_company' && selectedCompany) {
      deleteCompany(selectedCompany.id);
      setRelationshipResult({ tone: 'warn', message: `Deleted ${selectedCompany.name} with safe unlinking.` });
      return;
    }
    if (!relationshipTargetId) {
      setRelationshipWarnings(['Select a target relationship first.']);
      return;
    }
    if (relationshipFlow === 'reassign_contact' && selectedContact) reassignContactLinks(selectedContact.id, relationshipTargetId);
    if (relationshipFlow === 'reassign_company' && selectedCompany) reassignCompanyLinks(selectedCompany.id, relationshipTargetId);
    if (relationshipFlow === 'merge_contact' && selectedContact) mergeContacts(relationshipTargetId, selectedContact.id);
    if (relationshipFlow === 'merge_company' && selectedCompany) mergeCompanies(relationshipTargetId, selectedCompany.id);
    setRelationshipResult({ tone: 'success', message: 'Relationship operation completed.' });
  };

  const coordinationSummary = useMemo(() => relationshipRows.reduce((acc, row) => {
    acc.waiting += row.waitingFollowUps;
    acc.overdue += row.overdueFollowUps + row.overdueTasks;
    acc.blocked += row.blockedTasks;
    if (row.riskTier === 'High' || row.riskTier === 'Critical') acc.highRisk += 1;
    return acc;
  }, { waiting: 0, overdue: 0, blocked: 0, highRisk: 0 }), [relationshipRows]);

  return (
    <AppShellCard className="workspace-inspector-panel relationship-command-surface" surface="shell">
      <SupportWorkspaceSummary
        title="Relationship support workspace"
        subtitle={modeConfig.relationshipsSubtitle}
        supportSentence="Relationships are a coordination pressure lens: identify who is stalled, then route into follow-up or task execution lanes."
        metrics={(
          <>
            <div className="stat-tile"><div className="stat-tile-label">Waiting pressure</div><div className="stat-tile-value">{coordinationSummary.waiting}</div><div className="stat-tile-helper">Follow-ups waiting on others</div></div>
            <div className="stat-tile stat-tile-warn"><div className="stat-tile-label">Overdue pressure</div><div className="stat-tile-value">{coordinationSummary.overdue}</div><div className="stat-tile-helper">Overdue follow-ups + tasks</div></div>
            <div className="stat-tile stat-tile-danger"><div className="stat-tile-label">Blocked tasks</div><div className="stat-tile-value">{coordinationSummary.blocked}</div><div className="stat-tile-helper">Coordination bottlenecks</div></div>
            <div className="stat-tile"><div className="stat-tile-label">High-risk relationships</div><div className="stat-tile-value">{coordinationSummary.highRisk}</div><div className="stat-tile-helper">High + critical risk tier</div></div>
          </>
        )}
      />

      <div className="grid gap-4 p-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <SupportWorkspaceToolbar
            primary={(
              <>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Search contact, company, owner, role" className="field-input" />
              <select value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value as typeof prev.entityType }))} className="field-input">
                <option value="all">All entities</option>
                <option value="contact">Contacts</option>
                <option value="company">Companies</option>
              </select>
              <select value={filters.riskTier} onChange={(e) => setFilters((prev) => ({ ...prev, riskTier: e.target.value as typeof prev.riskTier }))} className="field-input">
                <option value="all">All risk tiers</option>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as RelationshipSortKey)} className="field-input">
                <option value="pressure">Sort by pressure</option><option value="name">Sort by name</option><option value="activeProjects">Sort by projects</option><option value="waiting">Sort by waiting</option><option value="overdue">Sort by overdue</option><option value="touchAge">Sort by touch age</option><option value="risk">Sort by risk</option>
              </select>
            </div>
              </>
            )}
            secondary={(
              <>
            <div className="mt-3 flex flex-wrap gap-2">
              {relationshipSavedViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, ...defaultRelationshipFilter, ...view.filter }));
                    if (view.sortBy) setSortBy(view.sortBy);
                    if (view.sortDirection) setSortDirection(view.sortDirection);
                  }}
                  className="action-btn !px-2.5 !py-1 text-xs"
                >
                  {view.label}
                </button>
              ))}
              <button onClick={() => setSortDirection((prev) => prev === 'desc' ? 'asc' : 'desc')} className="action-btn !px-2.5 !py-1 text-xs">{sortDirection.toUpperCase()}</button>
              <button onClick={() => setFilters(defaultRelationshipFilter)} className="action-btn !px-2.5 !py-1 text-xs">Reset</button>
            </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select value={filters.companyType} onChange={(e) => setFilters((prev) => ({ ...prev, companyType: e.target.value as typeof prev.companyType }))} className="field-input">
                    <option value="all">All company types</option>
                    <option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option>
                  </select>
                  <input type="number" min={0} value={filters.minActiveProjects} onChange={(e) => setFilters((prev) => ({ ...prev, minActiveProjects: Number(e.target.value) || 0 }))} placeholder="Min active projects" className="field-input" />
                  <input type="number" min={0} value={filters.minWaitingPressure} onChange={(e) => setFilters((prev) => ({ ...prev, minWaitingPressure: Number(e.target.value) || 0 }))} placeholder="Min waiting pressure" className="field-input" />
                  <input type="number" min={0} value={filters.minOverduePressure} onChange={(e) => setFilters((prev) => ({ ...prev, minOverduePressure: Number(e.target.value) || 0 }))} placeholder="Min overdue pressure" className="field-input" />
                  <input type="number" min={0} value={filters.minBlockedTaskPressure} onChange={(e) => setFilters((prev) => ({ ...prev, minBlockedTaskPressure: Number(e.target.value) || 0 }))} placeholder="Min blocked task pressure" className="field-input" />
                  <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={filters.staleOnly} onChange={(e) => setFilters((prev) => ({ ...prev, staleOnly: e.target.checked }))} />Stale only (&gt;=14 days since touch)</label>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl tonal-panel">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4" />Quick add contact</div>
                    <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                      <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="field-input" />
                      <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="field-input" />
                      <button onClick={() => { if (!contactName.trim()) return; addContact({ name: contactName.trim(), email: contactEmail.trim(), role: 'External', notes: '', tags: [], active: true, relationshipStatus: 'Active', riskTier: 'Low' }); setContactName(''); setContactEmail(''); }} className={modeConfig.supportActionsSecondary ? 'action-btn' : 'primary-btn'}><PlusCircle className="h-4 w-4" />Add</button>
                    </div>
                  </div>
                  <div className="rounded-2xl tonal-panel">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Building2 className="h-4 w-4" />Quick add company</div>
                    <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" className="field-input" />
                      <select value={companyType} onChange={(e) => setCompanyType(e.target.value as typeof companyType)} className="field-input">
                        <option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option>
                      </select>
                      <button onClick={() => { if (!companyName.trim()) return; addCompany({ name: companyName.trim(), type: companyType, notes: '', tags: [], relationshipStatus: 'Active', riskTier: 'Low', active: true }); setCompanyName(''); }} className={modeConfig.supportActionsSecondary ? 'action-btn' : 'primary-btn'}><PlusCircle className="h-4 w-4" />Add</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          />

          <div className="rounded-2xl tonal-panel">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Filter className="h-4 w-4" />Likely bottlenecks</div>
            <div className="space-y-2">
              {bottlenecks.map((entry) => (
                <button key={`${entry.entityType}-${entry.id}`} onClick={() => { setSelectedId(entry.id); setSelectedEntityType(entry.entityType); }} className="w-full rounded-xl tonal-micro text-left text-sm  list-row-family">
                  <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-900">{entry.name}</span><span className="text-xs text-rose-700">Score {entry.pressureScore}</span></div>
                  <div className="mt-1 text-xs text-slate-600">Waiting {entry.waitingFollowUps} • Overdue {entry.overdueFollowUps + entry.overdueTasks} • Blocked tasks {entry.blockedTasks}</div>
                  <div className="mt-2"><button onClick={(event) => { event.stopPropagation(); openRecordDrawer({ type: entry.entityType, id: entry.id }); }} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.openContext}</button></div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl tonal-panel">
            <div className="mb-2 text-sm font-semibold text-slate-900">Internal ownership load</div>
            <div className="space-y-2">
              {ownerSummary.slice(0, 6).map((owner) => (
                <div key={owner.owner} className="rounded-xl tonal-micro text-xs text-slate-700 list-row-family">
                  <div className="font-medium text-slate-900">{owner.owner}</div>
                  <div className="mt-1">Active {owner.activeCount} • Waiting {owner.waitingCount} • Overdue {owner.overdueCount}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="space-y-4">
          <SupportWorkspacePortfolioCard title={`Relationship portfolio (${filteredRows.length})`} subtitle="Select an entity to inspect pressure, route next action, and open canonical record context.">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="panel-title">Portfolio list</div>
              <div className="panel-supporting-text">Click any row for detail + actions</div>
            </div>
            <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
              {filteredRows.map((row) => (
                <button key={`${row.entityType}-${row.id}`} onClick={() => { setSelectedId(row.id); setSelectedEntityType(row.entityType); }} className={`w-full relationship-row text-left text-sm ${selected?.id === row.id && selected?.entityType === row.entityType ? 'relationship-row-active list-row-family-active' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.entityType === 'contact' ? 'Contact' : 'Company'} • {row.subtitle}</div>
                    </div>
                    <div className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">{row.pressureScore}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">FU {row.openFollowUps} (W {row.waitingFollowUps}/O {row.overdueFollowUps}) • Tasks {row.openTasks} (B {row.blockedTasks}/O {row.overdueTasks}) • Projects {row.activeProjectCount}</div>
                  <div className="mt-2"><button onClick={(event) => { event.stopPropagation(); openRecordDrawer({ type: row.entityType, id: row.id }); }} className="action-btn !px-2 !py-1 text-xs">{editSurfaceCtas.openContext}</button></div>
                </button>
              ))}
            </div>
          </SupportWorkspacePortfolioCard>

          {selected ? (
            <SupportWorkspaceSelectedContextCard title={selected.name} subtitle={`${selected.entityType === 'contact' ? 'Contact' : 'Company'} • ${selected.subtitle}. Coordination lens first: understand pressure then route to the right lane.`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inspector-title">Identity + why it matters</div>
                  <div className="panel-supporting-text">{selected.name} • Risk {selected.riskTier} • Waiting {selected.waitingFollowUps} • Overdue {selected.overdueFollowUps + selected.overdueTasks}</div>
                </div>
                <SupportWorkspaceRouteActions support="Keep routing and context actions primary; maintenance stays below.">
                  <button onClick={() => { openExecutionLane('followups', { project: selectedProjects[0]?.name, source: 'relationships', sourceRecordId: selected.id, intentLabel: `coordinate ${selected.name}` }); setWorkspace('followups'); }} className="primary-btn !px-2.5 !py-1.5 text-xs">Open follow-up lane</button>
                  <button onClick={() => { openExecutionLane('tasks', { project: selectedProjects[0]?.name, source: 'relationships', sourceRecordId: selected.id, intentLabel: `unblock ${selected.name}` }); setWorkspace('tasks'); }} className="primary-btn !px-2.5 !py-1.5 text-xs">Open task lane</button>
                  <button onClick={() => setFilters((prev) => ({ ...prev, minWaitingPressure: 1 }))} className="action-btn"><Clock3 className="h-4 w-4" />Open waiting pressure</button>
                  <button onClick={() => setFilters((prev) => ({ ...prev, minOverduePressure: 1 }))} className="action-btn"><AlertTriangle className="h-4 w-4" />Open overdue pressure</button>
                  <button onClick={() => openCreateWorkFromRelationship('followup')} className="action-btn !px-2.5 !py-1.5 text-xs">Create follow-up</button>
                  <button onClick={() => openCreateWorkFromRelationship('task')} className="action-btn !px-2.5 !py-1.5 text-xs">Create task</button>
                  <button onClick={() => openRecordDrawer({ type: selected.entityType, id: selected.id })} className="action-btn !px-2.5 !py-1.5 text-xs">{editSurfaceCtas.openContext}</button>
                  <button onClick={() => { setRelationshipFlow('watch'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="action-btn"><Flame className="h-4 w-4" />Mark watch</button>
                  <button onClick={() => { setRelationshipFlow('log_touch'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="action-btn">Log interaction</button>
                  <button onClick={() => { openExecutionLane('followups', { project: selectedProjects[0]?.name, source: 'relationships', sourceRecordId: selected.id, section: 'triage', intentLabel: `next touch ${selected.name}` }); setWorkspace('followups'); }} className="action-btn">Route next touch</button>
                </SupportWorkspaceRouteActions>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                <div className="rounded-xl tonal-micro">Risk tier: <span className="font-medium">{selected.riskTier}</span></div>
                <div className="rounded-xl tonal-micro">Status: <span className="font-medium">{selected.relationshipStatus}</span></div>
                <div className="rounded-xl tonal-micro">Internal owner: <span className="font-medium">{selected.internalOwner}</span></div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-4">
                <div className="rounded-xl tonal-micro">Follow-ups: {linkedCounts.followUps}</div>
                <div className="rounded-xl tonal-micro">Tasks: {linkedCounts.tasks}</div>
                <div className="rounded-xl tonal-micro">Projects: {selected.activeProjectCount}</div>
                <div className="rounded-xl tonal-micro">Linked contacts: {linkedCounts.contacts}</div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <SupportWorkspaceRelatedList title="Linked follow-ups" subtitle="Compact preview to explain coordination pressure and support routing decisions.">
                  <div className="space-y-2">
                    {selectedFollowUps.map((item) => <div key={item.id} className="rounded-xl tonal-micro p-2 text-xs text-left w-full"><button onClick={() => openRecordDrawer({ type: 'followup', id: item.id })} className="w-full text-left">{item.title}<div className="text-slate-500">{item.project} • {item.status}</div></button><div className="mt-2 flex gap-2"><button onClick={() => openRecordDrawer({ type: 'followup', id: item.id })} className="action-btn !px-2 !py-1 text-[11px]">{editSurfaceCtas.openContext}</button><button onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')} className="action-btn !px-2 !py-1 text-[11px]">{editSurfaceCtas.fullEditFollowUp}</button></div></div>)}
                    {selectedFollowUps.length === 0 ? <StatePanel compact tone="empty" title="No linked follow-ups yet" message="Create or link follow-ups from relationship context actions." /> : null}
                  </div>
                </SupportWorkspaceRelatedList>
                <SupportWorkspaceRelatedList title="Linked tasks" subtitle="Compact preview only; use task lane for full execution management.">
                  <div className="space-y-2">
                    {selectedTasks.map((task) => <div key={task.id} className="rounded-xl tonal-micro p-2 text-xs text-left w-full"><button onClick={() => openRecordDrawer({ type: 'task', id: task.id })} className="w-full text-left">{task.title}<div className="text-slate-500">{task.project} • {task.status}</div></button><div className="mt-2 flex gap-2"><button onClick={() => openRecordDrawer({ type: 'task', id: task.id })} className="action-btn !px-2 !py-1 text-[11px]">{editSurfaceCtas.openContext}</button><button onClick={() => openRecordEditor({ type: 'task', id: task.id }, 'edit', 'workspace')} className="action-btn !px-2 !py-1 text-[11px]">{editSurfaceCtas.fullEditTask}</button></div></div>)}
                    {selectedTasks.length === 0 ? <StatePanel compact tone="empty" title="No linked tasks" message="Add a task to make execution ownership explicit." /> : null}
                  </div>
                </SupportWorkspaceRelatedList>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">Linked projects</div>
                <div className="flex flex-wrap gap-2">
                  {selectedProjects.map((project) => <button key={project.id} onClick={() => openRecordDrawer({ type: 'project', id: project.id })} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">{project.name}</button>)}
                  {selectedProjects.length === 0 ? <StatePanel compact tone="empty" title="No linked projects" message="Link a follow-up or task to map this relationship to projects." /> : null}
                </div>
              </div>

              {selected.entityType === 'contact' && selectedContact ? (
                <div className="mt-4 rounded-2xl tonal-panel">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Contact context</div>
                  <div className="text-xs text-slate-600">{editSurfacePolicy.context.intent}</div>
                  <SupportWorkspaceMaintenanceTray title={`${editSurfacePolicy.maintenance.label} controls`}>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input value={selectedContact.title || ''} onChange={(e) => updateContact(selectedContact.id, { title: e.target.value })} placeholder="Title" className="field-input" />
                        <input value={selectedContact.department || ''} onChange={(e) => updateContact(selectedContact.id, { department: e.target.value })} placeholder="Department" className="field-input" />
                        <input value={selectedContact.internalOwner || ''} onChange={(e) => updateContact(selectedContact.id, { internalOwner: e.target.value })} placeholder="Internal owner" className="field-input" />
                        <input value={selectedContact.role} onChange={(e) => updateContact(selectedContact.id, { role: e.target.value })} placeholder="Role" className="field-input" />
                        <select value={selectedContact.relationshipStatus || 'Active'} onChange={(e) => updateContact(selectedContact.id, { relationshipStatus: e.target.value as typeof selectedContact.relationshipStatus })} className="field-input"><option>Active</option><option>Watch</option><option>Escalated</option><option>Dormant</option></select>
                        <select value={selectedContact.riskTier || 'Low'} onChange={(e) => updateContact(selectedContact.id, { riskTier: e.target.value as typeof selectedContact.riskTier })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select defaultValue="" onChange={(e) => { setRelationshipTargetId(e.target.value); if (!e.target.value) return; setRelationshipFlow('reassign_contact'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="field-input max-w-xs"><option value="">Reassign links to…</option>{contactOptions.filter((entry) => entry.id !== selectedContact.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                        <select defaultValue="" onChange={(e) => { setRelationshipTargetId(e.target.value); if (!e.target.value) return; setRelationshipFlow('merge_contact'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="field-input max-w-xs"><option value="">Merge into…</option>{contactOptions.filter((entry) => entry.id !== selectedContact.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                        <button onClick={() => { setRelationshipFlow('delete_contact'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete safely</button>
                      </div>
                  </SupportWorkspaceMaintenanceTray>
                </div>
              ) : null}

              {selected.entityType === 'company' && selectedCompany ? (
                <div className="mt-4 rounded-2xl tonal-panel">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Company context</div>
                  <div className="text-xs text-slate-600">{editSurfacePolicy.context.intent}</div>
                  <SupportWorkspaceMaintenanceTray title={`${editSurfacePolicy.maintenance.label} controls`}>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input value={selectedCompany.internalOwner || ''} onChange={(e) => updateCompany(selectedCompany.id, { internalOwner: e.target.value })} placeholder="Internal owner" className="field-input" />
                        <select value={selectedCompany.type} onChange={(e) => updateCompany(selectedCompany.id, { type: e.target.value as typeof selectedCompany.type })} className="field-input"><option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option></select>
                        <select value={selectedCompany.relationshipStatus || 'Active'} onChange={(e) => updateCompany(selectedCompany.id, { relationshipStatus: e.target.value as typeof selectedCompany.relationshipStatus })} className="field-input"><option>Active</option><option>Watch</option><option>Escalated</option><option>Dormant</option></select>
                        <select value={selectedCompany.riskTier || 'Low'} onChange={(e) => updateCompany(selectedCompany.id, { riskTier: e.target.value as typeof selectedCompany.riskTier })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                        <select value={selectedCompany.primaryContactId || ''} onChange={(e) => updateCompany(selectedCompany.id, { primaryContactId: e.target.value || undefined })} className="field-input"><option value="">Primary contact</option>{contactOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                        <textarea value={selectedCompany.escalationNotes || ''} onChange={(e) => updateCompany(selectedCompany.id, { escalationNotes: e.target.value })} placeholder="Escalation notes" className="field-textarea" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select defaultValue="" onChange={(e) => { setRelationshipTargetId(e.target.value); if (!e.target.value) return; setRelationshipFlow('reassign_company'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="field-input max-w-xs"><option value="">Reassign links to…</option>{companyOptions.filter((entry) => entry.id !== selectedCompany.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                        <select defaultValue="" onChange={(e) => { setRelationshipTargetId(e.target.value); if (!e.target.value) return; setRelationshipFlow('merge_company'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="field-input max-w-xs"><option value="">Merge into…</option>{companyOptions.filter((entry) => entry.id !== selectedCompany.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                        <button onClick={() => { setRelationshipFlow('delete_company'); setRelationshipWarnings([]); setRelationshipResult(null); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete safely</button>
                      </div>
                  </SupportWorkspaceMaintenanceTray>
                </div>
              ) : null}
            </SupportWorkspaceSelectedContextCard>
          ) : (
            <StatePanel tone="empty" title="No relationships match these filters" message="Reset filters or lower pressure thresholds to bring records back into view." />
          )}

          <div className="rounded-2xl tonal-panel text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><ArrowRightLeft className="h-4 w-4" />Safe delete and merge workflow</div>
            <div>Before deleting, review linked follow-ups/tasks/contacts and use reassignment or merge to preserve linkage integrity.</div>
          </div>
        </div>
      </div>
      <StructuredActionFlow
        open={!!relationshipFlow}
        title="Relationship action review"
        subtitle="Use one consistent flow for high-risk relationship actions."
        onCancel={() => setRelationshipFlow(null)}
        onConfirm={runRelationshipFlow}
        confirmLabel="Apply action"
        warnings={relationshipWarnings}
        blockers={(relationshipFlow?.includes('reassign') || relationshipFlow?.includes('merge')) && !relationshipTargetId ? ['Select a reassignment/merge target first.'] : []}
        result={relationshipResult}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Linked impact: {linkedCounts.followUps} follow-ups, {linkedCounts.tasks} tasks{selected?.entityType === 'company' ? `, ${linkedCounts.contacts} contacts` : ''}.
        </div>
      </StructuredActionFlow>
    </AppShellCard>
  );
}
