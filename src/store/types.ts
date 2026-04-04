import type { AppBusinessState, AppMetaState, AppUiState } from './state/types';
import type { UniversalCaptureDraft } from '../lib/universalCapture';
import type {
  DroppedEmailImport,
  FollowUpAdvancedFilters,
  FollowUpColumnKey,
  FollowUpItem,
  FollowUpStatus,
  ForwardedEmailProviderPayload,
  ForwardedEmailRule,
  ImportPreviewRow,
  IntakeDocumentDisposition,
  IntakeDocumentKind,
  IntakeDocumentRecord,
  MergeDraft,
  CompanyRecord,
  ContactRecord,
  OutlookConnectionSettings,
  ProjectRecord,
  SavedViewKey,
  TaskItem,
  TaskStatus,
  UnifiedQueueItem,
  UnifiedQueueFilter,
  UnifiedQueuePreset,
  UnifiedQueueSort,
  UnifiedQueueDensity,
  ExecutionIntent,
  ExecutionSectionKey,
  ExecutionRouteTarget,
} from '../types';
import type { WorkflowValidationResult } from '../lib/workflowPolicy';

export interface WorkflowTransitionAttempt {
  applied: boolean;
  validation: WorkflowValidationResult;
}

export interface BatchWorkflowResult {
  affected: number;
  skipped: number;
  warnings: string[];
}

