import type { ReportRunDelta, ReportRunDeltaMetric, ReportRunRecord } from '../../types';

function buildMetricDelta(current: { key: string; label: string; value: number }, previousValue: number): ReportRunDeltaMetric {
  return {
    key: current.key,
    label: current.label,
    previousValue,
    currentValue: current.value,
    delta: current.value - previousValue,
  };
}

export function buildReportRunDelta(current: ReportRunRecord, previous?: ReportRunRecord): ReportRunDelta | undefined {
  if (!previous) return undefined;
  const previousMetricMap = new Map(previous.summary.summaryMetrics.map((metric) => [metric.key, metric.value]));
  const metricDeltas = current.summary.summaryMetrics
    .map((metric) => buildMetricDelta(metric, previousMetricMap.get(metric.key) ?? 0))
    .filter((metric) => metric.delta !== 0);
  return {
    includedCountDelta: current.summary.includedCount - previous.summary.includedCount,
    excludedCountDelta: current.summary.excludedCount - previous.summary.excludedCount,
    confidenceChanged: current.summary.confidenceTier !== previous.summary.confidenceTier,
    previousConfidenceTier: previous.summary.confidenceTier,
    currentConfidenceTier: current.summary.confidenceTier,
    metricDeltas,
  };
}
