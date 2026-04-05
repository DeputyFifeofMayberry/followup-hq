interface OverviewInspectorActionGroupProps {
  recommendedLabel: string;
  onRecommended: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  onOpenIntake?: () => void;
}

export function OverviewInspectorActionGroup({
  recommendedLabel,
  onRecommended,
  secondaryLabel,
  onSecondary,
  onOpenIntake,
}: OverviewInspectorActionGroupProps) {
  return (
    <div className="overview-action-stack overview-action-stack-muted">
      <button onClick={onRecommended} className="action-btn overview-inspector-primary-action justify-start">{recommendedLabel}</button>
      <button onClick={onSecondary} className="action-btn justify-start">{secondaryLabel}</button>
      {onOpenIntake ? <button onClick={onOpenIntake} className="action-btn justify-start">Open Intake</button> : null}
    </div>
  );
}
