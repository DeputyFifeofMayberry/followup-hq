import type { PersistedPayload } from '../lib/persistence';
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
  onSaving: () => void;
  onSaved: (mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading', timestamp: string) => void;
  onError: (message: string) => void;
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

  const flush = async (attempt = 0): Promise<void> => {
    handlers.onSaving();
    const payload = handlers.getPayload();
    const payloadJson = JSON.stringify(payload);

    if (payloadJson === lastSavedJson) {
      handlers.onSaved(lastMode, todayIso());
      return;
    }

    try {
      const { mode } = await savePersistedPayload(payload);
      lastMode = mode;
      lastSavedJson = payloadJson;
      handlers.onSaved(mode, todayIso());
    } catch (error) {
      if (attempt < maxRetries) {
        timer = setTimeout(() => {
          void flush(attempt + 1);
        }, retryDelayMs * (attempt + 1));
        return;
      }
      handlers.onError(error instanceof Error ? error.message : 'Failed to save data.');
    }
  };

  const schedule = (meta?: QueueRequestMeta) => {
    if (timer) clearTimeout(timer);
    handlers.onQueued(meta);
    timer = setTimeout(() => {
      void flush();
    }, debounceMs);
  };

  const flushNow = async () => {
    if (timer) clearTimeout(timer);
    handlers.onSaving();
    await flush();
  };

  return {
    enqueue: schedule,
    flushNow,
    retryNow: flushNow,
  } satisfies PersistenceQueueController;
}
