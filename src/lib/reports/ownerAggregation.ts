import { buildReportTrustSummary } from './reportTrust';
import type {
  OwnerWorkloadBreakdown,
  OwnerWorkloadCategory,
  OwnerWorkloadDetailRow,
  OwnerWorkloadDriver,
  OwnerWorkloadDrilldown,
  OwnerWorkloadReportResult,
  OwnerWorkloadRow,
  OwnerWorkloadScore,
  RankedReason,
  ReportSeverity,
  ReportingContext,
} from './contracts';

function severityFromScore(score: number): ReportSeverity {
  if (score >= 88) return 'critical';
  if (score >= 58) return 'at_risk';
  if (score >= 30) return 'watch';
  return 'stable';
}

function tierFromSeverity(severity: ReportSeverity): OwnerWorkloadDrilldown['tier'] {
  if (severity === 'critical') return 'Overloaded';
  if (severity === 'at_risk') return 'High';
  if (severity === 'watch') return 'Watch';
  return 'Balanced';
}

function scoreOwner(breakdown: OwnerWorkloadBreakdown): OwnerWorkloadScore {
  const volumePressure = breakdown.openTotal * 2 + Math.max(0, breakdown.openTotal - 8) * 1;
  const urgencyPressure = breakdown.overdueTotal * 18 + (breakdown.dueNowTotal - breakdown.overdueTotal) * 11;
  const blockedPressure = breakdown.blockedTotal * 10;
  const waitingPressure = breakdown.waitingTotal * 6 + breakdown.waitingTooLongTotal * 6;
  const cleanupDistortion = breakdown.cleanupTotal * 9;
  const riskConcentration = breakdown.severeTotal * 12;
  const closeoutRelief = Math.min(18, breakdown.closeoutReadyTotal * 4);

  return {
    volumePressure,
    urgencyPressure,
    blockedPressure,
    waitingPressure,
    cleanupDistortion,
    riskConcentration,
    closeoutRelief,
    total: Math.max(0, volumePressure + urgencyPressure + blockedPressure + waitingPressure + cleanupDistortion + riskConcentration - closeoutRelief),
  };
}

function categoryLabel(category: OwnerWorkloadCategory): string {
  if (category === 'urgency_pressure') return 'Urgency pressure';
  if (category === 'blocked_pressure') return 'Blocked pressure';
  if (category === 'waiting_pressure') return 'Waiting/dependency pressure';
  if (category === 'cleanup_distortion') return 'Cleanup distortion';
  if (category === 'risk_concentration') return 'Severe-risk concentration';
  if (category === 'closeout_relief') return 'Closeout relief';
  return 'Raw volume pressure';
}

function buildDrivers(breakdown: OwnerWorkloadBreakdown, score: OwnerWorkloadScore): OwnerWorkloadDriver[] {
  const drivers: Array<OwnerWorkloadDriver | null> = [
    breakdown.openTotal > 0
      ? {
        key: 'volume_open',
        label: `${breakdown.openTotal} open records in queue`,
        category: 'volume_pressure',
        impact: score.volumePressure,
        detail: `${breakdown.followUpOpen} follow-ups and ${breakdown.taskOpen} tasks currently active.`,
      }
      : null,
    breakdown.dueNowTotal > 0
      ? {
        key: 'due_now',
        label: `${breakdown.dueNowTotal} due-now records`,
        category: 'urgency_pressure',
        impact: score.urgencyPressure,
        detail: `${breakdown.overdueTotal} already overdue and requiring immediate intervention.`,
      }
      : null,
    breakdown.blockedTotal > 0
      ? {
        key: 'blocked_work',
        label: `${breakdown.blockedTotal} blocked / parent-at-risk records`,
        category: 'blocked_pressure',
        impact: score.blockedPressure,
        detail: 'Execution is constrained by blockers rather than pure throughput.',
      }
      : null,
    breakdown.waitingTotal > 0
      ? {
        key: 'waiting_dependency',
        label: `${breakdown.waitingTotal} waiting dependency records`,
        category: 'waiting_pressure',
        impact: score.waitingPressure,
        detail: breakdown.waitingTooLongTotal > 0 ? `${breakdown.waitingTooLongTotal} have exceeded expected waiting cadence.` : 'Dependencies are holding forward movement.',
      }
      : null,
    breakdown.cleanupTotal > 0
      ? {
        key: 'cleanup_distortion',
        label: `${breakdown.cleanupTotal} cleanup-distorted records`,
        category: 'cleanup_distortion',
        impact: score.cleanupDistortion,
        detail: 'Data integrity issues may overstate or obscure true execution pressure.',
      }
      : null,
    breakdown.severeTotal > 0
      ? {
        key: 'severe_concentration',
        label: `${breakdown.severeTotal} severe-risk records`,
        category: 'risk_concentration',
        impact: score.riskConcentration,
        detail: 'High-risk concentration requires proactive redistribution or escalation support.',
      }
      : null,
    breakdown.closeoutReadyTotal > 0
      ? {
        key: 'closeout_relief',
        label: `${breakdown.closeoutReadyTotal} closeout opportunities`,
        category: 'closeout_relief',
        impact: -score.closeoutRelief,
        detail: 'Closeout-ready records can reduce load quickly if finalized.',
      }
      : null,
  ];

  return drivers.filter((entry): entry is OwnerWorkloadDriver => Boolean(entry)).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function toReasons(drivers: OwnerWorkloadDriver[]): RankedReason[] {
  return drivers.slice(0, 4).map((driver) => ({ label: driver.label, weight: Math.abs(driver.impact) }));
}

function topPressureCategory(score: OwnerWorkloadScore): OwnerWorkloadCategory {
  const ranked: Array<{ category: OwnerWorkloadCategory; value: number }> = [
    { category: 'volume_pressure', value: score.volumePressure },
    { category: 'urgency_pressure', value: score.urgencyPressure },
    { category: 'blocked_pressure', value: score.blockedPressure },
    { category: 'waiting_pressure', value: score.waitingPressure },
    { category: 'cleanup_distortion', value: score.cleanupDistortion },
    { category: 'risk_concentration', value: score.riskConcentration },
  ];
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0]?.category ?? 'volume_pressure';
}

