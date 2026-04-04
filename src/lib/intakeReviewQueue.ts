import { buildForwardedFieldReviews, buildWorkCandidateFieldReviews, summarizeFieldReviews } from './intakeEvidence';
import type { ForwardedIntakeCandidate, IntakeAssetRecord, IntakeWorkCandidate } from '../types';

export type IntakeReviewBucket = 'ready_to_approve' | 'needs_correction' | 'link_duplicate_review' | 'reference_likely' | 'finalized_history';
export type IntakeReviewSort = 'highest_confidence' | 'lowest_confidence' | 'most_missing_fields' | 'newest' | 'duplicate_risk_first';
export type IntakeConfidenceTier = 'high' | 'medium' | 'low';

export interface IntakeReviewerAlert {
  code: 'missing_due_date' | 'missing_project' | 'weak_owner_detection' | 'conflicting_type_inference' | 'duplicate_risk' | 'likely_reference_only' | 'weak_parse_quality' | 'needs_link_decision';
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
  duplicateRisk: boolean;
  missingCriticalFields: number;
  conflictingEvidence: boolean;
  recommendedAction: string;
  batchSafe: boolean;
  alerts: IntakeReviewerAlert[];
  sortDate: string;
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

const REVIEW_BUCKET_ORDER: IntakeReviewBucket[] = ['ready_to_approve', 'needs_correction', 'link_duplicate_review', 'reference_likely', 'finalized_history'];

const SCORE_BY_BUCKET: Record<IntakeReviewBucket, number> = {
  ready_to_approve: 4,
  needs_correction: 3,
  link_duplicate_review: 2,
  reference_likely: 1,
  finalized_history: 0,
};

function confidenceTier(score: number): IntakeConfidenceTier {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

export function buildIntakeReviewQueue(candidates: IntakeWorkCandidate[], assets: IntakeAssetRecord[]): IntakeQueueItem[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return candidates.map((candidate) => {
    const asset = assetsById.get(candidate.assetId);
    const fieldSummary = summarizeFieldReviews(buildWorkCandidateFieldReviews(candidate));
    const missingCriticalFields = fieldSummary.priorityReviewFields.filter((field) => ['missing', 'weak'].includes(field.status)).length;
    const conflictingEvidence = fieldSummary.conflicting.length > 0 || candidate.warnings.some((warning) => /conflict|ambiguous|mismatch|unclear/i.test(warning));
    const duplicateRisk = candidate.duplicateMatches.length > 0 || candidate.existingRecordMatches.some((match) => match.score >= 0.75 && (match.strategy === 'duplicate' || match.strategy === 'link'));
    const likelyReference = candidate.candidateType === 'reference' || candidate.suggestedAction === 'reference_only';
    const status = candidate.approvalStatus === 'pending' ? 'pending' : 'finalized';

    const alerts: IntakeReviewerAlert[] = [];
    if (!candidate.dueDate) alerts.push({ code: 'missing_due_date', label: 'Missing due date', tone: 'warn' });
    if (!candidate.project) alerts.push({ code: 'missing_project', label: 'Missing project', tone: 'warn' });
    if (!candidate.owner && !candidate.assignee) alerts.push({ code: 'weak_owner_detection', label: 'Weak owner detection', tone: 'warn' });
    if (conflictingEvidence) alerts.push({ code: 'conflicting_type_inference', label: 'Conflicting evidence', tone: 'danger' });
    if (duplicateRisk) alerts.push({ code: 'duplicate_risk', label: 'Duplicate risk', tone: 'danger' });
    if (likelyReference) alerts.push({ code: 'likely_reference_only', label: 'Likely reference only', tone: 'neutral' });
    if (asset?.parseQuality === 'weak' || asset?.parseQuality === 'failed') alerts.push({ code: 'weak_parse_quality', label: 'Weak parse quality', tone: 'warn' });
    if (candidate.existingRecordMatches.length > 0) alerts.push({ code: 'needs_link_decision', label: 'Needs link decision', tone: 'blue' });

    const batchSafe = status === 'pending'
      && candidate.confidence >= 0.9
      && !duplicateRisk
      && !likelyReference
      && !conflictingEvidence
      && missingCriticalFields === 0
      && asset?.parseQuality !== 'weak'
      && asset?.parseQuality !== 'failed';

    const bucket: IntakeReviewBucket = status === 'finalized'
      ? 'finalized_history'
      : likelyReference
        ? 'reference_likely'
        : duplicateRisk
          ? 'link_duplicate_review'
          : conflictingEvidence || missingCriticalFields > 0 || candidate.confidence < 0.7
            ? 'needs_correction'
            : 'ready_to_approve';

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
      duplicateRisk,
      missingCriticalFields,
      conflictingEvidence,
      recommendedAction: candidate.suggestedAction,
      batchSafe,
      alerts,
      sortDate: candidate.updatedAt || candidate.createdAt,
    };
  });
}

export function buildForwardedReviewQueue(candidates: ForwardedIntakeCandidate[]): IntakeQueueItem[] {
  return candidates.map((candidate) => {
    const fieldSummary = summarizeFieldReviews(buildForwardedFieldReviews(candidate));
    const duplicateRisk = candidate.duplicateWarnings.length > 0;
    const missingCriticalFields = fieldSummary.priorityReviewFields.filter((field) => ['missing', 'weak'].includes(field.status)).length;
    const conflictingEvidence = candidate.warnings.some((warning) => /conflict|ambiguous|mismatch|unclear/i.test(warning));
    const likelyReference = candidate.suggestedType === 'reference';
    const status = candidate.status === 'pending' ? 'pending' : 'finalized';

    const alerts: IntakeReviewerAlert[] = [];
    if (!candidate.parsedProject) alerts.push({ code: 'missing_project', label: 'Missing project', tone: 'warn' });
    if (!candidate.reasons.some((reason) => /owner|assigned|sender/i.test(reason))) alerts.push({ code: 'weak_owner_detection', label: 'Weak owner detection', tone: 'warn' });
    if (!candidate.reasons.some((reason) => /due|date|deadline|tomorrow|today|friday/i.test(reason))) alerts.push({ code: 'missing_due_date', label: 'Missing due date', tone: 'warn' });
    if (duplicateRisk) alerts.push({ code: 'duplicate_risk', label: 'Duplicate risk', tone: 'danger' });
    if (conflictingEvidence) alerts.push({ code: 'conflicting_type_inference', label: 'Conflicting evidence', tone: 'danger' });
    if (likelyReference) alerts.push({ code: 'likely_reference_only', label: 'Likely reference only', tone: 'neutral' });
    if (candidate.parseQuality === 'weak') alerts.push({ code: 'weak_parse_quality', label: 'Weak parse quality', tone: 'warn' });

    const batchSafe = status === 'pending'
      && candidate.confidence >= 0.9
      && candidate.parseQuality === 'strong'
      && !duplicateRisk
      && !conflictingEvidence
      && !likelyReference
      && missingCriticalFields === 0;

    const bucket: IntakeReviewBucket = status === 'finalized'
      ? 'finalized_history'
      : likelyReference
        ? 'reference_likely'
        : duplicateRisk
          ? 'link_duplicate_review'
          : conflictingEvidence || missingCriticalFields > 0 || candidate.parseQuality !== 'strong'
            ? 'needs_correction'
            : 'ready_to_approve';

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
      duplicateRisk,
      missingCriticalFields,
      conflictingEvidence,
      recommendedAction: likelyReference ? 'reference_only' : 'create_new',
      batchSafe,
      alerts,
      sortDate: candidate.updatedAt || candidate.createdAt,
    };
  });
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
    ready_to_approve: 0,
    needs_correction: 0,
    link_duplicate_review: 0,
    reference_likely: 0,
    finalized_history: 0,
  });
}

export function buildQueueMetrics(queue: IntakeQueueItem[]) {
  const pending = queue.filter((item) => item.status === 'pending');
  return {
    pendingCount: pending.length,
    batchSafeCount: pending.filter((item) => item.batchSafe).length,
    duplicateReviewCount: pending.filter((item) => item.bucket === 'link_duplicate_review').length,
    weakOrConflictingCount: pending.filter((item) => item.bucket === 'needs_correction').length,
    finalizedCount: queue.filter((item) => item.status === 'finalized').length,
  };
}
