import type { AppSnapshot } from '../types';
import { saveSnapshot } from '../lib/persistence';
import { todayIso } from '../lib/utils';

interface QueueConfig {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface QueueHandlers {
  getSnapshot: () => AppSnapshot;
  onSaving: () => void;
  onSaved: (mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading', timestamp: string) => void;
  onError: (message: string) => void;
}

export function createPersistenceQueue(handlers: QueueHandlers, config: QueueConfig = {}) {
  const debounceMs = config.debounceMs ?? 350;
  const maxRetries = config.maxRetries ?? 2;
  const retryDelayMs = config.retryDelayMs ?? 700;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSavedJson = '';
  let lastMode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading' = 'browser';

  const flush = async (attempt = 0): Promise<void> => {
    const snapshot = handlers.getSnapshot();
    const snapshotJson = JSON.stringify(snapshot);

    if (snapshotJson === lastSavedJson) {
      handlers.onSaved(lastMode, todayIso());
      return;
    }

    try {
      const mode = await saveSnapshot(snapshot);
      lastMode = mode;
      lastSavedJson = snapshotJson;
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

  return () => {
    if (timer) clearTimeout(timer);
    handlers.onSaving();
    timer = setTimeout(() => {
      void flush();
    }, debounceMs);
  };
}
