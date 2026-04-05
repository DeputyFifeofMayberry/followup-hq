import { ExternalLink } from 'lucide-react';
import { EmptyState, WorkspaceInspectorSection } from '../ui/AppPrimitives';
import { formatDate } from '../../lib/utils';
import type { UnifiedQueueItem } from '../../types';
import { OverviewInspectorActionGroup } from './OverviewInspectorActionGroup';

interface OverviewRouteInspectorProps {
  selected: UnifiedQueueItem | null;
  onOpenFollowUps: () => void;
  onOpenTasks: () => void;
  onOpenDetail: () => void;
  onOpenIntake?: () => void;
}

export function OverviewRouteInspector({ selected, onOpenFollowUps, onOpenTasks, onOpenDetail, onOpenIntake }: OverviewRouteInspectorProps) {
  if (!selected) {
    return <EmptyState title="Nothing selected" message="Select a triage row to confirm context and route it." />;
  }

  const whySurfaced = selected.queueReasons[0] || selected.whyInQueue;
  const dueOrTouch = selected.dueDate || selected.nextTouchDate;
  const recommendFollowUps = selected.recordType !== 'task';

  return (
    <div className="space-y-3">
      <WorkspaceInspectorSection title="Selected item" subtitle={`${selected.recordType} · ${selected.project}`}>
        <div className="text-sm font-semibold text-slate-950">{selected.title}</div>
        <div className="overview-inspector-kpis overview-inspector-kpis-tight">
          <div><span>Status</span><strong>{selected.status}</strong></div>
          <div><span>Owner</span><strong>{selected.assignee || selected.owner || 'Unassigned'}</strong></div>
        </div>
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Why now">
        <div className="overview-inspector-notes">{whySurfaced}</div>
        <div className="overview-inspector-notes">{dueOrTouch ? `Timing: ${formatDate(dueOrTouch)}` : 'Timing: no date set'}</div>
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Recommended destination">
        <OverviewInspectorActionGroup
          recommendedLabel={recommendFollowUps ? 'Open in Follow Ups' : 'Open in Tasks'}
          onRecommended={recommendFollowUps ? onOpenFollowUps : onOpenTasks}
          secondaryLabel={recommendFollowUps ? 'Open in Tasks' : 'Open in Follow Ups'}
          onSecondary={recommendFollowUps ? onOpenTasks : onOpenFollowUps}
          onOpenIntake={onOpenIntake}
        />
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Open full detail">
        <button onClick={onOpenDetail} className="action-btn justify-start">Open full detail <ExternalLink className="h-4 w-4" /></button>
      </WorkspaceInspectorSection>
    </div>
  );
}
