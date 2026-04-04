import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, ChevronDown, Clock3, ExternalLink, FilePlus2, Link2, PauseCircle, Send, SlidersHorizontal, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile, WorkspaceInspectorSection, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceToolbarRow, WorkspaceTopStack } from './ui/AppPrimitives';
import type { AppMode, UnifiedQueueDensity, UnifiedQueuePreset, UnifiedQueueSort } from '../types';
import { formatDate, priorityTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useExecutionQueueViewModel } from '../domains/shared';
import { applyBulkToFollowUp, previewBulkAction, type BulkActionSpec } from '../lib/bulkActions';
import type { FollowUpItem, UnifiedQueueItem } from '../types';
import { getModeConfig } from '../lib/appModeConfig';
import { ExecutionQueueList, ExecutionSection } from './execution/ExecutionSection';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'followups' | 'tasks' | 'outlook' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  personalMode?: boolean;
  appMode?: AppMode;
}

const presets: UnifiedQueuePreset[] = ['Today', 'Due now', 'This week', 'Waiting on others', 'Needs nudge', 'Blocked / at risk', 'Cleanup', 'Recently updated'];
const sortOptions: Array<{ value: UnifiedQueueSort; label: string }> = [
  { value: 'queue_score', label: 'Queue score' },
  { value: 'due_date', label: 'Due date' },
  { value: 'next_touch_date', label: 'Next touch' },
  { value: 'updated_date', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
];

const PAGE_SIZE = 50;
const DEFAULT_VISIBLE_ROW_CHIPS = 2;

function getQueueReason(row: UnifiedQueueItem) {
  return row.queueReasons[0] || row.whyInQueue;
}

export function OverviewPage({ onOpenWorkspace, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: OverviewPageProps) {
  const {
    queue,
    stats,
    setSelectedId,
    openCreateFromCapture,
    openTouchModal,
    openDraftModal,
    markNudged,
    snoozeItem,
    updateItem,
    attemptFollowUpTransition,
    attemptTaskTransition,
    queuePreset,
    setQueuePreset,
    savedExecutionViews,
    applyExecutionView,
    saveExecutionView,
    executionFilter,
    setExecutionFilter,
    executionSort,
    setExecutionSort,
    queueDensity,
    setQueueDensity,
    runValidatedBatchFollowUpTransition,
    executionSelectedId,
    setExecutionSelectedId,
    dailySections,
    openExecutionLane,
  } = useExecutionQueueViewModel();

  const modeConfig = getModeConfig(appMode);
  const selectedId = executionSelectedId;
  const [page, setPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<{ spec: BulkActionSpec; summary: ReturnType<typeof previewBulkAction> } | null>(null);
  const [lastBulkUndo, setLastBulkUndo] = useState<Array<{ id: string; before: Partial<FollowUpItem> }>>([]);

  useEffect(() => {
    if (!queue.length) return setExecutionSelectedId(null);
    if (!selectedId || !queue.some((row) => row.id === selectedId)) setExecutionSelectedId(queue[0].id);
  }, [queue, selectedId, setExecutionSelectedId]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(queue.length / PAGE_SIZE) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [queue.length, page]);

  useEffect(() => {
    setSelectedRows((prev) => prev.filter((id) => queue.some((row) => row.id === id)));
  }, [queue]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!queue.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], button')) return;
      const index = queue.findIndex((row) => row.id === selectedId);
      if (event.key === 'j') {
        event.preventDefault();
        setExecutionSelectedId(queue[Math.min(queue.length - 1, Math.max(0, index + 1))].id);
      }
      if (event.key === 'k') {
        event.preventDefault();
        setExecutionSelectedId(queue[Math.max(0, index - 1)].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, selectedId, setExecutionSelectedId]);

  const selected = queue.find((row) => row.id === selectedId) || null;
  const pagedQueue = useMemo(() => queue.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [queue, page]);


  const selectedItems = queue.filter((row) => selectedRows.includes(row.id));
  const selectedFollowUps = selectedItems.filter((row) => row.recordType === 'followup');
  const selectedTasks = selectedItems.filter((row) => row.recordType === 'task');

  const runBulk = (action: string) => {
    if (!selectedItems.length) return;
    const spec: BulkActionSpec =
      action === 'close-followups' ? { type: 'close', ids: selectedFollowUps.map((entry) => entry.id) } :
      action === 'nudge' ? { type: 'nudge', ids: selectedFollowUps.map((entry) => entry.id) } :
      action === 'snooze' ? { type: 'snooze', ids: selectedFollowUps.map((entry) => entry.id), days: 2 } :
      action === 'escalate' ? { type: 'escalate', ids: selectedFollowUps.map((entry) => entry.id) } :
      action === 'de-escalate' ? { type: 'assign', ids: selectedFollowUps.map((entry) => entry.id), value: 'Watch' } :
      { type: 'close', ids: [] };
    setBulkPreview({ spec, summary: previewBulkAction(spec, useAppStore.getState().items, useAppStore.getState().tasks) });
    if (action === 'done-tasks') {
      selectedTasks.forEach((row) => {
        const note = window.prompt(`Completion note for task ${row.title}:`, '');
        const result = attemptTaskTransition(row.id, 'Done', { completionNote: note || undefined, completedAt: new Date().toISOString() });
        if (!result.applied) window.alert(result.validation.blockers.join(' '));
      });
    }
  };

  const applyBulkPreview = () => {
    if (!bulkPreview) return;
    const undo: Array<{ id: string; before: Partial<FollowUpItem> }> = [];
    if (bulkPreview.spec.type === 'assign' && bulkPreview.spec.value === 'Watch') {
      selectedFollowUps.forEach((row) => {
        const current = useAppStore.getState().items.find((entry) => entry.id === row.id);
        if (!current) return;
        undo.push({ id: row.id, before: { escalationLevel: current.escalationLevel } });
        updateItem(row.id, { escalationLevel: 'Watch' });
      });
    } else if (bulkPreview.spec.type === 'close') {
      const note = window.prompt('Batch close note for follow-ups:', '');
      const result = runValidatedBatchFollowUpTransition(selectedFollowUps.map((entry) => entry.id), 'Closed', { status: 'Closed', actionState: 'Complete', completionNote: note || undefined });
      if (result.warnings.length || result.skipped) {
        window.alert(`Bulk close: ${result.affected} affected, ${result.skipped} skipped.\n${result.warnings.slice(0, 5).join('\n')}`);
      }
    } else {
      selectedFollowUps.forEach((row) => {
        const current = useAppStore.getState().items.find((entry) => entry.id === row.id);
        if (!current) return;
        undo.push({ id: row.id, before: current });
        const patched = applyBulkToFollowUp(current, bulkPreview.spec);
        updateItem(row.id, patched);
      });
    }
    setLastBulkUndo(undo);
    setBulkPreview(null);
    setSelectedRows([]);
  };

  const openDetail = () => {
    if (!selected) return;
    openExecutionLane(selected.recordType === 'task' ? 'tasks' : 'followups', {
      recordId: selected.id,
      recordType: selected.recordType,
      project: selected.project,
    });
    onOpenWorkspace(selected.recordType === 'task' ? 'tasks' : 'followups');
  };

  const resetFilters = () => {
    setExecutionFilter({});
    setPage(0);
  };

  const viewOptionCount = (executionFilter.types?.length || 0)
    + (executionFilter.project?.length || 0)
    + (executionFilter.owner?.length || 0)
    + (executionFilter.assignee?.length || 0)
    + (executionFilter.waitingOn === undefined ? 0 : 1)
    + (executionFilter.linkedState ? 1 : 0)
    + (executionFilter.blockedOnly ? 1 : 0)
    + (executionFilter.deferredOnly ? 1 : 0)
    + (executionFilter.cleanupOnly ? 1 : 0)
    + (executionFilter.dueDateFrom ? 1 : 0)
    + (executionFilter.dueDateTo ? 1 : 0)
    + (executionFilter.nextTouchDateFrom ? 1 : 0);

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <WorkspaceSummaryStrip className="overview-hero-card">
          <SectionHeader title="Daily focus" subtitle="Triage what needs attention now, then route deeper work to the right workspace." compact />
          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Due now" value={stats.due} tone={stats.due ? 'warn' : 'default'} />
            <StatTile label="Blocked / at risk" value={stats.blocked} tone={stats.blocked ? 'danger' : 'default'} />
            <StatTile label="Cleanup / review" value={stats.cleanup} tone={stats.cleanup ? 'warn' : 'default'} />
            <StatTile label="Ready to close" value={stats.closeable} tone={stats.closeable ? 'info' : 'default'} />
          </div>
          <WorkspaceToolbarRow className="overview-triage-actions">
            <span className="overview-triage-label">Start here:</span>
            <button onClick={() => onOpenWorkspace('outlook')} className="action-btn !px-2.5 !py-1 text-xs">Open Intake</button>
            <button onClick={() => { openExecutionLane('followups', { section: 'triage' }); onOpenWorkspace('followups'); }} className="action-btn !px-2.5 !py-1 text-xs">Route follow-ups</button>
            <button onClick={() => { openExecutionLane('tasks', { section: 'now' }); onOpenWorkspace('tasks'); }} className="action-btn !px-2.5 !py-1 text-xs">Route tasks</button>
            <button onClick={() => openCreateFromCapture({
              kind: 'followup',
              rawText: '',
              title: '',
              priority: 'Medium',
              confidence: 1,
              cleanupReasons: [],
            })} className="action-btn !px-2.5 !py-1 text-xs">Quick Add</button>
          </WorkspaceToolbarRow>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>

      <WorkspacePrimaryLayout inspectorWidth="350px">
        <AppShellCard className="overview-main-panel" surface="data">
          <SectionHeader title="Primary queue" subtitle="Pick the next item, act quickly, and keep moving." compact />

          <div className="overview-control-stack overview-control-stack-calm">
            <FilterBar>
              <SegmentedControl value={queuePreset} onChange={(value) => setQueuePreset(value as UnifiedQueuePreset)} options={presets.map((preset) => ({ value: preset, label: preset }))} />
            </FilterBar>

            <WorkspaceToolbarRow className="overview-toolbar-row overview-toolbar-row-calm">
              <input value={executionFilter.search || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, search: event.target.value || undefined })} className="field-input workspace-search-input" placeholder="Search title, project, owner, assignee, tags, next action" />
              <select value={executionSort} onChange={(event) => setExecutionSort(event.target.value as UnifiedQueueSort)} className="field-input">{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <button onClick={() => setViewOptionsOpen((prev) => !prev)} className="action-btn">
                <SlidersHorizontal className="h-4 w-4" />View options{viewOptionCount ? ` (${viewOptionCount})` : ''}
                <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
              </button>
            </WorkspaceToolbarRow>

            {viewOptionsOpen ? (
              <div className="overview-advanced-filters advanced-filter-surface">
                <div className="overview-view-options-head">
                  <div className="overview-view-options-title">View options</div>
                  <button onClick={resetFilters} className="action-btn !px-2.5 !py-1 text-xs">Reset</button>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <select value={queueDensity} onChange={(event) => setQueueDensity(event.target.value as UnifiedQueueDensity)} className="field-input"><option value="compact">Compact rows</option><option value="detailed">Detailed rows</option></select>
                  <select value={executionFilter.types?.[0] || 'all'} onChange={(event) => setExecutionFilter({ ...executionFilter, types: event.target.value === 'all' ? undefined : [event.target.value as 'task' | 'followup'] })} className="field-input"><option value="all">All types</option><option value="task">Tasks</option><option value="followup">Follow-ups</option></select>
                  <input value={executionFilter.project?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, project: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Project" />
                  {!personalMode ? <input value={executionFilter.owner?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, owner: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Owner" /> : null}
                  <input value={executionFilter.assignee?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, assignee: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Assignee" />
                  <select value={executionFilter.waitingOn === undefined ? 'any' : executionFilter.waitingOn ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, waitingOn: event.target.value === 'any' ? undefined : event.target.value === 'yes' })} className="field-input"><option value="any">Any waiting state</option><option value="yes">Waiting on others</option><option value="no">Not waiting</option></select>
                  <select value={executionFilter.linkedState || 'any'} onChange={(event) => setExecutionFilter({ ...executionFilter, linkedState: event.target.value === 'any' ? undefined : event.target.value as 'linked' | 'unlinked' })} className="field-input"><option value="any">Linked + unlinked</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select>
                  <select value={executionFilter.blockedOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, blockedOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Blocked any</option><option value="yes">Blocked only</option></select>
                  <select value={executionFilter.cleanupOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, cleanupOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Cleanup any</option><option value="yes">Cleanup only</option></select>
                  <select value={executionFilter.deferredOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, deferredOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Deferred any</option><option value="yes">Deferred only</option></select>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <input type="date" value={executionFilter.dueDateFrom ? executionFilter.dueDateFrom.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, dueDateFrom: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })} className="field-input" />
                  <input type="date" value={executionFilter.dueDateTo ? executionFilter.dueDateTo.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, dueDateTo: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : undefined })} className="field-input" />
                  <input type="date" value={executionFilter.nextTouchDateFrom ? executionFilter.nextTouchDateFrom.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, nextTouchDateFrom: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })} className="field-input" />
                </div>
                <div className="overview-saved-views-row">
                  <span className="overview-secondary-label">Saved views</span>
                  {savedExecutionViews.slice(0, 5).map((view) => <button key={view.id} onClick={() => applyExecutionView(view.id)} className="action-btn !px-2.5 !py-1 text-xs">{view.name}</button>)}
                  <button onClick={() => saveExecutionView(`Saved ${new Date().toLocaleTimeString()}`)} className="action-btn !px-2.5 !py-1 text-xs">Save current view</button>
                </div>
              </div>
            ) : null}

            {selectedItems.length > 0 ? (
              <div className="overview-bulk-strip bulk-action-strip">
                <span className="overview-bulk-count">{selectedItems.length} selected</span>
                {selectedFollowUps.length ? <button onClick={() => runBulk('close-followups')} className="action-btn !px-2.5 !py-1 text-xs">Close follow-ups</button> : null}
                {selectedTasks.length ? <button onClick={() => runBulk('done-tasks')} className="action-btn !px-2.5 !py-1 text-xs">Mark tasks done</button> : null}
                {selectedFollowUps.length ? <button onClick={() => runBulk('nudge')} className="action-btn !px-2.5 !py-1 text-xs">Mark nudged</button> : null}
                {selectedFollowUps.length ? <button onClick={() => runBulk('snooze')} className="action-btn !px-2.5 !py-1 text-xs">Snooze</button> : null}
                {selectedFollowUps.length ? <button onClick={() => runBulk('escalate')} className="action-btn !px-2.5 !py-1 text-xs">Escalate</button> : null}
                {selectedFollowUps.length ? <button onClick={() => runBulk('de-escalate')} className="action-btn !px-2.5 !py-1 text-xs">Watch</button> : null}
                <button onClick={() => setSelectedRows([])} className="action-btn !px-2.5 !py-1 text-xs">Clear</button>
                {lastBulkUndo.length ? <button onClick={() => {
                  lastBulkUndo.forEach((entry) => updateItem(entry.id, entry.before));
                  setLastBulkUndo([]);
                }} className="action-btn !px-2.5 !py-1 text-xs">Undo</button> : null}
              </div>
            ) : null}
          </div>

          {bulkPreview ? (
            <div className="overview-bulk-preview">
              <div className="font-semibold">Bulk preview</div>
              <div>Affected: {bulkPreview.summary.affected} • Skipped: {bulkPreview.summary.skipped}</div>
              <div>Changes: {bulkPreview.summary.changes.join(' • ') || '—'}</div>
              {bulkPreview.summary.warnings.length ? <div>Warnings: {bulkPreview.summary.warnings.join(' • ')}</div> : null}
              <div className="mt-2 flex gap-2">
                <button onClick={applyBulkPreview} className="action-btn !px-2.5 !py-1 text-xs">Apply bulk</button>
                <button onClick={() => setBulkPreview(null)} className="action-btn !px-2.5 !py-1 text-xs">Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 mb-4">
            {dailySections.map((section) => (
              <ExecutionSection
                key={section.key}
                title={section.title}
                subtitle={section.subtitle}
                count={section.rows.length}
                actions={<button onClick={() => {
                  openExecutionLane(section.key === 'ready_to_close' ? 'followups' : 'tasks', { section: section.key });
                  onOpenWorkspace(section.key === 'ready_to_close' ? 'followups' : 'tasks');
                }} className="action-btn !px-2.5 !py-1 text-xs">Open lane</button>}
              >
                <ExecutionQueueList
                  rows={section.rows.slice(0, 6)}
                  selectedId={selectedId}
                  selectedRows={selectedRows}
                  onSelect={setExecutionSelectedId}
                  onToggleRow={(id, checked) => setSelectedRows((prev) => checked ? [...new Set([...prev, id])] : prev.filter((entry) => entry !== id))}
                />
              </ExecutionSection>
            ))}
          </div>

          <div className="overview-priority-list overview-priority-list-premium">
            {!queue.length ? <EmptyState title="No work in this queue" message="Switch presets or use Quick Add / Capture to create new work." /> : (
              pagedQueue.map((row) => {
                const active = row.id === selectedId;
                const checked = selectedRows.includes(row.id);
                const urgencyLabel = row.queueFlags.overdue ? 'Overdue' : row.queueFlags.blocked ? 'Blocked' : 'Needs attention';
                const rowChips = [
                  <Badge key="type" variant="neutral">{row.recordType === 'task' ? 'Task' : 'Follow-up'}</Badge>,
                  <Badge key="urgency" variant={row.queueFlags.overdue ? 'danger' : row.queueFlags.blocked ? 'warn' : 'neutral'}>{urgencyLabel}</Badge>,
                  <Badge key="priority" variant={priorityTone(row.priority)}>{row.priority}</Badge>,
                ];

                return (
                  <div key={`${row.recordType}-${row.id}`} className={active ? 'overview-priority-row overview-priority-row-active list-row-family list-row-family-active' : 'overview-priority-row list-row-family'}>
                    <input aria-label={`Select ${row.title}`} type="checkbox" checked={checked} onChange={(event) => setSelectedRows((prev) => event.target.checked ? [...new Set([...prev, row.id])] : prev.filter((id) => id !== row.id))} />
                    <button type="button" onClick={() => setExecutionSelectedId(row.id)} className="overview-priority-main text-left" aria-current={active ? 'true' : undefined}>
                      <div className="scan-row-layout scan-row-layout-quiet">
                        <div className="scan-row-content">
                          <div className="scan-row-primary">{row.title}</div>
                          <div className="scan-row-secondary">{row.project} • {row.dueDate || row.nextTouchDate ? `Due ${formatDate(row.dueDate || row.nextTouchDate)}` : 'No date'} • {personalMode ? row.primaryNextAction : (row.assignee || row.owner || row.primaryNextAction)}</div>
                          {queueDensity === 'detailed' || row.queueFlags.overdue || row.queueFlags.blocked || row.queueFlags.cleanupRequired ? <div className="scan-row-meta">{getQueueReason(row)}</div> : null}
                          {queueDensity === 'detailed' ? <div className="scan-row-meta">Waiting on: {row.waitingOn || '—'} • Next touch {formatDate(row.nextTouchDate)} • Linked: {row.linkedRecordStatus || 'No link'}</div> : null}
                        </div>
                        <div className="scan-row-sidecar scan-row-sidecar-quiet">
                          <div className="scan-row-badge-cluster">
                            {rowChips.slice(0, queueDensity === 'detailed' ? rowChips.length : DEFAULT_VISIBLE_ROW_CHIPS)}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {queue.length > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <div>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, queue.length)} of {queue.length}</div>
              <div className="flex gap-2">
                <button className="action-btn !px-2 !py-1" onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
                <button className="action-btn !px-2 !py-1" onClick={() => setPage((p) => Math.min(Math.ceil(queue.length / PAGE_SIZE) - 1, p + 1))}>Next</button>
              </div>
            </div>
          ) : null}
        </AppShellCard>

        <AppShellCard className="overview-inspector-shell" surface="inspector">
          <SectionHeader title="Focused inspector" subtitle="Decide the next move, act, then return to queue." compact />
          {selected ? (
            <div className="space-y-3">
              <WorkspaceInspectorSection title="Selected snapshot" subtitle={`${selected.recordType} · ${selected.project}`}>
                <div className="text-sm font-semibold text-slate-950">{selected.title}</div>
                <div className="overview-inspector-kpis overview-inspector-kpis-tight">
                  <div><span>Status</span><strong>{selected.status}</strong></div>
                  <div><span>Why here</span><strong>{getQueueReason(selected)}</strong></div>
                  <div><span>Next action</span><strong>{selected.primaryNextAction}</strong></div>
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Key context">
                <div className="overview-inspector-notes">Waiting on: {selected.waitingOn || '—'}</div>
                <div className="overview-inspector-notes">Promised date: {formatDate(selected.promisedDate)}</div>
                <div className="overview-inspector-notes">Block reason: {selected.blockReason || '—'}</div>
                <div className="overview-inspector-notes">Linked status: {selected.linkedRecordStatus || 'No link'}</div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Primary actions">
                <div className="overview-action-stack">
                  <button onClick={() => {
                    if (selected.recordType === 'followup') {
                      const note = window.prompt('Completion note for closeout (leave blank only if overriding):', '');
                      const result = attemptFollowUpTransition(selected.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined });
                      if (!result.applied && result.validation.overrideAllowed) {
                        const proceed = window.confirm(`${result.validation.blockers.join(' ')}\nClose anyway with acknowledgement?`);
                        if (!proceed) return;
                        const overrideResult = attemptFollowUpTransition(selected.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined }, { override: true });
                        if (overrideResult.validation.warnings.length) window.alert(overrideResult.validation.warnings.join('\n'));
                        return;
                      }
                      if (!result.applied) {
                        window.alert(result.validation.blockers.join(' '));
                        return;
                      }
                      if (result.validation.warnings.length) window.alert(result.validation.warnings.join('\n'));
                    } else {
                      const note = window.prompt('Completion note for task done:', '');
                      const result = attemptTaskTransition(selected.id, 'Done', { completionNote: note || undefined, completedAt: new Date().toISOString() });
                      if (!result.applied) window.alert(result.validation.blockers.join(' '));
                    }
                  }} className="primary-btn justify-start"><CheckCircle2 className="h-4 w-4" />Complete / close</button>
                  {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openTouchModal(); }} className="action-btn justify-start"><Clock3 className="h-4 w-4" />Log touch</button> : null}
                  {selected.recordType === 'followup' ? <button onClick={() => markNudged(selected.id)} className="action-btn justify-start"><BellRing className="h-4 w-4" />Mark nudged</button> : null}
                  {selected.recordType === 'followup' ? <button onClick={() => { const days = Number(window.prompt('Snooze how many days?','2') || '0'); if (!days || days < 1) { window.alert('Deferring requires a next review date.'); return; } snoozeItem(selected.id, days); }} className="action-btn justify-start"><PauseCircle className="h-4 w-4" />Snooze</button> : null}
                  {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openDraftModal(selected.id); }} className="action-btn justify-start"><Send className="h-4 w-4" />Open send flow</button> : null}
                  {selected.recordType === 'followup' ? <button onClick={() => {
                    openCreateFromCapture({
                      kind: 'task',
                      rawText: selected.summary || selected.title,
                      title: `Task: ${selected.primaryNextAction}`,
                      project: selected.project,
                      owner: selected.owner,
                      assigneeDisplayName: selected.assignee,
                      dueDate: selected.dueDate,
                      priority: selected.priority,
                      nextStep: selected.primaryNextAction,
                      linkedFollowUpId: selected.id,
                      contextNote: `${selected.title} | ${selected.summary || ''}`,
                      companyId: selected.companyId,
                      contactId: selected.contactId,
                      confidence: 1,
                      cleanupReasons: [],
                    });
                  }} className="action-btn justify-start"><FilePlus2 className="h-4 w-4" />Create linked task</button> : null}
                  {!personalMode && selected.recordType === 'followup' ? <button onClick={() => updateItem(selected.id, { assigneeDisplayName: 'Current user', assigneeUserId: 'user-current' })} className={modeConfig.emphasizeCoordinationActions ? 'primary-btn justify-start' : 'action-btn justify-start'}><UserRoundCog className="h-4 w-4" />Reassign</button> : null}
                </div>
              </WorkspaceInspectorSection>

              <WorkspaceInspectorSection title="Open in workspace">
                <div className="overview-action-stack overview-action-stack-muted">
                  <button onClick={openDetail} className="action-btn justify-start">Open full detail <ExternalLink className="h-4 w-4" /></button>
                  <button onClick={() => onOpenWorkspace('tasks')} className="action-btn justify-start"><Link2 className="h-4 w-4" />Task workspace <ArrowRight className="h-4 w-4" /></button>
                  {!personalMode ? <button onClick={() => onOpenWorkspace('projects')} className="action-btn justify-start"><AlertTriangle className="h-4 w-4" />Project risk view</button> : null}
                </div>
              </WorkspaceInspectorSection>
            </div>
          ) : <EmptyState title="Nothing selected" message="Select a row to process work inline." />}
        </AppShellCard>
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
