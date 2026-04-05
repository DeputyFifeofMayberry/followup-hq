import { ChevronDown, Plus, Search, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpCounts, selectFollowUpRows } from '../lib/followUpSelectors';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpColumnKey, SavedViewKey } from '../types';
import { FilterBar, WorkspaceToolbarRow } from './ui/AppPrimitives';
import { BatchSummarySection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';

const PRIMARY_VIEWS: SavedViewKey[] = ['All', 'Needs nudge', 'At risk', 'Ready to close'];
const SECONDARY_VIEWS: SavedViewKey[] = ['Today', 'Waiting', 'Overdue', 'By project', 'Waiting on others', 'Promises due this week', 'Blocked by child tasks'];
const OPTIONAL_COLUMNS: FollowUpColumnKey[] = ['project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'actionState', 'nextAction'];

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
    followUpColumns,
    followUpTableDensity,
    followUpDuplicateModule,
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
    setFollowUpColumns,
    setFollowUpTableDensity,
    setFollowUpDuplicateModule,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    search: s.search,
    activeView: s.activeView,
    followUpFilters: s.followUpFilters,
    savedFollowUpViews: s.savedFollowUpViews,
    selectedFollowUpIds: s.selectedFollowUpIds,
    followUpColumns: s.followUpColumns,
    followUpTableDensity: s.followUpTableDensity,
    followUpDuplicateModule: s.followUpDuplicateModule,
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
    setFollowUpColumns: s.setFollowUpColumns,
    setFollowUpTableDensity: s.setFollowUpTableDensity,
    setFollowUpDuplicateModule: s.setFollowUpDuplicateModule,
  })));
  const [customViewName, setCustomViewName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [batchFlow, setBatchFlow] = useState<'close' | 'nudge' | 'snooze' | null>(null);
  const [batchNote, setBatchNote] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [batchBlockers, setBatchBlockers] = useState<string[]>([]);
  const [batchAffected, setBatchAffected] = useState(0);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const [batchResult, setBatchResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);

  const projects = useMemo(() => ['All', ...new Set(items.map((item) => item.project))], [items]);
  const owners = useMemo(() => ['All', ...new Set(items.map((item) => item.owner))], [items]);
  const assignees = useMemo(() => ['All', ...new Set(items.map((item) => item.assigneeDisplayName || item.owner))], [items]);

  const filteredRows = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);
  const stats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);

  const applyBatchClose = () => {
    const result = runValidatedBatchFollowUpTransition(selectedFollowUpIds, 'Closed', { status: 'Closed', actionState: 'Complete', completionNote: batchNote.trim() || undefined });
    setBatchWarnings(result.warnings);
    setBatchAffected(result.affected);
    setBatchSkipped(result.skipped);
    setBatchResult({ tone: result.skipped || result.warnings.length ? 'warn' : 'success', message: `Batch close affected ${result.affected} and skipped ${result.skipped}.` });
  };

  const openBatchFlow = (kind: NonNullable<typeof batchFlow>) => {
    setBatchFlow(kind);
    setBatchWarnings([]);
    setBatchBlockers([]);
    setBatchResult(null);
    setBatchAffected(selectedFollowUpIds.length);
    setBatchSkipped(0);
    if (kind === 'snooze') setBatchDate(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  };

  const applyBatchFlow = () => {
    if (batchFlow === 'close') {
      applyBatchClose();
      return;
    }
    if (batchFlow === 'nudge') {
      batchUpdateFollowUps(selectedFollowUpIds, { lastNudgedAt: new Date().toISOString() }, 'Marked nudged (batch).');
      setBatchAffected(selectedFollowUpIds.length);
      setBatchSkipped(0);
      setBatchWarnings([]);
      setBatchBlockers([]);
      setBatchResult({ tone: 'success', message: `Marked ${selectedFollowUpIds.length} follow-up(s) nudged.` });
      return;
    }
    if (!batchDate) {
      setBatchBlockers(['Snooze requires a target date.']);
      setBatchResult({ tone: 'danger', message: 'Batch snooze not applied.' });
      return;
    }
    const iso = new Date(`${batchDate}T00:00:00`).toISOString();
    batchUpdateFollowUps(selectedFollowUpIds, { nextTouchDate: iso, snoozedUntilDate: iso }, `Snoozed until ${batchDate} (batch).`);
    setBatchAffected(selectedFollowUpIds.length);
    setBatchSkipped(0);
    setBatchWarnings([]);
    setBatchBlockers([]);
    setBatchResult({ tone: 'success', message: `Snoozed ${selectedFollowUpIds.length} follow-up(s).` });
  };

  const toggleColumn = (column: FollowUpColumnKey) => {
    if (followUpColumns.includes(column)) {
      setFollowUpColumns(followUpColumns.filter((entry) => entry !== column));
      return;
    }
    setFollowUpColumns([...followUpColumns, column]);
  };

  return (
    <div className="workspace-control-stack followup-control-stack">
      <FilterBar>
        <div className="followup-chip-row followup-chip-strip">
          {PRIMARY_VIEWS.map((view) => {
            const count = view === 'All' ? stats.total : view === 'Needs nudge' ? stats.needsNudge : view === 'At risk' ? stats.atRisk : stats.readyToClose;
            return (
              <button key={view} onClick={() => setActiveView(view)} className={activeView === view ? 'followup-chip followup-chip-active' : 'followup-chip'}>
                <span>{view === 'All' ? 'All open' : view}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
          <select value={SECONDARY_VIEWS.includes(activeView) ? activeView : ''} onChange={(event) => setActiveView(event.target.value as SavedViewKey)} className="field-input !w-auto">
            <option value="">More views</option>
            {SECONDARY_VIEWS.map((view) => <option key={view} value={view}>{view}</option>)}
          </select>
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
        <button onClick={() => setAdvancedOpen((prev) => !prev)} className="action-btn"><SlidersHorizontal className="h-4 w-4" />Filters <ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
        <button onClick={() => setPreferencesOpen((prev) => !prev)} className="action-btn"><Settings2 className="h-4 w-4" />Customize <ChevronDown className={`h-4 w-4 ${preferencesOpen ? 'rotate-180' : ''}`} /></button>
        {!compact ? (
          <button onClick={openCreateModal} className="action-btn">
            <Plus className="h-4 w-4" />
            Add follow-up
          </button>
        ) : null}
      </WorkspaceToolbarRow>

      {advancedOpen ? (
        <div className="followup-filter-grid advanced-filter-surface">
          <select value={followUpFilters.project} onChange={(event) => setFollowUpFilters({ project: event.target.value })} className="field-input">
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
          <select value={followUpFilters.owner} onChange={(event) => setFollowUpFilters({ owner: event.target.value })} className="field-input">
            {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
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

      {preferencesOpen ? (
        <div className="followup-filter-grid advanced-filter-surface">
          <label className="field-block"><span className="field-label">Row density</span>
            <select value={followUpTableDensity} onChange={(event) => setFollowUpTableDensity(event.target.value as typeof followUpTableDensity)} className="field-input">
              <option value="compact">Compact</option>
              <option value="comfortable">Expanded</option>
            </select>
          </label>
          <label className="field-block"><span className="field-label">Duplicate module</span>
            <select value={followUpDuplicateModule} onChange={(event) => setFollowUpDuplicateModule(event.target.value as typeof followUpDuplicateModule)} className="field-input">
              <option value="auto">Show only when flagged</option>
              <option value="collapsed">Collapsed when flagged</option>
              <option value="expanded">Always expanded when flagged</option>
            </select>
          </label>
          <div className="followup-saved-views-row followup-secondary-utility">
            <span className="followup-secondary-label">Optional columns</span>
            {OPTIONAL_COLUMNS.map((column) => (
              <label key={column} className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={followUpColumns.includes(column)} onChange={() => toggleColumn(column)} />
                {column}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {selectedFollowUpIds.length > 0 ? (
        <div className="followup-toolbar-foot bulk-action-strip execution-batch-strip">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{selectedFollowUpIds.length}</span> selected</div>
          <div className="followup-action-row">
            <button onClick={() => openBatchFlow('nudge')} className="action-btn">Mark nudged</button>
            <button onClick={() => openBatchFlow('snooze')} className="action-btn">Snooze selected</button>
            <button onClick={() => openBatchFlow('close')} className="action-btn">Close selected</button>
            <button onClick={clearFollowUpSelection} className="action-btn">Clear</button>
          </div>
        </div>
      ) : (
        <div className="followup-toolbar-foot execution-toolbar-foot">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{filteredRows.length}</span> shown</div>
        </div>
      )}
      <StructuredActionFlow
        open={!!batchFlow}
        title={batchFlow === 'nudge' ? 'Bulk mark nudged' : batchFlow === 'snooze' ? 'Bulk snooze follow-ups' : 'Bulk close follow-ups'}
        subtitle="Structured batch close flow with count, warnings, and result feedback."
        onCancel={() => setBatchFlow(null)}
        onConfirm={applyBatchFlow}
        confirmLabel={batchFlow === 'nudge' ? 'Apply nudge' : batchFlow === 'snooze' ? 'Apply snooze' : 'Apply batch close'}
        warnings={batchWarnings}
        blockers={batchBlockers}
        result={batchResult}
      >
        <BatchSummarySection selected={selectedFollowUpIds.length} affected={batchAffected} skipped={batchSkipped} />
        {batchFlow === 'close' ? <CompletionNoteSection value={batchNote} onChange={setBatchNote} label="Batch completion note" /> : null}
        {batchFlow === 'snooze' ? <DateSection label="Snooze until" value={batchDate} onChange={setBatchDate} /> : null}
      </StructuredActionFlow>
    </div>
  );
}
