import type { SupportLinkedWorkPreview, SupportPressureSignal, SupportPressureSummary, SupportPressureTier, SupportRecordSurface, SupportSummaryStripMetrics } from './types';

function scoreToTier(score: number): SupportPressureTier {
  if (score >= 34) return 'critical';
  if (score >= 20) return 'high';
  if (score >= 10) return 'moderate';
  return 'low';
}

export function buildSupportPressureSummary(input: {
  openFollowUps: number;
  openTasks: number;
  overdueFollowUps: number;
  overdueTasks: number;
  blockedTasks: number;
  waitingFollowUps: number;
  staleDays?: number;
  closeoutSignals?: number;
  riskSignals?: number;
  docReviewSignals?: number;
}): SupportPressureSummary {
  const overduePressure = input.overdueFollowUps + input.overdueTasks;
  const blockedPressure = input.blockedTasks;
  const waitingPressure = input.waitingFollowUps;
  const stalePressure = Math.max(0, (input.staleDays ?? 0) - 10);
  const closeoutPressure = input.closeoutSignals ?? 0;
  const riskPressure = input.riskSignals ?? 0;
  const docReviewPressure = input.docReviewSignals ?? 0;

  const score = (
    input.openFollowUps
    + input.openTasks
    + overduePressure * 3
    + blockedPressure * 4
    + waitingPressure * 2
    + Math.min(stalePressure, 12)
    + closeoutPressure * 2
    + riskPressure * 3
    + docReviewPressure * 2
  );

  const topSignals: SupportPressureSignal[] = [
    overduePressure > 0 ? 'overdue' : null,
    blockedPressure > 0 ? 'blocked' : null,
    waitingPressure > 0 ? 'waiting' : null,
    stalePressure > 0 ? 'stale' : null,
    closeoutPressure > 0 ? 'closeout' : null,
    riskPressure > 0 ? 'at_risk' : null,
    docReviewPressure > 0 ? 'doc_review' : null,
  ].filter(Boolean) as SupportPressureSignal[];

  const whyNow = topSignals[0] === 'overdue'
    ? `${overduePressure} overdue commitments need action.`
    : topSignals[0] === 'blocked'
      ? `${blockedPressure} blocked tasks need unblocking.`
      : topSignals[0] === 'waiting'
        ? `${waitingPressure} waiting commitments need follow-through.`
        : topSignals[0] === 'stale'
          ? `Context has been stale for ${input.staleDays ?? 0} days.`
          : topSignals[0] === 'closeout'
            ? `${closeoutPressure} closeout signals are present.`
            : topSignals[0] === 'at_risk'
              ? `${riskPressure} high-risk signals need coordination.`
              : topSignals[0] === 'doc_review'
                ? `${docReviewPressure} documentation review signals are open.`
                : 'No immediate pressure signal; review open work and next move.';

  return {
    score,
    tier: scoreToTier(score),
    openFollowUpPressure: input.openFollowUps,
    openTaskPressure: input.openTasks,
    overduePressure,
    blockedPressure,
    waitingPressure,
    stalePressure,
    closeoutPressure,
    riskPressure,
    topSignals,
    whyNow,
  };
}

export function buildSupportLinkedWorkPreview(input: {
  followUpIds: string[];
  taskIds: string[];
  overdueFollowUps: number;
  waitingFollowUps: number;
  blockedTasks: number;
  overdueTasks: number;
  previewLimit?: number;
}): SupportLinkedWorkPreview {
  const limit = input.previewLimit ?? 8;
  return {
    followUps: {
      totalOpen: input.followUpIds.length,
      overdue: input.overdueFollowUps,
      waiting: input.waitingFollowUps,
      previewIds: input.followUpIds.slice(0, limit),
    },
    tasks: {
      totalOpen: input.taskIds.length,
      blocked: input.blockedTasks,
      overdue: input.overdueTasks,
      previewIds: input.taskIds.slice(0, limit),
    },
  };
}

export function buildSupportSummaryStripMetrics(rows: SupportRecordSurface[]): SupportSummaryStripMetrics {
  return rows.reduce((acc, row) => {
    if (row.pressure.tier === 'high' || row.pressure.tier === 'critical') acc.underPressure += 1;
    acc.overdue += row.pressure.overduePressure;
    acc.blocked += row.pressure.blockedPressure;
    acc.waiting += row.pressure.waitingPressure;
    return acc;
  }, { underPressure: 0, overdue: 0, blocked: 0, waiting: 0 });
}
