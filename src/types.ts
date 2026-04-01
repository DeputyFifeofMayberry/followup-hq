export type SourceType = 'Email' | 'Notes' | 'To-do' | 'Excel';

export type FollowUpStatus =
  | 'Needs action'
  | 'Waiting on external'
  | 'Waiting internal'
  | 'In progress'
  | 'At risk'
  | 'Closed';

export type FollowUpPriority = 'Low' | 'Medium' | 'High' | 'Critical';

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
  | 'relationship';

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

export interface TimelineEvent {
  id: string;
  at: string;
  type: TimelineEventType;
  summary: string;
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
}