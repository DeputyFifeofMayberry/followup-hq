import type { AppMode, SavedViewKey } from '../../types';
import { IntakeWorkspacePanel } from '../IntakeWorkspacePanel';
import { DirectoryWorkspace } from '../DirectoryWorkspace';
import { TaskWorkspace } from '../TaskWorkspace';
import { OverviewPage } from '../OverviewPage';
import { TrackerWorkspace } from './TrackerWorkspace';
import { normalizeWorkspaceSelection } from '../../lib/workspaceRegistry';
import type { WorkspaceKey } from '../../lib/appModeConfig';
import { ReportsWorkspace } from '../reports/ReportsWorkspace';

interface WorkspaceRendererProps {
  workspace: WorkspaceKey;
  appMode: AppMode;
  openFollowUp: (itemId: string, view?: SavedViewKey, project?: string) => void;
  openTask: (taskId: string, project?: string) => void;
  setWorkspace: (workspace: WorkspaceKey) => void;
  openDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function WorkspaceRenderer({ workspace, appMode, openFollowUp, openTask, setWorkspace, openDirectoryRecord }: WorkspaceRendererProps) {
  switch (workspace) {
    case 'followups':
      return <TrackerWorkspace personalMode={appMode === 'personal'} />;
    case 'tasks':
      return <TaskWorkspace onOpenLinkedFollowUp={(id) => openFollowUp(id)} personalMode={appMode === 'personal'} />;
    case 'exports':
      return <ReportsWorkspace onOpenDirectoryRecord={openDirectoryRecord} onSetWorkspace={setWorkspace} />;
    case 'intake':
      return <IntakeWorkspacePanel />;
    case 'directory':
      return <DirectoryWorkspace onOpenFollowUp={(id) => openFollowUp(id)} onOpenTask={(id) => openTask(id)} onOpenDirectoryRecord={openDirectoryRecord} />;
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
