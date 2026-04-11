import { buildCandidatesFromAsset, parseIntakeFile } from '../universalIntake';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  const msgPayload = [
    'Subject: RE: Action required - Project B222 commissioning timeline',
    'From: Alex Owner <alex.owner@example.com>',
    'To: team@example.com',
    'Date: Thu, 10 Apr 2026 10:33:00 -0700',
    'Please assign Jordan and send updated timeline due 2026-04-18.',
    'Attachment: closeout-checklist.pdf',
  ].join('\n');
  const msgFile = new File([msgPayload], 'handoff.msg', { type: 'application/vnd.ms-outlook', lastModified: Date.parse('2026-04-10T10:33:00Z') });
  const msgAssets = await parseIntakeFile(msgFile, 'batch-msg');
  const msgRoot = msgAssets.find((asset) => !asset.parentAssetId);
  assert(Boolean(msgRoot), '.msg parse should return a root asset');
  assert(msgRoot?.parseStatus === 'review_needed', '.msg should always route to review_needed');
  assert(msgRoot?.parseQuality === 'weak', '.msg should be downgraded to weak quality for trust-safe review');
  assert((msgRoot?.warnings || []).some((entry) => /best-effort|manual review/i.test(entry)), '.msg should carry explicit manual-review warning');
  const msgCandidates = buildCandidatesFromAsset(msgRoot!, [], []);
  assert(msgCandidates.length >= 1, '.msg with action language should still produce review candidates');
  assert(msgCandidates.every((candidate) => candidate.warnings.length > 0), '.msg candidates should carry warnings to avoid silent high-confidence treatment');

  const docPayload = 'Project: B300 Legacy memo. Action item: update turnover package due 2026-04-22. Owner: Pat Lee.';
  const docFile = new File([docPayload], 'legacy.doc', { type: 'application/msword', lastModified: Date.parse('2026-04-09T07:00:00Z') });
  const [docAsset] = await parseIntakeFile(docFile, 'batch-doc');
  assert(docAsset.parseStatus === 'review_needed', '.doc should be accepted into review instead of hard blocked');
  assert(docAsset.parseQuality === 'weak', '.doc should stay weak parse quality');

  const pptxPayload = `<p:sld><a:t>Project B510 handoff</a:t><a:t>Action: finalize punch list due 2026-04-20</a:t></p:sld>`;
  const pptxFile = new File([pptxPayload], 'deck.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const [pptxAsset] = await parseIntakeFile(pptxFile, 'batch-pptx');
  assert(pptxAsset.parseStatus === 'review_needed' || pptxAsset.parseStatus === 'failed', '.pptx should not silently bypass review');

  const blockedFile = new File(['MZ fake executable'], 'malware.exe', { type: 'application/octet-stream' });
  const [blockedAsset] = await parseIntakeFile(blockedFile, 'batch-blocked');
  assert(blockedAsset.parseStatus === 'failed', 'blocked file should fail parse');
  assert(blockedAsset.errors.length > 0, 'blocked file should provide actionable reason');
}

void run();
