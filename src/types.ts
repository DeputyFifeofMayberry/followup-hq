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
  | 'By project';

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
  timeline: TimelineEvent[];
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
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
  completedAt?: string;
  summary: string;
  nextStep: string;
  notes: string;
  tags: string[];
  linkedFollowUpId?: string;
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
  summary: string;
  nextStep: string;
  notes: string;
  tags: string[];
  linkedFollowUpId?: string;
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
  projectId?: string;
  project: string;
  owner: string;
  sourceRef: string;
  uploadedAt: string;
  notes: string;
  tags: string[];
}

export interface FollowUpFormInput {
  title: string;
  source: SourceType;
  project: string;
  projectId?: string;
  owner: string;
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
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
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
  timeline: TimelineEvent[];
  category: ItemCategory;
  owesNextAction: OwesNextAction;
  escalationLevel: EscalationLevel;
  cadenceDays: number;
  contactId?: string;
  companyId?: string;
  threadKey?: string;
  draftFollowUp?: string;
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
  tags: string[];
}

export interface CompanyRecord {
  id: string;
  name: string;
  type: CompanyType;
  notes: string;
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
  teamMembers?: TeamMember[];
  currentUserId?: string;
}
