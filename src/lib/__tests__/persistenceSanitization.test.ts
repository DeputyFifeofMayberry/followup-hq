import { sanitizePersistedPayload, sanitizePersistenceString } from '../persistenceSanitization';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

(function run() {
  const single = sanitizePersistenceString('hello\u0000world\u0007!');
  assert(single.value === 'helloworld!', `expected control chars stripped, got ${JSON.stringify(single.value)}`);
  assert(single.removedControlChars === 2, `expected removed count 2, got ${single.removedControlChars}`);

  const result = sanitizePersistedPayload({
    items: [{ id: 'item-1', summary: 'ok\u0000summary', notes: 'clean' } as any],
    tasks: [],
    projects: [],
    contacts: [],
    companies: [],
    auxiliary: {
      intakeSignals: [], intakeDocuments: [{ id: 'doc-1', body: 'bad\u0000body\u0001' } as any], dismissedDuplicatePairs: [], droppedEmailImports: [],
      outlookConnection: { settings: {} as any, mailboxLinked: false, syncStatus: 'idle', syncCursorByFolder: { inbox: {}, sentitems: {} } },
      outlookMessages: [], forwardedEmails: [], forwardedRules: [], forwardedCandidates: [], forwardedLedger: [], forwardedRoutingAudit: [],
      intakeCandidates: [], intakeAssets: [], intakeBatches: [], intakeWorkCandidates: [], intakeReviewerFeedback: [], savedExecutionViews: [],
    },
  });

  assert(result.report.fieldCount >= 2, `expected >=2 sanitized fields, got ${result.report.fieldCount}`);
  assert(result.report.removedControlCharCount >= 3, `expected removed char count >=3, got ${result.report.removedControlCharCount}`);
  assert(result.report.touchedEntityTypes.includes('items'), 'expected items entity touched');
  assert(result.report.touchedEntityTypes.includes('auxiliary'), 'expected auxiliary entity touched');
  assert((result.payload.items[0] as any).summary === 'oksummary', 'expected summary sanitized in payload');
})();
