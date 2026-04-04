import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { detectDuplicateReviews, buildPairKey } from '../lib/duplicateDetection';
import { buildFollowUpFromDroppedEmail } from '../lib/emailDrop';
import { appendRunningNote, buildDraftText, buildTouchEvent, createId, normalizeItem, todayIso, addDaysIso, resolveProjectName } from '../lib/utils';
import { applyQueuePreset, applyUnifiedFilter, buildUnifiedQueue, defaultExecutionViews, sortUnifiedQueue } from '../lib/unifiedQueue';
import { createPersistenceQueue } from './persistenceQueue';
import { isTauriRuntime, loadPersistedPayload } from '../lib/persistence';
import { parseForwardedProviderPayload } from '../lib/forwardedEmailParser';
import { buildForwardingAudit, buildForwardingCandidate, buildForwardedLedgerEntry, buildTaskFromForwarded, routeForwardedEmail } from '../lib/intakeRouting';
import { getDefaultForwardedRules } from '../lib/intakeRules';
import { buildBatchRecord, buildCandidatesFromAsset, parseIntakeFile } from '../lib/universalIntake';
import type { UniversalCaptureDraft } from '../lib/universalCapture';
import type {
  AppSnapshot,
  DroppedEmailImport,
  DuplicateReview,
  ImportPreviewRow,
  IntakeDocumentDisposition,
  IntakeDocumentKind,
  IntakeDocumentRecord,
  MergeDraft,
  OutlookConnectionSettings,
  OutlookConnectionState,
  OutlookMessage,
  PersistenceMode,
  SavedViewKey,
  TimelineEvent,
  ForwardedEmailRecord,
  ForwardedEmailRule,
  ForwardedIntakeCandidate,
  ForwardedIngestionLedgerEntry,
  ForwardedRoutingAuditEntry,
  ForwardedEmailProviderPayload,
  ForwardedRuleAction,
  IntakeCandidate,
  SavedExecutionView,
  UnifiedQueueFilter,
  UnifiedQueueItem,
  UnifiedQueuePreset,
  UnifiedQueueSort,
  UnifiedQueueDensity,
  ActionReceipt,
  IntakeAssetRecord,
  IntakeBatchRecord,
  IntakeWorkCandidate,
  IntakeReviewerFeedback,
  IntakeReviewerFeedbackField,
  FollowUpAdvancedFilters,
  SavedFollowUpCustomView,
  FollowUpColumnKey,
} from '../types';
import type { FollowUpItem, FollowUpStatus } from '../domains/followups/types';
import type { TaskItem, TaskStatus } from '../domains/tasks/types';
import type { ProjectRecord } from '../domains/projects/types';
import type { CompanyRecord, ContactRecord } from '../domains/relationships/types';
import { validateFollowUpTransition, validateTaskTransition, type WorkflowValidationResult } from '../lib/workflowPolicy';
import { evaluateForwardedImportSafety, evaluateIntakeImportSafety } from '../lib/intakeImportSafety';
import { defaultFollowUpFilters } from '../lib/followUpSelectors';
import { normalizeItems, applyItemRules, syncProjectNamePatch, withItemUpdate, buildFollowUpFromForwarded, buildImportedItem, nextEscalation, buildFollowUpFromOutlookImport, attachProjects } from '../domains/followups/helpers';
import { normalizeTask, normalizeTasks, applyTaskRollupsToItems } from '../domains/tasks/helpers';
import { normalizeCompany, normalizeContact } from '../domains/relationships/helpers';
import { deriveProjects, projectCanonicalKey, stampProject } from '../domains/projects/helpers';
import { appendReviewerFeedback, makeAuditEntry } from '../domains/shared/audit';
import { initialBusinessState, initialMetaState, initialUiState } from './state/initialState';
import type { DraftModalState, ItemModalState, MergeModalState, TaskModalState } from './state/types';
import { buildPersistedPayload } from './state/persistence';

const defaultOutlookConnection = initialBusinessState.outlookConnection;

function refreshDuplicates(items: FollowUpItem[], dismissedDuplicatePairs: string[]): DuplicateReview[] {
  return detectDuplicateReviews(items, dismissedDuplicatePairs);
}


interface WorkflowTransitionAttempt {
  applied: boolean;
  validation: WorkflowValidationResult;
}

