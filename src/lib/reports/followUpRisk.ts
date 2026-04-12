import { localDayDelta } from '../utils';
import { buildReportTrustSummary } from './reportTrust';
import type {
  FollowUpRiskBreakdown,
  FollowUpRiskCategory,
  FollowUpRiskDriver,
  FollowUpRiskDrilldown,
  FollowUpRiskReportResult,
  FollowUpRiskRow,
  FollowUpRiskScore,
  RankedReason,
  ReportSeverity,
  ReportingContext,
} from './contracts';

function severityFromScore(score: number): ReportSeverity {
  if (score >= 78) return 'critical';
  if (score >= 50) return 'at_risk';
  if (score >= 24) return 'watch';
  return 'stable';
}

function tierFromSeverity(severity: ReportSeverity): FollowUpRiskRow['tier'] {
  if (severity === 'critical') return 'Severe';
  if (severity === 'at_risk') return 'High';
  if (severity === 'watch') return 'Watch';
  return 'Stable';
}

function scoreFromDrivers(drivers: FollowUpRiskDriver[]): FollowUpRiskScore {
  const score: FollowUpRiskScore = {
    total: 0,
    timingPressure: 0,
    dependencyWaiting: 0,
    executionBlock: 0,
    cleanupDistortion: 0,
    escalationRisk: 0,
    missingPlan: 0,
  };

  drivers.forEach((driver) => {
    score.total += driver.impact;
    if (driver.category === 'timing_pressure') score.timingPressure += driver.impact;
    if (driver.category === 'dependency_waiting') score.dependencyWaiting += driver.impact;
    if (driver.category === 'execution_block') score.executionBlock += driver.impact;
    if (driver.category === 'cleanup_distortion') score.cleanupDistortion += driver.impact;
    if (driver.category === 'escalation_risk') score.escalationRisk += driver.impact;
    if (driver.category === 'missing_plan') score.missingPlan += driver.impact;
  });

  return score;
}

function toRankedReasons(drivers: FollowUpRiskDriver[]): RankedReason[] {
  return drivers.slice(0, 4).map((driver) => ({ label: driver.label, weight: driver.impact }));
}

function topRiskCategory(drivers: FollowUpRiskDriver[]): FollowUpRiskCategory {
  return drivers[0]?.category ?? 'timing_pressure';
}

function buildBreakdown(row: ReportingContext['queueFollowUps'][number], staleTouchDays?: number): FollowUpRiskBreakdown {
  const dueInDays = row.dueDate ? localDayDelta(new Date(), row.dueDate) : undefined;
  const nextTouchInDays = row.nextTouchDate ? localDayDelta(new Date(), row.nextTouchDate) : undefined;
  const promisedInDays = row.promisedDate ? localDayDelta(new Date(), row.promisedDate) : undefined;

  return {
    dueInDays,
    nextTouchInDays,
    promisedInDays,
    waitingOn: row.waitingOn,
    waitingTooLong: row.queueFlags.waitingTooLong,
    blocked: row.queueFlags.blocked || row.queueFlags.parentAtRisk,
    escalated: row.escalationLevel === 'Escalate' || row.escalationLevel === 'Critical',
    linkedTaskCount: row.linkedTaskCount ?? 0,
    linkedOpenTaskCount: row.linkedOpenTaskCount ?? 0,
    linkedBlockedTaskCount: row.linkedBlockedCount ?? 0,
    linkedOverdueTaskCount: row.linkedOverdueTaskCount ?? 0,
    cleanupRequired: row.queueFlags.cleanupRequired,
    staleTouchDays,
    staleMoveDays: staleTouchDays,
  };
}

