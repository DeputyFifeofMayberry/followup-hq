import { AlertTriangle, ArrowRight, BellRing, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
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
}

export function OverviewPage({ onOpenWorkspace, onOpenTrackerView }: OverviewPageProps) {
  const { items, tasks, hydrated, setSelectedId, openCreateModal, openCreateTaskModal } = useAppStore(
    useShallow((s) => ({
      items: s.items,
      tasks: s.tasks,
      hydrated: s.hydrated,
      setSelectedId: s.setSelectedId,
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
    })),
  );
  const [preset, setPreset] = useState<WorklistPreset>('Due now');

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

  const dueNowCount = activeFollowUps.filter((item) => isOverdue(item) || new Date(item.dueDate).getTime() <= Date.now() + 86400000).length;
  const nudgeCount = activeFollowUps.filter(needsNudge).length;
  const blockedCount = activeFollowUps.filter((item) => item.status === 'At risk' || item.escalationLevel === 'Critical').length;
  const cleanupCount = activeFollowUps.filter((item) => item.needsCleanup).length + tasks.filter((task) => task.needsCleanup && task.status !== 'Done').length;

  return (
    <div className="space-y-5">
      <AppShellCard>
        <SectionHeader
          title="Worklist"
          subtitle="One action-first command surface for what needs attention next."
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
              worklist.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    onOpenTrackerView('All');
                  }}
                  className="overview-priority-row"
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
              ))
            )}
          </div>
        </AppShellCard>

        <AppShellCard>
          <SectionHeader title="Context" subtitle="Suggested next moves from this queue." compact />
          <div className="overview-action-stack">
            <button onClick={() => onOpenTrackerView('Needs nudge')} className="action-btn justify-start"><BellRing className="h-4 w-4" />Open nudge queue</button>
            <button onClick={() => onOpenTrackerView('Overdue')} className="action-btn justify-start"><AlertTriangle className="h-4 w-4" />Work overdue follow-ups</button>
            <button onClick={openCreateTaskModal} className="action-btn justify-start"><Plus className="h-4 w-4" />Create task from context</button>
            <button onClick={() => onOpenWorkspace('projects')} className="action-btn justify-start">Review project pressure <ArrowRight className="h-4 w-4" /></button>
            <button onClick={() => onOpenWorkspace('relationships')} className="action-btn justify-start">Check relationship blockers <ArrowRight className="h-4 w-4" /></button>
            <button onClick={() => onOpenWorkspace('tasks')} className="action-btn justify-start">Open task workspace <ArrowRight className="h-4 w-4" /></button>
          </div>
        </AppShellCard>
      </div>
    </div>
  );
}
