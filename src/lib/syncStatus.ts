import type { PersistenceMode } from '../types';
import type { AppStore } from '../store/types';
import type { CloudSyncStatus, SessionDegradedReason, SessionTrustState } from '../store/state/types';
import type { SaveBatchEntityCounts } from './persistenceTypes';

export type SyncState = 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';
export type SyncPrimaryState = 'checking' | 'saving' | 'saved' | 'needs-attention';

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
  sessionTrustState: SessionTrustState;
  sessionDegraded: boolean;
  sessionDegradedReason: SessionDegradedReason;
  sessionDegradedAt?: string;
  sessionDegradedClearedByCloudSave: boolean;
  sessionTrustRecoveredAt?: string;
  lastSuccessfulPersistAt?: string;
  lastSuccessfulCloudPersistAt?: string;
  lastConfirmedBatchId?: string;
  lastConfirmedBatchCommittedAt?: string;
  lastReceiptStatus?: 'committed' | 'rejected';
  lastReceiptHashMatch?: boolean;
  lastReceiptSchemaVersion?: number;
  lastReceiptTouchedTables?: string[];
  lastReceiptOperationCount?: number;
  lastReceiptOperationCountsByEntity?: SaveBatchEntityCounts;
  lastFailedBatchId?: string;
}

export interface SyncStatusModel {
  primaryState: SyncPrimaryState;
  stateLabel: string;
  stateDescription: string;
  reassurance: string;
  modeLabel: string;
  modeDescription: string;
  tone: 'default' | 'info' | 'warn';
  stateTone: 'info' | 'success' | 'warn' | 'danger';
  showSpinner: boolean;
  trustLabel?: string;
  trustDescription?: string;
  trustRecoveryMessage?: string;
}

export function getCloudConfirmationLabel(meta: Pick<SyncMetaSnapshot, 'cloudSyncStatus'>): string {
  switch (meta.cloudSyncStatus) {
    case 'cloud-confirmed':
      return 'Cloud confirmation complete';
    case 'pending-cloud':
      return 'Awaiting cloud confirmation';
    case 'local-only-confirmed':
      return 'Saved on this device';
    case 'local-newer-than-cloud':
      return 'Local copy newer than cloud';
    case 'local-recovery':
      return 'Opened with protected local copy';
    case 'cloud-read-failed-local-fallback':
      return 'Cloud read issue; protected local copy used';
    case 'cloud-save-failed-local-preserved':
      return 'Cloud save failed; local copy preserved';
    case 'load-failed-no-local-copy':
      return 'Could not confirm saved data';
    default:
      return 'Confirmation unavailable';
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
    sessionTrustState: state.sessionTrustState,
    sessionDegraded: state.sessionDegraded,
    sessionDegradedReason: state.sessionDegradedReason,
    sessionDegradedAt: state.sessionDegradedAt,
    sessionDegradedClearedByCloudSave: state.sessionDegradedClearedByCloudSave,
    sessionTrustRecoveredAt: state.sessionTrustRecoveredAt,
    lastSuccessfulPersistAt: state.lastSuccessfulPersistAt,
    lastSuccessfulCloudPersistAt: state.lastSuccessfulCloudPersistAt,
    lastConfirmedBatchId: state.lastConfirmedBatchId,
    lastConfirmedBatchCommittedAt: state.lastConfirmedBatchCommittedAt,
    lastReceiptStatus: state.lastReceiptStatus,
    lastReceiptHashMatch: state.lastReceiptHashMatch,
    lastReceiptSchemaVersion: state.lastReceiptSchemaVersion,
    lastReceiptTouchedTables: state.lastReceiptTouchedTables,
    lastReceiptOperationCount: state.lastReceiptOperationCount,
    lastReceiptOperationCountsByEntity: state.lastReceiptOperationCountsByEntity,
    lastFailedBatchId: state.lastFailedBatchId,
  };
}

function describePersistenceMode(mode: PersistenceMode): Pick<SyncStatusModel, 'modeLabel' | 'modeDescription'> {
  if (mode === 'supabase') {
    return {
      modeLabel: 'Cloud-backed',
      modeDescription: 'SetPoint saves to your account and keeps a protected local copy.',
    };
  }

  if (mode === 'tauri-sqlite') {
    return {
      modeLabel: 'Local on this device',
      modeDescription: 'SetPoint saves on this device profile.',
    };
  }

  if (mode === 'browser') {
    return {
      modeLabel: 'Local-only (this device)',
      modeDescription: 'SetPoint saves in this browser profile only.',
    };
  }

  return {
    modeLabel: 'Checking save mode',
    modeDescription: 'SetPoint is determining where saves are stored.',
  };
}

