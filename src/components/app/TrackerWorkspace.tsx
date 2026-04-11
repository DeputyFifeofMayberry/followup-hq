import { useEffect, useMemo, useState } from 'react';
import { useFollowUpsViewModel } from '../../domains/followups';
import {
  AppModal,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
  WorkspaceContentFrame,
  ExecutionLaneQueueCard,
  WorkspacePrimaryLayout,
  WorkspacePage,
} from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import type { FollowUpItem } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { FollowUpInspectorModal } from '../followups/FollowUpInspectorModal';
import { FollowUpActionFlow, type FollowUpFlowState } from '../followups/FollowUpActionFlow';
import { buildExecutionPatch, getDefaultExecutionDraft, type FollowUpExecutionActionId } from '../../domains/followups/helpers/executionActions';
import { resolveFollowUpInspectorProgression } from '../../domains/followups/helpers/executionProgression';
import { selectFollowUpRows } from '../../lib/followUpSelectors';

export function TrackerWorkspace({ personalMode }: { personalMode: boolean }) {
  const vm = useFollowUpsViewModel();
  const openRecordEditor = useAppStore((s) => s.openRecordEditor);
  const openFollowUpInspector = useAppStore((s) => s.openFollowUpInspector);
  const closeFollowUpInspector = useAppStore((s) => s.closeFollowUpInspector);
  const followUpInspector = useAppStore((s) => s.followUpInspector);
  const openRecordDrawer = useAppStore((s) => s.openRecordDrawer);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [revealNotice, setRevealNotice] = useState<string | null>(null);
  const [laneFeedback, setLaneFeedback] = useState<string | null>(null);
  const [pendingDeleteFollowUp, setPendingDeleteFollowUp] = useState<FollowUpItem | null>(null);
  const [flowState, setFlowState] = useState<FollowUpFlowState>(null);
  const [flowWarnings, setFlowWarnings] = useState<string[]>([]);
  const [flowBlockers, setFlowBlockers] = useState<string[]>([]);
  const [flowResult, setFlowResult] = useState<{ tone: 'success' | 'warn' | 'danger'; message: string } | null>(null);
  const [waitingOnDraft, setWaitingOnDraft] = useState('');
  const [nextTouchDraft, setNextTouchDraft] = useState('');
  const [snoozedUntilDraft, setSnoozedUntilDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [overrideClose, setOverrideClose] = useState(false);
  const [overrideAllowed, setOverrideAllowed] = useState(false);

  const selectedFollowUp = useMemo(
    () => vm.items.find((item) => item.id === followUpInspector.itemId) ?? null,
    [vm.items, followUpInspector.itemId],
  );

  const handlePostExecutionProgression = (recordId: string, actionLabel: string) => {
    const nextRows = selectFollowUpRows({
      items: useAppStore.getState().items,
      contacts: useAppStore.getState().contacts,
      companies: useAppStore.getState().companies,
      search: vm.search,
      activeView: vm.activeView,
      filters: vm.followUpFilters,
    });
    const nextIds = nextRows.map((row) => row.id);
    const stillVisible = nextIds.includes(recordId);
    const progression = resolveFollowUpInspectorProgression(nextIds, recordId, stillVisible);

    if (progression.nextId) {
      vm.setSelectedId(progression.nextId);
      openFollowUpInspector(progression.nextId, 'workspace');
      if (!stillVisible) {
        setLaneFeedback(`Applied ${actionLabel}. This follow-up moved out of the current queue; advanced to the next record.`);
      } else {
        setLaneFeedback(`Applied ${actionLabel}. Follow-up remains in this queue.`);
      }
    } else {
      vm.setSelectedId('');
      closeFollowUpInspector();
      setLaneFeedback(`Applied ${actionLabel}. No more follow-ups match this queue.`);
    }
  };

  const beginActionFlow = (action: FollowUpExecutionActionId, item: FollowUpItem) => {
    const defaults = getDefaultExecutionDraft(item, action);
    setFlowState({ action, itemId: item.id });
    setWaitingOnDraft(defaults.waitingOn || '');
    setNextTouchDraft(defaults.nextTouchDate || '');
    setSnoozedUntilDraft(defaults.snoozedUntilDate || '');
    setNoteDraft(defaults.note || '');
    setOverrideClose(false);
    setOverrideAllowed(false);
    setFlowWarnings([]);
    setFlowBlockers([]);
    setFlowResult(null);
  };

  const runExecutionAction = () => {
    if (!flowState) return;
    const item = vm.items.find((entry) => entry.id === flowState.itemId);
    if (!item) return;
    const draft = { waitingOn: waitingOnDraft, nextTouchDate: nextTouchDraft, snoozedUntilDate: snoozedUntilDraft, note: noteDraft, override: overrideClose };
    const execution = buildExecutionPatch(item, flowState.action, draft);

    if (execution.targetStatus) {
      const attempt = vm.attemptFollowUpTransition(flowState.itemId, execution.targetStatus, execution.patch, execution.override ? { override: true } : undefined);
      setFlowWarnings(attempt.validation.warnings);
      setFlowBlockers(attempt.validation.blockers);
      setOverrideAllowed(attempt.validation.overrideAllowed);
      if (!attempt.applied) {
        setFlowResult({ tone: 'danger', message: 'Action blocked. Resolve blockers and retry.' });
        return;
      }
      setFlowResult({ tone: attempt.validation.warnings.length ? 'warn' : 'success', message: 'Action applied.' });
    } else {
      if (flowState.action === 'mark_nudged') vm.markNudged(flowState.itemId);
      else if (flowState.action === 'log_touch') vm.openTouchModal();
      setFlowResult({ tone: 'success', message: 'Action applied.' });
    }

    setFlowState(null);
    handlePostExecutionProgression(flowState.itemId, flowState.action.replaceAll('_', ' '));
  };

  useEffect(() => {
    const intent = vm.executionIntent;
    if (!intent || intent.target !== 'followups') return;
    if (intent.recordType === 'followup' && intent.recordId) {
      const visibleInCurrentLane = vm.filteredRows.some((row) => row.id === intent.recordId);
      vm.setSelectedId(intent.recordId);
      openFollowUpInspector(intent.recordId, 'execution_intent');
      if (visibleInCurrentLane) {
        setRevealNotice(null);
      } else {
        vm.revealFollowUpRecord(intent.recordId);
        setRevealNotice('Queue filters were adjusted to show the requested follow-up.');
      }
    }
    vm.clearExecutionIntent();
  }, [vm.executionIntent, vm.clearExecutionIntent, vm.filteredRows, vm.setSelectedId, vm.revealFollowUpRecord, openFollowUpInspector]);

  return (
    <WorkspacePage>
      <WorkspaceContentFrame>
        <WorkspacePrimaryLayout className="workspace-primary-layout-collapsed">
          <div className="tracker-main-single">
            <ExecutionLaneQueueCard className="tracker-workspace-main">
              <ControlBar onOpenDuplicateReview={() => setDuplicateModalOpen(true)} duplicateCount={vm.duplicateCount} />
              {revealNotice ? <div className="followup-hidden-intent-notice" role="status">{revealNotice}</div> : null}
              {laneFeedback ? <div className="followup-hidden-intent-notice" role="status">{laneFeedback}</div> : null}
              <TrackerTable
                personalMode={personalMode}
                embedded
                rows={vm.filteredRows}
                onRowOpen={(id) => {
                  vm.setSelectedId(id);
                  openFollowUpInspector(id, 'workspace');
                }}
                onRequestDelete={setPendingDeleteFollowUp}
              />
            </ExecutionLaneQueueCard>
          </div>
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
                handlePostExecutionProgression(pendingDeleteFollowUp.id, 'delete');
              }}
            >
              Delete follow-up
            </button>
          </AppModalFooter>
        </AppModal>
      ) : null}

      <FollowUpInspectorModal
        open={followUpInspector.open}
        selectedFollowUp={selectedFollowUp}
        onClose={closeFollowUpInspector}
        onOpenRecordEditor={openRecordEditor}
        onOpenRecordDrawer={openRecordDrawer}
        onOpenTouchModal={() => vm.openTouchModal()}
        onMarkNudged={(id) => {
          vm.markNudged(id);
          handlePostExecutionProgression(id, 'mark nudged');
        }}
        onSnooze={(id, days) => {
          void days;
          const record = vm.items.find((entry) => entry.id === id);
          if (record) beginActionFlow('snooze', record);
        }}
        onStartActionFlow={beginActionFlow}
      />

      <FollowUpActionFlow
        flowState={flowState}
        waitingOnDraft={waitingOnDraft}
        nextTouchDraft={nextTouchDraft}
        snoozedUntilDraft={snoozedUntilDraft}
        noteDraft={noteDraft}
        overrideClose={overrideClose}
        warnings={flowWarnings}
        blockers={flowBlockers}
        result={flowResult}
        overrideAllowed={overrideAllowed}
        onCancel={() => setFlowState(null)}
        onConfirm={runExecutionAction}
        onWaitingOnChange={setWaitingOnDraft}
        onNextTouchChange={setNextTouchDraft}
        onSnoozedUntilChange={setSnoozedUntilDraft}
        onNoteChange={setNoteDraft}
        onOverrideCloseChange={setOverrideClose}
      />
    </WorkspacePage>
  );
}
