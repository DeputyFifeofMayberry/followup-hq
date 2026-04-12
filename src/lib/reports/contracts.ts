import type { FollowUpItem, ProjectRecord, RecordIntegrityReason, ReportType, TaskItem, UnifiedQueueItem } from '../../types';
import type { ExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';

export type ReportTone = 'default' | 'warn' | 'danger' | 'info';
export type ReportSeverity = 'stable' | 'watch' | 'at_risk' | 'critical';

export interface ReportScopeSummary {
  openFollowUps: number;
  openTasks: number;
  openExecutionRecords: number;
  generatedAt: string;
}

export interface ReportSummaryCard {
  id: string;
  label: string;
  value: number;
  helper?: string;
  tone?: ReportTone;
}

export interface ReportHeaderSummary {
  title: string;
  subtitle: string;
  scope: ReportScopeSummary;
  highlights: ReportSummaryCard[];
}

export interface RankedReason {
  label: string;
  weight: number;
}

export interface RankedReportRowBase {
  id: string;
  label: string;
  score: number;
  severity: ReportSeverity;
  reasons: RankedReason[];
}

export interface ReportingContext {
  generatedAt: string;
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  openFollowUps: FollowUpItem[];
  openTasks: TaskItem[];
  queue: UnifiedQueueItem[];
  queueFollowUps: UnifiedQueueItem[];
  queueTasks: UnifiedQueueItem[];
  executionStats: ExecutionQueueStats;
  scope: ReportScopeSummary;
  queueByProject: Record<string, UnifiedQueueItem[]>;
  queueByOwner: Record<string, UnifiedQueueItem[]>;
  integrity: {
    followUpsNeedingReview: FollowUpItem[];
    tasksNeedingReview: TaskItem[];
    drafts: Array<FollowUpItem | TaskItem>;
    byReason: Partial<Record<RecordIntegrityReason, number>>;
  };
}

export interface ExecutivePressureRow {
  id: string;
  recordType: 'task' | 'followup';
  title: string;
  project: string;
  owner: string;
  dueDate?: string;
  priority: string;
  pressureReason: string;
}

export interface ExecutiveSnapshotReportResult {
  header: ReportHeaderSummary;
  pressurePreview: ExecutivePressureRow[];
}

export interface ProjectHealthRow extends RankedReportRowBase {
  project: string;
  openTotal: number;
  blockedTotal: number;
  cleanupTotal: number;
  dueNowTotal: number;
  readyToCloseTotal: number;
}

export interface ProjectHealthReportResult {
  header: ReportHeaderSummary;
  rankedProjects: ProjectHealthRow[];
}

export interface OwnerWorkloadRow extends RankedReportRowBase {
  owner: string;
  openTotal: number;
  blockedTotal: number;
  dueNowTotal: number;
  waitingTotal: number;
}

export interface OwnerWorkloadReportResult {
  header: ReportHeaderSummary;
  rankedOwners: OwnerWorkloadRow[];
}

export interface FollowUpRiskRow extends RankedReportRowBase {
  followUpId: string;
  title: string;
  project: string;
  owner: string;
  dueDate?: string;
  waitingOn?: string;
}

export interface FollowUpRiskReportResult {
  header: ReportHeaderSummary;
  highRiskCount: number;
  watchCount: number;
  stableCount: number;
  rankedFollowUps: FollowUpRiskRow[];
}

export interface DataQualityReasonRow {
  reasonKey: string;
  label: string;
  count: number;
}

export interface DataQualityReportResult {
  header: ReportHeaderSummary;
  cleanupCount: number;
  orphanedTaskCount: number;
  draftCount: number;
  reasons: DataQualityReasonRow[];
}

export type ReportResultMap = {
  executive_snapshot: ExecutiveSnapshotReportResult;
  project_health: ProjectHealthReportResult;
  owner_workload: OwnerWorkloadReportResult;
  followup_risk: FollowUpRiskReportResult;
  data_quality: DataQualityReportResult;
};

export interface ReportDefinition<T extends ReportType> {
  id: T;
  label: string;
  description: string;
  build: (context: ReportingContext) => ReportResultMap[T];
}

export interface ReportSelectorItem {
  id: ReportType;
  label: string;
  description: string;
}
