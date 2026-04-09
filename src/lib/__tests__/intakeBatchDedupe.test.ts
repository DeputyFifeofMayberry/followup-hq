import { buildCandidatesFromAsset } from '../universalIntake';
import type { IntakeAssetRecord } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const asset: IntakeAssetRecord = {
  id: 'a1', batchId: 'b1', fileName: 'tracker.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 100, kind: 'spreadsheet', source: 'drop', uploadedAt: '2026-04-09', parseStatus: 'parsed', parseQuality: 'strong', metadata: {}, extractedText: '', extractedPreview: '', warnings: [], errors: [], attachmentIds: [], sourceRefs: [], contentHash: 'h1', extractionChunks: [
    { id: 'c1', sourceRef: 'Sheet A#row2', kind: 'sheet_row', text: 'Title: RFI Closeout | Project: B1 | Due: 2026-04-10', quality: 0.9 },
    { id: 'c2', sourceRef: 'Sheet A#row2', kind: 'sheet_row', text: 'Title: RFI Closeout | Project: B1 | Due: 2026-04-10', quality: 0.9 },
  ],
};

const out = buildCandidatesFromAsset(asset, [], []);
assert(out.length === 2, 'rows with same title but different row identity should both survive');
assert(out.every((candidate) => candidate.suspectedDuplicateGroupId), 'similar repeated rows should receive within-batch duplicate group ids');
