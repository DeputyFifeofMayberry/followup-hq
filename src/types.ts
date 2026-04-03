export type SourceType = 'Email' | 'Notes' | 'To-do' | 'Excel';

export type FollowUpStatus =
  | 'Needs action'
  | 'Waiting on external'
  | 'Waiting internal'
  | 'In progress'
  | 'At risk'
  | 'Closed';

export type FollowUpPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskStatus = 'To do' | 'In progress' | 'Blocked' | 'Done';
export type TaskWorkflowState = 'ready' | 'blocked' | 'deferred' | 'done';
export type TaskPriority = FollowUpPriority;
export type AppUserRole = 'user' | 'manager' | 'admin';
export type AppMode = 'personal' | 'team';
export type VisibilityScope = 'private' | 'team' | 'company';

export type TimelineEventType =
  | 'created'
  | 'touched'
  | 'status_changed'
  | 'note'
  | 'imported'
  | 'merged'
  | 'nudged'
  | 'snoozed'
  | 'escalated'
  | 'relationship'
  | 'bundle_action'
  | 'cleanup';

export type SavedViewKey =
  | 'All'
  | 'Today'
  | 'Waiting'
  | 'Needs nudge'
  | 'At risk'
  | 'Overdue'
  | 'By project'
  | 'Waiting on others'
  | 'Ready to close'
  | 'Promises due this week'
  | 'Blocked by child tasks';

export type FollowUpDateRange = 'all' | 'overdue' | 'today' | 'this_week' | 'next_7_days';

export interface FollowUpAdvancedFilters {
  project: string;
  status: 'All' | FollowUpStatus;
  assignee: string;
  owner: string;
  waitingOn: string;
  escalation: 'All' | EscalationLevel;
  priority: 'All' | FollowUpPriority;
  actionState: 'All' | ActionLifecycleState;
  category: 'All' | ItemCategory;
  dueDateRange: FollowUpDateRange;
  nextTouchDateRange: FollowUpDateRange;
  promisedDateRange: FollowUpDateRange;
  linkedTaskState: 'all' | 'blocked_child' | 'overdue_child' | 'all_children_done' | 'has_open_children' | 'none';
  cleanupOnly: boolean;
}

export type FollowUpColumnKey =
  | 'title'
  | 'project'
  | 'owner'
  | 'assignee'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'nextTouchDate'
  | 'promisedDate'
  | 'waitingOn'
  | 'escalation'
  | 'actionState'
  | 'linkedTaskSummary'
  | 'nextAction';

export interface SavedFollowUpCustomView {
  id: string;
  name: string;
  search: string;
  activeView: SavedViewKey;
  filters: FollowUpAdvancedFilters;
  createdAt: string;
}

export type PersistenceMode = 'loading' | 'supabase' | 'tauri-sqlite' | 'browser';

export type OutlookFolderName = 'inbox' | 'sentitems';

export type ItemCategory =
  | 'General'
  | 'RFI'
  | 'Submittal'
  | 'Procurement'
  | 'Issue'
  | 'Coordination'
  | 'Closeout';

export type OwesNextAction =
  | 'Internal'
  | 'Client'
  | 'Government'
  | 'Vendor'
  | 'Subcontractor'
  | 'Consultant'
  | 'Unknown';

export type EscalationLevel = 'None' | 'Watch' | 'Escalate' | 'Critical';

export type CompanyType =
  | 'Government'
  | 'Owner'
  | 'Vendor'
  | 'Subcontractor'
  | 'Consultant'
  | 'Internal'
  | 'Other';

export type ReviewBucketKey =
  | 'needsNudge'
  | 'dueThisWeek'
  | 'staleWaiting'
  | 'escalated'
  | 'snoozed';

export type IngestionPreset = 'Email thread' | 'Meeting notes' | 'Issue log' | 'General';

export type ProjectStatus = 'Active' | 'On hold' | 'Closeout' | 'Complete';

