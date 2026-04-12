import { buildForwardedFieldReviews, buildWorkCandidateFieldReviews, summarizeFieldReviews } from './intakeEvidence';
import { evaluateForwardedImportSafety, evaluateIntakeImportSafety } from './intakeImportSafety';
import type { ForwardedIntakeCandidate, ForwardedRoutingAuditEntry, IntakeAssetRecord, IntakeBatchRecord, IntakeReviewerFeedback, IntakeWorkCandidate } from '../types';
import { buildIntakeTuningModel, type IntakeTuningModel } from './intakeTuningModel';
import { evaluateIntakeDecisionPolicy, ruleIdsForForwardedCandidate, type IntakeDecisionPolicyResult } from './intakeDecisionPolicy';
import { resolveCandidateAdmissionState, type IntakeAdmissionState } from './intakeAdmission';

export type IntakeReviewBucket = 'auto_resolved' | 'ready_to_approve' | 'needs_correction' | 'link_duplicate_review' | 'reference_likely' | 'finalized_history';
export type IntakeReviewSort = 'highest_confidence' | 'lowest_confidence' | 'most_missing_fields' | 'newest' | 'duplicate_risk_first';
export type IntakeConfidenceTier = 'high' | 'medium' | 'low';

export interface IntakeReviewerAlert {
  code: 'missing_due_date' | 'missing_project' | 'weak_owner_detection' | 'conflicting_type_inference' | 'duplicate_risk' | 'likely_reference_only' | 'weak_parse_quality' | 'needs_link_decision' | 'tuning_review_pressure' | 'tuning_due_date_guard' | 'tuning_project_guard';
  label: string;
  tone: 'warn' | 'danger' | 'neutral' | 'blue';
}

export interface IntakeQueueItem {
  id: string;
  title: string;
  status: 'pending' | 'finalized';
  bucket: IntakeReviewBucket;
  confidence: number;
  confidenceTier: IntakeConfidenceTier;
  candidateType: string;
  sourceType: string;
  parseStatus?: string;
  parseQuality?: 'strong' | 'partial' | 'weak' | 'failed';
  admissionState: IntakeAdmissionState;
  duplicateRisk: boolean;
  missingCriticalFields: number;
  conflictingEvidence: boolean;
  recommendedAction: string;
  batchSafe: boolean;
  batchExclusionReasons: string[];
  alerts: IntakeReviewerAlert[];
  sortDate: string;
  readiness: 'ready_to_approve' | 'ready_after_correction' | 'needs_link_decision' | 'reference_likely' | 'unsafe_to_create' | 'manual_review_required';
  priorityScore: number;
  nextStepHint: string;
  decisionPolicy: IntakeDecisionPolicyResult;
  triageCategory: 'auto_resolved' | 'ready_now' | 'needs_correction' | 'link_review' | 'reference_likely' | 'manual_review';
}

export interface IntakeQueueFilters {
  sourceType?: string;
  candidateType?: string;
  confidenceTier?: IntakeConfidenceTier | 'any';
  duplicateRisk?: 'all' | 'only';
  missingFields?: 'all' | 'only';
  conflictingFields?: 'all' | 'only';
  parseStatus?: string;
  pendingState?: 'all' | 'pending' | 'finalized';
  batchSafeOnly?: boolean;
}

const REVIEW_BUCKET_ORDER: IntakeReviewBucket[] = ['auto_resolved', 'ready_to_approve', 'needs_correction', 'link_duplicate_review', 'reference_likely', 'finalized_history'];

const SCORE_BY_BUCKET: Record<IntakeReviewBucket, number> = {
  auto_resolved: 5,
  ready_to_approve: 4,
  needs_correction: 3,
  link_duplicate_review: 2,
  reference_likely: 1,
  finalized_history: 0,
};

function readinessToPriority(readiness: IntakeQueueItem['readiness']): number {
  if (readiness === 'manual_review_required') return 115;
  if (readiness === 'unsafe_to_create') return 120;
  if (readiness === 'needs_link_decision') return 110;
  if (readiness === 'ready_after_correction') return 90;
  if (readiness === 'ready_to_approve') return 70;
  return 50;
}

