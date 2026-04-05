import type { PersistenceMode } from '../types';

export type SyncState = 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';

export interface SyncMetaSnapshot {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  syncState: SyncState;
  saveError: string;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  lastSyncedAt?: string;
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

  if (meta.saveError || meta.syncState === 'error') {
    return {
      stateLabel: 'Save issue',
      stateDescription: meta.saveError || 'Recent changes are not fully confirmed yet.',
      tone: 'warn',
      stateTone: 'danger',
      showSpinner: false,
      ...modeDetails,
    };
  }

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
      ? `${meta.unsavedChangeCount} local edits are waiting to sync.`
      : 'Local edits are waiting to sync.';
    return {
      stateLabel: 'Unsaved local edits',
      stateDescription: pendingDescription,
      tone: 'info',
      stateTone: 'warn',
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
