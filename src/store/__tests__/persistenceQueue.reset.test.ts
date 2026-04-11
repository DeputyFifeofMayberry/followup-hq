import { createPersistenceQueue } from '../persistenceQueue';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testCancelAndResetPreventsCarryover() {
  let queued = 0;
  let saved = 0;
  let saving = 0;

  const queue = createPersistenceQueue({
    getPayload: () => ({ items: [], tasks: [], projects: [], contacts: [], companies: [], auxiliary: {} as any }),
    onQueued: () => { queued += 1; },
    onSaving: () => { saving += 1; },
    onSaved: () => { saved += 1; },
    onError: () => { throw new Error('unexpected error callback'); },
  }, { debounceMs: 30, maxRetries: 0 });

  queue.enqueue({ dirtyRecords: [{ type: 'followup', id: 'a' }] });
  queue.cancelPending();
  await wait(45);
  assert(queued === 1, 'queue should register enqueue');
  assert(saving === 0 && saved === 0, 'cancelPending should prevent scheduled flush execution');

  queue.enqueue({ dirtyRecords: [{ type: 'followup', id: 'b' }] });
  queue.resetInternalState();
  await wait(45);
  assert(saving === 0 && saved === 0, 'resetInternalState should clear timers and pending refs across logout boundary');
}

async function testReplayWaitsForInflightFlushWithoutDuplicateSends() {
  let saveCalls = 0;
  const savingReasons: string[] = [];
  const queue = createPersistenceQueue({
    getPayload: () => ({ items: [], tasks: [], projects: [], contacts: [], companies: [], auxiliary: {} as any }),
    onQueued: () => undefined,
    onSaving: ({ reason }) => { savingReasons.push(reason); },
    onSaved: () => undefined,
    onError: () => { throw new Error('unexpected error callback'); },
  }, {
    debounceMs: 10,
    maxRetries: 0,
    saveFn: async () => {
      saveCalls += 1;
      await wait(40);
      return { mode: 'supabase', diagnostics: {} as any };
    },
  });

  queue.enqueue({ dirtyRecords: [{ type: 'followup', id: 'a' }] });
  await wait(15);
  void queue.replayPendingBatchesNow();
  await wait(120);

  assert(saveCalls === 2, 'replay should run once after in-flight save finishes, without concurrent duplicate sends');
  assert(savingReasons[0] === 'auto' && savingReasons[1] === 'replay', 'queue should preserve replay intent when rerunning after in-flight save');
}

(async function run() {
  await testCancelAndResetPreventsCarryover();
  await testReplayWaitsForInflightFlushWithoutDuplicateSends();
})();
