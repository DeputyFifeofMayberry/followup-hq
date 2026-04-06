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
import type { SaveBatchEntityCounts } from '../../lib/persistenceTypes';
import type { SaveBatchStatus } from '../../lib/persistenceTypes';
import type { VerificationResult, VerificationSummary } from '../../lib/persistenceVerification';
import type { ExecutionLaneSessionState, ExecutionRouteHandoff } from '../../domains/shared/execution';
import type { SupportWorkspaceSessionState } from '../../domains/support';
import type { OutboxStatus } from '../../lib/persistenceOutbox';

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

export type ActiveRecordSurface = 'none' | 'context_drawer' | 'full_editor' | 'transition_flow';

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
  activeRecordSurface: ActiveRecordSurface;
  activeRecordRef: RecordRef | null;
  activeEditorMode: 'create' | 'edit' | null;
  recordSurfaceSource: string | null;
  executionLaneSessions: Record<'followups' | 'tasks', ExecutionLaneSessionState>;
  lastExecutionRoute: ExecutionRouteHandoff | null;
  supportWorkspaceSession: Record<'projects' | 'relationships', SupportWorkspaceSessionState>;
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

export type VerificationLifecycleState = 'idle' | 'running' | 'verified-match' | 'mismatch-found' | 'failed';
export type OutboxLifecycleState = 'idle' | 'queued' | 'flushing' | 'failed' | 'conflict';

export interface PersistenceConflictItem {
  id: string;
  entity: string;
  recordId: string;
  conflictType: string;
  summary: string;
  technicalDetail?: string;
  localBatchId?: string;
  cloudBatchId?: string;
  localDeviceId?: string;
  cloudDeviceId?: string;
  localRecordVersion?: number;
  cloudRecordVersion?: number;
  localSnapshot?: unknown;
  cloudSnapshot?: unknown;
  localDeletedAt?: string | null;
  cloudDeletedAt?: string | null;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt?: string;
  fromOutboxStatus?: OutboxStatus;
}

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
  lastConfirmedBatchId?: string;
  lastConfirmedBatchCommittedAt?: string;
  lastReceiptStatus?: SaveBatchStatus;
  lastReceiptHashMatch?: boolean;
  lastReceiptSchemaVersion?: number;
  lastReceiptTouchedTables?: string[];
  lastReceiptOperationCount?: number;
  lastReceiptOperationCountsByEntity?: SaveBatchEntityCounts;
  lastFailedBatchId?: string;

  verificationState: VerificationLifecycleState;
  lastVerificationRunId?: string;
  lastVerificationStartedAt?: string;
  lastVerificationCompletedAt?: string;
  lastVerificationMatched?: boolean;
  lastVerificationMismatchCount?: number;
  lastVerificationBasedOnBatchId?: string;
  lastVerificationFailureMessage?: string;
  recoveryReviewNeeded: boolean;
  reviewedMismatchIds: string[];
  verificationSummary?: VerificationSummary;
  latestVerificationResult?: VerificationResult;
  outboxState: OutboxLifecycleState;
  unresolvedOutboxCount: number;
  lastOutboxFlushAt?: string;
  lastOutboxFailureAt?: string;
  conflictReviewNeeded: boolean;
  openConflictCount: number;
  lastConflictDetectedAt?: string;
  lastConflictBatchId?: string;
  conflictQueueSummary?: {
    byEntity: Record<string, number>;
    byType: Record<string, number>;
  };
  lastConflictFailureMessage?: string;
  conflictQueue: PersistenceConflictItem[];

    persistenceActivity: PersistenceActivityEvent[];
}
