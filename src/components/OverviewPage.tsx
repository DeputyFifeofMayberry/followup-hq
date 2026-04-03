import { AlertTriangle, ArrowRight, BellRing, ExternalLink, FilePlus2, PenSquare, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { AppShellCard, EmptyState, FilterBar, SectionHeader, SegmentedControl, StatTile } from './ui/AppPrimitives';
import type { SavedViewKey } from '../types';
import { formatDate, isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'tasks' | 'projects' | 'relationships';
type WorklistPreset = 'Due now' | 'Needs nudge' | 'Waiting too long' | 'Blocked' | 'Cleanup';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  personalMode?: boolean;
}

export function OverviewPage({ onOpenWorkspace, onOpenTrackerView, personalMode = false }: OverviewPageProps) {
  const { items, tasks, hydrated, setSelectedId, openCreateModal, openCreateTaskModal, openTouchModal, openDraftModal } = useAppStore(
    useShallow((s) => ({
      items: s.items,
      tasks: s.tasks,
      hydrated: s.hydrated,
      setSelectedId: s.setSelectedId,
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
      openTouchModal: s.openTouchModal,
      openDraftModal: s.openDraftModal,
    })),
  );
  const [preset, setPreset] = useState<WorklistPreset>('Due now');
  const [selectedWorklistId, setSelectedWorklistId] = useState<string | null>(null);

  const activeFollowUps = useMemo(() => items.filter((item) => item.status !== 'Closed'), [items]);
  const waitingTooLong = useMemo(
    () => activeFollowUps.filter((item) => item.status.includes('Waiting') && Date.now() - new Date(item.lastTouchDate).getTime() > 7 * 86400000),
    [activeFollowUps],
  );

  const worklist = useMemo(() => {
    if (preset === 'Needs nudge') {
      return activeFollowUps.filter(needsNudge);
    }
    if (preset === 'Waiting too long') {
      return waitingTooLong;
    }
    if (preset === 'Blocked') {
      return activeFollowUps.filter((item) => item.status === 'At risk' || item.escalationLevel === 'Critical');
    }
    if (preset === 'Cleanup') {
      return activeFollowUps.filter((item) => item.needsCleanup);
    }
    return activeFollowUps.filter((item) => isOverdue(item) || new Date(item.dueDate).getTime() <= Date.now() + 86400000);
  }, [activeFollowUps, preset, waitingTooLong]);

  useEffect(() => {
    if (!worklist.length) {
      setSelectedWorklistId(null);
      return;
    }
    if (!selectedWorklistId || !worklist.some((item) => item.id === selectedWorklistId)) {
      setSelectedWorklistId(worklist[0].id);
    }
  }, [worklist, selectedWorklistId]);

  const selectedWorkItem = worklist.find((item) => item.id === selectedWorklistId) ?? null;

  const dueNowCount = activeFollowUps.filter((item) => isOverdue(item) || new Date(item.dueDate).getTime() <= Date.now() + 86400000).length;
  const nudgeCount = activeFollowUps.filter(needsNudge).length;
  const blockedCount = activeFollowUps.filter((item) => item.status === 'At risk' || item.escalationLevel === 'Critical').length;
  const cleanupCount = activeFollowUps.filter((item) => item.needsCleanup).length + tasks.filter((task) => task.needsCleanup && task.status !== 'Done').length;

  return (
    <div className="space-y-5">
      <AppShellCard>
        <SectionHeader
          title="Worklist"
          subtitle={personalMode ? 'Personal execution queue for what you should do next.' : 'Team execution queue with ownership and pressure context.'}
          actions={<button onClick={openCreateModal} className="primary-btn"><Plus className="h-4 w-4" />Add follow-up</button>}
        />
        <div className="overview-stat-grid overview-stat-grid-compact">
          <StatTile label="Due now" value={dueNowCount} helper="Overdue + due in 24h" tone={dueNowCount > 0 ? 'warn' : 'default'} />
          <StatTile label="Needs nudge" value={nudgeCount} helper="Waiting threads worth touching" />
          <StatTile label="Blocked" value={blockedCount} helper="At risk or critical escalation" tone={blockedCount > 0 ? 'danger' : 'default'} />
        </div>
      </AppShellCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_340px]">
        <AppShellCard>
          <FilterBar>
            <SegmentedControl
              value={preset}
              onChange={setPreset}
              options={[
                { value: 'Due now', label: `Due now (${dueNowCount})` },
                { value: 'Needs nudge', label: `Needs nudge (${nudgeCount})` },
                { value: 'Waiting too long', label: `Waiting too long (${waitingTooLong.length})` },
                { value: 'Blocked', label: `Blocked (${blockedCount})` },
                { value: 'Cleanup', label: `Cleanup (${cleanupCount})` },
              ]}
            />
          </FilterBar>

          <div className="overview-priority-list">
            {!hydrated ? (
              <div className="text-sm text-slate-500">Loading worklist…</div>
            ) : worklist.length === 0 ? (
              <EmptyState title="No items in this preset" message="Switch presets or create a follow-up to keep momentum." />
            ) : (
              worklist.slice(0, 12).map((item) => {
                const active = item.id === selectedWorklistId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedWorklistId(item.id)}
                    className={active ? 'overview-priority-row overview-priority-row-active' : 'overview-priority-row'}
                  >
                    <div className="overview-priority-main">
                      <div className="overview-priority-title">{item.title}</div>
                      <div className="overview-priority-meta">{item.project} • {item.owner} • Due {formatDate(item.dueDate)} • Next {item.nextAction || 'No next action set'}</div>
                    </div>
                    <div className="overview-priority-badges">
                      <Badge variant={item.escalationLevel === 'Critical' ? 'danger' : 'neutral'}>{item.escalationLevel}</Badge>
                      {needsNudge(item) ? <Badge variant="warn">Nudge</Badge> : null}
                      {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </AppShellCard>

        <AppShellCard>
          <SectionHeader title="Inspector" subtitle="Live context for the selected queue item." compact />
          {selectedWorkItem ? (
            <div className="space-y-3">
              <div className="detail-card">
                <div className="text-sm font-semibold text-slate-950">{selectedWorkItem.title}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedWorkItem.project} • {selectedWorkItem.owner}</div>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  <div>Due: <span className="font-medium text-slate-900">{formatDate(selectedWorkItem.dueDate)}</span></div>
                  <div>Next action: <span className="font-medium text-slate-900">{selectedWorkItem.nextAction || 'No next action set'}</span></div>
                  <div>Summary: <span className="text-slate-900">{selectedWorkItem.summary || 'No summary yet.'}</span></div>
                  <div>Risk / cleanup: <span className="font-medium text-slate-900">{selectedWorkItem.escalationLevel}{selectedWorkItem.needsCleanup ? ' • Needs cleanup' : ' • Clean'}</span></div>
                </div>
              </div>
              <div className="overview-action-stack">
                <button onClick={() => { setSelectedId(selectedWorkItem.id); openTouchModal(); }} className="action-btn justify-start"><BellRing className="h-4 w-4" />Log touch</button>
                <button onClick={() => { setSelectedId(selectedWorkItem.id); openCreateTaskModal(); }} className="action-btn justify-start"><FilePlus2 className="h-4 w-4" />Create linked task</button>
                <button onClick={() => { setSelectedId(selectedWorkItem.id); openDraftModal(selectedWorkItem.id); }} className="action-btn justify-start"><PenSquare className="h-4 w-4" />Draft follow-up</button>
                <button onClick={() => { setSelectedId(selectedWorkItem.id); onOpenTrackerView('All'); }} className="action-btn justify-start">Open full record <ExternalLink className="h-4 w-4" /></button>
              </div>
              <div className="overview-action-stack overview-action-stack-muted">
                <button onClick={() => onOpenTrackerView('Needs nudge')} className="action-btn justify-start"><BellRing className="h-4 w-4" />Open nudge queue</button>
                <button onClick={() => onOpenWorkspace('tasks')} className="action-btn justify-start">Open task workspace <ArrowRight className="h-4 w-4" /></button>
                {!personalMode ? <button onClick={() => onOpenWorkspace('projects')} className="action-btn justify-start">Review project pressure <AlertTriangle className="h-4 w-4" /></button> : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Nothing selected" message="Select an item in the queue to inspect details and run actions." />
          )}
        </AppShellCard>
      </div>
    </div>
  );
}
