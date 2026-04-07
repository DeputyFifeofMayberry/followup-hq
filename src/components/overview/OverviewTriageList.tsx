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
  if (row.queueFlags.readyToCloseParent) return { label: 'Ready to close', variant: 'info' as const };
  if (row.queueFlags.cleanupRequired || row.queueFlags.orphanedTask) return { label: 'Needs cleanup review', variant: 'neutral' as const };
  return { label: 'Needs decision', variant: 'neutral' as const };
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
        const dueLabel = row.dueDate || row.nextTouchDate ? formatDate(row.dueDate || row.nextTouchDate) : 'No date';
        const ownerLabel = row.assignee || row.owner || 'Unassigned';
        const reason = row.queueReasons[0] || row.whyInQueue;

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
                <div className="scan-row-primary">{row.title}</div>
                <div className="overview-row-why-now">{reason}</div>
                <div className="scan-row-meta">{row.project} · {row.recordType === 'task' ? 'Task' : 'Follow-up'} · {ownerLabel} · {dueLabel}</div>
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
