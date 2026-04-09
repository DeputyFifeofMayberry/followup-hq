import { evaluateIntakeImportSafety } from '../intakeImportSafety';
import type { IntakeWorkCandidate } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const candidate = {
  id: 'c1', batchId: 'b1', assetId: 'a1', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.81,
  title: 'Follow up with vendor', project: 'Proj', priority: 'Medium', summary: 'Follow up with vendor by 2026-04-15', tags: [], explanation: [], evidence: [], warnings: [], duplicateMatches: [],
  existingRecordMatches: [{ id: 'f1', recordType: 'followup', title: 'Follow up with vendor', project: 'Proj', score: 0.92, reason: 'title high', strategy: 'duplicate' }], approvalStatus: 'pending', createdAt: '2026-04-09', updatedAt: '2026-04-09',
} as IntakeWorkCandidate;

const safety = evaluateIntakeImportSafety(candidate);
assert(safety.requiresLinkReview, 'strong existing match should require link review');
assert(!safety.safeToCreateNew, 'strong duplicate should block create-new without override');