export type IntakeDocumentKind =
  | 'Email file'
  | 'Spreadsheet'
  | 'Document'
  | 'PDF'
  | 'Presentation'
  | 'Text'
  | 'Other';

export type IntakeDocumentDisposition =
  | 'Unprocessed'
  | 'Converted to follow-up'
  | 'Reference only'
  | 'Archived';


export type CaptureCleanupReason =
  | 'missing_project'
  | 'missing_owner'
  | 'missing_due_date'
  | 'low_confidence_title'
  | 'unclear_type';

export type RecommendedAction =
  | 'Send nudge'
  | 'Create task'
  | 'Wait for response'
  | 'Close out'
  | 'Review cleanup'
  | 'Log touch'
  | 'Draft follow-up';



export type ActionLifecycleState =
  | 'Draft created'
  | 'Ready to send'
  | 'Sent (confirmed)'
  | 'Waiting for reply'
  | 'Reply received'
  | 'Complete';

export interface ActionReceipt {
  id: string;
  at: string;
  actor: string;
  action: 'draft_created' | 'send_confirmed' | 'reply_received' | 'completed' | 'task_completed' | 'task_unblocked';
  confirmed: boolean;
  notes?: string;
}

export type CaptureConfidenceTier = 'high' | 'medium' | 'low';

export interface IntakeCandidate {
  id: string;
  rawText: string;
  createdAt: string;
  suggestedType: 'task' | 'followup';
  confidenceTier: CaptureConfidenceTier;
  confidenceScore: number;
  parseReasons: string[];
  missingFields: string[];
  detectedProject?: string;
  detectedOwner?: string;
  detectedDueDate?: string;
  waitingOn?: string;
  priority: FollowUpPriority;
  draft: {
    title: string;
    summary: string;
    nextAction?: string;
    nextStep?: string;
    status?: FollowUpStatus | TaskStatus;
  };
}

export type IntakeAssetKind =
  | 'email'
  | 'document'
  | 'spreadsheet'
  | 'pdf'
  | 'text'
  | 'html'
  | 'csv'
  | 'presentation'
  | 'attachment'
  | 'unknown';

export type IntakeAssetSource = 'drop' | 'file_picker' | 'forwarding' | 'outlook_sync' | 'manual_paste';

export type IntakeParseStatus =
  | 'queued'
  | 'reading'
  | 'parsed'
  | 'review_needed'
  | 'ready_high_confidence'
  | 'imported'
  | 'linked'
  | 'rejected'
  | 'failed';

export type IntakeCandidateType = 'task' | 'followup' | 'reference' | 'update_existing_task' | 'update_existing_followup';
export type IntakeCandidateDecision = 'pending' | 'approved' | 'imported' | 'linked' | 'reference' | 'rejected';

export interface IntakeEvidence {
  id: string;
  field: string;
  snippet: string;
  sourceRef: string;
  score?: number;
  assetId?: string;
  locator?: string;
  sourceType?: 'email_header' | 'email_body' | 'pdf_page' | 'docx_paragraph' | 'sheet_row' | 'text';
}

export interface IntakeExistingMatch {
  id: string;
  recordType: 'task' | 'followup';
  title: string;
  project: string;
  score: number;
  reason: string;
  strategy?: 'duplicate' | 'update' | 'link';
  matchedFields?: string[];
}

export interface IntakeAssetRecord {
  id: string;
  batchId: string;
  parentAssetId?: string;
  rootAssetId?: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  kind: IntakeAssetKind;
  source: IntakeAssetSource;
  uploadedAt: string;
  receivedAt?: string;
  parseStatus: IntakeParseStatus;
  parseQuality: 'strong' | 'partial' | 'weak' | 'failed';
  metadata: Record<string, string | number | boolean | null>;
  extractedText: string;
  extractedPreview: string;
  warnings: string[];
  errors: string[];
  attachmentIds: string[];
  sourceRefs: string[];
  contentHash: string;
  extractionConfidence?: number;
  parserStages?: string[];
}

