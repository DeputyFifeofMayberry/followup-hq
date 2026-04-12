import type { PersistedPayload, SaveResult } from '../lib/persistence';
import { savePersistedPayload } from '../lib/persistence';
import { todayIso } from '../lib/utils';
import { classifyPersistenceFailure, formatPersistenceErrorMessage, normalizePersistenceError } from '../lib/persistenceError';

interface QueueConfig {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  saveFn?: typeof savePersistedPayload;
}

export interface DirtyRecordRef {
  type: 'followup' | 'task' | 'project' | 'contact' | 'company';
  id: string;
}

export interface QueueRequestMeta {
  dirtyRecords?: DirtyRecordRef[];
}

export interface SyncAttemptContext {
  hasUnresolvedBatches: boolean;
  localRevision: number;
  lastCloudConfirmedRevision: number;
  persistenceMode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading';
  online: boolean;
}

interface QueueHandlers {
  getPayload: () => PersistedPayload;
  getSyncAttemptContext?: () => SyncAttemptContext;
  onQueued: (meta?: QueueRequestMeta) => void;
  onSaving: (context: { reason: 'auto' | 'manual' | 'retry' | 'replay'; attempt: number }) => void;
  onSaved: (
    mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading',
    timestamp: string,
    reason: 'auto' | 'manual' | 'retry' | 'replay',
    didPersist: boolean,
    diagnostics: SaveResult['diagnostics'] | undefined,
    flushedDirtyRecords: DirtyRecordRef[],
  ) => void;
  onError: (message: string, timestamp: string, reason: 'auto' | 'manual' | 'retry' | 'replay', diagnostics?: SaveResult['diagnostics']) => void;
}

export interface PersistenceQueueController {
  enqueue: (meta?: QueueRequestMeta) => void;
  flushNow: () => Promise<void>;
  retryNow: () => Promise<void>;
  replayPendingBatchesNow: () => Promise<void>;
  cancelPending: () => void;
  resetInternalState: () => void;
}

export function shouldAttemptCloudSync(input: SyncAttemptContext): boolean {
  if (!input.online) return false;
  if (input.hasUnresolvedBatches) return true;
  return input.lastCloudConfirmedRevision < input.localRevision;
}

export function createPersistenceQueue(handlers: QueueHandlers, config: QueueConfig = {}) {
  const debounceMs = config.debounceMs ?? 350;
  const maxRetries = config.maxRetries ?? 2;
  const retryDelayMs = config.retryDelayMs ?? 700;
  const saveFn = config.saveFn ?? savePersistedPayload;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingDirtyRefs = new Map<string, DirtyRecordRef>();

  let inFlight: Promise<void> | null = null;
  let rerunReason: 'auto' | 'manual' | 'retry' | 'replay' | null = null;

  const flush = async (attempt = 0, reason: 'auto' | 'manual' | 'retry' | 'replay' = 'auto'): Promise<void> => {
    if (inFlight) {
      rerunReason = reason === 'replay' ? 'replay' : (rerunReason ?? reason);
      await inFlight;
      return;
    }
    inFlight = (async () => {
    handlers.onSaving({ reason, attempt });
    const flushedDirtyRecords = Array.from(pendingDirtyRefs.values());
    const flushedDirtyRecordKeys = flushedDirtyRecords.map((ref) => `${ref.type}:${ref.id}`);
    const payload = handlers.getPayload();

    try {
      const saveResult = await saveFn(payload, {
        dirtyRecords: flushedDirtyRecords,
        forceSchemaCheck: reason === 'retry',
      });
      flushedDirtyRecordKeys.forEach((key) => pendingDirtyRefs.delete(key));
      handlers.onSaved(saveResult.mode, todayIso(), reason, true, saveResult.diagnostics, flushedDirtyRecords);
    } catch (error) {
      const message = formatPersistenceErrorMessage(normalizePersistenceError(error, { operation: 'save' }));
      const diagnostics = typeof error === 'object' && error !== null && 'diagnostics' in error
        ? (error as { diagnostics?: SaveResult['diagnostics'] }).diagnostics
        : undefined;
      const classification = classifyPersistenceFailure({ normalized: normalizePersistenceError(error), diagnostics });
      const nonRetryable = Boolean((error as { nonRetryable?: boolean })?.nonRetryable || diagnostics?.nonRetryable || classification.nonRetryable);
      if (nonRetryable) {
        handlers.onError(message, todayIso(), reason, diagnostics);
        return;
      }
      if (attempt < maxRetries) {
        timer = setTimeout(() => {
          void flush(attempt + 1, reason);
        }, retryDelayMs * (attempt + 1));
        return;
      }
      handlers.onError(message, todayIso(), reason, diagnostics);
    }
    })();
    await inFlight;
    inFlight = null;
    if (rerunReason) {
      const nextReason = rerunReason;
      rerunReason = null;
      await flush(0, nextReason);
    }
  };

  const schedule = (meta?: QueueRequestMeta) => {
    if (timer) clearTimeout(timer);
    meta?.dirtyRecords?.forEach((ref) => {
      pendingDirtyRefs.set(`${ref.type}:${ref.id}`, ref);
    });
    handlers.onQueued(meta);
    timer = setTimeout(() => {
      void flush(0, 'auto');
    }, debounceMs);
  };

  const flushNow = async () => {
    if (timer) clearTimeout(timer);
    await flush(0, 'manual');
  };

  const retryNow = async () => {
    if (timer) clearTimeout(timer);
    await flush(0, 'retry');
  };

  const replayPendingBatchesNow = async () => {
    if (timer) clearTimeout(timer);
    await flush(0, 'replay');
  };

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const resetInternalState = () => {
    cancelPending();
    pendingDirtyRefs = new Map();
    rerunReason = null;
    inFlight = null;
  };

  return {
    enqueue: schedule,
    flushNow,
    retryNow,
    replayPendingBatchesNow,
    cancelPending,
    resetInternalState,
  } satisfies PersistenceQueueController;
}
