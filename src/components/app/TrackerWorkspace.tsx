import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpsViewModel } from '../../domains/followups';
import { WorkspacePage, WorkspaceTopStack, WorkspaceSummaryStrip, SectionHeader, WorkspacePrimaryLayout, AppShellCard } from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, openCreateModal, executionIntent, clearExecutionIntent, setSelectedId } = useFollowUpsViewModel();

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <WorkspaceSummaryStrip className="overview-hero-card">
          <SectionHeader title="Follow-up execution lane" subtitle={personalMode ? 'Single-lane queue for daily follow-through.' : 'Team queue streamlined for fast follow-through.'} actions={<button onClick={openCreateModal} className="primary-btn"><Sparkles className="h-4 w-4" />Add follow-up</button>} compact />
          <div className="workspace-toolbar-row overview-support-row">
            <span className="overview-inline-guidance">{followUpStats.total} visible · {followUpStats.needsNudge} need nudge · {followUpStats.atRisk} at risk · {followUpStats.readyToClose} ready to close.</span>
            {executionIntent?.target === 'followups' ? <span className="overview-inline-guidance">{describeExecutionIntent(executionIntent)}</span> : null}
          </div>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>
      <WorkspacePrimaryLayout className="tracker-main-grid" inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel tracker-workspace-main" surface="data">
          <ControlBar compact />
          <TrackerTable personalMode={personalMode} appMode={appMode} embedded />
          <DuplicateReviewPanel />
        </AppShellCard>
        <ItemDetailPanel personalMode={personalMode} />
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