function getNextStepHint(input: {
  readiness: IntakeQueueItem['readiness'];
  missingCriticalFields: number;
  conflictingEvidence: boolean;
  duplicateRisk: boolean;
  likelyReference: boolean;
  tuningEscalation?: boolean;
}): string {
  if (input.tuningEscalation) return 'Recent reviewer corrections are elevated here; review before approving.';
  if (input.readiness === 'manual_review_required') return 'Interpret recovered source first; this intake is not action-ready yet.';
  if (input.readiness === 'needs_link_decision' || input.duplicateRisk) return 'Compare top match and link if same work.';
  if (input.likelyReference || input.readiness === 'reference_likely') return 'Save as reference unless actionable work is explicit.';
  if (input.conflictingEvidence) return 'Resolve conflicting field signals before approval.';
  if (input.missingCriticalFields > 0) return 'Fill missing critical fields (type/title/project/owner/due date).';
  if (input.readiness === 'ready_to_approve') return 'Approve now and move to next.';
  return 'Quick-check weak fields, then decide.';
}

function confidenceTier(score: number): IntakeConfidenceTier {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

function sourceKey(sourceType: string): 'quick_capture' | 'universal_intake' | 'forwarding' | 'forwarded_email' {
  if (sourceType === 'quick_capture') return 'quick_capture';
  if (sourceType === 'forwarded_email') return 'forwarded_email';
  return 'universal_intake';
}

function tuningReviewPressure(model: IntakeTuningModel, source: string): boolean {
  return !!model.thresholds.forceReviewBySource[sourceKey(source)];
}

export function buildIntakeReviewQueue(
  candidates: IntakeWorkCandidate[],
  assets: IntakeAssetRecord[],
  batches: IntakeBatchRecord[] = [],
  tuningModel?: IntakeTuningModel,
  feedback: IntakeReviewerFeedback[] = [],
): IntakeQueueItem[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const archivedBatchIds = new Set(batches.filter((batch) => batch.status === 'archived').map((batch) => batch.id));

  return candidates.filter((candidate) => !archivedBatchIds.has(candidate.batchId)).map((candidate) => {
    const asset = assetsById.get(candidate.assetId);
    const model = tuningModel;
    const fieldSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(candidate));
    const safety = evaluateIntakeImportSafety(candidate);
    const missingCriticalFields = safety.criticalFieldAssessments.filter((assessment) => (
      ['title', 'type', 'project', 'owner', 'dueDate'].includes(assessment.key)
      && ['missing', 'weak', 'conflicting'].includes(assessment.strength)
    )).length;
    const conflictingEvidence = fieldSummary.conflicting.length > 0
      || candidate.warnings.some((warning) => /conflict|ambiguous|mismatch|unclear/i.test(warning))
      || safety.criticalFieldAssessments.some((assessment) => assessment.strength === 'conflicting');
    const duplicateRisk = safety.duplicateRiskLevel !== 'low';
    const admissionState = resolveCandidateAdmissionState(candidate);
    const likelyReference = candidate.candidateType === 'reference' || candidate.suggestedAction === 'reference_only' || safety.recommendedDecision === 'save_reference';
    const status = candidate.approvalStatus === 'pending' ? 'pending' : 'finalized';
    const hasCriticalBlockers = safety.blockers.length > 0 || conflictingEvidence;
    const dueDateField = fieldSummary.priorityReviewFields.find((field) => field.key === 'dueDate');
    const projectField = fieldSummary.priorityReviewFields.find((field) => field.key === 'project');
    const tuneReviewPressure = model ? tuningReviewPressure(model, asset?.kind ?? 'universal_intake') : false;
    const dueDateGuard = !!model?.thresholds.requireStrongDueDateEvidence && (!dueDateField || dueDateField.status !== 'strong');
    const projectGuard = !!model?.thresholds.requireStrongProjectEvidence && (!projectField || !['strong', 'medium'].includes(projectField.status));

    const alerts: IntakeReviewerAlert[] = [];
    if (!candidate.dueDate) alerts.push({ code: 'missing_due_date', label: 'Missing due date', tone: 'warn' });
    if (!candidate.project) alerts.push({ code: 'missing_project', label: 'Missing project', tone: 'warn' });
    if (!candidate.owner && !candidate.assignee) alerts.push({ code: 'weak_owner_detection', label: 'Weak owner detection', tone: 'warn' });
    if (conflictingEvidence) alerts.push({ code: 'conflicting_type_inference', label: 'Conflicting evidence', tone: 'danger' });
    if (duplicateRisk) alerts.push({ code: 'duplicate_risk', label: 'Duplicate risk', tone: 'danger' });
    if (likelyReference) alerts.push({ code: 'likely_reference_only', label: 'Likely reference only', tone: 'neutral' });
    if (asset?.parseQuality === 'weak' || asset?.parseQuality === 'failed') alerts.push({ code: 'weak_parse_quality', label: 'Weak parse quality', tone: 'warn' });
    if (admissionState !== 'action_ready') alerts.push({ code: 'weak_parse_quality', label: 'Admission requires interpretation', tone: 'warn' });
    if (candidate.existingRecordMatches.length > 0) alerts.push({ code: 'needs_link_decision', label: 'Needs link decision', tone: 'blue' });
    if (tuneReviewPressure) alerts.push({ code: 'tuning_review_pressure', label: 'Source has elevated review pressure', tone: 'warn' });
    if (dueDateGuard) alerts.push({ code: 'tuning_due_date_guard', label: 'Due date evidence guard is active', tone: 'warn' });
    if (projectGuard) alerts.push({ code: 'tuning_project_guard', label: 'Project mapping guard is active', tone: 'warn' });

    const minReadyConfidence = model?.thresholds.minimumReadyConfidence ?? 0.75;
    const minBatchSafeConfidence = model?.thresholds.minimumBatchSafeConfidence ?? 0.82;
    const policy = evaluateIntakeDecisionPolicy({
      kind: 'work',
      candidate,
      fieldSummary,
      safety,
      tuningModel: model,
      feedback,
      ruleIds: [],
    });

    const batchSafe = status === 'pending'
      && admissionState === 'action_ready'
      && safety.safeToBatchApprove
      && !likelyReference
      && !conflictingEvidence
      && missingCriticalFields === 0
      && asset?.parseQuality !== 'weak'
      && asset?.parseQuality !== 'failed'
      && candidate.confidence >= minBatchSafeConfidence
      && !tuneReviewPressure
      && !dueDateGuard
      && !projectGuard
      && policy.requiredReviewLevel !== 'manual_required'
      && policy.requiredReviewLevel !== 'correction_required';

    const readiness: IntakeQueueItem['readiness'] = status === 'finalized'
      ? 'ready_to_approve'
      : likelyReference
        ? 'reference_likely'
        : admissionState !== 'action_ready'
          ? 'manual_review_required'
        : hasCriticalBlockers
          ? 'unsafe_to_create'
          : !safety.safeToCreateNew
            ? 'ready_after_correction'
            : duplicateRisk || (model?.thresholds.duplicateCautionBoost && candidate.existingRecordMatches.length > 0)
            ? 'needs_link_decision'
            : missingCriticalFields > 0
              || candidate.confidence < minReadyConfidence
              || asset?.parseQuality === 'weak'
              || asset?.parseQuality === 'failed'
              || dueDateGuard
              || projectGuard
              || tuneReviewPressure
              ? 'ready_after_correction'
              : 'ready_to_approve';

    const bucket: IntakeReviewBucket = status === 'finalized'
      ? 'finalized_history'
      : policy.decisionMode === 'auto_resolve'
        ? 'auto_resolved'
      : readiness === 'reference_likely'
        ? 'reference_likely'
        : readiness === 'needs_link_decision'
          ? 'link_duplicate_review'
          : readiness === 'ready_after_correction' || readiness === 'unsafe_to_create' || readiness === 'manual_review_required'
            ? 'needs_correction'
            : 'ready_to_approve';

    const priorityScore = (status === 'pending' ? 1000 : 0)
      + readinessToPriority(readiness)
      + (missingCriticalFields * 6)
      + (conflictingEvidence ? 12 : 0)
      + (duplicateRisk ? 10 : 0)
      + (readiness === 'ready_to_approve' && missingCriticalFields === 0 && !duplicateRisk ? 8 : 0)
      + (asset?.parseQuality === 'failed' ? 10 : asset?.parseQuality === 'weak' ? 6 : 0)
      + (tuneReviewPressure ? 10 : 0)
      + (dueDateGuard ? 6 : 0)
      + (projectGuard ? 6 : 0)
      + Math.round((1 - candidate.confidence) * 10);
    const triageCategory: IntakeQueueItem['triageCategory'] = policy.decisionMode === 'auto_resolve'
      ? 'auto_resolved'
      : admissionState !== 'action_ready'
        ? 'manual_review'
      : policy.decisionMode === 'ready_now'
        ? 'ready_now'
        : policy.decisionMode === 'link_review_first'
          ? 'link_review'
          : policy.decisionMode === 'reference_lane'
            ? 'reference_likely'
            : policy.decisionMode === 'manual_review'
              ? 'manual_review'
              : 'needs_correction';

    return {
      id: candidate.id,
      title: candidate.title,
      status,
      bucket,
      confidence: candidate.confidence,
      confidenceTier: confidenceTier(candidate.confidence),
      candidateType: candidate.candidateType,
      sourceType: asset?.kind ?? 'unknown',
      parseStatus: asset?.parseStatus,
      parseQuality: asset?.parseQuality,
      admissionState,
      duplicateRisk,
      missingCriticalFields,
      conflictingEvidence,
      recommendedAction: safety.recommendedDecision,
      batchSafe,
      batchExclusionReasons: safety.batchExclusionReasons,
      alerts,
      sortDate: candidate.updatedAt || candidate.createdAt,
      readiness,
      priorityScore,
      nextStepHint: getNextStepHint({ readiness, missingCriticalFields, conflictingEvidence, duplicateRisk, likelyReference, tuningEscalation: tuneReviewPressure || dueDateGuard || projectGuard }),
      decisionPolicy: policy,
      triageCategory,
    };
  });
}

