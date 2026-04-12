import { isTrustedLiveRecord } from '../../domains/records/integrity';
import { getIntegrityReasonLabel } from '../../domains/records/integrity';
import type { FollowUpItem, RecordIntegrityReason, TaskItem } from '../../types';
import { buildReportTrustSummary } from './reportTrust';
import type {
  DataQualityAffectedRecord,
  DataQualityBreakdown,
  DataQualityBucketRow,
  DataQualityCategory,
  DataQualityDriver,
  DataQualityDrilldown,
  DataQualityReasonRow,
  DataQualityReportResult,
  DataQualityRouteContext,
  DataQualitySeverity,
  ReportingContext,
} from './contracts';

const ORPHANED_TASK_REASON = 'orphaned_task';

type QualityReasonKey = RecordIntegrityReason | typeof ORPHANED_TASK_REASON;
type RecordKind = 'followup' | 'task';
type QualityRecord = FollowUpItem | TaskItem;

interface BucketAccumulator {
  category: DataQualityCategory;
  recordIds: Set<string>;
  followUpCount: number;
  taskCount: number;
  trustDistortionCount: number;
  routingBrokenCount: number;
  ownershipImpactCount: number;
  executionBlockedCount: number;
  reasonCounts: Map<string, number>;
  reasonLabels: Map<string, string>;
  samples: DataQualityAffectedRecord[];
}

const CATEGORY_META: Record<DataQualityCategory, {
  label: string;
  remediationFocus: string;
  dominantImpact: DataQualityAffectedRecord['impactLabel'];
  baseWeight: number;
}> = {
  structural_linkage: {
    label: 'Structural linkage',
    remediationFocus: 'Repair missing/invalid project linkage so routing and project reporting are trustworthy again.',
    dominantImpact: 'Routing',
    baseWeight: 42,
  },
  ownership_assignment: {
    label: 'Ownership / assignment',
    remediationFocus: 'Assign accountable owner/assignee so records can be actively routed and executed.',
    dominantImpact: 'Ownership',
    baseWeight: 34,
  },
  provenance_trust: {
    label: 'Provenance / trust integrity',
    remediationFocus: 'Strengthen source provenance and resolve trust blockers before treating records as trusted-live truth.',
    dominantImpact: 'Trust',
    baseWeight: 32,
  },
  draft_incomplete: {
    label: 'Draft / incompleteness',
    remediationFocus: 'Finish incomplete records or archive them so they stop polluting operational queues.',
    dominantImpact: 'Execution clarity',
    baseWeight: 18,
  },
  cleanup_operational: {
    label: 'Cleanup-required operational debt',
    remediationFocus: 'Clear cleanup-required debt to remove false pressure and improve confidence in report posture.',
    dominantImpact: 'Trust',
    baseWeight: 24,
  },
  orphaned_execution: {
    label: 'Orphaned execution records',
    remediationFocus: 'Link orphaned tasks to follow-ups or resolve as standalone work with explicit context.',
    dominantImpact: 'Routing',
    baseWeight: 40,
  },
};

const REASON_TO_CATEGORY: Partial<Record<RecordIntegrityReason, DataQualityCategory>> = {
  missing_project_link: 'structural_linkage',
  ambiguous_project_link: 'structural_linkage',
  placeholder_project: 'structural_linkage',
  archived_project: 'structural_linkage',
  deleted_project: 'structural_linkage',
  missing_owner: 'ownership_assignment',
  missing_accountable_owner: 'ownership_assignment',
  missing_assignee_for_live_task: 'ownership_assignment',
  placeholder_owner: 'ownership_assignment',
  missing_provenance: 'provenance_trust',
  weak_execution_provenance: 'provenance_trust',
  duplicate_resolution_required: 'provenance_trust',
  legacy_record_requires_cleanup: 'cleanup_operational',
  missing_due_context: 'draft_incomplete',
};

function toRecordType(record: QualityRecord): RecordKind {
  return 'nextStep' in record ? 'task' : 'followup';
}

