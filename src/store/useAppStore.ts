import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { detectDuplicateReviews, buildPairKey } from '../lib/duplicateDetection';
import { buildFollowUpFromDroppedEmail } from '../lib/emailDrop';
import { appendRunningNote, buildDraftText, buildTouchEvent, createId, normalizeItem, resolveProjectName, todayIso, addDaysIso } from '../lib/utils';
import { isTauriRuntime, loadSnapshot, saveSnapshot } from '../lib/persistence';
import { getDefaultOutlookSettings } from '../lib/outlookGraph';
import { parseForwardedProviderPayload } from '../lib/forwardedEmailParser';
import { buildForwardingAudit, buildForwardingCandidate, buildForwardedLedgerEntry, buildTaskFromForwarded, routeForwardedEmail } from '../lib/intakeRouting';
import { getDefaultForwardedRules } from '../lib/intakeRules';
import { starterCompanies, starterContacts, starterIntakeDocuments, starterItems, starterProjects, starterSignals, starterTasks } from '../lib/sample-data';
import type {
  AppSnapshot,
  CompanyRecord,
  ContactRecord,
  DroppedEmailImport,
  DuplicateReview,
  FollowUpItem,
  FollowUpStatus,
  ImportPreviewRow,
  IntakeDocumentDisposition,
  IntakeDocumentKind,
  IntakeDocumentRecord,
  MergeDraft,
  OutlookConnectionSettings,
  OutlookConnectionState,
  OutlookMessage,
  PersistenceMode,
  ProjectRecord,
  SavedViewKey,
  TaskItem,
  TaskStatus,
  TimelineEvent,
  ForwardedEmailRecord,
  ForwardedEmailRule,
  ForwardedIntakeCandidate,
  ForwardedIngestionLedgerEntry,
  ForwardedRoutingAuditEntry,
  ForwardedEmailProviderPayload,
  ForwardedRuleAction,
} from '../types';

interface ItemModalState {
  open: boolean;
  mode: 'create' | 'edit';
  itemId: string | null;
}

interface MergeModalState {
  open: boolean;
  baseId: string | null;
  candidateId: string | null;
}

interface DraftModalState {
  open: boolean;
  itemId: string | null;
}

interface TaskModalState {
  open: boolean;
  mode: 'create' | 'edit';
  taskId: string | null;
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
  itemModal: ItemModalState;
  touchModalOpen: boolean;
  importModalOpen: boolean;
  mergeModal: MergeModalState;
  draftModal: DraftModalState;
  taskModal: TaskModalState;
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
  initializeApp: () => Promise<void>;
  setSelectedId: (id: string) => void;
  setSearch: (value: string) => void;
  setProjectFilter: (value: string) => void;
  setStatusFilter: (value: 'All' | FollowUpStatus) => void;
  setActiveView: (value: SavedViewKey) => void;
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
  openEditTaskModal: (id: string) => void;
  closeTaskModal: () => void;
  updateItem: (id: string, patch: Partial<FollowUpItem>) => void;
  addItem: (item: FollowUpItem) => void;
  deleteItem: (id: string) => void;
  addTouchLog: (payload: { id: string; summary: string; status?: FollowUpStatus; dueDate?: string; nextTouchDate?: string; promisedDate?: string; waitingOn?: string }) => void;
  addRunningNote: (id: string, note: string) => void;
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, patch: Partial<TaskItem>) => void;
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
  updateDraftForItem: (id: string, draft: string) => void;
  generateDraftForItem: (id: string) => void;
  addProject: (input: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateProject: (id: string, patch: Partial<ProjectRecord>) => void;
  deleteProject: (id: string) => void;
  addIntakeDocument: (input: { name: string; kind: IntakeDocumentKind; projectId?: string; project?: string; owner?: string; sourceRef?: string; notes?: string; tags?: string[] }) => string;
  updateIntakeDocument: (id: string, patch: Partial<IntakeDocumentRecord>) => void;
  setIntakeDocumentDisposition: (id: string, disposition: IntakeDocumentDisposition, linkedFollowUpId?: string) => void;
  deleteIntakeDocument: (id: string) => void;
  addContact: (input: Omit<ContactRecord, 'id'>) => string;
  updateContact: (id: string, patch: Partial<ContactRecord>) => void;
  deleteContact: (id: string) => void;
  addCompany: (input: Omit<CompanyRecord, 'id'>) => string;
  updateCompany: (id: string, patch: Partial<CompanyRecord>) => void;
  deleteCompany: (id: string) => void;
  updateOutlookSettings: (patch: Partial<OutlookConnectionSettings>) => void;
  startOutlookAuth: () => Promise<void>;
  completeOutlookAuth: (callbackUrl: string) => Promise<void>;
  syncOutlookMailbox: () => Promise<void>;
  importOutlookMessage: (messageId: string) => void;
  disconnectOutlook: () => void;
  clearOutlookError: () => void;
  ingestForwardedEmailPayload: (payload: ForwardedEmailProviderPayload) => void;
  approveForwardedCandidate: (candidateId: string, asType?: 'task' | 'followup') => void;
  rejectForwardedCandidate: (candidateId: string) => void;
  saveForwardedCandidateAsReference: (candidateId: string) => void;
  linkForwardedCandidateToExisting: (candidateId: string, itemId: string) => void;
  addForwardRuleFromCandidate: (candidateId: string, action: ForwardedRuleAction) => void;
  addManualForwardRule: (rule: Omit<ForwardedEmailRule, 'id' | 'createdAt' | 'updatedAt' | 'source'>) => void;
  updateForwardRule: (ruleId: string, patch: Partial<ForwardedEmailRule>) => void;
  deleteForwardRule: (ruleId: string) => void;
}