function detailRowReason(row: ReportingContext['queue'][number]): string {
  if (row.queueFlags.overdue) return 'Overdue commitment';
  if (row.queueFlags.dueToday || row.queueFlags.needsTouchToday) return 'Due-now pressure';
  if (row.queueFlags.blocked || row.queueFlags.parentAtRisk) return 'Blocked / parent at risk';
  if (row.queueFlags.waitingTooLong) return 'Waiting dependency exceeded cadence';
  if (row.queueFlags.waiting) return 'Waiting dependency active';
  if (row.queueFlags.cleanupRequired) return 'Cleanup-distorted record';
  return row.whyInQueue;
}

function toDetailRow(row: ReportingContext['queue'][number]): OwnerWorkloadDetailRow {
  return {
    id: `${row.recordType}:${row.id}`,
    recordType: row.recordType,
    title: row.title,
    project: row.project,
    status: row.status,
    priority: row.priority,
    reason: detailRowReason(row),
    score: row.score,
  };
}

function workloadNarrative(owner: string, dominantPressure: OwnerWorkloadCategory, drivers: OwnerWorkloadDriver[]): string {
  const lead = drivers[0]?.label ?? 'No major pressure signals';
  const second = drivers[1]?.label;
  return second
    ? `${owner} is ranked high primarily from ${categoryLabel(dominantPressure).toLowerCase()} (${lead}), with secondary pressure from ${second.toLowerCase()}.`
    : `${owner} is ranked based on ${categoryLabel(dominantPressure).toLowerCase()} (${lead}).`;
}

