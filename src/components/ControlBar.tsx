import { ChevronDown, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildFollowUpCounts, selectFollowUpRows } from '../lib/followUpSelectors';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpColumnKey, SavedViewKey } from '../types';
import { ExecutionLaneToolbar, FilterBar } from './ui/AppPrimitives';
import { BatchSummarySection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';

const PRIMARY_VIEWS: SavedViewKey[] = ['All', 'Needs nudge', 'At risk', 'Ready to close'];
const SECONDARY_VIEWS: SavedViewKey[] = ['Today', 'Waiting', 'Overdue', 'By project', 'Waiting on others', 'Promises due this week', 'Blocked by child tasks'];
const OPTIONAL_COLUMNS: FollowUpColumnKey[] = ['project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'actionState', 'nextAction'];

type ControlPanel = 'filters' | 'display' | 'savedViews' | null;

export function ControlBar() {
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
  const [openPanel, setOpenPanel] = useState<ControlPanel>(null);
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

  const activeAdvancedFilterCount = useMemo(() => (
    [
      followUpFilters.project !== 'All',
      followUpFilters.owner !== 'All',
      followUpFilters.assignee !== 'All',
      followUpFilters.priority !== 'All',
      followUpFilters.escalation !== 'All',
      followUpFilters.waitingOn !== 'All',
      followUpFilters.actionState !== 'All',
      followUpFilters.category !== 'All',
      followUpFilters.linkedTaskState !== 'all',
      followUpFilters.dueDateRange !== 'all',
      followUpFilters.nextTouchDateRange !== 'all',
      followUpFilters.promisedDateRange !== 'all',
      followUpFilters.cleanupOnly,
    ].filter(Boolean).length
  ), [followUpFilters]);

  const toggleColumn = (column: FollowUpColumnKey) => {
    if (followUpColumns.includes(column)) {
      setFollowUpColumns(followUpColumns.filter((entry) => entry !== column));
      return;
    }
    setFollowUpColumns([...followUpColumns, column]);
  };

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

  const togglePanel = (panel: Exclude<ControlPanel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
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

      <ExecutionLaneToolbar className="execution-toolbar-row followup-primary-toolbar">
        <label className="field-block followup-search-block">
          <span className="field-label">Search queue</span>
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, owner, project, contact" className="field-input search-field-input" />
            {search ? <button type="button" onClick={() => setSearch('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        <label className="field-block followup-status-block">
          <span className="field-label">Status</span>
          <select value={followUpFilters.status} onChange={(event) => setFollowUpFilters({ status: event.target.value as typeof followUpFilters.status })} className="field-input">
            <option value="All">All statuses</option>
            <option>Needs action</option>
            <option>Waiting on external</option>
            <option>Waiting internal</option>
            <option>In progress</option>
            <option>At risk</option>
            <option>Closed</option>
          </select>
        </label>

        <button onClick={() => togglePanel('filters')} className="action-btn">
          <SlidersHorizontal className="h-4 w-4" />
          More filters{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
          <ChevronDown className={`h-4 w-4 ${openPanel === 'filters' ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => togglePanel('display')} className="action-btn">
          Display
          <ChevronDown className={`h-4 w-4 ${openPanel === 'display' ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => togglePanel('savedViews')} className="action-btn">
          Saved views
          <ChevronDown className={`h-4 w-4 ${openPanel === 'savedViews' ? 'rotate-180' : ''}`} />
        </button>

        <button onClick={openCreateModal} className="primary-btn ml-auto">
          <Plus className="h-4 w-4" />
          Add follow-up
        </button>
      </ExecutionLaneToolbar>

      {openPanel === 'filters' ? (
        <div className="followup-filter-grid advanced-filter-surface">
          <select value={followUpFilters.project} onChange={(event) => setFollowUpFilters({ project: event.target.value })} className="field-input">
            {projects.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
          <select value={followUpFilters.owner} onChange={(event) => setFollowUpFilters({ owner: event.target.value })} className="field-input">
            {owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
          </select>
          <select value={followUpFilters.assignee} onChange={(event) => setFollowUpFilters({ assignee: event.target.value })} className="field-input">
            {assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}
          </select>
          <select value={followUpFilters.priority} onChange={(event) => setFollowUpFilters({ priority: event.target.value as typeof followUpFilters.priority })} className="field-input">
            <option value="All">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
          <select value={followUpFilters.escalation} onChange={(event) => setFollowUpFilters({ escalation: event.target.value as typeof followUpFilters.escalation })} className="field-input">
            <option value="All">All escalation</option><option>None</option><option>Watch</option><option>Escalate</option><option>Critical</option>
          </select>
          <select value={followUpFilters.linkedTaskState} onChange={(event) => setFollowUpFilters({ linkedTaskState: event.target.value as typeof followUpFilters.linkedTaskState })} className="field-input">
            <option value="all">All linked task states</option><option value="blocked_child">Blocked child</option><option value="overdue_child">Overdue child</option><option value="all_children_done">All children done</option><option value="has_open_children">Has open children</option><option value="none">No linked tasks</option>
          </select>
          <select value={followUpFilters.waitingOn} onChange={(event) => setFollowUpFilters({ waitingOn: event.target.value })} className="field-input">
            <option value="All">All waiting-on values</option>
            <option value="Unspecified">Unspecified</option>
            {Array.from(new Set(filteredRows.map((row) => row.waitingOn).filter(Boolean))).map((waitingOn) => (
              <option key={waitingOn} value={waitingOn}>{waitingOn}</option>
            ))}
          </select>
          <select value={followUpFilters.actionState} onChange={(event) => setFollowUpFilters({ actionState: event.target.value as typeof followUpFilters.actionState })} className="field-input">
            <option value="All">All action states</option>
            <option>Draft created</option>
            <option>Sent (confirmed)</option>
            <option>Complete</option>
          </select>
          <select value={followUpFilters.dueDateRange} onChange={(event) => setFollowUpFilters({ dueDateRange: event.target.value as typeof followUpFilters.dueDateRange })} className="field-input">
            <option value="all">All due dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="this_week">Due this week</option>
            <option value="next_7_days">Due in next 7 days</option>
          </select>
          <div className="followup-saved-views-row followup-secondary-utility">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={followUpFilters.cleanupOnly} onChange={(event) => setFollowUpFilters({ cleanupOnly: event.target.checked })} />
              Cleanup-only
            </label>
            <button className="action-btn" onClick={resetFollowUpFilters}>Clear advanced filters</button>
          </div>
        </div>
      ) : null}

      {openPanel === 'display' ? (
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

      {openPanel === 'savedViews' ? (
        <div className="advanced-filter-surface followup-saved-views-panel">
          <div className="followup-saved-views-row">
            <input value={customViewName} onChange={(event) => setCustomViewName(event.target.value)} className="field-input" placeholder="Saved view name" />
            <button
              className="action-btn"
              onClick={() => {
                if (!customViewName.trim()) return;
                saveFollowUpCustomView(customViewName.trim(), search);
                setCustomViewName('');
              }}
            >
              Save current view
            </button>
          </div>
          <div className="followup-saved-view-list">
            {savedFollowUpViews.length === 0 ? <span className="text-xs text-slate-500">No saved views yet.</span> : null}
            {savedFollowUpViews.map((view) => (
              <button key={view.id} className="action-btn" onClick={() => applySavedFollowUpCustomView(view.id)}>
                {view.name}
              </button>
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
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{filteredRows.length}</span> shown · {stats.waiting} waiting · {stats.overdue} overdue</div>
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
