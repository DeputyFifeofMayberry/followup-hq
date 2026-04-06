import { buildSaveBatchEnvelope } from '../persistence';
import type { PersistedPayload } from '../persistence';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function payloadFixture(): PersistedPayload {
  return {
    items: [{ id: 'item-1' } as any],
    tasks: [{ id: 'task-1' } as any],
    projects: [{ id: 'project-1' } as any],
    contacts: [{ id: 'contact-1' } as any],
    companies: [{ id: 'company-1' } as any],
    auxiliary: {
      intakeSignals: [], intakeDocuments: [], dismissedDuplicatePairs: [], droppedEmailImports: [],
      outlookConnection: { settings: {} as any, mailboxLinked: false, syncStatus: 'idle', syncCursorByFolder: { inbox: {}, sentitems: {} } },
      outlookMessages: [], forwardedEmails: [], forwardedRules: [], forwardedCandidates: [], forwardedLedger: [], forwardedRoutingAudit: [],
      intakeCandidates: [], intakeAssets: [], intakeBatches: [], intakeWorkCandidates: [], intakeReviewerFeedback: [], savedExecutionViews: [],
      followUpFilters: undefined, followUpColumns: undefined, savedFollowUpViews: [],
    },
  };
}

const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
  sessionStorage: {
    getItem: (key: string) => storage.get(`session:${key}`) ?? null,
    setItem: (key: string, value: string) => void storage.set(`session:${key}`, value),
    removeItem: (key: string) => void storage.delete(`session:${key}`),
  },
};

async function run() {
  const operations = [
    { entity: 'items', recordId: 'item-1', operation: 'upsert', recordSnapshot: { id: 'item-1', title: 'A' } },
    { entity: 'tasks', recordId: 'task-1', operation: 'delete', deletedAt: '2026-04-06T10:00:00.000Z', recordSnapshot: { id: 'task-1' } },
  ] as const;

  const envelopeA = await buildSaveBatchEnvelope({ payload: payloadFixture(), operations: operations as any, clientGeneratedAt: '2026-04-06T10:00:00.000Z' });
  const envelopeB = await buildSaveBatchEnvelope({ payload: payloadFixture(), operations: operations as any, clientGeneratedAt: '2026-04-06T10:00:00.000Z' });

  assert(Boolean(envelopeA.batchId), 'envelope should include batch id');
  assert(envelopeA.operationCount === 2, `expected 2 operations, got ${envelopeA.operationCount}`);
  assert(envelopeA.operationCountsByEntity.items.upserts === 1, 'items upsert count should be 1');
  assert(envelopeA.operationCountsByEntity.tasks.deletes === 1, 'tasks delete count should be 1');
  assert(envelopeA.clientPayloadHash === envelopeB.clientPayloadHash, 'hash should be stable for same payload content');
}

void run();
