import { Clock3, Ellipsis, Hand } from 'lucide-react';
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

function getPrimarySignal(item: FollowUpItem): { label: string; tone: 'danger' | 'warn' | 'info' | 'success' } {
  const dueDelta = daysUntil(item.dueDate);
  const touchDelta = daysUntil(item.nextTouchDate);

  if (item.status === 'Closed') return { label: 'Closed', tone: 'success' };
  if (isOverdue(item)) return { label: `Overdue ${Math.abs(dueDelta)}d`, tone: 'danger' };
  if (needsNudge(item)) return { label: touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today', tone: 'warn' };
  if (item.status === 'Waiting on external' || item.status === 'Waiting internal' || item.waitingOn) return { label: 'Waiting', tone: 'info' };
  return { label: 'On track', tone: 'success' };
}

function getSupportLine(item: FollowUpItem, personalMode: boolean) {
  const assignee = personalMode ? item.owner : (item.assigneeDisplayName || item.owner);
  const waitingOn = item.waitingOn ? `Waiting: ${item.waitingOn}` : null;
  return [item.project, assignee, waitingOn].filter(Boolean).join(' • ');
}

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
            const primarySignal = getPrimarySignal(item);
            const touchDelta = daysUntil(item.nextTouchDate);
            const dueDelta = daysUntil(item.dueDate);

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

                  <div className="tracker-mobile-signals">
                    <AppBadge tone={primarySignal.tone}>{primarySignal.label}</AppBadge>
                    {isOverdue(item) ? <AppBadge tone="danger">Due {formatDate(item.dueDate)}</AppBadge> : null}
                    {!isOverdue(item) && needsNudge(item) ? <AppBadge tone={touchDelta < 0 ? 'warn' : 'info'}>{touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today'}</AppBadge> : null}
                  </div>

                  <p className="tracker-mobile-mainline">
                    {isOverdue(item)
                      ? `Needs attention now • Due ${formatDate(item.dueDate)} (${Math.abs(dueDelta)}d ${dueDelta < 0 ? 'late' : 'remaining'})`
                      : needsNudge(item)
                        ? `Needs touch • ${touchDelta < 0 ? `${Math.abs(touchDelta)}d overdue` : 'touch due today'}`
                        : item.status === 'Waiting on external' || item.status === 'Waiting internal' || item.waitingOn
                          ? `Waiting state • ${item.waitingOn || 'Awaiting response'}`
                          : `Next checkpoint • Due ${formatDate(item.dueDate)}`}
                  </p>

                  <p className="tracker-mobile-next-move">Next move: <strong>{item.nextAction || 'Set the next move in the editor'}</strong></p>
                  <p className="tracker-mobile-support">{getSupportLine(item, personalMode)}</p>
                </button>

                <div className="tracker-mobile-actions-row">
                  <button type="button" className="action-btn tracker-mobile-primary-action" onClick={() => onLogTouch(item.id)}>
                    <Hand className="h-4 w-4" />Log touch
                  </button>

                  <details className="tracker-mobile-more-actions" onClick={(event) => event.stopPropagation()}>
                    <summary className="action-btn tracker-mobile-more-trigger">
                      <Ellipsis className="h-4 w-4" />More
                    </summary>
                    <div className="tracker-mobile-more-menu" role="menu" aria-label={`More actions for ${item.title}`}>
                      <button type="button" className="tracker-mobile-more-item" role="menuitem" onClick={() => onNudge(item.id)}>
                        <Hand className="h-3.5 w-3.5" />Mark nudged
                      </button>
                      <button type="button" className="tracker-mobile-more-item" role="menuitem" onClick={() => onSnooze(item.id)}>
                        <Clock3 className="h-3.5 w-3.5" />Snooze 2d
                      </button>
                      <button type="button" className="tracker-mobile-more-item tracker-mobile-more-item-danger" role="menuitem" onClick={() => onDelete(item.id)}>
                        Delete follow-up
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
