interface OverviewRouteActionsProps {
  onOpenIntake: () => void;
  onCreateWork: () => void;
}

export function OverviewRouteActions({ onOpenIntake, onCreateWork }: OverviewRouteActionsProps) {
  return (
    <div className="overview-utility-actions" role="group" aria-label="Overview utilities">
      <button onClick={onCreateWork} className="action-btn overview-utility-action">Create work</button>
      <button onClick={onOpenIntake} className="action-btn overview-utility-action">Intake</button>
    </div>
  );
}
