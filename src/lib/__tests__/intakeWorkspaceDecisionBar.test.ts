import { actionIsPrimary, createActionBlockReason } from '../../components/intake/intakeWorkspaceTypes';
import type { IntakeReviewPlan } from '../intakeReviewPlan';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const plan: IntakeReviewPlan = {
  requiredCorrections: [],
  recommendedCorrections: [],
  optionalFields: [],
  suggestedDecision: 'link_existing',
  suggestedDecisionReason: 'duplicate overlap',
  fastApproveEligible: false,
  quickFixActions: [],
  duplicateReviewPriority: 'high',
  reviewerBurdenScore: 42,
};

assert(actionIsPrimary('link', plan, false), 'link should be primary when plan recommends link review');
assert(!actionIsPrimary('approve_followup', plan, false), 'follow-up should not be primary when plan recommends link review');

assert(
  createActionBlockReason({ createBlocked: true, safeToCreateNew: false, confirmUnsafeCreate: false }) === 'Create-new actions are disabled until blockers are corrected.',
  'blockers should remain the highest-priority create-new block reason',
);
assert(
  createActionBlockReason({ createBlocked: false, safeToCreateNew: false, confirmUnsafeCreate: false }) === 'Create-new actions are disabled until duplicate-risk override is acknowledged.',
  'unsafe create should be blocked until override is acknowledged',
);
assert(
  createActionBlockReason({ createBlocked: false, safeToCreateNew: false, confirmUnsafeCreate: true }) === null,
  'unsafe create block should clear once reviewer acknowledges override',
);

console.log('intake workspace decision-bar checks passed');
