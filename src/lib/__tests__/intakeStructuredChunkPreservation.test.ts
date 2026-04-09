import { buildCandidatesFromAsset } from '../universalIntake';
import type { IntakeAssetRecord } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const asset: IntakeAssetRecord = {
  id: 'a2', batchId: 'b2', fileName: 'mail.eml', fileType: 'message/rfc822', sizeBytes: 100, kind: 'email', source: 'drop', uploadedAt: '2026-04-09', parseStatus: 'parsed', parseQuality: 'strong', metadata: {}, extractedText: 'ignored text', extractedPreview: '', warnings: [], errors: [], attachmentIds: [], sourceRefs: [], contentHash: 'h2', extractionChunks: [
    { id: 'h', sourceRef: 'email:subject', kind: 'email_header', text: 'Submittal update due 2026-04-11', quality: 0.9, fieldHints: { title: 'Submittal update due 2026-04-11' } },
    { id: 'b', sourceRef: 'email:body', kind: 'email_body', text: 'Please assign Jordan. Project: C-22. Due 2026-04-11.', quality: 0.8 },
  ],
};

const candidates = buildCandidatesFromAsset(asset, [], []);
assert(candidates.length > 0, 'candidates should use extractionChunks even when extractedText is weak');
assert(candidates[0].evidence.some((entry) => entry.locator?.includes('email:')), 'email chunk locator should be preserved in evidence');
