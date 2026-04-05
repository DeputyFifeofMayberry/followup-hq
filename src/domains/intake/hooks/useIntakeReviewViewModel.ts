import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildForwardedReviewQueue, buildQueueBucketCounts, buildQueueMetrics, filterReviewQueue, sortReviewQueue, type IntakeQueueFilters, type IntakeReviewBucket, type IntakeReviewSort } from '../../../lib/intakeReviewQueue';
import { buildIntakeTuningModel } from '../../../lib/intakeTuningModel';
import { buildIntakeTuningInsights } from '../../../lib/intakeTuningInsights';
import { buildForwardedFieldReviews, buildReviewerActionHints, summarizeFieldReviews } from '../../../lib/intakeEvidence';
import { evaluateForwardedImportSafety } from '../../../lib/intakeImportSafety';
import { buildIntakeReviewPlan } from '../../../lib/intakeReviewPlan';

interface IntakeReviewViewOptions {
  activeBucket: IntakeReviewBucket | 'all';
  sortKey: IntakeReviewSort;
  queueFilters: IntakeQueueFilters;
  activeCandidateId?: string | null;
}

export function useIntakeReviewViewModel({ activeBucket, sortKey, queueFilters, activeCandidateId }: IntakeReviewViewOptions) {
  const store = useAppStore(useShallow((s) => ({
    forwardedEmails: s.forwardedEmails,
    forwardedCandidates: s.forwardedCandidates,
    forwardedRules: s.forwardedRules,
    forwardedLedger: s.forwardedLedger,
    forwardedRoutingAudit: s.forwardedRoutingAudit,
    intakeReviewerFeedback: s.intakeReviewerFeedback,
    items: s.items,
    ingestForwardedEmailPayload: s.ingestForwardedEmailPayload,
    approveForwardedCandidate: s.approveForwardedCandidate,
    rejectForwardedCandidate: s.rejectForwardedCandidate,
    saveForwardedCandidateAsReference: s.saveForwardedCandidateAsReference,
    linkForwardedCandidateToExisting: s.linkForwardedCandidateToExisting,
    addForwardRuleFromCandidate: s.addForwardRuleFromCandidate,
    updateForwardRule: s.updateForwardRule,
    deleteForwardRule: s.deleteForwardRule,
    addManualForwardRule: s.addManualForwardRule,
  })));

  const tuningModel = useMemo(() => buildIntakeTuningModel({
    intakeWorkCandidates: [],
    forwardedCandidates: store.forwardedCandidates,
    forwardedRules: store.forwardedRules,
    forwardedRoutingAudit: store.forwardedRoutingAudit,
    feedback: store.intakeReviewerFeedback,
  }), [store.forwardedCandidates, store.forwardedRules, store.forwardedRoutingAudit, store.intakeReviewerFeedback]);

  const queue = useMemo(() => buildForwardedReviewQueue(store.forwardedCandidates, tuningModel), [store.forwardedCandidates, tuningModel]);
  const metrics = useMemo(() => buildQueueMetrics(queue), [queue]);
  const bucketCounts = useMemo(() => buildQueueBucketCounts(queue), [queue]);
  const filteredQueue = useMemo(() => {
    const base = filterReviewQueue(queue, queueFilters);
    const bucketed = activeBucket === 'all' ? base : base.filter((item) => item.bucket === activeBucket);
    return sortReviewQueue(bucketed, sortKey);
  }, [queue, queueFilters, activeBucket, sortKey]);

  const tuningInsights = useMemo(() => buildIntakeTuningInsights({
    intakeWorkCandidates: [],
    forwardedCandidates: store.forwardedCandidates,
    forwardedRules: store.forwardedRules,
    forwardedRoutingAudit: store.forwardedRoutingAudit,
    feedback: store.intakeReviewerFeedback,
  }), [store.forwardedCandidates, store.forwardedRules, store.forwardedRoutingAudit, store.intakeReviewerFeedback]);

  const pendingQueue = useMemo(() => filteredQueue.filter((item) => item.status === 'pending'), [filteredQueue]);
  const selectedQueueItem = pendingQueue.find((item) => item.id === activeCandidateId) ?? pendingQueue[0] ?? null;
  const selectedCandidate = store.forwardedCandidates.find((entry) => entry.id === selectedQueueItem?.id) ?? null;
  const selectedFieldSummary = useMemo(() => selectedCandidate ? summarizeFieldReviews(buildForwardedFieldReviews(selectedCandidate)) : null, [selectedCandidate]);
  const selectedSafety = useMemo(() => selectedCandidate ? evaluateForwardedImportSafety(selectedCandidate) : null, [selectedCandidate]);
  const selectedActionHints = useMemo(() => selectedFieldSummary ? buildReviewerActionHints(selectedFieldSummary) : [], [selectedFieldSummary]);
  const selectedReviewPlan = useMemo(() => {
    if (!selectedQueueItem || !selectedFieldSummary || !selectedSafety) return null;
    const tuningPressure = selectedQueueItem.alerts.some((alert) => ['tuning_review_pressure', 'tuning_due_date_guard', 'tuning_project_guard'].includes(alert.code));
    return buildIntakeReviewPlan({
      queueItem: selectedQueueItem,
      fieldSummary: selectedFieldSummary,
      safety: selectedSafety,
      tuningPressure,
    });
  }, [selectedQueueItem, selectedFieldSummary, selectedSafety]);

  const reviewLane = {
    queue,
    filteredQueue,
    metrics,
    bucketCounts,
    pendingQueue,
  };

  const supportPanels = {
    tuningModel,
    tuningInsights,
    forwardedLedger: store.forwardedLedger,
    forwardedRoutingAudit: store.forwardedRoutingAudit,
    forwardedRules: store.forwardedRules,
  };

  const mutations = {
    ingestForwardedEmailPayload: store.ingestForwardedEmailPayload,
    approveForwardedCandidate: store.approveForwardedCandidate,
    rejectForwardedCandidate: store.rejectForwardedCandidate,
    saveForwardedCandidateAsReference: store.saveForwardedCandidateAsReference,
    linkForwardedCandidateToExisting: store.linkForwardedCandidateToExisting,
    addForwardRuleFromCandidate: store.addForwardRuleFromCandidate,
    updateForwardRule: store.updateForwardRule,
    deleteForwardRule: store.deleteForwardRule,
    addManualForwardRule: store.addManualForwardRule,
  };

  return {
    forwardedEmails: store.forwardedEmails,
    forwardedCandidates: store.forwardedCandidates,
    items: store.items,
    reviewLane,
    supportPanels,
    mutations,
    selectedCandidate,
    selectedQueueItem,
    selectedFieldSummary,
    selectedSafety,
    selectedActionHints,
    selectedReviewPlan,
    selectedSuggestions: [],
    selectedBestMatch: null,
    selectedQuickFixes: selectedReviewPlan?.quickFixActions ?? [],
  };
}
