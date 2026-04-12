import { buildReportTrustSummary } from './reportTrust';
import type {
  ExecutiveDrilldown,
  ExecutiveDrilldownRecord,
  ExecutivePressureCategory,
  ExecutivePriorityRow,
  ExecutiveSnapshotBreakdown,
  ExecutiveSnapshotReportResult,
  ExecutiveSnapshotRouteContext,
  ExecutiveSnapshotSection,
  ReportSeverity,
  ReportTone,
  ReportingContext,
} from './contracts';
import type { UnifiedQueueItem } from '../../types';

const MAX_SECTION_ROWS = 8;

function toSeverity(score: number): ReportSeverity {
  if (score >= 130) return 'critical';
  if (score >= 78) return 'at_risk';
  if (score >= 38) return 'watch';
  return 'stable';
}

function severityTone(severity: ReportSeverity): ReportTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'at_risk') return 'warn';
  if (severity === 'watch') return 'info';
  return 'default';
}

function topProjectContext(rows: UnifiedQueueItem[], context: ReportingContext): ExecutiveSnapshotRouteContext {
  if (!rows.length) return {};
  const projectCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.project || 'Unspecified';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const primaryProject = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const projectRecord = primaryProject ? context.projects.find((project) => project.name === primaryProject) : undefined;
  const firstFollowUp = rows.find((row) => row.recordType === 'followup');
  const firstTask = rows.find((row) => row.recordType === 'task');

  return {
    primaryProject,
    primaryProjectId: projectRecord?.id,
    primaryFollowUpId: firstFollowUp?.id,
    primaryTaskId: firstTask?.id,
  };
}

function toBreakdown(rows: UnifiedQueueItem[]): ExecutiveSnapshotBreakdown {
  return {
    totalRecords: rows.length,
    followUpCount: rows.filter((row) => row.recordType === 'followup').length,
    taskCount: rows.filter((row) => row.recordType === 'task').length,
    overdueCount: rows.filter((row) => row.queueFlags.overdue).length,
    dueNowCount: rows.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
    blockedCount: rows.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
    waitingCount: rows.filter((row) => row.queueFlags.waiting).length,
    waitingTooLongCount: rows.filter((row) => row.queueFlags.waitingTooLong).length,
    cleanupCount: rows.filter((row) => row.queueFlags.cleanupRequired).length,
    readyToCloseCount: rows.filter((row) => row.queueFlags.readyToCloseParent).length,
    severeRiskCount: rows.filter((row) => row.priority === 'Critical' || row.escalationLevel === 'Critical').length,
  };
}

function rowReason(row: UnifiedQueueItem): string {
  if (row.queueFlags.overdue) return 'Overdue commitment with immediate execution risk.';
  if (row.queueFlags.blocked) return row.blockReason ? `Blocked: ${row.blockReason}.` : 'Blocked or parent-at-risk execution path.';
  if (row.queueFlags.waitingTooLong) return 'Waiting longer than cadence; dependency drag is building.';
  if (row.queueFlags.cleanupRequired) return 'Cleanup or review-required state is distorting reliable execution.';
  if (row.queueFlags.readyToCloseParent) return 'Closeout opportunity: completion likely closes parent follow-up.';
  if (row.queueFlags.dueToday || row.queueFlags.needsTouchToday) return 'Due/touch timing pressure requires same-day movement.';
  return row.whyInQueue;
}

function toDrilldownRecord(row: UnifiedQueueItem): ExecutiveDrilldownRecord {
  return {
    id: row.id,
    recordType: row.recordType,
    title: row.title,
    project: row.project,
    owner: row.owner,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    reason: rowReason(row),
    score: row.score,
  };
}

function toPriorityCategory(row: UnifiedQueueItem): ExecutivePressureCategory {
  if (row.queueFlags.cleanupRequired) return 'cleanup_distortion';
  if (row.queueFlags.readyToCloseParent) return 'closeout_opportunity';
  if (row.queueFlags.blocked || row.queueFlags.parentAtRisk) return 'blocked_drag';
  if (row.queueFlags.waiting || row.queueFlags.waitingTooLong) return 'waiting_drag';
  return 'urgent_pressure';
}

