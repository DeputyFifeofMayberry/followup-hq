import type { PersistenceMode } from '../types';
import type { AppStore } from '../store/types';
import type { CloudSyncStatus } from '../store/state/types';

export type SyncState = 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';

export interface SyncMetaSnapshot {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  syncState: SyncState;
  saveError: string;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  cloudSyncStatus: CloudSyncStatus;
  loadedFromLocalRecoveryCache: boolean;
  lastSyncedAt?: string;
  lastCloudConfirmedAt?: string;
  lastLocalWriteAt?: string;
  lastFallbackRestoreAt?: string;
  lastFailedSyncAt?: string;
  lastLoadFailureStage?: string;
  lastLoadFailureMessage?: string;
  lastLoadRecoveredWithLocalCache?: boolean;
}

export interface SyncStatusModel {
  stateLabel: string;
  stateDescription: string;
  modeLabel: string;
  modeDescription: string;
  tone: 'default' | 'info' | 'warn';
  stateTone: 'info' | 'success' | 'warn' | 'danger';
  showSpinner: boolean;
}

export function getCloudConfirmationLabel(meta: Pick<SyncMetaSnapshot, 'cloudSyncStatus'>): string {
  switch (meta.cloudSyncStatus) {
    case 'cloud-confirmed':
      return 'Saved to cloud';
    case 'pending-cloud':
      return 'Saved locally, cloud confirmation pending';
    case 'local-only-confirmed':
      return 'Saved locally on this device';
    case 'local-newer-than-cloud':
      return 'Loaded from local recovery cache';
    case 'local-recovery':
      return 'Loaded from local recovery cache';
    case 'cloud-read-failed-local-fallback':
      return 'Cloud read failed; local copy preserved';
    case 'cloud-save-failed-local-preserved':
      return 'Save failed; latest local changes preserved';
    case 'load-failed-no-local-copy':
      return 'Load issue';
    default:
      return 'Cloud confirmation unavailable';
  }
}

export function selectSyncMetaSnapshot(state: AppStore): SyncMetaSnapshot {
  return {
    hydrated: state.hydrated,
    persistenceMode: state.persistenceMode,
    syncState: state.syncState,
    saveError: state.saveError,
    unsavedChangeCount: state.unsavedChangeCount,
    hasLocalUnsavedChanges: state.hasLocalUnsavedChanges,
    cloudSyncStatus: state.cloudSyncStatus,
    loadedFromLocalRecoveryCache: state.loadedFromLocalRecoveryCache,
    lastSyncedAt: state.lastSyncedAt,
    lastCloudConfirmedAt: state.lastCloudConfirmedAt,
    lastLocalWriteAt: state.lastLocalWriteAt,
    lastFallbackRestoreAt: state.lastFallbackRestoreAt,
    lastFailedSyncAt: state.lastFailedSyncAt,
    lastLoadFailureStage: state.lastLoadFailureStage,
    lastLoadFailureMessage: state.lastLoadFailureMessage,
    lastLoadRecoveredWithLocalCache: state.lastLoadRecoveredWithLocalCache,
  };
}

function describePersistenceMode(mode: PersistenceMode): Pick<SyncStatusModel, 'modeLabel' | 'modeDescription'> {
  if (mode === 'supabase') {
    return {
      modeLabel: 'Supabase-backed',
      modeDescription: 'Changes are persisted to SetPoint cloud storage and cached locally.',
    };
  }

  if (mode === 'tauri-sqlite') {
    return {
      modeLabel: 'Desktop local storage',
      modeDescription: 'Changes are saved in local desktop storage for this device.',
    };
  }

  if (mode === 'browser') {
    return {
      modeLabel: 'Browser/local only',
      modeDescription: 'Changes are currently stored in this browser cache only.',
    };
  }

  return {
    modeLabel: 'Checking storage',
    modeDescription: 'SetPoint is determining the active persistence mode.',
  };
}

function describeCloudStatus(meta: SyncMetaSnapshot): Pick<SyncStatusModel, 'stateLabel' | 'stateDescription' | 'tone' | 'stateTone'> | null {
  if (meta.cloudSyncStatus === 'load-failed-no-local-copy') {
    return {
      stateLabel: 'Load issue',
      stateDescription: meta.saveError || 'SetPoint could not load persisted data. No local recovery copy was restored.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-save-failed-local-preserved') {
    return {
      stateLabel: 'Save failed; latest local changes preserved',
      stateDescription: 'SetPoint kept your latest local cache and will retry cloud confirmation on the next save.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-read-failed-local-fallback') {
    return {
      stateLabel: 'Cloud read failed; local copy preserved',
      stateDescription: 'SetPoint loaded your local cache because cloud data could not be read.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-newer-than-cloud') {
    return {
      stateLabel: 'Loaded from local recovery cache',
      stateDescription: 'Your local cache is newer than cloud data, so SetPoint restored it to avoid data loss.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-recovery' || meta.loadedFromLocalRecoveryCache) {
    return {
      stateLabel: 'Loaded from local recovery cache',
      stateDescription: 'SetPoint restored local cache data to protect your latest changes.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-only-confirmed') {
    return {
      stateLabel: 'Saved locally on this device',
      stateDescription: 'Changes are stored locally in this browser/device profile.',
      tone: 'default',
      stateTone: 'success',
    };
  }

  if (meta.cloudSyncStatus === 'pending-cloud') {
    return {
      stateLabel: 'Saved locally, cloud confirmation pending',
      stateDescription: 'Recent changes are preserved locally and waiting for full cloud confirmation.',
      tone: 'info',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-confirmed') {
    return {
      stateLabel: 'Saved to cloud',
      stateDescription: 'Latest updates are confirmed in cloud storage.',
      tone: 'default',
      stateTone: 'success',
    };
  }

  return null;
}

export function getSyncStatusModel(meta: SyncMetaSnapshot): SyncStatusModel {
  const modeDetails = describePersistenceMode(meta.persistenceMode);

  if (!meta.hydrated || meta.syncState === 'checking' || meta.persistenceMode === 'loading') {
    return {
      stateLabel: 'Checking save status',
      stateDescription: 'SetPoint is loading your workspace and save connection.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  const cloudStatus = describeCloudStatus(meta);

  if (meta.syncState === 'saving') {
    return {
      stateLabel: 'Saving changes',
      stateDescription: 'SetPoint is writing your latest updates now.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  if (meta.hasLocalUnsavedChanges || meta.syncState === 'dirty') {
    const pendingDescription = meta.unsavedChangeCount > 1
      ? `${meta.unsavedChangeCount} records with unsaved edits are waiting to sync.`
      : '1 record with unsaved edits is waiting to sync.';
    return {
      stateLabel: 'Unsaved local edits',
      stateDescription: pendingDescription,
      tone: 'info',
      stateTone: 'warn',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (meta.syncState === 'error' || meta.saveError) {
    if (cloudStatus) {
      return {
        ...cloudStatus,
        showSpinner: false,
        ...modeDetails,
      };
    }

    return {
      stateLabel: 'Save issue',
      stateDescription: meta.saveError || 'Recent changes are not fully confirmed yet.',
      tone: 'warn',
      stateTone: 'danger',
      showSpinner: false,
      ...modeDetails,
    };
  }

  if (cloudStatus) {
    return {
      ...cloudStatus,
      showSpinner: false,
      ...modeDetails,
    };
  }

  return {
    stateLabel: 'All changes saved',
    stateDescription: 'Your latest updates are safely saved.',
    tone: 'default',
    stateTone: 'success',
    showSpinner: false,
    ...modeDetails,
  };
}
