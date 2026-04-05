import { ExternalLink } from 'lucide-react';
import { EmptyState, WorkspaceInspectorSection } from '../ui/AppPrimitives';
import { formatDate } from '../../lib/utils';
import type { UnifiedQueueItem } from '../../types';

interface OverviewRouteInspectorProps {
  selected: UnifiedQueueItem | null;
  onOpenFollowUps: () => void;
  onOpenTasks: () => void;
  onOpenDetail: () => void;
  onOpenIntake?: () => void;
}

export function OverviewRouteInspector({ selected, onOpenFollowUps, onOpenTasks, onOpenDetail, onOpenIntake }: OverviewRouteInspectorProps) {
  if (!selected) {
    return <EmptyState title="Nothing selected" message="Select a triage row to confirm context and launch deeper work." />;
  }

  const whySurfaced = selected.queueReasons[0] || selected.whyInQueue;
  const recommend = selected.recordType === 'task' ? 'Tasks lane' : 'Follow Ups lane';

  return (
    <div className="space-y-3">
      <WorkspaceInspectorSection title="Selected record" subtitle={`${selected.recordType} · ${selected.project}`}>
        <div className="text-sm font-semibold text-slate-950">{selected.title}</div>
        <div className="overview-inspector-kpis overview-inspector-kpis-tight">
          <div><span>Status</span><strong>{selected.status}</strong></div>
          <div><span>Due / next touch</span><strong>{formatDate(selected.dueDate || selected.nextTouchDate)}</strong></div>
          <div><span>Recommended destination</span><strong>{recommend}</strong></div>
        </div>
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Why now">
        <div className="overview-inspector-notes">{whySurfaced}</div>
        <div className="overview-inspector-notes">Next signal: {selected.primaryNextAction}</div>
      </WorkspaceInspectorSection>

      <WorkspaceInspectorSection title="Launch deeper work">
        <div className="overview-action-stack overview-action-stack-muted">
          <button onClick={onOpenFollowUps} className="action-btn justify-start">Open in Follow Ups</button>
          <button onClick={onOpenTasks} className="action-btn justify-start">Open in Tasks</button>
          <button onClick={onOpenDetail} className="action-btn justify-start">Open full detail <ExternalLink className="h-4 w-4" /></button>
          {onOpenIntake ? <button onClick={onOpenIntake} className="action-btn justify-start">Open Intake</button> : null}
        </div>
      </WorkspaceInspectorSection>
    </div>
  );
}
