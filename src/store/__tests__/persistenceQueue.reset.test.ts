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

(async function run() {
  await testCancelAndResetPreventsCarryover();
})();
