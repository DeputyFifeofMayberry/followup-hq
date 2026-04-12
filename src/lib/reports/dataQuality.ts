import { buildReportTrustSummary } from './reportTrust';
import { getIntegrityReasonLabel } from '../../domains/records/integrity';
import type { DataQualityReasonRow, DataQualityReportResult, ReportingContext } from './contracts';

const ORPHANED_TASK_REASON = 'orphaned_task';

type QualityReasonKey = Parameters<typeof getIntegrityReasonLabel>[0] | typeof ORPHANED_TASK_REASON;

function qualityReasonLabel(reason: QualityReasonKey): string {
  if (reason === ORPHANED_TASK_REASON) return 'Task is missing linked follow-up context.';
  return getIntegrityReasonLabel(reason);
}

export function buildDataQualityReport(context: ReportingContext): DataQualityReportResult {
  const cleanupCount = context.queue.filter((row) => row.queueFlags.cleanupRequired).length;
  const orphanedTaskCount = context.queueTasks.filter((row) => row.queueFlags.orphanedTask).length;

  const reasonMap = new Map<string, number>();
  Object.entries(context.integrity.byReason).forEach(([reason, count]) => {
    if (count && count > 0) reasonMap.set(reason, count);
  });
  if (orphanedTaskCount > 0) {
    reasonMap.set(ORPHANED_TASK_REASON, (reasonMap.get(ORPHANED_TASK_REASON) ?? 0) + orphanedTaskCount);
  }

  const reasons: DataQualityReasonRow[] = Array.from(reasonMap.entries())
    .map(([reasonKey, count]) => ({
      reasonKey,
      count,
      label: qualityReasonLabel(reasonKey as QualityReasonKey),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    header: {
      title: 'Data quality / cleanup',
      subtitle: 'Integrity and cleanup pressure grouped by concrete review reasons to support remediation planning.',
      scope: context.scope,
      trust: buildReportTrustSummary(context),
      highlights: [
        { id: 'quality-cleanup', label: 'Queue cleanup pressure', value: cleanupCount, tone: 'warn' },
        { id: 'quality-review', label: 'Needs review', value: context.integrity.followUpsNeedingReview.length + context.integrity.tasksNeedingReview.length, tone: 'info' },
        { id: 'quality-draft', label: 'Draft records', value: context.integrity.drafts.length, tone: 'default' },
      ],
    },
    cleanupCount,
    orphanedTaskCount,
    draftCount: context.integrity.drafts.length,
    reasons,
  };
}
