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

export function selectRecordSaveStatus(
  state: AppStore,
  record: Pick<DirtyRecordRef, 'type' | 'id'>,
  options?: { editingOverride?: boolean },
): RecordSaveStatusModel {
  const canonical = deriveCanonicalSaveProofStatus(state);
  const ledger = state.recordSaveLedger[keyFor(record)];
  const isDirty = state.dirtyRecordRefs.some((entry) => entry.type === record.type && entry.id === record.id);
  const isEditingSurface = state.activeRecordSurface === 'full_editor'
    && state.activeRecordRef?.type === record.type
    && state.activeRecordRef?.id === record.id;
  const isEditing = Boolean(options?.editingOverride ?? false) || isEditingSurface;
  const recordConflict = state.conflictQueue.some((entry) => entry.recordId === record.id);
  const hasAttention = recordConflict || (canonical.stage === 'needs-attention' && (isDirty || isEditing || Boolean(ledger)));

  if (hasAttention) {
    return {
      stage: 'needs-attention',
      label: recordConflict ? 'Needs attention (conflict)' : 'Needs attention',
      detail: recordConflict
        ? 'This record is involved in a save conflict and requires review.'
        : 'Save trust is degraded for this record until the current issue is resolved.',
      tone: 'danger',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger?.lastAttentionAt,
    };
  }

  const isSaving = state.syncState === 'saving' && (isDirty || state.hasLocalUnsavedChanges);
  if (isSaving) {
    return {
      stage: 'saving',
      label: 'Saving…',
      detail: 'Writing local durable state and advancing cloud sync.',
      tone: 'info',
      isDirty,
      isEditing,
      isSaving: true,
      timestamp: ledger?.lastQueuedAt,
    };
  }

  if (isEditing && isDirty) {
    return {
      stage: 'editing',
      label: 'Editing',
      detail: 'You have unsaved edits for this record.',
      tone: 'info',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger?.lastQueuedAt,
    };
  }

  if (isDirty) {
    return {
      stage: 'queued-for-cloud',
      label: 'Queued for cloud',
      detail: 'Saved locally and queued for cloud confirmation.',
      tone: 'warn',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger?.lastLocalSavedAt ?? ledger?.lastQueuedAt,
    };
  }

  if (state.persistenceMode !== 'supabase') {
    return {
      stage: 'saved-locally',
      label: 'Saved locally',
      detail: 'Protected on this device profile.',
      tone: 'info',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger?.lastLocalSavedAt,
    };
  }

  if (ledger?.lastVerifiedRevision !== undefined) {
    const localRevision = ledger.lastLocalSavedRevision ?? ledger.lastCloudConfirmedRevision ?? 0;
    if (localRevision > ledger.lastVerifiedRevision) {
      return {
        stage: 'verification-stale',
        label: 'Verification stale',
        detail: 'This record changed after its last cloud verification.',
        tone: 'warn',
        isDirty,
        isEditing,
        isSaving: false,
        timestamp: ledger.lastVerifiedAt,
      };
    }

    return {
      stage: 'cloud-verified',
      label: 'Cloud verified',
      detail: 'Cloud read-back verification covers this record revision.',
      tone: 'success',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger.lastVerifiedAt,
    };
  }

  if (ledger?.lastCloudConfirmedRevision !== undefined) {
    return {
      stage: 'cloud-confirmed',
      label: 'Cloud confirmed',
      detail: 'Cloud commit receipt includes this record revision.',
      tone: 'success',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger.lastCloudConfirmedAt,
    };
  }

  if (ledger?.lastLocalSavedRevision !== undefined) {
    return {
      stage: 'saved-locally',
      label: 'Saved locally',
      detail: 'Locally durable; awaiting cloud confirmation.',
      tone: 'info',
      isDirty,
      isEditing,
      isSaving: false,
      timestamp: ledger.lastLocalSavedAt,
    };
  }

  return {
    stage: canonical.stage,
    label: canonical.stageLabel,
    detail: canonical.stageDescription,
    tone: canonical.stage === 'cloud-confirmed' || canonical.stage === 'cloud-verified' ? 'success' : canonical.stage === 'queued-for-cloud' || canonical.stage === 'verification-stale' ? 'warn' : canonical.stage === 'needs-attention' ? 'danger' : 'info',
    isDirty,
    isEditing,
    isSaving: false,
  };
}
