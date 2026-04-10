import { Clock3, ExternalLink, Hand, TimerReset } from 'lucide-react';
import { Badge } from './Badge';
import { AppBadge, EmptyState } from './ui/AppPrimitives';
import { daysUntil, formatDate, isOverdue, needsNudge, priorityTone, statusTone } from '../lib/utils';
import type { FollowUpItem } from '../types';

type TrackerMobileListProps = {
  items: FollowUpItem[];
  selectedId: string | null;
  personalMode?: boolean;
  onOpenDetails: (id: string) => void;
  onLogTouch: (id: string) => void;
  onNudge: (id: string) => void;
  onSnooze: (id: string) => void;
  onDelete: (id: string) => void;
  emptyStateMessage?: string;
  hasActiveRowNarrowing?: boolean;
  onResetFilters?: () => void;
};

export function TrackerMobileList({
  items,
  selectedId,
  personalMode = false,
  onOpenDetails,
  onLogTouch,
  onNudge,
  onSnooze,
  onDelete,
  emptyStateMessage = 'Adjust filters or clear search to find matching follow-ups.',
  hasActiveRowNarrowing = false,
  onResetFilters,
}: TrackerMobileListProps) {
  return (
    <div className="tracker-mobile-surface">
      <div className="tracker-mobile-list">
        {items.length === 0 ? (
          <div className="tracker-empty-state-wrap">
            <EmptyState title={hasActiveRowNarrowing ? 'No follow-ups match the current filters' : 'No follow-ups yet'} message={emptyStateMessage} />
            {hasActiveRowNarrowing ? <button type="button" className="primary-btn" onClick={onResetFilters}>Reset filters</button> : null}
          </div>
        ) : (
          items.map((item) => {
            const active = selectedId === item.id;
            const dueDelta = daysUntil(item.dueDate);
            const touchDelta = daysUntil(item.nextTouchDate);
            const linkedOpen = item.openLinkedTaskCount ?? 0;
            const linkedTotal = item.linkedTaskCount ?? 0;
            const waitingOn = item.waitingOn || 'Not specified';

            return (
              <article key={item.id} className={active ? 'tracker-mobile-card tracker-mobile-card-active' : 'tracker-mobile-card'}>
                <button type="button" className="tracker-mobile-main" onClick={() => onOpenDetails(item.id)}>
                  <div className="tracker-mobile-title-row">
                    <h3>{item.title}</h3>
                    <div className="tracker-mobile-badges">
                      <Badge variant={statusTone(item.status)}>{item.status}</Badge>
                      {(item.priority === 'High' || item.priority === 'Critical') ? <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge> : null}
                    </div>
                  </div>
                  <p className="tracker-mobile-project">{item.project} • {personalMode ? item.owner : (item.assigneeDisplayName || item.owner)}</p>
                  <p className="tracker-mobile-next">What matters now: <strong>{isOverdue(item) ? `Overdue ${Math.abs(dueDelta)}d` : needsNudge(item) ? (touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today') : item.nextAction ? 'Next move set' : 'Needs direction'}</strong></p>
                  <p className="tracker-mobile-next">Next move: <strong>{item.nextAction || 'No next move set'}</strong></p>
                  <div className="tracker-mobile-timing">
                    <span><Clock3 className="h-3.5 w-3.5" />Due {formatDate(item.dueDate)}</span>
                    <span><Hand className="h-3.5 w-3.5" />Touch {formatDate(item.nextTouchDate)}</span>
                    {item.promisedDate ? <span><TimerReset className="h-3.5 w-3.5" />Promised {formatDate(item.promisedDate)}</span> : null}
                  </div>
                  <div className="tracker-mobile-meta-row">
                    <span>Waiting on {waitingOn}</span>
                    <span>Linked {linkedOpen}/{linkedTotal} open</span>
                  </div>
                  <div className="tracker-mobile-alerts">
                    {isOverdue(item) ? <AppBadge tone="danger">Overdue {Math.abs(dueDelta)}d</AppBadge> : null}
                    {needsNudge(item) ? <AppBadge tone={touchDelta < 0 ? 'warn' : 'info'}>{touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today'}</AppBadge> : null}
                  </div>
                </button>

                <div className="tracker-mobile-actions">
                  <button type="button" className="action-btn" onClick={() => onLogTouch(item.id)}>Log touch</button>
                  <button type="button" className="action-btn" onClick={() => onNudge(item.id)}>Nudge</button>
                  <button type="button" className="action-btn" onClick={() => onSnooze(item.id)}>Snooze</button>
                  <button type="button" className="action-btn action-btn-danger" onClick={() => onDelete(item.id)}>Delete</button>
                  <button type="button" className="action-btn" onClick={() => onOpenDetails(item.id)}>
                    <ExternalLink className="h-4 w-4" />Details
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
