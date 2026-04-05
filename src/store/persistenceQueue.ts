import type { PersistedPayload, SaveResult } from '../lib/persistence';
import { savePersistedPayload } from '../lib/persistence';
import { todayIso } from '../lib/utils';

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

interface QueueHandlers {
  getPayload: () => PersistedPayload;
  onQueued: (meta?: QueueRequestMeta) => void;
  onSaving: (context: { reason: 'auto' | 'manual' | 'retry'; attempt: number }) => void;
  onSaved: (mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading', timestamp: string, reason: 'auto' | 'manual' | 'retry', didPersist: boolean, diagnostics?: SaveResult['diagnostics']) => void;
  onError: (message: string, timestamp: string, reason: 'auto' | 'manual' | 'retry', diagnostics?: SaveResult['diagnostics']) => void;
}

export interface PersistenceQueueController {
  enqueue: (meta?: QueueRequestMeta) => void;
  flushNow: () => Promise<void>;
  retryNow: () => Promise<void>;
}

export function createPersistenceQueue(handlers: QueueHandlers, config: QueueConfig = {}) {
  const debounceMs = config.debounceMs ?? 350;
  const maxRetries = config.maxRetries ?? 2;
  const retryDelayMs = config.retryDelayMs ?? 700;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSavedJson = '';
  let lastMode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading' = 'browser';

  const flush = async (attempt = 0, reason: 'auto' | 'manual' | 'retry' = 'auto'): Promise<void> => {
    handlers.onSaving({ reason, attempt });
    const payload = handlers.getPayload();
    const payloadJson = JSON.stringify(payload);

    if (payloadJson === lastSavedJson) {
      handlers.onSaved(lastMode, todayIso(), reason, false);
      return;
    }

    try {
      const saveResult = await savePersistedPayload(payload);
      lastMode = saveResult.mode;
      lastSavedJson = payloadJson;
      handlers.onSaved(saveResult.mode, todayIso(), reason, true, saveResult.diagnostics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save data.';
      const diagnostics = typeof error === 'object' && error !== null && 'diagnostics' in error
        ? (error as { diagnostics?: SaveResult['diagnostics'] }).diagnostics
        : undefined;
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

  return {
    enqueue: schedule,
    flushNow,
    retryNow,
  } satisfies PersistenceQueueController;
}