interface BatchWorkflowResult {
  affected: number;
  skipped: number;
  warnings: string[];
}
interface AppState {
  items: FollowUpItem[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  tasks: TaskItem[];
  intakeSignals: AppSnapshot['intakeSignals'];
  intakeDocuments: IntakeDocumentRecord[];
  dismissedDuplicatePairs: string[];
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
  hydrated: boolean;
  persistenceMode: PersistenceMode;
  saveError: string;
  syncState: 'idle' | 'checking' | 'saving' | 'saved' | 'error';
  lastSyncedAt?: string;
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
  queuePreset: UnifiedQueuePreset;
  executionFilter: UnifiedQueueFilter;
  executionSort: UnifiedQueueSort;
  queueDensity: UnifiedQueueDensity;
  savedExecutionViews: SavedExecutionView[];
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
  addForwardRuleFromCandidate: (candidateId: string, action: ForwardedRuleAction) => void;
  addManualForwardRule: (rule: Omit<ForwardedEmailRule, 'id' | 'createdAt' | 'updatedAt' | 'source'>) => void;
  updateForwardRule: (ruleId: string, patch: Partial<ForwardedEmailRule>) => void;
  deleteForwardRule: (ruleId: string) => void;
  getUnifiedQueue: () => UnifiedQueueItem[];
  setQueuePreset: (preset: UnifiedQueuePreset) => void;
  setExecutionFilter: (filter: UnifiedQueueFilter) => void;
  setExecutionSort: (sort: UnifiedQueueSort) => void;
  setQueueDensity: (density: UnifiedQueueDensity) => void;
  saveExecutionView: (name: string, scope?: 'personal' | 'team') => void;
  applyExecutionView: (viewId: string) => void;
  stageIntakeCandidate: (candidate: IntakeCandidate) => void;
  approveIntakeCandidate: (candidateId: string, mode?: 'task' | 'followup') => void;
  discardIntakeCandidate: (candidateId: string) => void;
  saveIntakeCandidateAsReference: (candidateId: string) => void;
  ingestIntakeFiles: (files: File[], source?: 'drop' | 'file_picker') => Promise<void>;
  updateIntakeWorkCandidate: (candidateId: string, patch: Partial<IntakeWorkCandidate>) => void;
  decideIntakeWorkCandidate: (candidateId: string, decision: 'approve_task' | 'approve_followup' | 'reference' | 'reject' | 'link', linkedRecordId?: string, options?: { overrideUnsafeCreate?: boolean }) => void;
  batchApproveHighConfidence: () => void;
  confirmFollowUpSent: (id: string, notes?: string) => void;
}

async function ensureValidOutlookAccessToken(connection: OutlookConnectionState): Promise<OutlookConnectionState> {
  const graph = await import('../lib/outlookGraph');
  if (!connection.tokens) throw new Error('Connect Outlook first.');
  if (!graph.isTokenExpired(connection.tokens)) return connection;
  if (!connection.tokens.refreshToken) throw new Error('Outlook token expired. Reconnect the mailbox.');
  const refreshed = await graph.refreshAccessToken(connection.settings, connection.tokens.refreshToken);
  return {
    ...connection,
    tokens: refreshed,
    mailboxLinked: true,
    syncStatus: 'connected',
    lastError: undefined,
  };
}

let enqueuePersist: (() => void) | null = null;
function queuePersist(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  if (!enqueuePersist) {
    enqueuePersist = createPersistenceQueue(
      {
        getPayload: () => buildPersistedPayload(get()),
        onSaving: () => set({ syncState: 'saving', saveError: '' }),
        onSaved: (mode, timestamp) => set({ persistenceMode: mode, syncState: 'saved', saveError: '', lastSyncedAt: timestamp }),
        onError: (message) => set({ syncState: 'error', saveError: message }),
      },
      { debounceMs: 350, maxRetries: 2, retryDelayMs: 650 },
    );
  }
  enqueuePersist();
}

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialBusinessState,
  ...initialUiState,
  ...initialMetaState,
  initializeApp: async () => {
    if (get().hydrated) return;
    try {
      const { payload, mode } = await loadPersistedPayload();
      const hasItems = Object.prototype.hasOwnProperty.call(payload, 'items');
      const hasContacts = Object.prototype.hasOwnProperty.call(payload, 'contacts');
      const hasCompanies = Object.prototype.hasOwnProperty.call(payload, 'companies');
      const hasProjects = Object.prototype.hasOwnProperty.call(payload, 'projects');
      const hasTasks = Object.prototype.hasOwnProperty.call(payload, 'tasks');
      const hasSignals = Object.prototype.hasOwnProperty.call(payload.auxiliary, 'intakeSignals');
      const hasDocuments = Object.prototype.hasOwnProperty.call(payload.auxiliary, 'intakeDocuments');

      const baseItems = hasItems ? normalizeItems(payload.items ?? []) : normalizeItems([]);
      const contacts = hasContacts ? (payload.contacts ?? []).map(normalizeContact) : [];
      const companies = hasCompanies ? (payload.companies ?? []).map(normalizeCompany) : [];
      const preProjects = deriveProjects(baseItems, hasProjects ? (payload.projects ?? []) : [], hasTasks ? (payload.tasks ?? []) : []);
      const projects = preProjects;
      const items = attachProjects(applyTaskRollupsToItems(baseItems, hasTasks ? (payload.tasks ?? []) : []), projects);
      const tasks = normalizeTasks((hasTasks ? (payload.tasks ?? []) : []).map((task) => {
        const projectName = resolveProjectName(task.projectId, task.project, projects);
        const linkedProject = projects.find((project) => projectCanonicalKey(project.name) === projectCanonicalKey(projectName));
        return { ...task, project: linkedProject?.name ?? projectName, projectId: linkedProject?.id ?? task.projectId };
      }));
      const intakeSignals = hasSignals ? (payload.auxiliary.intakeSignals ?? []) : [];
      const intakeDocuments = (hasDocuments ? (payload.auxiliary.intakeDocuments ?? []) : []).map((doc) => ({ ...doc, project: resolveProjectName(doc.projectId, doc.project, projects) }));
      const dismissedDuplicatePairs = payload.auxiliary.dismissedDuplicatePairs ?? [];
      const droppedEmailImports = payload.auxiliary.droppedEmailImports ?? [];
      const forwardedEmails = payload.auxiliary.forwardedEmails ?? [];
      const forwardedRules = payload.auxiliary.forwardedRules?.length ? payload.auxiliary.forwardedRules : getDefaultForwardedRules();
      const forwardedCandidates = payload.auxiliary.forwardedCandidates ?? [];
      const forwardedLedger = payload.auxiliary.forwardedLedger ?? [];
      const forwardedRoutingAudit = payload.auxiliary.forwardedRoutingAudit ?? [];
      const intakeCandidates = payload.auxiliary.intakeCandidates ?? [];
      const intakeAssets = payload.auxiliary.intakeAssets ?? [];
      const intakeBatches = payload.auxiliary.intakeBatches ?? [];
      const intakeWorkCandidates = payload.auxiliary.intakeWorkCandidates ?? [];
      const intakeReviewerFeedback = payload.auxiliary.intakeReviewerFeedback ?? [];
      const savedExecutionViews = payload.auxiliary.savedExecutionViews?.length ? payload.auxiliary.savedExecutionViews : defaultExecutionViews;
      const followUpFilters = payload.auxiliary.followUpFilters ?? defaultFollowUpFilters;
      const followUpColumns = payload.auxiliary.followUpColumns?.length
        ? payload.auxiliary.followUpColumns
        : (['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'project', 'assignee', 'nextAction'] as FollowUpColumnKey[]);
      const savedFollowUpViews = payload.auxiliary.savedFollowUpViews ?? [];
      set({
        items,
        contacts,
        companies,
        projects,
        tasks,
        intakeSignals,
        intakeDocuments,
        dismissedDuplicatePairs,
        duplicateReviews: refreshDuplicates(items, dismissedDuplicatePairs),
        selectedId: items[0]?.id ?? null,
        selectedTaskId: tasks[0]?.id ?? null,
        hydrated: true,
        persistenceMode: mode,
        droppedEmailImports,
        forwardedEmails,
        forwardedRules,
        forwardedCandidates,
        forwardedLedger,
        forwardedRoutingAudit,
        intakeCandidates,
        intakeAssets,
        intakeBatches,
        intakeWorkCandidates,
        intakeReviewerFeedback,
        savedExecutionViews,
        followUpFilters,
        followUpColumns,
        savedFollowUpViews,
        saveError: '',
        syncState: 'saved',
        lastSyncedAt: todayIso(),
        outlookConnection: {
          ...defaultOutlookConnection,
          ...(payload.auxiliary.outlookConnection ?? {}),
          settings: {
            ...defaultOutlookConnection.settings,
            ...(payload.auxiliary.outlookConnection?.settings ?? {}),
          },
          syncCursorByFolder: {
            inbox: payload.auxiliary.outlookConnection?.syncCursorByFolder?.inbox ?? {},
            sentitems: payload.auxiliary.outlookConnection?.syncCursorByFolder?.sentitems ?? {},
          },
        },
        outlookMessages: payload.auxiliary.outlookMessages ?? [],
      });
    } catch (error) {
      set({ hydrated: true, persistenceMode: 'browser', saveError: error instanceof Error ? error.message : 'Failed to load saved data.', syncState: 'error' });
    }
  },
  setSelectedId: (id) => set({ selectedId: id }),
  setSearch: (value) => set({ search: value }),
  setProjectFilter: (value) => set({ projectFilter: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setActiveView: (value) => set({ activeView: value }),
  setFollowUpFilters: (value) => set((state) => ({ followUpFilters: { ...state.followUpFilters, ...value } })),
  resetFollowUpFilters: () => set({ followUpFilters: defaultFollowUpFilters }),
  toggleFollowUpSelection: (id) => set((state) => ({
    selectedFollowUpIds: state.selectedFollowUpIds.includes(id)
      ? state.selectedFollowUpIds.filter((value) => value !== id)
      : [...state.selectedFollowUpIds, id],
    selectedId: id,
  })),
  clearFollowUpSelection: () => set({ selectedFollowUpIds: [] }),
  selectAllVisibleFollowUps: (ids) => set({ selectedFollowUpIds: ids }),
  saveFollowUpCustomView: (name, search) => set((state) => ({
    savedFollowUpViews: [{ id: createId('FUV'), name, search, activeView: state.activeView, filters: state.followUpFilters, createdAt: todayIso() }, ...state.savedFollowUpViews],
  })),
  applySavedFollowUpCustomView: (id) => set((state) => {
    const view = state.savedFollowUpViews.find((entry) => entry.id === id);
    if (!view) return state;
    return { search: view.search, activeView: view.activeView, followUpFilters: view.filters };
  }),
  setFollowUpColumns: (columns) => set({ followUpColumns: columns }),
  openCreateModal: () => set({ itemModal: { open: true, mode: 'create', itemId: null }, taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null }),
  openEditModal: (id) => set({ itemModal: { open: true, mode: 'edit', itemId: id }, selectedId: id }),
  closeItemModal: () => set({ itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null }),
  openTouchModal: () => set({ touchModalOpen: true }),
  closeTouchModal: () => set({ touchModalOpen: false }),
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),
  openMergeModal: (baseId, candidateId) => set({ mergeModal: { open: true, baseId, candidateId }, selectedId: baseId }),
  closeMergeModal: () => set({ mergeModal: { open: false, baseId: null, candidateId: null } }),
  openDraftModal: (id) => set({ draftModal: { open: true, itemId: id }, selectedId: id }),
  closeDraftModal: () => set({ draftModal: { open: false, itemId: null } }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setTaskOwnerFilter: (value) => set({ taskOwnerFilter: value }),
  setTaskStatusFilter: (value) => set({ taskStatusFilter: value }),
  openCreateTaskModal: () => set({ taskModal: { open: true, mode: 'create', taskId: null }, itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null }),
  openCreateFromCapture: (draft) => set({
    createWorkDraft: draft,
    itemModal: draft.kind === 'followup' ? { open: true, mode: 'create', itemId: null } : { open: false, mode: 'create', itemId: null },
    taskModal: draft.kind === 'task' ? { open: true, mode: 'create', taskId: null } : { open: false, mode: 'create', taskId: null },
  }),
  openEditTaskModal: (id) => set({ taskModal: { open: true, mode: 'edit', taskId: id }, selectedTaskId: id }),
  closeTaskModal: () => set({ taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null }),
  updateItem: (id, patch) => {
    set((state) => {
      const normalizedPatch = syncProjectNamePatch(patch, state.projects);
      const items = withItemUpdate(state.items, id, (item) => {
        const statusChanged = normalizedPatch.status && normalizedPatch.status !== item.status;
        const dueChanged = normalizedPatch.dueDate && normalizedPatch.dueDate !== item.dueDate;
        const assigneeChanged = (normalizedPatch.assigneeUserId && normalizedPatch.assigneeUserId !== item.assigneeUserId)
          || (normalizedPatch.assigneeDisplayName && normalizedPatch.assigneeDisplayName !== item.assigneeDisplayName);
        const promiseChanged = normalizedPatch.promisedDate !== undefined && normalizedPatch.promisedDate !== item.promisedDate;
        const timeline: TimelineEvent[] = [...item.timeline];
        const auditHistory = [...(item.auditHistory ?? [])];
        if (statusChanged) timeline.unshift(buildTouchEvent(`Status changed from ${item.status} to ${normalizedPatch.status}.`, 'status_changed'));
        if (dueChanged) timeline.unshift(buildTouchEvent('Due date updated.', 'touched'));
        if (promiseChanged) timeline.unshift(buildTouchEvent('Promised date updated.', 'touched'));
        if (statusChanged) {
          auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'status_changed', field: 'status', from: item.status, to: normalizedPatch.status, summary: `Status changed to ${normalizedPatch.status}.` }));
        }
        if (dueChanged) {
          auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'due_date_changed', field: 'dueDate', from: item.dueDate, to: normalizedPatch.dueDate, summary: 'Due date updated.' }));
        }
        if (assigneeChanged) {
          auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'assignment_changed', field: 'assignee', from: item.assigneeDisplayName || item.owner, to: normalizedPatch.assigneeDisplayName || item.assigneeDisplayName || item.owner, summary: 'Ownership reassigned.' }));
        }
        return applyItemRules(normalizeItem({ ...item, ...normalizedPatch, timeline, auditHistory, updatedByUserId: 'user-current', updatedByDisplayName: 'Current user' }));
      });
      const projects = deriveProjects(items, state.projects, state.tasks);
      return { items: attachProjects(applyTaskRollupsToItems(items, state.tasks), projects), projects, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  addItem: (item) => {
    set((state) => {
      const normalized = applyItemRules(normalizeItem({
        ...item,
        project: resolveProjectName(item.projectId, item.project, state.projects),
        assigneeDisplayName: item.assigneeDisplayName || item.owner,
        auditHistory: [makeAuditEntry({ actorUserId: item.createdByUserId || 'user-current', actorDisplayName: item.createdByDisplayName || 'Current user', action: 'created', summary: 'Record created.' }), ...(item.auditHistory || [])],
      }));
      const items = normalizeItems([normalized, ...state.items]);
      const projects = deriveProjects(items, state.projects, state.tasks);
      return {
        items: attachProjects(applyTaskRollupsToItems(items, state.tasks), projects),
        projects,
        selectedId: normalized.id,
        itemModal: { open: false, mode: 'create', itemId: null },
        createWorkDraft: null,
        duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  deleteItem: (id) => {
    set((state) => {
      const nextItems = normalizeItems(state.items.filter((item) => item.id !== id));
      const projects = deriveProjects(nextItems, state.projects, state.tasks);
      const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(id));
      return {
        items: attachProjects(applyTaskRollupsToItems(nextItems, state.tasks), projects),
        projects,
        intakeDocuments: state.intakeDocuments.map((doc) => doc.linkedFollowUpId === id ? { ...doc, linkedFollowUpId: undefined, disposition: 'Unprocessed' } : doc),
        dismissedDuplicatePairs,
        selectedId: state.selectedId === id ? nextItems[0]?.id ?? null : state.selectedId,
        duplicateReviews: refreshDuplicates(nextItems, dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  addRunningNote: (id, note) => {
    set((state) => {
      const items = withItemUpdate(state.items, id, (item) => ({
        ...item,
        notes: appendRunningNote(item.notes, note),
        lastTouchDate: todayIso(),
        timeline: [buildTouchEvent('Added a running note entry.', 'note'), ...item.timeline],
      }));
      return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },

  attemptFollowUpTransition: (id, status, patch = {}, options) => {
    const state = get();
    const record = state.items.find((item) => item.id === id);
    if (!record) {
      return { applied: false, validation: { allowed: false, blockers: ['Follow-up not found.'], warnings: [], requiredFields: [], overrideAllowed: false, recommendedNextActions: [], readyToClose: false } };
    }
    const mergedPatch = { ...patch, status };
    const validation = validateFollowUpTransition({
      record,
      from: record.status,
      to: status,
      patch: mergedPatch,
      context: { tasks: state.tasks },
      override: !!options?.override,
    });
    if (!validation.allowed) return { applied: false, validation };
    get().updateItem(id, mergedPatch);
    return { applied: true, validation };
  },
  attemptTaskTransition: (id, status, patch = {}) => {
    const state = get();
    const record = state.tasks.find((task) => task.id === id);
    if (!record) {
      return { applied: false, validation: { allowed: false, blockers: ['Task not found.'], warnings: [], requiredFields: [], overrideAllowed: false, recommendedNextActions: [], readyToClose: false } };
    }
    const mergedPatch = { ...patch, status };
    const validation = validateTaskTransition({ record, from: record.status, to: status, patch: mergedPatch });
    if (!validation.allowed) return { applied: false, validation };
    get().updateTask(id, mergedPatch);
    return { applied: true, validation };
  },
  runValidatedBatchFollowUpTransition: (ids, status, patch = {}, options) => {
    const warnings: string[] = [];
    let affected = 0;
    let skipped = 0;
    ids.forEach((id) => {
      const result = get().attemptFollowUpTransition(id, status, patch, options);
      if (result.applied) {
        affected += 1;
      } else {
        skipped += 1;
        if (result.validation.blockers.length) warnings.push(`${id}: ${result.validation.blockers.join(' ')}`);
      }
      if (result.validation.warnings.length) warnings.push(`${id}: ${result.validation.warnings.join(' ')}`);
    });
    return { affected, skipped, warnings };
  },
  addTask: (task) => {
    set((state) => {
      const normalized = normalizeTask({
        ...task,
        project: resolveProjectName(task.projectId, task.project, state.projects),
        assigneeDisplayName: task.assigneeDisplayName || task.owner,
        auditHistory: [makeAuditEntry({ actorUserId: task.createdByUserId || 'user-current', actorDisplayName: task.createdByDisplayName || 'Current user', action: 'created', summary: 'Task created.' }), ...(task.auditHistory || [])],
      });
      const tasks = normalizeTasks([normalized, ...state.tasks]);
      const projects = deriveProjects(state.items, state.projects, tasks);
      const items = applyTaskRollupsToItems(state.items, tasks);
      return { tasks, items: attachProjects(items, projects), projects, selectedTaskId: normalized.id, taskModal: { open: false, mode: 'create', taskId: null }, createWorkDraft: null };
    });
    queuePersist(get, set);
  },
  updateTask: (id, patch) => {
    set((state) => {
      const tasks = normalizeTasks(state.tasks.map((task) => {
        if (task.id !== id) return task;
        const auditHistory = [...(task.auditHistory || [])];
        if (patch.status && patch.status !== task.status) {
          auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'status_changed', field: 'status', from: task.status, to: patch.status, summary: `Task status moved to ${patch.status}.` }));
        }
        if (patch.assigneeDisplayName && patch.assigneeDisplayName !== task.assigneeDisplayName) {
          auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'assignment_changed', field: 'assignee', from: task.assigneeDisplayName || task.owner, to: patch.assigneeDisplayName, summary: 'Task reassigned.' }));
        }
        const status = patch.status || task.status;
        const autoPatch: Partial<TaskItem> = {
          startedAt: status === 'In progress' ? (patch.startedAt || task.startedAt || todayIso()) : patch.startedAt,
          completedAt: status === 'Done' ? (patch.completedAt || task.completedAt || todayIso()) : undefined,
          completionNote: status === 'Done' ? (patch.completionNote || task.completionNote) : undefined,
          blockReason: status === 'Blocked' ? (patch.blockReason || task.blockReason || 'Blocked pending dependency') : undefined,
          deferredUntil: status === 'Done' || status === 'Blocked' ? undefined : patch.deferredUntil,
        };
        return normalizeTask({ ...task, ...patch, ...autoPatch, project: resolveProjectName(patch.projectId, patch.project, state.projects), auditHistory, updatedByUserId: 'user-current', updatedByDisplayName: 'Current user' });
      }));
      const projects = deriveProjects(state.items, state.projects, tasks);
      const items = applyTaskRollupsToItems(state.items, tasks);
      return { tasks, items: attachProjects(items, projects), projects };
    });
    queuePersist(get, set);
  },
  deleteTask: (id) => {
    set((state) => {
      const tasks = normalizeTasks(state.tasks.filter((task) => task.id !== id));
      const projects = deriveProjects(state.items, state.projects, tasks);
      const items = applyTaskRollupsToItems(state.items, tasks);
      return { tasks, items: attachProjects(items, projects), projects, selectedTaskId: state.selectedTaskId === id ? tasks[0]?.id ?? null : state.selectedTaskId, taskModal: state.taskModal.taskId === id ? { open: false, mode: 'create', taskId: null } : state.taskModal };
    });
    queuePersist(get, set);
  },
  addTouchLog: ({ id, summary, status, dueDate, nextTouchDate, promisedDate, waitingOn }) => {
    set((state) => {
      const items = withItemUpdate(state.items, id, (item) => ({
        ...item,
        status: status ?? item.status,
        dueDate: dueDate ?? item.dueDate,
        nextTouchDate: nextTouchDate ?? addDaysIso(todayIso(), item.cadenceDays),
        promisedDate: promisedDate !== undefined ? promisedDate : item.promisedDate,
        waitingOn: waitingOn !== undefined ? waitingOn : item.waitingOn,
        lastTouchDate: todayIso(),
        timeline: [buildTouchEvent(summary, status && status !== item.status ? 'status_changed' : 'touched'), ...item.timeline],
      }));
      return { items, touchModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  importItems: (rows) => {
    set((state) => {
      const imported = rows.map(buildImportedItem);
      const items = normalizeItems([...imported, ...state.items]);
      return { items, selectedId: imported[0]?.id ?? state.selectedId, importModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  addDroppedEmailImports: (imports) => {
    if (imports.length === 0) return;
    set((state) => {
      const existing = new Map(state.droppedEmailImports.map((entry) => [entry.sourceRef, entry]));
      imports.forEach((entry) => existing.set(entry.sourceRef, entry));
      return { droppedEmailImports: Array.from(existing.values()) };
    });
    queuePersist(get, set);
  },
  removeDroppedEmailImport: (id) => {
    set((state) => ({ droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id) }));
    queuePersist(get, set);
  },
  clearDroppedEmailImports: () => {
    set({ droppedEmailImports: [] });
    queuePersist(get, set);
  },
  convertDroppedEmailToItem: (id) => {
    const importItem = get().droppedEmailImports.find((entry) => entry.id === id);
    if (!importItem) return;
    const item = normalizeItem({
      ...buildFollowUpFromDroppedEmail(importItem),
      timeline: [buildTouchEvent(`Imported from dropped email file ${importItem.fileName}.`, 'imported')],
    });
    set((state) => {
      const items = normalizeItems([item, ...state.items]);
      return {
        items,
        selectedId: item.id,
        droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id),
        duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  convertSignalToItem: (signalId) => {
    const signal = get().intakeSignals.find((entry) => entry.id === signalId);
    if (!signal) return;
    const item: FollowUpItem = normalizeItem({
      id: createId(),
      title: signal.title,
      source: signal.source,
      project: 'General',
      owner: 'Unassigned',
      status: signal.urgency === 'High' ? 'Needs action' : 'In progress',
      priority: signal.urgency === 'High' ? 'High' : signal.urgency === 'Medium' ? 'Medium' : 'Low',
      dueDate: todayIso(),
      promisedDate: undefined,
      lastTouchDate: todayIso(),
      nextTouchDate: addDaysIso(todayIso(), signal.urgency === 'High' ? 1 : 3),
      nextAction: 'Review the intake signal and confirm owner, project, and next action.',
      summary: signal.detail,
      tags: ['Imported'],
      sourceRef: `Intake signal ${signal.id}`,
      sourceRefs: [`Intake signal ${signal.id}`],
      mergedItemIds: [],
      notes: '',
      timeline: [buildTouchEvent('Converted from intake signal.', 'imported')],
      category: 'General',
      owesNextAction: 'Unknown',
      escalationLevel: signal.urgency === 'High' ? 'Watch' : 'None',
      cadenceDays: signal.urgency === 'High' ? 2 : 4,
      draftFollowUp: '',
    });
    set((state) => {
      const items = normalizeItems([item, ...state.items]);
      const intakeSignals = state.intakeSignals.filter((entry) => entry.id !== signalId);
      return { items, intakeSignals, selectedId: item.id, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  dismissDuplicatePair: (leftId, rightId) => {
    set((state) => {
      const pairKey = buildPairKey(leftId, rightId);
      if (state.dismissedDuplicatePairs.includes(pairKey)) return state;
      const dismissedDuplicatePairs = [...state.dismissedDuplicatePairs, pairKey];
      return { dismissedDuplicatePairs, duplicateReviews: refreshDuplicates(state.items, dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  mergeItems: (baseId, candidateId, draft) => {
    set((state) => {
      const base = state.items.find((item) => item.id === baseId);
      const candidate = state.items.find((item) => item.id === candidateId);
      if (!base || !candidate) return state;
      const mergedRecord: FollowUpItem = normalizeItem({
        ...base,
        ...draft,
        id: base.id,
        timeline: [
          buildTouchEvent(`Merged ${candidate.id} into this record.`, 'merged'),
          ...draft.timeline,
        ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
      });
      const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(candidateId));
      const items = normalizeItems([mergedRecord, ...state.items.filter((item) => item.id !== baseId && item.id !== candidateId)]);
      return {
        items,
        dismissedDuplicatePairs,
        selectedId: baseId,
        mergeModal: { open: false, baseId: null, candidateId: null },
        duplicateReviews: refreshDuplicates(items, dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  markNudged: (id) => {
    set((state) => {
      const items = withItemUpdate(state.items, id, (item) => ({
        ...item,
        lastTouchDate: todayIso(),
        lastNudgedAt: todayIso(),
        nextTouchDate: addDaysIso(todayIso(), item.cadenceDays),
        snoozedUntilDate: undefined,
        timeline: [buildTouchEvent('Marked as nudged and pushed to next touch date.', 'nudged'), ...item.timeline],
      }));
      return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  snoozeItem: (id, days) => {
    set((state) => {
      const until = addDaysIso(todayIso(), days);
      const items = withItemUpdate(state.items, id, (item) => ({
        ...item,
        snoozedUntilDate: until,
        nextTouchDate: until,
        timeline: [buildTouchEvent(`Snoozed for ${days} day${days === 1 ? '' : 's'}.`, 'snoozed'), ...item.timeline],
      }));
      return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  cycleEscalation: (id) => {
    set((state) => {
      const items = withItemUpdate(state.items, id, (item) => ({
        ...item,
        escalationLevel: nextEscalation(item.escalationLevel),
        timeline: [buildTouchEvent(`Escalation moved to ${nextEscalation(item.escalationLevel)}.`, 'escalated'), ...item.timeline],
      }));
      return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  batchUpdateFollowUps: (ids, patch, summary) => {
    if (ids.length === 0) return;
    if (patch.status) {
      get().runValidatedBatchFollowUpTransition(ids, patch.status, patch);
      set({ selectedFollowUpIds: [] });
      queuePersist(get, set);
      return;
    }
    if (patch.nextTouchDate && !patch.snoozedUntilDate) {
      ids.forEach((id) => {
        get().attemptFollowUpTransition(id, 'Waiting internal', { ...patch, snoozedUntilDate: patch.nextTouchDate });
      });
      set({ selectedFollowUpIds: [] });
      queuePersist(get, set);
      return;
    }
    set((state) => {
      const idSet = new Set(ids);
      const items = state.items.map((item) => {
        if (!idSet.has(item.id)) return item;
        return normalizeItem({
          ...item,
          ...patch,
          timeline: [buildTouchEvent(summary, 'bundle_action'), ...item.timeline],
          lastActionAt: todayIso(),
          lastCompletedAction: summary,
          auditHistory: [
            makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'updated', summary }),
            ...(item.auditHistory || []),
          ],
        });
      });
      return { items: applyTaskRollupsToItems(items, state.tasks), selectedFollowUpIds: [] };
    });
    queuePersist(get, set);
  },
  updateDraftForItem: (id, draft) => {
    set((state) => ({
      items: withItemUpdate(state.items, id, (item) => ({ ...item, draftFollowUp: draft })),
    }));
    queuePersist(get, set);
  },
  generateDraftForItem: (id) => {
    set((state) => {
      const item = state.items.find((entry) => entry.id === id);
      if (!item) return state;
      const contact = state.contacts.find((entry) => entry.id === item.contactId);
      const company = state.companies.find((entry) => entry.id === item.companyId);
      const draft = buildDraftText(item, contact, company);
      return { items: withItemUpdate(state.items, id, (entry) => ({ ...entry, draftFollowUp: draft })) };
    });
    queuePersist(get, set);
  },
  addProject: (input) => {
    const id = createId('PRJ');
    const record: ProjectRecord = {
      id,
      ...input,
      createdAt: todayIso(),
      updatedAt: todayIso(),
    };
    set((state) => ({ projects: [...state.projects, record].sort((a, b) => a.name.localeCompare(b.name)) }));
    queuePersist(get, set);
    return id;
  },
  updateProject: (id, patch) => {
    set((state) => {
      const original = state.projects.find((project) => project.id === id);
      const projects = state.projects.map((project) => (project.id === id ? stampProject(project, patch) : project));
      const renamedTo = projects.find((project) => project.id === id)?.name ?? original?.name ?? 'General';
      const items = original && patch.name && patch.name !== original.name
        ? attachProjects(state.items.map((item) => item.projectId === id ? normalizeItem({ ...item, project: renamedTo }) : item), projects)
        : attachProjects(state.items, projects);
      const tasks = state.tasks.map((task) => task.projectId === id ? normalizeTask({ ...task, project: renamedTo }) : task);
      const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, project: renamedTo } : doc);
      return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, tasks, intakeDocuments };
    });
    queuePersist(get, set);
  },
  reassignProjectRecords: (fromProjectId, toProjectId, recordTypes = ['followups', 'tasks', 'docs']) => {
    set((state) => {
      if (fromProjectId === toProjectId) return state;
      const target = state.projects.find((project) => project.id === toProjectId);
      if (!target) return state;
      const typeSet = new Set(recordTypes);
      const items = typeSet.has('followups')
        ? attachProjects(state.items.map((item) => item.projectId === fromProjectId ? normalizeItem({ ...item, projectId: target.id, project: target.name }) : item), state.projects)
        : state.items;
      const tasks = typeSet.has('tasks')
        ? state.tasks.map((task) => task.projectId === fromProjectId ? normalizeTask({ ...task, projectId: target.id, project: target.name }) : task)
        : state.tasks;
      const intakeDocuments = typeSet.has('docs')
        ? state.intakeDocuments.map((doc) => doc.projectId === fromProjectId ? { ...doc, projectId: target.id, project: target.name } : doc)
        : state.intakeDocuments;
      return { items, tasks, intakeDocuments };
    });
    queuePersist(get, set);
  },
  deleteProject: (id, reassignToProjectId) => {
    set((state) => {
      if (!state.projects.some((project) => project.id === id)) return state;
      const general = state.projects.find((project) => project.name === 'General') ?? {
        id: createId('PRJ'),
        name: 'General', owner: 'Unassigned', status: 'Active', notes: '', tags: ['General'], createdAt: todayIso(), updatedAt: todayIso(),
      };
      const existingProjects = state.projects.some((project) => project.id === general.id) ? state.projects : [...state.projects, general];
      const targetProject = existingProjects.find((project) => project.id === reassignToProjectId && project.id !== id) ?? general;
      const projects = existingProjects.filter((project) => project.id !== id);
      const items = attachProjects(state.items.map((item) => item.projectId === id ? normalizeItem({ ...item, projectId: targetProject.id, project: targetProject.name }) : item), projects);
      const tasks = state.tasks.map((task) => task.projectId === id ? normalizeTask({ ...task, projectId: targetProject.id, project: targetProject.name }) : task);
      const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, projectId: targetProject.id, project: targetProject.name } : doc);
      return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, tasks, intakeDocuments };
    });
    queuePersist(get, set);
  },
  addIntakeDocument: (input) => {
    const id = createId('DOC');
    set((state) => {
      const project = input.projectId ? state.projects.find((entry) => entry.id === input.projectId) : state.projects.find((entry) => entry.name.toLowerCase() === (input.project ?? '').toLowerCase());
      const record: IntakeDocumentRecord = {
        id,
        name: input.name,
        kind: input.kind,
        disposition: 'Unprocessed',
        projectId: project?.id ?? input.projectId,
        project: project?.name ?? input.project ?? 'General',
        owner: input.owner ?? project?.owner ?? 'Unassigned',
        sourceRef: input.sourceRef ?? 'Uploaded to intake',
        uploadedAt: todayIso(),
        notes: input.notes ?? '',
        tags: input.tags ?? [],
      };
      return { intakeDocuments: [record, ...state.intakeDocuments] };
    });
    queuePersist(get, set);
    return id;
  },
  updateIntakeDocument: (id, patch) => {
    set((state) => ({
      intakeDocuments: state.intakeDocuments.map((doc) => {
        if (doc.id !== id) return doc;
        const projectName = resolveProjectName(patch.projectId, patch.project, state.projects);
        return { ...doc, ...patch, project: projectName };
      }),
    }));
    queuePersist(get, set);
  },
  setIntakeDocumentDisposition: (id, disposition, linkedFollowUpId) => {
    set((state) => ({
      intakeDocuments: state.intakeDocuments.map((doc) => doc.id === id ? { ...doc, disposition, linkedFollowUpId: linkedFollowUpId ?? doc.linkedFollowUpId } : doc),
    }));
    queuePersist(get, set);
  },
  deleteIntakeDocument: (id) => {
    set((state) => ({ intakeDocuments: state.intakeDocuments.filter((doc) => doc.id !== id) }));
    queuePersist(get, set);
  },
  addContact: (input) => {
    const id = createId('CT');
    set((state) => ({ contacts: [normalizeContact({ id, ...input }), ...state.contacts] }));
    queuePersist(get, set);
    return id;
  },
  updateContact: (id, patch) => {
    set((state) => ({ contacts: state.contacts.map((contact) => (contact.id === id ? normalizeContact({ ...contact, ...patch }) : contact)) }));
    queuePersist(get, set);
  },
  reassignContactLinks: (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    set((state) => {
      const tasks = normalizeTasks(state.tasks.map((task) => (task.contactId === fromId ? normalizeTask({ ...task, contactId: toId }) : task)));
      const items = attachProjects(applyTaskRollupsToItems(normalizeItems(state.items.map((item) => (item.contactId === fromId ? normalizeItem({ ...item, contactId: toId }) : item))), tasks), state.projects);
      return {
        items,
        tasks,
        companies: state.companies.map((company) => (company.primaryContactId === fromId ? normalizeCompany({ ...company, primaryContactId: toId }) : company)),
      };
    });
    queuePersist(get, set);
  },
  mergeContacts: (baseId, duplicateId) => {
    if (!baseId || !duplicateId || baseId === duplicateId) return;
    get().reassignContactLinks(duplicateId, baseId);
    get().deleteContact(duplicateId);
  },
  deleteContact: (id) => {
    set((state) => {
      const tasks = normalizeTasks(state.tasks.map((task) => (task.contactId === id ? normalizeTask({ ...task, contactId: undefined }) : task)));
      const items = attachProjects(applyTaskRollupsToItems(normalizeItems(state.items.map((item) => (item.contactId === id ? normalizeItem({ ...item, contactId: undefined }) : item))), tasks), state.projects);
      return {
        contacts: state.contacts.filter((contact) => contact.id !== id),
        items,
        tasks,
        companies: state.companies.map((company) => (company.primaryContactId === id ? normalizeCompany({ ...company, primaryContactId: undefined }) : company)),
      };
    });
    queuePersist(get, set);
  },
  addCompany: (input) => {
    const id = createId('CO');
    set((state) => ({ companies: [normalizeCompany({ id, ...input }), ...state.companies] }));
    queuePersist(get, set);
    return id;
  },
  updateCompany: (id, patch) => {
    set((state) => ({ companies: state.companies.map((company) => (company.id === id ? normalizeCompany({ ...company, ...patch }) : company)) }));
    queuePersist(get, set);
  },
  reassignCompanyLinks: (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    set((state) => {
      const tasks = normalizeTasks(state.tasks.map((task) => (task.companyId === fromId ? normalizeTask({ ...task, companyId: toId }) : task)));
      const items = attachProjects(applyTaskRollupsToItems(normalizeItems(state.items.map((item) => (item.companyId === fromId ? normalizeItem({ ...item, companyId: toId }) : item))), tasks), state.projects);
      return {
        contacts: state.contacts.map((contact) => (contact.companyId === fromId ? normalizeContact({ ...contact, companyId: toId }) : contact)),
        items,
        tasks,
      };
    });
    queuePersist(get, set);
  },
  mergeCompanies: (baseId, duplicateId) => {
    if (!baseId || !duplicateId || baseId === duplicateId) return;
    get().reassignCompanyLinks(duplicateId, baseId);
    get().deleteCompany(duplicateId);
  },
  deleteCompany: (id) => {
    set((state) => {
      const tasks = normalizeTasks(state.tasks.map((task) => (task.companyId === id ? normalizeTask({ ...task, companyId: undefined }) : task)));
      const items = attachProjects(applyTaskRollupsToItems(normalizeItems(state.items.map((item) => (item.companyId === id ? normalizeItem({ ...item, companyId: undefined }) : item))), tasks), state.projects);
      return {
        companies: state.companies.filter((company) => company.id !== id),
        contacts: state.contacts.map((contact) => (contact.companyId === id ? normalizeContact({ ...contact, companyId: undefined }) : contact)),
        items,
        tasks,
      };
    });
    queuePersist(get, set);
  },

  getUnifiedQueue: () => {
    const state = get();
    const queue = buildUnifiedQueue(state.items, state.tasks);
    const preset = applyQueuePreset(queue, state.queuePreset);
    return sortUnifiedQueue(applyUnifiedFilter(preset, state.executionFilter), state.executionSort);
  },
  setQueuePreset: (preset) => set({ queuePreset: preset }),
  setExecutionFilter: (filter) => set({ executionFilter: filter }),
  setExecutionSort: (sort) => set({ executionSort: sort }),
  setQueueDensity: (density) => set({ queueDensity: density }),
  saveExecutionView: (name, scope = 'personal') => {
    set((state) => ({
      savedExecutionViews: [{ id: createId('VIEW'), name, scope, createdAt: todayIso(), preset: state.queuePreset, filter: state.executionFilter }, ...state.savedExecutionViews],
    }));
    queuePersist(get, set);
  },
  applyExecutionView: (viewId) => {
    const view = get().savedExecutionViews.find((entry) => entry.id === viewId);
    if (!view) return;
    set({ queuePreset: view.preset ?? 'Today', executionFilter: view.filter ?? {} });
  },
  stageIntakeCandidate: (candidate) => {
    set((state) => ({ intakeCandidates: [candidate, ...state.intakeCandidates] }));
    queuePersist(get, set);
  },
  approveIntakeCandidate: (candidateId, mode) => {
    const state = get();
    const candidate = state.intakeCandidates.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    const asType = mode ?? candidate.suggestedType;
    if (asType === 'task') {
      state.addTask({ id: createId('TSK'), title: candidate.draft.title, project: candidate.detectedProject || 'General', owner: candidate.detectedOwner || 'Unassigned', status: 'To do', priority: candidate.priority, dueDate: candidate.detectedDueDate, summary: candidate.draft.summary, nextStep: candidate.draft.nextStep || candidate.draft.title, notes: '', tags: ['Intake review'], createdAt: todayIso(), updatedAt: todayIso(), needsCleanup: candidate.confidenceTier !== 'high' });
    } else {
      state.addItem({ id: createId(), title: candidate.draft.title, source: 'Notes', project: candidate.detectedProject || 'General', owner: candidate.detectedOwner || 'Unassigned', status: 'Needs action', priority: candidate.priority, dueDate: candidate.detectedDueDate || addDaysIso(todayIso(), 1), lastTouchDate: todayIso(), nextTouchDate: candidate.detectedDueDate || addDaysIso(todayIso(), 2), nextAction: candidate.draft.nextAction || candidate.draft.title, summary: candidate.draft.summary, tags: ['Intake review'], sourceRef: 'Quick capture intake', sourceRefs: [], mergedItemIds: [], waitingOn: candidate.waitingOn, notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3, needsCleanup: candidate.confidenceTier !== 'high', cleanupReasons: [] });
    }
    set((inner) => ({
      intakeCandidates: inner.intakeCandidates.filter((entry) => entry.id !== candidateId),
      intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
        source: 'quick_capture',
        candidateId: candidate.id,
        candidateKind: 'quick_capture',
        suggestedType: candidate.suggestedType,
        suggestedAction: 'create_new',
        finalDecision: asType === 'task' ? 'approved_task' : 'approved_followup',
        overrideApplied: asType !== candidate.suggestedType,
        correctedFields: asType !== candidate.suggestedType ? ['type'] : [],
      }),
    }));
    queuePersist(get, set);
  },
  discardIntakeCandidate: (candidateId) => {
    set((state) => {
      const candidate = state.intakeCandidates.find((entry) => entry.id === candidateId);
      if (!candidate) return state;
      return {
        intakeCandidates: state.intakeCandidates.filter((entry) => entry.id !== candidateId),
        intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
          source: 'quick_capture',
          candidateId: candidate.id,
          candidateKind: 'quick_capture',
          suggestedType: candidate.suggestedType,
          suggestedAction: 'create_new',
          finalDecision: 'rejected',
          overrideApplied: true,
          correctedFields: [],
        }),
      };
    });
    queuePersist(get, set);
  },
  saveIntakeCandidateAsReference: (candidateId) => {
    const candidate = get().intakeCandidates.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    get().addIntakeDocument({ name: candidate.draft.title, kind: 'Text', project: candidate.detectedProject, owner: candidate.detectedOwner, sourceRef: 'Quick capture', notes: candidate.rawText, tags: ['reference'] });
    set((state) => ({
      intakeCandidates: state.intakeCandidates.filter((entry) => entry.id !== candidateId),
      intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
        source: 'quick_capture',
        candidateId: candidate.id,
        candidateKind: 'quick_capture',
        suggestedType: candidate.suggestedType,
        suggestedAction: 'create_new',
        finalDecision: 'saved_reference',
        overrideApplied: true,
        correctedFields: [],
      }),
    }));
  },
  ingestIntakeFiles: async (files, source = 'drop') => {
    if (!files.length) return;
    const state = get();
    const batch = buildBatchRecord([]);
    const parsedAssetGroups = await Promise.all(files.map((file) => parseIntakeFile(file, batch.id)));
    const assets = parsedAssetGroups.flat().map((asset) => ({ ...asset, source }));
    const candidates = assets.flatMap((asset) => buildCandidatesFromAsset(asset, state.items, state.tasks));
    const assetIds = assets.filter((asset) => !asset.parentAssetId).map((asset) => asset.id);
    const finalizedBatch: IntakeBatchRecord = {
      ...batch,
      assetIds,
      status: assets.some((asset) => asset.parseStatus === 'failed') ? 'review' : 'review',
      stats: {
        filesProcessed: assets.length,
        candidatesCreated: candidates.length,
        highConfidence: candidates.filter((candidate) => candidate.confidence >= 0.9).length,
        failedParses: assets.filter((asset) => asset.parseStatus === 'failed').length,
        duplicatesFlagged: candidates.filter((candidate) => candidate.duplicateMatches.length > 0).length,
      },
    };

    set((inner) => ({
      intakeAssets: [...assets, ...inner.intakeAssets],
      intakeWorkCandidates: [...candidates, ...inner.intakeWorkCandidates],
      intakeBatches: [finalizedBatch, ...inner.intakeBatches],
    }));
    queuePersist(get, set);
  },
  updateIntakeWorkCandidate: (candidateId, patch) => {
    set((state) => ({
      intakeWorkCandidates: state.intakeWorkCandidates.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        const editKeys: IntakeReviewerFeedbackField[] = [];
        if (patch.title !== undefined && patch.title !== candidate.title) editKeys.push('title');
        if (patch.project !== undefined && patch.project !== candidate.project) editKeys.push('project');
        if (patch.owner !== undefined && patch.owner !== candidate.owner) editKeys.push('owner');
        if (patch.assignee !== undefined && patch.assignee !== candidate.assignee) editKeys.push('assignee');
        if (patch.dueDate !== undefined && patch.dueDate !== candidate.dueDate) editKeys.push('dueDate');
        if (patch.priority !== undefined && patch.priority !== candidate.priority) editKeys.push('priority');
        if (patch.waitingOn !== undefined && patch.waitingOn !== candidate.waitingOn) editKeys.push('waitingOn');
        if (patch.nextStep !== undefined && patch.nextStep !== candidate.nextStep) editKeys.push('nextStep');
        if (patch.summary !== undefined && patch.summary !== candidate.summary) editKeys.push('summary');
        if (patch.candidateType !== undefined && patch.candidateType !== candidate.candidateType) editKeys.push('type');
        const nextEdits = [...new Set([...(candidate.reviewEdits ?? []), ...editKeys])] as IntakeWorkCandidate['reviewEdits'];
        return { ...candidate, ...patch, reviewEdits: nextEdits, updatedAt: todayIso() };
      }),
    }));
    queuePersist(get, set);
  },
  decideIntakeWorkCandidate: (candidateId, decision, linkedRecordId, options) => {
    const state = get();
    const candidate = state.intakeWorkCandidates.find((entry) => entry.id === candidateId);
    if (!candidate) return;

    if (decision === 'reject') {
      set((inner) => ({
        intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'rejected', updatedAt: todayIso() } : entry),
        intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
          source: 'universal_intake',
          candidateId: candidate.id,
          candidateKind: 'intake_work',
          sourceAssetId: candidate.assetId,
          suggestedType: candidate.candidateType,
          suggestedAction: candidate.suggestedAction,
          finalDecision: 'rejected',
          overrideApplied: true,
          correctedFields: candidate.reviewEdits ?? [],
        }),
      }));
      queuePersist(get, set);
      return;
    }

    if (decision === 'reference') {
      state.addIntakeDocument({
        name: candidate.title,
        kind: 'Text',
        project: candidate.project,
        owner: candidate.owner,
        sourceRef: `Intake asset ${candidate.assetId}`,
        notes: candidate.summary,
        tags: ['intake', 'reference'],
      });
      set((inner) => ({
        intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'reference', updatedAt: todayIso() } : entry),
        intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
          source: 'universal_intake',
          candidateId: candidate.id,
          candidateKind: 'intake_work',
          sourceAssetId: candidate.assetId,
          suggestedType: candidate.candidateType,
          suggestedAction: candidate.suggestedAction,
          finalDecision: 'saved_reference',
          overrideApplied: true,
          correctedFields: candidate.reviewEdits ?? [],
        }),
      }));
      queuePersist(get, set);
      return;
    }

    if (decision === 'link' && linkedRecordId) {
      set((inner) => ({
        intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, linkedRecordId, approvalStatus: 'linked', updatedAt: todayIso() } : entry),
        intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
          source: 'universal_intake',
          candidateId: candidate.id,
          candidateKind: 'intake_work',
          sourceAssetId: candidate.assetId,
          suggestedType: candidate.candidateType,
          suggestedAction: candidate.suggestedAction,
          finalDecision: 'linked_existing',
          overrideApplied: true,
          correctedFields: [...(candidate.reviewEdits ?? []), 'linking_decision'],
        }),
      }));
      queuePersist(get, set);
      return;
    }

    const safety = evaluateIntakeImportSafety(candidate);
    if ((decision === 'approve_task' || decision === 'approve_followup') && !safety.safeToCreateNew && !options?.overrideUnsafeCreate) return;

    if (decision === 'approve_task') {
      const id = createId('TSK');
      state.addTask({
        id,
        title: candidate.title,
        project: candidate.project || 'General',
        owner: candidate.owner || 'Unassigned',
        status: 'To do',
        priority: candidate.priority,
        dueDate: candidate.dueDate,
        summary: candidate.summary,
        nextStep: candidate.nextStep || candidate.title,
        notes: `Imported from intake asset ${candidate.assetId}`,
        tags: [...candidate.tags, 'intake'],
        createdAt: todayIso(),
        updatedAt: todayIso(),
        needsCleanup: candidate.confidence < 0.9,
      });
      set((inner) => ({
        intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, createdRecordId: id, approvalStatus: 'imported', updatedAt: todayIso() } : entry),
        intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
          source: 'universal_intake',
          candidateId: candidate.id,
          candidateKind: 'intake_work',
          sourceAssetId: candidate.assetId,
          suggestedType: candidate.candidateType,
          suggestedAction: candidate.suggestedAction,
          finalDecision: 'approved_task',
          overrideApplied: candidate.candidateType !== 'task',
          correctedFields: [...(candidate.reviewEdits ?? []), ...(candidate.candidateType !== 'task' ? (['type'] as IntakeReviewerFeedbackField[]) : [])],
          duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate,
        }),
      }));
      queuePersist(get, set);
      return;
    }

    const followupId = createId();
    state.addItem({
      id: followupId,
      title: candidate.title,
      source: 'Notes',
      project: candidate.project || 'General',
      owner: candidate.owner || 'Unassigned',
      status: 'Needs action',
      priority: candidate.priority,
      dueDate: candidate.dueDate || addDaysIso(todayIso(), 2),
      lastTouchDate: todayIso(),
      nextTouchDate: candidate.dueDate || addDaysIso(todayIso(), 3),
      nextAction: candidate.nextStep || candidate.title,
      summary: candidate.summary,
      tags: [...candidate.tags, 'intake'],
      sourceRef: `Intake asset ${candidate.assetId}`,
      sourceRefs: [`Intake asset ${candidate.assetId}`],
      mergedItemIds: [],
      waitingOn: candidate.waitingOn,
      notes: '',
      timeline: [buildTouchEvent('Created from universal intake review queue.', 'imported')],
      category: 'Coordination',
      owesNextAction: 'Unknown',
      escalationLevel: 'None',
      cadenceDays: 3,
      needsCleanup: candidate.confidence < 0.9,
      cleanupReasons: candidate.confidence < 0.9 ? ['unclear_type'] : [],
    });
    set((inner) => ({
      intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, createdRecordId: followupId, approvalStatus: 'imported', updatedAt: todayIso() } : entry),
      intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, {
        source: 'universal_intake',
        candidateId: candidate.id,
        candidateKind: 'intake_work',
        sourceAssetId: candidate.assetId,
        suggestedType: candidate.candidateType,
        suggestedAction: candidate.suggestedAction,
        finalDecision: 'approved_followup',
        overrideApplied: candidate.candidateType !== 'followup',
        correctedFields: [...(candidate.reviewEdits ?? []), ...(candidate.candidateType !== 'followup' ? (['type'] as IntakeReviewerFeedbackField[]) : [])],
        duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate,
      }),
    }));
    queuePersist(get, set);
  },
  batchApproveHighConfidence: () => {
    const state = get();
    state.intakeWorkCandidates
      .filter((candidate) => candidate.approvalStatus === 'pending' && evaluateIntakeImportSafety(candidate).safeToBatchApprove)
      .forEach((candidate) => {
        const action = candidate.candidateType === 'task' || candidate.candidateType === 'update_existing_task' ? 'approve_task' : 'approve_followup';
        state.decideIntakeWorkCandidate(candidate.id, action);
      });
  },
  confirmFollowUpSent: (id, notes) => {
    set((state) => ({
      items: withItemUpdate(state.items, id, (item) => {
        const receipt: ActionReceipt = { id: createId('ACT'), at: todayIso(), actor: 'Current user', action: 'send_confirmed', confirmed: true, notes };
        return normalizeItem({
          ...item,
          actionState: 'Sent (confirmed)',
          status: 'Waiting on external',
          lastTouchDate: todayIso(),
          nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3),
          lastCompletedAction: 'Sent follow-up (confirmed)',
          lastActionAt: todayIso(),
          actionReceipts: [receipt, ...(item.actionReceipts || [])],
          timeline: [buildTouchEvent('Send confirmed by user in composer.', 'bundle_action'), ...item.timeline],
        });
      }),
    }));
    queuePersist(get, set);
  },

  updateOutlookSettings: (patch) => {
    set((state) => ({
      outlookConnection: {
        ...state.outlookConnection,
        settings: {
          ...state.outlookConnection.settings,
          ...patch,
        },
      },
    }));
    queuePersist(get, set);
  },
  startOutlookAuth: async () => {
    const { outlookConnection } = get();
    if (!outlookConnection.settings.clientId.trim()) {
      set({ outlookConnection: { ...outlookConnection, syncStatus: 'error', lastError: 'Enter a Microsoft app registration client ID first.' } });
      return;
    }
    const graph = await import('../lib/outlookGraph');
    let settings = outlookConnection.settings;
    if (isTauriRuntime()) {
      try {
        const api = await import('@tauri-apps/api/core');
        const redirectUri = await api.invoke<string>('start_outlook_loopback_listener');
        settings = { ...settings, redirectUri };
      } catch (error) {
        set({
          outlookConnection: {
            ...outlookConnection,
            syncStatus: 'error',
            lastError: error instanceof Error ? error.message : 'Failed to start Outlook callback listener.',
          },
        });
        return;
      }
    }
    const { verifier, challenge } = await graph.generatePkcePair();
    const stateToken = graph.generateState();
    const authUrl = graph.buildAuthorizationUrl(settings, stateToken, challenge);
    set({
      outlookConnection: {
        ...outlookConnection,
        settings,
        authSession: {
          pkceVerifier: verifier,
          state: stateToken,
          authUrl,
          startedAt: todayIso(),
        },
        syncStatus: 'auth-ready',
        lastError: undefined,
      },
    });
    queuePersist(get, set);
    if (typeof window !== 'undefined') {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    }
  },
  completeOutlookAuth: async (callbackUrl) => {
    try {
      const current = get().outlookConnection;
      if (!current.authSession) throw new Error('Start the Outlook sign-in first to generate a PKCE session.');
      const graph = await import('../lib/outlookGraph');
      const { code, state } = graph.parseAuthorizationResponse(callbackUrl);
      if (state && state !== current.authSession.state) throw new Error('Returned OAuth state did not match the current sign-in session.');
      const tokens = await graph.exchangeCodeForTokens(current.settings, code, current.authSession.pkceVerifier);
      const profile = await graph.fetchMailboxProfile(tokens.accessToken);
      const nextConnection: OutlookConnectionState = {
        ...current,
        tokens,
        profile,
        mailboxLinked: true,
        authSession: undefined,
        syncStatus: 'connected',
        lastError: undefined,
      };
      set({ outlookConnection: nextConnection });
      queuePersist(get, set);
    } catch (error) {
      set((state) => ({
        outlookConnection: {
          ...state.outlookConnection,
          syncStatus: 'error',
          lastError: error instanceof Error ? error.message : 'Failed to complete Outlook sign-in.',
        },
      }));
      queuePersist(get, set);
    }
  },
  syncOutlookMailbox: async () => {
    try {
      set((state) => ({ outlookConnection: { ...state.outlookConnection, syncStatus: 'syncing', lastError: undefined } }));
      const graph = await import('../lib/outlookGraph');
      const connection = await ensureValidOutlookAccessToken(get().outlookConnection);
      set({ outlookConnection: connection });

      const existingMessages = get().outlookMessages;
      const syncFolders: Array<'inbox' | 'sentitems'> = connection.settings.autoPullSent ? ['inbox', 'sentitems'] : ['inbox'];
      let usedDelta = true;
      let workingMessages = [...existingMessages];
      const nextCursor = { ...connection.syncCursorByFolder };

      for (const folder of syncFolders) {
        const folderState = connection.syncCursorByFolder[folder] ?? {};
        const result = await graph.fetchDeltaMessages(
          connection.tokens!.accessToken,
          folder,
          connection.settings.syncLimit,
          folderState.deltaLink,
        );
        usedDelta = usedDelta && result.usedDelta;
        const folderMap = new Map<string, OutlookMessage>(workingMessages.filter((entry) => entry.folder === folder).map((entry) => [entry.id, entry]));
        result.messages.forEach((message) => folderMap.set(message.id, message));
        result.removedIds.forEach((messageId) => folderMap.delete(messageId));

        const otherFolders = workingMessages.filter((entry) => entry.folder !== folder);
        const mergedFolder = Array.from(folderMap.values())
          .sort((a, b) => {
            const aAt = new Date(a.receivedDateTime ?? a.sentDateTime ?? 0).getTime();
            const bAt = new Date(b.receivedDateTime ?? b.sentDateTime ?? 0).getTime();
            return bAt - aAt;
          })
          .slice(0, Math.max(connection.settings.syncLimit * 2, 30));
        workingMessages = [...otherFolders, ...mergedFolder];
        nextCursor[folder] = {
          deltaLink: result.deltaLink ?? folderState.deltaLink,
          lastFolderSyncAt: todayIso(),
          lastMessageCount: mergedFolder.length,
        };
      }

      if (!connection.settings.autoPullSent) nextCursor.sentitems = connection.syncCursorByFolder.sentitems ?? {};

      const deduped = workingMessages.reduce<OutlookMessage[]>((acc, message) => {
        if (acc.some((entry) => entry.id === message.id)) return acc;
        acc.push(message);
        return acc;
      }, []).sort((a, b) => {
        const aAt = new Date(a.receivedDateTime ?? a.sentDateTime ?? 0).getTime();
        const bAt = new Date(b.receivedDateTime ?? b.sentDateTime ?? 0).getTime();
        return bAt - aAt;
      });

      const syncedConnection: OutlookConnectionState = {
        ...connection,
        syncStatus: 'connected',
        mailboxLinked: true,
        lastSyncAt: todayIso(),
        lastError: undefined,
        syncCursorByFolder: nextCursor,
        lastSyncMode: usedDelta ? 'delta' : 'initial',
      };

      set({
        outlookConnection: syncedConnection,
        outlookMessages: deduped,
      });
      queuePersist(get, set);
    } catch (error) {
      set((state) => ({
        outlookConnection: {
          ...state.outlookConnection,
          syncStatus: 'error',
          lastError: error instanceof Error ? error.message : 'Mailbox sync failed.',
        },
      }));
      queuePersist(get, set);
    }
  },
  importOutlookMessage: (messageId) => {
    const message = get().outlookMessages.find((entry) => entry.id === messageId);
    if (!message) return;
    const state = get();
    const openConflict = state.items.some((item) => item.status !== 'Closed' && item.threadKey && message.conversationId && item.threadKey === message.conversationId);
    if (openConflict) return;

    const item = buildFollowUpFromOutlookImport(message, 'Jared', 'General');
    set((inner) => {
      const items = normalizeItems([item, ...inner.items]);
      return {
        items,
        selectedId: item.id,
        duplicateReviews: refreshDuplicates(items, inner.dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  disconnectOutlook: () => {
    if (isTauriRuntime()) {
      import('@tauri-apps/api/core').then((api) => api.invoke('clear_outlook_loopback_callback')).catch(() => undefined);
    }
    set({ outlookConnection: defaultOutlookConnection, outlookMessages: [] });
    queuePersist(get, set);
  },
  clearOutlookError: () => set((state) => ({ outlookConnection: { ...state.outlookConnection, lastError: undefined, syncStatus: state.outlookConnection.mailboxLinked ? 'connected' : 'idle' } })),
  ingestForwardedEmailPayload: (payload) => {
    const record = parseForwardedProviderPayload(payload);
    set((state) => {
      const route = routeForwardedEmail(record, {
        rules: state.forwardedRules,
        ledger: state.forwardedLedger,
        items: state.items,
        tasks: state.tasks,
        candidates: state.forwardedCandidates,
        internalDomains: ['followuphq.com'],
      });
      let items = state.items;
      let tasks = state.tasks;
      let intakeDocuments = state.intakeDocuments;
      let createdTaskId: string | undefined;
      let createdFollowUpId: string | undefined;
      let candidate = state.forwardedCandidates;

      const owner = route.ruleOwner ?? record.parsedCommandHints.owner ?? 'Jared';
      const project = route.ruleProject ?? record.parsedCommandHints.project ?? record.parsedProjectHints[0] ?? 'General';

      if (route.decision === 'auto-task') {
        const task = buildTaskFromForwarded(record, owner, project);
        tasks = normalizeTasks([task, ...state.tasks]);
        createdTaskId = task.id;
      } else if (route.decision === 'auto-followup') {
        const item = buildFollowUpFromForwarded(record, owner, project);
        items = normalizeItems([item, ...state.items]);
        createdFollowUpId = item.id;
      } else if (route.decision === 'review') {
        const alreadyQueued = state.forwardedCandidates.some(
          (entry) =>
            entry.forwardedEmailId === record.id ||
            (
              entry.normalizedSubject === record.normalizedSubject &&
              entry.originalSender.toLowerCase() === record.originalSender.toLowerCase() &&
              entry.status === 'pending'
            )
        );
        if (!alreadyQueued) {
          candidate = [buildForwardingCandidate(record, route), ...state.forwardedCandidates];
        }
      } else if (route.decision === 'reference') {
        intakeDocuments = [
          {
            id: createId('DOC'),
            name: record.originalSubject || 'Forwarded email reference',
            kind: 'Text',
            disposition: 'Reference only',
            project,
            owner,
            sourceRef: `Forwarded/${record.id}`,
            uploadedAt: todayIso(),
            notes: record.bodyText.slice(0, 600),
            tags: ['Forwarded Intake', 'Reference'],
          },
          ...state.intakeDocuments,
        ];
      }

      return {
        items,
        tasks,
        intakeDocuments,
        forwardedEmails: [record, ...state.forwardedEmails].slice(0, 500),
        forwardedCandidates: candidate,
        forwardedLedger: [
          buildForwardedLedgerEntry(record, route, {
            taskId: createdTaskId,
            followUpId: createdFollowUpId,
          }),
          ...state.forwardedLedger,
        ].slice(0, 1000),
        forwardedRoutingAudit: [
          buildForwardingAudit(record, route, {
            taskId: createdTaskId,
            followUpId: createdFollowUpId,
          }),
          ...state.forwardedRoutingAudit,
        ].slice(0, 1000),
        duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },

  approveForwardedCandidate: (candidateId, asType, options) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate || candidate.status !== 'pending') return state;

      const record = state.forwardedEmails.find((entry) => entry.id === candidate.forwardedEmailId);
      if (!record) return state;

      const type = asType ?? (candidate.suggestedType === 'followup' ? 'followup' : 'task');
      const safety = evaluateForwardedImportSafety(candidate);
      if (!safety.safeToCreateNew && !options?.overrideUnsafeCreate) return state;
      const ruleIds = state.forwardedRoutingAudit.find((entry) => entry.forwardedEmailId === candidate.forwardedEmailId)?.ruleIds ?? [];

      if (type === 'task') {
        const task = buildTaskFromForwarded(
          record,
          record.parsedCommandHints.owner ?? 'Jared',
          candidate.parsedProject ?? 'General',
        );

        return {
          tasks: normalizeTasks([task, ...state.tasks]),
          forwardedCandidates: state.forwardedCandidates.map((entry) =>
            entry.id === candidateId
              ? { ...entry, status: 'approved', createdTaskId: task.id, updatedAt: todayIso() }
              : entry
          ),
          intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
            source: 'forwarding',
            candidateId: candidate.id,
            candidateKind: 'forwarded',
            forwardedEmailId: candidate.forwardedEmailId,
            suggestedType: candidate.suggestedType,
            suggestedAction: 'create_new',
            finalDecision: 'approved_task',
            overrideApplied: candidate.suggestedType !== 'task',
            correctedFields: candidate.suggestedType !== 'task' ? ['type'] : [],
            duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate,
            ruleIds,
          }),
        };
      }

      const item = buildFollowUpFromForwarded(
        record,
        record.parsedCommandHints.owner ?? 'Jared',
        candidate.parsedProject ?? 'General',
      );
      const items = normalizeItems([item, ...state.items]);
      return {
        items,
        duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs),
        forwardedCandidates: state.forwardedCandidates.map((entry) =>
          entry.id === candidateId
            ? { ...entry, status: 'approved', createdFollowUpId: item.id, updatedAt: todayIso() }
            : entry
        ),
        intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
          source: 'forwarding',
          candidateId: candidate.id,
          candidateKind: 'forwarded',
          forwardedEmailId: candidate.forwardedEmailId,
          suggestedType: candidate.suggestedType,
          suggestedAction: 'create_new',
          finalDecision: 'approved_followup',
          overrideApplied: candidate.suggestedType !== 'followup',
          correctedFields: candidate.suggestedType !== 'followup' ? ['type'] : [],
          duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate,
          ruleIds,
        }),
      };
    });
    queuePersist(get, set);
  },
  rejectForwardedCandidate: (candidateId) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate) return state;
      const ruleIds = state.forwardedRoutingAudit.find((entry) => entry.forwardedEmailId === candidate.forwardedEmailId)?.ruleIds ?? [];
      return {
        forwardedCandidates: state.forwardedCandidates.map((entry) =>
          entry.id === candidateId
            ? { ...entry, status: 'rejected', updatedAt: todayIso() }
            : entry
        ),
        intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
          source: 'forwarding',
          candidateId: candidate.id,
          candidateKind: 'forwarded',
          forwardedEmailId: candidate.forwardedEmailId,
          suggestedType: candidate.suggestedType,
          suggestedAction: 'create_new',
          finalDecision: 'rejected',
          overrideApplied: true,
          correctedFields: [],
          ruleIds,
        }),
      };
    });
    queuePersist(get, set);
  },

  saveForwardedCandidateAsReference: (candidateId) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate) return state;
      const ruleIds = state.forwardedRoutingAudit.find((entry) => entry.forwardedEmailId === candidate.forwardedEmailId)?.ruleIds ?? [];
      return {
        forwardedCandidates: state.forwardedCandidates.map((entry) =>
          entry.id === candidateId
            ? { ...entry, status: 'reference', updatedAt: todayIso() }
            : entry
        ),
        intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
          source: 'forwarding',
          candidateId: candidate.id,
          candidateKind: 'forwarded',
          forwardedEmailId: candidate.forwardedEmailId,
          suggestedType: candidate.suggestedType,
          suggestedAction: 'create_new',
          finalDecision: 'saved_reference',
          overrideApplied: candidate.suggestedType !== 'reference',
          correctedFields: [],
          ruleIds,
        }),
      };
    });
    queuePersist(get, set);
  },

  linkForwardedCandidateToExisting: (candidateId, itemId) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate) return state;
      const ruleIds = state.forwardedRoutingAudit.find((entry) => entry.forwardedEmailId === candidate.forwardedEmailId)?.ruleIds ?? [];
      return {
        forwardedCandidates: state.forwardedCandidates.map((entry) =>
          entry.id === candidateId
            ? { ...entry, status: 'linked', linkedItemId: itemId, updatedAt: todayIso() }
            : entry
        ),
        intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, {
          source: 'forwarding',
          candidateId: candidate.id,
          candidateKind: 'forwarded',
          forwardedEmailId: candidate.forwardedEmailId,
          suggestedType: candidate.suggestedType,
          suggestedAction: 'create_new',
          finalDecision: 'linked_existing',
          overrideApplied: true,
          correctedFields: ['linking_decision'],
          ruleIds,
        }),
      };
    });
    queuePersist(get, set);
  },

  addForwardRuleFromCandidate: (candidateId, action) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate) return state;

      const rule: ForwardedEmailRule = {
        id: createId('FWR'),
        name: `From candidate: ${candidate.normalizedSubject.slice(0, 40)}`,
        enabled: true,
        priority: (state.forwardedRules.at(-1)?.priority ?? 100) + 10,
        source: 'user',
        conditions: {
          forwardingAlias: candidate.forwardingAlias,
          senderEmailContains: candidate.originalSender,
          subjectContains: candidate.normalizedSubject.slice(0, 20),
        },
        action,
        createdAt: todayIso(),
        updatedAt: todayIso(),
      };
      return { forwardedRules: [...state.forwardedRules, rule] };
    });
    queuePersist(get, set);
  },

  addManualForwardRule: (ruleInput) => {
    set((state) => ({
      forwardedRules: [
        ...state.forwardedRules,
        {
          ...ruleInput,
          id: createId('FWR'),
          source: 'user',
          createdAt: todayIso(),
          updatedAt: todayIso(),
        },
      ],
    }));
    queuePersist(get, set);
  },

  updateForwardRule: (ruleId, patch) => {
    set((state) => ({
      forwardedRules: state.forwardedRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, ...patch, updatedAt: todayIso() }
          : rule
      ),
    }));
    queuePersist(get, set);
  },

  deleteForwardRule: (ruleId) => {
    set((state) => ({
      forwardedRules: state.forwardedRules.filter((rule) => rule.id !== ruleId),
    }));
    queuePersist(get, set);
  },
}));

export const useAppStoreShallow = useShallow;
