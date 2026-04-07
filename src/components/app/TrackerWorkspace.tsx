import { useEffect, useMemo, useState } from 'react';
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
import { useViewportBand } from '../../hooks/useViewport';
import { useAppStore } from '../../store/useAppStore';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { executionIntent, clearExecutionIntent, setSelectedId } = useFollowUpsViewModel();
  const laneContext = useFollowUpLaneContext();
  const duplicateReviews = useAppStore((s) => s.duplicateReviews);
  const { isMobileLike } = useViewportBand();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const duplicateCount = duplicateReviews.length;

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
      setDetailModalOpen(true);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  useEffect(() => {
    if (!laneContext.selectedItem) {
      setDetailModalOpen(false);
    }
  }, [laneContext.selectedItem?.id]);

  const tableSubtitle = useMemo(() => {
    if (!laneContext.selectedItem || !laneContext.attentionSignal) return 'Scan the queue and act on the next best record.';
    return `${laneContext.attentionSignal.label}: ${laneContext.selectedItem.title}`;
  }, [laneContext.selectedItem, laneContext.attentionSignal]);

  return (
    <WorkspacePage>
      <div className="tracker-main-single">
        <div className="tracker-workspace-main app-shell-card">
          <ControlBar onOpenDuplicateReview={() => setDuplicateModalOpen(true)} duplicateCount={duplicateCount} />
          <TrackerTable
            personalMode={personalMode}
            appMode={appMode}
            embedded
            selectedAttentionSignal={laneContext.attentionSignal}
            onRowOpen={() => setDetailModalOpen(true)}
            subtitle={tableSubtitle}
          />
        </div>
      </div>

      {!isMobileLike && detailModalOpen && laneContext.selectedItem ? (
        <AppModal size="inspector" onClose={() => setDetailModalOpen(false)} onBackdropClick={() => setDetailModalOpen(false)}>
          <AppModalHeader
            title="Follow-up"
            subtitle="What matters now, next action, and supporting context."
            onClose={() => setDetailModalOpen(false)}
          />
          <AppModalBody>
            <ItemDetailPanel personalMode={personalMode} inModal onRequestClose={() => setDetailModalOpen(false)} />
          </AppModalBody>
        </AppModal>
      ) : null}

      {duplicateModalOpen ? (
        <AppModal size="wide" onClose={() => setDuplicateModalOpen(false)} onBackdropClick={() => setDuplicateModalOpen(false)}>
          <AppModalHeader
            title="Duplicate review"
            subtitle="Resolve possible duplicate follow-ups when needed."
            onClose={() => setDuplicateModalOpen(false)}
          />
          <AppModalBody>
            <DuplicateReviewPanel />
          </AppModalBody>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
