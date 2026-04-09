import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpsViewModel } from '../../domains/followups';
import {
  AppModal,
  AppModalBody,
  AppModalHeader,
  ExecutionLaneInspectorCard,
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

  useEffect(() => {
    if (vm.executionIntent?.target !== 'followups') return;
    if (vm.executionIntent.recordType === 'followup' && vm.executionIntent.recordId) {
      vm.setSelectedId(vm.executionIntent.recordId);
      setDetailModalOpen(true);
    }
    vm.clearExecutionIntent();
  }, [vm.executionIntent, vm.clearExecutionIntent, vm.setSelectedId]);

  useEffect(() => {
    if (!vm.selectedFollowUp) {
      setDetailModalOpen(false);
    }
  }, [vm.selectedFollowUp?.id]);

  return (
    <WorkspacePage>
      <WorkspacePrimaryLayout inspectorWidth="430px">
        <div className="tracker-main-single">
          <div className="tracker-workspace-main app-shell-card">
            <ControlBar onOpenDuplicateReview={() => setDuplicateModalOpen(true)} duplicateCount={vm.duplicateCount} />
            <div className="followup-queue-summary" aria-live="polite">{vm.queueSummary}</div>
            <TrackerTable
              personalMode={personalMode}
              appMode={appMode}
              embedded
              rows={vm.filteredRows}
              onRowOpen={() => setDetailModalOpen(true)}
            />
          </div>
        </div>
        {detailModalOpen && vm.selectedFollowUp ? (
          <ExecutionLaneInspectorCard>
            <ItemDetailPanel personalMode={personalMode} onRequestClose={() => setDetailModalOpen(false)} />
          </ExecutionLaneInspectorCard>
        ) : null}
      </WorkspacePrimaryLayout>


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
