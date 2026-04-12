import { createId } from '../utils';
import type { ReportHeaderSummary } from './contracts';
import type { ReportRunDelta, ReportRunRecord, SavedReportDefinition } from '../../types';
import { buildReportRunDelta } from './reportComparison';

export function buildReportRunSummaryFromHeader(header: ReportHeaderSummary): ReportRunRecord['summary'] {
  return {
    includedCount: header.trust.scopeReceipt.includedCount,
    excludedCount: header.trust.scopeReceipt.excludedCount,
    confidenceTier: header.trust.confidence.tier,
    confidenceLabel: header.trust.confidence.label,
    summaryMetrics: header.highlights.map((metric) => ({
      key: metric.id,
      label: metric.label,
      value: metric.value,
    })),
    exclusionBreakdown: header.trust.topExclusions.slice(0, 6).map((bucket) => ({
      reasonKey: bucket.reasonKey,
      label: bucket.label,
      count: bucket.count,
    })),
  };
}

export function createReportRunRecord(input: {
  definition?: SavedReportDefinition;
  reportType: ReportRunRecord['reportType'];
  reportNameSnapshot: string;
  scopeMode: ReportRunRecord['scopeMode'];
  summary: ReportRunRecord['summary'];
  previousRun?: ReportRunRecord;
}): ReportRunRecord {
  const now = new Date().toISOString();
  const base: ReportRunRecord = {
    id: createId('RPRUN'),
    ranAt: now,
    reportDefinitionId: input.definition?.id,
    reportNameSnapshot: input.reportNameSnapshot,
    reportType: input.reportType,
    scopeMode: input.scopeMode,
    summary: input.summary,
    exportRecords: [],
  };
  const deltaFromPrevious: ReportRunDelta | undefined = buildReportRunDelta(base, input.previousRun);
  return {
    ...base,
    deltaFromPrevious,
  };
}

export function sortReportRunsNewestFirst(runs: ReportRunRecord[]): ReportRunRecord[] {
  return [...runs].sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime());
}

export function getRunsForDefinition(runs: ReportRunRecord[], definitionId: string): ReportRunRecord[] {
  return sortReportRunsNewestFirst(runs.filter((run) => run.reportDefinitionId === definitionId));
}

export function getPreviousRunForDefinition(runs: ReportRunRecord[], definitionId: string): ReportRunRecord | undefined {
  return getRunsForDefinition(runs, definitionId)[1];
}
