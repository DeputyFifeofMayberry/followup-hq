import { Ellipsis } from 'lucide-react';
import { Badge } from './Badge';
import { AppBadge, EmptyState } from './ui/AppPrimitives';
import { daysUntil, formatDate, isOverdue, needsNudge, priorityTone, statusTone } from '../lib/utils';
import type { FollowUpItem } from '../types';

type TrackerMobileListProps = {
  items: FollowUpItem[];
  selectedId: string | null;
  personalMode?: boolean;
  onOpenDetails: (id: string) => void;
  onDelete: (id: string) => void;
  emptyStateMessage?: string;
  hasActiveRowNarrowing?: boolean;
  onResetFilters?: () => void;
};

function getUrgencySignal(item: FollowUpItem): { label: string; tone: 'danger' | 'warn' | 'info' | 'success'; context?: string } {
  const dueDelta = daysUntil(item.dueDate);
  const touchDelta = daysUntil(item.nextTouchDate);

  if (item.status === 'Closed') {
    return { label: 'Closed', tone: 'success', context: 'No action needed unless reopened.' };
  }

  if (isOverdue(item)) {
    return {
      label: `Overdue ${Math.abs(dueDelta)}d`,
      tone: 'danger',
      context: `Due ${formatDate(item.dueDate)}`,
    };
  }

  if (needsNudge(item)) {
    return {
      label: touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today',
      tone: 'warn',
      context: touchDelta < 0 ? `Last touch slipped by ${Math.abs(touchDelta)}d` : 'Run the next touch update today.',
    };
  }

  if (item.status === 'Waiting on external' || item.status === 'Waiting internal' || item.waitingOn) {
    return {
      label: 'Waiting',
      tone: 'info',
      context: item.waitingOn ? `Waiting on ${item.waitingOn}` : 'Waiting for response',
    };
  }

  return { label: 'On track', tone: 'success', context: `Due ${formatDate(item.dueDate)}` };
}

function getSupportLine(item: FollowUpItem, personalMode: boolean) {
  const assignee = personalMode ? item.owner : (item.assigneeDisplayName || item.owner);
  return [item.project, assignee].filter(Boolean).join(' • ');
}

export function TrackerMobileList({
  items,
  selectedId,
  personalMode = false,
  onOpenDetails,
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
            const urgency = getUrgencySignal(item);
            const hasNextMove = Boolean(item.nextAction?.trim());

            return (
              <article key={item.id} className={active ? 'tracker-mobile-card tracker-mobile-card-active' : 'tracker-mobile-card'}>
                <button type="button" className="tracker-mobile-main" onClick={() => onOpenDetails(item.id)}>
                  <div className="tracker-mobile-title-row">
                    <h3>{item.title}</h3>
                    <div className="tracker-mobile-badges">
                      <Badge variant={statusTone(item.status)}>{item.status}</Badge>
                    </div>
                  </div>

                  <div className="tracker-mobile-urgency">
                    <AppBadge tone={urgency.tone}>{urgency.label}</AppBadge>
                    {(item.priority === 'High' || item.priority === 'Critical') ? <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge> : null}
                    {urgency.context ? <p className="tracker-mobile-urgency-context">{urgency.context}</p> : null}
                  </div>

                  <p className={hasNextMove ? 'tracker-mobile-next-move' : 'tracker-mobile-next-move tracker-mobile-next-move-missing'}>
                    <strong>Next move:</strong> {hasNextMove ? item.nextAction : 'No next move set yet'}
                  </p>

                  <p className="tracker-mobile-support">{getSupportLine(item, personalMode)}</p>
                </button>

                <div className="tracker-mobile-actions-row">
                  <span className="tracker-mobile-secondary-label">Open inspector for execution actions</span>

                  <details className="tracker-mobile-more-actions" onClick={(event) => event.stopPropagation()}>
                    <summary className="action-btn tracker-mobile-more-trigger">
                      <Ellipsis className="h-4 w-4" />More
                    </summary>
                    <div className="tracker-mobile-more-menu" role="menu" aria-label={`More actions for ${item.title}`}>
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
