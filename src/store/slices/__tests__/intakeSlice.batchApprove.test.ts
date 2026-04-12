import { createIntakeSlice } from '../intakeSlice';
import type { AppStore } from '../../types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

type MutableState = AppStore & { decideCalls: string[] };

const state = {
  intakeBatches: [
    { id: 'batch-active', createdAt: '2026-04-12', source: 'drop', assetIds: ['a1'], status: 'review', stats: { filesProcessed: 1, candidatesCreated: 4, highConfidence: 3, failedParses: 0, duplicatesFlagged: 0 } },
    { id: 'batch-archived', createdAt: '2026-04-12', source: 'drop', assetIds: ['a2'], status: 'archived', stats: { filesProcessed: 1, candidatesCreated: 1, highConfidence: 1, failedParses: 0, duplicatesFlagged: 0 } },
  ],
  intakeWorkCandidates: [
    { id: 'safe-followup', batchId: 'batch-active', assetId: 'a1', approvalStatus: 'pending', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.97, title: 'Approve follow-up', project: 'Alpha', owner: 'Owner', dueDate: '2026-04-20', warnings: [], evidence: [{ field: 'title', sourceType: 'text', score: 0.95 }, { field: 'project', sourceType: 'text', score: 0.95 }, { field: 'owner', sourceType: 'text', score: 0.95 }, { field: 'dueDate', sourceType: 'text', score: 0.95 }], duplicateMatches: [], existingRecordMatches: [] },
    { id: 'safe-task', batchId: 'batch-active', assetId: 'a1', approvalStatus: 'pending', candidateType: 'task', suggestedAction: 'create_new', confidence: 0.98, title: 'Approve task', project: 'Alpha', owner: 'Owner', dueDate: '2026-04-21', warnings: [], evidence: [{ field: 'title', sourceType: 'text', score: 0.96 }, { field: 'project', sourceType: 'text', score: 0.96 }, { field: 'owner', sourceType: 'text', score: 0.96 }, { field: 'dueDate', sourceType: 'text', score: 0.96 }], duplicateMatches: [], existingRecordMatches: [] },
    { id: 'safe-skip', batchId: 'batch-active', assetId: 'a1', approvalStatus: 'pending', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.96, title: 'Safe but skip', project: 'Alpha', owner: 'Owner', dueDate: '2026-04-22', warnings: [], evidence: [{ field: 'title', sourceType: 'text', score: 0.95 }, { field: 'project', sourceType: 'text', score: 0.95 }, { field: 'owner', sourceType: 'text', score: 0.95 }, { field: 'dueDate', sourceType: 'text', score: 0.95 }], duplicateMatches: [], existingRecordMatches: [] },
    { id: 'unsafe', batchId: 'batch-active', assetId: 'a1', approvalStatus: 'pending', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.75, title: 'Unsafe candidate', project: '', owner: '', dueDate: '', warnings: ['conflicting type'], evidence: [], duplicateMatches: [], existingRecordMatches: [{ id: 'FUP-1', recordType: 'followup', label: 'Existing', score: 0.9, strategy: 'duplicate', reason: 'match' }] },
    { id: 'archived-safe', batchId: 'batch-archived', assetId: 'a2', approvalStatus: 'pending', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.98, title: 'Archived safe', project: 'Alpha', owner: 'Owner', dueDate: '2026-04-23', warnings: [], evidence: [{ field: 'title', sourceType: 'text', score: 0.96 }, { field: 'project', sourceType: 'text', score: 0.96 }, { field: 'owner', sourceType: 'text', score: 0.96 }, { field: 'dueDate', sourceType: 'text', score: 0.96 }], duplicateMatches: [], existingRecordMatches: [] },
  ],
  decideCalls: [],
} as unknown as MutableState;

const set = ((updater: any) => {
  if (typeof updater === 'function') {
    Object.assign(state, updater(state));
    return;
  }
  Object.assign(state, updater);
}) as any;

state.decideIntakeWorkCandidate = ((candidateId: string) => {
  state.decideCalls.push(candidateId);
  if (candidateId === 'safe-skip') return;
  state.intakeWorkCandidates = state.intakeWorkCandidates.map((candidate: any) => (
    candidate.id === candidateId ? { ...candidate, approvalStatus: 'imported' } : candidate
  ));
}) as any;

const slice = createIntakeSlice(set, () => state as AppStore, { queuePersist: () => undefined });
const receipt = slice.batchApproveHighConfidence();

assert(state.decideCalls.length === 3, `batch approve should call decide for each active safe candidate only; got ${state.decideCalls.join(',')}`);
assert(state.decideCalls.includes('safe-followup') && state.decideCalls.includes('safe-task') && state.decideCalls.includes('safe-skip'), 'batch approve should process safe candidates in active batches');
assert(!state.decideCalls.includes('unsafe') && !state.decideCalls.includes('archived-safe'), 'batch approve should exclude unsafe or archived-batch candidates');
assert(receipt.attemptedCount === 3, `attempted count should match eligible safe candidates; got ${receipt.attemptedCount}`);
assert(receipt.processedCount === 2, `processed count should include candidates imported by decide path; got ${receipt.processedCount}`);
assert(receipt.followupsCreated === 1, `receipt should report created follow-ups; got ${receipt.followupsCreated}`);
assert(receipt.tasksCreated === 1, `receipt should report created tasks; got ${receipt.tasksCreated}`);
assert(receipt.skippedCount === 1, `receipt should report skipped safe candidates that were not imported; got ${receipt.skippedCount}`);
assert(receipt.failedCount === 0, `failed count should remain zero when candidates still exist post-decision; got ${receipt.failedCount}`);
assert(receipt.remainingPendingCount === 2, `remaining pending should reflect active-batch queue after approval; got ${receipt.remainingPendingCount}`);
