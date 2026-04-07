import { ChevronDown, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpLaneContext, useFollowUpsViewModel } from '../../domains/followups';
import {
  AppBadge,
  AppModal,
  AppModalBody,
  AppModalHeader,
  ExecutionLaneFooterMeta,
  ExecutionLaneQueueCard,
  ExecutionLaneSelectionStrip,
  SectionHeader,
  WorkspacePage,
  WorkspaceTopStack,
} from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';
import { buildExecutionSelectedContext, describeHandoffMission, toExecutionLaneHandoff } from '../../domains/shared';
import { useViewportBand } from '../../hooks/useViewport';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, openCreateModal, executionIntent, clearExecutionIntent, setSelectedId, executionMetrics, laneItems, lastExecutionRoute } = useFollowUpsViewModel();
  const laneContext = useFollowUpLaneContext();
  const { isMobileLike, isPhone } = useViewportBand();
  const [handoffSummary, setHandoffSummary] = useState<string | null>(null);
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const selectedExecution = laneItems.find((item) => item.surface.id === laneContext.selectedItem?.id) ?? null;
  const selectedContext = buildExecutionSelectedContext(selectedExecution?.surface ?? null, lastExecutionRoute);

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    const handoff = toExecutionLaneHandoff(executionIntent);
    setHandoffSummary(describeHandoffMission(handoff));
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
      setDetailModalOpen(true);
      setShowMobileDetail(true);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  useEffect(() => {
    if (!laneContext.selectedItem) {
      setDetailModalOpen(false);
      setShowMobileDetail(false);
    }
  }, [laneContext.selectedItem?.id]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack className="followup-top-stack">
        <section className="app-shell-card app-shell-card-hero followup-summary-strip">
          <SectionHeader
            title="Follow Ups"
            subtitle={personalMode ? 'One clear queue for commitments, nudges, and closeout.' : 'Team coordination queue for ownership, risks, and follow-through.'}
            actions={<button onClick={openCreateModal} className="primary-btn"><Sparkles className="h-4 w-4" />Add follow-up</button>}
            compact
          />
          <div className="workspace-toolbar-row followup-summary-meta-row">
            <span className="workspace-support-copy">{followUpStats.total} visible · {followUpStats.needsNudge} need nudge · {followUpStats.readyToClose} ready to close</span>
            {!isPhone ? <span className="workspace-support-copy">Due {executionMetrics.dueNow} · blocked {executionMetrics.blockedOrAtRisk} · waiting {executionMetrics.waiting}</span> : null}
            {executionIntent?.target === 'followups' ? <span className="workspace-support-copy">{describeExecutionIntent(executionIntent)}</span> : null}
          </div>
        </section>
      </WorkspaceTopStack>
      <div className="tracker-main-single">
        <ExecutionLaneQueueCard className="tracker-workspace-main">
          <ControlBar />
          {handoffSummary ? <div className="execution-lane-handoff-strip" role="status" aria-live="polite"><div className="execution-lane-handoff-summary">{handoffSummary}</div></div> : null}
          {!isMobileLike ? (
            <ExecutionLaneSelectionStrip
              title={laneContext.selectedItem?.title}
              helper={laneContext.selectedItem ? `Next move: ${selectedContext?.nextMove ?? laneContext.nextMove?.label ?? laneContext.recommendedNextMove}` : undefined}
              emptyMessage="Select a follow-up to review and act."
              badges={laneContext.selectedItem ? (
                <>
                  {selectedContext?.topSignal ? <AppBadge tone={laneContext.attentionSignal?.tone === 'default' ? 'info' : laneContext.attentionSignal?.tone}>{selectedContext.topSignal}</AppBadge> : null}
                  {laneContext.hasDuplicateAttention ? <AppBadge tone="warn">Possible duplicates</AppBadge> : null}
                  {laneContext.closeoutEvaluation?.readiness === 'ready_to_close' ? <AppBadge tone="success">Ready to close</AppBadge> : null}
                  {laneContext.linkedTaskSummary ? <AppBadge tone={laneContext.linkedTaskSummary.blocked > 0 ? 'danger' : 'info'}>Linked {laneContext.linkedTaskSummary.open}/{laneContext.linkedTaskSummary.total}</AppBadge> : null}
                </>
              ) : null}
            />
          ) : null}
          <TrackerTable
            personalMode={personalMode}
            appMode={appMode}
            embedded
            selectedAttentionSignal={laneContext.attentionSignal}
            onRowOpen={() => setDetailModalOpen(true)}
          />
          {isMobileLike && laneContext.selectedItem ? (
            <div className="tracker-mobile-detail-shell">
              <button onClick={() => setShowMobileDetail((value) => !value)} className="action-btn tracker-mobile-detail-toggle">
                {showMobileDetail ? 'Hide details' : 'Open details'}
                <ChevronDown className={`h-4 w-4 ${showMobileDetail ? 'rotate-180' : ''}`} />
              </button>
              {showMobileDetail ? <ItemDetailPanel personalMode={personalMode} /> : null}
            </div>
          ) : null}
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <button onClick={() => setShowDuplicateReview((value) => !value)} className="action-btn !px-2.5 !py-1 text-xs">
              <ChevronDown className={`h-3.5 w-3.5 ${showDuplicateReview ? 'rotate-180' : ''}`} />
              Duplicate review
              {laneContext.hasDuplicateAttention ? <AppBadge tone="warn">Needs review</AppBadge> : null}
            </button>
            {showDuplicateReview ? <div className="mt-2"><DuplicateReviewPanel /></div> : null}
          </div>
          {!isMobileLike ? (
            <ExecutionLaneFooterMeta
              shownCount={followUpStats.total}
              selectedCount={laneContext.selectedItem ? 1 : 0}
              scopeSummary={personalMode ? 'Execution view' : 'Coordination view'}
              hint="Scan → select → act"
            />
          ) : null}
        </ExecutionLaneQueueCard>
      </div>
      {!isMobileLike && detailModalOpen && laneContext.selectedItem ? (
        <AppModal size="inspector" onClose={() => setDetailModalOpen(false)} onBackdropClick={() => setDetailModalOpen(false)}>
          <AppModalHeader
            title="Follow-up details"
            subtitle="Review context and execute next action without leaving the queue."
            onClose={() => setDetailModalOpen(false)}
          />
          <AppModalBody>
            <ItemDetailPanel personalMode={personalMode} inModal onRequestClose={() => setDetailModalOpen(false)} />
          </AppModalBody>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
