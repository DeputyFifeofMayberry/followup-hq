import { WorkspaceToolbarRow } from '../ui/AppPrimitives';

interface OverviewRouteActionsProps {
  onOpenIntake: () => void;
  onRouteFollowUps: () => void;
  onRouteTasks: () => void;
  onQuickAdd: () => void;
}

export function OverviewRouteActions({ onOpenIntake, onRouteFollowUps, onRouteTasks, onQuickAdd }: OverviewRouteActionsProps) {
  return (
    <div className="overview-command-actions" role="group" aria-label="Overview routing actions">
      <button onClick={onRouteTasks} className="primary-btn overview-command-primary">
        Route into Tasks
      </button>
      <WorkspaceToolbarRow className="overview-triage-actions">
        <span className="overview-triage-label">Quick routes:</span>
        <button onClick={onRouteFollowUps} className="action-btn overview-command-secondary">Open Follow Ups</button>
        <button onClick={onOpenIntake} className="action-btn overview-command-secondary">Open Intake</button>
        <button onClick={onQuickAdd} className="action-btn overview-command-secondary">Quick capture</button>
      </WorkspaceToolbarRow>
    </div>
  );
}