function getAttentionNarrative(meta: SyncMetaSnapshot): Pick<SyncStatusModel, 'stateDescription' | 'reassurance' | 'tone' | 'stateTone'> {
  if (meta.sessionDegradedReason === 'load-failed-no-local-copy') {
    return {
      reassurance: 'Save or load confirmation needs review.',
      stateDescription: 'SetPoint could not confirm saved data. Save once workspace is rebuilt to restore trust.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'cloud-save-failed') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'A cloud save failed. Retry a confirmed cloud save to restore session trust.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.sessionDegradedReason === 'cloud-read-failed-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'This session opened from protected local data after a cloud read issue. Confirm one cloud save to restore trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.sessionDegradedReason === 'local-newer-than-cloud') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'Local data was newer than cloud data. Confirm one cloud save to realign trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.sessionDegradedReason === 'local-recovery-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened with protected local data. Confirm one cloud save to restore trust.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-save-failed-local-preserved') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'Your recent changes were kept locally. Review save status and retry.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  if (meta.cloudSyncStatus === 'cloud-read-failed-local-fallback') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened your protected local copy because cloud data could not be confirmed.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-newer-than-cloud') {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint restored the newer local copy to avoid data loss.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'local-recovery' || meta.loadedFromLocalRecoveryCache) {
    return {
      reassurance: 'Your recent work was protected.',
      stateDescription: 'SetPoint opened using protected local data while save confirmation needs review.',
      tone: 'warn',
      stateTone: 'warn',
    };
  }

  if (meta.cloudSyncStatus === 'load-failed-no-local-copy') {
    return {
      reassurance: 'Save or load confirmation needs review.',
      stateDescription: 'SetPoint could not confirm saved data. Review technical details.',
      tone: 'warn',
      stateTone: 'danger',
    };
  }

  return {
    reassurance: 'Save confirmation needs review.',
    stateDescription: 'SetPoint protected your recent work, but save or load confirmation needs review.',
    tone: 'warn',
    stateTone: 'warn',
  };
}

export function getSyncStatusModel(meta: SyncMetaSnapshot): SyncStatusModel {
  const modeDetails = describePersistenceMode(meta.persistenceMode);

  if (!meta.hydrated || meta.syncState === 'checking' || meta.persistenceMode === 'loading') {
    return {
      primaryState: 'checking',
      stateLabel: 'Checking save status',
      stateDescription: 'Loading your workspace and save status.',
      reassurance: 'SetPoint is checking your latest save information.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: true,
      ...modeDetails,
    };
  }

  if (meta.syncState === 'saving' || meta.syncState === 'dirty' || meta.hasLocalUnsavedChanges) {
    return {
      primaryState: 'saving',
      stateLabel: 'Saving',
      stateDescription: 'Saving your latest changes.',
      reassurance: 'SetPoint is working on your latest updates now.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: meta.syncState === 'saving',
      ...modeDetails,
    };
  }

  const needsAttention =
    meta.sessionDegraded
    || meta.syncState === 'error'
    || Boolean(meta.saveError)
    || meta.cloudSyncStatus === 'local-newer-than-cloud'
    || meta.cloudSyncStatus === 'local-recovery'
    || meta.cloudSyncStatus === 'cloud-read-failed-local-fallback'
    || meta.cloudSyncStatus === 'cloud-save-failed-local-preserved'
    || meta.cloudSyncStatus === 'load-failed-no-local-copy'
    || Boolean(meta.loadedFromLocalRecoveryCache);

  if (needsAttention) {
    const attention = getAttentionNarrative(meta);
    return {
      primaryState: 'needs-attention',
      stateLabel: 'Needs attention',
      ...attention,
      trustLabel: 'Session trust needs review',
      trustDescription: attention.stateDescription,
      showSpinner: false,
      ...modeDetails,
    };
  }

  const localOnlySaved = meta.cloudSyncStatus === 'local-only-confirmed' || meta.persistenceMode !== 'supabase';
  if (localOnlySaved) {
    return {
      primaryState: 'saved',
      stateLabel: 'Saved',
      stateDescription: 'Your latest updates are saved on this device.',
      reassurance: 'Your latest updates are saved on this device.',
      tone: 'default',
      stateTone: 'success',
      showSpinner: false,
      trustLabel: meta.sessionTrustState === 'recovered' ? 'Session trust recovered' : 'Session trust healthy',
      trustDescription: meta.persistenceMode === 'browser'
        ? 'Local-only save mode is active and healthy for this session.'
        : 'Session trust is healthy.',
      trustRecoveryMessage: meta.sessionTrustRecoveredAt
        ? 'Cloud-backed save trust has been restored for this session.'
        : undefined,
      ...modeDetails,
    };
  }

  if (meta.cloudSyncStatus === 'pending-cloud') {
    return {
      primaryState: 'saved',
      stateLabel: 'Saved',
      stateDescription: 'Your latest updates are saved.',
      reassurance: 'SetPoint is finalizing cloud confirmation in the background.',
      tone: 'info',
      stateTone: 'info',
      showSpinner: false,
      trustLabel: 'Session trust healthy',
      trustDescription: 'SetPoint is finalizing cloud confirmation for the current healthy session.',
      ...modeDetails,
    };
  }

  return {
    primaryState: 'saved',
    stateLabel: 'Saved',
    stateDescription: 'Your latest updates are saved.',
    reassurance: 'Your latest updates are saved.',
    tone: 'default',
    stateTone: 'success',
    showSpinner: false,
    trustLabel: meta.sessionTrustState === 'recovered' ? 'Session trust recovered' : 'Session trust healthy',
    trustDescription: 'Session trust is healthy.',
    trustRecoveryMessage: meta.sessionTrustRecoveredAt
      ? 'Cloud-backed save trust has been restored for this session.'
      : undefined,
    ...modeDetails,
  };
}
