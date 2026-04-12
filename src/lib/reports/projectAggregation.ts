import type { ProjectHealthReportResult, ProjectHealthRow, RankedReason, ReportSeverity, ReportingContext } from './contracts';

function severityFromScore(score: number): ReportSeverity {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'at_risk';
  if (score >= 30) return 'watch';
  return 'stable';
}

function buildReasons(row: {
  blockedTotal: number;
  dueNowTotal: number;
  cleanupTotal: number;
  readyToCloseTotal: number;
  openTotal: number;
}): RankedReason[] {
  return [
    row.blockedTotal > 0 ? { label: `${row.blockedTotal} blocked`, weight: row.blockedTotal * 10 } : null,
    row.dueNowTotal > 0 ? { label: `${row.dueNowTotal} due now`, weight: row.dueNowTotal * 8 } : null,
    row.cleanupTotal > 0 ? { label: `${row.cleanupTotal} need cleanup`, weight: row.cleanupTotal * 6 } : null,
    row.readyToCloseTotal > 0 ? { label: `${row.readyToCloseTotal} ready to close`, weight: row.readyToCloseTotal * 5 } : null,
    { label: `${row.openTotal} open total`, weight: row.openTotal * 2 },
  ].filter((entry): entry is RankedReason => Boolean(entry)).sort((a, b) => b.weight - a.weight);
}

function scoreProject(row: {
  blockedTotal: number;
  dueNowTotal: number;
  cleanupTotal: number;
  readyToCloseTotal: number;
  openTotal: number;
}) {
  return Math.max(0, row.blockedTotal * 10 + row.dueNowTotal * 8 + row.cleanupTotal * 6 + row.openTotal * 2 - row.readyToCloseTotal * 3);
}

export function buildProjectHealthReport(context: ReportingContext): ProjectHealthReportResult {
  const rankedProjects = Object.entries(context.queueByProject)
    .map<ProjectHealthRow>(([project, rows]) => {
      const openTotal = rows.length;
      const blockedTotal = rows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length;
      const cleanupTotal = rows.filter((row) => row.queueFlags.cleanupRequired).length;
      const dueNowTotal = rows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length;
      const readyToCloseTotal = rows.filter((row) => row.queueFlags.readyToCloseParent).length;
      const score = scoreProject({ blockedTotal, dueNowTotal, cleanupTotal, readyToCloseTotal, openTotal });

      return {
        id: `project:${project}`,
        label: project,
        project,
        openTotal,
        blockedTotal,
        cleanupTotal,
        dueNowTotal,
        readyToCloseTotal,
        score,
        severity: severityFromScore(score),
        reasons: buildReasons({ blockedTotal, dueNowTotal, cleanupTotal, readyToCloseTotal, openTotal }),
      };
    })
    .sort((a, b) => b.score - a.score || b.openTotal - a.openTotal);

  return {
    header: {
      title: 'Project health',
      subtitle: 'Ranked project pressure with blocked, cleanup, due-now, and closeout opportunity signals.',
      scope: context.scope,
      highlights: [
        { id: 'project-total', label: 'Projects with open work', value: rankedProjects.length, tone: 'default' },
        { id: 'project-blocked', label: 'Blocked records', value: context.executionStats.blocked, tone: 'warn' },
        { id: 'project-cleanup', label: 'Cleanup pressure', value: context.executionStats.cleanup, tone: 'info' },
        { id: 'project-closeout', label: 'Ready to close', value: context.executionStats.closeable, tone: 'default' },
      ],
    },
    rankedProjects,
  };
}