export function buildForwardedReviewQueue(
  candidates: ForwardedIntakeCandidate[],
  tuningModel?: IntakeTuningModel,
  feedback: IntakeReviewerFeedback[] = [],
  routingAudit: ForwardedRoutingAuditEntry[] = [],
): IntakeQueueItem[] {
  return candidates.map((candidate) => {
    const fieldSummary = summarizeFieldReviews(buildForwardedFieldReviews(candidate));
    const safety = evaluateForwardedImportSafety(candidate);
    const duplicateRisk = safety.duplicateRiskLevel !== 'low';
    const missingCriticalFields = fieldSummary.priorityReviewFields.filter((field) => ['missing', 'weak'].includes(field.status)).length;
    const conflictingEvidence = candidate.warnings.some((warning) => /conflict|ambiguous|mismatch|unclear/i.test(warning));
    const likelyReference = candidate.suggestedType === 'reference';
    const status = candidate.status === 'pending' ? 'pending' : 'finalized';
    const hasCriticalBlockers = safety.blockers.length > 0 || conflictingEvidence;
    const dueDateField = fieldSummary.priorityReviewFields.find((field) => field.key === 'dueDate');
    const projectField = fieldSummary.priorityReviewFields.find((field) => field.key === 'project');

    const tuneReviewPressure = tuningModel ? tuningReviewPressure(tuningModel, 'forwarded_email') : false;
    const dueDateGuard = !!tuningModel?.thresholds.requireStrongDueDateEvidence && (!dueDateField || dueDateField.status !== 'strong');
    const projectGuard = !!tuningModel?.thresholds.requireStrongProjectEvidence && (!projectField || !['strong', 'medium'].includes(projectField.status));

    const alerts: IntakeReviewerAlert[] = [];
    if (!candidate.parsedProject) alerts.push({ code: 'missing_project', label: 'Missing project', tone: 'warn' });
    if (!candidate.reasons.some((reason) => /owner|assigned|sender/i.test(reason))) alerts.push({ code: 'weak_owner_detection', label: 'Weak owner detection', tone: 'warn' });
    if (!candidate.reasons.some((reason) => /due|date|deadline|tomorrow|today|friday/i.test(reason))) alerts.push({ code: 'missing_due_date', label: 'Missing due date', tone: 'warn' });
    if (duplicateRisk) alerts.push({ code: 'duplicate_risk', label: 'Duplicate risk', tone: 'danger' });
    if (conflictingEvidence) alerts.push({ code: 'conflicting_type_inference', label: 'Conflicting evidence', tone: 'danger' });
    if (likelyReference) alerts.push({ code: 'likely_reference_only', label: 'Likely reference only', tone: 'neutral' });
    if (candidate.parseQuality === 'weak') alerts.push({ code: 'weak_parse_quality', label: 'Weak parse quality', tone: 'warn' });
    if (tuneReviewPressure) alerts.push({ code: 'tuning_review_pressure', label: 'Forwarding source under review pressure', tone: 'warn' });
    if (dueDateGuard) alerts.push({ code: 'tuning_due_date_guard', label: 'Due date evidence guard is active', tone: 'warn' });
    if (projectGuard) alerts.push({ code: 'tuning_project_guard', label: 'Project mapping guard is active', tone: 'warn' });

    const minReadyConfidence = tuningModel?.thresholds.minimumReadyConfidence ?? 0.75;
    const minBatchSafeConfidence = tuningModel?.thresholds.minimumBatchSafeConfidence ?? 0.82;
    const policy = evaluateIntakeDecisionPolicy({
      kind: 'forwarded',
      candidate,
      fieldSummary,
      safety,
      tuningModel,
      feedback,
      ruleIds: ruleIdsForForwardedCandidate(candidate, routingAudit),
    });

    const batchSafe = status === 'pending'
      && safety.safeToBatchApprove
      && candidate.parseQuality === 'strong'
      && !conflictingEvidence
      && !likelyReference
      && missingCriticalFields === 0
      && candidate.confidence >= minBatchSafeConfidence
      && !tuneReviewPressure
      && !dueDateGuard
      && !projectGuard
      && policy.requiredReviewLevel !== 'manual_required'
      && policy.requiredReviewLevel !== 'correction_required';

    const readiness: IntakeQueueItem['readiness'] = status === 'finalized'
      ? 'ready_to_approve'
      : likelyReference
        ? 'reference_likely'
        : hasCriticalBlockers
          ? 'unsafe_to_create'
          : duplicateRisk
            ? 'needs_link_decision'
            : missingCriticalFields > 0
              || candidate.parseQuality !== 'strong'
              || candidate.confidence < minReadyConfidence
              || tuneReviewPressure
              || dueDateGuard
              || projectGuard
              ? 'ready_after_correction'
              : 'ready_to_approve';

    const bucket: IntakeReviewBucket = status === 'finalized'
      ? 'finalized_history'
      : policy.decisionMode === 'auto_resolve'
        ? 'auto_resolved'
      : readiness === 'reference_likely'
        ? 'reference_likely'
        : readiness === 'needs_link_decision'
          ? 'link_duplicate_review'
          : readiness === 'ready_after_correction' || readiness === 'unsafe_to_create'
            ? 'needs_correction'
            : 'ready_to_approve';

    const priorityScore = (status === 'pending' ? 1000 : 0)
      + readinessToPriority(readiness)
      + (missingCriticalFields * 6)
      + (conflictingEvidence ? 12 : 0)
      + (duplicateRisk ? 10 : 0)
      + (readiness === 'ready_to_approve' && missingCriticalFields === 0 && !duplicateRisk ? 8 : 0)
      + (candidate.parseQuality === 'weak' ? 6 : 0)
      + (tuneReviewPressure ? 10 : 0)
      + (dueDateGuard ? 6 : 0)
      + (projectGuard ? 6 : 0)
      + Math.round((1 - candidate.confidence) * 10);
    const triageCategory: IntakeQueueItem['triageCategory'] = policy.decisionMode === 'auto_resolve'
      ? 'auto_resolved'
      : policy.decisionMode === 'ready_now'
        ? 'ready_now'
        : policy.decisionMode === 'link_review_first'
          ? 'link_review'
          : policy.decisionMode === 'reference_lane'
            ? 'reference_likely'
            : policy.decisionMode === 'manual_review'
              ? 'manual_review'
              : 'needs_correction';

    return {
      id: candidate.id,
      title: candidate.normalizedSubject,
      status,
      bucket,
      confidence: candidate.confidence,
      confidenceTier: confidenceTier(candidate.confidence),
      candidateType: candidate.suggestedType,
      sourceType: 'forwarded_email',
      parseQuality: candidate.parseQuality,
      admissionState: 'action_ready',
      duplicateRisk,
      missingCriticalFields,
      conflictingEvidence,
      recommendedAction: safety.recommendedDecision,
      batchSafe,
      batchExclusionReasons: safety.batchExclusionReasons,
      alerts,
      sortDate: candidate.updatedAt || candidate.createdAt,
      readiness,
      priorityScore,
      nextStepHint: getNextStepHint({ readiness, missingCriticalFields, conflictingEvidence, duplicateRisk, likelyReference, tuningEscalation: tuneReviewPressure || dueDateGuard || projectGuard }),
      decisionPolicy: policy,
      triageCategory,
    };
  });
}

