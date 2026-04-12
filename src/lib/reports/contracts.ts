import type { FollowUpItem, ProjectHealthIndicators, ProjectHealthTier, ProjectRecord, RecordIntegrityReason, ReportType, TaskItem, UnifiedQueueItem } from '../../types';
import type { ReportConfidenceSummary, ReportExclusionBucket, ReportScopeReceipt } from './reportScope';
import type { ExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';

export type ReportTone = 'default' | 'warn' | 'danger' | 'info';
export type ReportSeverity = 'stable' | 'watch' | 'at_risk' | 'critical';

export interface ReportScopeSummary {
  openFollowUps: number;
  openTasks: number;
  openExecutionRecords: number;
  generatedAt: string;
}

export interface ReportTrustSummary {
  scopeReceipt: ReportScopeReceipt;
  confidence: ReportConfidenceSummary;
  topExclusions: ReportExclusionBucket[];
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
  trust: ReportTrustSummary;
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
  scopeReceipt: ReportScopeReceipt;
  confidence: ReportConfidenceSummary;
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

export type ProjectHealthReasonCategory = 'execution_pressure' | 'cleanup_distortion' | 'closeout_opportunity';

export interface ProjectHealthReason {
  key: string;
  label: string;
  category: ProjectHealthReasonCategory;
  impact: number;
  count?: number;
}

export interface ProjectHealthScore {
  total: number;
  executionPressure: number;
  cleanupDistortion: number;
  closeoutOpportunity: number;
}

export interface ProjectHealthBreakdown {
  openWorkTotal: number;
  openFollowUps: number;
  openTasks: number;
  dueNow: number;
  overdue: number;
  blocked: number;
  waitingHeavy: number;
  stalled: number;
  parentChildRisk: number;
  cleanupQueue: number;
  integrityReview: number;
  orphanedTasks: number;
  readyToClose: number;
  closeoutPhase: boolean;
  staleActivityDays?: number;
}

export interface ProjectHealthRouteContext {
  projectName: string;
  projectId?: string;
}

export interface ProjectHealthDetailRow {
  id: string;
  recordType: 'task' | 'followup';
  title: string;
  status: string;
  owner: string;
  priority: string;
  dueDate?: string;
  reason: string;
  score: number;
}

export interface ProjectHealthDrilldownSummary {
  topDrivers: string[];
  biggestRisk: string;
  biggestCleanupDistortion: string;
  bestCloseoutOpportunity: string;
}

export interface ProjectHealthDrilldown {
  projectId: string;
  project: string;
  tier: ProjectHealthTier;
  score: ProjectHealthScore;
  breakdown: ProjectHealthBreakdown;
  indicators: ProjectHealthIndicators;
  reasons: ProjectHealthReason[];
  summary: ProjectHealthDrilldownSummary;
  highestPressureRows: ProjectHealthDetailRow[];
  cleanupRows: ProjectHealthDetailRow[];
  closeoutRows: ProjectHealthDetailRow[];
  routeContext: ProjectHealthRouteContext;
}

export interface ProjectHealthRow {
  id: string;
  project: string;
  tier: ProjectHealthTier;
  score: ProjectHealthScore;
  breakdown: ProjectHealthBreakdown;
  indicators: ProjectHealthIndicators;
  topReasonSummary: string;
  reasons: ProjectHealthReason[];
  routeContext: ProjectHealthRouteContext;
}

export interface ProjectHealthReportResult {
  header: ReportHeaderSummary;
  rankedProjects: ProjectHealthRow[];
  defaultSelectedProjectId?: string;
  drilldownsByProjectId: Record<string, ProjectHealthDrilldown>;
}

export type OwnerWorkloadCategory =
  | 'volume_pressure'
  | 'urgency_pressure'
  | 'blocked_pressure'
  | 'waiting_pressure'
  | 'cleanup_distortion'
  | 'risk_concentration'
  | 'closeout_relief';

export interface OwnerWorkloadScore {
  total: number;
  volumePressure: number;
  urgencyPressure: number;
  blockedPressure: number;
  waitingPressure: number;
  cleanupDistortion: number;
  riskConcentration: number;
  closeoutRelief: number;
}

export interface OwnerWorkloadBreakdown {
  openTotal: number;
  followUpOpen: number;
  taskOpen: number;
  dueNowTotal: number;
  overdueTotal: number;
  blockedTotal: number;
  waitingTotal: number;
  waitingTooLongTotal: number;
  cleanupTotal: number;
  severeTotal: number;
  closeoutReadyTotal: number;
}

export interface OwnerWorkloadDriver {
  key: string;
  label: string;
  category: OwnerWorkloadCategory;
  impact: number;
  detail?: string;
}

export interface OwnerWorkloadDetailRow {
  id: string;
  recordType: 'task' | 'followup';
  title: string;
  project: string;
  status: string;
  priority: string;
  reason: string;
  score: number;
}

export interface OwnerWorkloadRouteContext {
  owner: string;
  primaryProject?: string;
  primaryProjectId?: string;
  hottestFollowUpId?: string;
  hottestTaskId?: string;
}

export interface OwnerWorkloadDrilldown {
  owner: string;
  severity: ReportSeverity;
  tier: 'Overloaded' | 'High' | 'Watch' | 'Balanced';
  score: OwnerWorkloadScore;
  breakdown: OwnerWorkloadBreakdown;
  topDriverSummary: string;
  narrative: string;
  dominantPressure: OwnerWorkloadCategory;
  drivers: OwnerWorkloadDriver[];
  highestPressureRows: OwnerWorkloadDetailRow[];
  blockedRows: OwnerWorkloadDetailRow[];
  cleanupRows: OwnerWorkloadDetailRow[];
  routeContext: OwnerWorkloadRouteContext;
}

export interface OwnerWorkloadRow {
  id: string;
  label: string;
  owner: string;
  severity: ReportSeverity;
  tier: OwnerWorkloadDrilldown['tier'];
  score: OwnerWorkloadScore;
  breakdown: OwnerWorkloadBreakdown;
  dominantPressure: OwnerWorkloadCategory;
  topDriverSummary: string;
  drivers: OwnerWorkloadDriver[];
  reasons: RankedReason[];
  routeContext: OwnerWorkloadRouteContext;
}

export interface OwnerWorkloadReportResult {
  header: ReportHeaderSummary;
  overloadedOwnerCount: number;
  dueNowHeavyOwnerCount: number;
  blockedHeavyOwnerCount: number;
  waitingHeavyOwnerCount: number;
  cleanupDistortedOwnerCount: number;
  rankedOwners: OwnerWorkloadRow[];
  defaultSelectedOwnerId?: string;
  drilldownsByOwnerId: Record<string, OwnerWorkloadDrilldown>;
}

export type FollowUpRiskCategory =
  | 'timing_pressure'
  | 'dependency_waiting'
  | 'execution_block'
  | 'cleanup_distortion'
  | 'escalation_risk'
  | 'missing_plan';

export interface FollowUpRiskScore {
  total: number;
  timingPressure: number;
  dependencyWaiting: number;
  executionBlock: number;
  cleanupDistortion: number;
  escalationRisk: number;
  missingPlan: number;
}

export interface FollowUpRiskBreakdown {
  dueInDays?: number;
  nextTouchInDays?: number;
  promisedInDays?: number;
  waitingOn?: string;
  waitingTooLong: boolean;
  blocked: boolean;
  escalated: boolean;
  linkedTaskCount: number;
  linkedOpenTaskCount: number;
  linkedBlockedTaskCount: number;
  linkedOverdueTaskCount: number;
  cleanupRequired: boolean;
  staleTouchDays?: number;
  staleMoveDays?: number;
}

export interface FollowUpRiskDriver {
  key: string;
  label: string;
  category: FollowUpRiskCategory;
  impact: number;
  detail?: string;
}

export interface FollowUpRiskRouteContext {
  followUpId: string;
  projectName: string;
  projectId?: string;
  primaryTaskId?: string;
}

export interface FollowUpRiskDrilldown {
  followUpId: string;
  title: string;
  project: string;
  owner: string;
  severity: ReportSeverity;
  tier: 'Severe' | 'High' | 'Watch' | 'Stable';
  status: string;
  priority: string;
  score: FollowUpRiskScore;
  breakdown: FollowUpRiskBreakdown;
  drivers: FollowUpRiskDriver[];
  topRiskCategory: FollowUpRiskCategory;
  riskSummary: string;
  recommendedNextMove: string;
  routeContext: FollowUpRiskRouteContext;
}

export interface FollowUpRiskRow extends RankedReportRowBase {
  followUpId: string;
  title: string;
  project: string;
  owner: string;
  severity: ReportSeverity;
  tier: 'Severe' | 'High' | 'Watch' | 'Stable';
  status: string;
  priority: string;
  score: number;
  riskScore: FollowUpRiskScore;
  topRiskCategory: FollowUpRiskCategory;
  topRiskSummary: string;
  breakdown: FollowUpRiskBreakdown;
  drivers: FollowUpRiskDriver[];
  dueDate?: string;
  nextTouchDate?: string;
  waitingOn?: string;
  routeContext: FollowUpRiskRouteContext;
}

export interface FollowUpRiskReportResult {
  header: ReportHeaderSummary;
  highRiskCount: number;
  watchCount: number;
  stableCount: number;
  dueNowRiskCount: number;
  waitingDependencyRiskCount: number;
  blockedExecutionRiskCount: number;
  escalationRiskCount: number;
  cleanupDistortedCount: number;
  rankedFollowUps: FollowUpRiskRow[];
  defaultSelectedFollowUpId?: string;
  drilldownsByFollowUpId: Record<string, FollowUpRiskDrilldown>;
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
