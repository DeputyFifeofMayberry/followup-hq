import { WorkspaceToolbarRow } from '../ui/AppPrimitives';

interface OverviewRouteActionsProps {
  onOpenIntake: () => void;
  onCreateWork: () => void;
}

export function OverviewRouteActions({ onOpenIntake, onCreateWork }: OverviewRouteActionsProps) {
  return (
    <div className="overview-command-actions" role="group" aria-label="Overview routing actions">
      <WorkspaceToolbarRow className="overview-triage-actions">
        <span className="overview-triage-label">Quick actions:</span>
        <button onClick={onOpenIntake} className="action-btn overview-command-secondary">Open Intake</button>
        <button onClick={onCreateWork} className="action-btn overview-command-secondary">Create work item</button>
      </WorkspaceToolbarRow>
    </div>
  );
}
