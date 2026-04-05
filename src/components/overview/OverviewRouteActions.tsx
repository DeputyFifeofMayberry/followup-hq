import { WorkspaceToolbarRow } from '../ui/AppPrimitives';

interface OverviewRouteActionsProps {
  onOpenIntake: () => void;
  onRouteFollowUps: () => void;
  onRouteTasks: () => void;
  onQuickAdd: () => void;
}

export function OverviewRouteActions({ onOpenIntake, onRouteFollowUps, onRouteTasks, onQuickAdd }: OverviewRouteActionsProps) {
  return (
    <WorkspaceToolbarRow className="overview-triage-actions">
      <span className="overview-triage-label">Route-first:</span>
      <button onClick={onRouteTasks} className="action-btn !px-2.5 !py-1 text-xs">Open Tasks</button>
      <button onClick={onRouteFollowUps} className="action-btn !px-2.5 !py-1 text-xs">Open Follow Ups</button>
      <button onClick={onOpenIntake} className="action-btn !px-2.5 !py-1 text-xs">Open Intake</button>
      <button onClick={onQuickAdd} className="action-btn !px-2.5 !py-1 text-xs">Quick Add</button>
    </WorkspaceToolbarRow>
  );
}
