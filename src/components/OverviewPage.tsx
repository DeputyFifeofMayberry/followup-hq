import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Clock3, ExternalLink, FilePlus2, Link2, PauseCircle, Send, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile } from './ui/AppPrimitives';
import type { SavedViewKey, UnifiedQueuePreset, UnifiedQueueSort } from '../types';
import { formatDate, priorityTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { applyBulkToFollowUp, previewBulkAction, type BulkActionSpec } from '../lib/bulkActions';
import type { FollowUpItem } from '../types';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'tasks' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  personalMode?: boolean;
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

export function OverviewPage({ onOpenWorkspace, onOpenTrackerView, personalMode = false }: OverviewPageProps) {
  const {
    getUnifiedQueue,
    setSelectedId,
    setSelectedTaskId,
    openCreateFromCapture,
    openTouchModal,
    openDraftModal,
    markNudged,
    snoozeItem,
    updateTask,
    updateItem,
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
  } = useAppStore(
    useShallow((s) => ({
      getUnifiedQueue: s.getUnifiedQueue,
      setSelectedId: s.setSelectedId,
      setSelectedTaskId: s.setSelectedTaskId,
      openCreateFromCapture: s.openCreateFromCapture,
      openTouchModal: s.openTouchModal,
      openDraftModal: s.openDraftModal,
      markNudged: s.markNudged,
      snoozeItem: s.snoozeItem,
      updateTask: s.updateTask,
      updateItem: s.updateItem,
      queuePreset: s.queuePreset,
      setQueuePreset: s.setQueuePreset,
      savedExecutionViews: s.savedExecutionViews,
      applyExecutionView: s.applyExecutionView,
      saveExecutionView: s.saveExecutionView,
      executionFilter: s.executionFilter,
      setExecutionFilter: s.setExecutionFilter,
      executionSort: s.executionSort,
      setExecutionSort: s.setExecutionSort,
      queueDensity: s.queueDensity,
      setQueueDensity: s.setQueueDensity,
    })),
  );

  const queue = getUnifiedQueue();
  const [selectedId, setSelectedIdLocal] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkPreview, setBulkPreview] = useState<{ spec: BulkActionSpec; summary: ReturnType<typeof previewBulkAction> } | null>(null);
  const [lastBulkUndo, setLastBulkUndo] = useState<Array<{ id: string; before: Partial<FollowUpItem> }>>([]);

  useEffect(() => {
    if (!queue.length) return setSelectedIdLocal(null);
    if (!selectedId || !queue.some((row) => row.id === selectedId)) setSelectedIdLocal(queue[0].id);
  }, [queue, selectedId]);

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
      const index = queue.findIndex((row) => row.id === selectedId);
      if (event.key === 'j') {
        event.preventDefault();
        setSelectedIdLocal(queue[Math.min(queue.length - 1, Math.max(0, index + 1))].id);
      }
      if (event.key === 'k') {
        event.preventDefault();
        setSelectedIdLocal(queue[Math.max(0, index - 1)].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, selectedId]);

  const selected = queue.find((row) => row.id === selectedId) || null;
  const pagedQueue = useMemo(() => queue.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [queue, page]);

  const stats = useMemo(() => ({
    due: queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
    blocked: queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
    cleanup: queue.filter((row) => row.queueFlags.cleanupRequired).length,
  }), [queue]);

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
      selectedTasks.forEach((row) => updateTask(row.id, { status: 'Done' }));
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
    if (selected.recordType === 'task') {
      setSelectedTaskId(selected.id);
      onOpenWorkspace('tasks');
      return;
    }
    setSelectedId(selected.id);
    onOpenTrackerView('All', selected.project);
  };

  return (
    <div className="space-y-5">
      <AppShellCard>
        <SectionHeader title="Unified execution queue" subtitle={personalMode ? 'Operate from one queue: scan, triage, and execute without tab hopping.' : 'Team execution queue with explicit pressure, blockers, and next action.'} />
        <div className="overview-stat-grid overview-stat-grid-compact">
          <StatTile label="Due now" value={stats.due} helper="Overdue + due + touch due" tone={stats.due ? 'warn' : 'default'} />
          <StatTile label="Blocked / at risk" value={stats.blocked} helper="Task and parent workflow pressure" tone={stats.blocked ? 'danger' : 'default'} />
          <StatTile label="Cleanup" value={stats.cleanup} helper="Low-trust items needing review" tone={stats.cleanup ? 'warn' : 'default'} />
        </div>
      </AppShellCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_340px]">
        <AppShellCard>
          <FilterBar>
            <SegmentedControl value={queuePreset} onChange={(value) => setQueuePreset(value as UnifiedQueuePreset)} options={presets.map((preset) => ({ value: preset, label: preset }))} />
          </FilterBar>

          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input value={executionFilter.search || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, search: event.target.value || undefined })} className="field-input" placeholder="Search title, project, owner, assignee, tags, next action, waiting on" />
            <select value={executionSort} onChange={(event) => setExecutionSort(event.target.value as UnifiedQueueSort)} className="field-input">{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={queueDensity} onChange={(event) => setQueueDensity(event.target.value as 'compact' | 'detailed')} className="field-input"><option value="compact">Compact rows</option><option value="detailed">Detailed rows</option></select>
            <button onClick={() => { setExecutionFilter({}); setPage(0); }} className="action-btn">Reset filters</button>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-6">
            <select value={executionFilter.types?.[0] || 'all'} onChange={(event) => setExecutionFilter({ ...executionFilter, types: event.target.value === 'all' ? undefined : [event.target.value as 'task' | 'followup'] })} className="field-input"><option value="all">All types</option><option value="task">Tasks</option><option value="followup">Follow-ups</option></select>
            <input value={executionFilter.project?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, project: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Project" />
            <input value={executionFilter.owner?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, owner: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Owner" />
            <input value={executionFilter.assignee?.[0] || ''} onChange={(event) => setExecutionFilter({ ...executionFilter, assignee: event.target.value ? [event.target.value] : undefined })} className="field-input" placeholder="Assignee" />
            <select value={executionFilter.waitingOn === undefined ? 'any' : executionFilter.waitingOn ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, waitingOn: event.target.value === 'any' ? undefined : event.target.value === 'yes' })} className="field-input"><option value="any">Any waiting state</option><option value="yes">Waiting on others</option><option value="no">Not waiting</option></select>
            <select value={executionFilter.linkedState || 'any'} onChange={(event) => setExecutionFilter({ ...executionFilter, linkedState: event.target.value === 'any' ? undefined : event.target.value as 'linked' | 'unlinked' })} className="field-input"><option value="any">Linked + unlinked</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-6">
            <select value={executionFilter.blockedOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, blockedOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Blocked any</option><option value="yes">Blocked only</option></select>
            <select value={executionFilter.deferredOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, deferredOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Deferred any</option><option value="yes">Deferred only</option></select>
            <select value={executionFilter.cleanupOnly ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, cleanupOnly: event.target.value === 'yes' ? true : undefined })} className="field-input"><option value="no">Cleanup any</option><option value="yes">Cleanup only</option></select>
            <input type="date" value={executionFilter.dueDateFrom ? executionFilter.dueDateFrom.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, dueDateFrom: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })} className="field-input" />
            <input type="date" value={executionFilter.dueDateTo ? executionFilter.dueDateTo.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, dueDateTo: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : undefined })} className="field-input" />
            <input type="date" value={executionFilter.nextTouchDateFrom ? executionFilter.nextTouchDateFrom.slice(0, 10) : ''} onChange={(event) => setExecutionFilter({ ...executionFilter, nextTouchDateFrom: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : undefined })} className="field-input" />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {savedExecutionViews.slice(0, 6).map((view) => <button key={view.id} onClick={() => applyExecutionView(view.id)} className="action-btn !px-2.5 !py-1 text-xs">{view.name}</button>)}
            <button onClick={() => saveExecutionView(`Saved ${new Date().toLocaleTimeString()}`)} className="action-btn !px-2.5 !py-1 text-xs">Save current view</button>
          </div>

          {selectedItems.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs">
              <span className="px-2 py-1 font-semibold text-slate-700">{selectedItems.length} selected</span>
              <button onClick={() => runBulk('close-followups')} className="action-btn !px-2.5 !py-1 text-xs">Close follow-ups</button>
              <button onClick={() => runBulk('done-tasks')} className="action-btn !px-2.5 !py-1 text-xs">Mark tasks done</button>
              <button onClick={() => runBulk('nudge')} className="action-btn !px-2.5 !py-1 text-xs">Mark nudged</button>
              <button onClick={() => runBulk('snooze')} className="action-btn !px-2.5 !py-1 text-xs">Snooze follow-ups</button>
              <button onClick={() => runBulk('escalate')} className="action-btn !px-2.5 !py-1 text-xs">Escalate</button>
              <button onClick={() => runBulk('de-escalate')} className="action-btn !px-2.5 !py-1 text-xs">De-escalate</button>
              <button onClick={() => setSelectedRows([])} className="action-btn !px-2.5 !py-1 text-xs">Clear</button>
              {lastBulkUndo.length ? <button onClick={() => {
                lastBulkUndo.forEach((entry) => {
                  updateItem(entry.id, entry.before);
                });
                setLastBulkUndo([]);
              }} className="action-btn !px-2.5 !py-1 text-xs">Undo last bulk</button> : null}
            </div>
          ) : null}
          {bulkPreview ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
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

          <div className="overview-priority-list">
            {!queue.length ? (
              <EmptyState title="No work in this queue" message="Switch presets or create a task/follow-up." />
            ) : (
              pagedQueue.map((row) => {
                const active = row.id === selectedId;
                const checked = selectedRows.includes(row.id);
                return (
                  <div key={`${row.recordType}-${row.id}`} className={active ? 'overview-priority-row overview-priority-row-active' : 'overview-priority-row'}>
                    <input type="checkbox" checked={checked} onChange={(event) => setSelectedRows((prev) => event.target.checked ? [...new Set([...prev, row.id])] : prev.filter((id) => id !== row.id))} />
                    <button onClick={() => setSelectedIdLocal(row.id)} className="overview-priority-main text-left">
                      <div className="overview-priority-title">[{row.recordType === 'task' ? 'Task' : 'Follow-up'}] {row.title}</div>
                      <div className="overview-priority-meta">{row.project} • {row.assignee} • Due {formatDate(row.dueDate || row.nextTouchDate)} • Next touch {formatDate(row.nextTouchDate)} • {row.linkedRecordStatus || 'No link'}</div>
                      {queueDensity === 'detailed' ? <div className="overview-priority-meta">Summary: {row.summary || '—'} • Waiting on: {row.waitingOn || '—'} • Notes: {row.notesPreview || '—'} • Recent: {row.recentActivity || '—'}</div> : null}
                      <div className="overview-priority-meta">Why urgent: {row.queueReasons.join(' • ') || row.whyInQueue}</div>
                    </button>
                    <div className="overview-priority-badges">
                      <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                      <Badge variant={row.queueFlags.overdue ? 'danger' : row.queueFlags.blocked ? 'warn' : 'neutral'}>{row.whyInQueue}</Badge>
                    </div>
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

        <AppShellCard>
          <SectionHeader title="Queue inspector" subtitle="Primary next action + one-click processing." compact />
          {selected ? (
            <div className="space-y-3">
              <div className="detail-card">
                <div className="text-sm font-semibold text-slate-950">{selected.title}</div>
                <div className="mt-1 text-xs text-slate-500">{selected.recordType} • {selected.project} • {selected.assignee}</div>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  <div>Status: <span className="font-medium text-slate-900">{selected.status}</span></div>
                  <div>Why urgent: <span className="font-medium text-slate-900">{selected.queueReasons.join(' • ') || selected.whyInQueue}</span></div>
                  <div>Primary next action: <span className="font-medium text-slate-900">{selected.primaryNextAction}</span></div>
                  <div>Linked status: <span className="font-medium text-slate-900">{selected.linkedRecordStatus || 'No link'}</span></div>
                  <div>Promised: <span className="font-medium text-slate-900">{formatDate(selected.promisedDate)}</span></div>
                  <div>Waiting on: <span className="font-medium text-slate-900">{selected.waitingOn || '—'}</span></div>
                  <div>Block reason: <span className="font-medium text-slate-900">{selected.blockReason || '—'}</span></div>
                  <div>Completion impact: <span className="font-medium text-slate-900">{selected.completionImpactSummary || selected.completionImpact || '—'}</span></div>
                </div>
              </div>

              <div className="overview-action-stack">
                <button onClick={() => {
                  if (selected.recordType === 'followup') {
                    const note = window.prompt('Optional completion note for follow-up:', '');
                    updateItem(selected.id, { status: 'Closed', actionState: 'Complete', completionNote: note || undefined });
                  } else {
                    const note = window.prompt('Optional completion note for task:', '');
                    updateTask(selected.id, { status: 'Done', completionNote: note || undefined, completedAt: new Date().toISOString() });
                  }
                }} className="action-btn justify-start"><CheckCircle2 className="h-4 w-4" />Complete / close</button>
                {selected.recordType === 'followup' ? <button onClick={() => snoozeItem(selected.id, 2)} className="action-btn justify-start"><PauseCircle className="h-4 w-4" />Snooze</button> : null}
                {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openTouchModal(); }} className="action-btn justify-start"><Clock3 className="h-4 w-4" />Log touch</button> : null}
                {selected.recordType === 'followup' ? <button onClick={() => markNudged(selected.id)} className="action-btn justify-start"><BellRing className="h-4 w-4" />Mark nudged</button> : null}
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
                {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openDraftModal(selected.id); }} className="action-btn justify-start"><Send className="h-4 w-4" />Open send flow</button> : null}
                {!personalMode && selected.recordType === 'followup' ? <button onClick={() => updateItem(selected.id, { assigneeDisplayName: 'Current user', assigneeUserId: 'user-current' })} className="action-btn justify-start"><UserRoundCog className="h-4 w-4" />Reassign</button> : null}
                <button onClick={openDetail} className="action-btn justify-start">Open detail <ExternalLink className="h-4 w-4" /></button>
              </div>

              <div className="overview-action-stack overview-action-stack-muted">
                <button onClick={() => onOpenWorkspace('tasks')} className="action-btn justify-start"><Link2 className="h-4 w-4" />Task workspace <ArrowRight className="h-4 w-4" /></button>
                {!personalMode ? <button onClick={() => onOpenWorkspace('projects')} className="action-btn justify-start"><AlertTriangle className="h-4 w-4" />Project risk view</button> : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Nothing selected" message="Select a row to process work inline." />
          )}
        </AppShellCard>
      </div>
    </div>
  );
}