function buildDrivers({ row, breakdown }: { row: ReportingContext['queueFollowUps'][number]; breakdown: FollowUpRiskBreakdown }): FollowUpRiskDriver[] {
  const drivers: Array<FollowUpRiskDriver | null> = [
    row.queueFlags.overdue
      ? { key: 'overdue_commitment', label: 'Overdue commitment date', category: 'timing_pressure', impact: 30, detail: 'Due date is in the past.' }
      : null,
    row.queueFlags.dueToday
      ? { key: 'due_today', label: 'Commitment due today', category: 'timing_pressure', impact: 20, detail: 'Requires same-day follow-through.' }
      : null,
    row.queueFlags.needsTouchToday
      ? { key: 'touch_now', label: 'Next touch is due now', category: 'timing_pressure', impact: 14, detail: 'Follow-up touch cadence has reached today.' }
      : null,
    breakdown.promisedInDays !== undefined && breakdown.promisedInDays <= 1
      ? { key: 'promised_window', label: 'Promised date pressure', category: 'timing_pressure', impact: breakdown.promisedInDays < 0 ? 18 : 12, detail: 'Commitment promise window is immediate.' }
      : null,
    row.queueFlags.waiting
      ? { key: 'waiting_dependency', label: 'Waiting dependency unresolved', category: 'dependency_waiting', impact: 10, detail: `Waiting on ${row.waitingOn || 'external response'}.` }
      : null,
    row.queueFlags.waitingTooLong
      ? { key: 'waiting_too_long', label: 'Waiting too long without movement', category: 'dependency_waiting', impact: 14, detail: 'Dependency wait has exceeded expected cadence.' }
      : null,
    (row.linkedBlockedCount ?? 0) > 0
      ? {
        key: 'blocked_children',
        label: `${row.linkedBlockedCount} blocked linked tasks`,
        category: 'execution_block',
        impact: Math.min(24, (row.linkedBlockedCount ?? 0) * 8),
        detail: 'Linked execution tasks are blocked.',
      }
      : null,
    (row.linkedOverdueTaskCount ?? 0) > 0
      ? {
        key: 'overdue_children',
        label: `${row.linkedOverdueTaskCount} overdue linked tasks`,
        category: 'execution_block',
        impact: Math.min(20, (row.linkedOverdueTaskCount ?? 0) * 6),
        detail: 'Child task slippage is pressuring this commitment.',
      }
      : null,
    row.queueFlags.blocked || row.queueFlags.parentAtRisk
      ? { key: 'blocked_state', label: 'Follow-up is blocked / parent-at-risk', category: 'execution_block', impact: 16, detail: 'Current workflow state indicates blockage.' }
      : null,
    row.queueFlags.cleanupRequired
      ? { key: 'cleanup_distortion', label: 'Cleanup/trust distortion present', category: 'cleanup_distortion', impact: 10, detail: 'Data integrity issues may distort execution confidence.' }
      : null,
    row.escalationLevel === 'Critical'
      ? { key: 'critical_escalation', label: 'Critical escalation active', category: 'escalation_risk', impact: 20, detail: 'Escalation already reached critical severity.' }
      : row.escalationLevel === 'Escalate'
        ? { key: 'escalate_state', label: 'Escalation level: Escalate', category: 'escalation_risk', impact: 14, detail: 'Escalation has been explicitly raised.' }
        : row.escalationLevel === 'Watch'
          ? { key: 'watch_state', label: 'Escalation watch signal', category: 'escalation_risk', impact: 8, detail: 'Watch-level escalation may need preemptive intervention.' }
          : null,
    !row.primaryNextAction || row.primaryNextAction.trim().length < 12
      ? { key: 'weak_next_step', label: 'Weak next-step clarity', category: 'missing_plan', impact: 10, detail: 'Next move is unclear or too thin for handoff confidence.' }
      : null,
    !row.owner || row.owner.toLowerCase() === 'unassigned'
      ? { key: 'missing_owner', label: 'No clear owner assignment', category: 'missing_plan', impact: 16, detail: 'Commitment lacks accountable owner.' }
      : null,
  ];

  return drivers.filter((entry): entry is FollowUpRiskDriver => Boolean(entry)).sort((a, b) => b.impact - a.impact);
}

function summaryForDrivers(drivers: FollowUpRiskDriver[]): string {
  if (!drivers.length) return 'No major risk pressure signals detected.';
  if (drivers.length === 1) return drivers[0].label;
  return `${drivers[0].label}; also ${drivers[1].label.toLowerCase()}.`;
}

function recommendNextMove(row: ReportingContext['queueFollowUps'][number] | undefined, drivers: FollowUpRiskDriver[]): string {
  const categories = new Set(drivers.slice(0, 3).map((driver) => driver.category));
  if (categories.has('execution_block')) return 'Clear linked-task blockers first, then confirm the follow-up next touch and owner handoff.';
  if (categories.has('timing_pressure')) return 'Run this commitment in today’s lane and explicitly confirm due/promise timing with stakeholders.';
  if (categories.has('dependency_waiting')) return 'Send a dependency nudge now and set a concrete next-touch checkpoint.';
  if (categories.has('missing_plan')) return 'Tighten execution clarity: assign owner, write a concrete next move, and set touch cadence.';
  if (categories.has('cleanup_distortion')) return 'Resolve cleanup flags before relying on this follow-up as execution truth.';
  if (row && (row.escalationLevel === 'Escalate' || row.escalationLevel === 'Critical')) return 'Escalation is active—align on intervention owner and immediate recovery steps.';
  return 'Review this follow-up in execution context and set the next concrete move.';
}

