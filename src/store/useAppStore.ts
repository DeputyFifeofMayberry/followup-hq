import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createPersistenceQueue } from './persistenceQueue';
import { buildPersistedPayload } from './state/persistence';
import { initialBusinessState, initialMetaState, initialUiState } from './state/initialState';
import { createUiSlice } from './slices/uiSlice';
import { createExecutionViewSlice } from './slices/executionViewSlice';
import { createFollowUpsSlice } from './slices/followUpsSlice';
import { createTasksSlice } from './slices/tasksSlice';
import { createProjectsSlice } from './slices/projectsSlice';
import { createRelationshipsSlice } from './slices/relationshipsSlice';
import { createIntakeSlice } from './slices/intakeSlice';
import { createForwardingSlice } from './slices/forwardingSlice';
import { createOutlookSlice } from './slices/outlookSlice';
import { createMetaSlice } from './slices/metaSlice';
import { clearExpiredUndoEntries, executeUndoFromStack, invalidateOverlappingUndoEntries, registerUndoEntryWithCleanup } from './useCases/undoManager';
import type { AppStore } from './types';
import type { DirtyRecordRef, PersistenceQueueController, QueueRequestMeta } from './persistenceQueue';
import { appendPersistenceActivity, createPersistenceActivityEvent } from './persistenceActivity';
import { getSaveResultKind, resolvePostSaveMetaState } from './persistenceMeta';
import { verifyPersistedState, type VerificationMode } from '../lib/persistenceVerification';
import { readLocalPersistedPayloadSnapshot } from '../lib/persistence';
import { selectVerificationTargetPayload } from './verificationTarget';
import { deriveVerificationMetaFromResult } from './verificationState';
import { deriveCanonicalSaveProofStatus } from './saveProofModel';
import {
  buildReminderCenterSummary,
  buildWorkspaceAttentionCounts,
  evaluateReminderCandidates,
  shouldDeliverReminder,
} from '../lib/reminders';
import { deliverReminderNotification } from '../lib/notifications/delivery';
import {
  getEffectivePermissionState,
  requestNotificationPermissionForCurrentPlatform,
} from '../lib/notifications/platform';
import { brand } from '../config/brand';

const defaultOutlookConnection = initialBusinessState.outlookConnection;

let persistenceQueue: PersistenceQueueController | null = null;
let pendingAutomaticVerificationKey: string | null = null;
let automaticVerificationInFlightKey: string | null = null;
let automaticVerificationTimer: ReturnType<typeof setTimeout> | null = null;
let completedAutomaticVerificationKey: string | null = null;
let verificationLifecyclePromise: Promise<void> | null = null;

export function canRunAutomaticVerification(state: AppStore): boolean {
  const canonical = deriveCanonicalSaveProofStatus(state);
  return state.persistenceMode === 'supabase'
    && state.lastReceiptStatus === 'committed'
    && Boolean(state.lastConfirmedBatchId)
    && canonical.cloudConfirmationCurrentForRevision
    && (canonical.stage === 'cloud-confirmed' || canonical.stage === 'verification-stale')
    && !state.hasLocalUnsavedChanges
    && state.pendingBatchCount === 0
    && state.unresolvedOutboxCount === 0
    && state.syncState !== 'saving'
    && state.outboxState !== 'flushing'
    && state.cloudSyncState !== 'sending'
    && state.verificationState !== 'running'
    && !verificationLifecyclePromise;
}

export function buildAutomaticVerificationKey(
  state: Pick<AppStore, 'lastConfirmedBatchId' | 'lastConfirmedBatchCommittedAt' | 'localRevision'>,
  mode: VerificationMode,
): string {
  return `${mode}:${state.lastConfirmedBatchId ?? 'none'}:${state.lastConfirmedBatchCommittedAt ?? 'none'}:${state.localRevision}`;
}

export function resetPersistenceQueueController(): void {
  if (!persistenceQueue) return;
  persistenceQueue.cancelPending();
  persistenceQueue.resetInternalState();
  persistenceQueue = null;
  pendingAutomaticVerificationKey = null;
  automaticVerificationInFlightKey = null;
  completedAutomaticVerificationKey = null;
  verificationLifecyclePromise = null;
  if (automaticVerificationTimer) {
    clearTimeout(automaticVerificationTimer);
    automaticVerificationTimer = null;
  }
}