function narrativeOrFallback(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

export function buildExecutiveSnapshotReport(context: ReportingContext): ExecutiveSnapshotReportResult {
  const urgentRows = context.queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday);
  const blockedRows = context.queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk);
  const waitingRows = context.queue.filter((row) => row.queueFlags.waiting || row.queueFlags.waitingTooLong);
  const closeoutRows = context.queue.filter((row) => row.queueFlags.readyToCloseParent);
  const cleanupRows = context.queue.filter((row) => row.queueFlags.cleanupRequired);

  const sectionSpecs = [
    {
      id: 'needs_action_now',
      title: 'Needs action now',
      subtitle: 'Immediate commitments that will slip or escalate without same-day movement.',
      category: 'urgent_pressure' as const,
      rows: urgentRows,
      recommendations: [
        { label: 'Open urgent Follow Ups', detail: 'Route to Follow Ups now lane and clear the highest timing commitments first.' },
        { label: 'Escalate task execution', detail: 'Open Tasks for now/blocked execution to remove imminent misses.' },
      ],
      summary: (_rows: UnifiedQueueItem[], breakdown: ExecutiveSnapshotBreakdown) => `${breakdown.overdueCount} overdue and ${breakdown.dueNowCount} due-now records are creating immediate delivery pressure.`,
    },
    {
      id: 'biggest_blockers',
      title: 'Biggest blockers',
      subtitle: 'Blocked commitments and at-risk parent paths currently stalling progress.',
      category: 'blocked_drag' as const,
      rows: blockedRows,
      recommendations: [
        { label: 'Open blocked Tasks', detail: 'Route to blocked Tasks and resolve unblock decisions on top stuck work.' },
        { label: 'Open at-risk Follow Ups', detail: 'Route to Follow Ups triage to resolve dependencies and escalation paths.' },
      ],
      summary: (_rows: UnifiedQueueItem[], breakdown: ExecutiveSnapshotBreakdown) => `${breakdown.blockedCount} blocked records are the largest execution drag right now.`,
    },
    {
      id: 'waiting_drag',
      title: 'Waiting / dependency drag',
      subtitle: 'Dependencies waiting too long are reducing throughput and confidence.',
      category: 'waiting_drag' as const,
      rows: waitingRows,
      recommendations: [
        { label: 'Open waiting Follow Ups', detail: 'Route to waiting follow-ups and re-sequence stale dependencies.' },
        { label: 'Inspect dependency owners', detail: 'Use owner workload report to rebalance dependency bottlenecks.' },
      ],
      summary: (_rows: UnifiedQueueItem[], breakdown: ExecutiveSnapshotBreakdown) => `${breakdown.waitingCount} waiting records (${breakdown.waitingTooLongCount} stale) are accumulating drag.`,
    },
    {
      id: 'closeout_opportunities',
      title: 'Closeout opportunities',
      subtitle: 'High-confidence closure candidates that can reduce open-loop load quickly.',
      category: 'closeout_opportunity' as const,
      rows: closeoutRows,
      recommendations: [
        { label: 'Open close-ready Tasks', detail: 'Route to Tasks and complete close-parent actions for quick backlog relief.' },
        { label: 'Confirm closure in Follow Ups', detail: 'Route to Follow Ups to close resolved parent commitments.' },
      ],
      summary: (_rows: UnifiedQueueItem[], breakdown: ExecutiveSnapshotBreakdown) => `${breakdown.readyToCloseCount} records can likely close parent commitments today with focused execution.`,
    },
    {
      id: 'system_distortion',
      title: 'System distortion / cleanup drag',
      subtitle: 'Cleanup and trust quality issues that can distort command-level interpretation.',
      category: 'cleanup_distortion' as const,
      rows: cleanupRows,
      recommendations: [
        { label: 'Route to cleanup workbench', detail: 'Open Data Quality report for remediation-first cleanup sequencing.' },
        { label: 'Open triage lanes', detail: 'Route to follow-up/task triage to resolve top cleanup blockers.' },
      ],
      summary: (_rows: UnifiedQueueItem[], breakdown: ExecutiveSnapshotBreakdown) => `${breakdown.cleanupCount} records currently need cleanup, reducing report trust and execution clarity.`,
    },
  ];

  const sections: ExecutiveSnapshotSection[] = [];
  const drilldownsBySectionId: Record<string, ExecutiveDrilldown> = {};

  sectionSpecs.forEach((spec) => {
    const scoped = spec.rows.slice(0, MAX_SECTION_ROWS);
    if (!scoped.length) return;
    const breakdown = toBreakdown(scoped);
    const rawScore = scoped.reduce((sum, row) => sum + row.score, 0);
    const score = Math.round(rawScore / scoped.length + breakdown.totalRecords * 2);
    const severity = toSeverity(score);
    const topDriver = rowReason(scoped[0]);
    const summary = spec.summary(scoped, breakdown);
    const routeContext = topProjectContext(scoped, context);
    sections.push({
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      pressureCategory: spec.category,
      tone: severityTone(severity),
      severity,
      score,
      count: breakdown.totalRecords,
      topDriver,
      summary,
      breakdown,
      routeContext,
      recommendations: spec.recommendations,
    });
    drilldownsBySectionId[spec.id] = {
      id: spec.id,
      title: spec.title,
      pressureCategory: spec.category,
      severity,
      whyPrioritized: `${breakdown.totalRecords} records currently drive this area. ${topDriver}`,
      pressureStory: summary,
      recommendedNextMove: spec.recommendations[0]?.detail ?? 'Review contributing records and execute next steps.',
      contributingRecords: scoped.map(toDrilldownRecord),
      routeContext,
      recommendations: spec.recommendations,
    };
  });

  const priorityRows: ExecutivePriorityRow[] = context.queue.slice(0, 12).map((row) => ({
    id: `${row.recordType}:${row.id}`,
    recordId: row.id,
    recordType: row.recordType,
    title: row.title,
    project: row.project,
    owner: row.owner,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    pressureCategory: toPriorityCategory(row),
    urgencyLabel: row.queueFlags.overdue ? 'Overdue' : row.queueFlags.dueToday ? 'Due today' : row.queueFlags.blocked ? 'Blocked' : row.queueFlags.waitingTooLong ? 'Waiting too long' : row.queueFlags.readyToCloseParent ? 'Close-ready' : 'Queue pressure',
    score: row.score,
    reasonSummary: rowReason(row),
    routeContext: {
      primaryProject: row.project,
      primaryProjectId: context.projects.find((project) => project.name === row.project)?.id,
      primaryFollowUpId: row.recordType === 'followup' ? row.id : row.linkedFollowUpId,
      primaryTaskId: row.recordType === 'task' ? row.id : undefined,
    },
  }));

  const drilldownsByPriorityId: Record<string, ExecutiveDrilldown> = priorityRows.reduce<Record<string, ExecutiveDrilldown>>((acc, row) => {
    const queueRow = context.queue.find((entry) => entry.id === row.recordId && entry.recordType === row.recordType);
    const nearby = context.queue
      .filter((entry) => entry.project === row.project || entry.owner === row.owner)
      .slice(0, 6);

    acc[row.id] = {
      id: row.id,
      title: row.title,
      pressureCategory: row.pressureCategory,
      severity: toSeverity(row.score),
      whyPrioritized: row.reasonSummary,
      pressureStory: `${row.title} is a top queue-pressure record for ${row.project}.`,
      recommendedNextMove: queueRow?.primaryNextAction || 'Open this record and execute the next committed move.',
      contributingRecords: (nearby.length ? nearby : queueRow ? [queueRow] : []).map(toDrilldownRecord),
      routeContext: row.routeContext,
      recommendations: [
        { label: 'Open execution lane', detail: 'Route directly to the record lane and execute the primary next action.' },
        { label: 'Inspect related pressure', detail: 'Review nearby project/owner records before reprioritizing.' },
      ],
    };
    return acc;
  }, {});

  const biggestPressure = sections.find((section) => section.pressureCategory === 'urgent_pressure');
  const biggestBlocker = sections.find((section) => section.pressureCategory === 'blocked_drag' || section.pressureCategory === 'waiting_drag');
  const biggestCloseout = sections.find((section) => section.pressureCategory === 'closeout_opportunity');
  const biggestDistortion = sections.find((section) => section.pressureCategory === 'cleanup_distortion');

  return {
    header: {
      title: 'Executive snapshot',
      subtitle: 'Command-level view of immediate pressure, systemic drag, closeout potential, and trust distortion.',
      scope: context.scope,
      trust: buildReportTrustSummary(context),
      highlights: [
        { id: 'urgent', label: 'Urgent pressure', value: urgentRows.length, helper: 'Overdue, due-today, and touch-due records.', tone: urgentRows.length ? 'danger' : 'default' },
        { id: 'blocked', label: 'Blocked drag', value: blockedRows.length, helper: 'Blocked or parent-at-risk execution paths.', tone: blockedRows.length ? 'warn' : 'default' },
        { id: 'waiting', label: 'Waiting drag', value: waitingRows.length, helper: 'Dependency stall and waiting-too-long records.', tone: waitingRows.length ? 'warn' : 'default' },
        { id: 'close', label: 'Closeout opportunities', value: closeoutRows.length, helper: 'Records that can likely close parent commitments.', tone: closeoutRows.length ? 'default' : 'info' },
        { id: 'cleanup', label: 'Cleanup distortion', value: cleanupRows.length, helper: 'Records reducing trust and scanability.', tone: cleanupRows.length ? 'info' : 'default' },
        { id: 'open-work', label: 'Open execution records', value: context.scope.openExecutionRecords, helper: `${context.scope.openFollowUps} follow-ups • ${context.scope.openTasks} tasks`, tone: 'default' },
      ],
    },
    narrative: {
      biggestPressureDriver: narrativeOrFallback(biggestPressure ? `${biggestPressure.count} urgent records: ${biggestPressure.topDriver}` : undefined, 'No major urgent pressure is currently detected.'),
      biggestDragFactor: narrativeOrFallback(biggestBlocker ? `${biggestBlocker.title}: ${biggestBlocker.summary}` : undefined, 'No major blocker or dependency drag is currently detected.'),
      biggestQuickWinOpportunity: narrativeOrFallback(biggestCloseout ? biggestCloseout.summary : undefined, 'No immediate closeout cluster is currently visible.'),
      biggestTrustDistortionWarning: narrativeOrFallback(biggestDistortion ? biggestDistortion.summary : undefined, 'Cleanup distortion is currently limited in this scope.'),
    },
    sections,
    priorityRows,
    defaultSelectedSectionId: sections[0]?.id,
    defaultSelectedPriorityId: priorityRows[0]?.id,
    drilldownsBySectionId,
    drilldownsByPriorityId,
  };
}