export function buildTuningAwareReviewQueue(input: {
  intakeWorkCandidates: IntakeWorkCandidate[];
  intakeAssets: IntakeAssetRecord[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  feedback: IntakeReviewerFeedback[];
}): { queue: IntakeQueueItem[]; tuningModel: IntakeTuningModel } {
  const tuningModel = buildIntakeTuningModel({
    intakeWorkCandidates: input.intakeWorkCandidates,
    forwardedCandidates: input.forwardedCandidates,
    forwardedRules: [],
    forwardedRoutingAudit: [],
    feedback: input.feedback,
  });
  return { queue: buildIntakeReviewQueue(input.intakeWorkCandidates, input.intakeAssets, [], tuningModel, input.feedback), tuningModel };
}

export function filterReviewQueue(queue: IntakeQueueItem[], filters: IntakeQueueFilters): IntakeQueueItem[] {
  return queue.filter((item) => {
    if (filters.pendingState && filters.pendingState !== 'all' && item.status !== filters.pendingState) return false;
    if (filters.sourceType && filters.sourceType !== 'all' && item.sourceType !== filters.sourceType) return false;
    if (filters.candidateType && filters.candidateType !== 'all' && item.candidateType !== filters.candidateType) return false;
    if (filters.confidenceTier && filters.confidenceTier !== 'any' && item.confidenceTier !== filters.confidenceTier) return false;
    if (filters.duplicateRisk === 'only' && !item.duplicateRisk) return false;
    if (filters.missingFields === 'only' && item.missingCriticalFields === 0) return false;
    if (filters.conflictingFields === 'only' && !item.conflictingEvidence) return false;
    if (filters.parseStatus && filters.parseStatus !== 'all' && item.parseStatus !== filters.parseStatus) return false;
    if (filters.batchSafeOnly && !item.batchSafe) return false;
    return true;
  });
}

export function sortReviewQueue(queue: IntakeQueueItem[], sort: IntakeReviewSort): IntakeQueueItem[] {
  return [...queue].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
    if (a.bucket !== b.bucket) return SCORE_BY_BUCKET[b.bucket] - SCORE_BY_BUCKET[a.bucket];

    if (sort === 'highest_confidence') return b.confidence - a.confidence;
    if (sort === 'lowest_confidence') return a.confidence - b.confidence;
    if (sort === 'most_missing_fields') return b.missingCriticalFields - a.missingCriticalFields;
    if (sort === 'duplicate_risk_first') {
      if (a.duplicateRisk !== b.duplicateRisk) return a.duplicateRisk ? -1 : 1;
      return b.confidence - a.confidence;
    }
    return new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime();
  });
}

