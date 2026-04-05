import type {
  AppSnapshot,
  CompanyRecord,
  ContactRecord,
  DroppedEmailImport,
  DuplicateReview,
  FollowUpItem,
  FollowUpStatus,
  ForwardedEmailRecord,
  ForwardedEmailRule,
  ForwardedIngestionLedgerEntry,
  ForwardedIntakeCandidate,
  ForwardedRoutingAuditEntry,
  IntakeAssetRecord,
  IntakeBatchRecord,
  IntakeCandidate,
  IntakeDocumentRecord,
  IntakeReviewerFeedback,
  IntakeWorkCandidate,
  OutlookConnectionState,
  OutlookMessage,
  PersistenceMode,
  ProjectRecord,
  SavedExecutionView,
  SavedFollowUpCustomView,
  FollowUpAdvancedFilters,
  FollowUpColumnKey,
  FollowUpTableDensity,
  FollowUpDuplicateModuleMode,
  SavedViewKey,
  TaskItem,
  TaskStatus,
  UnifiedQueueDensity,
  UnifiedQueueFilter,
  UnifiedQueuePreset,
  UnifiedQueueSort,
  ExecutionIntent,
} from '../../types';
import type { UniversalCaptureDraft } from '../../lib/universalCapture';
import type { RecordRef } from '../../lib/recordContext';
import type { DirtyRecordRef } from '../persistenceQueue';
import type { ExecutionLaneSessionState, ExecutionRouteHandoff } from '../../domains/shared/execution';

export type PersistenceActivityKind =
  | 'queued'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'manual-save'
  | 'retry';

export interface PersistenceActivityEvent {
  id: string;
  at: string;
  kind: PersistenceActivityKind;
  summary: string;
  detail?: string;
}

export interface ItemModalState {
  open: boolean;
  mode: 'create' | 'edit';
  itemId: string | null;
}

export interface MergeModalState {
  open: boolean;
  baseId: string | null;
  candidateId: string | null;
}

export interface DraftModalState {
  open: boolean;
  itemId: string | null;
}

export interface TaskModalState {
  open: boolean;
  mode: 'create' | 'edit';
  taskId: string | null;
}

export interface AppBusinessState {
  items: FollowUpItem[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  tasks: TaskItem[];
  intakeSignals: AppSnapshot['intakeSignals'];
  intakeDocuments: IntakeDocumentRecord[];
  dismissedDuplicatePairs: string[];
  duplicateReviews: DuplicateReview[];
  outlookConnection: OutlookConnectionState;
  outlookMessages: OutlookMessage[];
  droppedEmailImports: DroppedEmailImport[];
  forwardedEmails: ForwardedEmailRecord[];
  forwardedRules: ForwardedEmailRule[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  forwardedLedger: ForwardedIngestionLedgerEntry[];
  forwardedRoutingAudit: ForwardedRoutingAuditEntry[];
  intakeCandidates: IntakeCandidate[];
  intakeAssets: IntakeAssetRecord[];
  intakeBatches: IntakeBatchRecord[];
  intakeWorkCandidates: IntakeWorkCandidate[];
  intakeReviewerFeedback: IntakeReviewerFeedback[];
}

export interface AppUiState {
  selectedId: string | null;
  search: string;
  projectFilter: string;
  statusFilter: 'All' | FollowUpStatus;
  activeView: SavedViewKey;
  followUpFilters: FollowUpAdvancedFilters;
  selectedFollowUpIds: string[];
  followUpColumns: FollowUpColumnKey[];
  savedFollowUpViews: SavedFollowUpCustomView[];
  followUpTableDensity: FollowUpTableDensity;
  followUpDuplicateModule: FollowUpDuplicateModuleMode;
  itemModal: ItemModalState;
  touchModalOpen: boolean;
  importModalOpen: boolean;
  mergeModal: MergeModalState;
  draftModal: DraftModalState;
  taskModal: TaskModalState;
  createWorkDraft: UniversalCaptureDraft | null;
  selectedTaskId: string | null;
  taskOwnerFilter: string;
  taskStatusFilter: 'All' | TaskStatus;
  queuePreset: UnifiedQueuePreset;
  executionFilter: UnifiedQueueFilter;
  executionSort: UnifiedQueueSort;
  queueDensity: UnifiedQueueDensity;
  savedExecutionViews: SavedExecutionView[];
  executionIntent: ExecutionIntent | null;
  executionSelectedId: string | null;
  recordDrawerRef: RecordRef | null;
  executionLaneSessions: Record<'followups' | 'tasks', ExecutionLaneSessionState>;
  lastExecutionRoute: ExecutionRouteHandoff | null;
}

export type CloudSyncStatus =
  | 'unknown'
  | 'cloud-confirmed'
  | 'pending-cloud'
  | 'local-only-confirmed'
  | 'local-recovery'
  | 'local-newer-than-cloud'
  | 'cloud-read-failed-local-fallback'
  | 'cloud-save-failed-local-preserved'
  | 'load-failed-no-local-copy';

export type SessionTrustState = 'healthy' | 'degraded' | 'recovered';

export type SessionDegradedReason =
  | 'none'
  | 'cloud-save-failed'
  | 'cloud-read-failed-fallback'
  | 'local-newer-than-cloud'
  | 'local-recovery-fallback'
  | 'load-failed-no-local-copy';

export interface AppMetaState {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  saveError: string;
  syncState: 'idle' | 'checking' | 'dirty' | 'saving' | 'saved' | 'error';
  cloudSyncStatus: CloudSyncStatus;
  loadedFromLocalRecoveryCache: boolean;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  dirtyRecordRefs: DirtyRecordRef[];
  lastCloudConfirmedAt?: string;
  lastLocalWriteAt?: string;
  lastFallbackRestoreAt?: string;
  lastSyncedAt?: string;
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
  persistenceActivity: PersistenceActivityEvent[];
}
