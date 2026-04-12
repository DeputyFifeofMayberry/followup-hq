import type { DirtyRecordRef } from './persistenceQueue';
import type { AppStore } from './types';
import { deriveCanonicalSaveProofStatus, type CanonicalSaveProofStage } from './saveProofModel';

export interface RecordSaveStatusModel {
  stage: CanonicalSaveProofStage;
  label: string;
  detail: string;
  tone: 'info' | 'success' | 'warn' | 'danger';
  isEditing: boolean;
  isDirty: boolean;
  isSaving: boolean;
  timestamp?: string;
}

const keyFor = (ref: Pick<DirtyRecordRef, 'type' | 'id'>) => `${ref.type}:${ref.id}`;

export interface RecordSaveStatusSnapshot {
  canonicalStage: CanonicalSaveProofStage;
  canonicalStageLabel: string;
  canonicalStageDescription: string;
  ledger?: AppStore['recordSaveLedger'][string];
  isDirty: boolean;
  isEditingSurface: boolean;
  hasLocalUnsavedChanges: boolean;
  hasConflict: boolean;
  isSyncSaving: boolean;
  persistenceMode: AppStore['persistenceMode'];
}

export function selectRecordSaveStatusSnapshot(
  state: AppStore,
  record: Pick<DirtyRecordRef, 'type' | 'id'>,
): RecordSaveStatusSnapshot {
  const canonical = deriveCanonicalSaveProofStatus(state);
  const recordKey = keyFor(record);
  return {
    canonicalStage: canonical.stage,
    canonicalStageLabel: canonical.stageLabel,
    canonicalStageDescription: canonical.stageDescription,
    ledger: state.recordSaveLedger[recordKey],
    isDirty: state.dirtyRecordRefs.some((entry) => entry.type === record.type && entry.id === record.id),
    isEditingSurface: state.activeRecordSurface === 'full_editor'
      && state.activeRecordRef?.type === record.type
      && state.activeRecordRef?.id === record.id,
    hasLocalUnsavedChanges: state.hasLocalUnsavedChanges,
    hasConflict: state.conflictQueue.some((entry) => entry.recordId === record.id),
    isSyncSaving: state.syncState === 'saving',
    persistenceMode: state.persistenceMode,
  };
}

export function deriveRecordSaveStatusModel(
  snapshot: RecordSaveStatusSnapshot,
  options?: { editingOverride?: boolean },
): RecordSaveStatusModel {
  const isEditing = Boolean(options?.editingOverride ?? false) || snapshot.isEditingSurface;
  const hasAttention = snapshot.hasConflict
    || (snapshot.canonicalStage === 'needs-attention' && (snapshot.isDirty || isEditing || Boolean(snapshot.ledger)));

  if (hasAttention) {
    return {
      stage: 'needs-attention',
      label: snapshot.hasConflict ? 'Needs attention (conflict)' : 'Needs attention',
      detail: snapshot.hasConflict
        ? 'This record is involved in a save conflict and requires review.'
        : 'Save trust is degraded for this record until the current issue is resolved.',
      tone: 'danger',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger?.lastAttentionAt,
    };
  }

  const isSaving = snapshot.isSyncSaving && (snapshot.isDirty || snapshot.hasLocalUnsavedChanges);
  if (isSaving) {
    return {
      stage: 'saving',
      label: 'Saving…',
      detail: 'Writing local durable state and advancing cloud sync.',
      tone: 'info',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: true,
      timestamp: snapshot.ledger?.lastQueuedAt,
    };
  }

  if (isEditing && snapshot.isDirty) {
    return {
      stage: 'editing',
      label: 'Editing',
      detail: 'You have unsaved edits for this record.',
      tone: 'info',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger?.lastQueuedAt,
    };
  }

  if (snapshot.isDirty) {
    return {
      stage: 'queued-for-cloud',
      label: 'Queued for cloud',
      detail: 'Saved locally and queued for cloud confirmation.',
      tone: 'warn',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger?.lastLocalSavedAt ?? snapshot.ledger?.lastQueuedAt,
    };
  }

  if (snapshot.persistenceMode !== 'supabase') {
    return {
      stage: 'saved-locally',
      label: 'Saved locally',
      detail: 'Protected on this device profile.',
      tone: 'info',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger?.lastLocalSavedAt,
    };
  }

  if (snapshot.ledger?.lastVerifiedRevision !== undefined) {
    const localRevision = snapshot.ledger.lastLocalSavedRevision ?? snapshot.ledger.lastCloudConfirmedRevision ?? 0;
    if (localRevision > snapshot.ledger.lastVerifiedRevision) {
      return {
        stage: 'verification-stale',
        label: 'Verification stale',
        detail: 'This record changed after its last cloud verification.',
        tone: 'warn',
        isDirty: snapshot.isDirty,
        isEditing,
        isSaving: false,
        timestamp: snapshot.ledger.lastVerifiedAt,
      };
    }

    return {
      stage: 'cloud-verified',
      label: 'Cloud verified',
      detail: 'Cloud read-back verification covers this record revision.',
      tone: 'success',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger.lastVerifiedAt,
    };
  }

  if (snapshot.ledger?.lastCloudConfirmedRevision !== undefined) {
    return {
      stage: 'cloud-confirmed',
      label: 'Cloud confirmed',
      detail: 'Cloud commit receipt includes this record revision.',
      tone: 'success',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger.lastCloudConfirmedAt,
    };
  }

  if (snapshot.ledger?.lastLocalSavedRevision !== undefined) {
    return {
      stage: 'saved-locally',
      label: 'Saved locally',
      detail: 'Locally durable; awaiting cloud confirmation.',
      tone: 'info',
      isDirty: snapshot.isDirty,
      isEditing,
      isSaving: false,
      timestamp: snapshot.ledger.lastLocalSavedAt,
    };
  }

  return {
    stage: snapshot.canonicalStage,
    label: snapshot.canonicalStageLabel,
    detail: snapshot.canonicalStageDescription,
    tone: snapshot.canonicalStage === 'cloud-confirmed' || snapshot.canonicalStage === 'cloud-verified' ? 'success' : snapshot.canonicalStage === 'queued-for-cloud' || snapshot.canonicalStage === 'verification-stale' ? 'warn' : snapshot.canonicalStage === 'needs-attention' ? 'danger' : 'info',
    isDirty: snapshot.isDirty,
    isEditing,
    isSaving: false,
  };
}

export function selectRecordSaveStatus(
  state: AppStore,
  record: Pick<DirtyRecordRef, 'type' | 'id'>,
  options?: { editingOverride?: boolean },
): RecordSaveStatusModel {
  return deriveRecordSaveStatusModel(selectRecordSaveStatusSnapshot(state, record), options);
}