export function buildQueueBucketCounts(queue: IntakeQueueItem[]): Record<IntakeReviewBucket, number> {
  return REVIEW_BUCKET_ORDER.reduce<Record<IntakeReviewBucket, number>>((acc, key) => {
    acc[key] = queue.filter((item) => item.bucket === key).length;
    return acc;
  }, {
    auto_resolved: 0,
    ready_to_approve: 0,
    needs_correction: 0,
    link_duplicate_review: 0,
    reference_likely: 0,
    finalized_history: 0,
  });
}

export function buildQueueMetrics(queue: IntakeQueueItem[]) {
  const pending = queue.filter((item) => item.status === 'pending');
  const autoResolved = pending.filter((item) => item.triageCategory === 'auto_resolved');
  const reviewerNeeded = pending.filter((item) => item.triageCategory !== 'auto_resolved');
  return {
    inboundCount: queue.length,
    pendingCount: pending.length,
    autoResolvedCount: autoResolved.length,
    autoRoutedReferenceCount: pending.filter((item) => item.decisionPolicy.autoActionType === 'save_reference').length,
    forcedReviewCount: pending.filter((item) => item.decisionPolicy.requiredReviewLevel === 'manual_required').length,
    duplicateLinkFirstCount: pending.filter((item) => item.decisionPolicy.decisionMode === 'link_review_first').length,
    automationCaptureRate: pending.length ? autoResolved.length / pending.length : 0,
    humanReviewCount: reviewerNeeded.length,
    batchSafeCount: pending.filter((item) => item.batchSafe).length,
    duplicateReviewCount: pending.filter((item) => item.bucket === 'link_duplicate_review').length,
    weakOrConflictingCount: pending.filter((item) => item.bucket === 'needs_correction').length,
    finalizedCount: queue.filter((item) => item.status === 'finalized').length,
  };
}
