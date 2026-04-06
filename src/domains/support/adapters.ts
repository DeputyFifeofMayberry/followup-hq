import type { ProjectDerivedRecord } from '../../lib/projectSelectors';
import type { RelationshipSummary } from '../../lib/relationshipSelectors';
import { buildSupportLinkedWorkPreview, buildSupportPressureSummary } from './engine';
import { recommendSupportRoute } from './routePolicy';
import type { SupportRecordSurface } from './types';

function toRiskTier(value?: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (value === 'Critical' || value === 'High' || value === 'Medium') return value;
  return 'Low';
}

export function mapProjectRowToSupportSurface(row: ProjectDerivedRecord): SupportRecordSurface {
  const pressure = buildSupportPressureSummary({
    openFollowUps: row.openFollowUps.length,
    openTasks: row.openTasks.length,
    overdueFollowUps: row.health.breakdown.overdueFollowUps,
    overdueTasks: row.health.breakdown.overdueTasks,
    blockedTasks: row.health.breakdown.blockedTasks,
    waitingFollowUps: row.health.breakdown.waitingFollowUps,
    staleDays: row.health.breakdown.staleActivityDays,
    closeoutSignals: row.health.breakdown.readyToCloseSignals,
    riskSignals: row.health.breakdown.atRiskFollowUps,
    docReviewSignals: row.health.breakdown.docsNeedingReview + row.health.breakdown.staleIntakeDocs,
  });

  const linkedWorkPreview = buildSupportLinkedWorkPreview({
    followUpIds: row.openFollowUps.map((item) => item.id),
    taskIds: row.openTasks.map((task) => task.id),
    overdueFollowUps: row.health.breakdown.overdueFollowUps,
    waitingFollowUps: row.health.breakdown.waitingFollowUps,
    blockedTasks: row.health.breakdown.blockedTasks,
    overdueTasks: row.health.breakdown.overdueTasks,
  });

  return {
    id: row.project.id,
    lens: 'projects',
    recordType: 'project',
    title: row.project.name,
    subtitle: `${row.project.status} • ${row.project.phase || 'No phase set'}`,
    internalOwner: row.project.owner,
    activeProjectCount: 1,
    openWorkCount: row.openFollowUps.length + row.openTasks.length,
    riskTier: pressure.tier === 'critical' ? 'Critical' : pressure.tier === 'high' ? 'High' : pressure.tier === 'moderate' ? 'Medium' : 'Low',
    pressure,
    linkedWorkPreview,
    recommendedRoute: recommendSupportRoute({ lens: 'projects', recordId: row.project.id, projectName: row.project.name, pressure }),
    contextSummary: row.health.reasons[0] || 'No immediate pressure signal.',
    maintenance: {
      canDeleteSafely: true,
      canReassignChildren: true,
      canMerge: false,
      supportsRelationshipReassignment: false,
    },
  };
}

export function mapRelationshipSummaryToSupportSurface(row: RelationshipSummary, linkedWork: { followupIds: string[]; taskIds: string[] }): SupportRecordSurface {
  const pressure = buildSupportPressureSummary({
    openFollowUps: row.openFollowUps,
    openTasks: row.openTasks,
    overdueFollowUps: row.overdueFollowUps,
    overdueTasks: row.overdueTasks,
    blockedTasks: row.blockedTasks,
    waitingFollowUps: row.waitingFollowUps,
    staleDays: row.averageTouchAge,
    riskSignals: row.linkedRiskCount,
  });

  const linkedWorkPreview = buildSupportLinkedWorkPreview({
    followUpIds: linkedWork.followupIds,
    taskIds: linkedWork.taskIds,
    overdueFollowUps: row.overdueFollowUps,
    waitingFollowUps: row.waitingFollowUps,
    blockedTasks: row.blockedTasks,
    overdueTasks: row.overdueTasks,
  });

  return {
    id: row.id,
    lens: 'relationships',
    recordType: row.entityType,
    title: row.name,
    subtitle: row.subtitle,
    internalOwner: row.internalOwner,
    activeProjectCount: row.activeProjectCount,
    openWorkCount: row.openFollowUps + row.openTasks,
    riskTier: toRiskTier(row.riskTier),
    pressure,
    linkedWorkPreview,
    recommendedRoute: recommendSupportRoute({ lens: 'relationships', recordId: row.id, pressure }),
    contextSummary: `${row.entityType === 'contact' ? 'Contact' : 'Company'} coordination pressure`,
    maintenance: {
      canDeleteSafely: true,
      canReassignChildren: true,
      canMerge: true,
      supportsRelationshipReassignment: true,
    },
  };
}
