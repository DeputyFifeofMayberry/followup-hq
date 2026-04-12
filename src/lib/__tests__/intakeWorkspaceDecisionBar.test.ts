import { actionIsPrimary, createActionBlockReason, describeEvidenceFocus, editorTargetLabel, toEditorTargetForField } from '../../components/intake/intakeWorkspaceTypes';
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
assert(toEditorTargetForField('title') === 'title', 'title blocker should map to title editor target');
assert(toEditorTargetForField('type') === 'candidateType', 'type blocker should map to candidate type editor target');
assert(toEditorTargetForField('existingLink') === 'duplicateReview', 'existing-link blocker should map to duplicate review target');
assert(editorTargetLabel('candidateType') === 'Type', 'candidate type target label should remain readable');
assert(
  describeEvidenceFocus({ fieldLabel: 'Project', locator: 'mail.eml#L20' }) === 'Project • mail.eml#L20',
  'evidence focus should include field + locator context',
);

console.log('intake workspace decision-bar checks passed');
