import { Badge } from '../Badge';
import { EmptyState } from '../ui/AppPrimitives';
import { formatDate, priorityTone } from '../../lib/utils';
import type { UnifiedQueueItem } from '../../types';

interface OverviewTriageListProps {
  rows: UnifiedQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function urgencyLabel(row: UnifiedQueueItem) {
  if (row.queueFlags.overdue) return { label: 'Overdue', variant: 'danger' as const };
  if (row.queueFlags.blocked || row.queueFlags.parentAtRisk) return { label: 'Blocked', variant: 'warn' as const };
  if (row.queueFlags.cleanupRequired) return { label: 'Cleanup', variant: 'warn' as const };
  return { label: 'Needs attention', variant: 'neutral' as const };
}

export function OverviewTriageList({ rows, selectedId, onSelect }: OverviewTriageListProps) {
  if (!rows.length) {
    return <EmptyState title="No items to triage" message="Overview is clear. Route into a lane when new work arrives." />;
  }

  return (
    <div className="overview-priority-list overview-priority-list-premium">
      {rows.map((row) => {
        const active = selectedId === row.id;
        const urgency = urgencyLabel(row);
        return (
          <button
            key={`${row.recordType}-${row.id}`}
            type="button"
            onClick={() => onSelect(row.id)}
            className={active ? 'overview-priority-row overview-priority-row-active list-row-family list-row-family-active w-full text-left' : 'overview-priority-row list-row-family w-full text-left'}
            aria-current={active ? 'true' : undefined}
          >
            <div className="scan-row-layout scan-row-layout-quiet">
              <div className="scan-row-content">
                <div className="scan-row-primary">{row.title}</div>
                <div className="scan-row-secondary">{row.project} • {row.recordType === 'task' ? 'Task' : 'Follow-up'} • {row.dueDate || row.nextTouchDate ? `Due ${formatDate(row.dueDate || row.nextTouchDate)}` : 'No date'}</div>
                <div className="scan-row-meta">{row.queueReasons[0] || row.whyInQueue}</div>
                <div className="scan-row-meta">{row.assignee || row.owner || row.primaryNextAction}</div>
              </div>
              <div className="scan-row-sidecar scan-row-sidecar-quiet">
                <div className="scan-row-badge-cluster">
                  <Badge variant="neutral">{row.recordType === 'task' ? 'Task' : 'Follow-up'}</Badge>
                  <Badge variant={urgency.variant}>{urgency.label}</Badge>
                  <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