export function buildOwnerWorkloadReport(context: ReportingContext): OwnerWorkloadReportResult {
  const projectByName = new Map(context.projects.map((project) => [project.name.trim().toLowerCase(), project]));

  const rankedOwners = Object.entries(context.queueByOwner)
    .map<OwnerWorkloadRow>(([owner, rows]) => {
      const openRows = rows.filter((row) => row.recordType === 'followup' || row.recordType === 'task');
      const breakdown: OwnerWorkloadBreakdown = {
        openTotal: openRows.length,
        followUpOpen: openRows.filter((row) => row.recordType === 'followup').length,
        taskOpen: openRows.filter((row) => row.recordType === 'task').length,
        dueNowTotal: openRows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
        overdueTotal: openRows.filter((row) => row.queueFlags.overdue).length,
        blockedTotal: openRows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
        waitingTotal: openRows.filter((row) => row.queueFlags.waiting).length,
        waitingTooLongTotal: openRows.filter((row) => row.queueFlags.waitingTooLong).length,
        cleanupTotal: openRows.filter((row) => row.queueFlags.cleanupRequired).length,
        severeTotal: openRows.filter((row) => row.priority === 'Critical' || row.escalationLevel === 'Critical' || row.escalationLevel === 'Escalate').length,
        closeoutReadyTotal: openRows.filter((row) => row.queueFlags.readyToCloseParent).length,
      };

      const score = scoreOwner(breakdown);
      const severity = severityFromScore(score.total);
      const drivers = buildDrivers(breakdown, score);
      const dominantPressure = topPressureCategory(score);
      const hottestFollowUp = openRows
        .filter((row) => row.recordType === 'followup')
        .sort((a, b) => b.score - a.score)[0];
      const hottestTask = openRows
        .filter((row) => row.recordType === 'task')
        .sort((a, b) => b.score - a.score)[0];
      const primaryProject = openRows
        .map((row) => row.project)
        .filter(Boolean)
        .sort((a, b) => {
          const aCount = openRows.filter((row) => row.project === a).length;
          const bCount = openRows.filter((row) => row.project === b).length;
          return bCount - aCount;
        })[0];
      const projectRecord = primaryProject ? projectByName.get(primaryProject.trim().toLowerCase()) : undefined;

      return {
        id: `owner:${owner}`,
        label: owner,
        owner,
        tier: tierFromSeverity(severity),
        score,
        breakdown,
        dominantPressure,
        topDriverSummary: drivers[0]?.label ?? 'No immediate pressure signal',
        drivers,
        routeContext: {
          owner,
          primaryProject,
          primaryProjectId: projectRecord?.id,
          hottestFollowUpId: hottestFollowUp?.id,
          hottestTaskId: hottestTask?.id,
        },
        severity,
        reasons: toReasons(drivers),
      };
    })
    .sort((a, b) => b.score.total - a.score.total || b.breakdown.dueNowTotal - a.breakdown.dueNowTotal || a.owner.localeCompare(b.owner));

  const drilldownsByOwnerId = rankedOwners.reduce<Record<string, OwnerWorkloadDrilldown>>((acc, row) => {
    const ownerRows = context.queueByOwner[row.owner] ?? [];
    const highestPressureRows = ownerRows
      .filter((queueRow) => queueRow.queueFlags.overdue || queueRow.queueFlags.dueToday || queueRow.queueFlags.blocked || queueRow.queueFlags.waitingTooLong || queueRow.queueFlags.cleanupRequired)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(toDetailRow);
    const blockedRows = ownerRows
      .filter((queueRow) => queueRow.queueFlags.blocked || queueRow.queueFlags.parentAtRisk || queueRow.queueFlags.waiting)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(toDetailRow);
    const cleanupRows = ownerRows
      .filter((queueRow) => queueRow.queueFlags.cleanupRequired || queueRow.queueFlags.orphanedTask)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(toDetailRow);

    acc[row.id] = {
      owner: row.owner,
      severity: row.severity,
      tier: row.tier,
      score: row.score,
      breakdown: row.breakdown,
      topDriverSummary: row.topDriverSummary,
      narrative: workloadNarrative(row.owner, row.dominantPressure, row.drivers),
      dominantPressure: row.dominantPressure,
      drivers: row.drivers,
      highestPressureRows,
      blockedRows,
      cleanupRows,
      routeContext: row.routeContext,
    };
    return acc;
  }, {});

  const overloadedOwnerCount = rankedOwners.filter((row) => row.tier === 'Overloaded' || row.tier === 'High').length;
  const dueNowHeavyOwnerCount = rankedOwners.filter((row) => row.score.urgencyPressure >= Math.max(row.score.volumePressure, 16)).length;
  const blockedHeavyOwnerCount = rankedOwners.filter((row) => row.score.blockedPressure >= 20).length;
  const waitingHeavyOwnerCount = rankedOwners.filter((row) => row.score.waitingPressure >= 18).length;
  const cleanupDistortedOwnerCount = rankedOwners.filter((row) => row.score.cleanupDistortion >= 18).length;

  return {
    header: {
      title: 'Owner workload',
      subtitle: 'Operational owner capacity report separating volume, urgency, blockers, waiting drag, and cleanup distortion.',
      scope: context.scope,
      trust: buildReportTrustSummary(context),
      highlights: [
        {
          id: 'owner-overloaded',
          label: 'Overloaded / high-pressure owners',
          value: overloadedOwnerCount,
          tone: overloadedOwnerCount > 0 ? 'danger' : 'default',
          helper: 'Owners requiring active load balancing or intervention',
        },
        {
          id: 'owner-due-heavy',
          label: 'Due-now-heavy owners',
          value: dueNowHeavyOwnerCount,
          tone: dueNowHeavyOwnerCount > 0 ? 'warn' : 'default',
          helper: 'Urgency pressure outweighs baseline volume',
        },
        {
          id: 'owner-blocked-heavy',
          label: 'Blocked-heavy owners',
          value: blockedHeavyOwnerCount,
          tone: blockedHeavyOwnerCount > 0 ? 'warn' : 'default',
          helper: 'Blocked throughput is a major pressure source',
        },
        {
          id: 'owner-waiting-heavy',
          label: 'Waiting-heavy owners',
          value: waitingHeavyOwnerCount,
          tone: waitingHeavyOwnerCount > 0 ? 'info' : 'default',
          helper: 'Dependency drag is crowding execution bandwidth',
        },
      ],
    },
    overloadedOwnerCount,
    dueNowHeavyOwnerCount,
    blockedHeavyOwnerCount,
    waitingHeavyOwnerCount,
    cleanupDistortedOwnerCount,
    rankedOwners,
    defaultSelectedOwnerId: rankedOwners[0]?.id,
    drilldownsByOwnerId,
  };
}
