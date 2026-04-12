import { createId } from '../utils';
import type { ReportHeaderSummary } from './contracts';
import type { ReportDraftState, ReportRunDelta, ReportRunRecord, SavedReportDefinition } from '../../types';
import { buildReportRunDelta } from './reportComparison';
import { sanitizeReportDraftState } from './savedDefinitions';

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

export function createReportRunSignature(draft: Partial<ReportDraftState>): string {
  const sanitized = sanitizeReportDraftState(draft);
  return JSON.stringify({
    reportType: sanitized.reportType,
    scope: sanitized.scope,
    display: sanitized.display,
    export: sanitized.export,
  });
}

export function sanitizeReportRuns(
  runs: ReportRunRecord[] | undefined,
  options?: { validDefinitionIds?: Set<string> },
): ReportRunRecord[] {
  const validDefinitionIds = options?.validDefinitionIds;
  return sortReportRunsNewestFirst(runs ?? []).filter((run) => {
    if (!run?.id || !run.ranAt) return false;
    if (run.reportDefinitionId && validDefinitionIds && !validDefinitionIds.has(run.reportDefinitionId)) return false;
    return true;
  }).map((run) => ({
    ...run,
    exportRecords: (run.exportRecords ?? []).filter((record) => Boolean(record?.id && record.fileName)),
  }));
}

export function getRunsForDefinition(runs: ReportRunRecord[], definitionId: string): ReportRunRecord[] {
  return sortReportRunsNewestFirst(runs.filter((run) => run.reportDefinitionId === definitionId));
}

export function getPreviousRunForDefinition(runs: ReportRunRecord[], definitionId: string): ReportRunRecord | undefined {
  return getRunsForDefinition(runs, definitionId)[1];
}

export interface DraftRunSelection {
  latestRunAny?: ReportRunRecord;
  latestCompatibleRun?: ReportRunRecord;
  previousCompatibleRun?: ReportRunRecord;
  snapshotState: 'none' | 'fresh' | 'stale';
}

export function selectDraftRunSelection(runs: ReportRunRecord[], draftSignature: string): DraftRunSelection {
  const sortedRuns = sortReportRunsNewestFirst(runs);
  const compatibleRuns = sortedRuns.filter((run) => run.draftSignature === draftSignature);
  const latestRunAny = sortedRuns[0];
  const latestCompatibleRun = compatibleRuns[0];
  const previousCompatibleRun = compatibleRuns[1];

  let snapshotState: DraftRunSelection['snapshotState'] = 'none';
  if (latestCompatibleRun) snapshotState = 'fresh';
  else if (latestRunAny) snapshotState = 'stale';

  return {
    latestRunAny,
    latestCompatibleRun,
    previousCompatibleRun,
    snapshotState,
  };
}
