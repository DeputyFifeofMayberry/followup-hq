import { buildCandidatesFromAsset, parseIntakeFile } from '../universalIntake';
import { buildParserReceipt, isWeakSourceReceipt } from '../intakeParserReceipts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  const msgFile = new File([[
    'Subject: RE: B222 closeout',
    'From: ops@example.com',
    'Please follow up with vendor due 2026-04-23.',
  ].join('\n')], 'handoff.msg', { type: 'application/vnd.ms-outlook' });
  const [msgAsset] = await parseIntakeFile(msgFile, 'batch-receipt-msg');
  assert(Boolean(msgAsset.parserReceipt), '.msg should produce parser receipt metadata.');
  assert(msgAsset.parserReceipt?.capabilityClass === 'manual_review_only', '.msg receipt should show manual-review capability class.');
  assert(msgAsset.parserReceipt?.weakSourceRoute === 'weak_source_review', '.msg should route to weak-source review path.');
  assert(msgAsset.parserReceipt?.downgradeReasons.some((reason) => /manual-review path/i.test(reason)), '.msg receipt should include downgrade reason.');
  assert(msgAsset.parserReceipt?.userNextSteps.includes('interpret_manually'), '.msg should include manual interpretation next-step guidance.');

  const actionReadyReceipt = buildParserReceipt({
    capabilityClass: 'parse_supported',
    asset: {
      fileName: 'permit.eml',
      fileType: 'message/rfc822',
      parseStatus: 'parsed',
      parseQuality: 'strong',
      admissionState: 'action_ready',
      warnings: [],
      metadata: { extractionMode: 'email_rfc822' },
      admissionReasons: ['Extraction quality and structure support action-ready admission.'],
      errors: [],
      extractedText: 'Project Atlas. Owner Alex. Due 2026-04-20. Next step submit final permit package today.',
      extractionChunks: [{ id: 'chk-1', sourceRef: 'email:body', kind: 'email_body', text: 'Project Atlas. Owner Alex. Due 2026-04-20.' }],
      extractionConfidence: 0.92,
    },
  });
  assert(actionReadyReceipt.weakSourceRoute === 'actionable_queue', 'strong parse-supported source should route to actionable queue.');
  assert(!isWeakSourceReceipt(actionReadyReceipt), 'action-ready parser receipt must not be flagged as weak source.');

  const blockedFile = new File(['PK fake'], 'archive.zip', { type: 'application/zip' });
  const [blockedAsset] = await parseIntakeFile(blockedFile, 'batch-receipt-blocked');
  assert(blockedAsset.parserReceipt?.weakSourceRoute === 'blocked_source', 'blocked source should route to blocked-source flow.');
  assert(blockedAsset.parserReceipt?.userNextSteps.includes('remove_failed_asset'), 'blocked source should guide failed-asset cleanup.');

  const reviewCandidates = buildCandidatesFromAsset(msgAsset, [], []);
  assert(reviewCandidates.length > 0, 'weak/manual-review source should still allow review candidates when text is recoverable.');
  assert(reviewCandidates.every((candidate) => candidate.admissionState !== 'action_ready'), 'weak-source candidates should remain outside action-ready admission.');
}

void run();
