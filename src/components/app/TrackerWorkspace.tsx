import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpLaneContext, useFollowUpsViewModel } from '../../domains/followups';
import {
  AppModal,
  AppModalBody,
  AppModalHeader,
  WorkspacePage,
} from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';
import { describeHandoffMission, toExecutionLaneHandoff } from '../../domains/shared';
import { useViewportBand } from '../../hooks/useViewport';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, executionIntent, clearExecutionIntent, setSelectedId } = useFollowUpsViewModel();
  const laneContext = useFollowUpLaneContext();
  const { isMobileLike, isPhone } = useViewportBand();
  const [handoffSummary, setHandoffSummary] = useState<string | null>(null);
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

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
      <div className="tracker-main-single">
        <div className="tracker-workspace-main app-shell-card">
          <ControlBar />
          <div className="workspace-toolbar-row px-3 pb-2 text-xs text-slate-600">
            <span>{followUpStats.total} visible · {followUpStats.needsNudge} need nudge · {followUpStats.readyToClose} ready to close</span>
            {!isPhone && executionIntent?.target === 'followups' ? <span>{describeExecutionIntent(executionIntent)}</span> : null}
          </div>
          {handoffSummary ? <div className="execution-lane-handoff-strip" role="status" aria-live="polite"><div className="execution-lane-handoff-summary">{handoffSummary}</div></div> : null}
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
        </div>
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
