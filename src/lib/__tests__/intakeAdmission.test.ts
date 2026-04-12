import { buildCandidatesFromAsset } from '../universalIntake';
import { buildIntakeReviewQueue } from '../intakeReviewQueue';
import type { IntakeAssetRecord } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const weakManualAsset: IntakeAssetRecord = {
  id: 'a-weak',
  batchId: 'b1',
  fileName: 'legacy.msg',
  fileType: 'application/vnd.ms-outlook',
  sizeBytes: 200,
  kind: 'email',
  source: 'drop',
  uploadedAt: '2026-04-12',
  parseStatus: 'review_needed',
  parseQuality: 'weak',
  metadata: { capabilityState: 'manual_review_only', extractionMode: 'msg_best_effort' },
  extractedText: 'Please review this. Project Falcon maybe. Need owner and due date.',
  extractedPreview: 'Please review this',
  warnings: ['Outlook .msg parsing is best-effort; verify fields before approval.'],
  errors: [],
  attachmentIds: [],
  sourceRefs: ['msg:body'],
  contentHash: 'h-weak',
  extractionConfidence: 0.48,
  extractionChunks: [
    { id: 'cw1', sourceRef: 'msg:body', kind: 'email_body', text: 'Please review this. Project Falcon maybe. Need owner and due date.', quality: 0.56 },
  ],
};

const weakCandidates = buildCandidatesFromAsset(weakManualAsset, [], []);
assert(weakCandidates.length > 0, 'weak manual-review source should still produce reviewable interpretation candidates.');
assert(weakCandidates.every((candidate) => candidate.admissionState === 'reviewable'), 'weak/manual-review candidates must not be admitted as action-ready.');

const strongAsset: IntakeAssetRecord = {
  id: 'a-strong',
  batchId: 'b1',
  fileName: 'work-items.eml',
  fileType: 'message/rfc822',
  sizeBytes: 300,
  kind: 'email',
  source: 'drop',
  uploadedAt: '2026-04-12',
  parseStatus: 'parsed',
  parseQuality: 'strong',
  metadata: { capabilityState: 'parse_supported' },
  extractedText: 'Owner Alex. Project Atlas. Due 2026-04-18. Next step submit permit package.',
  extractedPreview: 'Owner Alex',
  warnings: [],
  errors: [],
  attachmentIds: [],
  sourceRefs: ['email:body'],
  contentHash: 'h-strong',
  extractionConfidence: 0.91,
  extractionChunks: [
    { id: 'cs1', sourceRef: 'email:body', kind: 'email_body', text: 'Task: Submit permit package. Project Atlas. Owner Alex. Due 2026-04-18. Next step submit permit package.', quality: 0.93, fieldHints: { title: 'Submit permit package', project: 'Atlas', owner: 'Alex', dueDate: '2026-04-18', nextStep: 'Submit permit package' } },
  ],
};

const strongCandidates = buildCandidatesFromAsset(strongAsset, [], []);
assert(strongCandidates.some((candidate) => candidate.admissionState === 'action_ready'), 'strong evidence source should still allow action-ready candidate admission.');

const weakCoreFieldsAsset: IntakeAssetRecord = {
  ...strongAsset,
  id: 'a-weak-core',
  extractedText: 'Need to do this soon',
  extractionChunks: [
    { id: 'cs2', sourceRef: 'email:body', kind: 'email_body', text: 'Need to do this soon. Maybe next week.', quality: 0.74, fieldHints: { title: 'Need to do this soon' } },
  ],
  extractionConfidence: 0.81,
};
const weakCoreCandidates = buildCandidatesFromAsset(weakCoreFieldsAsset, [], []);
assert(weakCoreCandidates.every((candidate) => candidate.admissionState !== 'action_ready'), 'missing project/execution anchors should block action-ready admission.');

const queue = buildIntakeReviewQueue(weakCandidates, [weakManualAsset], []);
assert(queue.length > 0, 'reviewable candidates should still appear in queue for interpretation.');
assert(queue.every((item) => item.readiness !== 'ready_to_approve'), 'reviewable candidates must not be treated as ready-to-create queue items.');
assert(queue.every((item) => !item.batchSafe), 'manual-review-required candidates must not be batch-safe.');
