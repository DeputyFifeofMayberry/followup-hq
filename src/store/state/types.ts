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
  ReminderCandidate,
  ReminderCenterSummary,
  ReminderLedgerEntry,
  ReminderPermissionState,
  ReminderPreferences,
  ReportDraftState,
  SavedReportDefinition,
  ReportRunRecord,
  SavedExecutionView,
  SavedFollowUpCustomView,
  FollowUpAdvancedFilters,
  FollowUpColumnKey,
  FollowUpTableDensity,
  FollowUpDuplicateModuleMode,
  SavedViewKey,
  TaskItem,
  TaskWorkspaceSession,
  DirectoryWorkspaceSession,
  UnifiedQueueDensity,
  UnifiedQueueFilter,
  UnifiedQueuePreset,
  UnifiedQueueSort,
  WorkspaceAttentionCounts,
  ExecutionIntent,
} from '../../types';
import type { UniversalCaptureDraft } from '../../lib/universalCapture';
import type { RecordRef } from '../../lib/recordContext';
import type { DirtyRecordRef } from '../persistenceQueue';
import type { SaveBatchEntityCounts } from '../../lib/persistenceTypes';
import type { SaveBatchStatus } from '../../lib/persistenceTypes';
import type {
  VerificationMismatch,
  VerificationResult,
  VerificationSummary,
} from '../../lib/persistenceVerification';
import type { ExecutionLaneSessionState, ExecutionRouteHandoff } from '../../domains/shared/execution';
import type { SupportWorkspaceSessionState } from '../../domains/support';
import type { OutboxStatus } from '../../lib/persistenceOutbox';
import type { UndoEntry } from '../../lib/undo';

export type PersistenceActivityKind =
  | 'queued'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'manual-save'
  | 'retry'
  | 'payload-blocked'
  | 'backend-blocked'
  | 'local-recovery';

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

export interface FollowUpInspectorState {
  open: boolean;
  itemId: string | null;
}

export type AppToastTone = 'success' | 'info' | 'warning' | 'error';
export type AppToastKind = 'action_result' | 'bulk_result' | 'undo_offer' | 'system_notice';

export interface AppToastAction {
  label: string;
  actionId?: string;
  callbackKey?: string;
  destructive?: boolean;
}

export interface AppToast {
  id: string;
  kind: AppToastKind;
  tone: AppToastTone;
  title: string;
  message?: string;
  createdAt: string;
  expiresAt?: string;
  durationMs?: number;
  action?: AppToastAction;
  dismissible?: boolean;
  source?: string;
  recordType?: 'followup' | 'task' | 'project' | 'contact' | 'company';
  recordIds?: string[];
  operationSummary?: {
    affected?: number;
    skipped?: number;
    warnings?: string[];
  };
}

export interface AppToastRuntimeConfig {
  maxVisible: number;
  pauseOnHover: boolean;
  defaultDurationMs: Record<AppToastTone, number>;
}

export type ActiveRecordSurface = 'none' | 'execution_inspector' | 'context_drawer' | 'full_editor' | 'transition_flow';

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
  followUpInspector: FollowUpInspectorState;
  createWorkDraft: UniversalCaptureDraft | null;
  selectedTaskId: string | null;
  taskWorkspaceSession: TaskWorkspaceSession;
  directoryWorkspaceSession: DirectoryWorkspaceSession;
  queuePreset: UnifiedQueuePreset;
  executionFilter: UnifiedQueueFilter;
  executionSort: UnifiedQueueSort;
  queueDensity: UnifiedQueueDensity;
  savedExecutionViews: SavedExecutionView[];
  savedReportDefinitions: SavedReportDefinition[];
  activeReportDefinitionId: string | null;
  lastOpenedReportDefinitionId: string | null;
  reportDraft: ReportDraftState;
  reportRuns: ReportRunRecord[];
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
  toasts: AppToast[];
  toastConfig: AppToastRuntimeConfig;
  undoStack: UndoEntry[];
  lastUndoCleanupAt?: string;
}


export type LocalSaveState = 'idle' | 'saving' | 'saved' | 'error';
export type CloudSyncLifecycleState = 'idle' | 'queued' | 'sending' | 'confirmed' | 'failed' | 'conflict' | 'offline-pending';
export type PersistenceTrustState = 'healthy' | 'local-only' | 'degraded' | 'recovered';

export type CloudSyncStatus =
  | 'unknown'
  | 'cloud-confirmed'
  | 'pending-cloud'
  | 'local-only-confirmed'
  | 'local-recovery'
  | 'local-newer-than-cloud'
  | 'cloud-read-failed-local-fallback'
  | 'cloud-save-failed-local-preserved'
  | 'load-failed-no-local-copy'
  | 'payload-invalid';

export type SessionTrustState = 'healthy' | 'degraded' | 'recovered';

export type SessionDegradedReason =
  | 'none'
  | 'cloud-save-failed'
  | 'backend-schema-mismatch'
  | 'backend-rpc-missing'
  | 'backend-missing-hashing-support'
  | 'cloud-read-failed-fallback'
  | 'local-newer-than-cloud'
  | 'local-recovery-fallback'
  | 'load-failed-no-local-copy'
  | 'payload-invalid';

