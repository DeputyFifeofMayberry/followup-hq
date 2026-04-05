import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { getLinkedTasksForFollowUp, getRelatedRecordBundle } from '../../../lib/recordContext';
import { buildFollowUpChildRollup } from '../../../lib/childWorkRollups';
import { evaluateFollowUpCloseout } from '../../../lib/closeoutReadiness';
import { getWorkflowWarningsForRecord } from '../../../lib/workflowPolicy';
import { deriveFollowUpAttentionSignal } from '../helpers/attentionSignal';
import { deriveFollowUpNextMove } from '../helpers/nextMove';

export function useFollowUpLaneContext() {
  const store = useAppStore(useShallow((s) => ({
    selectedId: s.selectedId,
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    duplicateReviews: s.duplicateReviews,
  })));

  return useMemo(() => {
    const selectedItem = store.items.find((entry) => entry.id === store.selectedId) ?? null;

    if (!selectedItem) {
      return {
        selectedItem: null,
        selectedDuplicateReview: null,
        hasDuplicateAttention: false,
        linkedTaskSummary: null,
        closeoutEvaluation: null,
        workflowWarnings: [] as string[],
        recommendedNextMove: 'Select a follow-up to review and act.',
        nextMove: null,
        recommendedTone: 'default' as const,
        attentionSignal: null,
        relatedCounts: null,
        laneStateTags: [] as string[],
      };
    }

    const selectedDuplicateReview = store.duplicateReviews.find((review) => review.itemId === selectedItem.id) ?? null;
    const hasDuplicateAttention = !!selectedDuplicateReview && selectedDuplicateReview.candidates.length > 0;
    const linkedTasks = getLinkedTasksForFollowUp(selectedItem.id, store.tasks);
    const childRollup = buildFollowUpChildRollup(selectedItem.id, selectedItem.status, store.tasks);
    const closeoutEvaluation = evaluateFollowUpCloseout(selectedItem, store.tasks);
    const workflowWarnings = getWorkflowWarningsForRecord(selectedItem, { tasks: store.tasks });
    const relatedBundle = getRelatedRecordBundle({ type: 'followup', id: selectedItem.id }, store);
    const attentionSignal = deriveFollowUpAttentionSignal(selectedItem, {
      hasDuplicateAttention,
      childRollup,
      closeout: closeoutEvaluation,
      workflowWarnings,
    });
    const nextMove = deriveFollowUpNextMove(selectedItem, {
      hasDuplicateAttention,
      linkedTaskBlocked: childRollup.blockedByChildTasks,
      readyToClose: closeoutEvaluation.readiness === 'ready_to_close',
      attentionSignal,
    });

    const laneStateTags = [
      attentionSignal.tag,
      hasDuplicateAttention ? 'needs_duplicate_review' : 'no_duplicate_attention',
      childRollup.blockedByChildTasks ? 'blocked_by_children' : 'children_clear',
      closeoutEvaluation.readiness,
    ];

    return {
      selectedItem,
      selectedDuplicateReview,
      hasDuplicateAttention,
      linkedTaskSummary: {
        total: linkedTasks.length,
        open: childRollup.open,
        blocked: childRollup.blocked,
        overdue: childRollup.overdue,
        done: childRollup.done,
        summaryLabel: childRollup.summaryLabel,
      },
      closeoutEvaluation,
      workflowWarnings,
      recommendedNextMove: nextMove.label,
      nextMove,
      recommendedTone: nextMove.tone,
      attentionSignal,
      relatedCounts: relatedBundle.counts,
      laneStateTags,
    };
  }, [store]);
}
