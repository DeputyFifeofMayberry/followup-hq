import { loadPersistedPayload, type PersistenceLoadError } from '../../lib/persistence';
import { defaultExecutionViews } from '../../lib/unifiedQueue';
import { getDefaultForwardedRules } from '../../lib/intakeRules';
import { defaultFollowUpFilters } from '../../lib/followUpSelectors';
import { defaultTaskWorkspaceSession } from '../../domains/tasks';
import { defaultDirectoryWorkspaceSession } from '../../domains/directory/session';
import { defaultReportDraftState, sanitizeReportDraftState, sanitizeSavedReportDefinitions, toReportDraftState } from '../../lib/reports/savedDefinitions';
import { sanitizeReportRuns } from '../../lib/reports/reportRuns';
import { resolveProjectName, todayIso } from '../../lib/utils';
import { normalizeContact, normalizeCompany } from '../../domains/relationships/helpers';
import { deriveProjects, normalizeProjectRecord, projectCanonicalKey } from '../../domains/projects/helpers';
import { normalizeItems, attachProjects } from '../../domains/followups/helpers';
import { applyTaskRollupsToItems, normalizeTasks } from '../../domains/tasks/helpers';
import {
  enforceFollowUpIntegrity,
  enforceTaskIntegrity,
  isReviewRecord,
  isTrustedLiveRecord,
  repairLegacyFollowUpForHydration,
  repairLegacyTaskForHydration,
} from '../../domains/records/integrity';
import type { FollowUpColumnKey } from '../../types';
import type { AppStoreActions } from '../types';
import type { SliceSet } from './types';
import { refreshDuplicates } from '../useCases/mutationEffects';
import { createPersistenceActivityEvent, describeLoadFallbackFailure } from '../persistenceActivity';
import { deriveSyncMetaFromLoadResult } from './syncMetaDerivation';
import { formatPersistenceErrorMessage, normalizePersistenceError } from '../../lib/persistenceError';
import { listUnresolvedOutboxEntries, loadOutboxState } from '../../lib/persistenceOutbox';
import { incrementMetric } from '../../lib/persistenceMetrics';
import {
  DEFAULT_REMINDER_CENTER_SUMMARY,
  DEFAULT_REMINDER_PREFERENCES,
  DEFAULT_WORKSPACE_ATTENTION_COUNTS,
} from '../../lib/reminders';
import type { SaveProofState } from '../state/types';

interface MetaSliceDependencies {
  loadPersistedPayload: typeof loadPersistedPayload;
  listUnresolvedOutboxEntries: typeof listUnresolvedOutboxEntries;
  loadOutboxState: typeof loadOutboxState;
}

const defaultMetaSliceDependencies: MetaSliceDependencies = {
  loadPersistedPayload,
  listUnresolvedOutboxEntries,
  loadOutboxState,
};

