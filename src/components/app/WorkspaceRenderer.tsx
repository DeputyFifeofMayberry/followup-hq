import type { AppMode, SavedViewKey } from '../../types';
import { ExportWorkspace } from '../ExportWorkspace';
import { IntakeWorkspacePanel } from '../OutlookPanel';
import { DirectoryWorkspace } from '../DirectoryWorkspace';
import { TaskWorkspace } from '../TaskWorkspace';
import { OverviewPage } from '../OverviewPage';
import { TrackerWorkspace } from './TrackerWorkspace';
import { normalizeWorkspaceSelection } from '../../lib/workspaceRegistry';
import type { WorkspaceKey } from '../../lib/appModeConfig';

interface WorkspaceRendererProps {
  workspace: WorkspaceKey;
  appMode: AppMode;
  openTrackerView: (view: SavedViewKey, project?: string) => void;
  openTrackerItem: (itemId: string, view?: SavedViewKey, project?: string) => void;
  setWorkspace: (workspace: WorkspaceKey) => void;
}

export function WorkspaceRenderer({ workspace, appMode, openTrackerView, openTrackerItem, setWorkspace }: WorkspaceRendererProps) {
  void openTrackerView;
  switch (workspace) {
    case 'followups':
      return <TrackerWorkspace personalMode={appMode === 'personal'} appMode={appMode} />;
    case 'tasks':
      return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} personalMode={appMode === 'personal'} appMode={appMode} />;
    case 'exports':
      return <ExportWorkspace />;
    case 'intake':
      return <IntakeWorkspacePanel />;
    case 'directory':
      return <DirectoryWorkspace onOpenItem={(id) => openTrackerItem(id)} />;
    default:
      return (
        <OverviewPage
          onOpenWorkspace={(value) => setWorkspace(normalizeWorkspaceSelection(value)) as never}
          personalMode={appMode === 'personal'}
          appMode={appMode}
        />
      );
  }
}