export interface IntakeBatchRecord {
  id: string;
  createdAt: string;
  source: IntakeAssetSource;
  assetIds: string[];
  status: 'active' | 'review' | 'completed' | 'failed';
  stats: {
    filesProcessed: number;
    candidatesCreated: number;
    highConfidence: number;
    failedParses: number;
    duplicatesFlagged: number;
  };
}

export interface IntakeWorkCandidate {
  id: string;
  batchId: string;
  assetId: string;
  candidateType: IntakeCandidateType;
  suggestedAction: 'create_new' | 'update_existing' | 'link_existing' | 'reference_only' | 'ignore_duplicate';
  confidence: number;
  title: string;
  project?: string;
  projectId?: string;
  owner?: string;
  assignee?: string;
  dueDate?: string;
  nextStep?: string;
  waitingOn?: string;
  priority: FollowUpPriority;
  statusHint?: string;
  summary: string;
  tags: string[];
  explanation: string[];
  evidence: IntakeEvidence[];
  fieldConfidence?: Record<string, number>;
  warnings: string[];
  duplicateMatches: IntakeExistingMatch[];
  existingRecordMatches: IntakeExistingMatch[];
  approvalStatus: IntakeCandidateDecision;
  createdRecordId?: string;
  linkedRecordId?: string;
  sourceAssetIds?: string[];
  intent?: 'new_work' | 'update' | 'reference';
  createdAt: string;
  updatedAt: string;
}

export type UnifiedQueuePreset =
  | 'Today'
  | 'Due now'
  | 'This week'
  | 'Waiting on others'
  | 'Needs nudge'
  | 'Blocked / at risk'
  | 'Blocked'
  | 'Deferred'
  | 'Linked to at-risk follow-ups'
  | 'Unlinked tasks'
  | 'Cleanup'
  | 'Recently updated';

export interface UnifiedQueueFilter {
  types?: Array<'task' | 'followup'>;
  project?: string[];
  owner?: string[];
  assignee?: string[];
  status?: string[];
  priority?: string[];
  escalation?: string[];
  dueInDays?: number;
  waitingOn?: boolean;
  cleanupOnly?: boolean;
  linkedState?: 'linked' | 'unlinked' | 'blocked_child' | 'all_done';
  linkedParentStatus?: string[];
  parentAtRisk?: boolean;
  blockedOnly?: boolean;
  deferredOnly?: boolean;
  dueDateFrom?: string;
  dueDateTo?: string;
  startDateFrom?: string;
  startDateTo?: string;
  tags?: string[];
  companyId?: string[];
  contactId?: string[];
  missingProjectContext?: boolean;
  updatedWithinDays?: number;
  source?: string[];
}

export interface SavedExecutionView {
  id: string;
  name: string;
  filter: UnifiedQueueFilter;
  preset?: UnifiedQueuePreset;
  scope: 'personal' | 'team';
  createdAt: string;
}

export interface UnifiedQueueItem {
  id: string;
  recordType: 'task' | 'followup';
  title: string;
  project: string;
  owner: string;
  assignee: string;
  status: string;
  priority: FollowUpPriority;
  dueDate?: string;
  startDate?: string;
  nextTouchDate?: string;
  escalationLevel?: EscalationLevel;
  waitingOn?: string;
  needsCleanup: boolean;
  linkedRecordStatus?: string;
  linkedFollowUpId?: string;
  linkedParentStatus?: FollowUpStatus;
  parentAtRisk?: boolean;
  contextNote?: string;
  completionImpact?: 'none' | 'advance_parent' | 'close_parent';
  linkedTaskCount?: number;
  linkedOpenTaskCount?: number;
  linkedBlockedCount?: number;
  linkedOverdueTaskCount?: number;
  deferredUntil?: string;
  blockReason?: string;
  workflowState?: TaskWorkflowState;
  tags?: string[];
  companyId?: string;
  contactId?: string;
  primaryNextAction: string;
  whyInQueue: string;
  score: number;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  type: TimelineEventType;
  summary: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorUserId: string;
  actorDisplayName: string;
  action: 'assignment_changed' | 'status_changed' | 'due_date_changed' | 'closed' | 'reopened' | 'escalated' | 'claimed' | 'unclaimed' | 'created' | 'updated';
  field?: string;
  from?: string;
  to?: string;
  summary: string;
}