export function createMetaSlice(
  set: SliceSet,
  defaultOutlookConnection: any,
  dependencies: Partial<MetaSliceDependencies> = {},
): Pick<AppStoreActions, 'initializeApp'> {
  const deps: MetaSliceDependencies = {
    ...defaultMetaSliceDependencies,
    ...dependencies,
  };
  return {
    initializeApp: async () => {
      const startupSaveProof: SaveProofState = {
        latestVerifiedAt: undefined,
        latestVerifiedBatchId: undefined,
        latestVerifiedRevision: undefined,
        latestLocalSaveAttemptAt: undefined,
        latestDurableLocalWriteAt: undefined,
        latestCloudConfirmedCommitAt: undefined,
        latestConfirmedBatchId: undefined,
        latestReceiptStatus: undefined,
        latestReceiptHashMatch: undefined,
        latestReceiptSchemaVersion: undefined,
        latestReceiptTouchedTables: undefined,
        latestReceiptOperationCount: undefined,
        latestReceiptOperationCountsByEntity: undefined,
        latestFailedBatchId: undefined,
        latestFailureMessage: undefined,
        latestFailureClass: undefined,
        cloudProofState: 'pending',
      };
      let unresolvedOutbox: Array<{ status: string }> = [];
      try {
        const {
          payload,
          mode,
          source,
          cacheStatus,
          loadedFromFallback,
          cloudReadFailed,
          localNewerThanCloud,
          cloudUpdatedAt,
          localCacheUpdatedAt,
          localCacheLastCloudConfirmedAt,
          loadFailureStage,
          loadFailureMessage,
          loadFailureRecoveredWithLocalCache,
          backendFailureKind,
          localRevision,
          lastCloudConfirmedRevision,
          lastCommittedBatchId: loadedLastCommittedBatchId,
          lastFailedBatchId: loadedLastFailedBatchId,
          lastReceiptStatus: loadedLastReceiptStatus,
          lastReceiptCommittedTime: loadedLastReceiptCommittedTime,
          lastFailureMessage: loadedLastFailureMessage,
          saveProof: loadedSaveProof,
        } = await deps.loadPersistedPayload();
        const canonicalSaveProof: SaveProofState = loadedSaveProof ?? {
          ...startupSaveProof,
          latestDurableLocalWriteAt: localCacheUpdatedAt,
          latestCloudConfirmedCommitAt: cloudUpdatedAt ?? localCacheLastCloudConfirmedAt,
          latestConfirmedBatchId: loadedLastCommittedBatchId,
          latestReceiptStatus: loadedLastReceiptStatus,
          latestFailedBatchId: loadedLastFailedBatchId,
          latestFailureMessage: loadedLastFailureMessage,
          cloudProofState: mode === 'browser'
            ? 'local-only'
            : cacheStatus === 'confirmed'
              ? 'confirmed'
              : loadedLastFailedBatchId || loadedLastFailureMessage
                ? 'degraded'
                : 'pending',
        };
        const syncMeta = deriveSyncMetaFromLoadResult({
          mode,
          source,
          cacheStatus,
          loadedFromFallback,
          cloudReadFailed,
          localNewerThanCloud,
          cloudUpdatedAt,
          localCacheUpdatedAt,
          localCacheLastCloudConfirmedAt,
          loadFailureStage,
          loadFailureMessage,
          loadFailureRecoveredWithLocalCache,
          backendFailureKind,
          saveProof: canonicalSaveProof,
        });
        const fallbackFailure = loadedFromFallback
          ? describeLoadFallbackFailure(loadFailureStage, loadFailureMessage, backendFailureKind)
          : undefined;
        unresolvedOutbox = await deps.listUnresolvedOutboxEntries(await deps.loadOutboxState());
        if (unresolvedOutbox.length > 0) incrementMetric('outboxRestoresOnStartup', unresolvedOutbox.length);
        const baseItems = normalizeItems(payload.items ?? []);
        const contacts = (payload.contacts ?? []).map(normalizeContact);
        const companies = (payload.companies ?? []).map(normalizeCompany);
        const persistedProjects = (payload.projects ?? []).map((project) => normalizeProjectRecord(project));
        const preProjects = deriveProjects(baseItems, persistedProjects, payload.tasks ?? []);
        const projects = preProjects;
        const migratedBaseItems = baseItems.map((item) => enforceFollowUpIntegrity(repairLegacyFollowUpForHydration(item, projects), projects));
        const items = attachProjects(applyTaskRollupsToItems(migratedBaseItems, payload.tasks ?? []), projects);
        const tasks = normalizeTasks((payload.tasks ?? []).map((task) => {
          const projectName = resolveProjectName(task.projectId, task.project, projects);
          const linkedProject = projects.find((project) => projectCanonicalKey(project.name) === projectCanonicalKey(projectName));
          return enforceTaskIntegrity(
            repairLegacyTaskForHydration({ ...task, project: linkedProject?.name ?? projectName, projectId: linkedProject?.id ?? task.projectId }, projects),
            projects,
          );
        }));
        const trustedLiveItemCount = items.filter((item) => isTrustedLiveRecord(item)).length;
        const trustedLiveTaskCount = tasks.filter((task) => isTrustedLiveRecord(task)).length;
        const reviewItemCount = items.filter((item) => isReviewRecord(item)).length;
        const reviewTaskCount = tasks.filter((task) => isReviewRecord(task)).length;
        const dismissedDuplicatePairs = payload.auxiliary.dismissedDuplicatePairs ?? [];
        const savedReportDefinitions = sanitizeSavedReportDefinitions(payload.auxiliary.savedReportDefinitions);
        const hydratedActiveReportId = payload.auxiliary.activeReportDefinitionId
          && savedReportDefinitions.some((entry) => entry.id === payload.auxiliary.activeReportDefinitionId)
          ? payload.auxiliary.activeReportDefinitionId
          : savedReportDefinitions[0]?.id ?? null;
        const hydratedLastOpenedReportId = payload.auxiliary.lastOpenedReportDefinitionId
          && savedReportDefinitions.some((entry) => entry.id === payload.auxiliary.lastOpenedReportDefinitionId)
          ? payload.auxiliary.lastOpenedReportDefinitionId
          : hydratedActiveReportId;
        const hydratedActiveReport = savedReportDefinitions.find((entry) => entry.id === hydratedActiveReportId);
        const reportRuns = sanitizeReportRuns(payload.auxiliary.reportRuns, {
          validDefinitionIds: new Set(savedReportDefinitions.map((entry) => entry.id)),
        });
        set({
          items,
          contacts,
          companies,
          projects,
          tasks,
          intakeSignals: payload.auxiliary.intakeSignals ?? [],
          intakeDocuments: (payload.auxiliary.intakeDocuments ?? []).map((doc) => ({ ...doc, project: resolveProjectName(doc.projectId, doc.project, projects) })),
          dismissedDuplicatePairs,
          duplicateReviews: refreshDuplicates(items, dismissedDuplicatePairs),
          selectedId: items[0]?.id ?? null,
          selectedTaskId: tasks[0]?.id ?? null,
          hydrated: true,
          persistenceMode: mode,
          droppedEmailImports: payload.auxiliary.droppedEmailImports ?? [],
          forwardedEmails: payload.auxiliary.forwardedEmails ?? [],
          forwardedRules: payload.auxiliary.forwardedRules?.length ? payload.auxiliary.forwardedRules : getDefaultForwardedRules(),
          forwardedCandidates: payload.auxiliary.forwardedCandidates ?? [],
          forwardedLedger: payload.auxiliary.forwardedLedger ?? [],
          forwardedRoutingAudit: payload.auxiliary.forwardedRoutingAudit ?? [],
          intakeCandidates: payload.auxiliary.intakeCandidates ?? [],
          intakeAssets: payload.auxiliary.intakeAssets ?? [],
          intakeBatches: payload.auxiliary.intakeBatches ?? [],
          intakeWorkCandidates: payload.auxiliary.intakeWorkCandidates ?? [],
          intakeReviewerFeedback: payload.auxiliary.intakeReviewerFeedback ?? [],
          savedExecutionViews: payload.auxiliary.savedExecutionViews?.length ? payload.auxiliary.savedExecutionViews : defaultExecutionViews,
          savedReportDefinitions,
          activeReportDefinitionId: hydratedActiveReportId,
          lastOpenedReportDefinitionId: hydratedLastOpenedReportId,
          reportDraft: sanitizeReportDraftState(hydratedActiveReport ? toReportDraftState(hydratedActiveReport) : defaultReportDraftState),
          reportRuns,
          followUpFilters: payload.auxiliary.followUpFilters ?? defaultFollowUpFilters,
          taskWorkspaceSession: {
            ...defaultTaskWorkspaceSession,
            ...(payload.auxiliary.taskWorkspaceSession ?? {}),
          },
          directoryWorkspaceSession: {
            ...defaultDirectoryWorkspaceSession,
            ...(payload.auxiliary.directoryWorkspaceSession ?? {}),
            selectedByType: {
              ...defaultDirectoryWorkspaceSession.selectedByType,
              ...(payload.auxiliary.directoryWorkspaceSession?.selectedByType ?? {}),
            },
          },
          followUpColumns: payload.auxiliary.followUpColumns?.length ? payload.auxiliary.followUpColumns : (['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'linkedTaskSummary'] as FollowUpColumnKey[]),
          savedFollowUpViews: payload.auxiliary.savedFollowUpViews ?? [],
          followUpTableDensity: payload.auxiliary.followUpTableDensity ?? 'compact',
          followUpDuplicateModule: payload.auxiliary.followUpDuplicateModule ?? 'auto',
          reminderPreferences: {
            ...DEFAULT_REMINDER_PREFERENCES,
            ...(payload.auxiliary.reminderPreferences ?? {}),
          },
          reminderLedger: payload.auxiliary.reminderLedger ?? [],
          reminderCenterSummary: {
            ...DEFAULT_REMINDER_CENTER_SUMMARY,
            ...(payload.auxiliary.reminderCenterSummary ?? {}),
          },
          workspaceAttentionCounts: {
            ...DEFAULT_WORKSPACE_ATTENTION_COUNTS,
            ...(payload.auxiliary.workspaceAttentionCounts ?? {}),
          },
          pendingReminders: [],
          reminderPermissionState: payload.auxiliary.reminderCenterSummary?.permissionState ?? 'default',
          connectivityState: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
          offlineLoadState: source === 'local-cache' && loadedFromFallback ? 'loaded-from-offline-cache' : 'none',
          pendingOfflineChangeCount: unresolvedOutbox.length,
          localRevision: localRevision ?? 0,
          lastLocalSavedAt: localCacheUpdatedAt,
          lastCloudConfirmedRevision: lastCloudConfirmedRevision ?? 0,
          activeSyncBatchId: undefined,
          pendingBatchCount: unresolvedOutbox.length,
          localSaveState: 'saved',
          cloudSyncState: unresolvedOutbox.length ? ((typeof navigator !== 'undefined' && navigator.onLine) ? 'queued' : 'offline-pending') : 'confirmed',
          trustState: syncMeta.sessionDegraded ? 'degraded' : 'healthy',
          lastConnectivityChangeAt: undefined,
          lastReconnectAttemptAt: undefined,
          saveError: '',
          syncState: syncMeta.syncState,
          cloudSyncStatus: syncMeta.cloudSyncStatus,
          loadedFromLocalRecoveryCache: syncMeta.loadedFromLocalRecoveryCache,
          unsavedChangeCount: 0,
          hasLocalUnsavedChanges: false,
          dirtyRecordRefs: [],
          recordSaveLedger: {},
          lastCloudConfirmedAt: syncMeta.lastCloudConfirmedAt,
          lastLocalWriteAt: syncMeta.lastLocalWriteAt,
          lastFallbackRestoreAt: syncMeta.lastFallbackRestoreAt,
          lastSyncedAt: syncMeta.lastSyncedAt,
          lastFailedSyncAt: undefined,
          lastLoadFailureStage: syncMeta.lastLoadFailureStage,
          lastLoadFailureMessage: syncMeta.lastLoadFailureMessage,
          lastLoadRecoveredWithLocalCache: syncMeta.lastLoadRecoveredWithLocalCache,
          sessionTrustState: syncMeta.sessionTrustState,
          sessionDegraded: syncMeta.sessionDegraded,
          sessionDegradedReason: syncMeta.sessionDegradedReason,
          sessionDegradedAt: syncMeta.sessionDegradedAt,
          sessionDegradedClearedByCloudSave: syncMeta.sessionDegradedClearedByCloudSave,
          sessionTrustRecoveredAt: syncMeta.sessionTrustRecoveredAt,
          lastSuccessfulPersistAt: syncMeta.lastSuccessfulPersistAt,
          lastSuccessfulCloudPersistAt: syncMeta.lastSuccessfulCloudPersistAt,
          lastConfirmedBatchId: canonicalSaveProof.latestConfirmedBatchId,
          lastConfirmedBatchCommittedAt: canonicalSaveProof.latestCloudConfirmedCommitAt,
          lastReceiptStatus: canonicalSaveProof.latestReceiptStatus,
          lastReceiptHashMatch: canonicalSaveProof.latestReceiptHashMatch,
          lastReceiptSchemaVersion: canonicalSaveProof.latestReceiptSchemaVersion,
          lastReceiptTouchedTables: canonicalSaveProof.latestReceiptTouchedTables,
          lastReceiptOperationCount: canonicalSaveProof.latestReceiptOperationCount,
          lastReceiptOperationCountsByEntity: canonicalSaveProof.latestReceiptOperationCountsByEntity,
          lastReceiptCommittedAt: canonicalSaveProof.latestCloudConfirmedCommitAt ?? loadedLastReceiptCommittedTime,
          lastFailureMessage: canonicalSaveProof.latestFailureMessage,
          lastFailureClass: canonicalSaveProof.latestFailureClass,
          saveProof: canonicalSaveProof,
          unresolvedConflictCount: unresolvedOutbox.filter((e) => e.status === 'conflict').length,
          lastFailedBatchId: canonicalSaveProof.latestFailedBatchId,
          verificationState: 'idle',
          lastVerificationRunId: undefined,
          lastVerificationStartedAt: undefined,
          lastVerificationCompletedAt: undefined,
          lastVerificationMatched: undefined,
          lastVerificationMismatchCount: undefined,
          lastVerificationBasedOnBatchId: undefined,
          lastVerificationFailureMessage: undefined,
          recoveryReviewNeeded: false,
          reviewedMismatchIds: [],
          verificationSummary: undefined,
          latestVerificationResult: undefined,
          outboxState: unresolvedOutbox.length ? 'queued' : 'idle',
          unresolvedOutboxCount: unresolvedOutbox.length,
          lastOutboxFlushAt: undefined,
          lastOutboxFailureAt: undefined,
          conflictReviewNeeded: false,
          openConflictCount: 0,
          lastConflictDetectedAt: undefined,
          lastConflictBatchId: undefined,
          conflictQueueSummary: undefined,
          lastConflictFailureMessage: undefined,
          conflictQueue: [],
          persistenceActivity: [
            createPersistenceActivityEvent({
              kind: 'saved',
              summary: fallbackFailure
                ? fallbackFailure.summary
                : localNewerThanCloud && loadedFromFallback
                  ? 'Opened using protected local data.'
                  : syncMeta.cloudSyncStatus === 'cloud-save-failed-local-preserved'
                    ? 'Opened with protected local save proof.'
                    : syncMeta.cloudSyncStatus === 'payload-invalid'
                      ? 'Opened with cloud-save protection enabled.'
                  : mode === 'browser'
                    ? 'Opened using local device data.'
                    : 'Workspace opened.',
              detail: fallbackFailure
                ? fallbackFailure.detail
                : localNewerThanCloud && loadedFromFallback
                  ? 'SetPoint restored the newer local copy to avoid data loss.'
                  : syncMeta.cloudSyncStatus === 'cloud-save-failed-local-preserved'
                    ? 'The previous cloud save failed, but your local protected copy and save receipt details were restored.'
                    : syncMeta.cloudSyncStatus === 'payload-invalid'
                      ? 'The last known save proof indicates payload validation blocked cloud confirmation. Local proof details were restored exactly.'
                  : mode === 'browser'
                    ? 'Your latest updates are saved on this device.'
                    : mode === 'supabase'
                      ? 'Your latest updates are saved.'
                      : 'Your latest updates are saved on this device.',
            }),
            ...(reviewItemCount + reviewTaskCount > 0
              ? [createPersistenceActivityEvent({
                kind: 'queued',
                summary: 'Legacy cleanup review queue updated.',
                detail: `${reviewItemCount + reviewTaskCount} record${reviewItemCount + reviewTaskCount === 1 ? '' : 's'} require review before trusted live execution (${trustedLiveItemCount + trustedLiveTaskCount} trusted live).`,
              })]
              : []),
          ],
          outlookConnection: { ...defaultOutlookConnection, ...(payload.auxiliary.outlookConnection ?? {}), settings: { ...defaultOutlookConnection.settings, ...(payload.auxiliary.outlookConnection?.settings ?? {}) }, syncCursorByFolder: { inbox: payload.auxiliary.outlookConnection?.syncCursorByFolder?.inbox ?? {}, sentitems: payload.auxiliary.outlookConnection?.syncCursorByFolder?.sentitems ?? {} } },
          outlookMessages: payload.auxiliary.outlookMessages ?? [],
        });
      } catch (error) {
        const loadError = error as Partial<PersistenceLoadError>;
        const normalized = loadError?.normalized
          ?? normalizePersistenceError(error, {
            stage: typeof loadError?.stage === 'string' ? loadError.stage : 'unknown',
            operation: 'load',
          });
        const detail = formatPersistenceErrorMessage(normalized);
        const stage = typeof loadError?.stage === 'string' ? loadError.stage : normalized.stage;
        const failureAt = todayIso();
        set({
          hydrated: true,
          persistenceMode: 'browser',
          saveError: detail,
          syncState: 'error',
          cloudSyncStatus: 'load-failed-no-local-copy',
          localRevision: 0,
          lastLocalSavedAt: undefined,
          lastCloudConfirmedRevision: 0,
          activeSyncBatchId: undefined,
          pendingBatchCount: 0,
          localSaveState: 'error',
          cloudSyncState: 'failed',
          trustState: 'degraded',
          loadedFromLocalRecoveryCache: false,
          unsavedChangeCount: 0,
          hasLocalUnsavedChanges: false,
          dirtyRecordRefs: [],
          recordSaveLedger: {},
          lastCloudConfirmedAt: undefined,
          lastLocalWriteAt: undefined,
          lastFallbackRestoreAt: undefined,
          lastFailedSyncAt: failureAt,
          lastLoadFailureStage: stage,
          lastLoadFailureMessage: detail,
          lastLoadRecoveredWithLocalCache: Boolean(loadError?.recoveredWithLocalCache),
          sessionTrustState: 'degraded',
          sessionDegraded: true,
          sessionDegradedReason: 'load-failed-no-local-copy',
          sessionDegradedAt: failureAt,
          sessionDegradedClearedByCloudSave: false,
          sessionTrustRecoveredAt: undefined,
          lastSuccessfulPersistAt: undefined,
          lastSuccessfulCloudPersistAt: undefined,
          lastConfirmedBatchId: startupSaveProof.latestConfirmedBatchId,
          lastConfirmedBatchCommittedAt: undefined,
          lastReceiptStatus: startupSaveProof.latestReceiptStatus,
          lastReceiptHashMatch: undefined,
          lastReceiptSchemaVersion: undefined,
          lastReceiptTouchedTables: undefined,
          lastReceiptOperationCount: undefined,
          lastReceiptOperationCountsByEntity: undefined,
          lastReceiptCommittedAt: undefined,
          lastFailureMessage: startupSaveProof.latestFailureMessage,
          unresolvedConflictCount: unresolvedOutbox.filter((e) => e.status === 'conflict').length,
          lastFailedBatchId: startupSaveProof.latestFailedBatchId,
          verificationState: 'idle',
          lastVerificationRunId: undefined,
          lastVerificationStartedAt: undefined,
          lastVerificationCompletedAt: undefined,
          lastVerificationMatched: undefined,
          lastVerificationMismatchCount: undefined,
          lastVerificationBasedOnBatchId: undefined,
          lastVerificationFailureMessage: undefined,
          recoveryReviewNeeded: false,
          reviewedMismatchIds: [],
          verificationSummary: undefined,
          latestVerificationResult: undefined,
          outboxState: 'idle',
          unresolvedOutboxCount: 0,
          lastOutboxFlushAt: undefined,
          lastOutboxFailureAt: undefined,
          conflictReviewNeeded: false,
          openConflictCount: 0,
          lastConflictDetectedAt: undefined,
          lastConflictBatchId: undefined,
          conflictQueueSummary: undefined,
          lastConflictFailureMessage: undefined,
          conflictQueue: [],
          persistenceActivity: [createPersistenceActivityEvent({
            kind: 'failed',
            at: failureAt,
            summary: 'Could not confirm saved data during startup.',
            detail,
          })],
          connectivityState: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
          offlineLoadState: 'offline-no-cache',
          pendingOfflineChangeCount: 0,
          lastConnectivityChangeAt: undefined,
          lastReconnectAttemptAt: undefined,
        });
      }
    },
  };
}
