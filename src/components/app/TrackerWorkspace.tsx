import { useEffect, useState } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpsViewModel } from '../../domains/followups';
import {
  AppModal,
  AppModalBody,
  AppModalFooter,
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
import type { FollowUpItem } from '../../types';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const vm = useFollowUpsViewModel();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [hiddenIntentNotice, setHiddenIntentNotice] = useState<{ recordId: string } | null>(null);
  const [pendingDeleteFollowUp, setPendingDeleteFollowUp] = useState<FollowUpItem | null>(null);

  useEffect(() => {
    const intent = vm.executionIntent;
    if (!intent || intent.target !== 'followups') return;
    if (intent.recordType === 'followup' && intent.recordId) {
      const visibleInCurrentLane = vm.filteredRows.some((row) => row.id === intent.recordId);
      vm.setSelectedId(intent.recordId);
      if (visibleInCurrentLane) {
        setDetailModalOpen(true);
        setHiddenIntentNotice(null);
      } else {
        setDetailModalOpen(false);
        setHiddenIntentNotice({ recordId: intent.recordId });
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
                onRequestDelete={setPendingDeleteFollowUp}
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
      {pendingDeleteFollowUp ? (
        <AppModal onClose={() => setPendingDeleteFollowUp(null)} onBackdropClick={() => setPendingDeleteFollowUp(null)}>
          <AppModalHeader
            title="Delete follow-up"
            subtitle={`Permanently remove “${pendingDeleteFollowUp.title}”.`}
            onClose={() => setPendingDeleteFollowUp(null)}
          />
          <AppModalBody>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <div className="font-semibold">Delete this follow-up?</div>
              <p className="mt-1 text-xs">
                This removes <strong>{pendingDeleteFollowUp.title}</strong> from follow-up queues, linked summaries, and overview counts.
              </p>
            </div>
          </AppModalBody>
          <AppModalFooter>
            <button type="button" className="action-btn" onClick={() => setPendingDeleteFollowUp(null)}>Cancel</button>
            <button
              type="button"
              className="action-btn action-btn-danger"
              onClick={() => {
                vm.deleteItem(pendingDeleteFollowUp.id);
                setPendingDeleteFollowUp(null);
                if (vm.selectedId === pendingDeleteFollowUp.id) setDetailModalOpen(false);
              }}
            >
              Delete follow-up
            </button>
          </AppModalFooter>
        </AppModal>
      ) : null}
    </WorkspacePage>
  );
}