const defaultOutlookConnection: OutlookConnectionState = {
  settings: getDefaultOutlookSettings(),
  mailboxLinked: false,
  syncStatus: 'idle',
  syncCursorByFolder: { inbox: {}, sentitems: {} },
};

function normalizeItems(items: FollowUpItem[]): FollowUpItem[] {
  return items.map(normalizeItem).sort((a, b) => new Date(b.lastTouchDate).getTime() - new Date(a.lastTouchDate).getTime());
}

function normalizeTask(task: TaskItem): TaskItem {
  const status = task.status || 'To do';
  const updatedAt = todayIso();
  return {
    ...task,
    project: (task.project || 'General').trim() || 'General',
    owner: (task.owner || 'Unassigned').trim() || 'Unassigned',
    title: task.title.trim(),
    summary: (task.summary || '').trim(),
    nextStep: (task.nextStep || '').trim(),
    notes: (task.notes || '').trim(),
    tags: [...new Set((task.tags || []).map((tag) => tag.trim()).filter(Boolean))],
    dueDate: task.dueDate || undefined,
    startDate: task.startDate || undefined,
    linkedFollowUpId: task.linkedFollowUpId || undefined,
    contactId: task.contactId || undefined,
    companyId: task.companyId || undefined,
    status,
    completedAt: status === 'Done' ? (task.completedAt || updatedAt) : undefined,
    createdAt: task.createdAt || updatedAt,
    updatedAt,
  };
}

function normalizeTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks.map(normalizeTask).sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (a.status === 'Done' && b.status !== 'Done') return 1;
    if (a.status !== 'Done' && b.status === 'Done') return -1;
    return aDue - bDue || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function stampProject(project: ProjectRecord, patch: Partial<ProjectRecord> = {}): ProjectRecord {
  return { ...project, ...patch, updatedAt: todayIso() };
}

