import { CheckCircle2, ChevronDown, Plus, Search, SlidersHorizontal, TriangleAlert, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpCounts, selectFollowUpRows } from '../lib/followUpSelectors';
import { useAppStore } from '../store/useAppStore';
import type { SavedViewKey } from '../types';
import { FilterBar, WorkspaceToolbarRow } from './ui/AppPrimitives';

const ALL_VIEWS: SavedViewKey[] = ['All', 'Today', 'Waiting', 'Waiting on others', 'Needs nudge', 'At risk', 'Overdue', 'Ready to close', 'Promises due this week', 'Blocked by child tasks', 'By project'];

export function ControlBar({ compact = true }: { compact?: boolean }) {
  const {
    items,
    contacts,
    companies,
    search,
    activeView,
    selectedId,
    followUpFilters,
    savedFollowUpViews,
    selectedFollowUpIds,
    setSearch,
    setActiveView,
    setFollowUpFilters,
    resetFollowUpFilters,
    openCreateModal,
    openEditModal,
    openTouchModal,
    markNudged,
    updateItem,
    clearFollowUpSelection,
    saveFollowUpCustomView,
    applySavedFollowUpCustomView,
    batchUpdateFollowUps,
    attemptFollowUpTransition,
    runValidatedBatchFollowUpTransition,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    search: s.search,
    activeView: s.activeView,
    selectedId: s.selectedId,
    followUpFilters: s.followUpFilters,
    savedFollowUpViews: s.savedFollowUpViews,
    selectedFollowUpIds: s.selectedFollowUpIds,
    setSearch: s.setSearch,
    setActiveView: s.setActiveView,
    setFollowUpFilters: s.setFollowUpFilters,
    resetFollowUpFilters: s.resetFollowUpFilters,
    openCreateModal: s.openCreateModal,
    openEditModal: s.openEditModal,
    openTouchModal: s.openTouchModal,
    markNudged: s.markNudged,
    updateItem: s.updateItem,
    clearFollowUpSelection: s.clearFollowUpSelection,
    saveFollowUpCustomView: s.saveFollowUpCustomView,
    applySavedFollowUpCustomView: s.applySavedFollowUpCustomView,
    batchUpdateFollowUps: s.batchUpdateFollowUps,
    attemptFollowUpTransition: s.attemptFollowUpTransition,
    runValidatedBatchFollowUpTransition: s.runValidatedBatchFollowUpTransition,
  })));
  const [customViewName, setCustomViewName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const projects = useMemo(() => ['All', ...new Set(items.map((item) => item.project))], [items]);
  const owners = useMemo(() => ['All', ...new Set(items.map((item) => item.owner))], [items]);
  const assignees = useMemo(() => ['All', ...new Set(items.map((item) => item.assigneeDisplayName || item.owner))], [items]);

  const filteredRows = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);
  const stats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);

  const chips = [
    { key: 'All' as const, label: 'All', count: stats.total },
    { key: 'Overdue' as const, label: 'Overdue', count: stats.overdue, icon: TriangleAlert },
    { key: 'Needs nudge' as const, label: 'Needs nudge', count: stats.needsNudge },
    { key: 'At risk' as const, label: 'At risk', count: stats.atRisk, icon: Zap },
    { key: 'Ready to close' as const, label: 'Ready to close', count: stats.readyToClose },
  ];

  return (
    <div className="workspace-control-stack followup-control-stack">
      <FilterBar>
        <div className="followup-chip-row">
          {chips.map(({ key, label, count, icon: Icon }) => (
            <button key={key} onClick={() => setActiveView(key)} className={activeView === key ? 'followup-chip followup-chip-active' : 'followup-chip'}>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
      </FilterBar>

      {!compact ? (
        <WorkspaceToolbarRow>
          <button onClick={openCreateModal} className="action-btn">
            <Plus className="h-4 w-4" />
            Quick Add follow-up
          </button>
          <span className="workspace-support-copy">Primary edits stay in-row; deeper updates live in inspector.</span>
        </WorkspaceToolbarRow>
      ) : null}

      <WorkspaceToolbarRow>
        <label className="field-block">
          <span className="field-label">Search queue</span>
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, owner, project, next action, contact" className="field-input search-field-input" />
            {search ? <button type="button" onClick={() => setSearch('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        <select value={activeView} onChange={(event) => setActiveView(event.target.value as SavedViewKey)} className="field-input">
          {ALL_VIEWS.map((view) => <option key={view} value={view}>{view}</option>)}
        </select>
        <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />Advanced <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
        <button className="action-btn" onClick={resetFollowUpFilters}>Reset filters</button>
        <button onClick={openCreateModal} className="action-btn">
          <Plus className="h-4 w-4" />
          Add follow-up
        </button>
      </WorkspaceToolbarRow>

      {advancedOpen ? (
        <div className="followup-filter-grid advanced-filter-surface">
          <select value={followUpFilters.project} onChange={(event) => setFollowUpFilters({ project: event.target.value })} className="field-input">
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
          <select value={followUpFilters.status} onChange={(event) => setFollowUpFilters({ status: event.target.value as typeof followUpFilters.status })} className="field-input">
            <option value="All">All statuses</option><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
          </select>
          <select value={followUpFilters.owner} onChange={(event) => setFollowUpFilters({ owner: event.target.value })} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select>
          <select value={followUpFilters.assignee} onChange={(event) => setFollowUpFilters({ assignee: event.target.value })} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select>
          <select value={followUpFilters.priority} onChange={(event) => setFollowUpFilters({ priority: event.target.value as typeof followUpFilters.priority })} className="field-input"><option value="All">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
          <select value={followUpFilters.escalation} onChange={(event) => setFollowUpFilters({ escalation: event.target.value as typeof followUpFilters.escalation })} className="field-input"><option value="All">All escalation</option><option>None</option><option>Watch</option><option>Escalate</option><option>Critical</option></select>
          <select value={followUpFilters.linkedTaskState} onChange={(event) => setFollowUpFilters({ linkedTaskState: event.target.value as typeof followUpFilters.linkedTaskState })} className="field-input"><option value="all">All linked task states</option><option value="blocked_child">Blocked child</option><option value="overdue_child">Overdue child</option><option value="all_children_done">All children done</option><option value="has_open_children">Has open children</option><option value="none">No linked tasks</option></select>
          <div className="followup-saved-views-row">
            <input value={customViewName} onChange={(event) => setCustomViewName(event.target.value)} className="field-input" placeholder="View name" />
            <button className="action-btn" onClick={() => { if (!customViewName.trim()) return; saveFollowUpCustomView(customViewName.trim(), search); setCustomViewName(''); }}>Save view</button>
            {savedFollowUpViews.map((view) => <button key={view.id} className="action-btn" onClick={() => applySavedFollowUpCustomView(view.id)}>{view.name}</button>)}
          </div>
        </div>
      ) : null}

      {selectedFollowUpIds.length > 0 ? (
        <div className="followup-toolbar-foot bulk-action-strip">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{selectedFollowUpIds.length}</span> selected</div>
          <div className="followup-action-row">
            <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { lastNudgedAt: new Date().toISOString() }, 'Marked nudged (batch).')} className="action-btn">Mark nudged</button>
            <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { status: 'In progress' }, 'Status changed to In progress (batch).')} className="action-btn">Set In progress</button>
            <button onClick={() => { const note = window.prompt('Batch close note (applied to all):',''); const result = runValidatedBatchFollowUpTransition(selectedFollowUpIds, 'Closed', { status: 'Closed', actionState: 'Complete', completionNote: note || undefined }); window.alert(`Batch close: ${result.affected} affected, ${result.skipped} skipped.${result.warnings.length ? `\n${result.warnings.slice(0,4).join('\n')}` : ''}`); }} className="action-btn">Close</button>
            <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { escalationLevel: 'Escalate' }, 'Escalation set to Escalate (batch).')} className="action-btn">Escalate</button>
            <button onClick={() => { const until = new Date(Date.now() + 3 * 86400000).toISOString(); batchUpdateFollowUps(selectedFollowUpIds, { nextTouchDate: until, snoozedUntilDate: until }, 'Snoozed 3 days (batch).'); }} className="action-btn">Snooze 3d</button>
            <button onClick={clearFollowUpSelection} className="action-btn">Clear selection</button>
          </div>
        </div>
      ) : (
        <div className="followup-toolbar-foot">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{filteredRows.length}</span> shown</div>
          <div className="followup-action-row">
            <button onClick={() => selectedItem && openEditModal(selectedItem.id)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Open detail</button>
            <button onClick={() => selectedItem && openTouchModal()} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Log touch</button>
            <button onClick={() => selectedItem && markNudged(selectedItem.id)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Mark nudged</button>
            <button onClick={() => { if (!selectedItem) return; if (selectedItem.status === 'Closed') { updateItem(selectedItem.id, { status: 'Needs action' }); return; } const note = window.prompt('Closeout note:', selectedItem.completionNote || ''); const result = attemptFollowUpTransition(selectedItem.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined }); if (!result.applied && result.validation.overrideAllowed) { const proceed = window.confirm(`${result.validation.blockers.join(' ')}\nClose anyway with override?`); if (!proceed) return; attemptFollowUpTransition(selectedItem.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined }, { override: true }); return; } if (!result.applied) window.alert(result.validation.blockers.join(' ')); }} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />
              {selectedItem?.status === 'Closed' ? 'Reopen' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
