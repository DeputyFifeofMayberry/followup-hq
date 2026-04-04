import { AlertTriangle, ArrowRightLeft, Building2, Clock3, Filter, Flame, PlusCircle, Search, Trash2, Users } from 'lucide-react';
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
import { AppShellCard, SectionHeader } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import type { AppMode } from '../types';

export function RelationshipBoard({ appMode = 'team' }: { appMode?: AppMode }) {
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
    addItem,
    addTask,
    projects,
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
    addItem: s.addItem,
    addTask: s.addTask,
    projects: s.projects,
  })));

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

  const ownerSummary = useMemo(() => buildOwnerSummary(items, tasks), [items, tasks]);
  const relationshipRows = useMemo(() => buildRelationshipSummaries(items, tasks, contacts, companies), [items, tasks, contacts, companies]);
  const filteredRows = useMemo(() => sortRelationshipSummaries(filterRelationshipSummaries(relationshipRows, filters), sortBy, sortDirection), [relationshipRows, filters, sortBy, sortDirection]);
  const selected = useMemo(() => filteredRows.find((row) => row.id === selectedId && row.entityType === selectedEntityType) || filteredRows[0], [filteredRows, selectedId, selectedEntityType]);

  const bottlenecks = useMemo(() => relationshipRows
    .filter((row) => row.waitingFollowUps + row.blockedTasks + row.overdueFollowUps + row.overdueTasks > 0)
    .sort((a, b) => b.pressureScore - a.pressureScore)
    .slice(0, 6), [relationshipRows]);

  const selectedFollowUps = useMemo(() => {
    if (!selected) return [];
    return items.filter((item) => selected.entityType === 'contact' ? item.contactId === selected.id : item.companyId === selected.id).slice(0, 8);
  }, [selected, items]);

  const selectedTasks = useMemo(() => {
    if (!selected) return [];
    return tasks.filter((task) => selected.entityType === 'contact' ? task.contactId === selected.id : task.companyId === selected.id).slice(0, 8);
  }, [selected, tasks]);

  const selectedProjects = useMemo(() => {
    const keys = new Set<string>();
    selectedFollowUps.forEach((item) => keys.add(item.projectId || item.project));
    selectedTasks.forEach((task) => keys.add(task.projectId || task.project));
    return projects.filter((project) => keys.has(project.id) || keys.has(project.name));
  }, [projects, selectedFollowUps, selectedTasks]);

  const contactOptions = contacts.map((contact) => ({ id: contact.id, label: contact.name }));
  const companyOptions = companies.map((company) => ({ id: company.id, label: company.name }));

  const selectedContact = selected && selected.entityType === 'contact' ? contacts.find((entry) => entry.id === selected.id) : null;
  const selectedCompany = selected && selected.entityType === 'company' ? companies.find((entry) => entry.id === selected.id) : null;

  const linkedCounts = selected ? {
    followUps: items.filter((item) => selected.entityType === 'contact' ? item.contactId === selected.id : item.companyId === selected.id).length,
    tasks: tasks.filter((task) => selected.entityType === 'contact' ? task.contactId === selected.id : task.companyId === selected.id).length,
    contacts: selected.entityType === 'company' ? contacts.filter((contact) => contact.companyId === selected.id).length : 0,
  } : { followUps: 0, tasks: 0, contacts: 0 };

  return (
    <AppShellCard className="workspace-inspector-panel relationship-command-surface" surface="command">
      <div className="border-b border-slate-200 px-5 py-4">
        <SectionHeader title={appMode === 'personal' ? 'Relationship support lens' : 'Relationship command center'} subtitle={modeConfig.relationshipsSubtitle} />
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-2xl tonal-panel advanced-filter-surface">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Search className="h-4 w-4" />Find relationships</div>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Search contact, company, owner, role" className="field-input" />
              <select value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value as typeof prev.entityType }))} className="field-input">
                <option value="all">All entities</option>
                <option value="contact">Contacts</option>
                <option value="company">Companies</option>
              </select>
              <select value={filters.companyType} onChange={(e) => setFilters((prev) => ({ ...prev, companyType: e.target.value as typeof prev.companyType }))} className="field-input">
                <option value="all">All company types</option>
                <option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option>
              </select>
              <select value={filters.riskTier} onChange={(e) => setFilters((prev) => ({ ...prev, riskTier: e.target.value as typeof prev.riskTier }))} className="field-input">
                <option value="all">All risk tiers</option>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
              <input type="number" min={0} value={filters.minActiveProjects} onChange={(e) => setFilters((prev) => ({ ...prev, minActiveProjects: Number(e.target.value) || 0 }))} placeholder="Min active projects" className="field-input" />
              <input type="number" min={0} value={filters.minWaitingPressure} onChange={(e) => setFilters((prev) => ({ ...prev, minWaitingPressure: Number(e.target.value) || 0 }))} placeholder="Min waiting pressure" className="field-input" />
              <input type="number" min={0} value={filters.minOverduePressure} onChange={(e) => setFilters((prev) => ({ ...prev, minOverduePressure: Number(e.target.value) || 0 }))} placeholder="Min overdue pressure" className="field-input" />
              <input type="number" min={0} value={filters.minBlockedTaskPressure} onChange={(e) => setFilters((prev) => ({ ...prev, minBlockedTaskPressure: Number(e.target.value) || 0 }))} placeholder="Min blocked task pressure" className="field-input" />
              <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={filters.staleOnly} onChange={(e) => setFilters((prev) => ({ ...prev, staleOnly: e.target.checked }))} />Stale only (&gt;=14 days since touch)</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as RelationshipSortKey)} className="field-input">
                  <option value="pressure">Sort by pressure</option><option value="name">Sort by name</option><option value="activeProjects">Sort by projects</option><option value="waiting">Sort by waiting</option><option value="overdue">Sort by overdue</option><option value="touchAge">Sort by touch age</option><option value="risk">Sort by risk</option>
                </select>
                <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as typeof sortDirection)} className="field-input">
                  <option value="desc">Desc</option><option value="asc">Asc</option>
                </select>
              </div>
            </div>
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
              <button onClick={() => setFilters(defaultRelationshipFilter)} className="action-btn !px-2.5 !py-1 text-xs">Reset</button>
            </div>
          </div>

          <div className="rounded-2xl tonal-panel">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Filter className="h-4 w-4" />Likely bottlenecks</div>
            <div className="space-y-2">
              {bottlenecks.map((entry) => (
                <button key={`${entry.entityType}-${entry.id}`} onClick={() => { setSelectedId(entry.id); setSelectedEntityType(entry.entityType); }} className="w-full rounded-xl tonal-micro text-left text-sm  list-row-family">
                  <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-900">{entry.name}</span><span className="text-xs text-rose-700">Score {entry.pressureScore}</span></div>
                  <div className="mt-1 text-xs text-slate-600">Waiting {entry.waitingFollowUps} • Overdue {entry.overdueFollowUps + entry.overdueTasks} • Blocked tasks {entry.blockedTasks}</div>
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

        <div className="space-y-4">
          <div className="rounded-2xl tonal-panel">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="panel-title">Relationship portfolio ({filteredRows.length})</div>
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
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="rounded-2xl tonal-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inspector-title">{selected.name}</div>
                  <div className="panel-supporting-text">{selected.entityType === 'contact' ? 'Contact' : 'Company'} • {selected.subtitle}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => addItem({ id: `REL-${Date.now()}`, title: `Follow-up: ${selected.name}`, source: 'Notes', project: selectedProjects[0]?.name || 'General', projectId: selectedProjects[0]?.id, owner: selected.internalOwner || 'Unassigned', status: 'Needs action', priority: selected.riskTier === 'Critical' ? 'Critical' : 'Medium', dueDate: new Date().toISOString(), lastTouchDate: new Date().toISOString(), nextTouchDate: new Date(Date.now() + 86400000).toISOString(), nextAction: `Reach out to ${selected.name}`, summary: 'Created from relationships tab.', tags: ['Relationship action'], sourceRef: 'Relationship board', sourceRefs: [], mergedItemIds: [], waitingOn: selected.name, notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Internal', escalationLevel: selected.riskTier === 'Critical' ? 'Critical' : 'None', cadenceDays: 3, contactId: selected.entityType === 'contact' ? selected.id : undefined, companyId: selected.entityType === 'company' ? selected.id : undefined })} className={modeConfig.supportActionsSecondary ? 'action-btn' : 'primary-btn'}><PlusCircle className="h-4 w-4" />New follow-up</button>
                  <button onClick={() => addTask({ id: `RELTSK-${Date.now()}`, title: `Task: ${selected.name}`, project: selectedProjects[0]?.name || 'General', projectId: selectedProjects[0]?.id, owner: selected.internalOwner || 'Unassigned', status: 'To do', priority: selected.riskTier === 'Critical' ? 'Critical' : 'Medium', summary: 'Created from relationship board.', nextStep: 'Coordinate next move', notes: '', tags: ['Relationship action'], contactId: selected.entityType === 'contact' ? selected.id : undefined, companyId: selected.entityType === 'company' ? selected.id : undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })} className="action-btn"><PlusCircle className="h-4 w-4" />New task</button>
                  <button onClick={() => setFilters((prev) => ({ ...prev, minWaitingPressure: 1 }))} className="action-btn"><Clock3 className="h-4 w-4" />Open waiting</button>
                  <button onClick={() => setFilters((prev) => ({ ...prev, minOverduePressure: 1 }))} className="action-btn"><AlertTriangle className="h-4 w-4" />Open overdue</button>
                  <button onClick={() => (selected.entityType === 'contact' ? updateContact(selected.id, { relationshipStatus: 'Watch' }) : updateCompany(selected.id, { relationshipStatus: 'Watch' }))} className="action-btn"><Flame className="h-4 w-4" />Mark watch</button>
                  <button onClick={() => (selected.entityType === 'contact' ? updateContact(selected.id, { lastContactedAt: new Date().toISOString(), lastResponseAt: new Date().toISOString() }) : updateCompany(selected.id, { lastReviewedAt: new Date().toISOString() }))} className="action-btn">Log interaction</button>
                  <button onClick={() => addItem({ id: `RELREM-${Date.now()}`, title: `Next touch reminder: ${selected.name}`, source: 'Notes', project: selectedProjects[0]?.name || 'General', projectId: selectedProjects[0]?.id, owner: selected.internalOwner || 'Unassigned', status: 'Needs action', priority: 'Medium', dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), lastTouchDate: new Date().toISOString(), nextTouchDate: new Date(Date.now() + 2 * 86400000).toISOString(), nextAction: `Touch base with ${selected.name}`, summary: 'Relationship next touch reminder.', tags: ['Reminder'], sourceRef: 'Relationship board', sourceRefs: [], mergedItemIds: [], notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Internal', escalationLevel: 'None', cadenceDays: 2, contactId: selected.entityType === 'contact' ? selected.id : undefined, companyId: selected.entityType === 'company' ? selected.id : undefined })} className="action-btn">Set next touch</button>
                </div>
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
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Linked follow-ups</div>
                  <div className="space-y-2">
                    {selectedFollowUps.map((item) => <div key={item.id} className="rounded-xl tonal-micro text-xs">{item.title}<div className="text-slate-500">{item.project} • {item.status}</div></div>)}
                    {selectedFollowUps.length === 0 ? <div className="text-xs text-slate-500">No follow-ups linked.</div> : null}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Linked tasks</div>
                  <div className="space-y-2">
                    {selectedTasks.map((task) => <div key={task.id} className="rounded-xl tonal-micro text-xs">{task.title}<div className="text-slate-500">{task.project} • {task.status}</div></div>)}
                    {selectedTasks.length === 0 ? <div className="text-xs text-slate-500">No tasks linked.</div> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">Linked projects</div>
                <div className="flex flex-wrap gap-2">
                  {selectedProjects.map((project) => <span key={project.id} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">{project.name}</span>)}
                  {selectedProjects.length === 0 ? <span className="text-xs text-slate-500">No linked projects.</span> : null}
                </div>
              </div>

              {selected.entityType === 'contact' && selectedContact ? (
                <div className="mt-4 rounded-2xl tonal-panel">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Contact details</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input value={selectedContact.title || ''} onChange={(e) => updateContact(selectedContact.id, { title: e.target.value })} placeholder="Title" className="field-input" />
                    <input value={selectedContact.department || ''} onChange={(e) => updateContact(selectedContact.id, { department: e.target.value })} placeholder="Department" className="field-input" />
                    <input value={selectedContact.internalOwner || ''} onChange={(e) => updateContact(selectedContact.id, { internalOwner: e.target.value })} placeholder="Internal owner" className="field-input" />
                    <input value={selectedContact.role} onChange={(e) => updateContact(selectedContact.id, { role: e.target.value })} placeholder="Role" className="field-input" />
                    <select value={selectedContact.relationshipStatus || 'Active'} onChange={(e) => updateContact(selectedContact.id, { relationshipStatus: e.target.value as typeof selectedContact.relationshipStatus })} className="field-input"><option>Active</option><option>Watch</option><option>Escalated</option><option>Dormant</option></select>
                    <select value={selectedContact.riskTier || 'Low'} onChange={(e) => updateContact(selectedContact.id, { riskTier: e.target.value as typeof selectedContact.riskTier })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select defaultValue="" onChange={(e) => { if (!e.target.value) return; reassignContactLinks(selectedContact.id, e.target.value); }} className="field-input max-w-xs"><option value="">Reassign links to…</option>{contactOptions.filter((entry) => entry.id !== selectedContact.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                    <select defaultValue="" onChange={(e) => { if (!e.target.value) return; mergeContacts(e.target.value, selectedContact.id); }} className="field-input max-w-xs"><option value="">Merge into…</option>{contactOptions.filter((entry) => entry.id !== selectedContact.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                    <button onClick={() => {
                      if (!window.confirm(`Delete ${selectedContact.name}? This will unlink ${linkedCounts.followUps} follow-ups and ${linkedCounts.tasks} tasks.`)) return;
                      deleteContact(selectedContact.id);
                    }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete safely</button>
                  </div>
                </div>
              ) : null}

              {selected.entityType === 'company' && selectedCompany ? (
                <div className="mt-4 rounded-2xl tonal-panel">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Company details</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input value={selectedCompany.internalOwner || ''} onChange={(e) => updateCompany(selectedCompany.id, { internalOwner: e.target.value })} placeholder="Internal owner" className="field-input" />
                    <select value={selectedCompany.type} onChange={(e) => updateCompany(selectedCompany.id, { type: e.target.value as typeof selectedCompany.type })} className="field-input"><option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option></select>
                    <select value={selectedCompany.relationshipStatus || 'Active'} onChange={(e) => updateCompany(selectedCompany.id, { relationshipStatus: e.target.value as typeof selectedCompany.relationshipStatus })} className="field-input"><option>Active</option><option>Watch</option><option>Escalated</option><option>Dormant</option></select>
                    <select value={selectedCompany.riskTier || 'Low'} onChange={(e) => updateCompany(selectedCompany.id, { riskTier: e.target.value as typeof selectedCompany.riskTier })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                    <select value={selectedCompany.primaryContactId || ''} onChange={(e) => updateCompany(selectedCompany.id, { primaryContactId: e.target.value || undefined })} className="field-input"><option value="">Primary contact</option>{contactOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                    <textarea value={selectedCompany.escalationNotes || ''} onChange={(e) => updateCompany(selectedCompany.id, { escalationNotes: e.target.value })} placeholder="Escalation notes" className="field-textarea" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select defaultValue="" onChange={(e) => { if (!e.target.value) return; reassignCompanyLinks(selectedCompany.id, e.target.value); }} className="field-input max-w-xs"><option value="">Reassign links to…</option>{companyOptions.filter((entry) => entry.id !== selectedCompany.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                    <select defaultValue="" onChange={(e) => { if (!e.target.value) return; mergeCompanies(e.target.value, selectedCompany.id); }} className="field-input max-w-xs"><option value="">Merge into…</option>{companyOptions.filter((entry) => entry.id !== selectedCompany.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
                    <button onClick={() => {
                      if (!window.confirm(`Delete ${selectedCompany.name}? This will unlink ${linkedCounts.followUps} follow-ups, ${linkedCounts.tasks} tasks, and ${linkedCounts.contacts} contacts.`)) return;
                      deleteCompany(selectedCompany.id);
                    }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete safely</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl tonal-panel text-sm text-slate-500">No relationships match the current filters. Reset filters or lower pressure thresholds.</div>
          )}

          <div className="rounded-2xl tonal-panel text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><ArrowRightLeft className="h-4 w-4" />Safe delete and merge workflow</div>
            <div>Before deleting, review linked follow-ups/tasks/contacts and use reassignment or merge to preserve linkage integrity.</div>
          </div>
        </div>
      </div>
    </AppShellCard>
  );
}
