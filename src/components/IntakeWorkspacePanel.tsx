import { UniversalIntakeWorkspace } from './UniversalIntakeWorkspace';
import { WorkspaceContentFrame, WorkspacePage } from './ui/AppPrimitives';

export function IntakeWorkspacePanel() {
  return (
    <WorkspacePage>
      <WorkspaceContentFrame variant="deck" className="space-y-3">
        <UniversalIntakeWorkspace />
      </WorkspaceContentFrame>
    </WorkspacePage>
  );
}
