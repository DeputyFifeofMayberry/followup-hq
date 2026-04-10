import { Badge } from '../Badge';
import { EmptyState } from '../ui/AppPrimitives';
import { formatDate, priorityTone } from '../../lib/utils';
import type { UnifiedQueueItem } from '../../types';

interface OverviewTriageListProps {
  rows: UnifiedQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function urgencySignal(row: UnifiedQueueItem) {
  if (row.queueFlags.overdue) return { label: 'Overdue commitment', variant: 'danger' as const };
  if (row.queueFlags.dueToday) return { label: 'Due today', variant: 'warn' as const };
  if (row.queueFlags.needsTouchToday) return { label: 'Touch due today', variant: 'warn' as const };
  if (row.queueFlags.blocked) return { label: 'Blocked now', variant: 'warn' as const };
  if (row.queueFlags.parentAtRisk) return { label: 'Parent at risk', variant: 'warn' as const };
  if (row.queueFlags.waitingTooLong) return { label: 'Waiting too long', variant: 'neutral' as const };
  if (row.queueFlags.waiting) return { label: 'Waiting on response', variant: 'neutral' as const };
  if (row.queueFlags.readyToCloseParent) return { label: 'Ready to close', variant: 'blue' as const };
  if (row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask) return { label: 'Needs review', variant: 'neutral' as const };
  return { label: 'Needs decision', variant: 'neutral' as const };
}

function recordTypeLabel(recordType: UnifiedQueueItem['recordType']) {
  return recordType === 'task' ? 'Task' : 'Follow-up';
}

export function overviewRowTypeBadge(recordType: UnifiedQueueItem['recordType']) {
  if (recordType === 'task') return { label: 'Task', variant: 'purple' as const };
  return { label: 'Follow-up', variant: 'blue' as const };
}

function nextMoveLabel(row: UnifiedQueueItem) {
  if (row.primaryNextAction?.trim()) return row.primaryNextAction.trim();
  return row.recordType === 'task' ? 'Continue in Tasks' : 'Continue in Follow Ups';
}

function timingLabel(row: UnifiedQueueItem) {
  if (row.dueDate) return `Due ${formatDate(row.dueDate)}`;
  if (row.promisedDate) return `Promised ${formatDate(row.promisedDate)}`;
  if (row.nextTouchDate) return `Touch ${formatDate(row.nextTouchDate)}`;
  return 'No date set';
}

export function OverviewTriageList({ rows, selectedId, onSelect }: OverviewTriageListProps) {
  if (!rows.length) {
    return <EmptyState title="No items to triage" message="Overview is clear. New items will appear here when they need a decision." />;
  }

  return (
    <div className="overview-priority-list" role="listbox" aria-label="Overview triage list">
      {rows.map((row) => {
        const active = selectedId === row.id;
        const urgency = urgencySignal(row);
        const projectLabel = row.project?.trim() || 'No project';
        const accountableLabel = row.assignee?.trim() || row.owner?.trim() || 'Unassigned';
        const reason = row.queueReasons[0] || row.whyInQueue;
        const typeBadge = overviewRowTypeBadge(row.recordType);

        return (
          <button
            key={`${row.recordType}-${row.id}`}
            type="button"
            onClick={() => onSelect(row.id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row.id); } }}
            className={[
              'overview-priority-row',
              'overview-triage-row',
              'list-row-family',
              'w-full',
              'text-left',
              active ? 'overview-priority-row-active list-row-family-active' : '',
            ].join(' ')}
            aria-current={active ? 'true' : undefined}
            aria-selected={active}
          >
            <div className="overview-triage-row-layout">
              <div className="overview-triage-row-content">
                <div className="overview-triage-row-titleline">
                  <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                  <div className="scan-row-primary">{row.title}</div>
                </div>
                <div className="overview-row-why-now">{reason}</div>
                <div className="overview-row-next-move">Best next move: {nextMoveLabel(row)}</div>
                <div className="scan-row-meta">
                  {projectLabel} · {recordTypeLabel(row.recordType)} · {accountableLabel} · {timingLabel(row)}
                </div>
              </div>
              <div className="overview-triage-row-sidecar">
                <div className="scan-row-badge-cluster">
                  <Badge variant={urgency.variant}>{urgency.label}</Badge>
                </div>
                <div className="overview-priority-badge-muted"><Badge variant={priorityTone(row.priority)}>{row.priority}</Badge></div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
