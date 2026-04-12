import { getIntegrityReasonLabel } from '../../domains/records/integrity';
import type { FollowUpItem, ProjectHealthIndicators, ProjectHealthTier, ProjectRecord, TaskItem, UnifiedQueueItem } from '../../types';
import type {
  ProjectHealthBreakdown,
  ProjectHealthDetailRow,
  ProjectHealthDrilldown,
  ProjectHealthReason,
  ProjectHealthReportResult,
  ProjectHealthRow,
  ProjectHealthScore,
  ReportingContext,
} from './contracts';

const STALE_ACTIVITY_DAYS = 10;

function normalizeProjectName(project?: string): string {
  return (project || 'General').trim().toLowerCase();
}

function projectTierFromScore(score: number): ProjectHealthTier {
  if (score >= 95) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 28) return 'Moderate';
  return 'Low';
}

function toDetailRow(row: UnifiedQueueItem): ProjectHealthDetailRow {
  return {
    id: `${row.recordType}:${row.id}`,
    recordType: row.recordType,
    title: row.title,
    status: row.status,
    owner: row.owner,
    priority: row.priority,
    dueDate: row.dueDate,
    reason: row.whyInQueue,
    score: row.score,
  };
}

function toReviewRows(projectName: string, records: Array<FollowUpItem | TaskItem>): ProjectHealthDetailRow[] {
  const projectKey = normalizeProjectName(projectName);
  return records
    .filter((record) => normalizeProjectName(record.project) === projectKey)
    .slice(0, 8)
    .map((record) => {
      const reasons = record.reviewReasons ?? [];
      return {
        id: `${'nextStep' in record ? 'task' : 'followup'}:${record.id}:review`,
        recordType: 'nextStep' in record ? 'task' : 'followup',
        title: record.title,
        status: record.status,
        owner: record.owner,
        priority: record.priority,
        dueDate: 'dueDate' in record ? record.dueDate : undefined,
        reason: reasons[0] ? getIntegrityReasonLabel(reasons[0]) : 'Needs integrity review',
        score: Math.max(8, reasons.length * 6),
      } satisfies ProjectHealthDetailRow;
    });
}

function buildIndicators(breakdown: ProjectHealthBreakdown): ProjectHealthIndicators {
  return {
    blocked: breakdown.blocked > 0,
    overdue: breakdown.overdue > 0 || breakdown.dueNow > 0,
    stale: (breakdown.staleActivityDays ?? 0) >= STALE_ACTIVITY_DAYS,
    waitingHeavy: breakdown.waitingHeavy > 0,
    closeoutReady: breakdown.readyToClose > 0 || (breakdown.closeoutPhase && breakdown.openWorkTotal <= 3),
  };
}