export interface TeamMember {
  id: string;
  displayName: string;
  email?: string;
  teamId: string;
  role: AppUserRole;
  active: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  code?: string;
  owner: string;
  status: ProjectStatus;
  notes: string;
  completionNote?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}


export interface FollowUpItem {
  id: string;
  title: string;
  source: SourceType;
  project: string;
  projectId?: string;
  owner: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  dueDate: string;
  promisedDate?: string;
  lastTouchDate: string;
  nextTouchDate: string;
  lastNudgedAt?: string;
  snoozedUntilDate?: string;
  nextAction: string;
  summary: string;
  tags: string[];
  sourceRef: string;
  sourceRefs: string[];
  mergedItemIds: string[];
  waitingOn?: string;
  notes: string;
  completionNote?: string;
  timeline: TimelineEvent[];
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
  actionState?: ActionLifecycleState;
  actionReceipts?: ActionReceipt[];
  needsCleanup?: boolean;
  cleanupReasons?: CaptureCleanupReason[];
  recommendedAction?: RecommendedAction;
  lastCompletedAction?: string;
  lastActionAt?: string;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  updatedByUserId?: string;
  updatedByDisplayName?: string;
  visibilityScope?: VisibilityScope;
  teamId?: string;
  watchers?: string[];
  auditHistory?: AuditEntry[];
  linkedTaskCount?: number;
  openLinkedTaskCount?: number;
  blockedLinkedTaskCount?: number;
  overdueLinkedTaskCount?: number;
  doneLinkedTaskCount?: number;
  allLinkedTasksDone?: boolean;
  childWorkflowSignal?: 'on_track' | 'blocked' | 'overdue' | 'ready_to_close';
}



export interface TaskItem {
  id: string;
  title: string;
  project: string;
  projectId?: string;
  owner: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  startDate?: string;
  startedAt?: string;
  deferredUntil?: string;
  nextReviewAt?: string;
  completedAt?: string;
  completionNote?: string;
  summary: string;
  nextStep: string;
  notes: string;
  tags: string[];
  linkedFollowUpId?: string;
  linkedProjectContext?: string;
  contextNote?: string;
  blockReason?: string;
  completionImpact?: 'none' | 'advance_parent' | 'close_parent';
  contactId?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  needsCleanup?: boolean;
  cleanupReasons?: CaptureCleanupReason[];
  recommendedAction?: RecommendedAction;
  lastCompletedAction?: string;
  lastActionAt?: string;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  updatedByUserId?: string;
  updatedByDisplayName?: string;
  visibilityScope?: VisibilityScope;
  teamId?: string;
  watchers?: string[];
  auditHistory?: AuditEntry[];
  linkedTaskCount?: number;
  openLinkedTaskCount?: number;
  blockedLinkedTaskCount?: number;
  overdueLinkedTaskCount?: number;
  doneLinkedTaskCount?: number;
  allLinkedTasksDone?: boolean;
  childWorkflowSignal?: 'on_track' | 'blocked' | 'overdue' | 'ready_to_close';
}

