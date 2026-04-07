import { UniversalIntakeWorkspace } from './UniversalIntakeWorkspace';

export function IntakeWorkspacePanel() {
  return (
    <div className="space-y-3">
      <UniversalIntakeWorkspace />
    </div>
  );
}

// Backward-compatible export while workspace keys still use `outlook` internally.
export const OutlookPanel = IntakeWorkspacePanel;
