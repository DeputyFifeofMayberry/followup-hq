import assert from 'node:assert/strict';
import {
  buildSupportLinkedWorkPreview,
  buildSupportPressureSummary,
  buildSupportSelectedContext,
  buildSupportSummaryStripMetrics,
  recommendSupportRoute,
  supportLensRegistry,
} from './index';

const pressure = buildSupportPressureSummary({
  openFollowUps: 4,
  openTasks: 3,
  overdueFollowUps: 1,
  overdueTasks: 2,
  blockedTasks: 1,
  waitingFollowUps: 2,
  staleDays: 18,
  closeoutSignals: 1,
  riskSignals: 1,
});
assert.equal(pressure.overduePressure, 3);
assert.equal(pressure.blockedPressure, 1);
assert.ok(pressure.topSignals.length > 0);

const route = recommendSupportRoute({
  lens: 'relationships',
  recordId: 'REL-1',
  pressure: buildSupportPressureSummary({ openFollowUps: 1, openTasks: 2, overdueFollowUps: 0, overdueTasks: 0, blockedTasks: 2, waitingFollowUps: 0 }),
});
assert.equal(route.lane, 'tasks');
assert.equal(route.origin.lens, 'relationships');

const linked = buildSupportLinkedWorkPreview({ followUpIds: ['F1', 'F2'], taskIds: ['T1'], overdueFollowUps: 1, waitingFollowUps: 1, blockedTasks: 0, overdueTasks: 0 });
const context = buildSupportSelectedContext({
  id: 'P1',
  lens: 'projects',
  recordType: 'project',
  title: 'Alpha',
  subtitle: 'Active',
  internalOwner: 'Jared',
  activeProjectCount: 1,
  openWorkCount: 3,
  riskTier: 'Medium',
  pressure,
  linkedWorkPreview: linked,
  recommendedRoute: recommendSupportRoute({ lens: 'projects', recordId: 'P1', pressure }),
  contextSummary: 'Needs attention',
  maintenance: { canDeleteSafely: true, canReassignChildren: true, canMerge: false, supportsRelationshipReassignment: false },
});
assert.equal(context.routeActions[0].origin.lens, 'projects');
assert.equal(context.linkedWork.followUps.totalOpen, 2);

assert.equal(supportLensRegistry.projects.pressureEmphasis, 'project_health');
const metrics = buildSupportSummaryStripMetrics([
  {
    id: '1', lens: 'projects', recordType: 'project', title: 'A', subtitle: 'x', internalOwner: 'o', activeProjectCount: 1, openWorkCount: 3, riskTier: 'High',
    pressure: buildSupportPressureSummary({ openFollowUps: 1, openTasks: 1, overdueFollowUps: 1, overdueTasks: 0, blockedTasks: 0, waitingFollowUps: 0 }),
    linkedWorkPreview: buildSupportLinkedWorkPreview({ followUpIds: ['f'], taskIds: ['t'], overdueFollowUps: 1, waitingFollowUps: 0, blockedTasks: 0, overdueTasks: 0 }),
    recommendedRoute: recommendSupportRoute({ lens: 'projects', recordId: '1', pressure: buildSupportPressureSummary({ openFollowUps: 1, openTasks: 1, overdueFollowUps: 1, overdueTasks: 0, blockedTasks: 0, waitingFollowUps: 0 }) }),
    contextSummary: '', maintenance: { canDeleteSafely: true, canReassignChildren: true, canMerge: false, supportsRelationshipReassignment: false },
  },
]);
assert.equal(metrics.overdue, 1);

console.log('support workspace shared domain tests passed');
