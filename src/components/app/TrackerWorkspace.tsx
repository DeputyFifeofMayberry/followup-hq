import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpLaneContext, useFollowUpsViewModel } from '../../domains/followups';
import { WorkspacePage, WorkspaceTopStack, WorkspaceSummaryStrip, SectionHeader, WorkspacePrimaryLayout, AppShellCard, AppBadge } from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, openCreateModal, executionIntent, clearExecutionIntent, setSelectedId } = useFollowUpsViewModel();
  const laneContext = useFollowUpLaneContext();

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack className="followup-top-stack">
        <WorkspaceSummaryStrip className="followup-summary-strip">
          <SectionHeader
            title="Follow-up execution lane"
            subtitle={personalMode ? 'Scan queue → pick next move → act.' : 'Team queue tuned for fast assignment and follow-through.'}
            actions={<button onClick={openCreateModal} className="primary-btn"><Sparkles className="h-4 w-4" />Add follow-up</button>}
            compact
          />
          <div className="workspace-toolbar-row followup-summary-meta-row">
            <span className="workspace-support-copy">
              {followUpStats.total} visible · {followUpStats.needsNudge} need nudge · {followUpStats.atRisk} at risk · {followUpStats.readyToClose} ready to close
            </span>
            {executionIntent?.target === 'followups' ? <span className="workspace-support-copy">{describeExecutionIntent(executionIntent)}</span> : null}
          </div>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>
      <WorkspacePrimaryLayout className="tracker-main-grid" inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel tracker-workspace-main" surface="data">
          <ControlBar />
          <div className="followup-selected-context-strip">
            {!laneContext.selectedItem ? (
              <div className="followup-selected-context-empty">Select a follow-up to review and act.</div>
            ) : (
              <>
                <div>
                  <div className="followup-selected-kicker">Selected follow-up</div>
                  <div className="followup-selected-title">{laneContext.selectedItem.title}</div>
                  <div className="followup-selected-helper">Next move: {laneContext.nextMove?.label ?? laneContext.recommendedNextMove}</div>
                </div>
                <div className="followup-selected-signals">
                  {laneContext.attentionSignal ? <AppBadge tone={laneContext.attentionSignal.tone === 'default' ? 'info' : laneContext.attentionSignal.tone}>{laneContext.attentionSignal.label}</AppBadge> : null}
                  {laneContext.hasDuplicateAttention ? <AppBadge tone="warn">Possible duplicates</AppBadge> : null}
                  {laneContext.closeoutEvaluation?.readiness === 'ready_to_close' ? <AppBadge tone="success">Ready to close</AppBadge> : null}
                  {laneContext.linkedTaskSummary ? <AppBadge tone={laneContext.linkedTaskSummary.blocked > 0 ? 'danger' : 'info'}>Linked work {laneContext.linkedTaskSummary.open}/{laneContext.linkedTaskSummary.total}</AppBadge> : null}
                </div>
              </>
            )}
          </div>
          <TrackerTable
            personalMode={personalMode}
            appMode={appMode}
            embedded
            selectedAttentionSignal={laneContext.attentionSignal}
          />
          <DuplicateReviewPanel />
        </AppShellCard>
        <ItemDetailPanel personalMode={personalMode} />
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
