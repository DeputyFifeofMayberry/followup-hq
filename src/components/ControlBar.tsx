import { AlertTriangle, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FollowUpColumnKey, SavedViewKey } from '../types';
import { ExecutionLaneToolbarScaffold, FilterBar, SegmentedControl } from './ui/AppPrimitives';
import { BatchSummarySection, CompletionNoteSection, DateSection, StructuredActionFlow } from './actions/StructuredActionFlow';
import { useFollowUpsViewModel } from '../domains/followups';

const PRIMARY_VIEWS: SavedViewKey[] = ['All items', 'All', 'Needs nudge', 'At risk', 'Ready to close', 'Closed'];
const SECONDARY_VIEWS: SavedViewKey[] = ['Today', 'Waiting', 'Overdue', 'By project', 'Waiting on others', 'Promises due this week', 'Blocked by child tasks'];
const OPTIONAL_COLUMNS: FollowUpColumnKey[] = ['project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'actionState', 'nextAction'];

export function ControlBar({ onOpenDuplicateReview, duplicateCount = 0 }: { onOpenDuplicateReview?: () => void; duplicateCount?: number }) {
  const vm = useFollowUpsViewModel();
  const [showOptions, setShowOptions] = useState(false);
  const [batchFlow, setBatchFlow] = useState<'close' | 'nudge' | 'snooze' | null>(null);
  const [batchNote, setBatchNote] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [batchBlockers, setBatchBlockers] = useState<string[]>([]);
  const [batchAffected, setBatchAffected] = useState(0);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const [batchResult, setBatchResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);

  const projects = useMemo(() => ['All', ...new Set(vm.items.map((item) => item.project))], [vm.items]);
  const owners = useMemo(() => ['All', ...new Set(vm.items.map((item) => item.owner))], [vm.items]);
  const assignees = useMemo(() => ['All', ...new Set(vm.items.map((item) => item.assigneeDisplayName || item.owner))], [vm.items]);
  const selectedIdsInScope = vm.actionableSelectedFollowUpIds;

  const toggleColumn = (column: FollowUpColumnKey) => {
    if (vm.followUpColumns.includes(column)) {
      vm.setFollowUpColumns(vm.followUpColumns.filter((entry) => entry !== column));
      return;
    }
    vm.setFollowUpColumns([...vm.followUpColumns, column]);
  };

  const openBatchFlow = (kind: NonNullable<typeof batchFlow>) => {
    setBatchFlow(kind);
    setBatchWarnings([]);
    setBatchBlockers([]);
    setBatchResult(null);
    setBatchAffected(selectedIdsInScope.length);
    setBatchSkipped(vm.hiddenSelectionCount);
    if (kind === 'snooze') setBatchDate(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  };

  const applyBatchFlow = () => {
    if (!selectedIdsInScope.length) {
      setBatchBlockers(['No selected follow-ups are in the current view. Select visible rows or clear hidden selection.']);
      setBatchResult({ tone: 'danger', message: 'Batch action not applied.' });
      return;
    }

    if (batchFlow === 'close') {
      const result = vm.runValidatedBatchFollowUpTransition(selectedIdsInScope, 'Closed', { status: 'Closed', actionState: 'Complete', completionNote: batchNote.trim() || undefined });
      const hiddenMessage = vm.hiddenSelectionCount ? [`${vm.hiddenSelectionCount} hidden selection(s) were not changed.`] : [];
      setBatchWarnings([...result.warnings, ...hiddenMessage]);
      setBatchAffected(result.affected);
      setBatchSkipped(result.skipped + vm.hiddenSelectionCount);
      setBatchResult({ tone: result.skipped || result.warnings.length || vm.hiddenSelectionCount ? 'warn' : 'success', message: `Batch close affected ${result.affected} and skipped ${result.skipped + vm.hiddenSelectionCount}.` });
      return;
    }

    if (batchFlow === 'nudge') {
      vm.batchUpdateFollowUps(selectedIdsInScope, { lastNudgedAt: new Date().toISOString() }, 'Marked nudged (batch).');
      setBatchAffected(selectedIdsInScope.length);
      setBatchSkipped(vm.hiddenSelectionCount);
      setBatchWarnings(vm.hiddenSelectionCount ? [`${vm.hiddenSelectionCount} hidden selection(s) were not changed.`] : []);
      setBatchBlockers([]);
      setBatchResult({ tone: vm.hiddenSelectionCount ? 'warn' : 'success', message: `Marked ${selectedIdsInScope.length} follow-up(s) nudged.` });
      return;
    }

    if (!batchDate) {
      setBatchBlockers(['Snooze requires a target date.']);
      setBatchResult({ tone: 'danger', message: 'Batch snooze not applied.' });
      return;
    }

    const iso = new Date(`${batchDate}T00:00:00`).toISOString();
    vm.batchUpdateFollowUps(selectedIdsInScope, { nextTouchDate: iso, snoozedUntilDate: iso }, `Snoozed until ${batchDate} (batch).`);
    setBatchAffected(selectedIdsInScope.length);
    setBatchSkipped(vm.hiddenSelectionCount);
    setBatchWarnings(vm.hiddenSelectionCount ? [`${vm.hiddenSelectionCount} hidden selection(s) were not changed.`] : []);
    setBatchBlockers([]);
    setBatchResult({ tone: vm.hiddenSelectionCount ? 'warn' : 'success', message: `Snoozed ${selectedIdsInScope.length} follow-up(s).` });
  };

  return (
    <div className="workspace-control-stack followup-control-stack">
      <FilterBar>
        <div className="followup-view-strip">
          <SegmentedControl
            value={PRIMARY_VIEWS.includes(vm.activeView) ? vm.activeView : 'All'}
            onChange={vm.setActiveView}
            ariaLabel="Follow-up views"
            className="followup-view-segmented"
            options={PRIMARY_VIEWS.map((view) => ({
              value: view,
              label: (
                <span className="followup-view-option">
                  <span>{view === 'All' ? 'All open' : view}</span>
                  <strong>{view === 'All items' ? vm.viewCounts.allItems : view === 'All' ? vm.viewCounts.allOpen : view === 'Needs nudge' ? vm.viewCounts.needsNudge : view === 'At risk' ? vm.viewCounts.atRisk : view === 'Ready to close' ? vm.viewCounts.readyToClose : vm.viewCounts.closed}</strong>
                </span>
              ),
            }))}
          />
          <select value={SECONDARY_VIEWS.includes(vm.activeView) ? vm.activeView : ''} onChange={(event) => vm.setActiveView((event.target.value || 'All') as SavedViewKey)} className="field-input !w-auto">
            <option value="">More views</option>
            {SECONDARY_VIEWS.map((view) => <option key={view} value={view}>{view}</option>)}
          </select>
        </div>
      </FilterBar>

      <ExecutionLaneToolbarScaffold
        className="followup-primary-toolbar"
        left={(
          <label className="field-block followup-search-block">
            <div className="search-field-wrap">
              <Search className="search-field-icon h-4 w-4" />
              <input value={vm.search} onChange={(event) => vm.setSearch(event.target.value)} placeholder="Search follow-ups" className="field-input search-field-input" />
              {vm.search ? <button type="button" onClick={() => vm.setSearch('')} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
            </div>
          </label>
        )}
        right={(
          <>
            <button onClick={() => setShowOptions((value) => !value)} className="action-btn">
              <SlidersHorizontal className="h-4 w-4" />
              Options{vm.activeOptionCount > 0 ? ` (${vm.activeOptionCount})` : ''}
              <ChevronDown className={`h-4 w-4 ${showOptions ? 'rotate-180' : ''}`} />
            </button>
            {duplicateCount > 0 ? <button onClick={onOpenDuplicateReview} className="action-btn followup-duplicate-entry">Review duplicates</button> : null}
            <button onClick={vm.openCreateModal} className="primary-btn">Add follow-up</button>
          </>
        )}
      />

      {showOptions ? (
        <div className="followup-options-panel advanced-filter-surface">
          <section className="followup-options-section">
            <h4>Filters</h4>
            <div className="followup-options-grid">
              <select value={vm.followUpFilters.status} onChange={(event) => vm.setFollowUpFilters({ status: event.target.value as typeof vm.followUpFilters.status })} className="field-input">
                <option value="All">All statuses</option>
                <option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
              </select>
              <select value={vm.followUpFilters.project} onChange={(event) => vm.setFollowUpFilters({ project: event.target.value })} className="field-input">{projects.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select>
              <select value={vm.followUpFilters.owner} onChange={(event) => vm.setFollowUpFilters({ owner: event.target.value })} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select>
              <select value={vm.followUpFilters.assignee} onChange={(event) => vm.setFollowUpFilters({ assignee: event.target.value })} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select>
              <select value={vm.followUpFilters.priority} onChange={(event) => vm.setFollowUpFilters({ priority: event.target.value as typeof vm.followUpFilters.priority })} className="field-input">
                <option value="All">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={vm.followUpFilters.cleanupOnly} onChange={(event) => vm.setFollowUpFilters({ cleanupOnly: event.target.checked })} />Cleanup only</label>
            </div>
          </section>

          <section className="followup-options-section">
            <h4>Dates</h4>
            <div className="followup-options-grid">
              <select value={vm.followUpFilters.dueDateRange} onChange={(event) => vm.setFollowUpFilters({ dueDateRange: event.target.value as typeof vm.followUpFilters.dueDateRange })} className="field-input">
                <option value="all">All due dates</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="this_week">Due this week</option><option value="next_7_days">Due in next 7 days</option>
              </select>
              <select value={vm.followUpFilters.nextTouchDateRange} onChange={(event) => vm.setFollowUpFilters({ nextTouchDateRange: event.target.value as typeof vm.followUpFilters.nextTouchDateRange })} className="field-input">
                <option value="all">All next touch dates</option><option value="overdue">Touch overdue</option><option value="today">Touch today</option><option value="this_week">Touch this week</option><option value="next_7_days">Touch in next 7 days</option>
              </select>
            </div>
          </section>

          <section className="followup-options-section">
            <h4>Layout</h4>
            <div className="followup-options-grid">
              <label className="field-block"><span className="field-label">Density</span>
                <select value={vm.followUpTableDensity} onChange={(event) => vm.setFollowUpTableDensity(event.target.value as typeof vm.followUpTableDensity)} className="field-input"><option value="compact">Compact</option><option value="comfortable">Expanded</option></select>
              </label>
              <div className="followup-columns-list">
                {OPTIONAL_COLUMNS.map((column) => (
                  <label key={column} className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={vm.followUpColumns.includes(column)} onChange={() => toggleColumn(column)} />{column}
                  </label>
                ))}
              </div>
            </div>
          </section>
          <div className="followup-options-footer"><button className="action-btn" onClick={vm.resetFollowUpFilters}>Reset options</button></div>
        </div>
      ) : null}

      {vm.hiddenSelectionCount > 0 ? (
        <div className="execution-batch-strip followup-selection-warning" role="status" aria-live="polite">
          <div className="text-sm text-amber-800 inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{vm.hiddenSelectionCount} selected outside this view and will be skipped.</div>
          <div className="followup-action-row">
            <button onClick={() => vm.selectAllVisibleFollowUps(selectedIdsInScope)} className="action-btn">Keep shown only</button>
            <button onClick={vm.clearFollowUpSelection} className="action-btn">Clear all selection</button>
          </div>
        </div>
      ) : null}

      {vm.followUpStats.selectedCount > 0 ? (
        <div className="followup-toolbar-foot bulk-action-strip execution-batch-strip">
          <div className="text-sm text-slate-500"><span className="font-medium text-slate-900">{selectedIdsInScope.length}</span> in view selected{vm.hiddenSelectionCount > 0 ? ` (${vm.followUpStats.selectedCount} total)` : ''}</div>
          <div className="followup-action-row">
            <button onClick={() => openBatchFlow('nudge')} className="action-btn">Mark nudged</button>
            <button onClick={() => openBatchFlow('snooze')} className="action-btn">Snooze selected</button>
            <button onClick={() => openBatchFlow('close')} className="action-btn">Close selected</button>
            <button onClick={vm.clearFollowUpSelection} className="action-btn">Clear</button>
          </div>
        </div>
      ) : null}

      <StructuredActionFlow
        open={!!batchFlow}
        title={batchFlow === 'nudge' ? 'Bulk mark nudged' : batchFlow === 'snooze' ? 'Bulk snooze follow-ups' : 'Bulk close follow-ups'}
        subtitle="Apply one action to selected follow-ups in the current view."
        onCancel={() => setBatchFlow(null)}
        onConfirm={applyBatchFlow}
        confirmLabel={batchFlow === 'nudge' ? 'Apply nudge' : batchFlow === 'snooze' ? 'Apply snooze' : 'Apply batch close'}
        warnings={batchWarnings}
        blockers={batchBlockers}
        result={batchResult}
      >
        <BatchSummarySection selected={selectedIdsInScope.length} affected={batchAffected} skipped={batchSkipped} />
        {batchFlow === 'close' ? <CompletionNoteSection value={batchNote} onChange={setBatchNote} label="Batch completion note" /> : null}
        {batchFlow === 'snooze' ? <DateSection label="Snooze until" value={batchDate} onChange={setBatchDate} /> : null}
      </StructuredActionFlow>
    </div>
  );
}
