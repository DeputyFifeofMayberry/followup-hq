import { ChevronDown, Clock3, ExternalLink, Hand, Send, TimerReset } from 'lucide-react';
import { Badge } from './Badge';
import { AppBadge, EmptyState, ExecutionLaneFooterMeta } from './ui/AppPrimitives';
import { daysUntil, formatDate, needsNudge, priorityTone, statusTone } from '../lib/utils';
import type { AppMode, FollowUpItem } from '../types';
import { getModeConfig } from '../lib/appModeConfig';

type TrackerMobileListProps = {
  items: FollowUpItem[];
  selectedId: string | null;
  selectedCount: number;
  appMode: AppMode;
  personalMode?: boolean;
  onSelect: (id: string) => void;
  onLogTouch: (id: string) => void;
  onNudge: (id: string) => void;
  onSnooze: (id: string) => void;
  onMarkSent: (id: string) => void;
  onStatusChange: (id: string, status: FollowUpItem['status']) => void;
};

export function TrackerMobileList({
  items,
  selectedId,
  selectedCount,
  appMode,
  personalMode = false,
  onSelect,
  onLogTouch,
  onNudge,
  onSnooze,
  onMarkSent,
  onStatusChange,
}: TrackerMobileListProps) {
  const modeConfig = getModeConfig(appMode);

  return (
    <div className="tracker-mobile-surface">
      <div className="tracker-mobile-list">
        {items.length === 0 ? (
          <EmptyState title="No follow-ups found" message="Adjust filters, clear search, or Quick Add a follow-up." />
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
                <button type="button" className="tracker-mobile-main" onClick={() => onSelect(item.id)}>
                  <div className="tracker-mobile-title-row">
                    <h3>{item.title}</h3>
                    <div className="tracker-mobile-badges">
                      <Badge variant={statusTone(item.status)}>{item.status}</Badge>
                      <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                    </div>
                  </div>
                  <p className="tracker-mobile-project">{item.project} • {personalMode ? item.owner : (item.assigneeDisplayName || item.owner)}</p>
                  <p className="tracker-mobile-next">Next move: <strong>{item.nextAction || 'Define next move'}</strong></p>
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
                    {dueDelta < 0 ? <AppBadge tone="danger">Overdue {Math.abs(dueDelta)}d</AppBadge> : null}
                    {needsNudge(item) ? <AppBadge tone={touchDelta < 0 ? 'warn' : 'info'}>{touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today'}</AppBadge> : null}
                    {linkedOpen > 0 && item.status !== 'Closed' ? <AppBadge tone="warn">Linked work in flight</AppBadge> : null}
                  </div>
                </button>

                <div className="tracker-mobile-actions">
                  <button type="button" className="action-btn" onClick={() => onLogTouch(item.id)}>Log touch</button>
                  <button type="button" className="action-btn" onClick={() => onNudge(item.id)}>Nudge</button>
                  <button type="button" className="action-btn" onClick={() => onSnooze(item.id)}>Snooze</button>
                  <button type="button" className="action-btn" onClick={() => onSelect(item.id)}>
                    <ExternalLink className="h-4 w-4" />Details
                  </button>
                </div>

                <div className="tracker-mobile-secondary-actions">
                  <label className="field-block">
                    <span className="field-label">Status</span>
                    <select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value as FollowUpItem['status'])} className="field-input">
                      <option>Needs action</option>
                      <option>Waiting on external</option>
                      <option>Waiting internal</option>
                      <option>In progress</option>
                      <option>At risk</option>
                      <option>Closed</option>
                    </select>
                  </label>
                  {item.actionState !== 'Sent (confirmed)' ? (
                    <button type="button" className="action-btn" onClick={() => onMarkSent(item.id)}>
                      <Send className="h-4 w-4" />Mark sent
                    </button>
                  ) : null}
                  <span className="tracker-mobile-selected-pill">{active ? 'Selected' : <ChevronDown className="h-4 w-4" />}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
      <ExecutionLaneFooterMeta
        shownCount={items.length}
        selectedCount={selectedCount}
        scopeSummary={modeConfig.trackerOwnerContext === 'compact' ? 'Execution view' : 'Coordination view'}
        hint="Mobile lane: scan card → act → continue"
      />
    </div>
  );
}