export const useAppStore = create<AppStore>()((set, get) => {
  const runVerificationLifecycle = async (mode: VerificationMode): Promise<void> => {
    if (verificationLifecyclePromise) return verificationLifecyclePromise;

    const lifecycleStart = get();
    const verificationRevisionAtStart = lifecycleStart.localRevision;
    const verificationBatchIdAtStart = lifecycleStart.lastConfirmedBatchId;

    const lifecycle = (async () => {
      const startedAt = new Date().toISOString();
      set((state) => ({
        verificationState: 'running',
        lastVerificationStartedAt: startedAt,
        lastVerificationFailureMessage: undefined,
        persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
          kind: 'saving',
          summary: mode === 'manual' ? 'Manual cloud verification started.' : 'Automatic cloud verification started.',
          detail: `${brand.appName} is reading cloud state and comparing it with the latest persisted payload.`,
        })),
      }));

      try {
        const current = get();
        const cachedPersistedPayload = await readLocalPersistedPayloadSnapshot();
        const verificationTarget = selectVerificationTargetPayload(
          { current, cachedPersistedPayload },
          mode === 'manual' ? undefined : { requireStablePersistedPayload: true },
        );
        if (!verificationTarget) {
          throw new Error('Stable persisted payload unavailable for verification. Cloud read verification was skipped until saved state stabilizes.');
        }

        const result = await verifyPersistedState({
          target: {
            payload: verificationTarget.payload,
            schemaVersionClient: current.lastReceiptSchemaVersion,
            lastLocalWriteAt: current.lastLocalWriteAt,
            localPayloadSource: verificationTarget.source,
          },
          context: {
            mode,
            basedOnBatchId: current.lastConfirmedBatchId,
            basedOnCommittedAt: current.lastConfirmedBatchCommittedAt,
            includePreviews: true,
            maxMismatchPreviewCount: 50,
          },
        });

        const derived = deriveVerificationMetaFromResult(result);
        const verificationMatchedCurrentRevision = Boolean(result.summary.verified
          && verificationBatchIdAtStart
          && result.summary.basedOnBatchId === verificationBatchIdAtStart);

        set((state) => ({
          recordSaveLedger: verificationMatchedCurrentRevision && state.localRevision === verificationRevisionAtStart
            ? Object.fromEntries(
              Object.entries(state.recordSaveLedger).map(([key, entry]) => {
                if (
                  entry.lastCloudConfirmedBatchId
                  && verificationBatchIdAtStart
                  && entry.lastCloudConfirmedBatchId === verificationBatchIdAtStart
                  && entry.lastCloudConfirmedRevision === verificationRevisionAtStart
                ) {
                  return [key, {
                    ...entry,
                    lastVerifiedAt: result.summary.completedAt,
                    lastVerifiedRevision: verificationRevisionAtStart,
                    lastVerifiedBatchId: verificationBatchIdAtStart,
                  }];
                }
                return [key, entry];
              }),
            )
            : state.recordSaveLedger,
          verificationState: derived.verificationState,
          lastVerificationRunId: result.summary.runId,
          lastVerificationStartedAt: result.summary.startedAt,
          lastVerificationCompletedAt: result.summary.completedAt,
          lastVerificationMatched: verificationMatchedCurrentRevision && state.localRevision === verificationRevisionAtStart,
          lastVerificationMismatchCount: result.summary.mismatchCount,
          lastVerificationBasedOnBatchId: result.summary.basedOnBatchId,
          lastVerificationFailureMessage: derived.failureMessage,
          verificationSummary: result.summary,
          latestVerificationResult: result,
          recoveryReviewNeeded: derived.recoveryReviewNeeded,
          reviewedMismatchIds: derived.recoveryReviewNeeded ? state.reviewedMismatchIds : [],
          saveProof: verificationMatchedCurrentRevision && state.localRevision === verificationRevisionAtStart
            ? {
              ...state.saveProof,
              latestVerifiedAt: result.summary.completedAt,
              latestVerifiedBatchId: verificationBatchIdAtStart,
              latestVerifiedRevision: verificationRevisionAtStart,
            }
            : state.saveProof,
          persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
            kind: 'saved',
            summary: result.summary.verified && state.localRevision !== verificationRevisionAtStart
              ? 'Verification completed for an earlier revision.'
              : derived.activitySummary,
            detail: result.summary.verified && state.localRevision !== verificationRevisionAtStart
              ? 'Cloud read-back matched the previously committed revision, but newer edits were made before verification finished. Run verification again after the latest commit.'
              : derived.activityDetail,
          })),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed.';
        set((state) => ({
          verificationState: 'failed',
          lastVerificationCompletedAt: new Date().toISOString(),
          lastVerificationMatched: false,
          lastVerificationFailureMessage: message,
          recoveryReviewNeeded: state.recoveryReviewNeeded,
          persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
            kind: 'failed',
            summary: 'Could not verify current cloud match.',
            detail: message,
          })),
        }));
      }
    })();

    verificationLifecyclePromise = lifecycle;
    return lifecycle.finally(() => {
      if (verificationLifecyclePromise === lifecycle) verificationLifecyclePromise = null;
    });
  };

  const scheduleAutomaticVerification = (mode: VerificationMode, summary: string, detail: string) => {
    const current = get();
    if (!canRunAutomaticVerification(current)) return;
    const key = buildAutomaticVerificationKey(current, mode);
    if (
      key === pendingAutomaticVerificationKey
      || key === automaticVerificationInFlightKey
      || key === completedAutomaticVerificationKey
    ) {
      return;
    }

    pendingAutomaticVerificationKey = key;
    set((state) => ({
      verificationState: state.verificationState === 'running' ? state.verificationState : 'pending',
      lastVerificationFailureMessage: undefined,
      persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
        kind: 'saved',
        summary,
        detail,
      })),
    }));

    if (automaticVerificationTimer) clearTimeout(automaticVerificationTimer);
    automaticVerificationTimer = setTimeout(() => {
      automaticVerificationTimer = null;
      const latest = get();
      const latestKey = buildAutomaticVerificationKey(latest, mode);

      if (pendingAutomaticVerificationKey !== latestKey) {
        if (pendingAutomaticVerificationKey === key) pendingAutomaticVerificationKey = null;
        return;
      }

      if (!canRunAutomaticVerification(latest)) {
        pendingAutomaticVerificationKey = null;
        set((state) => ({
          verificationState: state.verificationState === 'pending' ? 'idle' : state.verificationState,
        }));
        return;
      }

      pendingAutomaticVerificationKey = null;
      automaticVerificationInFlightKey = latestKey;
      void runVerificationLifecycle(mode).finally(() => {
        if (automaticVerificationInFlightKey === latestKey) {
          automaticVerificationInFlightKey = null;
        }
        completedAutomaticVerificationKey = latestKey;
      });
    }, 0);
  };

  const queuePersist = (meta?: QueueRequestMeta) => {
    const recordKey = (ref: DirtyRecordRef) => `${ref.type}:${ref.id}`;
    if (!persistenceQueue) {
      persistenceQueue = createPersistenceQueue(
        {
          getPayload: () => buildPersistedPayload(get()),
          getSyncAttemptContext: () => {
            const state = get();
            return {
              hasUnresolvedBatches: state.pendingBatchCount > 0 || state.unresolvedOutboxCount > 0,
              localRevision: state.localRevision,
              lastCloudConfirmedRevision: state.lastCloudConfirmedRevision,
              persistenceMode: state.persistenceMode,
              online: state.connectivityState !== 'offline',
            };
          },
          onQueued: (requestMeta) => {
            set((state) => {
              const merged = new Map<string, DirtyRecordRef>();
              state.dirtyRecordRefs.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              requestMeta?.dirtyRecords?.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              const queuedAt = new Date().toISOString();
              const ledger = { ...state.recordSaveLedger };
              requestMeta?.dirtyRecords?.forEach((ref) => {
                const key = recordKey(ref);
                const previous = ledger[key];
                ledger[key] = {
                  ...previous,
                  type: ref.type,
                  id: ref.id,
                  lastQueuedAt: queuedAt,
                  lastQueuedRevision: state.localRevision + 1,
                };
              });
              const scopedCount = requestMeta?.dirtyRecords?.length ?? 0;
              const queuedEvent = createPersistenceActivityEvent({
                kind: 'queued',
                summary: 'Changes queued to save.',
                detail: scopedCount > 0 ? `${scopedCount} change${scopedCount === 1 ? '' : 's'} added to the save queue.` : `${brand.appName} will save your latest updates automatically.`,
              });
              const pendingRecordCount = merged.size;
              return {
                hasLocalUnsavedChanges: true,
                unsavedChangeCount: pendingRecordCount,
                dirtyRecordRefs: Array.from(merged.values()),
                recordSaveLedger: ledger,
                syncState: 'dirty',
                outboxState: 'queued',
                localSaveState: 'saved',
                cloudSyncState: state.connectivityState === 'offline' ? 'offline-pending' : 'queued',
                trustState: state.sessionDegraded ? 'degraded' : 'local-only',
                pendingOfflineChangeCount: state.connectivityState === 'offline' ? pendingRecordCount : state.pendingOfflineChangeCount,
                saveError: '',
                cloudSyncStatus: state.sessionDegraded
                  ? state.cloudSyncStatus
                  : state.persistenceMode === 'supabase'
                    ? 'pending-cloud'
                    : 'local-only-confirmed',
                persistenceActivity: appendPersistenceActivity(state.persistenceActivity, queuedEvent),
              };
            });
          },
          onSaving: ({ reason }) => set((state) => {
            const backendBlocked = state.sessionDegradedReason === 'backend-schema-mismatch'
              || state.sessionDegradedReason === 'backend-rpc-missing'
              || state.sessionDegradedReason === 'backend-missing-hashing-support'
              || state.sessionDegradedReason === 'payload-invalid';
            const summary = backendBlocked
              ? state.sessionDegradedReason === 'backend-rpc-missing'
                ? 'Cloud sync blocked by missing RPC.'
                : state.sessionDegradedReason === 'backend-missing-hashing-support'
                  ? 'Cloud sync blocked by backend hashing failure.'
                : 'Cloud sync blocked by schema mismatch.'
              : reason === 'replay'
                ? 'Reconnect detected — replaying pending changes.'
                : reason === 'retry'
                  ? 'Retry in progress.'
                : reason === 'manual'
                  ? 'Saving latest changes.'
                  : 'Saving latest changes.';
            return {
              syncState: 'saving',
              outboxState: 'flushing',
              localSaveState: 'saving',
              cloudSyncState: state.persistenceMode !== 'supabase'
                ? 'confirmed'
                : backendBlocked
                  ? 'queued'
                  : state.connectivityState === 'offline'
                    ? 'offline-pending'
                    : 'sending',
              pendingBatchCount: Math.max(
                state.pendingBatchCount,
                state.unsavedChangeCount,
                state.unresolvedOutboxCount,
              ),
              saveError: '',
              persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({ kind: 'saving', summary })),
            };
          }),
          onSaved: (mode, timestamp, reason, didPersist, diagnostics, flushedDirtyRecords) => {
            let shouldSchedulePostSaveVerification = false;
            set((state) => {
              const postSave = resolvePostSaveMetaState(state, mode, timestamp, didPersist, diagnostics);
              const saveKind = getSaveResultKind(mode, didPersist);
              const unresolvedAfterSave = diagnostics?.unresolvedOutboxCountAfterSave ?? state.unresolvedOutboxCount;
              const pendingOperationCount = diagnostics?.pendingOperationCount ?? state.pendingBatchCount;
              const hasOutstandingCloudWork = unresolvedAfterSave > 0 || pendingOperationCount > 0;
              const nextLocalRevision = didPersist ? state.localRevision + 1 : state.localRevision;
              const hasConfirmedCloudReceipt = mode === 'supabase'
                && postSave.saveProof.latestReceiptStatus === 'committed'
                && Boolean(postSave.saveProof.latestConfirmedBatchId);
              const flushedRecordKeys = new Set(flushedDirtyRecords.map((ref) => recordKey(ref)));
              const remainingDirtyRefs = state.dirtyRecordRefs.filter((ref) => !flushedRecordKeys.has(recordKey(ref)));
              const hasRemainingDirtyRefs = remainingDirtyRefs.length > 0;
              const nextLedger = { ...state.recordSaveLedger };
              flushedDirtyRecords.forEach((ref) => {
                const key = recordKey(ref);
                const previous = nextLedger[key];
                nextLedger[key] = {
                  ...previous,
                  type: ref.type,
                  id: ref.id,
                  lastLocalSavedAt: timestamp,
                  lastLocalSavedRevision: nextLocalRevision,
                  ...(hasConfirmedCloudReceipt
                    ? {
                      lastCloudConfirmedAt: postSave.lastCloudConfirmedAt ?? timestamp,
                      lastCloudConfirmedRevision: nextLocalRevision,
                      lastCloudConfirmedBatchId: postSave.lastConfirmedBatchId,
                    }
                    : {}),
                };
              });
              const autoVerificationKey = buildAutomaticVerificationKey({
                lastConfirmedBatchId: postSave.lastConfirmedBatchId,
                lastConfirmedBatchCommittedAt: postSave.lastConfirmedBatchCommittedAt,
                localRevision: nextLocalRevision,
              }, 'post-save');
              shouldSchedulePostSaveVerification = hasConfirmedCloudReceipt
                && !hasOutstandingCloudWork
                && postSave.syncState !== 'saving'
                && autoVerificationKey !== completedAutomaticVerificationKey;
              const staleDeleteDetail = diagnostics?.staleDeleteWarnings?.length
                ? ` ${diagnostics.staleDeleteWarnings.join(' ')}`
                : '';
              const recoveredByCloudSave = state.sessionDegraded && !postSave.sessionDegraded && postSave.sessionDegradedClearedByCloudSave;
              const backendBlocked = state.sessionDegradedReason === 'backend-schema-mismatch'
                || state.sessionDegradedReason === 'backend-rpc-missing'
                || state.sessionDegradedReason === 'backend-missing-hashing-support'
                || diagnostics?.failureKind === 'backend_missing_rpc'
                || diagnostics?.failureKind === 'backend_hashing_failure'
                || diagnostics?.failureKind === 'backend_rpc_exposure_cache'
                || diagnostics?.failureKind === 'backend_schema_mismatch';
              const saveSummary = reason === 'replay'
                ? hasOutstandingCloudWork
                  ? 'Reconnect replay attempted; pending cloud work remains.'
                  : 'Reconnect replay completed.'
                : reason === 'retry'
                ? recoveredByCloudSave
                  ? 'Retry completed and trust restored.'
                  : 'Retry completed.'
                : backendBlocked
                  ? 'Local changes remain protected until backend contract is repaired.'
                : saveKind === 'cloud-confirmed'
                  ? 'Changes confirmed to cloud.'
                : saveKind === 'local-only'
                  ? 'Changes saved locally.'
                : 'No new changes to save.';
              const saveDetail = saveKind === 'cloud-confirmed'
                ? `Your latest updates are confirmed in cloud storage.${diagnostics?.batchId ? ` Batch ${diagnostics.batchId}.` : ''}${staleDeleteDetail}`
                : hasOutstandingCloudWork
                  ? state.connectivityState === 'offline' || diagnostics?.skippedCloudSend
                    ? 'Local durable copy updated. Cloud replay is pending until connectivity is restored.'
                    : `Local durable copy updated. ${unresolvedAfterSave} unresolved batch${unresolvedAfterSave === 1 ? '' : 'es'} still pending cloud confirmation.`
                : saveKind === 'local-only'
                  ? `Your latest updates are saved on this device.${staleDeleteDetail}`
                  : backendBlocked
                    ? (state.sessionDegradedReason === 'backend-rpc-missing'
                      ? 'Save skipped: cloud sync is blocked because apply_save_batch is missing in the connected Supabase project.'
                      : state.sessionDegradedReason === 'backend-missing-hashing-support'
                        ? 'Save skipped: cloud persistence backend hashing failed. A stale SQL function or invalid digest() signature is still deployed.'
                      : 'Save skipped: cloud sync is blocked until the Supabase schema contract is repaired.')
                    : 'No new changes were detected.';
              const recoveredEvent = recoveredByCloudSave
                ? createPersistenceActivityEvent({
                  kind: 'saved',
                  at: timestamp,
                  summary: 'Cloud-backed trust restored for this session.',
                  detail: `${brand.appName} confirmed a cloud-backed save and cleared the session trust warning.`,
                })
                : null;
              return {
                persistenceMode: mode,
                localRevision: nextLocalRevision,
                lastLocalSavedAt: timestamp,
                syncState: hasRemainingDirtyRefs ? 'dirty' : postSave.syncState,
                saveError: '',
                lastSyncedAt: postSave.lastSyncedAt,
                lastCloudConfirmedAt: postSave.lastCloudConfirmedAt,
                lastLocalWriteAt: postSave.lastLocalWriteAt,
                lastSuccessfulPersistAt: postSave.lastSuccessfulPersistAt,
                lastSuccessfulCloudPersistAt: postSave.lastSuccessfulCloudPersistAt,
                lastConfirmedBatchId: postSave.lastConfirmedBatchId,
                lastConfirmedBatchCommittedAt: postSave.lastConfirmedBatchCommittedAt,
                lastReceiptStatus: postSave.lastReceiptStatus,
                lastReceiptHashMatch: postSave.lastReceiptHashMatch,
                lastReceiptSchemaVersion: postSave.lastReceiptSchemaVersion,
                lastReceiptTouchedTables: postSave.lastReceiptTouchedTables,
                lastReceiptOperationCount: postSave.lastReceiptOperationCount,
                lastReceiptOperationCountsByEntity: postSave.lastReceiptOperationCountsByEntity,
                lastFailedBatchId: postSave.lastFailedBatchId,
                saveProof: postSave.saveProof,
                lastFailureClass: undefined,
                lastFailureNonRetryable: undefined,
                lastSanitizedFieldCount: diagnostics?.sanitizedFieldCount,
                lastSanitizedEntityTypes: diagnostics?.sanitizedEntityTypes,
                lastCloudConfirmedRevision: hasConfirmedCloudReceipt
                  ? Math.max(nextLocalRevision, state.lastCloudConfirmedRevision)
                  : state.lastCloudConfirmedRevision,
                localSaveState: 'saved',
                cloudSyncState: mode !== 'supabase'
                  ? (hasRemainingDirtyRefs ? 'queued' : 'confirmed')
                  : hasConfirmedCloudReceipt
                    ? (hasRemainingDirtyRefs ? (state.connectivityState === 'offline' ? 'offline-pending' : 'queued') : 'confirmed')
                    : hasOutstandingCloudWork
                      ? state.connectivityState === 'offline' || diagnostics?.skippedCloudSend
                        ? 'offline-pending'
                        : 'queued'
                    : state.connectivityState === 'offline'
                      ? 'offline-pending'
                      : (nextLocalRevision > state.lastCloudConfirmedRevision ? 'queued' : 'confirmed'),
                trustState: postSave.sessionDegraded ? 'degraded' : (postSave.sessionTrustState === 'recovered' ? 'recovered' : 'healthy'),
                outboxState: hasOutstandingCloudWork ? 'queued' : 'idle',
                unresolvedOutboxCount: unresolvedAfterSave,
                lastOutboxFlushAt: timestamp,
                lastFallbackRestoreAt: state.lastFallbackRestoreAt,
                unsavedChangeCount: remainingDirtyRefs.length,
                hasLocalUnsavedChanges: hasRemainingDirtyRefs,
                dirtyRecordRefs: remainingDirtyRefs,
                recordSaveLedger: nextLedger,
                pendingOfflineChangeCount: state.connectivityState === 'offline' || diagnostics?.skippedCloudSend
                  ? Math.max(unresolvedAfterSave, pendingOperationCount, remainingDirtyRefs.length)
                  : 0,
                cloudSyncStatus: hasOutstandingCloudWork || hasRemainingDirtyRefs ? 'pending-cloud' : postSave.cloudSyncStatus,
                pendingBatchCount: hasOutstandingCloudWork || hasRemainingDirtyRefs
                  ? Math.max(unresolvedAfterSave, pendingOperationCount, remainingDirtyRefs.length)
                  : 0,
                loadedFromLocalRecoveryCache: postSave.loadedFromLocalRecoveryCache,
                sessionTrustState: postSave.sessionTrustState,
                sessionDegraded: postSave.sessionDegraded,
                sessionDegradedReason: postSave.sessionDegradedReason,
                sessionDegradedAt: postSave.sessionDegradedAt,
                sessionDegradedClearedByCloudSave: postSave.sessionDegradedClearedByCloudSave,
                sessionTrustRecoveredAt: postSave.sessionTrustRecoveredAt,
                persistenceActivity: appendPersistenceActivity(
                  recoveredEvent ? appendPersistenceActivity(state.persistenceActivity, recoveredEvent) : state.persistenceActivity,
                  createPersistenceActivityEvent({
                    kind: 'saved',
                    at: timestamp,
                    summary: saveSummary,
                    detail: saveDetail,
                  }),
                ),
              };
            });
            if (shouldSchedulePostSaveVerification) {
              scheduleAutomaticVerification(
                'post-save',
                'Cloud save committed, verifying current cloud state.',
                `${brand.appName} is re-reading cloud state to confirm it matches the persisted local payload.`,
              );
            }
          },
          onError: (message, timestamp, reason, diagnostics) => set((state) => {
            const nextLedger = { ...state.recordSaveLedger };
            state.dirtyRecordRefs.forEach((ref) => {
              const key = recordKey(ref);
              nextLedger[key] = {
                ...nextLedger[key],
                type: ref.type,
                id: ref.id,
                lastAttentionAt: timestamp,
                lastAttentionReason: message,
              };
            });
            const nextSaveProof = {
              ...state.saveProof,
              latestLocalSaveAttemptAt: timestamp,
              latestDurableLocalWriteAt: timestamp,
              latestReceiptStatus: diagnostics?.receiptStatus ?? state.saveProof.latestReceiptStatus,
              latestReceiptHashMatch: diagnostics?.hashMatch ?? state.saveProof.latestReceiptHashMatch,
              latestReceiptSchemaVersion: diagnostics?.schemaVersion ?? state.saveProof.latestReceiptSchemaVersion,
              latestReceiptTouchedTables: diagnostics?.touchedTables ?? state.saveProof.latestReceiptTouchedTables,
              latestReceiptOperationCount: diagnostics?.operationCount ?? state.saveProof.latestReceiptOperationCount,
              latestReceiptOperationCountsByEntity: diagnostics?.operationCountsByEntity ?? state.saveProof.latestReceiptOperationCountsByEntity,
              latestFailedBatchId: diagnostics?.failedBatchId,
              latestFailureMessage: message,
              latestFailureClass: diagnostics?.failureClass ?? 'unknown',
              cloudProofState: 'degraded' as const,
            };
            return ({
            conflictQueue: diagnostics?.receiptStatus === 'conflict'
              ? [
                ...state.conflictQueue,
                ...(diagnostics.conflictIds ?? [`${diagnostics.failedBatchId ?? 'batch'}-conflict`]).map((id) => ({
                  id,
                  entity: 'unknown',
                  recordId: 'unknown',
                  conflictType: 'revision_mismatch',
                  summary: 'Cloud save blocked due to stale or concurrent state.',
                  technicalDetail: message,
                  localBatchId: diagnostics.batchId ?? diagnostics.failedBatchId,
                  status: 'open' as const,
                  createdAt: timestamp,
                })),
              ]
              : state.conflictQueue,
            syncState: 'error',
            outboxState: diagnostics?.receiptStatus === 'conflict' ? 'conflict' : 'failed',
            unresolvedOutboxCount: state.unresolvedOutboxCount,
            lastOutboxFailureAt: timestamp,
            saveError: message,
            hasLocalUnsavedChanges: true,
            unsavedChangeCount: state.dirtyRecordRefs.length,
            pendingOfflineChangeCount: state.connectivityState === 'offline' ? state.dirtyRecordRefs.length : state.pendingOfflineChangeCount,
            recordSaveLedger: nextLedger,
            cloudSyncStatus: 'cloud-save-failed-local-preserved',
            loadedFromLocalRecoveryCache: false,
            lastLocalWriteAt: timestamp,
            lastFailedSyncAt: timestamp,
            sessionTrustState: 'degraded',
            sessionDegraded: true,
            sessionDegradedReason: diagnostics?.failureKind === 'payload_invalid'
              ? 'payload-invalid'
              : diagnostics?.failureKind === 'backend_missing_rpc'
                || diagnostics?.failureKind === 'backend_rpc_exposure_cache'
                ? 'backend-rpc-missing'
                : diagnostics?.failureKind === 'backend_hashing_failure'
                  ? 'backend-missing-hashing-support'
                : diagnostics?.failureKind === 'backend_schema_mismatch'
                  ? 'backend-schema-mismatch'
                  : 'cloud-save-failed',
            sessionDegradedAt: state.sessionDegradedAt ?? timestamp,
            sessionDegradedClearedByCloudSave: false,
            lastFailedBatchId: nextSaveProof.latestFailedBatchId,
            lastReceiptStatus: nextSaveProof.latestReceiptStatus,
            lastReceiptHashMatch: nextSaveProof.latestReceiptHashMatch,
            lastReceiptSchemaVersion: nextSaveProof.latestReceiptSchemaVersion,
            lastReceiptTouchedTables: nextSaveProof.latestReceiptTouchedTables,
            lastReceiptOperationCount: nextSaveProof.latestReceiptOperationCount,
            lastReceiptOperationCountsByEntity: nextSaveProof.latestReceiptOperationCountsByEntity,
            pendingBatchCount: Math.max(state.pendingBatchCount, diagnostics?.operationCount ?? 1),
            localSaveState: 'error',
            cloudSyncState: diagnostics?.receiptStatus === 'conflict' ? 'conflict' : 'failed',
            trustState: 'degraded',
            lastFailureMessage: nextSaveProof.latestFailureMessage,
            lastFailureClass: nextSaveProof.latestFailureClass,
            saveProof: nextSaveProof,
            lastFailureNonRetryable: diagnostics?.nonRetryable,
            lastSanitizedFieldCount: diagnostics?.sanitizedFieldCount ?? state.lastSanitizedFieldCount,
            lastSanitizedEntityTypes: diagnostics?.sanitizedEntityTypes ?? state.lastSanitizedEntityTypes,
            unresolvedConflictCount: diagnostics?.receiptStatus === 'conflict' ? state.unresolvedConflictCount + 1 : state.unresolvedConflictCount,
            conflictReviewNeeded: diagnostics?.receiptStatus === 'conflict' || state.conflictReviewNeeded,
            openConflictCount: (diagnostics?.receiptStatus === 'conflict'
              ? (state.openConflictCount + (diagnostics?.conflictedOperationCount ?? 1))
              : state.openConflictCount),
            lastConflictDetectedAt: diagnostics?.receiptStatus === 'conflict' ? timestamp : state.lastConflictDetectedAt,
            lastConflictBatchId: diagnostics?.receiptStatus === 'conflict' ? (diagnostics?.batchId ?? diagnostics?.failedBatchId) : state.lastConflictBatchId,
            lastConflictFailureMessage: diagnostics?.receiptStatus === 'conflict' ? message : state.lastConflictFailureMessage,
            persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
              kind: 'failed',
              at: timestamp,
              summary: diagnostics?.failureKind === 'payload_invalid'
                ? 'Cloud save blocked by invalid content.'
                : diagnostics?.failureKind === 'backend_missing_rpc'
                  ? 'Cloud setup required: missing RPC.'
                  : diagnostics?.failureKind === 'backend_hashing_failure'
                    ? 'Cloud setup required: backend hashing failure.'
                  : diagnostics?.failureKind === 'backend_rpc_exposure_cache'
                    ? 'Cloud sync waiting on REST schema cache.'
                    : diagnostics?.failureKind === 'backend_schema_mismatch'
                      ? 'Cloud setup required: schema mismatch.'
                      : reason === 'replay'
                        ? 'Replay failed. Local copy preserved; attention needed.'
                        : reason === 'retry'
                        ? 'Retry failed. Protected local copy retained.'
                        : 'Save failed. Protected local copy retained.',
              detail: diagnostics?.failureKind === 'payload_invalid'
                ? `Cloud save is paused until invalid text content is repaired. Sanitized fields: ${diagnostics?.sanitizedFieldCount ?? 0}.`
                : diagnostics?.failureKind === 'backend_rpc_exposure_cache'
                  ? 'Cloud save RPC exists in Postgres but is not yet visible through the REST schema cache.'
                  : diagnostics?.failureKind === 'backend_hashing_failure'
                    ? 'Cloud persistence backend hashing failed. A stale SQL function or invalid digest() signature is still deployed.'
                  : diagnostics?.failedBatchId
                  ? `${message} (Technical detail: batch ${diagnostics.failedBatchId}${diagnostics.failedTable ? `; table ${diagnostics.failedTable}` : ''}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                  : diagnostics?.failedTable
                    ? `${message} (Technical detail: table ${diagnostics.failedTable}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                    : message,
            })),
          });
          }),
        },
        { debounceMs: 350, maxRetries: 2, retryDelayMs: 650 },
      );
    }
    persistenceQueue.enqueue(meta);
  };

  return {
    ...initialBusinessState,
    ...initialUiState,
    ...initialMetaState,
    ...createMetaSlice(set, defaultOutlookConnection),
    ...createUiSlice(set, get, queuePersist),
    ...createExecutionViewSlice(set, get, { queuePersist }),
    ...createFollowUpsSlice(set, get, { queuePersist }),
    ...createTasksSlice(set, get, { queuePersist }),
    ...createProjectsSlice(set, { queuePersist }),
    ...createRelationshipsSlice(set, get, { queuePersist }),
    ...createIntakeSlice(set, get, { queuePersist }),
    ...createForwardingSlice(set, { queuePersist }),
    ...createOutlookSlice(set, get, { queuePersist }, defaultOutlookConnection),
    registerUndoEntry: (input) => {
      let entryId: string | null = null;
      set((state) => {
        const registered = registerUndoEntryWithCleanup(state.undoStack, input);
        entryId = registered.entry.id;
        return { undoStack: registered.stack, lastUndoCleanupAt: new Date().toISOString() };
      });
      return entryId;
    },
    executeUndo: (entryId) => {
      let result: import('../lib/undo').UndoExecutionResult | undefined;
      set((state) => {
        const execution = executeUndoFromStack(state, entryId);
        result = execution.result;
        return execution.nextState;
      });
      const outcome: import('../lib/undo').UndoExecutionResult = result ?? { ok: false, status: 'not_found', reason: 'not_found' };
      if (outcome.ok && outcome.dirtyRecordRefs) {
        queuePersist({ dirtyRecords: outcome.dirtyRecordRefs });
        get().pushToast({ tone: 'success', title: 'Action undone', source: 'undo.execute' });
      } else if (!outcome.ok) {
        const title = outcome.reason === 'expired'
          ? 'Undo expired'
          : outcome.reason === 'superseded' || outcome.reason === 'record_changed_again'
            ? 'Undo no longer available'
            : 'Undo failed';
        const message = outcome.reason === 'superseded' || outcome.reason === 'record_changed_again'
          ? 'Record changed again; earlier undo is no longer safe.'
          : outcome.reason === 'expired'
            ? 'The 30-second undo window has passed.'
            : 'Undo could not be applied safely.';
        get().pushToast({ tone: 'warning', title, message, source: 'undo.execute' });
      }
      return outcome;
    },
    expireUndoEntry: (entryId) => set((state) => ({
      undoStack: state.undoStack.map((entry) => entry.id === entryId && entry.status === 'pending' ? { ...entry, status: 'expired', reason: 'expired' } : entry),
    })),
    clearExpiredUndoEntries: () => set((state) => ({
      undoStack: clearExpiredUndoEntries(state.undoStack),
      lastUndoCleanupAt: new Date().toISOString(),
    })),
    invalidateOverlappingUndoEntries: (entityRefs, reason = 'record_changed_again') => set((state) => ({
      undoStack: invalidateOverlappingUndoEntries(state.undoStack, entityRefs, reason),
    })),
    flushPersistenceNow: async () => {
      if (!persistenceQueue) return;
      await persistenceQueue.flushNow();
    },
    retryPersistenceNow: async () => {
      if (!persistenceQueue) return;
      await persistenceQueue.retryNow();
    },
    replayPendingPersistenceNow: async () => {
      if (!persistenceQueue) return;
      await persistenceQueue.replayPendingBatchesNow();
    },
    setConnectivityState: (connectivityState) => set((state) => ({
      connectivityState,
      lastConnectivityChangeAt: new Date().toISOString(),
      lastReconnectAttemptAt: connectivityState === 'online' ? new Date().toISOString() : state.lastReconnectAttemptAt,
      persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
        kind: 'queued',
        summary: connectivityState === 'offline'
          ? 'Offline — changes stay local.'
          : state.unresolvedOutboxCount > 0
            ? 'Reconnect detected, replaying pending changes.'
            : 'Back online — sync resumes.',
      })),
    })),
    resetForLogout: () => {
      resetPersistenceQueueController();
      set(() => ({
        ...initialBusinessState,
        ...initialUiState,
        ...initialMetaState,
      }));
    },
    updateReminderPreferences: (patch) => {
      const wasEnabled = get().reminderPreferences.enabled;
      set((state) => ({
        reminderPreferences: { ...state.reminderPreferences, ...patch },
      }));
      queuePersist();
      if (!wasEnabled && patch.enabled) {
        void requestNotificationPermissionForCurrentPlatform().then((permissionState) => {
          set((state) => ({
            reminderPermissionState: permissionState,
            reminderCenterSummary: {
              ...state.reminderCenterSummary,
              permissionState,
            },
          }));
          queuePersist();
        });
      }
    },
    dismissReminder: (signature) => {
      const nowIso = new Date().toISOString();
      set((state) => ({
        reminderLedger: state.reminderLedger.map((entry) => (
          entry.signature === signature ? { ...entry, lastDismissedAt: nowIso } : entry
        )),
        pendingReminders: state.pendingReminders.filter((candidate) => candidate.signature !== signature),
      }));
      queuePersist();
    },
    clearReminderLedger: () => {
      set({ reminderLedger: [] });
      queuePersist();
    },
    requestReminderPermission: async () => {
      const permissionState = await requestNotificationPermissionForCurrentPlatform();
      set((state) => ({
        reminderPermissionState: permissionState,
        reminderCenterSummary: {
          ...state.reminderCenterSummary,
          permissionState,
        },
      }));
      queuePersist();
      return permissionState;
    },
    setReminderSchedulerState: (schedulerState) => {
      set((state) => ({
        reminderCenterSummary: { ...state.reminderCenterSummary, schedulerState },
      }));
    },
    setReminderNextEvaluationAt: (nextPlannedEvaluationAt) => {
      set((state) => ({
        reminderCenterSummary: { ...state.reminderCenterSummary, nextPlannedEvaluationAt },
      }));
    },
    runReminderEvaluation: async (reason = 'manual') => {
      const nowIso = new Date().toISOString();
      const state = get();
      const candidates = evaluateReminderCandidates(
        state.items,
        state.tasks,
        state.reminderPreferences,
        nowIso,
      );
      const workspaceAttentionCounts = buildWorkspaceAttentionCounts(
        state.items,
        state.tasks,
        state.reminderPreferences,
        nowIso,
      );
      const permissionState = await getEffectivePermissionState();
      set((current) => ({
        reminderPermissionState: permissionState,
        pendingReminders: candidates,
        workspaceAttentionCounts,
        reminderCenterSummary: buildReminderCenterSummary(
          candidates,
          permissionState,
          current.reminderCenterSummary.schedulerState,
          nowIso,
          current.reminderCenterSummary.nextPlannedEvaluationAt,
          current.reminderCenterSummary.lastDeliveredAt,
        ),
        persistenceActivity: reason === 'manual'
          ? appendPersistenceActivity(
            current.persistenceActivity,
            createPersistenceActivityEvent({
              kind: 'manual-save',
              summary: 'Reminder evaluation completed.',
            }),
          )
          : current.persistenceActivity,
      }));
    },
    deliverEligibleReminders: async (candidates, nowIso) => {
      const state = get();
      let latestDeliveryAt = state.reminderCenterSummary.lastDeliveredAt;
      const ledgerBySignature = new Map(state.reminderLedger.map((entry) => [entry.signature, entry] as const));
      const nextLedger = [...state.reminderLedger];
      const permissionState = state.reminderPermissionState;
      for (const candidate of candidates) {
        const ledgerEntry = ledgerBySignature.get(candidate.signature);
        if (!shouldDeliverReminder(candidate, ledgerEntry, state.reminderPreferences, nowIso)) continue;
        const result = await deliverReminderNotification(candidate, state.reminderPreferences, permissionState);
        if (!result.delivered) continue;
        latestDeliveryAt = nowIso;
        const updatedEntry = {
          signature: candidate.signature,
          lastDeliveredAt: nowIso,
          lastSeenSeverity: candidate.severity,
          lastSortTime: candidate.sortTime,
          deliveryCount: (ledgerEntry?.deliveryCount ?? 0) + 1,
          lastDismissedAt: ledgerEntry?.lastDismissedAt,
          mutedUntil: ledgerEntry?.mutedUntil,
        };
        if (ledgerEntry) {
          const idx = nextLedger.findIndex((entry) => entry.signature === candidate.signature);
          nextLedger[idx] = updatedEntry;
        } else {
          nextLedger.push(updatedEntry);
        }
      }
      set((current) => ({
        reminderLedger: nextLedger,
        reminderCenterSummary: {
          ...current.reminderCenterSummary,
          lastDeliveredAt: latestDeliveryAt,
        },
      }));
      queuePersist();
    },
    testReminderNotification: async () => {
      const state = get();
      const nowIso = new Date().toISOString();
      const permissionState = await getEffectivePermissionState();
      if (permissionState !== 'granted') return;
      const candidate = {
        id: 'test-reminder',
        signature: `test:reminder:${new Date(nowIso).toISOString().slice(0, 13)}`,
        kind: 'task_due_soon' as const,
        recordType: 'task' as const,
        recordId: 'test',
        title: `${brand.appName} reminder test`,
        project: brand.appName,
        owner: 'You',
        severity: 'info' as const,
        workspaceTarget: 'worklist' as const,
        message: 'Notifications are enabled and working.',
        reason: 'Manual test notification',
        sortTime: nowIso,
      };
      const result = await deliverReminderNotification(candidate, state.reminderPreferences, permissionState);
      if (result.delivered) {
        set((current) => ({
          reminderCenterSummary: { ...current.reminderCenterSummary, lastDeliveredAt: nowIso },
        }));
      }
    },

    verifyNow: async (mode = 'manual') => {
      await runVerificationLifecycle(mode);
    },
    markVerificationMismatchReviewed: (mismatchId) => set((state) => (
      state.reviewedMismatchIds.includes(mismatchId)
        ? state
        : { reviewedMismatchIds: [...state.reviewedMismatchIds, mismatchId] }
    )),
    clearReviewedVerificationMismatches: () => set({ reviewedMismatchIds: [] }),
    markConflictReviewed: (conflictId) => set((state) => ({
      conflictQueue: state.conflictQueue.map((conflict) => (
        conflict.id === conflictId ? { ...conflict, status: 'reviewed', updatedAt: new Date().toISOString() } : conflict
      )),
    })),
    dismissConflict: (conflictId) => set((state) => {
      const nextQueue = state.conflictQueue.map((conflict) => (
        conflict.id === conflictId ? { ...conflict, status: 'dismissed' as const, updatedAt: new Date().toISOString() } : conflict
      ));
      const openCount = nextQueue.filter((entry) => entry.status === 'open').length;
      return {
        conflictQueue: nextQueue,
        openConflictCount: openCount,
        conflictReviewNeeded: openCount > 0,
      };
    }),
    isRecordDirty: (type, id) => get().dirtyRecordRefs.some((ref) => ref.type === type && ref.id === id),
  };
});

export const useAppStoreShallow = useShallow;
