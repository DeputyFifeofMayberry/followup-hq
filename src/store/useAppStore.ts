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
import { verifyPersistedState } from '../lib/persistenceVerification';
import { clearCommittedOutboxEntries, listUnresolvedOutboxEntries, loadOutboxState } from '../lib/persistenceOutbox';
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

const defaultOutlookConnection = initialBusinessState.outlookConnection;

let persistenceQueue: PersistenceQueueController | null = null;

export function resetPersistenceQueueController(): void {
  if (!persistenceQueue) return;
  persistenceQueue.cancelPending();
  persistenceQueue.resetInternalState();
  persistenceQueue = null;
}

export const useAppStore = create<AppStore>()((set, get) => {
  const queuePersist = (meta?: QueueRequestMeta) => {
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
              online: state.connectivityState !== 'offline',
            };
          },
          onQueued: (requestMeta) => {
            set((state) => {
              const merged = new Map<string, DirtyRecordRef>();
              state.dirtyRecordRefs.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              requestMeta?.dirtyRecords?.forEach((ref) => merged.set(`${ref.type}:${ref.id}`, ref));
              const scopedCount = requestMeta?.dirtyRecords?.length ?? 0;
              const queuedEvent = createPersistenceActivityEvent({
                kind: 'queued',
                summary: 'Changes queued to save.',
                detail: scopedCount > 0 ? `${scopedCount} change${scopedCount === 1 ? '' : 's'} added to the save queue.` : 'SetPoint will save your latest updates automatically.',
              });
              const pendingRecordCount = merged.size;
              return {
                hasLocalUnsavedChanges: true,
                unsavedChangeCount: pendingRecordCount,
                dirtyRecordRefs: Array.from(merged.values()),
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
            const backendBlocked = state.sessionDegradedReason === 'backend-schema-mismatch' || state.sessionDegradedReason === 'backend-rpc-missing';
            const summary = backendBlocked
              ? state.sessionDegradedReason === 'backend-rpc-missing'
                ? 'Cloud sync blocked by missing RPC.'
                : 'Cloud sync blocked by schema mismatch.'
              : reason === 'retry'
                ? 'Retry in progress.'
                : reason === 'manual'
                  ? 'Saving latest changes.'
                  : 'Saving latest changes.';
            return {
              syncState: 'saving',
              outboxState: 'flushing',
              localSaveState: 'saving',
              cloudSyncState: 'sending',
              saveError: '',
              persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({ kind: 'saving', summary })),
            };
          }),
          onSaved: (mode, timestamp, reason, didPersist, diagnostics) => {
            set((state) => {
              const postSave = resolvePostSaveMetaState(state, mode, timestamp, didPersist, diagnostics);
              const saveKind = getSaveResultKind(mode, didPersist);
              const staleDeleteDetail = diagnostics?.staleDeleteWarnings?.length
                ? ` ${diagnostics.staleDeleteWarnings.join(' ')}`
                : '';
              const recoveredByCloudSave = state.sessionDegraded && !postSave.sessionDegraded && postSave.sessionDegradedClearedByCloudSave;
              const backendBlocked = state.sessionDegradedReason === 'backend-schema-mismatch' || state.sessionDegradedReason === 'backend-rpc-missing'
                || diagnostics?.failureKind === 'backend_missing_rpc'
                || diagnostics?.failureKind === 'backend_schema_mismatch';
              const saveSummary = reason === 'retry'
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
                : saveKind === 'local-only'
                  ? `Your latest updates are saved on this device.${staleDeleteDetail}`
                  : backendBlocked
                    ? (state.sessionDegradedReason === 'backend-rpc-missing'
                      ? 'Save skipped: cloud sync is blocked because apply_save_batch is missing in the connected Supabase project.'
                      : 'Save skipped: cloud sync is blocked until the Supabase schema contract is repaired.')
                    : 'No new changes were detected.';
              const recoveredEvent = recoveredByCloudSave
                ? createPersistenceActivityEvent({
                  kind: 'saved',
                  at: timestamp,
                  summary: 'Cloud-backed trust restored for this session.',
                  detail: 'SetPoint confirmed a cloud-backed save and cleared the session trust warning.',
                })
                : null;
              return {
                persistenceMode: mode,
                localRevision: Math.max(state.localRevision, state.localRevision + (didPersist ? 1 : 0)),
                lastLocalSavedAt: timestamp,
                syncState: postSave.syncState,
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
                lastCloudConfirmedRevision: saveKind === 'cloud-confirmed' ? Math.max(state.localRevision + (didPersist ? 1 : 0), state.lastCloudConfirmedRevision) : state.lastCloudConfirmedRevision,
                pendingBatchCount: 0,
                localSaveState: 'saved',
                cloudSyncState: saveKind === 'cloud-confirmed' ? 'confirmed' : (state.connectivityState === 'offline' ? 'offline-pending' : 'queued'),
                trustState: postSave.sessionDegraded ? 'degraded' : (postSave.sessionTrustState === 'recovered' ? 'recovered' : 'healthy'),
                outboxState: 'idle',
                unresolvedOutboxCount: 0,
                lastOutboxFlushAt: timestamp,
                lastFallbackRestoreAt: state.lastFallbackRestoreAt,
                unsavedChangeCount: 0,
                hasLocalUnsavedChanges: false,
                dirtyRecordRefs: [],
                pendingOfflineChangeCount: 0,
                cloudSyncStatus: postSave.cloudSyncStatus,
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
          },
          onError: (message, timestamp, reason, diagnostics) => set((state) => ({
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
            cloudSyncStatus: 'cloud-save-failed-local-preserved',
            loadedFromLocalRecoveryCache: false,
            lastLocalWriteAt: timestamp,
            lastFailedSyncAt: timestamp,
            sessionTrustState: 'degraded',
            sessionDegraded: true,
            sessionDegradedReason: diagnostics?.failureKind === 'backend_missing_rpc'
              ? 'backend-rpc-missing'
              : diagnostics?.failureKind === 'backend_schema_mismatch'
                ? 'backend-schema-mismatch'
                : 'cloud-save-failed',
            sessionDegradedAt: state.sessionDegradedAt ?? timestamp,
            sessionDegradedClearedByCloudSave: false,
            lastFailedBatchId: diagnostics?.failedBatchId,
            pendingBatchCount: Math.max(state.pendingBatchCount, diagnostics?.operationCount ?? 1),
            localSaveState: 'error',
            cloudSyncState: diagnostics?.receiptStatus === 'conflict' ? 'conflict' : 'failed',
            trustState: 'degraded',
            lastFailureMessage: message,
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
              summary: diagnostics?.failureKind === 'backend_missing_rpc'
                ? 'Cloud setup required: missing RPC.'
                : diagnostics?.failureKind === 'backend_schema_mismatch'
                  ? 'Cloud setup required: schema mismatch.'
                  : reason === 'retry'
                    ? 'Retry failed. Protected local copy retained.'
                    : 'Save failed. Protected local copy retained.',
              detail: diagnostics?.failedBatchId
                ? `${message} (Technical detail: batch ${diagnostics.failedBatchId}${diagnostics.failedTable ? `; table ${diagnostics.failedTable}` : ''}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                : diagnostics?.failedTable
                  ? `${message} (Technical detail: table ${diagnostics.failedTable}; completed tables: ${diagnostics.completedTables.join(', ') || 'none'}.)`
                  : message,
            })),
          })),
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
      let result;
      set((state) => {
        const execution = executeUndoFromStack(state, entryId);
        result = execution.result;
        return execution.nextState;
      });
      const outcome = result as import('../lib/undo').UndoExecutionResult;
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
    setConnectivityState: (connectivityState) => set((state) => ({
      connectivityState,
      lastConnectivityChangeAt: new Date().toISOString(),
      persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
        kind: 'queued',
        summary: connectivityState === 'offline' ? 'Offline — changes stay local.' : 'Back online — sync resumes.',
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
        title: 'SetPoint reminder test',
        project: 'SetPoint',
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
      const startedAt = new Date().toISOString();
      set((state) => ({
        verificationState: 'running',
        lastVerificationStartedAt: startedAt,
        lastVerificationFailureMessage: undefined,
      }));

      try {
        const current = get();
        const result = await verifyPersistedState({
          target: {
            payload: buildPersistedPayload(current),
            schemaVersionClient: current.lastReceiptSchemaVersion,
            lastLocalWriteAt: current.lastLocalWriteAt,
          },
          context: {
            mode,
            basedOnBatchId: current.lastConfirmedBatchId,
            basedOnCommittedAt: current.lastConfirmedBatchCommittedAt,
            includePreviews: true,
            maxMismatchPreviewCount: 50,
          },
        });

        set((state) => ({
          verificationState: result.summary.verified ? 'verified-match' : 'mismatch-found',
          lastVerificationRunId: result.summary.runId,
          lastVerificationStartedAt: result.summary.startedAt,
          lastVerificationCompletedAt: result.summary.completedAt,
          lastVerificationMatched: result.summary.verified,
          lastVerificationMismatchCount: result.summary.mismatchCount,
          lastVerificationBasedOnBatchId: result.summary.basedOnBatchId,
          lastVerificationFailureMessage: result.summary.cloudReadSucceeded ? undefined : result.mismatches[0]?.technicalDetail,
          verificationSummary: result.summary,
          latestVerificationResult: result,
          recoveryReviewNeeded: !result.summary.verified,
          reviewedMismatchIds: !result.summary.verified ? state.reviewedMismatchIds : [],
          persistenceActivity: appendPersistenceActivity(state.persistenceActivity, createPersistenceActivityEvent({
            kind: 'saved',
            summary: result.summary.verified ? 'Verified match with cloud state.' : 'Recovery review needed.',
            detail: result.summary.verified
              ? 'Last verification matched current cloud state.'
              : `Last verification found ${result.summary.mismatchCount} mismatch${result.summary.mismatchCount === 1 ? '' : 'es'}.`,
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
        conflict.id === conflictId ? { ...conflict, status: 'dismissed', updatedAt: new Date().toISOString() } : conflict
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
