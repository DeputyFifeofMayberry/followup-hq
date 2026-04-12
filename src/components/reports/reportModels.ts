import type { ReportMetricSnapshot, ReportSummaryCardModel, UnifiedQueueItem } from '../../types';

export interface ReportViewProps {
  metrics: ReportMetricSnapshot;
  queue: UnifiedQueueItem[];
  summaryCards: ReportSummaryCardModel[];
}