export interface TaskFormInput {
  title: string;
  project: string;
  projectId?: string;
  owner: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  startDate?: string;
  startedAt?: string;
  deferredUntil?: string;
  nextReviewAt?: string;
  summary: string;
  nextStep: string;
  notes: string;
  completionNote?: string;
  tags: string[];
  linkedFollowUpId?: string;
  linkedProjectContext?: string;
  contextNote?: string;
  blockReason?: string;
  completionImpact?: 'none' | 'advance_parent' | 'close_parent';
  contactId?: string;
  companyId?: string;
}

export interface IntakeSignal {
  id: string;
  source: SourceType;
  title: string;
  detail: string;
  urgency: 'Low' | 'Medium' | 'High';
}

export interface IntakeDocumentRecord {
  id: string;
  name: string;
  kind: IntakeDocumentKind;
  disposition: IntakeDocumentDisposition;
  linkedFollowUpId?: string;
  linkedProjectContext?: string;
  contextNote?: string;
  blockReason?: string;
  completionImpact?: 'none' | 'advance_parent' | 'close_parent';
  projectId?: string;
  project: string;
  owner: string;
  sourceRef: string;
  uploadedAt: string;
  notes: string;
  completionNote?: string;
  tags: string[];
}

export interface FollowUpFormInput {
  title: string;
  source: SourceType;
  project: string;
  projectId?: string;
  owner: string;
  assigneeDisplayName?: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  dueDate: string;
  promisedDate?: string;
  nextTouchDate: string;
  nextAction: string;
  summary: string;
  tags: string[];
  sourceRef: string;
  waitingOn?: string;
  notes: string;
  completionNote?: string;
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
  actionState?: ActionLifecycleState;
  actionReceipts?: ActionReceipt[];
  needsCleanup?: boolean;
  cleanupReasons?: CaptureCleanupReason[];
  recommendedAction?: RecommendedAction;
  lastCompletedAction?: string;
  lastActionAt?: string;
}


export interface ImportPreviewRow {
  id: string;
  title: string;
  project: string;
  projectId?: string;
  owner: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  dueDate: string;
  nextAction: string;
  summary: string;
  source: SourceType;
  sourceRef: string;
  notes: string;
  completionNote?: string;
  tags: string[];
}

export interface DuplicateCandidate {
  itemId: string;
  score: number;
  reasons: string[];
}

export interface DuplicateReview {
  itemId: string;
  candidates: DuplicateCandidate[];
}

export interface MergeDraft {
  title: string;
  source: SourceType;
  project: string;
  projectId?: string;
  owner: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  dueDate: string;
  promisedDate?: string;
  lastTouchDate: string;
  nextTouchDate: string;
  nextAction: string;
  summary: string;
  tags: string[];
  sourceRef: string;
  sourceRefs: string[];
  mergedItemIds: string[];
  waitingOn?: string;
  notes: string;
  completionNote?: string;
  timeline: TimelineEvent[];
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
  actionState?: ActionLifecycleState;
  actionReceipts?: ActionReceipt[];
  needsCleanup?: boolean;
  cleanupReasons?: CaptureCleanupReason[];
  recommendedAction?: RecommendedAction;
  lastCompletedAction?: string;
  lastActionAt?: string;
}


export interface ReviewBucket {
  key: ReviewBucketKey;
  label: string;
  helper: string;
  itemIds: string[];
}

export interface ContactRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyId?: string;
  role: string;
  notes: string;
  completionNote?: string;
  tags: string[];
}

export interface CompanyRecord {
  id: string;
  name: string;
  type: CompanyType;
  notes: string;
  completionNote?: string;
  tags: string[];
}

export interface OutlookScopesPreset {
  label: string;
  value: string;
}

export interface OutlookConnectionSettings {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  syncLimit: number;
  autoPullSent: boolean;
}

export interface OutlookAuthSession {
  pkceVerifier: string;
  state: string;
  authUrl: string;
  startedAt: string;
}

export interface OutlookMailboxProfile {
  userId: string;
  displayName: string;
  email: string;
}

export interface OutlookTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  acquiredAt: string;
}