function getReasonLabel(reason: QualityReasonKey): string {
  if (reason === ORPHANED_TASK_REASON) return 'Task has no linked follow-up context.';
  return getIntegrityReasonLabel(reason);
}

function categoryLabel(category: DataQualityCategory): string {
  return CATEGORY_META[category].label;
}

function severityFromPriority(priorityScore: number): DataQualitySeverity {
  if (priorityScore >= 86) return 'Critical';
  if (priorityScore >= 62) return 'High';
  if (priorityScore >= 36) return 'Moderate';
  return 'Low';
}

function impactLabelForCategory(category: DataQualityCategory): DataQualityAffectedRecord['impactLabel'] {
  return CATEGORY_META[category].dominantImpact;
}

function ensureBucket(acc: Partial<Record<DataQualityCategory, BucketAccumulator>>, category: DataQualityCategory): BucketAccumulator {
  if (!acc[category]) {
    acc[category] = {
      category,
      recordIds: new Set<string>(),
      followUpCount: 0,
      taskCount: 0,
      trustDistortionCount: 0,
      routingBrokenCount: 0,
      ownershipImpactCount: 0,
      executionBlockedCount: 0,
      reasonCounts: new Map<string, number>(),
      reasonLabels: new Map<string, string>(),
      samples: [],
    };
  }
  return acc[category] as BucketAccumulator;
}

function pushSample(bucket: BucketAccumulator, sample: DataQualityAffectedRecord) {
  if (bucket.samples.some((entry) => entry.id === sample.id && entry.recordType === sample.recordType && entry.reasonKey === sample.reasonKey)) return;
  bucket.samples.push(sample);
}

function reasonSummary(drivers: DataQualityDriver[]): string {
  if (!drivers.length) return 'No dominant reason captured.';
  if (drivers.length === 1) return drivers[0].label;
  return `${drivers[0].label}; also ${drivers[1].label.toLowerCase()}.`;
}

function buildRouteContext(category: DataQualityCategory, records: DataQualityAffectedRecord[]): DataQualityRouteContext {
  const primary = records[0];
  return {
    category,
    primaryProject: primary?.project,
    primaryProjectId: primary?.projectId,
    representativeFollowUpId: records.find((entry) => entry.recordType === 'followup')?.id,
    representativeTaskId: records.find((entry) => entry.recordType === 'task')?.id,
  };
}

function recommendedActionsForCategory(category: DataQualityCategory): string[] {
  if (category === 'structural_linkage') {
    return [
      'Open the affected project context and repair project linkage on the highest-impact records first.',
      'Re-run queue triage for those projects after linkage fixes to verify routing behavior is restored.',
    ];
  }
  if (category === 'ownership_assignment') {
    return [
      'Set accountable owner/assignee on representative records, then apply the same pattern across the bucket.',
      'Route into Follow Ups/Tasks filtered by owner to confirm no placeholder assignments remain.',
    ];
  }
  if (category === 'provenance_trust') {
    return [
      'Resolve missing/weak provenance and duplicate-resolution blockers before trusting these records in status reporting.',
      'Use trusted-live scope after remediation to confirm this bucket materially shrinks.',
    ];
  }
  if (category === 'draft_incomplete') {
    return [
      'Promote real draft work to ready state or archive stale drafts so incomplete records stop inflating workload noise.',
      'Confirm due/next-step/owner clarity while finishing drafts to prevent recurrence.',
    ];
  }
  if (category === 'orphaned_execution') {
    return [
      'Link orphaned tasks to parent follow-ups wherever commitment context exists.',
      'For standalone tasks, add explicit project/owner context so execution routing stays coherent.',
    ];
  }
  return [
    'Clear cleanup-required debt in priority order using top reasons from this bucket.',
    'Re-check trusted-live and cleanup-audit scopes to confirm distortion reduction.',
  ];
}

function recordProjectId(record: QualityRecord, projectByName: Map<string, string>): string | undefined {
  if (record.projectId) return record.projectId;
  return projectByName.get((record.project || '').trim().toLowerCase());
}

