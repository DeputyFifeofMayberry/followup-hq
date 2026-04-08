import { buildCandidatesFromAsset, sanitizeIntakeText } from '../universalIntake';
import type { IntakeAssetRecord, TaskItem, FollowUpItem } from '../../types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const emptyTasks: TaskItem[] = [];
const emptyFollowups: FollowUpItem[] = [];

function baseAsset(overrides: Partial<IntakeAssetRecord>): IntakeAssetRecord {
  return {
    id: 'a1',
    batchId: 'b1',
    fileName: 'source.eml',
    fileType: 'message/rfc822',
    sizeBytes: 1024,
    kind: 'email',
    source: 'drop',
    uploadedAt: '2026-04-08',
    parseStatus: 'parsed',
    parseQuality: 'strong',
    metadata: {},
    extractedText: '',
    extractedPreview: '',
    warnings: [],
    errors: [],
    attachmentIds: [],
    sourceRefs: [],
    contentHash: 'h1',
    ...overrides,
  };
}

export function runUniversalIntakePipelineChecks() {
  const sanitized = sanitizeIntakeText('hello\u0000world\u0007\n\n\n\nnext');
  assert(!sanitized.includes('\u0000') && !sanitized.includes('\u0007'), 'sanitizeIntakeText should remove control characters');
  assert(!/\n{4,}/.test(sanitized), 'sanitizeIntakeText should collapse excessive blank lines');

  const noisyEmail = baseAsset({
    metadata: { sentDate: '2026-04-01' },
    extractedText: [
      '[email:subject] RE: ACTION REQUIRED: Project B123 concrete pour schedule',
      '[email:body] Please assign Maria Lopez to send updated pour schedule due 2026-04-14. On Tue someone wrote: old thread',
      '[email:body] confidentiality notice and unsubscribe links',
    ].join('\n'),
  });

  const candidates = buildCandidatesFromAsset(noisyEmail, emptyFollowups, emptyTasks);
  assert(candidates.length >= 1, 'email with explicit action should produce candidate');
  const first = candidates[0];
  assert(first.title.length <= 96, 'title should be synthesized as compact actionable text');
  assert(first.project?.includes('B123') || first.summary.includes('B123'), 'project detection should preserve project token');
  assert((first.warnings || []).some((warning) => /Project uncertain|Due date inferred|Multiple possible owners|Email thread/i.test(warning)) || !!first.owner, 'candidate should carry actionable warnings or owner signal');

  const weakNoise = baseAsset({
    kind: 'text',
    fileName: 'noise.txt',
    extractedText: '[text:body] confidentiality notice unsubscribe click here view in browser',
  });
  const weakCandidates = buildCandidatesFromAsset(weakNoise, emptyFollowups, emptyTasks);
  assert(weakCandidates.length === 0, 'non-content snippets should be filtered out');

  const sheetAsset = baseAsset({
    kind: 'spreadsheet',
    fileName: 'tracker.xlsx',
    extractedText: [
      '[Sheet A#row2] Task: Submit RFI | Project: B777 | Owner: Alex Kim | Due: 2026-04-21',
      '[Sheet A#row3] Total: 8',
    ].join('\n'),
  });
  const sheetCandidates = buildCandidatesFromAsset(sheetAsset, emptyFollowups, emptyTasks);
  assert(sheetCandidates.length >= 1, 'spreadsheet rows with action data should produce candidates');
}

runUniversalIntakePipelineChecks();
