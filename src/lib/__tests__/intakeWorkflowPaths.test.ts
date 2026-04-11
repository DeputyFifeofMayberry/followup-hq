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

const weakDueCandidate = {
  ...candidate,
  id: 'c2',
  existingRecordMatches: [],
  duplicateMatches: [],
  dueDate: '2026-04-15',
  warnings: ['Due date inferred from body text.'],
  fieldConfidence: { title: 0.92, type: 0.9, project: 0.9, owner: 0.86, dueDate: 0.58 },
  evidence: [{ id: 'e-due', field: 'dueDate', snippet: 'maybe next friday', sourceRef: 'a1', score: 0.44, sourceType: 'text' }],
} as IntakeWorkCandidate;
const weakDueSafety = evaluateIntakeImportSafety(weakDueCandidate);
assert(!weakDueSafety.safeToCreateNew, 'weak inferred due date should block create-new');
assert(weakDueSafety.createNewWarnings.some((warning) => /Execution fields/i.test(warning)), 'weak due-date signal should generate explicit execution warning');

const missingProjectCandidate = {
  ...candidate,
  id: 'c3',
  existingRecordMatches: [],
  duplicateMatches: [],
  project: '',
  fieldConfidence: { title: 0.9, type: 0.88, project: 0.42, owner: 0.84, dueDate: 0.86 },
} as IntakeWorkCandidate;
const missingProjectSafety = evaluateIntakeImportSafety(missingProjectCandidate);
assert(!missingProjectSafety.safeToCreateNew, 'weak/missing project evidence should block create-new');

const strongSafeCandidate = {
  ...candidate,
  id: 'c4',
  existingRecordMatches: [],
  duplicateMatches: [],
  owner: 'Alex',
  dueDate: '2026-04-15',
  fieldConfidence: { title: 0.95, type: 0.93, project: 0.92, owner: 0.91, dueDate: 0.92 },
  evidence: [
    { id: 'e1', field: 'dueDate', snippet: 'deadline 2026-04-15', sourceRef: 'a1', score: 0.92, sourceType: 'email_body' },
    { id: 'e2', field: 'project', snippet: 'Project Proj', sourceRef: 'a1', score: 0.9, sourceType: 'email_header' },
    { id: 'e3', field: 'owner', snippet: 'Owner: Alex', sourceRef: 'a1', score: 0.88, sourceType: 'email_body' },
  ],
} as IntakeWorkCandidate;
const strongSafe = evaluateIntakeImportSafety(strongSafeCandidate);
assert(strongSafe.safeToCreateNew, 'strong critical evidence should remain create-new safe');

const referenceCandidate = {
  ...candidate,
  id: 'c5',
  candidateType: 'reference',
  suggestedAction: 'reference_only',
  existingRecordMatches: [],
  duplicateMatches: [],
} as IntakeWorkCandidate;
const referenceSafety = evaluateIntakeImportSafety(referenceCandidate);
assert(referenceSafety.recommendedDecision === 'save_reference', 'reference-only candidate should keep save-reference recommendation');
