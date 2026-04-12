import { EmptyState, ExecutionLaneSelectionStrip, WorkspaceInspectorSection } from '../ui/AppPrimitives';
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
    <div className="overview-route-inspector">
      <ExecutionLaneSelectionStrip
        title={selected.title}
        helper={`${selected.recordType === 'task' ? 'Task' : 'Follow-up'} · ${selected.project || 'No project'} · ${getTimingLabel(selected)}`}
        badges={<span className="execution-summary-stat-chip execution-summary-stat-chip-muted">{selected.status}</span>}
      />

      <WorkspaceInspectorSection title="Why this surfaced" subtitle="Current queue pressure and urgency context.">
        <p className="overview-inspector-why">{recommendation.whyNow}</p>
        {recommendation.urgencySignals.length ? (
          <div className="overview-inspector-signal-row">
            {recommendation.urgencySignals.map((signal) => <span key={signal}>{signal}</span>)}
          </div>
        ) : null}
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Recommended next lane" subtitle="Route quickly without leaving overview triage.">
        <p className="overview-inspector-reason">{recommendation.reason}</p>
        <div className="overview-inspector-primary-route">{recommendation.label}</div>
      </WorkspaceInspectorSection>

      <div className="overview-quick-actions workspace-action-row">
        <button onClick={() => onRouteDestination(recommendation.primaryDestination)} className="primary-btn justify-start">{recommendation.label}</button>
        {recommendation.secondaryLabel && recommendation.secondaryDestination ? (
          <button onClick={handleSecondaryRoute} className="action-btn justify-start">{recommendation.secondaryLabel}</button>
        ) : null}
        <button onClick={onOpenDetail} className="action-btn justify-start">Open full detail</button>
      </div>
    </div>
  );
}