export type OutlookImportance = 'low' | 'normal' | 'high';

export interface OutlookMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject: string;
  bodyPreview: string;
  from: string;
  toRecipients: string[];
  ccRecipients: string[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead: boolean;
  importance: OutlookImportance;
  hasAttachments: boolean;
  categories: string[];
  flagStatus?: string;
  webLink?: string;
  folder: OutlookFolderName;
  sourceRef: string;
}

export interface OutlookFolderSyncState {
  deltaLink?: string;
  lastFolderSyncAt?: string;
  lastMessageCount?: number;
}

export type OutlookSyncStatus = 'idle' | 'auth-ready' | 'syncing' | 'connected' | 'error';

export interface OutlookConnectionState {
  settings: OutlookConnectionSettings;
  authSession?: OutlookAuthSession;
  profile?: OutlookMailboxProfile;
  tokens?: OutlookTokenSet;
  mailboxLinked: boolean;
  lastSyncAt?: string;
  lastError?: string;
  syncStatus: OutlookSyncStatus;
  syncCursorByFolder: Record<OutlookFolderName, OutlookFolderSyncState>;
  lastSyncMode?: 'initial' | 'delta';
}

export interface OutlookReplyGap {
  id: string;
  conversationId: string;
  subject: string;
  sentMessageId: string;
  waitingDays: number;
  latestSentAt: string;
  waitingOn: string[];
  hasTrackedItem: boolean;
  reason: string;
  webLink?: string;
}

export interface DroppedEmailImport {
  id: string;
  fileName: string;
  format: 'eml' | 'msg' | 'txt' | 'html';
  subject: string;
  from: string;
  toRecipients: string[];
  ccRecipients: string[];
  sentAt?: string;
  bodyPreview: string;
  sourceRef: string;
  projectHint: string;
  parseQuality: 'structured' | 'best-effort';
  parseWarnings: string[];
}

export interface OutlookThreadSuggestion {
  id: string;
  conversationId: string;
  sourceMessageId: string;
  subject: string;
  suggestedStatus: FollowUpStatus;
  suggestedPriority: FollowUpPriority;
  recommendation: string;
  reasons: string[];
  projectHint: string;
  waitingOn?: string;
  latestActivityAt?: string;
  webLink?: string;
}



export interface ForwardedEmailCommandHints {
  type?: 'task' | 'followup' | 'reference';
  project?: string;
  owner?: string;
  dueDate?: string;
  priority?: FollowUpPriority | TaskPriority;
  waitingOn?: string;
  tags: string[];
}

export interface ForwardedEmailAttachmentMeta {
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
}

export type ForwardedEmailStatus = 'received' | 'parsed' | 'candidate_created' | 'ignored' | 'errored';

export interface ForwardedEmailRecord {
  id: string;
  receivedAt: string;
  forwardingAddress: string;
  forwardingAlias: string;
  originalSubject: string;
  normalizedSubject: string;
  originalSender: string;
  originalRecipients: string[];
  cc: string[];
  originalSentAt?: string;
  bodyText: string;
  htmlBody?: string;
  attachments: ForwardedEmailAttachmentMeta[];
  parsedProjectHints: string[];
  parsedCommandHints: ForwardedEmailCommandHints;
  parseQuality: 'strong' | 'partial' | 'weak';
  parseWarnings: string[];
  parserConfidence: number;
  dedupeSignature: string;
  sourceMessageIdentifiers: string[];
  rawForwardingMarkers: string[];
  status: ForwardedEmailStatus;
}

export type ForwardedRuleAction =
  | 'ignore'
  | 'review-task'
  | 'review-followup'
  | 'review-reference'
  | 'allow-auto-task'
  | 'allow-auto-followup'
  | 'block-auto-create'
  | 'boost-confidence'
  | 'set-owner'
  | 'set-project'
  | 'set-default-priority';

