import { loadPersistedPayload } from '../../lib/persistence';
import { defaultExecutionViews } from '../../lib/unifiedQueue';
import { getDefaultForwardedRules } from '../../lib/intakeRules';
import { defaultFollowUpFilters } from '../../lib/followUpSelectors';
import { resolveProjectName, todayIso } from '../../lib/utils';
import { normalizeContact, normalizeCompany } from '../../domains/relationships/helpers';
import { deriveProjects, projectCanonicalKey } from '../../domains/projects/helpers';
import { normalizeItems, attachProjects } from '../../domains/followups/helpers';
import { applyTaskRollupsToItems, normalizeTasks } from '../../domains/tasks/helpers';
import type { FollowUpColumnKey } from '../../types';
import type { AppStoreActions } from '../types';
import type { SliceSet } from './types';
import { refreshDuplicates } from '../useCases/mutationEffects';
import { createPersistenceActivityEvent } from '../persistenceActivity';
import type { CloudSyncStatus } from '../state/types';
import type { LoadResult } from '../../lib/persistence';

interface DerivedSyncMeta {
  syncState: 'saved';
  cloudSyncStatus: CloudSyncStatus;
  loadedFromLocalRecoveryCache: boolean;
  lastCloudConfirmedAt?: string;
  lastLocalWriteAt?: string;
  lastFallbackRestoreAt?: string;
  lastSyncedAt?: string;
}

export function deriveSyncMetaFromLoadResult(load: Pick<LoadResult, 'mode' | 'source' | 'cacheStatus' | 'loadedFromFallback' | 'cloudReadFailed' | 'localNewerThanCloud' | 'cloudUpdatedAt' | 'localCacheUpdatedAt' | 'localCacheLastCloudConfirmedAt'>): DerivedSyncMeta {
  const usingRecoveryCache = Boolean(load.cloudReadFailed || load.localNewerThanCloud || load.loadedFromFallback);
  const cloudStatus: CloudSyncStatus = load.cloudReadFailed
    ? 'cloud-read-failed-local-fallback'
    : load.localNewerThanCloud
      ? 'local-newer-than-cloud'
      : load.mode === 'browser'
        ? 'local-only-confirmed'
        : load.cacheStatus === 'pending'
          ? 'pending-cloud'
          : load.source === 'local-cache' && load.loadedFromFallback
            ? 'local-recovery'
            : 'cloud-confirmed';
  const lastCloudConfirmedAt = load.mode === 'supabase'
    ? load.cloudUpdatedAt ?? load.localCacheLastCloudConfirmedAt
    : undefined;

  return {
    syncState: 'saved',
    cloudSyncStatus: cloudStatus,
    loadedFromLocalRecoveryCache: usingRecoveryCache,
    lastCloudConfirmedAt,
    lastLocalWriteAt: load.localCacheUpdatedAt,
    lastFallbackRestoreAt: usingRecoveryCache ? todayIso() : undefined,
    lastSyncedAt: lastCloudConfirmedAt,
  };
}

export function createMetaSlice(set: SliceSet, defaultOutlookConnection: any): Pick<AppStoreActions, 'initializeApp'> {
  return {
    initializeApp: async () => {
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
        } = await loadPersistedPayload();
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
        });
        const baseItems = normalizeItems(payload.items ?? []);
        const contacts = (payload.contacts ?? []).map(normalizeContact);
        const companies = (payload.companies ?? []).map(normalizeCompany);
        const preProjects = deriveProjects(baseItems, payload.projects ?? [], payload.tasks ?? []);
        const projects = preProjects;
        const items = attachProjects(applyTaskRollupsToItems(baseItems, payload.tasks ?? []), projects);
        const tasks = normalizeTasks((payload.tasks ?? []).map((task) => {
          const projectName = resolveProjectName(task.projectId, task.project, projects);
          const linkedProject = projects.find((project) => projectCanonicalKey(project.name) === projectCanonicalKey(projectName));
          return { ...task, project: linkedProject?.name ?? projectName, projectId: linkedProject?.id ?? task.projectId };
        }));
        const dismissedDuplicatePairs = payload.auxiliary.dismissedDuplicatePairs ?? [];
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
          followUpFilters: payload.auxiliary.followUpFilters ?? defaultFollowUpFilters,
          followUpColumns: payload.auxiliary.followUpColumns?.length ? payload.auxiliary.followUpColumns : (['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'project', 'assignee', 'nextAction'] as FollowUpColumnKey[]),
          savedFollowUpViews: payload.auxiliary.savedFollowUpViews ?? [],
          saveError: '',
          syncState: syncMeta.syncState,
          cloudSyncStatus: syncMeta.cloudSyncStatus,
          loadedFromLocalRecoveryCache: syncMeta.loadedFromLocalRecoveryCache,
          unsavedChangeCount: 0,
          hasLocalUnsavedChanges: false,
          dirtyRecordRefs: [],
          lastCloudConfirmedAt: syncMeta.lastCloudConfirmedAt,
          lastLocalWriteAt: syncMeta.lastLocalWriteAt,
          lastFallbackRestoreAt: syncMeta.lastFallbackRestoreAt,
          lastSyncedAt: syncMeta.lastSyncedAt,
          lastFailedSyncAt: undefined,
          persistenceActivity: [createPersistenceActivityEvent({
            kind: 'saved',
            summary: cloudReadFailed
              ? 'Cloud read failed; local copy preserved'
              : localNewerThanCloud
                ? 'Loaded from local recovery cache.'
                : mode === 'browser'
                  ? 'Workspace loaded from this device.'
                  : 'Workspace loaded from persisted data.',
            detail: cloudReadFailed
              ? 'Cloud read failed; local cache preserved your latest data.'
              : localNewerThanCloud
                ? 'Local cache is newer than cloud data and was restored.'
                : mode === 'browser'
                  ? 'Running in browser/local-only mode.'
                : mode === 'supabase'
                  ? 'Cloud-backed persistence mode active.'
                  : 'Running in local/browser persistence mode.',
          })],
          outlookConnection: { ...defaultOutlookConnection, ...(payload.auxiliary.outlookConnection ?? {}), settings: { ...defaultOutlookConnection.settings, ...(payload.auxiliary.outlookConnection?.settings ?? {}) }, syncCursorByFolder: { inbox: payload.auxiliary.outlookConnection?.syncCursorByFolder?.inbox ?? {}, sentitems: payload.auxiliary.outlookConnection?.syncCursorByFolder?.sentitems ?? {} } },
          outlookMessages: payload.auxiliary.outlookMessages ?? [],
        });
      } catch (error) {
        const failureAt = todayIso();
        set({
          hydrated: true,
          persistenceMode: 'browser',
          saveError: error instanceof Error ? error.message : 'Failed to load saved data.',
          syncState: 'error',
          cloudSyncStatus: 'cloud-read-failed-local-fallback',
          loadedFromLocalRecoveryCache: false,
          unsavedChangeCount: 0,
          hasLocalUnsavedChanges: false,
          dirtyRecordRefs: [],
          lastCloudConfirmedAt: undefined,
          lastLocalWriteAt: undefined,
          lastFallbackRestoreAt: undefined,
          lastFailedSyncAt: failureAt,
          persistenceActivity: [createPersistenceActivityEvent({
            kind: 'failed',
            at: failureAt,
            summary: 'Failed to load persisted workspace.',
            detail: error instanceof Error ? error.message : 'Failed to load saved data.',
          })],
        });
      }
    },
  };
}
