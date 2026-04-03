import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Clock3, ExternalLink, FilePlus2, Link2, PauseCircle, Send, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile } from './ui/AppPrimitives';
import type { SavedViewKey, UnifiedQueuePreset } from '../types';
import { formatDate, priorityTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'tasks' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  personalMode?: boolean;
}

const presets: UnifiedQueuePreset[] = ['Today', 'Due now', 'Waiting on others', 'Needs nudge', 'Blocked / at risk', 'Cleanup', 'Recently updated'];

export function OverviewPage({ onOpenWorkspace, onOpenTrackerView, personalMode = false }: OverviewPageProps) {
  const { getUnifiedQueue, setSelectedId, setSelectedTaskId, openCreateTaskModal, openTouchModal, openDraftModal, markNudged, snoozeItem, updateTask, updateItem, queuePreset, setQueuePreset, savedExecutionViews, applyExecutionView, saveExecutionView, executionFilter, setExecutionFilter } = useAppStore(
    useShallow((s) => ({
      getUnifiedQueue: s.getUnifiedQueue,
      setSelectedId: s.setSelectedId,
      setSelectedTaskId: s.setSelectedTaskId,
      openCreateTaskModal: s.openCreateTaskModal,
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
    })),
  );

  const queue = getUnifiedQueue();
  const [selectedId, setSelectedIdLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!queue.length) return setSelectedIdLocal(null);
    if (!selectedId || !queue.some((row) => row.id === selectedId)) setSelectedIdLocal(queue[0].id);
  }, [queue, selectedId]);

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

  const stats = useMemo(() => ({
    due: queue.filter((row) => row.whyInQueue === 'Overdue' || row.whyInQueue === 'Due today').length,
    blocked: queue.filter((row) => row.whyInQueue.includes('Blocked')).length,
    cleanup: queue.filter((row) => row.needsCleanup).length,
  }), [queue]);

  return (
    <div className="space-y-5">
      <AppShellCard>
        <SectionHeader title="Unified execution queue" subtitle={personalMode ? 'One queue for tasks and follow-ups, prioritized by urgency and risk.' : 'Team execution queue with explicit pressure, blockers, and next action.'} />
        <div className="overview-stat-grid overview-stat-grid-compact">
          <StatTile label="Due now" value={stats.due} helper="Overdue + due in 24h" tone={stats.due ? 'warn' : 'default'} />
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
            <select value={executionFilter.types?.[0] || 'all'} onChange={(event) => setExecutionFilter({ ...executionFilter, types: event.target.value === 'all' ? undefined : [event.target.value as 'task' | 'followup'] })} className="field-input"><option value="all">All types</option><option value="task">Tasks</option><option value="followup">Follow-ups</option></select>
            <select value={executionFilter.waitingOn === undefined ? 'any' : executionFilter.waitingOn ? 'yes' : 'no'} onChange={(event) => setExecutionFilter({ ...executionFilter, waitingOn: event.target.value === 'any' ? undefined : event.target.value === 'yes' })} className="field-input"><option value="any">Any waiting state</option><option value="yes">Waiting on others</option><option value="no">Not waiting</option></select>
            <select value={executionFilter.cleanupOnly ? 'cleanup' : 'all'} onChange={(event) => setExecutionFilter({ ...executionFilter, cleanupOnly: event.target.value === 'cleanup' ? true : undefined })} className="field-input"><option value="all">All cleanup states</option><option value="cleanup">Cleanup only</option></select>
            <button onClick={() => setExecutionFilter({})} className="action-btn">Reset filters</button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {savedExecutionViews.slice(0, 6).map((view) => <button key={view.id} onClick={() => applyExecutionView(view.id)} className="action-btn !px-2.5 !py-1 text-xs">{view.name}</button>)}
            <button onClick={() => saveExecutionView(`Saved ${new Date().toLocaleTimeString()}`)} className="action-btn !px-2.5 !py-1 text-xs">Save current view</button>
          </div>

          <div className="overview-priority-list">
            {!queue.length ? (
              <EmptyState title="No work in this queue" message="Switch presets or create a task/follow-up." />
            ) : (
              queue.slice(0, 24).map((row) => {
                const active = row.id === selectedId;
                return (
                  <button key={`${row.recordType}-${row.id}`} onClick={() => setSelectedIdLocal(row.id)} className={active ? 'overview-priority-row overview-priority-row-active' : 'overview-priority-row'}>
                    <div className="overview-priority-main">
                      <div className="overview-priority-title">[{row.recordType === 'task' ? 'Task' : 'Follow-up'}] {row.title}</div>
                      <div className="overview-priority-meta">{row.project} • {row.assignee} • Due {formatDate(row.dueDate || row.nextTouchDate)} • {row.linkedRecordStatus || 'No link'} • Next: {row.primaryNextAction}</div>
                    </div>
                    <div className="overview-priority-badges">
                      <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                      <Badge variant={row.whyInQueue.includes('Overdue') ? 'danger' : row.whyInQueue.includes('Blocked') ? 'warn' : 'neutral'}>{row.whyInQueue}</Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
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
                  <div>Why in queue: <span className="font-medium text-slate-900">{selected.whyInQueue}</span></div>
                  <div>Primary next action: <span className="font-medium text-slate-900">{selected.primaryNextAction}</span></div>
                  <div>Linked status: <span className="font-medium text-slate-900">{selected.linkedRecordStatus || 'No link'}</span></div>
                </div>
              </div>

              <div className="overview-action-stack">
                <button onClick={() => {
                  if (selected.recordType === 'followup') {
                    setSelectedId(selected.id);
                    updateItem(selected.id, { status: 'Closed', actionState: 'Complete' });
                  } else {
                    setSelectedTaskId(selected.id);
                    updateTask(selected.id, { status: 'Done' });
                  }
                }} className="action-btn justify-start"><CheckCircle2 className="h-4 w-4" />Complete / close</button>
                {selected.recordType === 'followup' ? <button onClick={() => snoozeItem(selected.id, 2)} className="action-btn justify-start"><PauseCircle className="h-4 w-4" />Snooze</button> : null}
                {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openTouchModal(); }} className="action-btn justify-start"><Clock3 className="h-4 w-4" />Log touch</button> : null}
                {selected.recordType === 'followup' ? <button onClick={() => markNudged(selected.id)} className="action-btn justify-start"><BellRing className="h-4 w-4" />Mark nudged</button> : null}
                <button onClick={() => { if (selected.recordType === 'followup') { setSelectedId(selected.id); openCreateTaskModal(); } }} className="action-btn justify-start"><FilePlus2 className="h-4 w-4" />Create linked task</button>
                {selected.recordType === 'followup' ? <button onClick={() => { setSelectedId(selected.id); openDraftModal(selected.id); }} className="action-btn justify-start"><Send className="h-4 w-4" />Open send flow</button> : null}
                {!personalMode ? <button onClick={() => selected.recordType === 'followup' && updateItem(selected.id, { assigneeDisplayName: 'Current user', assigneeUserId: 'user-current' })} className="action-btn justify-start"><UserRoundCog className="h-4 w-4" />Reassign</button> : null}
                <button onClick={() => onOpenTrackerView('All')} className="action-btn justify-start">Open detail <ExternalLink className="h-4 w-4" /></button>
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
