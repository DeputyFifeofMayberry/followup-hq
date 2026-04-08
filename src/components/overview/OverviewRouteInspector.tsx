import { EmptyState } from '../ui/AppPrimitives';
import { formatDate } from '../../lib/utils';
import type { UnifiedQueueItem } from '../../types';
import {
  getOverviewInspectorRecommendation,
  type OverviewInspectorDestination,
} from '../../domains/overview/lib/getOverviewInspectorRecommendation';

interface OverviewRouteInspectorProps {
  selected: UnifiedQueueItem | null;
  onRouteDestination: (destination: Extract<OverviewInspectorDestination, 'tasks' | 'followups'>) => void;
  onOpenDetail: () => void;
  onOpenIntake: () => void;
}

function getTimingLabel(record: UnifiedQueueItem) {
  if (record.dueDate) return `Due ${formatDate(record.dueDate)}`;
  if (record.promisedDate) return `Promised ${formatDate(record.promisedDate)}`;
  if (record.nextTouchDate) return `Next touch ${formatDate(record.nextTouchDate)}`;
  return 'No date set';
}

export function OverviewRouteInspector({ selected, onRouteDestination, onOpenDetail, onOpenIntake }: OverviewRouteInspectorProps) {
  if (!selected) {
    return <EmptyState title="Nothing selected" message="Select an overview item to review context and next move." />;
  }

  const recommendation = getOverviewInspectorRecommendation(selected);

  const handleSecondaryRoute = () => {
    if (recommendation.secondaryDestination === 'outlook') return onOpenIntake();
    if (recommendation.secondaryDestination === 'tasks' || recommendation.secondaryDestination === 'followups') {
      onRouteDestination(recommendation.secondaryDestination);
    }
  };

  return (
    <div className="overview-quick-context-shell">
      <div className="overview-quick-context-card">
        <div className="overview-quick-context-topline">{selected.recordType === 'task' ? 'Task' : 'Follow-up'} · {selected.project || 'No project'}</div>
        <div className="overview-inspector-selected-title">{selected.title}</div>
        <div className="overview-quick-context-meta">
          <span>{getTimingLabel(selected)}</span>
          <span>{selected.status}</span>
        </div>
      </div>

      <section className="overview-inspector-section-block" aria-label="Why this surfaced">
        <h3 className="overview-inspector-section-heading">Why this surfaced</h3>
        <p className="overview-inspector-why">{recommendation.whyNow}</p>
        {recommendation.urgencySignals.length ? (
          <div className="overview-inspector-signal-row">
            {recommendation.urgencySignals.map((signal) => <span key={signal}>{signal}</span>)}
          </div>
        ) : null}
      </section>

      <section className="overview-inspector-section-block" aria-label="Recommended next lane">
        <h3 className="overview-inspector-section-heading">Recommended next lane</h3>
        <p className="overview-inspector-reason">{recommendation.reason}</p>
      </section>

      <div className="overview-quick-actions">
        <button onClick={() => onRouteDestination(recommendation.primaryDestination)} className="primary-btn justify-start">{recommendation.label}</button>
        {recommendation.secondaryLabel && recommendation.secondaryDestination ? (
          <button onClick={handleSecondaryRoute} className="action-btn justify-start">{recommendation.secondaryLabel}</button>
        ) : null}
        <button onClick={onOpenDetail} className="action-btn justify-start">Open full detail</button>
      </div>
    </div>
  );
}
