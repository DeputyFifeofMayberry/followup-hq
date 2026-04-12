import type { ReportTrustSummary, ReportingContext } from './contracts';

export function buildReportTrustSummary(context: ReportingContext): ReportTrustSummary {
  return {
    scopeReceipt: context.scopeReceipt,
    confidence: context.confidence,
    topExclusions: context.scopeReceipt.excludedBuckets.slice(0, 4),
  };
}
