import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpLaneContext, useFollowUpsViewModel } from '../../domains/followups';
import {
  AppBadge,
  ExecutionLaneQueueCard,
  ExecutionLaneSelectionStrip,
  ExecutionLaneSummary,
  ExecutionLaneHandoffStrip,
  ExecutionLaneFooterMeta,
  SectionHeader,
  WorkspacePage,
  WorkspacePrimaryLayout,
  WorkspaceTopStack,
} from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';
import { buildExecutionSelectedContext, describeHandoffMission, toExecutionLaneHandoff } from '../../domains/shared';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, openCreateModal, executionIntent, clearExecutionIntent, setSelectedId, executionMetrics, laneItems, lastExecutionRoute } = useFollowUpsViewModel();
  const laneContext = useFollowUpLaneContext();
  const [handoffSummary, setHandoffSummary] = useState<string | null>(null);
  const selectedExecution = laneItems.find((item) => item.surface.id === laneContext.selectedItem?.id) ?? null;
  const selectedContext = buildExecutionSelectedContext(selectedExecution?.surface ?? null, lastExecutionRoute);

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    const handoff = toExecutionLaneHandoff(executionIntent);
    setHandoffSummary(describeHandoffMission(handoff));
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack className="followup-top-stack">
        <ExecutionLaneSummary className="followup-summary-strip">
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
            <span className="workspace-support-copy">Shared metrics: due {executionMetrics.dueNow} · blocked {executionMetrics.blockedOrAtRisk} · waiting {executionMetrics.waiting}</span>
            {executionIntent?.target === 'followups' ? <span className="workspace-support-copy">{describeExecutionIntent(executionIntent)}</span> : null}
          </div>
        </ExecutionLaneSummary>
      </WorkspaceTopStack>
      <WorkspacePrimaryLayout className="tracker-main-grid" inspectorWidth="420px">
        <ExecutionLaneQueueCard className="tracker-workspace-main">
          <ControlBar />
          {handoffSummary ? <ExecutionLaneHandoffStrip title="Lane handoff" summary={handoffSummary} /> : null}
          <ExecutionLaneSelectionStrip
            title={laneContext.selectedItem?.title}
            helper={laneContext.selectedItem ? `Next move: ${selectedContext?.nextMove ?? laneContext.nextMove?.label ?? laneContext.recommendedNextMove}` : undefined}
            emptyMessage="Select a follow-up to review and act."
            badges={laneContext.selectedItem ? (
              <>
                {selectedContext?.topSignal ? <AppBadge tone={laneContext.attentionSignal?.tone === 'default' ? 'info' : laneContext.attentionSignal?.tone}>{selectedContext.topSignal}</AppBadge> : null}
                {laneContext.hasDuplicateAttention ? <AppBadge tone="warn">Possible duplicates</AppBadge> : null}
                {laneContext.closeoutEvaluation?.readiness === 'ready_to_close' ? <AppBadge tone="success">Ready to close</AppBadge> : null}
                {laneContext.linkedTaskSummary ? <AppBadge tone={laneContext.linkedTaskSummary.blocked > 0 ? 'danger' : 'info'}>Linked work {laneContext.linkedTaskSummary.open}/{laneContext.linkedTaskSummary.total}</AppBadge> : null}
              </>
            ) : null}
          />
          <TrackerTable
            personalMode={personalMode}
            appMode={appMode}
            embedded
            selectedAttentionSignal={laneContext.attentionSignal}
          />
          <DuplicateReviewPanel />
          <ExecutionLaneFooterMeta
            shownCount={followUpStats.total}
            selectedCount={laneContext.selectedItem ? 1 : 0}
            scopeSummary={personalMode ? 'Execution view' : 'Coordination view'}
            hint="Select → act → continue"
          />
        </ExecutionLaneQueueCard>
        <ItemDetailPanel personalMode={personalMode} />
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
