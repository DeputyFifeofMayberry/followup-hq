import { isReviewRecord, isTrustedLiveRecord } from '../../domains/records/integrity';
import type { FollowUpItem, ReportDefinitionScope, ReportScopeMode, TaskItem } from '../../types';

type ScopeRecord = FollowUpItem | TaskItem;

export type ReportExclusionReasonKey =
  | 'closed_status'
  | 'project_filter'
  | 'owner_filter'
  | 'draft_record'
  | 'review_required'
  | 'cleanup_required'
  | 'trusted_live_failure'
  | 'trusted_live_outside_cleanup_audit';

export interface ReportExclusionBucket {
  reasonKey: ReportExclusionReasonKey;
  label: string;
  description: string;
  count: number;
}

export type ReportConfidenceTier = 'high' | 'moderate' | 'low';

export interface ReportConfidenceSummary {
  tier: ReportConfidenceTier;
  label: string;
  caveat: string;
  exclusionPressure: number;
}

export interface ReportScopeReceipt {
  mode: ReportScopeMode;
  modeLabel: string;
  modeDescription: string;
  includeClosed: boolean;
  projectFilter?: string;
  ownerFilter?: string;
  rawCount: number;
  candidateCount: number;
  includedCount: number;
  excludedCount: number;
  includedFollowUps: number;
  includedTasks: number;
  excludedBuckets: ReportExclusionBucket[];
  includedRules: string[];
  excludedRules: string[];
}

export interface ReportScopeResolution {
  includedItems: FollowUpItem[];
  includedTasks: TaskItem[];
  receipt: ReportScopeReceipt;
  confidence: ReportConfidenceSummary;
}

const LEGACY_SCOPE_MODE_MAP: Record<string, ReportScopeMode> = {
  all_open: 'trusted_live_only',
  project: 'trusted_live_only',
  owner: 'trusted_live_only',
};

const MODE_META: Record<ReportScopeMode, { label: string; description: string; includeRules: string[]; excludeRules: string[] }> = {
  trusted_live_only: {
    label: 'Trusted live only',
    description: 'Only execution-ready records with strong integrity are included.',
    includeRules: ['Trusted live follow-ups and tasks only.'],
    excludeRules: ['Review-required, draft, cleanup-distorted, and untrusted-live records are excluded.'],
  },
  trusted_live_plus_review: {
    label: 'Trusted live + review',
    description: 'Includes trusted live records plus review-required records for blended operational visibility.',
    includeRules: ['Trusted live records and review-required records are included.'],
    excludeRules: ['Draft records and unresolved trust failures outside review-required are excluded.'],
  },
  all_records: {
    label: 'All records',
    description: 'Includes all records in selected project/owner/closed filters regardless of trust state.',
    includeRules: ['All records are included once structural filters are applied.'],
    excludeRules: ['Only closed/project/owner filters exclude records in this mode.'],
  },
  cleanup_audit: {
    label: 'Cleanup audit',
    description: 'Shows only records that need review, cleanup, or trust correction.',
    includeRules: ['Review-required, draft, cleanup-required, and trust-failure records are included.'],
    excludeRules: ['Trusted live records are excluded by design to focus remediation.'],
  },
};

const EXCLUSION_META: Record<ReportExclusionReasonKey, { label: string; description: string }> = {
  closed_status: {
    label: 'Closed/done excluded',
    description: 'Record was closed/done and this report scope excludes closed work.',
  },
  project_filter: {
    label: 'Outside project filter',
    description: 'Record project did not match the selected project scope.',
  },
  owner_filter: {
    label: 'Outside owner filter',
    description: 'Record owner did not match the selected owner scope.',
  },
  draft_record: {
    label: 'Draft records excluded',
    description: 'Record is still draft and not trusted for operational reporting.',
  },
  review_required: {
    label: 'Review-required excluded',
    description: 'Record is flagged for review-required integrity correction.',
  },
  cleanup_required: {
    label: 'Cleanup-required excluded',
    description: 'Record has cleanup-required pressure distorting trusted-live posture.',
  },
  trusted_live_failure: {
    label: 'Trusted-live integrity failure',
    description: 'Record failed trusted-live eligibility without a better-specific bucket.',
  },
  trusted_live_outside_cleanup_audit: {
    label: 'Trusted live excluded (cleanup audit)',
    description: 'Record is healthy/trusted live and omitted by cleanup-audit focus.',
  },
};

function toRecordType(record: ScopeRecord): 'followup' | 'task' {
  return 'nextStep' in record ? 'task' : 'followup';
}

function isDraftRecord(record: ScopeRecord): boolean {
  return record.lifecycleState === 'draft' || record.dataQuality === 'draft';
}

function normalizeScopeMode(mode: ReportDefinitionScope['mode'] | string): ReportScopeMode {
  return (MODE_META[mode as ReportScopeMode] ? mode : LEGACY_SCOPE_MODE_MAP[mode] ?? 'trusted_live_only') as ReportScopeMode;
}

function isClosedRecord(record: ScopeRecord): boolean {
  if (toRecordType(record) === 'task') return record.status === 'Done';
  return record.status === 'Closed';
}