function buildBucketRow(bucket: BucketAccumulator, rowLimit: number): DataQualityBucketRow {
  const affectedCount = bucket.recordIds.size;
  const routingPressure = bucket.routingBrokenCount * 4;
  const trustPressure = bucket.trustDistortionCount * 3;
  const ownershipPressure = bucket.ownershipImpactCount * 3;
  const blockedPressure = bucket.executionBlockedCount * 4;
  const volumePressure = Math.min(40, affectedCount * 4);
  const priorityScore = CATEGORY_META[bucket.category].baseWeight
    + volumePressure
    + Math.min(24, routingPressure)
    + Math.min(24, trustPressure)
    + Math.min(18, ownershipPressure)
    + Math.min(20, blockedPressure);

  const drivers: DataQualityDriver[] = Array.from(bucket.reasonCounts.entries())
    .map(([reasonKey, count]) => ({
      key: `${bucket.category}:${reasonKey}`,
      reasonKey,
      count,
      impact: count * (reasonKey === ORPHANED_TASK_REASON ? 10 : 8),
      label: `${count} records — ${bucket.reasonLabels.get(reasonKey) || reasonKey}`,
      detail: reasonKey === ORPHANED_TASK_REASON ? 'Tasks without linked follow-up context break route continuity.' : undefined,
    }))
    .sort((a, b) => b.impact - a.impact || b.count - a.count)
    .slice(0, 8);

  const representativeRecords = bucket.samples
    .slice(0, Math.max(4, rowLimit));
  const breakdown: DataQualityBreakdown = {
    affectedCount,
    followUpCount: bucket.followUpCount,
    taskCount: bucket.taskCount,
    trustDistortionCount: bucket.trustDistortionCount,
    routingBrokenCount: bucket.routingBrokenCount,
    ownershipImpactCount: bucket.ownershipImpactCount,
    executionBlockedCount: bucket.executionBlockedCount,
  };

  return {
    id: `data-quality:${bucket.category}`,
    category: bucket.category,
    severity: severityFromPriority(priorityScore),
    priorityScore,
    affectedCount,
    topReasonSummary: reasonSummary(drivers),
    remediationFocus: CATEGORY_META[bucket.category].remediationFocus,
    materiallyDistortsTrust: bucket.trustDistortionCount >= Math.max(2, Math.ceil(affectedCount * 0.35)),
    dominantImpact: CATEGORY_META[bucket.category].dominantImpact,
    drivers,
    breakdown,
    representativeRecords,
    routeContext: buildRouteContext(bucket.category, representativeRecords),
  };
}

function collectBucketEvidence({
  record,
  category,
  reasonKey,
  reasonLabel,
  distortsTrust,
  breaksRouting,
  ownershipImpact,
  blocksExecution,
  projectId,
  acc,
}: {
  record: QualityRecord;
  category: DataQualityCategory;
  reasonKey: string;
  reasonLabel: string;
  distortsTrust: boolean;
  breaksRouting: boolean;
  ownershipImpact: boolean;
  blocksExecution: boolean;
  projectId?: string;
  acc: Partial<Record<DataQualityCategory, BucketAccumulator>>;
}) {
  const bucket = ensureBucket(acc, category);
  const key = `${toRecordType(record)}:${record.id}`;
  const isNew = !bucket.recordIds.has(key);
  if (isNew) {
    bucket.recordIds.add(key);
    if (toRecordType(record) === 'followup') bucket.followUpCount += 1;
    else bucket.taskCount += 1;
    if (distortsTrust) bucket.trustDistortionCount += 1;
    if (breaksRouting) bucket.routingBrokenCount += 1;
    if (ownershipImpact) bucket.ownershipImpactCount += 1;
    if (blocksExecution) bucket.executionBlockedCount += 1;
  }

  bucket.reasonCounts.set(reasonKey, (bucket.reasonCounts.get(reasonKey) ?? 0) + 1);
  bucket.reasonLabels.set(reasonKey, reasonLabel);
  pushSample(bucket, {
    id: record.id,
    recordType: toRecordType(record),
    title: record.title,
    project: record.project,
    owner: record.owner,
    projectId,
    linkedFollowUpId: toRecordType(record) === 'task' ? (record as TaskItem).linkedFollowUpId : undefined,
    reasonLabel,
    reasonKey,
    impactLabel: impactLabelForCategory(category),
  });
}

