import type { FollowUpRiskReportResult, FollowUpRiskRow, RankedReason, ReportSeverity, ReportingContext } from './contracts';

function severityFromScore(score: number): ReportSeverity {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'at_risk';
  if (score >= 20) return 'watch';
  return 'stable';
}

function scoreFollowUp(row: ReportingContext['queueFollowUps'][number]) {
  return (row.queueFlags.overdue ? 30 : 0)
    + (row.queueFlags.dueToday ? 18 : 0)
    + (row.queueFlags.needsTouchToday ? 10 : 0)
    + (row.queueFlags.blocked ? 14 : 0)
    + (row.queueFlags.waiting ? 8 : 0)
    + (row.queueFlags.waitingTooLong ? 8 : 0)
    + ((row.linkedBlockedCount ?? 0) * 5)
    + ((row.linkedOverdueTaskCount ?? 0) * 4)
    + (row.queueFlags.cleanupRequired ? 4 : 0);
}

function reasonsForRow(row: ReportingContext['queueFollowUps'][number]): RankedReason[] {
  return [
    row.queueFlags.overdue ? { label: 'Overdue commitment', weight: 30 } : null,
    row.queueFlags.dueToday ? { label: 'Due now', weight: 18 } : null,
    row.queueFlags.blocked ? { label: 'Blocked / escalated', weight: 14 } : null,
    row.queueFlags.waiting ? { label: 'Waiting dependency', weight: 8 } : null,
    row.queueFlags.waitingTooLong ? { label: 'Waiting too long', weight: 8 } : null,
    (row.linkedBlockedCount ?? 0) > 0 ? { label: `${row.linkedBlockedCount} blocked child tasks`, weight: (row.linkedBlockedCount ?? 0) * 5 } : null,
    (row.linkedOverdueTaskCount ?? 0) > 0 ? { label: `${row.linkedOverdueTaskCount} overdue child tasks`, weight: (row.linkedOverdueTaskCount ?? 0) * 4 } : null,
  ].filter((entry): entry is RankedReason => Boolean(entry)).sort((a, b) => b.weight - a.weight);
}

export function buildFollowUpRiskReport(context: ReportingContext): FollowUpRiskReportResult {
  const rankedFollowUps = context.queueFollowUps
    .map<FollowUpRiskRow>((row) => {
      const score = scoreFollowUp(row);
      return {
        id: `followup-risk:${row.id}`,
        label: row.title,
        followUpId: row.id,
        title: row.title,
        project: row.project,
        owner: row.owner,
        dueDate: row.dueDate,
        waitingOn: row.waitingOn,
        score,
        severity: severityFromScore(score),
        reasons: reasonsForRow(row),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const highRiskCount = rankedFollowUps.filter((row) => row.severity === 'critical' || row.severity === 'at_risk').length;
  const watchCount = rankedFollowUps.filter((row) => row.severity === 'watch').length;
  const stableCount = rankedFollowUps.filter((row) => row.severity === 'stable').length;

  return {
    header: {
      title: 'Follow-up risk',
      subtitle: 'Risk-ranked follow-up commitments based on due-now pressure, waiting dependencies, and child-task blockage signals.',
      scope: context.scope,
      highlights: [
        { id: 'risk-due', label: 'Due now', value: context.executionStats.due, tone: 'danger' },
        { id: 'risk-blocked', label: 'Blocked', value: context.executionStats.blocked, tone: 'warn' },
        { id: 'risk-followups', label: 'Open follow-ups', value: context.queueFollowUps.length, tone: 'default' },
      ],
    },
    highRiskCount,
    watchCount,
    stableCount,
    rankedFollowUps,
  };
}
