import type { AppMetaState } from './state/types';

export type PostSaveMetaState = Pick<AppMetaState, 'syncState' | 'lastSyncedAt' | 'lastCloudConfirmedAt' | 'lastLocalWriteAt' | 'cloudSyncStatus' | 'loadedFromLocalRecoveryCache'>;

export function resolvePostSaveMetaState(
  state: Pick<AppMetaState, 'persistenceMode' | 'syncState' | 'cloudSyncStatus' | 'loadedFromLocalRecoveryCache' | 'lastSyncedAt' | 'lastCloudConfirmedAt' | 'lastLocalWriteAt' | 'lastFallbackRestoreAt'>,
  mode: 'supabase' | 'tauri-sqlite' | 'browser' | 'loading',
  timestamp: string,
  didPersist: boolean,
): PostSaveMetaState {
  if (!didPersist) {
    return {
      syncState: state.syncState === 'error' ? 'error' : 'saved',
      lastSyncedAt: state.lastSyncedAt,
      lastCloudConfirmedAt: state.lastCloudConfirmedAt,
      lastLocalWriteAt: state.lastLocalWriteAt,
      cloudSyncStatus: state.cloudSyncStatus,
      loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
    };
  }

  return {
    syncState: 'saved',
    lastSyncedAt: mode === 'supabase' ? timestamp : state.lastSyncedAt,
    lastCloudConfirmedAt: mode === 'supabase' ? timestamp : state.lastCloudConfirmedAt,
    lastLocalWriteAt: timestamp,
    cloudSyncStatus: mode === 'supabase' ? 'cloud-confirmed' : 'local-only-confirmed',
    loadedFromLocalRecoveryCache: false,
  };
}