export function buildDataQualityReport(context: ReportingContext): DataQualityReportResult {
  const cleanupCount = context.queue.filter((row) => row.queueFlags.cleanupRequired).length;
  const orphanedTaskCount = context.queueTasks.filter((row) => row.queueFlags.orphanedTask).length;

  const projectByName = new Map(context.projects.map((project) => [project.name.trim().toLowerCase(), project.id]));
  const bucketAccumulators: Partial<Record<DataQualityCategory, BucketAccumulator>> = {};

  const reasonMap = new Map<string, number>();
  Object.entries(context.integrity.byReason).forEach(([reason, count]) => {
    if (count && count > 0) reasonMap.set(reason, count);
  });
  if (orphanedTaskCount > 0) reasonMap.set(ORPHANED_TASK_REASON, orphanedTaskCount);

  const allRecords: QualityRecord[] = [...context.items, ...context.tasks];
  allRecords.forEach((record) => {
    const trustDistorted = !isTrustedLiveRecord(record);
    const reasons = record.reviewReasons ?? [];
    const projectId = recordProjectId(record, projectByName);

    reasons.forEach((reason) => {
      const category = REASON_TO_CATEGORY[reason] ?? 'cleanup_operational';
      const breaksRouting = category === 'structural_linkage' || category === 'ownership_assignment';
      const ownershipImpact = category === 'ownership_assignment';
      const blocksExecution = category === 'structural_linkage' || category === 'ownership_assignment';
      collectBucketEvidence({
        record,
        category,
        reasonKey: reason,
        reasonLabel: getReasonLabel(reason),
        distortsTrust: trustDistorted,
        breaksRouting,
        ownershipImpact,
        blocksExecution,
        projectId,
        acc: bucketAccumulators,
      });
    });

    const isDraft = record.lifecycleState === 'draft' || record.dataQuality === 'draft';
    if (isDraft) {
      collectBucketEvidence({
        record,
        category: 'draft_incomplete',
        reasonKey: 'draft_state',
        reasonLabel: 'Record is still draft and incomplete for live operations.',
        distortsTrust: true,
        breaksRouting: false,
        ownershipImpact: false,
        blocksExecution: true,
        projectId,
        acc: bucketAccumulators,
      });
    }

    if (record.needsCleanup) {
      collectBucketEvidence({
        record,
        category: 'cleanup_operational',
        reasonKey: 'cleanup_required',
        reasonLabel: 'Record is marked cleanup-required and distorts operational queue trust.',
        distortsTrust: true,
        breaksRouting: false,
        ownershipImpact: false,
        blocksExecution: false,
        projectId,
        acc: bucketAccumulators,
      });
    }

    if (toRecordType(record) === 'task' && !(record as TaskItem).linkedFollowUpId) {
      collectBucketEvidence({
        record,
        category: 'orphaned_execution',
        reasonKey: ORPHANED_TASK_REASON,
        reasonLabel: getReasonLabel(ORPHANED_TASK_REASON),
        distortsTrust: true,
        breaksRouting: true,
        ownershipImpact: false,
        blocksExecution: true,
        projectId,
        acc: bucketAccumulators,
      });
    }
  });

  const rankedBuckets = Object.values(bucketAccumulators)
    .map((bucket) => buildBucketRow(bucket as BucketAccumulator, context.scope.openExecutionRecords > 0 ? 6 : 4))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.affectedCount - a.affectedCount || categoryLabel(a.category).localeCompare(categoryLabel(b.category)))
    .slice(0, Math.max(8, Math.ceil((context.scope.openExecutionRecords || 8) / 4)));

  const drilldownsByBucketId = rankedBuckets.reduce<Record<string, DataQualityDrilldown>>((acc, bucket) => {
    const trustPressurePercent = bucket.breakdown.affectedCount > 0
      ? Math.round((bucket.breakdown.trustDistortionCount / bucket.breakdown.affectedCount) * 100)
      : 0;
    const routingPressurePercent = bucket.breakdown.affectedCount > 0
      ? Math.round((bucket.breakdown.routingBrokenCount / bucket.breakdown.affectedCount) * 100)
      : 0;

    acc[bucket.id] = {
      bucketId: bucket.id,
      category: bucket.category,
      severity: bucket.severity,
      priorityScore: bucket.priorityScore,
      whyPrioritized: `${categoryLabel(bucket.category)} is prioritized because ${bucket.affectedCount} records are affected, with ${trustPressurePercent}% trust distortion pressure and ${routingPressurePercent}% routing breakage impact in-scope.`,
      remediationGuidance: bucket.remediationFocus,
      nextActions: recommendedActionsForCategory(bucket.category),
      dominantImpact: bucket.dominantImpact,
      topReasonSummary: bucket.topReasonSummary,
      drivers: bucket.drivers,
      breakdown: bucket.breakdown,
      representativeRecords: bucket.representativeRecords,
      routeContext: bucket.routeContext,
    };
    return acc;
  }, {});

  const reportingDistortionCount = allRecords.filter((record) => !isTrustedLiveRecord(record)).length;
  const routingBrokenCount = rankedBuckets
    .filter((bucket) => bucket.category === 'structural_linkage' || bucket.category === 'orphaned_execution')
    .reduce((sum, bucket) => sum + bucket.affectedCount, 0);
  const ownershipIssueCount = rankedBuckets
    .filter((bucket) => bucket.category === 'ownership_assignment')
    .reduce((sum, bucket) => sum + bucket.affectedCount, 0);
  const highestPriorityBucketCount = rankedBuckets.filter((bucket) => bucket.severity === 'Critical' || bucket.severity === 'High').length;

  const reasons: DataQualityReasonRow[] = Array.from(reasonMap.entries())
    .map(([reasonKey, count]) => ({
      reasonKey,
      count,
      label: getReasonLabel(reasonKey as QualityReasonKey),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    header: {
      title: 'Data quality / cleanup',
      subtitle: 'Operational remediation workbench: ranked integrity buckets, explainable priority, and route-to-fix actions.',
      scope: context.scope,
      trust: buildReportTrustSummary(context),
      highlights: [
        {
          id: 'quality-distortion',
          label: 'Reporting-distorting records',
          value: reportingDistortionCount,
          tone: reportingDistortionCount > 0 ? 'danger' : 'default',
          helper: 'Records currently outside trusted-live posture',
        },
        {
          id: 'quality-routing',
          label: 'Routing-broken issues',
          value: routingBrokenCount,
          tone: routingBrokenCount > 0 ? 'warn' : 'default',
          helper: 'Structural/orphaned issues breaking lane routing',
        },
        {
          id: 'quality-ownership',
          label: 'Ownership issues',
          value: ownershipIssueCount,
          tone: ownershipIssueCount > 0 ? 'warn' : 'default',
          helper: 'Missing or placeholder accountable ownership',
        },
        {
          id: 'quality-priority-buckets',
          label: 'High-priority buckets',
          value: highestPriorityBucketCount,
          tone: highestPriorityBucketCount > 0 ? 'info' : 'default',
          helper: 'Critical/high remediation groups in this scope',
        },
      ],
    },
    cleanupCount,
    orphanedTaskCount,
    draftCount: context.integrity.drafts.length,
    reportingDistortionCount,
    routingBrokenCount,
    ownershipIssueCount,
    highestPriorityBucketCount,
    reasons,
    rankedBuckets,
    defaultSelectedBucketId: rankedBuckets[0]?.id,
    drilldownsByBucketId,
  };
}
