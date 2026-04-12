import type { OwnerWorkloadReportResult, OwnerWorkloadRow, RankedReason, ReportSeverity, ReportingContext } from './contracts';

function severityFromScore(score: number): ReportSeverity {
  if (score >= 75) return 'critical';
  if (score >= 52) return 'at_risk';
  if (score >= 30) return 'watch';
  return 'stable';
}

function scoreOwner(openTotal: number, blockedTotal: number, dueNowTotal: number, waitingTotal: number) {
  return openTotal * 3 + blockedTotal * 8 + dueNowTotal * 7 + waitingTotal * 4;
}

function reasonsForOwner(openTotal: number, blockedTotal: number, dueNowTotal: number, waitingTotal: number): RankedReason[] {
  return [
    blockedTotal ? { label: `${blockedTotal} blocked`, weight: blockedTotal * 8 } : null,
    dueNowTotal ? { label: `${dueNowTotal} due now`, weight: dueNowTotal * 7 } : null,
    waitingTotal ? { label: `${waitingTotal} waiting`, weight: waitingTotal * 4 } : null,
    { label: `${openTotal} open`, weight: openTotal * 3 },
  ].filter((entry): entry is RankedReason => Boolean(entry)).sort((a, b) => b.weight - a.weight);
}

export function buildOwnerWorkloadReport(context: ReportingContext): OwnerWorkloadReportResult {
  const rankedOwners = Object.entries(context.queueByOwner)
    .map<OwnerWorkloadRow>(([owner, rows]) => {
      const openTotal = rows.length;
      const blockedTotal = rows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length;
      const dueNowTotal = rows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length;
      const waitingTotal = rows.filter((row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong).length;
      const score = scoreOwner(openTotal, blockedTotal, dueNowTotal, waitingTotal);
      return {
        id: `owner:${owner}`,
        label: owner,
        owner,
        openTotal,
        blockedTotal,
        dueNowTotal,
        waitingTotal,
        score,
        severity: severityFromScore(score),
        reasons: reasonsForOwner(openTotal, blockedTotal, dueNowTotal, waitingTotal),
      };
    })
    .sort((a, b) => b.score - a.score || b.openTotal - a.openTotal);

  return {
    header: {
      title: 'Owner workload',
      subtitle: 'Owner-level workload ranking balancing total volume, due-now pressure, blocked work, and waiting dependencies.',
      scope: context.scope,
      highlights: [
        { id: 'owner-count', label: 'Owners in queue', value: rankedOwners.length, tone: 'default' },
        { id: 'owner-due', label: 'Due now', value: context.executionStats.due, tone: 'danger' },
        { id: 'owner-blocked', label: 'Blocked', value: context.executionStats.blocked, tone: 'warn' },
      ],
    },
    rankedOwners,
  };
}
