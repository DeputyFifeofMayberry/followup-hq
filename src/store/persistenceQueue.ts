import type { PersistedPayload, SaveResult } from '../lib/persistence';
import { savePersistedPayload } from '../lib/persistence';
import { todayIso } from '../lib/utils';
import { formatPersistenceErrorMessage, normalizePersistenceError } from '../lib/persistenceError';

interface QueueConfig {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
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
  online: boolean;
}

interface QueueHandlers {
  getPayload: () => PersistedPayload;
  getSyncAttemptContext?: () => SyncAttemptContext;
  onQueued: (meta?: QueueRequestMeta) => void;
  onSaving: (context: { reason: 'auto' | 'manual' | 'retry'; attempt: number }) => void;
  onSaved: (mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading', timestamp: string, reason: 'auto' | 'manual' | 'retry', didPersist: boolean, diagnostics?: SaveResult['diagnostics']) => void;
  onError: (message: string, timestamp: string, reason: 'auto' | 'manual' | 'retry', diagnostics?: SaveResult['diagnostics']) => void;
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

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastMode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading' = 'browser';
  let pendingDirtyRefs = new Map<string, DirtyRecordRef>();

  const flush = async (attempt = 0, reason: 'auto' | 'manual' | 'retry' = 'auto'): Promise<void> => {
    handlers.onSaving({ reason, attempt });
    const payload = handlers.getPayload();
    const syncContext = handlers.getSyncAttemptContext?.();
    const shouldSync = syncContext ? shouldAttemptCloudSync(syncContext) : true;

    if (!shouldSync && pendingDirtyRefs.size === 0 && reason !== 'manual') {
      handlers.onSaved(lastMode, todayIso(), reason, false);
      return;
    }

    try {
      const dirtyRecords = Array.from(pendingDirtyRefs.values());
      const saveResult = await savePersistedPayload(payload, {
        dirtyRecords,
        forceSchemaCheck: reason === 'retry',
      });
      lastMode = saveResult.mode;
      pendingDirtyRefs = new Map();
      handlers.onSaved(saveResult.mode, todayIso(), reason, true, saveResult.diagnostics);
    } catch (error) {
      const message = formatPersistenceErrorMessage(normalizePersistenceError(error, { operation: 'save' }));
      const diagnostics = typeof error === 'object' && error !== null && 'diagnostics' in error
        ? (error as { diagnostics?: SaveResult['diagnostics'] }).diagnostics
        : undefined;
      const nonRetryable = Boolean((error as { nonRetryable?: boolean })?.nonRetryable || diagnostics?.nonRetryable);
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
    await flush(0, 'retry');
  };

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const resetInternalState = () => {
    cancelPending();
    pendingDirtyRefs = new Map();
    lastMode = 'browser';
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