export type VerificationLifecycleState = 'idle' | 'pending' | 'running' | 'verified-match' | 'mismatch-found' | 'read-failed' | 'failed';
export type OutboxLifecycleState = 'idle' | 'queued' | 'flushing' | 'failed' | 'conflict';
export type OperationCountsByEntity = SaveBatchEntityCounts;
export type ReceiptStatus = SaveBatchStatus;
export type SaveProofCloudState = 'confirmed' | 'pending' | 'degraded' | 'local-only';
export interface RecordSaveLedgerEntry {
  type: DirtyRecordRef['type'];
  id: string;
  lastQueuedAt?: string;
  lastQueuedRevision?: number;
  lastLocalSavedAt?: string;
  lastLocalSavedRevision?: number;
  lastCloudConfirmedAt?: string;
  lastCloudConfirmedRevision?: number;
  lastCloudConfirmedBatchId?: string;
  lastVerifiedAt?: string;
  lastVerifiedRevision?: number;
  lastVerifiedBatchId?: string;
  lastAttentionAt?: string;
  lastAttentionReason?: string;
}
export interface SaveProofState {
  latestVerifiedAt?: string;
  latestVerifiedBatchId?: string;
  latestVerifiedRevision?: number;
  latestLocalSaveAttemptAt?: string;
  latestDurableLocalWriteAt?: string;
  latestCloudConfirmedCommitAt?: string;
  latestConfirmedBatchId?: string;
  latestReceiptStatus?: ReceiptStatus;
  latestReceiptHashMatch?: boolean;
  latestReceiptSchemaVersion?: number;
  latestReceiptTouchedTables?: string[];
  latestReceiptOperationCount?: number;
  latestReceiptOperationCountsByEntity?: OperationCountsByEntity;
  latestFailedBatchId?: string;
  latestFailureMessage?: string;
  latestFailureClass?: 'payload-invalid' | 'backend-setup' | 'network-transient' | 'rpc-receipt' | 'conflict-revision' | 'cloud-read-fallback' | 'unknown';
  cloudProofState: SaveProofCloudState;
}
export type VerificationState = VerificationLifecycleState;
export type OutboxState = OutboxLifecycleState;
export type ConflictQueueItem = PersistenceConflictItem;
export interface ConflictQueueSummary {
  byEntity: Record<string, number>;
  byType: Record<string, number>;
}
export type VerificationMismatchItem = VerificationMismatch;
export type { VerificationMismatch, VerificationResult, VerificationSummary };

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
  localRevision: number;
  lastLocalSavedAt?: string;
  lastCloudConfirmedRevision: number;
  activeSyncBatchId?: string;
  pendingBatchCount: number;
  localSaveState: LocalSaveState;
  cloudSyncState: CloudSyncLifecycleState;
  trustState: PersistenceTrustState;
  loadedFromLocalRecoveryCache: boolean;
  unsavedChangeCount: number;
  hasLocalUnsavedChanges: boolean;
  dirtyRecordRefs: DirtyRecordRef[];
  recordSaveLedger: Record<string, RecordSaveLedgerEntry>;
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
  lastReceiptStatus?: ReceiptStatus;
  lastReceiptHashMatch?: boolean;
  lastReceiptSchemaVersion?: number;
  lastReceiptTouchedTables?: string[];
  lastReceiptOperationCount?: number;
  lastReceiptOperationCountsByEntity?: OperationCountsByEntity;
  lastFailedBatchId?: string;
  lastReceiptCommittedAt?: string;
  lastFailureMessage?: string;
  lastFailureClass?: 'payload-invalid' | 'backend-setup' | 'network-transient' | 'rpc-receipt' | 'conflict-revision' | 'cloud-read-fallback' | 'unknown';
  saveProof: SaveProofState;
  lastFailureNonRetryable?: boolean;
  lastSanitizedFieldCount?: number;
  lastSanitizedEntityTypes?: string[];
  unresolvedConflictCount: number;

  verificationState: VerificationState;
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
  outboxState: OutboxState;
  unresolvedOutboxCount: number;
  lastOutboxFlushAt?: string;
  lastOutboxFailureAt?: string;
  conflictReviewNeeded: boolean;
  openConflictCount: number;
  lastConflictDetectedAt?: string;
  lastConflictBatchId?: string;
  conflictQueueSummary?: ConflictQueueSummary;
  lastConflictFailureMessage?: string;
  conflictQueue: ConflictQueueItem[];
  persistenceActivity: PersistenceActivityEvent[];
  reminderPreferences: ReminderPreferences;
  reminderLedger: ReminderLedgerEntry[];
  reminderCenterSummary: ReminderCenterSummary;
  workspaceAttentionCounts: WorkspaceAttentionCounts;
  pendingReminders: ReminderCandidate[];
  reminderPermissionState: ReminderPermissionState;
  connectivityState: 'online' | 'offline' | 'degraded';
  offlineLoadState: 'none' | 'loaded-from-offline-cache' | 'offline-no-cache';
  pendingOfflineChangeCount: number;
  lastConnectivityChangeAt?: string;
  lastReconnectAttemptAt?: string;
}
