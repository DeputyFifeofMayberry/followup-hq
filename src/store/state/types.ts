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
}

export interface AppMetaState {
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  saveError: string;
  syncState: 'idle' | 'checking' | 'saving' | 'saved' | 'error';
  lastSyncedAt?: string;
}