function buildReasons(breakdown: ProjectHealthBreakdown, score: ProjectHealthScore): ProjectHealthReason[] {
  const reasons: Array<ProjectHealthReason | null> = [
    breakdown.blocked > 0
      ? { key: 'blocked', label: `${breakdown.blocked} blocked records`, category: 'execution_pressure', impact: breakdown.blocked * 16, count: breakdown.blocked }
      : null,
    breakdown.dueNow > 0
      ? { key: 'due_now', label: `${breakdown.dueNow} due now`, category: 'execution_pressure', impact: breakdown.dueNow * 14, count: breakdown.dueNow }
      : null,
    breakdown.waitingHeavy > 0
      ? { key: 'waiting_heavy', label: `${breakdown.waitingHeavy} waiting-heavy records`, category: 'execution_pressure', impact: breakdown.waitingHeavy * 8, count: breakdown.waitingHeavy }
      : null,
    breakdown.parentChildRisk > 0
      ? { key: 'parent_child_risk', label: `${breakdown.parentChildRisk} parent/child risk links`, category: 'execution_pressure', impact: breakdown.parentChildRisk * 8, count: breakdown.parentChildRisk }
      : null,
    breakdown.integrityReview > 0
      ? { key: 'integrity_review', label: `${breakdown.integrityReview} records need integrity review`, category: 'cleanup_distortion', impact: breakdown.integrityReview * 12, count: breakdown.integrityReview }
      : null,
    breakdown.cleanupQueue > 0
      ? { key: 'cleanup_queue', label: `${breakdown.cleanupQueue} queue records need cleanup`, category: 'cleanup_distortion', impact: breakdown.cleanupQueue * 10, count: breakdown.cleanupQueue }
      : null,
    breakdown.orphanedTasks > 0
      ? { key: 'orphaned_tasks', label: `${breakdown.orphanedTasks} orphaned tasks`, category: 'cleanup_distortion', impact: breakdown.orphanedTasks * 8, count: breakdown.orphanedTasks }
      : null,
    breakdown.readyToClose > 0
      ? {
        key: 'ready_to_close',
        label: `${breakdown.readyToClose} closeout-ready items`,
        category: 'closeout_opportunity',
        impact: -Math.round(Math.min(24, score.closeoutOpportunity * 0.35)),
        count: breakdown.readyToClose,
      }
      : null,
  ];

  return reasons.filter((entry): entry is ProjectHealthReason => Boolean(entry)).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function summarizeDriver(reasons: ProjectHealthReason[], category: ProjectHealthReason['category'], fallback: string): string {
  return reasons.find((reason) => reason.category === category)?.label ?? fallback;
}

function buildProjectScore(breakdown: ProjectHealthBreakdown, project: ProjectRecord | undefined): ProjectHealthScore {
  const stalePressure = (breakdown.staleActivityDays ?? 0) >= STALE_ACTIVITY_DAYS ? 6 : 0;
  const executionPressure = (
    breakdown.dueNow * 14
    + breakdown.blocked * 16
    + breakdown.overdue * 10
    + breakdown.waitingHeavy * 8
    + breakdown.parentChildRisk * 8
    + breakdown.stalled * 6
    + stalePressure
    + breakdown.openWorkTotal * 2
  );
  const cleanupDistortion = breakdown.cleanupQueue * 10 + breakdown.integrityReview * 12 + breakdown.orphanedTasks * 8;
  const projectCloseoutSignal = project?.closeoutReadiness ? Math.round(project.closeoutReadiness / 20) : 0;
  const closeoutOpportunity = breakdown.readyToClose * 10
    + (breakdown.closeoutPhase && breakdown.openWorkTotal <= 3 ? 8 : 0)
    + projectCloseoutSignal;
  const closeoutRelief = Math.min(24, Math.round(closeoutOpportunity * 0.35));

  return {
    executionPressure,
    cleanupDistortion,
    closeoutOpportunity,
    total: Math.max(0, executionPressure + cleanupDistortion - closeoutRelief),
  };
}

function buildStaleActivityDays(project: ProjectRecord | undefined, rows: UnifiedQueueItem[]): number | undefined {
  const candidates = [project?.updatedAt, project?.lastReviewedAt, ...rows.map((row) => row.updatedAt)].filter(Boolean) as string[];
  if (!candidates.length) return undefined;
  const latest = candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const diff = Date.now() - new Date(latest).getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export function buildProjectHealthReport(context: ReportingContext): ProjectHealthReportResult {
  const byName = new Map(context.projects.map((project) => [normalizeProjectName(project.name), project]));

  const projectNames = new Set<string>([
    ...Object.keys(context.queueByProject),
    ...context.integrity.followUpsNeedingReview.map((item) => item.project),
    ...context.integrity.tasksNeedingReview.map((task) => task.project),
  ]);

  const rankedProjects = [...projectNames]
    .filter(Boolean)
    .map<ProjectHealthRow>((projectName) => {
      const key = normalizeProjectName(projectName);
      const queueRows = context.queue.filter((queueRow) => normalizeProjectName(queueRow.project) === key);
      const project = byName.get(key);
      const openFollowUps = context.openFollowUps.filter((item) => normalizeProjectName(item.project) === key && item.status !== 'Closed');
      const openTasks = context.openTasks.filter((task) => normalizeProjectName(task.project) === key && task.status !== 'Done');
      const reviewFollowUps = context.integrity.followUpsNeedingReview.filter((item) => normalizeProjectName(item.project) === key && item.status !== 'Closed');
      const reviewTasks = context.integrity.tasksNeedingReview.filter((task) => normalizeProjectName(task.project) === key && task.status !== 'Done');

      const breakdown: ProjectHealthBreakdown = {
        openWorkTotal: openFollowUps.length + openTasks.length,
        openFollowUps: openFollowUps.length,
        openTasks: openTasks.length,
        dueNow: queueRows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
        overdue: queueRows.filter((row) => row.queueFlags.overdue).length,
        blocked: queueRows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
        waitingHeavy: queueRows.filter((row) => row.queueFlags.waitingTooLong || row.queueFlags.waiting).length,
        stalled: queueRows.filter((row) => row.queueFlags.deferred).length,
        parentChildRisk: queueRows.filter((row) => row.queueFlags.parentAtRisk || (row.linkedBlockedCount ?? 0) > 0).length,
        cleanupQueue: queueRows.filter((row) => row.queueFlags.cleanupRequired).length,
        integrityReview: reviewFollowUps.length + reviewTasks.length,
        orphanedTasks: queueRows.filter((row) => row.recordType === 'task' && row.queueFlags.orphanedTask).length,
        readyToClose: queueRows.filter((row) => row.queueFlags.readyToCloseParent).length,
        closeoutPhase: project?.status === 'Closeout',
        staleActivityDays: buildStaleActivityDays(project, queueRows),
      };
      const score = buildProjectScore(breakdown, project);
      const reasons = buildReasons(breakdown, score);
      const indicators = buildIndicators(breakdown);

      return {
        id: `project:${project?.id ?? key}`,
        project: project?.name ?? projectName,
        tier: projectTierFromScore(score.total),
        score,
        breakdown,
        indicators,
        topReasonSummary: reasons[0]?.label ?? 'No immediate pressure signal',
        reasons,
        routeContext: {
          projectName: project?.name ?? projectName,
          projectId: project?.id,
        },
      };
    })
    .sort((a, b) => b.score.total - a.score.total || b.breakdown.openWorkTotal - a.breakdown.openWorkTotal || a.project.localeCompare(b.project));

  const drilldownsByProjectId = rankedProjects.reduce<Record<string, ProjectHealthDrilldown>>((acc, row) => {
    const queueRows = context.queue.filter((queueRow) => normalizeProjectName(queueRow.project) === normalizeProjectName(row.project));
    const reviewRows = toReviewRows(row.project, [...context.integrity.followUpsNeedingReview, ...context.integrity.tasksNeedingReview]);
    const pressureRows = queueRows
      .filter((item) => item.queueFlags.overdue || item.queueFlags.dueToday || item.queueFlags.blocked || item.queueFlags.parentAtRisk || item.queueFlags.waitingTooLong)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(toDetailRow);
    const cleanupRows = [
      ...queueRows.filter((item) => item.queueFlags.cleanupRequired || item.queueFlags.orphanedTask).sort((a, b) => b.score - a.score).slice(0, 6).map(toDetailRow),
      ...reviewRows,
    ].slice(0, 8);
    const closeoutRows = queueRows
      .filter((item) => item.queueFlags.readyToCloseParent)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(toDetailRow);

    acc[row.id] = {
      projectId: row.id,
      project: row.project,
      tier: row.tier,
      score: row.score,
      breakdown: row.breakdown,
      indicators: row.indicators,
      reasons: row.reasons,
      summary: {
        topDrivers: row.reasons.slice(0, 3).map((reason) => reason.label),
        biggestRisk: summarizeDriver(row.reasons, 'execution_pressure', 'No immediate execution blocker detected'),
        biggestCleanupDistortion: summarizeDriver(row.reasons, 'cleanup_distortion', 'No major cleanup distortion detected'),
        bestCloseoutOpportunity: summarizeDriver(row.reasons, 'closeout_opportunity', 'No immediate closeout opportunity signal'),
      },
      highestPressureRows: pressureRows,
      cleanupRows,
      closeoutRows,
      routeContext: row.routeContext,
    };

    return acc;
  }, {});

  const criticalOrHighCount = rankedProjects.filter((project) => project.tier === 'Critical' || project.tier === 'High').length;
  const distortionHeavyCount = rankedProjects.filter((project) => project.score.cleanupDistortion >= project.score.executionPressure).length;
  const closeoutOpportunityCount = rankedProjects.filter((project) => project.breakdown.readyToClose > 0 || project.indicators.closeoutReady).length;

  return {
    header: {
      title: 'Project health',
      subtitle: 'Ranked operational health across execution pressure, cleanup distortion, and closeout opportunity.',
      scope: context.scope,
      highlights: [
        {
          id: 'project-under-pressure',
          label: 'Critical / high pressure projects',
          value: criticalOrHighCount,
          tone: criticalOrHighCount > 0 ? 'danger' : 'default',
          helper: 'Execution-heavy risk concentration',
        },
        {
          id: 'project-distorted',
          label: 'Cleanup-distorted projects',
          value: distortionHeavyCount,
          tone: distortionHeavyCount > 0 ? 'warn' : 'default',
          helper: 'Cleanup pressure outweighs execution pressure',
        },
        {
          id: 'project-closeout',
          label: 'Projects with closeout opportunity',
          value: closeoutOpportunityCount,
          tone: 'info',
          helper: 'Projects with clear closeout-ready signals',
        },
        {
          id: 'project-total',
          label: 'Projects represented',
          value: rankedProjects.length,
          tone: 'default',
          helper: 'Projects with open execution or integrity pressure',
        },
      ],
    },
    rankedProjects,
    defaultSelectedProjectId: rankedProjects[0]?.id,
    drilldownsByProjectId,
  };
}
