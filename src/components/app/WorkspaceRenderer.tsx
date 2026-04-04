import type { AppMode, SavedViewKey } from '../../types';
import { ExportWorkspace } from '../ExportWorkspace';
import { OutlookPanel } from '../OutlookPanel';
import { ProjectCommandCenter } from '../ProjectCommandCenter';
import { RelationshipBoard } from '../RelationshipBoard';
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
  switch (workspace) {
    case 'followups':
      return <TrackerWorkspace personalMode={appMode === 'personal'} appMode={appMode} />;
    case 'tasks':
      return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} personalMode={appMode === 'personal'} appMode={appMode} />;
    case 'exports':
      return <ExportWorkspace />;
    case 'outlook':
      return <OutlookPanel showAdvanced={false} setWorkspace={setWorkspace} />;
    case 'projects':
      return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} appMode={appMode} setWorkspace={setWorkspace} />;
    case 'relationships':
      return <RelationshipBoard appMode={appMode} setWorkspace={setWorkspace} />;
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
