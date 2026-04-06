import { ExternalLink } from 'lucide-react';
import { EmptyState, WorkspaceInspectorSection } from '../ui/AppPrimitives';
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
  return null;
}

export function OverviewRouteInspector({ selected, onRouteDestination, onOpenDetail, onOpenIntake }: OverviewRouteInspectorProps) {
  if (!selected) {
    return <EmptyState title="Nothing selected" message="Select a triage item to see why it surfaced and where to handle it." />;
  }

  const recommendation = getOverviewInspectorRecommendation(selected);
  const timingLabel = getTimingLabel(selected);
  const recordTypeLabel = selected.recordType === 'task' ? 'Task' : 'Follow up';

  const handleSecondaryRoute = () => {
    if (recommendation.secondaryDestination === 'outlook') {
      onOpenIntake();
      return;
    }
    if (recommendation.secondaryDestination === 'tasks' || recommendation.secondaryDestination === 'followups') {
      onRouteDestination(recommendation.secondaryDestination);
    }
  };

  return (
    <div className="overview-route-inspector">
      <WorkspaceInspectorSection title={recordTypeLabel === 'Task' ? 'Selected task' : 'Selected follow-up'} subtitle={`${recordTypeLabel} · ${selected.project}`}>
        <div className="overview-inspector-selected-title">{selected.title}</div>
        <div className="overview-inspector-meta-grid">
          <div><span>Status</span><strong>{selected.status}</strong></div>
          <div><span>Project</span><strong>{selected.project}</strong></div>
          {timingLabel ? <div><span>Timing</span><strong>{timingLabel}</strong></div> : null}
        </div>
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="What matters now" subtitle="Reason this item surfaced in Overview.">
        <p className="overview-inspector-why">{recommendation.whyNow}</p>
        {recommendation.urgencySignals.length ? (
          <ul className="overview-inspector-signals" aria-label="Urgency signals">
            {recommendation.urgencySignals.map((signal) => <li key={signal}>{signal}</li>)}
          </ul>
        ) : null}
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Take action now" subtitle={`Recommended lane: ${recommendation.primaryDestination === 'tasks' ? 'Tasks' : 'Follow-Ups'}.`}>
        <div className="overview-inspector-recommendation-card">
          <div className="overview-inspector-recommendation-kicker">Recommended route</div>
          <p className="overview-inspector-why">{recommendation.reason}</p>
        </div>
        <div className="overview-action-stack overview-action-stack-muted overview-inspector-actions">
          <button
            onClick={() => onRouteDestination(recommendation.primaryDestination)}
            className="action-btn overview-inspector-primary-action justify-start"
          >
            {recommendation.label}
          </button>
          {recommendation.secondaryLabel && recommendation.secondaryDestination ? (
            <button onClick={handleSecondaryRoute} className="action-btn justify-start">{recommendation.secondaryLabel}</button>
          ) : null}
          <button onClick={onOpenDetail} className="action-btn justify-start">Open full detail <ExternalLink className="h-4 w-4" /></button>
        </div>
      </WorkspaceInspectorSection>
    </div>
  );
}
