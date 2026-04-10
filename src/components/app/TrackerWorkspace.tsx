import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpsViewModel } from '../../domains/followups';
import {
  AppModal,
  AppModalBody,
  AppModalHeader,
  WorkspaceContentFrame,
  ExecutionLaneInspectorCard,
  ExecutionLaneQueueCard,
  WorkspacePrimaryLayout,
  WorkspacePage,
} from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const vm = useFollowUpsViewModel();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [hiddenIntentNotice, setHiddenIntentNotice] = useState<{ recordId: string } | null>(null);

  useEffect(() => {
    if (vm.executionIntent?.target !== 'followups') return;
    if (vm.executionIntent.recordType === 'followup' && vm.executionIntent.recordId) {
      const visibleInCurrentLane = vm.filteredRows.some((row) => row.id === vm.executionIntent.recordId);
      vm.setSelectedId(vm.executionIntent.recordId);
      if (visibleInCurrentLane) {
        setDetailModalOpen(true);
        setHiddenIntentNotice(null);
      } else {
        setDetailModalOpen(false);
        setHiddenIntentNotice({ recordId: vm.executionIntent.recordId });
      }
    }
    vm.clearExecutionIntent();
  }, [vm.executionIntent, vm.clearExecutionIntent, vm.filteredRows, vm.setSelectedId]);

  useEffect(() => {
    if (!vm.selectedFollowUp) {
      setDetailModalOpen(false);
    }
  }, [vm.selectedFollowUp?.id]);

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        <WorkspacePrimaryLayout inspectorWidth="340px" className={detailModalOpen && vm.selectedFollowUp ? '' : 'workspace-primary-layout-collapsed'}>
          <div className="tracker-main-single">
            <ExecutionLaneQueueCard className="tracker-workspace-main">
              <ControlBar onOpenDuplicateReview={() => setDuplicateModalOpen(true)} duplicateCount={vm.duplicateCount} />
              {hiddenIntentNotice ? (
                <div className="followup-hidden-intent-notice" role="status">
                  <div>
                    New follow-up was created, but current filters are hiding it.
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => {
                      vm.resetAllRowAffectingOptions();
                      vm.setSelectedId(hiddenIntentNotice.recordId);
                      setDetailModalOpen(true);
                      setHiddenIntentNotice(null);
                    }}
                  >
                    Reveal follow-up
                  </button>
                </div>
              ) : null}
              <TrackerTable
                personalMode={personalMode}
                appMode={appMode}
                embedded
                rows={vm.filteredRows}
                onRowOpen={() => setDetailModalOpen(true)}
              />
            </ExecutionLaneQueueCard>
          </div>
          {detailModalOpen && vm.selectedFollowUp ? (
            <ExecutionLaneInspectorCard>
              <ItemDetailPanel personalMode={personalMode} onRequestClose={() => setDetailModalOpen(false)} />
            </ExecutionLaneInspectorCard>
          ) : null}
        </WorkspacePrimaryLayout>
      </WorkspaceContentFrame>


      {duplicateModalOpen ? (
        <AppModal size="wide" onClose={() => setDuplicateModalOpen(false)} onBackdropClick={() => setDuplicateModalOpen(false)}>
          <AppModalHeader
            title="Duplicate review"
            subtitle="Resolve possible duplicate follow-ups when needed."
            onClose={() => setDuplicateModalOpen(false)}
          />
          <AppModalBody>
            <DuplicateReviewPanel presentation="modal" />
          </AppModalBody>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
