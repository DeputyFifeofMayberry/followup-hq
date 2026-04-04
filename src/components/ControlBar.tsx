import { ChevronDown, Plus, Search, SlidersHorizontal, TriangleAlert, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpCounts, selectFollowUpRows } from '../lib/followUpSelectors';
import { useAppStore } from '../store/useAppStore';
import type { SavedViewKey } from '../types';
import { FilterBar, WorkspaceToolbarRow } from './ui/AppPrimitives';
import { BatchSummarySection, CompletionNoteSection, StructuredActionFlow } from './actions/StructuredActionFlow';

const PRIMARY_VIEWS: SavedViewKey[] = ['All', 'Today', 'Waiting', 'Needs nudge', 'At risk', 'Ready to close'];

export function ControlBar({ compact = true }: { compact?: boolean }) {
  const {
    items,
    contacts,
    companies,
    search,
    activeView,
    followUpFilters,
    savedFollowUpViews,
    selectedFollowUpIds,
    setSearch,
    setActiveView,
    setFollowUpFilters,
    resetFollowUpFilters,
    openCreateModal,
    clearFollowUpSelection,
    saveFollowUpCustomView,
    applySavedFollowUpCustomView,
    batchUpdateFollowUps,
    runValidatedBatchFollowUpTransition,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    search: s.search,
    activeView: s.activeView,
    followUpFilters: s.followUpFilters,
    savedFollowUpViews: s.savedFollowUpViews,
    selectedFollowUpIds: s.selectedFollowUpIds,
    setSearch: s.setSearch,
    setActiveView: s.setActiveView,
    setFollowUpFilters: s.setFollowUpFilters,
    resetFollowUpFilters: s.resetFollowUpFilters,
    openCreateModal: s.openCreateModal,
    clearFollowUpSelection: s.clearFollowUpSelection,
    saveFollowUpCustomView: s.saveFollowUpCustomView,
    applySavedFollowUpCustomView: s.applySavedFollowUpCustomView,
    batchUpdateFollowUps: s.batchUpdateFollowUps,
    runValidatedBatchFollowUpTransition: s.runValidatedBatchFollowUpTransition,
  })));
  const [customViewName, setCustomViewName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [closeFlowOpen, setCloseFlowOpen] = useState(false);
  const [batchNote, setBatchNote] = useState('');
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);

  const projects = useMemo(() => ['All', ...new Set(items.map((item) => item.project))], [items]);
  const owners = useMemo(() => ['All', ...new Set(items.map((item) => item.owner))], [items]);
  const assignees = useMemo(() => ['All', ...new Set(items.map((item) => item.assigneeDisplayName || item.owner))], [items]);

  const filteredRows = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);
  const stats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);

  const applyBatchClose = () => {
    const result = runValidatedBatchFollowUpTransition(selectedFollowUpIds, 'Closed', { status: 'Closed', actionState: 'Complete', completionNote: batchNote.trim() || undefined });
    setBatchWarnings(result.warnings);
    setBatchResult({ tone: result.skipped || result.warnings.length ? 'warn' : 'success', message: `Batch close affected ${result.affected} and skipped ${result.skipped}.` });
  };

  const chips = [
    { key: 'All' as const, label: 'All', count: stats.total },
    { key: 'Overdue' as const, label: 'Overdue', count: stats.overdue, icon: TriangleAlert },
    { key: 'Needs nudge' as const, label: 'Needs nudge', count: stats.needsNudge },
    { key: 'At risk' as const, label: 'At risk', count: stats.atRisk, icon: Zap },
    { key: 'Ready to close' as const, label: 'Ready to close', count: stats.readyToClose },
  ];

  return (
    <div className="workspace-control-stack followup-control-stack">
      <WorkspaceToolbarRow className="followup-primary-head">
        <div>
          <h2 className="followup-primary-title">Follow-up execution lane</h2>
          <p className="followup-primary-subtitle">Run follow-up actions fast. Use the inspector for context-heavy decisions.</p>
        </div>
        {!compact ? (
          <button onClick={openCreateModal} className="action-btn">
            <Plus className="h-4 w-4" />
            Add follow-up
          </button>
        ) : null}
      </WorkspaceToolbarRow>

      <FilterBar>
        <div className="followup-chip-row followup-chip-strip">
          {chips.map(({ key, label, count, icon: Icon }) => (
            <button key={key} onClick={() => setActiveView(key)} className={activeView === key ? 'followup-chip followup-chip-active' : 'followup-chip'}>
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
      </FilterBar>

      <WorkspaceToolbarRow className="execution-toolbar-row">
        <label className="field-block">
          <span className="field-label">Search queue</span>
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, owner, project, next action, contact" className="field-input search-field-input" />
            {search ? <button type="button" onClick={() => setSearch('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>
        <select value={followUpFilters.status} onChange={(event) => setFollowUpFilters({ status: event.target.value as typeof followUpFilters.status })} className="field-input">
          <option value="All">All statuses</option><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
        </select>
        <select value={followUpFilters.owner} onChange={(event) => setFollowUpFilters({ owner: event.target.value })} className="field-input">
          {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
        </select>
        <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />View options <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
      </WorkspaceToolbarRow>

      {advancedOpen ? (
        <div className="followup-filter-grid advanced-filter-surface">
          <select value={activeView} onChange={(event) => setActiveView(event.target.value as SavedViewKey)} className="field-input">
            {PRIMARY_VIEWS.map((view) => <option key={view} value={view}>{view}</option>)}
          </select>
          <select value={followUpFilters.project} onChange={(event) => setFollowUpFilters({ project: event.target.value })} className="field-input">
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
          <select value={followUpFilters.assignee} onChange={(event) => setFollowUpFilters({ assignee: event.target.value })} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select>
          <select value={followUpFilters.priority} onChange={(event) => setFollowUpFilters({ priority: event.target.value as typeof followUpFilters.priority })} className="field-input"><option value="All">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
          <select value={followUpFilters.escalation} onChange={(event) => setFollowUpFilters({ escalation: event.target.value as typeof followUpFilters.escalation })} className="field-input"><option value="All">All escalation</option><option>None</option><option>Watch</option><option>Escalate</option><option>Critical</option></select>
          <select value={followUpFilters.linkedTaskState} onChange={(event) => setFollowUpFilters({ linkedTaskState: event.target.value as typeof followUpFilters.linkedTaskState })} className="field-input"><option value="all">All linked task states</option><option value="blocked_child">Blocked child</option><option value="overdue_child">Overdue child</option><option value="all_children_done">All children done</option><option value="has_open_children">Has open children</option><option value="none">No linked tasks</option></select>
          <div className="followup-saved-views-row followup-secondary-utility">
            <span className="followup-secondary-label">Saved views</span>
            <input value={customViewName} onChange={(event) => setCustomViewName(event.target.value)} className="field-input" placeholder="View name" />
            <button className="action-btn" onClick={() => { if (!customViewName.trim()) return; saveFollowUpCustomView(customViewName.trim(), search); setCustomViewName(''); }}>Save view</button>
            {savedFollowUpViews.map((view) => <button key={view.id} className="action-btn" onClick={() => applySavedFollowUpCustomView(view.id)}>{view.name}</button>)}
            <button className="action-btn" onClick={resetFollowUpFilters}>Reset filters</button>
          </div>
        </div>
      ) : null}

      {selectedFollowUpIds.length > 0 ? (
        <div className="followup-toolbar-foot bulk-action-strip execution-batch-strip">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{selectedFollowUpIds.length}</span> selected</div>
          <div className="followup-action-row">
            <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { lastNudgedAt: new Date().toISOString() }, 'Marked nudged (batch).')} className="action-btn">Mark nudged</button>
            <button onClick={() => batchUpdateFollowUps(selectedFollowUpIds, { status: 'In progress' }, 'Status changed to In progress (batch).')} className="action-btn">Set in progress</button>
            <button onClick={() => { setCloseFlowOpen(true); setBatchWarnings([]); setBatchResult(null); }} className="action-btn">Close selected</button>
            <button onClick={clearFollowUpSelection} className="action-btn">Clear</button>
          </div>
        </div>
      ) : (
        <div className="followup-toolbar-foot execution-toolbar-foot">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{filteredRows.length}</span> shown</div>
          <div className="followup-action-row"><span className="workspace-support-copy">Select a row to run context-heavy actions from the inspector.</span></div>
        </div>
      )}
      <StructuredActionFlow
        open={closeFlowOpen}
        title="Bulk close follow-ups"
        subtitle="Structured batch close flow with count, warnings, and result feedback."
        onCancel={() => setCloseFlowOpen(false)}
        onConfirm={applyBatchClose}
        confirmLabel="Apply batch close"
        warnings={batchWarnings}
        result={batchResult}
      >
        <BatchSummarySection selected={selectedFollowUpIds.length} affected={selectedFollowUpIds.length} skipped={0} />
        <CompletionNoteSection value={batchNote} onChange={setBatchNote} label="Batch completion note" />
      </StructuredActionFlow>
    </div>
  );
}