export interface ForwardedRuleCondition {
  forwardingAlias?: string;
  senderEmailContains?: string;
  senderDomain?: string;
  subjectContains?: string;
  bodyContains?: string;
  projectHintPresent?: boolean;
  commandTag?: string;
  attachmentPresent?: boolean;
  senderKind?: 'internal' | 'external';
  minParserConfidence?: number;
  maxRecipientCount?: number;
  threadSignatureContains?: string;
}

export interface ForwardedEmailRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  source: 'system' | 'user';
  conditions: ForwardedRuleCondition;
  action: ForwardedRuleAction;
  value?: string;
  confidenceBoost?: number;
  createdAt: string;
  updatedAt: string;
}

export type ForwardedRoutingDecision = 'auto-task' | 'auto-followup' | 'review' | 'reference' | 'ignore' | 'blocked';

export interface ForwardedIngestionLedgerEntry {
  id: string;
  forwardedEmailId: string;
  dedupeSignature: string;
  normalizedSubject: string;
  sender: string;
  sentAt?: string;
  sourceMessageIds: string[];
  linkedTaskId?: string;
  linkedFollowUpId?: string;
  linkedProjectContext?: string;
  contextNote?: string;
  blockReason?: string;
  completionImpact?: 'none' | 'advance_parent' | 'close_parent';
  lastRoutingDecision: ForwardedRoutingDecision;
  evaluatedAt: string;
}

export interface ForwardedIntakeCandidate {
  id: string;
  forwardedEmailId: string;
  normalizedSubject: string;
  originalSender: string;
  forwardingAlias: string;
  parsedProject?: string;
  suggestedType: 'task' | 'followup' | 'reference';
  confidence: number;
  reasons: string[];
  warnings: string[];
  duplicateWarnings: string[];
  parsedCommands: string[];
  parseQuality: ForwardedEmailRecord['parseQuality'];
  status: 'pending' | 'approved' | 'rejected' | 'reference' | 'linked';
  createdTaskId?: string;
  createdFollowUpId?: string;
  linkedItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForwardedRoutingAuditEntry {
  id: string;
  forwardedEmailId: string;
  ruleIds: string[];
  signals: string[];
  confidence: number;
  result: ForwardedRoutingDecision;
  reasons: string[];
  createdTaskId?: string;
  createdFollowUpId?: string;
  createdAt: string;
}
export interface ForwardedEmailProviderPayload {
  provider: 'mock' | 'postmark' | 'sendgrid' | 'mailgun' | 'other';
  receivedAt?: string;
  forwardingAddress: string;
  envelopeFrom?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: ForwardedEmailAttachmentMeta[];
}
export interface AppSnapshot {
  items: FollowUpItem[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  intakeSignals: IntakeSignal[];
  intakeDocuments: IntakeDocumentRecord[];
  dismissedDuplicatePairs: string[];
  droppedEmailImports: DroppedEmailImport[];
  outlookConnection: OutlookConnectionState;
  outlookMessages: OutlookMessage[];
  tasks: TaskItem[];
  forwardedEmails: ForwardedEmailRecord[];
  forwardedRules: ForwardedEmailRule[];
  forwardedCandidates: ForwardedIntakeCandidate[];
  forwardedLedger: ForwardedIngestionLedgerEntry[];
  forwardedRoutingAudit: ForwardedRoutingAuditEntry[];
  intakeCandidates?: IntakeCandidate[];
  intakeAssets?: IntakeAssetRecord[];
  intakeBatches?: IntakeBatchRecord[];
  intakeWorkCandidates?: IntakeWorkCandidate[];
  savedExecutionViews?: SavedExecutionView[];
  followUpFilters?: FollowUpAdvancedFilters;
  followUpColumns?: FollowUpColumnKey[];
  savedFollowUpViews?: SavedFollowUpCustomView[];
  teamMembers?: TeamMember[];
  currentUserId?: string;
}