export function buildFollowUpRiskReport(context: ReportingContext): FollowUpRiskReportResult {
  const openFollowUpById = new Map(context.openFollowUps.map((item) => [item.id, item]));
  const projectByName = new Map(context.projects.map((project) => [project.name.trim().toLowerCase(), project]));

  const rankedFollowUps = context.queueFollowUps
    .map<FollowUpRiskRow>((row) => {
      const followUp = openFollowUpById.get(row.id);
      const staleTouchDays = followUp?.lastTouchDate ? Math.max(0, localDayDelta(followUp.lastTouchDate, new Date())) : undefined;
      const breakdown = buildBreakdown(row, staleTouchDays);
      const drivers = buildDrivers({ row, breakdown });
      const score = scoreFromDrivers(drivers);
      const severity = severityFromScore(score.total);
      const projectRecord = projectByName.get(row.project.trim().toLowerCase());
      const topCategory = topRiskCategory(drivers);

      return {
        id: `followup-risk:${row.id}`,
        label: row.title,
        followUpId: row.id,
        title: row.title,
        project: row.project,
        owner: row.owner,
        status: row.status,
        priority: row.priority,
        dueDate: row.dueDate,
        nextTouchDate: row.nextTouchDate,
        waitingOn: row.waitingOn,
        score: score.total,
        riskScore: score,
        severity,
        tier: tierFromSeverity(severity),
        topRiskCategory: topCategory,
        topRiskSummary: summaryForDrivers(drivers),
        breakdown,
        drivers,
        routeContext: {
          followUpId: row.id,
          projectName: row.project,
          projectId: projectRecord?.id,
          primaryTaskId: context.tasks.find((task) => task.linkedFollowUpId === row.id && task.status !== 'Done')?.id,
        },
        reasons: toRankedReasons(drivers),
      };
    })
    .sort((a, b) => b.score - a.score || b.riskScore.timingPressure - a.riskScore.timingPressure || a.title.localeCompare(b.title))
    .slice(0, Math.max(8, context.scope.openFollowUps > 0 ? 16 : 8));

  const drilldownsByFollowUpId = rankedFollowUps.reduce<Record<string, FollowUpRiskDrilldown>>((acc, row) => {
    acc[row.followUpId] = {
      followUpId: row.followUpId,
      title: row.title,
      project: row.project,
      owner: row.owner,
      severity: row.severity,
      tier: row.tier,
      status: row.status,
      priority: row.priority,
      score: row.riskScore,
      breakdown: row.breakdown,
      drivers: row.drivers,
      topRiskCategory: row.topRiskCategory,
      riskSummary: row.topRiskSummary,
      recommendedNextMove: recommendNextMove(context.queueFollowUps.find((queueRow) => queueRow.id === row.followUpId), row.drivers),
      routeContext: row.routeContext,
    };
    return acc;
  }, {});

  const highRiskCount = rankedFollowUps.filter((row) => row.severity === 'critical' || row.severity === 'at_risk').length;
  const watchCount = rankedFollowUps.filter((row) => row.severity === 'watch').length;
  const stableCount = rankedFollowUps.filter((row) => row.severity === 'stable').length;

  const dueNowRiskCount = rankedFollowUps.filter((row) => row.breakdown.dueInDays !== undefined && row.breakdown.dueInDays <= 0).length;
  const waitingDependencyRiskCount = rankedFollowUps.filter((row) => row.riskScore.dependencyWaiting > 0).length;
  const blockedExecutionRiskCount = rankedFollowUps.filter((row) => row.riskScore.executionBlock > 0).length;
  const escalationRiskCount = rankedFollowUps.filter((row) => row.riskScore.escalationRisk > 0).length;
  const cleanupDistortedCount = rankedFollowUps.filter((row) => row.riskScore.cleanupDistortion > 0).length;

  return {
    header: {
      title: 'Follow-up risk',
      subtitle: 'Operational commitment risk ranked by timing pressure, dependency drag, execution blockers, and plan clarity gaps.',
      scope: context.scope,
      trust: buildReportTrustSummary(context),
      highlights: [
        {
          id: 'followup-severe',
          label: 'Severe / high risk follow-ups',
          value: highRiskCount,
          tone: highRiskCount > 0 ? 'danger' : 'default',
          helper: 'Immediate intervention candidates',
        },
        {
          id: 'followup-due-now',
          label: 'Due-now pressure',
          value: dueNowRiskCount,
          tone: dueNowRiskCount > 0 ? 'warn' : 'default',
          helper: 'Overdue or due-today commitments',
        },
        {
          id: 'followup-blocked',
          label: 'Execution blocked by child work',
          value: blockedExecutionRiskCount,
          tone: blockedExecutionRiskCount > 0 ? 'warn' : 'default',
          helper: 'Blocked state or linked blocked/overdue tasks',
        },
        {
          id: 'followup-waiting',
          label: 'Waiting/dependency risk',
          value: waitingDependencyRiskCount,
          tone: waitingDependencyRiskCount > 0 ? 'info' : 'default',
          helper: 'Waiting pressure requiring explicit nudges',
        },
      ],
    },
    highRiskCount,
    watchCount,
    stableCount,
    dueNowRiskCount,
    waitingDependencyRiskCount,
    blockedExecutionRiskCount,
    escalationRiskCount,
    cleanupDistortedCount,
    rankedFollowUps,
    defaultSelectedFollowUpId: rankedFollowUps[0]?.followUpId,
    drilldownsByFollowUpId,
  };
}