function primaryTrustExclusion(record: ScopeRecord): ReportExclusionReasonKey {
  if (isDraftRecord(record)) return 'draft_record';
  const reviewReasons = record.reviewReasons ?? [];
  const hasCleanupReason = reviewReasons.includes('legacy_record_requires_cleanup') || reviewReasons.includes('missing_provenance');
  if (record.needsCleanup || hasCleanupReason) return 'cleanup_required';
  if (isReviewRecord(record)) return 'review_required';
  return 'trusted_live_failure';
}

function toConfidence(tier: ReportConfidenceTier, caveat: string, exclusionPressure: number): ReportConfidenceSummary {
  const label = tier === 'high' ? 'High confidence' : tier === 'moderate' ? 'Moderate confidence' : 'Low confidence';
  return { tier, label, caveat, exclusionPressure };
}

function deriveConfidence(mode: ReportScopeMode, candidateCount: number, excludedBuckets: ReportExclusionBucket[]): ReportConfidenceSummary {
  if (!candidateCount) return toConfidence('moderate', 'No candidate records matched structural filters, so confidence is limited.', 0);
  if (mode === 'cleanup_audit') return toConfidence('low', 'Cleanup audit intentionally excludes trusted-live records; use for remediation, not full posture.', 1);
  if (mode === 'all_records') return toConfidence('high', 'All trust states are included; exclusion distortion is minimal in this mode.', 0);

  const trustExcluded = excludedBuckets
    .filter((bucket) => ['draft_record', 'review_required', 'cleanup_required', 'trusted_live_failure'].includes(bucket.reasonKey))
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const pressure = trustExcluded / candidateCount;
  if (pressure >= 0.35) {
    return toConfidence('low', 'A large share of candidate records were excluded by trust filters, so this view may be materially distorted.', pressure);
  }
  if (pressure >= 0.15) {
    return toConfidence('moderate', 'Some trust-excluded volume is significant enough to influence interpretation.', pressure);
  }
  return toConfidence('high', 'Only a small share of candidate records were excluded by trust filters.', pressure);
}

export function resolveReportScope({
  items,
  tasks,
  scope,
}: {
  items: FollowUpItem[];
  tasks: TaskItem[];
  scope: ReportDefinitionScope;
}): ReportScopeResolution {
  const normalizedMode = normalizeScopeMode(scope.mode);
  const allRecords: ScopeRecord[] = [...items, ...tasks];
  const includedItems: FollowUpItem[] = [];
  const includedTasks: TaskItem[] = [];
  const exclusionCounts = new Map<ReportExclusionReasonKey, number>();

  const trackExclusion = (reason: ReportExclusionReasonKey) => {
    exclusionCounts.set(reason, (exclusionCounts.get(reason) ?? 0) + 1);
  };

  let candidateCount = 0;

  allRecords.forEach((record) => {
    if (!scope.includeClosed && isClosedRecord(record)) {
      trackExclusion('closed_status');
      return;
    }
    if (scope.project && record.project !== scope.project) {
      trackExclusion('project_filter');
      return;
    }
    if (scope.owner && record.owner !== scope.owner) {
      trackExclusion('owner_filter');
      return;
    }

    candidateCount += 1;
    const trusted = isTrustedLiveRecord(record);
    const review = isReviewRecord(record);
    const draft = isDraftRecord(record);

    const include =
      normalizedMode === 'all_records'
        ? true
        : normalizedMode === 'cleanup_audit'
          ? draft || review || !trusted
          : normalizedMode === 'trusted_live_plus_review'
            ? (trusted || review) && !draft
            : trusted;

    if (!include) {
      if (normalizedMode === 'cleanup_audit' && trusted) {
        trackExclusion('trusted_live_outside_cleanup_audit');
      } else {
        trackExclusion(primaryTrustExclusion(record));
      }
      return;
    }

    if (toRecordType(record) === 'task') includedTasks.push(record as TaskItem);
    else includedItems.push(record as FollowUpItem);
  });

  const excludedBuckets: ReportExclusionBucket[] = Array.from(exclusionCounts.entries())
    .map(([reasonKey, count]) => ({
      reasonKey,
      count,
      label: EXCLUSION_META[reasonKey].label,
      description: EXCLUSION_META[reasonKey].description,
    }))
    .sort((a, b) => b.count - a.count);

  const receipt: ReportScopeReceipt = {
    mode: normalizedMode,
    modeLabel: MODE_META[normalizedMode].label,
    modeDescription: MODE_META[normalizedMode].description,
    includeClosed: scope.includeClosed,
    projectFilter: scope.project,
    ownerFilter: scope.owner,
    rawCount: allRecords.length,
    candidateCount,
    includedCount: includedItems.length + includedTasks.length,
    excludedCount: allRecords.length - (includedItems.length + includedTasks.length),
    includedFollowUps: includedItems.length,
    includedTasks: includedTasks.length,
    excludedBuckets,
    includedRules: MODE_META[normalizedMode].includeRules,
    excludedRules: MODE_META[normalizedMode].excludeRules,
  };

  return {
    includedItems,
    includedTasks,
    receipt,
    confidence: deriveConfidence(normalizedMode, candidateCount, excludedBuckets),
  };
}
