import { buildIntakeReviewQueue } from '../intakeReviewQueue';
import type { IntakeAssetRecord, IntakeBatchRecord, IntakeWorkCandidate } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const asset: IntakeAssetRecord = {
  id: 'a1', batchId: 'b-archived', fileName: 'a.txt', fileType: 'text/plain', sizeBytes: 10, kind: 'text', source: 'drop', uploadedAt: '2026-04-09', parseStatus: 'parsed', parseQuality: 'strong', metadata: {}, extractedText: 'hello', extractedPreview: 'hello', warnings: [], errors: [], attachmentIds: [], sourceRefs: [], contentHash: 'h1',
};

const candidate: IntakeWorkCandidate = {
  id: 'c1', batchId: 'b-archived', assetId: 'a1', candidateType: 'followup', suggestedAction: 'create_new', confidence: 0.9, title: 'Title', project: 'P', owner: 'O', dueDate: '2026-04-10', priority: 'Medium', summary: 'summary', tags: [], explanation: [], evidence: [], warnings: [], duplicateMatches: [], existingRecordMatches: [], approvalStatus: 'pending', createdAt: '2026-04-09', updatedAt: '2026-04-09',
};
const batches: IntakeBatchRecord[] = [{ id: 'b-archived', createdAt: '2026-04-09', source: 'drop', assetIds: ['a1'], status: 'archived', stats: { filesProcessed: 1, candidatesCreated: 1, highConfidence: 1, failedParses: 0, duplicatesFlagged: 0 } }];

assert(buildIntakeReviewQueue([candidate], [asset], batches).length === 0, 'archived batch candidates should not appear in active queue');
