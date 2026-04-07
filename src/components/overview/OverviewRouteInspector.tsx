import { ExternalLink } from 'lucide-react';
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
        <div className="overview-quick-context-topline">{selected.recordType === 'task' ? 'Task' : 'Follow-up'} · {selected.project}</div>
        <div className="overview-inspector-selected-title">{selected.title}</div>
        <p className="overview-inspector-why">{recommendation.whyNow}</p>
        <div className="overview-quick-context-meta">
          <span>{getTimingLabel(selected)}</span>
          <span>{selected.status}</span>
        </div>
      </div>

      <div className="overview-quick-actions">
        <button onClick={onOpenDetail} className="action-btn overview-quick-primary-action justify-start">Open full detail <ExternalLink className="h-4 w-4" /></button>
        <button onClick={() => onRouteDestination(recommendation.primaryDestination)} className="action-btn justify-start">{recommendation.label}</button>
        {recommendation.secondaryLabel && recommendation.secondaryDestination ? (
          <button onClick={handleSecondaryRoute} className="action-btn justify-start">{recommendation.secondaryLabel}</button>
        ) : null}
      </div>
    </div>
  );
}