export interface AppStoreActions {
  initializeApp: () => Promise<void>;
  setSelectedId: (id: string) => void;
  setSearch: (value: string) => void;
  setProjectFilter: (value: string) => void;
  setStatusFilter: (value: 'All' | FollowUpStatus) => void;
  setActiveView: (value: SavedViewKey) => void;
  setFollowUpFilters: (value: Partial<FollowUpAdvancedFilters>) => void;
  resetFollowUpFilters: () => void;
  toggleFollowUpSelection: (id: string) => void;
  clearFollowUpSelection: () => void;
  selectAllVisibleFollowUps: (ids: string[]) => void;
  saveFollowUpCustomView: (name: string, search: string) => void;
  applySavedFollowUpCustomView: (id: string) => void;
  setFollowUpColumns: (columns: FollowUpColumnKey[]) => void;
  openCreateModal: () => void;
  openEditModal: (id: string) => void;
  closeItemModal: () => void;
  openTouchModal: () => void;
  closeTouchModal: () => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openMergeModal: (baseId: string, candidateId: string) => void;
  closeMergeModal: () => void;
  openDraftModal: (id: string) => void;
  closeDraftModal: () => void;
  setSelectedTaskId: (id: string | null) => void;
  setTaskOwnerFilter: (value: string) => void;
  setTaskStatusFilter: (value: 'All' | TaskStatus) => void;
  openCreateTaskModal: () => void;
  openCreateFromCapture: (draft: UniversalCaptureDraft) => void;
  openEditTaskModal: (id: string) => void;
  closeTaskModal: () => void;
  updateItem: (id: string, patch: Partial<FollowUpItem>) => void;
  addItem: (item: FollowUpItem) => void;
  deleteItem: (id: string) => void;
  addTouchLog: (payload: { id: string; summary: string; status?: FollowUpStatus; dueDate?: string; nextTouchDate?: string; promisedDate?: string; waitingOn?: string }) => void;
  addRunningNote: (id: string, note: string) => void;
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, patch: Partial<TaskItem>) => void;
  attemptFollowUpTransition: (id: string, status: FollowUpStatus, patch?: Partial<FollowUpItem>, options?: { override?: boolean }) => WorkflowTransitionAttempt;
  attemptTaskTransition: (id: string, status: TaskStatus, patch?: Partial<TaskItem>) => WorkflowTransitionAttempt;
  runValidatedBatchFollowUpTransition: (ids: string[], status: FollowUpStatus, patch?: Partial<FollowUpItem>, options?: { override?: boolean }) => BatchWorkflowResult;
  deleteTask: (id: string) => void;
  importItems: (rows: ImportPreviewRow[]) => void;
  addDroppedEmailImports: (imports: DroppedEmailImport[]) => void;
  removeDroppedEmailImport: (id: string) => void;
  clearDroppedEmailImports: () => void;
  convertDroppedEmailToItem: (id: string) => void;
  convertSignalToItem: (signalId: string) => void;
  dismissDuplicatePair: (leftId: string, rightId: string) => void;
  mergeItems: (baseId: string, candidateId: string, draft: MergeDraft) => void;
  markNudged: (id: string) => void;
  snoozeItem: (id: string, days: number) => void;
  cycleEscalation: (id: string) => void;
  batchUpdateFollowUps: (ids: string[], patch: Partial<FollowUpItem>, summary: string) => void;
  updateDraftForItem: (id: string, draft: string) => void;
  generateDraftForItem: (id: string) => void;
  addProject: (input: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateProject: (id: string, patch: Partial<ProjectRecord>) => void;
  reassignProjectRecords: (fromProjectId: string, toProjectId: string, recordTypes?: Array<'followups' | 'tasks' | 'docs'>) => void;
  deleteProject: (id: string, reassignToProjectId?: string) => void;
  addIntakeDocument: (input: { name: string; kind: IntakeDocumentKind; projectId?: string; project?: string; owner?: string; sourceRef?: string; notes?: string; tags?: string[] }) => string;
  updateIntakeDocument: (id: string, patch: Partial<IntakeDocumentRecord>) => void;
  setIntakeDocumentDisposition: (id: string, disposition: IntakeDocumentDisposition, linkedFollowUpId?: string) => void;
  deleteIntakeDocument: (id: string) => void;
  addContact: (input: Omit<ContactRecord, 'id'>) => string;
  updateContact: (id: string, patch: Partial<ContactRecord>) => void;
  reassignContactLinks: (fromId: string, toId: string) => void;
  mergeContacts: (baseId: string, duplicateId: string) => void;
  deleteContact: (id: string) => void;
  addCompany: (input: Omit<CompanyRecord, 'id'>) => string;
  updateCompany: (id: string, patch: Partial<CompanyRecord>) => void;
  reassignCompanyLinks: (fromId: string, toId: string) => void;
  mergeCompanies: (baseId: string, duplicateId: string) => void;
  deleteCompany: (id: string) => void;
  getUnifiedQueue: () => UnifiedQueueItem[];
  setQueuePreset: (preset: UnifiedQueuePreset) => void;
  setExecutionFilter: (filter: UnifiedQueueFilter) => void;
  setExecutionSort: (sort: UnifiedQueueSort) => void;
  setQueueDensity: (density: UnifiedQueueDensity) => void;
  saveExecutionView: (name: string, scope?: 'personal' | 'team') => void;
  applyExecutionView: (viewId: string) => void;
  setExecutionSelectedId: (id: string | null) => void;
  launchExecutionIntent: (intent: Omit<ExecutionIntent, 'createdAt'>) => void;
  clearExecutionIntent: () => void;
  openExecutionLane: (target: Exclude<ExecutionRouteTarget, 'overview'>, options?: { recordId?: string; recordType?: 'task' | 'followup'; section?: ExecutionSectionKey; project?: string }) => void;
  stageIntakeCandidate: (candidate: any) => void;
  approveIntakeCandidate: (candidateId: string, mode?: 'task' | 'followup') => void;
  discardIntakeCandidate: (candidateId: string) => void;
  saveIntakeCandidateAsReference: (candidateId: string) => void;
  ingestIntakeFiles: (files: File[], source?: 'drop' | 'file_picker') => Promise<void>;
  updateIntakeWorkCandidate: (candidateId: string, patch: any) => void;
  decideIntakeWorkCandidate: (candidateId: string, decision: 'approve_task' | 'approve_followup' | 'link' | 'reference' | 'reject', linkedRecordId?: string, options?: { overrideUnsafeCreate?: boolean }) => void;
  batchApproveHighConfidence: () => void;
  confirmFollowUpSent: (id: string, notes?: string) => void;
  updateOutlookSettings: (patch: Partial<OutlookConnectionSettings>) => void;
  startOutlookAuth: () => Promise<void>;
  completeOutlookAuth: (callbackUrl: string) => Promise<void>;
  syncOutlookMailbox: () => Promise<void>;
  importOutlookMessage: (messageId: string) => void;
  disconnectOutlook: () => void;
  clearOutlookError: () => void;
  ingestForwardedEmailPayload: (payload: ForwardedEmailProviderPayload) => void;
  approveForwardedCandidate: (candidateId: string, asType?: 'task' | 'followup', options?: { overrideUnsafeCreate?: boolean }) => void;
  rejectForwardedCandidate: (candidateId: string) => void;
  saveForwardedCandidateAsReference: (candidateId: string) => void;
  linkForwardedCandidateToExisting: (candidateId: string, itemId: string) => void;
  addForwardRuleFromCandidate: (candidateId: string, action: any) => void;
  addManualForwardRule: (ruleInput: Omit<ForwardedEmailRule, 'id' | 'source' | 'createdAt' | 'updatedAt'>) => void;
  updateForwardRule: (ruleId: string, patch: Partial<ForwardedEmailRule>) => void;
  deleteForwardRule: (ruleId: string) => void;
}

export type AppStoreState = AppBusinessState & AppUiState & AppMetaState;
export type AppStore = AppStoreState & AppStoreActions;
export type MutationEffectState = Pick<AppStore, 'items' | 'tasks' | 'projects' | 'dismissedDuplicatePairs'>;