function deriveProjects(items: FollowUpItem[], existing: ProjectRecord[] = []): ProjectRecord[] {
  const byId = new Map(existing.map((project) => [project.id, project]));
  const byName = new Map(existing.map((project) => [project.name.toLowerCase(), project]));
  items.forEach((item) => {
    const name = (item.project || 'General').trim() || 'General';
    const existingById = item.projectId ? byId.get(item.projectId) : undefined;
    const existingByName = byName.get(name.toLowerCase());
    if (existingById) {
      byId.set(existingById.id, stampProject(existingById, { name, owner: item.owner || existingById.owner }));
      byName.set(name.toLowerCase(), byId.get(existingById.id)!);
      return;
    }
    if (existingByName) {
      byId.set(existingByName.id, stampProject(existingByName, { owner: existingByName.owner || item.owner || 'Unassigned' }));
      return;
    }
    const created = {
      id: createId('PRJ'),
      name,
      owner: item.owner || 'Unassigned',
      status: name === 'General' ? 'Active' : 'Active',
      notes: '',
      tags: [],
      createdAt: todayIso(),
      updatedAt: todayIso(),
    } satisfies ProjectRecord;
    byId.set(created.id, created);
    byName.set(name.toLowerCase(), created);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function attachProjects(items: FollowUpItem[], projects: ProjectRecord[]): FollowUpItem[] {
  return normalizeItems(items.map((item) => {
    const name = resolveProjectName(item.projectId, item.project, projects);
    const project = item.projectId ? projects.find((entry) => entry.id === item.projectId) : projects.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    return normalizeItem({ ...item, projectId: project?.id ?? item.projectId, project: project?.name ?? name });
  }));
}

function applyItemRules(item: FollowUpItem): FollowUpItem {
  const cadenceDays = item.cadenceDays && item.cadenceDays > 0 ? item.cadenceDays : item.status === 'Waiting on external' ? 3 : item.status === 'At risk' ? 1 : 4;
  const nextTouchDate = item.nextTouchDate || addDaysIso(item.lastTouchDate || todayIso(), cadenceDays);
  const escalationLevel = item.status === 'At risk' && item.escalationLevel === 'None' ? 'Watch' : item.escalationLevel;
  const owesNextAction = item.status === 'Waiting on external' && item.owesNextAction === 'Unknown' ? 'Client' : item.owesNextAction;
  return normalizeItem({ ...item, cadenceDays, nextTouchDate, escalationLevel, owesNextAction });
}

function syncProjectNamePatch(patch: Partial<FollowUpItem>, projects: ProjectRecord[]): Partial<FollowUpItem> {
  const projectName = resolveProjectName(patch.projectId, patch.project, projects);
  return { ...patch, project: projectName };
}

function refreshDuplicates(items: FollowUpItem[], dismissedDuplicatePairs: string[]): DuplicateReview[] {
  return detectDuplicateReviews(items, dismissedDuplicatePairs);
}

function buildSnapshot(state: Pick<AppState, 'items' | 'contacts' | 'companies' | 'projects' | 'tasks' | 'intakeSignals' | 'intakeDocuments' | 'dismissedDuplicatePairs' | 'droppedEmailImports' | 'outlookConnection' | 'outlookMessages' | 'forwardedEmails' | 'forwardedRules' | 'forwardedCandidates' | 'forwardedLedger' | 'forwardedRoutingAudit'>): AppSnapshot {
  return {
    items: state.items,
    contacts: state.contacts,
    companies: state.companies,
    projects: state.projects,
    tasks: state.tasks,
    intakeSignals: state.intakeSignals,
    intakeDocuments: state.intakeDocuments,
    dismissedDuplicatePairs: state.dismissedDuplicatePairs,
    droppedEmailImports: state.droppedEmailImports,
    outlookConnection: state.outlookConnection,
    outlookMessages: state.outlookMessages,
    forwardedEmails: state.forwardedEmails,
    forwardedRules: state.forwardedRules,
    forwardedCandidates: state.forwardedCandidates,
    forwardedLedger: state.forwardedLedger,
    forwardedRoutingAudit: state.forwardedRoutingAudit,
  };
}

function queuePersist(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  set({ syncState: 'saving', saveError: '' });
  const snapshot = buildSnapshot(get());
  void saveSnapshot(snapshot)
    .then((mode) => set({ persistenceMode: mode, saveError: '', syncState: 'saved', lastSyncedAt: todayIso() }))
    .catch((error) => set({ saveError: error instanceof Error ? error.message : 'Failed to save data.', syncState: 'error' }));
}

function withItemUpdate(items: FollowUpItem[], id: string, updater: (item: FollowUpItem) => FollowUpItem): FollowUpItem[] {
  return normalizeItems(items.map((item) => (item.id === id ? updater(item) : item)));
}



function buildFollowUpFromForwarded(record: ForwardedEmailRecord, owner = 'Jared', project = 'General', projectId?: string): FollowUpItem {
  return normalizeItem({
    id: createId(),
    title: record.originalSubject || '(no subject)',
    source: 'Email',
    project,
    projectId,
    owner,
    status: record.parsedCommandHints.type === 'followup' ? 'Waiting on external' : 'Needs action',
    priority: (record.parsedCommandHints.priority as FollowUpItem['priority']) ?? 'Medium',
    dueDate: record.parsedCommandHints.dueDate ?? addDaysIso(todayIso(), 2),
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(todayIso(), 1),
    nextAction: record.parsedCommandHints.type === 'followup' ? `Follow up with ${record.parsedCommandHints.waitingOn ?? record.originalSender}` : 'Review forwarded email and assign next action.',
    summary: record.bodyText.slice(0, 280),
    tags: ['Forwarded Intake', ...record.parsedCommandHints.tags],
    sourceRef: `Forwarded/${record.id}`,
    sourceRefs: [`Forwarded/${record.id}`, ...record.sourceMessageIdentifiers],
    mergedItemIds: [],
    waitingOn: record.parsedCommandHints.waitingOn,
    notes: [`Forwarded alias: ${record.forwardingAlias}`, `Sender: ${record.originalSender}`].join('\n'),
    timeline: [buildTouchEvent('Created from forwarded email intake.', 'imported')],
    category: 'Coordination',
    owesNextAction: record.parsedCommandHints.type === 'followup' ? 'Client' : 'Internal',
    escalationLevel: 'None',
    cadenceDays: 3,
    draftFollowUp: '',
  });
}
function buildImportedItem(row: ImportPreviewRow): FollowUpItem {
  return normalizeItem({
    id: createId(),
    title: row.title,
    source: row.source,
    project: row.project,
    projectId: row.projectId,
    owner: row.owner,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(row.dueDate, -1),
    nextAction: row.nextAction,
    summary: row.summary,
    tags: row.tags,
    sourceRef: row.sourceRef,
    sourceRefs: [row.sourceRef],
    mergedItemIds: [],
    waitingOn: undefined,
    notes: row.notes,
    timeline: [buildTouchEvent('Imported through the CSV / Excel intake wizard.', 'imported')],
    category: row.source === 'Excel' ? 'Issue' : row.source === 'Email' ? 'Coordination' : 'General',
    owesNextAction: row.source === 'Excel' ? 'Internal' : 'Unknown',
    escalationLevel: row.priority === 'Critical' ? 'Critical' : 'None',
    cadenceDays: 3,
    draftFollowUp: '',
  });
}

function nextEscalation(current: FollowUpItem['escalationLevel']): FollowUpItem['escalationLevel'] {
  switch (current) {
    case 'None':
      return 'Watch';
    case 'Watch':
      return 'Escalate';
    case 'Escalate':
      return 'Critical';
    default:
      return 'None';
  }
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



function buildFollowUpFromOutlookImport(message: OutlookMessage, owner: string, project: string, projectId?: string): FollowUpItem {
  const dueDateBase = message.receivedDateTime ?? message.sentDateTime ?? todayIso();
  return normalizeItem({
    id: createId(),
    title: message.subject || '(no subject)',
    source: 'Email',
    project,
    projectId,
    owner,
    status: message.folder === 'sentitems' ? 'Waiting on external' : 'Needs action',
    priority: message.flagStatus === 'flagged' || message.importance === 'high' ? 'High' : 'Medium',
    dueDate: dueDateBase,
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(todayIso(), 2),
    nextAction: message.folder === 'sentitems' ? 'Review thread status and send a follow-up if no reply has come in.' : 'Read the message and assign ownership.',
    summary: message.bodyPreview,
    tags: ['Outlook', message.folder === 'sentitems' ? 'Sent' : 'Inbox', ...(message.categories ?? [])],
    sourceRef: message.sourceRef,
    sourceRefs: [message.sourceRef, message.webLink ?? '', message.conversationId ?? '', message.internetMessageId ?? ''].filter(Boolean),
    mergedItemIds: [],
    waitingOn: message.folder === 'sentitems' ? message.toRecipients[0] || 'Email response' : undefined,
    notes: [`Outlook conversation: ${message.conversationId ?? 'n/a'}`, `From: ${message.from}`].join('\n'),
    timeline: [buildTouchEvent('Created from Outlook mailbox import.', 'imported')],
    category: 'Coordination',
    owesNextAction: message.folder === 'sentitems' ? 'Client' : 'Internal',
    escalationLevel: 'None',
    cadenceDays: 3,
    threadKey: message.conversationId,
    draftFollowUp: '',
  });
}

export const useAppStore = create<AppState>()((set, get) => ({
  items: [],
  contacts: [],
  companies: [],
  projects: [],
  tasks: [],
  intakeSignals: [],
  intakeDocuments: [],
  dismissedDuplicatePairs: [],
  selectedId: null,
  search: '',
  projectFilter: 'All',
  statusFilter: 'All',
  activeView: 'All',
  itemModal: { open: false, mode: 'create', itemId: null },
  touchModalOpen: false,
  importModalOpen: false,
  mergeModal: { open: false, baseId: null, candidateId: null },
  draftModal: { open: false, itemId: null },
  taskModal: { open: false, mode: 'create', taskId: null },
  selectedTaskId: null,
  taskOwnerFilter: 'All',
  taskStatusFilter: 'All',
  hydrated: false,
  persistenceMode: 'loading',
  saveError: '',
  syncState: 'checking',
  lastSyncedAt: undefined,
  duplicateReviews: [],
  outlookConnection: defaultOutlookConnection,
  outlookMessages: [],
  droppedEmailImports: [],
  forwardedEmails: [],
  forwardedRules: getDefaultForwardedRules(),
  forwardedCandidates: [],
  forwardedLedger: [],
  forwardedRoutingAudit: [],
  initializeApp: async () => {
    if (get().hydrated) return;
    try {
      const { snapshot, mode } = await loadSnapshot();
      const hasItems = Object.prototype.hasOwnProperty.call(snapshot, 'items');
      const hasContacts = Object.prototype.hasOwnProperty.call(snapshot, 'contacts');
      const hasCompanies = Object.prototype.hasOwnProperty.call(snapshot, 'companies');
      const hasProjects = Object.prototype.hasOwnProperty.call(snapshot, 'projects');
      const hasTasks = Object.prototype.hasOwnProperty.call(snapshot, 'tasks');
      const hasSignals = Object.prototype.hasOwnProperty.call(snapshot, 'intakeSignals');
      const hasDocuments = Object.prototype.hasOwnProperty.call(snapshot, 'intakeDocuments');

      const baseItems = hasItems ? normalizeItems(snapshot.items ?? []) : normalizeItems(starterItems);
      const contacts = hasContacts ? (snapshot.contacts ?? []) : starterContacts;
      const companies = hasCompanies ? (snapshot.companies ?? []) : starterCompanies;
      const projects = deriveProjects(baseItems, hasProjects ? (snapshot.projects ?? []) : starterProjects);
      const items = attachProjects(baseItems, projects);
      const tasks = normalizeTasks((hasTasks ? (snapshot.tasks ?? []) : starterTasks).map((task) => ({ ...task, project: resolveProjectName(task.projectId, task.project, projects) })));
      const intakeSignals = hasSignals ? (snapshot.intakeSignals ?? []) : starterSignals;
      const intakeDocuments = (hasDocuments ? (snapshot.intakeDocuments ?? []) : starterIntakeDocuments).map((doc) => ({ ...doc, project: resolveProjectName(doc.projectId, doc.project, projects) }));
      const dismissedDuplicatePairs = snapshot.dismissedDuplicatePairs ?? [];
      const droppedEmailImports = snapshot.droppedEmailImports ?? [];
      const forwardedEmails = snapshot.forwardedEmails ?? [];
      const forwardedRules = snapshot.forwardedRules?.length ? snapshot.forwardedRules : getDefaultForwardedRules();
      const forwardedCandidates = snapshot.forwardedCandidates ?? [];
      const forwardedLedger = snapshot.forwardedLedger ?? [];
      const forwardedRoutingAudit = snapshot.forwardedRoutingAudit ?? [];
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
        saveError: '',
        syncState: 'saved',
        lastSyncedAt: todayIso(),
        outlookConnection: {
          ...defaultOutlookConnection,
          ...(snapshot.outlookConnection ?? {}),
          settings: {
            ...defaultOutlookConnection.settings,
            ...(snapshot.outlookConnection?.settings ?? {}),
          },
          syncCursorByFolder: {
            inbox: snapshot.outlookConnection?.syncCursorByFolder?.inbox ?? {},
            sentitems: snapshot.outlookConnection?.syncCursorByFolder?.sentitems ?? {},
          },
        },
        outlookMessages: snapshot.outlookMessages ?? [],
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
  openCreateModal: () => set({ itemModal: { open: true, mode: 'create', itemId: null } }),
  openEditModal: (id) => set({ itemModal: { open: true, mode: 'edit', itemId: id }, selectedId: id }),
  closeItemModal: () => set({ itemModal: { open: false, mode: 'create', itemId: null } }),
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
  openCreateTaskModal: () => set({ taskModal: { open: true, mode: 'create', taskId: null } }),
  openEditTaskModal: (id) => set({ taskModal: { open: true, mode: 'edit', taskId: id }, selectedTaskId: id }),
  closeTaskModal: () => set({ taskModal: { open: false, mode: 'create', taskId: null } }),
  updateItem: (id, patch) => {
    set((state) => {
      const normalizedPatch = syncProjectNamePatch(patch, state.projects);
      const items = withItemUpdate(state.items, id, (item) => {
        const statusChanged = normalizedPatch.status && normalizedPatch.status !== item.status;
        const dueChanged = normalizedPatch.dueDate && normalizedPatch.dueDate !== item.dueDate;
        const promiseChanged = normalizedPatch.promisedDate !== undefined && normalizedPatch.promisedDate !== item.promisedDate;
        const timeline: TimelineEvent[] = [...item.timeline];
        if (statusChanged) timeline.unshift(buildTouchEvent(`Status changed from ${item.status} to ${normalizedPatch.status}.`, 'status_changed'));
        if (dueChanged) timeline.unshift(buildTouchEvent('Due date updated.', 'touched'));
        if (promiseChanged) timeline.unshift(buildTouchEvent('Promised date updated.', 'touched'));
        return applyItemRules(normalizeItem({ ...item, ...normalizedPatch, timeline }));
      });
      const projects = deriveProjects(items, state.projects);
      return { items: attachProjects(items, projects), projects, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
    });
    queuePersist(get, set);
  },
  addItem: (item) => {
    set((state) => {
      const normalized = applyItemRules(normalizeItem({ ...item, project: resolveProjectName(item.projectId, item.project, state.projects) }));
      const items = normalizeItems([normalized, ...state.items]);
      const projects = deriveProjects(items, state.projects);
      return {
        items: attachProjects(items, projects),
        projects,
        selectedId: normalized.id,
        itemModal: { open: false, mode: 'create', itemId: null },
        duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs),
      };
    });
    queuePersist(get, set);
  },
  deleteItem: (id) => {
    set((state) => {
      const nextItems = normalizeItems(state.items.filter((item) => item.id !== id));
      const projects = deriveProjects(nextItems, state.projects);
      const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(id));
      return {
        items: attachProjects(nextItems, projects),
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
  addTask: (task) => {
    set((state) => {
      const normalized = normalizeTask({ ...task, project: resolveProjectName(task.projectId, task.project, state.projects) });
      const tasks = normalizeTasks([normalized, ...state.tasks]);
      const projects = deriveProjects(state.items, state.projects);
      return { tasks, projects, selectedTaskId: normalized.id, taskModal: { open: false, mode: 'create', taskId: null } };
    });
    queuePersist(get, set);
  },
  updateTask: (id, patch) => {
    set((state) => ({
      tasks: normalizeTasks(state.tasks.map((task) => (task.id === id ? normalizeTask({ ...task, ...patch, project: resolveProjectName(patch.projectId, patch.project, state.projects) }) : task))),
    }));
    queuePersist(get, set);
  },
  deleteTask: (id) => {
    set((state) => {
      const tasks = normalizeTasks(state.tasks.filter((task) => task.id !== id));
      return { tasks, selectedTaskId: state.selectedTaskId === id ? tasks[0]?.id ?? null : state.selectedTaskId, taskModal: state.taskModal.taskId === id ? { open: false, mode: 'create', taskId: null } : state.taskModal };
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
      const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, project: renamedTo } : doc);
      return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, intakeDocuments };
    });
    queuePersist(get, set);
  },
  deleteProject: (id) => {
    set((state) => {
      const general = state.projects.find((project) => project.name === 'General') ?? {
        id: createId('PRJ'),
        name: 'General', owner: 'Unassigned', status: 'Active', notes: '', tags: ['General'], createdAt: todayIso(), updatedAt: todayIso(),
      };
      const existingProjects = state.projects.some((project) => project.id === general.id) ? state.projects : [...state.projects, general];
      const projects = existingProjects.filter((project) => project.id !== id);
      const items = attachProjects(state.items.map((item) => item.projectId === id ? normalizeItem({ ...item, projectId: general.id, project: general.name }) : item), projects);
      const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, projectId: general.id, project: general.name } : doc);
      return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, intakeDocuments };
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
    set((state) => ({ contacts: [{ id, ...input }, ...state.contacts] }));
    queuePersist(get, set);
    return id;
  },
  updateContact: (id, patch) => {
    set((state) => ({ contacts: state.contacts.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)) }));
    queuePersist(get, set);
  },
  deleteContact: (id) => {
    set((state) => ({
      contacts: state.contacts.filter((contact) => contact.id !== id),
      items: withItemUpdate(state.items, '', (item) => item).map((item) => (item.contactId === id ? normalizeItem({ ...item, contactId: undefined }) : item)),
    }));
    queuePersist(get, set);
  },
  addCompany: (input) => {
    const id = createId('CO');
    set((state) => ({ companies: [{ id, ...input }, ...state.companies] }));
    queuePersist(get, set);
    return id;
  },
  updateCompany: (id, patch) => {
    set((state) => ({ companies: state.companies.map((company) => (company.id === id ? { ...company, ...patch } : company)) }));
    queuePersist(get, set);
  },
  deleteCompany: (id) => {
    set((state) => ({
      companies: state.companies.filter((company) => company.id !== id),
      contacts: state.contacts.map((contact) => (contact.companyId === id ? { ...contact, companyId: undefined } : contact)),
      items: state.items.map((item) => (item.companyId === id ? normalizeItem({ ...item, companyId: undefined }) : item)),
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
      let connection = await ensureValidOutlookAccessToken(get().outlookConnection);
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

  approveForwardedCandidate: (candidateId, asType) => {
    set((state) => {
      const candidate = state.forwardedCandidates.find((entry) => entry.id === candidateId);
      if (!candidate || candidate.status !== 'pending') return state;

      const record = state.forwardedEmails.find((entry) => entry.id === candidate.forwardedEmailId);
      if (!record) return state;

      const type = asType ?? (candidate.suggestedType === 'followup' ? 'followup' : 'task');

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
      };
    });
    queuePersist(get, set);
  },
  rejectForwardedCandidate: (candidateId) => {
    set((state) => ({
      forwardedCandidates: state.forwardedCandidates.map((entry) =>
        entry.id === candidateId
          ? { ...entry, status: 'rejected', updatedAt: todayIso() }
          : entry
      ),
    }));
    queuePersist(get, set);
  },

  saveForwardedCandidateAsReference: (candidateId) => {
    set((state) => ({
      forwardedCandidates: state.forwardedCandidates.map((entry) =>
        entry.id === candidateId
          ? { ...entry, status: 'reference', updatedAt: todayIso() }
          : entry
      ),
    }));
    queuePersist(get, set);
  },

  linkForwardedCandidateToExisting: (candidateId, itemId) => {
    set((state) => ({
      forwardedCandidates: state.forwardedCandidates.map((entry) =>
        entry.id === candidateId
          ? { ...entry, status: 'linked', linkedItemId: itemId, updatedAt: todayIso() }
          : entry
      ),
    }));
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
