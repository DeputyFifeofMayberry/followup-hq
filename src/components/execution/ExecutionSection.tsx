import type { ReactNode } from 'react';
import type { UnifiedQueueItem } from '../../types';
import { Badge } from '../Badge';
import { formatDate, priorityTone } from '../../lib/utils';

export function ExecutionSection({ title, subtitle, count, actions, children }: { title: string; subtitle: string; count: number; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title} <span className="text-slate-500">({count})</span></h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function ExecutionQueueList({ rows, selectedId, selectedRows, onSelect, onToggleRow }: { rows: UnifiedQueueItem[]; selectedId: string | null; selectedRows: string[]; onSelect: (id: string) => void; onToggleRow: (id: string, checked: boolean) => void }) {
  if (!rows.length) return <div className="text-xs text-slate-500">No items in this section.</div>;
  return (
    <div className="space-y-1">
      {rows.map((row) => {
        const active = row.id === selectedId;
        const checked = selectedRows.includes(row.id);
        return (
          <div key={`${row.recordType}-${row.id}`} className={active ? 'overview-priority-row overview-priority-row-active list-row-family list-row-family-active' : 'overview-priority-row list-row-family'}>
            <input aria-label={`Select ${row.title}`} type="checkbox" checked={checked} onChange={(event) => onToggleRow(row.id, event.target.checked)} />
            <button type="button" onClick={() => onSelect(row.id)} className="overview-priority-main text-left" aria-current={active ? 'true' : undefined}>
              <div className="scan-row-layout scan-row-layout-quiet">
                <div className="scan-row-content">
                  <div className="scan-row-primary">{row.title}</div>
                  <div className="scan-row-secondary">{row.project} • {row.dueDate || row.nextTouchDate ? `Due ${formatDate(row.dueDate || row.nextTouchDate)}` : 'No date'} • {row.primaryNextAction}</div>
                </div>
                <div className="scan-row-badge-cluster">
                  <Badge variant="neutral">{row.recordType === 'task' ? 'Task' : 'Follow-up'}</Badge>
                  <Badge variant={priorityTone(row.priority)}>{row.priority}</Badge>
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
