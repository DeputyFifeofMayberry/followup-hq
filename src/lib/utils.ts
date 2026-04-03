import type {
  CompanyRecord,
  ContactRecord,
  EscalationLevel,
  FollowUpFormInput,
  FollowUpItem,
  FollowUpPriority,
  FollowUpStatus,
  ImportPreviewRow,
  MergeDraft,
  ProjectRecord,
  ReviewBucket,
  SavedViewKey,
  SourceType,
  TimelineEvent,
} from '../types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function createId(prefix = 'FUP'): string {
  const value = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${value}`;
}

export function todayIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(baseIso: string | undefined, days: number): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

export function toDateInputValue(dateIso?: string): string {
  if (!dateIso) return '';
  return new Date(dateIso).toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function daysSince(dateIso: string): number {
  const now = new Date();
  const then = new Date(dateIso);
  const diff = now.getTime() - then.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function daysUntil(dateIso?: string): number {
  if (!dateIso) return 9999;
  const then = new Date(dateIso);
  const now = new Date();
  const diff = then.getTime() - now.getTime();
  return Math.floor(diff / 86400000);
}

export function isOverdue(item: FollowUpItem): boolean {
  return item.status !== 'Closed' && new Date(item.dueDate).getTime() < Date.now();
}

export function isDueToday(item: FollowUpItem): boolean {
  const due = new Date(item.dueDate);
  const now = new Date();
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate();
}

export function isSnoozed(item: FollowUpItem): boolean {
  return !!item.snoozedUntilDate && new Date(item.snoozedUntilDate).getTime() > Date.now();
}

export function needsNudge(item: FollowUpItem): boolean {
  if (item.status === 'Closed' || isSnoozed(item)) return false;
  if (item.status === 'Waiting on external' || item.status === 'Waiting internal') {
    const touchAge = daysSince(item.lastTouchDate);
    const touchWindow = Math.max(1, item.cadenceDays || 3);
    if (touchAge >= touchWindow) return true;
  }
  return new Date(item.nextTouchDate).getTime() <= Date.now();
}


export function isTaskDeferred(task: { deferredUntil?: string; status: string }): boolean {
  return !!task.deferredUntil && task.status !== 'Done' && new Date(task.deferredUntil).getTime() > Date.now();
}

export function taskWorkflowState(task: { status: string; deferredUntil?: string }): 'ready' | 'blocked' | 'deferred' | 'done' {
  if (task.status === 'Done') return 'done';
  if (task.status === 'Blocked') return 'blocked';
  if (isTaskDeferred(task)) return 'deferred';
  return 'ready';
}

export function isTaskOverdue(task: { dueDate?: string; status: string }): boolean {
  return !!task.dueDate && task.status !== 'Done' && new Date(task.dueDate).getTime() < Date.now();
}

export function isTaskDueWithin(task: { dueDate?: string; status: string }, days: number): boolean {
  if (!task.dueDate || task.status === 'Done') return false;
  return new Date(task.dueDate).getTime() <= Date.now() + days * 86400000;
}

export function escalationWeight(level: EscalationLevel): number {
  switch (level) {
    case 'Critical':
      return 4;
    case 'Escalate':
      return 3;
    case 'Watch':
      return 2;
    default:
      return 1;
  }
}

export function priorityTone(priority: FollowUpPriority): 'neutral' | 'warn' | 'danger' | 'success' {
  switch (priority) {
    case 'Critical':
      return 'danger';
    case 'High':
      return 'warn';
    case 'Medium':
      return 'neutral';
    case 'Low':
      return 'success';
  }
}

export function statusTone(status: FollowUpStatus): 'neutral' | 'warn' | 'danger' | 'success' {
  switch (status) {
    case 'At risk':
      return 'danger';
    case 'Needs action':
    case 'Waiting on external':
      return 'warn';
    case 'Closed':
      return 'success';
    default:
      return 'neutral';
  }
}

export function sourceTone(source: SourceType): 'blue' | 'purple' | 'green' | 'gold' {
  switch (source) {
    case 'Email':
      return 'blue';
    case 'Notes':
      return 'purple';
    case 'To-do':
      return 'green';
    case 'Excel':
      return 'gold';
  }
}

export function escalationTone(level: EscalationLevel): 'neutral' | 'warn' | 'danger' | 'success' | 'blue' {
  switch (level) {
    case 'Critical':
      return 'danger';
    case 'Escalate':
      return 'warn';
    case 'Watch':
      return 'blue';
    default:
      return 'neutral';
  }
}

export function formatDate(dateIso?: string): string {
  if (!dateIso) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateIso));
}

export function formatDateTime(dateIso?: string): string {
  if (!dateIso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(dateIso));
}

export interface RunningNoteEntry {
  id: string;
  at: string;
  text: string;
}

export function appendRunningNote(existing: string, note: string, at = todayIso()): string {
  const clean = note.trim();
  if (!clean) return existing;
  const entry = `[[${at}]] ${clean}`;
  return existing.trim() ? `${entry}\n\n${existing.trim()}` : entry;
}

export function parseRunningNotes(notes: string): RunningNoteEntry[] {
  const trimmed = notes.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n\n(?=\[\[)/)
    .map((chunk) => {
      const match = chunk.match(/^\[\[(.+?)\]\]\s*([\s\S]*)$/);
      if (match) return { id: createId('NOTE'), at: match[1], text: match[2].trim() };
      return { id: createId('NOTE'), at: todayIso(), text: chunk.trim() };
    })
    .filter((entry) => entry.text);
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeText(value: string): string {
  return value.trim();
}

export function normalizeItem(item: FollowUpItem): FollowUpItem {
  const dueDate = item.dueDate || todayIso();
  const lastTouchDate = item.lastTouchDate || todayIso();
  const cadenceDays = item.cadenceDays && item.cadenceDays > 0 ? item.cadenceDays : 3;
  return {
    ...item,
    project: normalizeText(item.project || 'General') || 'General',
    projectId: item.projectId || undefined,
    owner: normalizeText(item.owner || 'Unassigned') || 'Unassigned',
    assigneeUserId: item.assigneeUserId || undefined,
    assigneeDisplayName: normalizeText(item.assigneeDisplayName || item.owner || 'Unassigned') || 'Unassigned',
    createdByUserId: item.createdByUserId || 'user-seed',
    createdByDisplayName: item.createdByDisplayName || 'System',
    updatedByUserId: item.updatedByUserId || item.createdByUserId || 'user-seed',
    updatedByDisplayName: item.updatedByDisplayName || item.createdByDisplayName || 'System',
    visibilityScope: item.visibilityScope || 'team',
    teamId: item.teamId || 'team-default',
    watchers: uniqueStrings(item.watchers ?? []),
    auditHistory: item.auditHistory ?? [],
    summary: normalizeText(item.summary),
    nextAction: normalizeText(item.nextAction),
    sourceRef: normalizeText(item.sourceRef),
    sourceRefs: uniqueStrings([...(item.sourceRefs ?? []), item.sourceRef]),
    mergedItemIds: uniqueStrings(item.mergedItemIds ?? []),
    tags: uniqueStrings(item.tags ?? []),
    waitingOn: item.waitingOn?.trim() || undefined,
    dueDate,
    promisedDate: item.promisedDate || undefined,
    lastTouchDate,
    nextTouchDate: item.nextTouchDate || addDaysIso(lastTouchDate, cadenceDays),
    lastNudgedAt: item.lastNudgedAt || undefined,
    snoozedUntilDate: item.snoozedUntilDate || undefined,
    category: item.category || 'General',
    owesNextAction: item.owesNextAction || 'Unknown',
    escalationLevel: item.escalationLevel || 'None',
    cadenceDays,
    contactId: item.contactId || undefined,
    companyId: item.companyId || undefined,
    threadKey: item.threadKey || undefined,
    draftFollowUp: item.draftFollowUp || '',
    actionState: item.actionState || 'Draft created',
    actionReceipts: item.actionReceipts || [],
    needsCleanup: item.needsCleanup || false,
    cleanupReasons: item.cleanupReasons || [],
    recommendedAction: item.recommendedAction || (item.needsCleanup ? 'Review cleanup' : undefined),
    lastCompletedAction: item.lastCompletedAction || undefined,
    lastActionAt: item.lastActionAt || undefined,
  };
}

export function buildTouchEvent(summary: string, type: TimelineEvent['type'] = 'touched'): TimelineEvent {
  return { id: createId('T'), at: todayIso(), type, summary: summary.trim() };
}

export function buildItemFromForm(input: FollowUpFormInput, existing?: FollowUpItem): FollowUpItem {
  const now = todayIso();
  const baseTimeline: TimelineEvent[] = existing?.timeline ?? [{ id: createId('T'), at: now, type: 'created', summary: 'Follow-up item created.' }];
  const sourceRef = input.sourceRef.trim();
  const sourceRefs = uniqueStrings([...(existing?.sourceRefs ?? []), existing?.sourceRef ?? '', sourceRef]);

  return normalizeItem({
    id: existing?.id ?? createId(),
    title: input.title.trim(),
    source: input.source,
    project: input.project.trim() || 'General',
    projectId: input.projectId || undefined,
    owner: input.owner.trim() || 'Unassigned',
    assigneeDisplayName: existing?.assigneeDisplayName || input.owner.trim() || 'Unassigned',
    assigneeUserId: existing?.assigneeUserId,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate,
    promisedDate: input.promisedDate?.trim() ? input.promisedDate : undefined,
    lastTouchDate: existing?.lastTouchDate ?? now,
    nextTouchDate: input.nextTouchDate,
    lastNudgedAt: existing?.lastNudgedAt,
    snoozedUntilDate: existing?.snoozedUntilDate,
    nextAction: input.nextAction.trim(),
    summary: input.summary.trim(),
    tags: input.tags,
    sourceRef,
    sourceRefs,
    mergedItemIds: existing?.mergedItemIds ?? [],
    waitingOn: input.waitingOn?.trim() || undefined,
    notes: input.notes,
    timeline: baseTimeline,
    category: input.category,
    owesNextAction: input.owesNextAction,
    escalationLevel: input.escalationLevel,
    cadenceDays: input.cadenceDays,
    contactId: input.contactId || undefined,
    companyId: input.companyId || undefined,
    threadKey: input.threadKey || undefined,
    draftFollowUp: input.draftFollowUp ?? existing?.draftFollowUp ?? '',
    actionState: existing?.actionState ?? 'Draft created',
    actionReceipts: existing?.actionReceipts ?? [],
    needsCleanup: existing?.needsCleanup || false,
    cleanupReasons: existing?.cleanupReasons || [],
    recommendedAction: existing?.recommendedAction,
    lastCompletedAction: existing?.lastCompletedAction,
    lastActionAt: existing?.lastActionAt,
    createdByUserId: existing?.createdByUserId,
    createdByDisplayName: existing?.createdByDisplayName,
    updatedByUserId: existing?.updatedByUserId,
    updatedByDisplayName: existing?.updatedByDisplayName,
    visibilityScope: existing?.visibilityScope,
    teamId: existing?.teamId,
    watchers: existing?.watchers,
    auditHistory: existing?.auditHistory,
  });
}

const priorityWeight: Record<FollowUpPriority, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const statusWeight: Record<FollowUpStatus, number> = {
  'Needs action': 3,
  'Waiting on external': 4,
  'Waiting internal': 2,
  'In progress': 1,
  'At risk': 5,
  Closed: 0,
};

function chooseHigherPriority(a: FollowUpPriority, b: FollowUpPriority): FollowUpPriority {
  return priorityWeight[a] >= priorityWeight[b] ? a : b;
}

function chooseMoreUrgentStatus(a: FollowUpStatus, b: FollowUpStatus): FollowUpStatus {
  return statusWeight[a] >= statusWeight[b] ? a : b;
}

function chooseEarlierDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function chooseLaterDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function chooseLonger(a: string, b: string): string {
  return b.trim().length > a.trim().length ? b : a;
}

function choosePreferred(a: string | undefined, b: string | undefined): string | undefined {
  if (a?.trim()) return a.trim();
  if (b?.trim()) return b.trim();
  return undefined;
}

function mergeNotes(base: FollowUpItem, other: FollowUpItem): string {
  const sections: string[] = [];
  if (base.notes.trim()) sections.push(`Primary notes\n${base.notes.trim()}`);
  if (other.notes.trim()) sections.push(`Merged notes from ${other.id}\n${other.notes.trim()}`);
  return sections.join('\n\n');
}

export function buildMergeDraft(base: FollowUpItem, other: FollowUpItem): MergeDraft {
  const normalizedBase = normalizeItem(base);
  const normalizedOther = normalizeItem(other);
  const sourceRefs = uniqueStrings([
    ...normalizedBase.sourceRefs,
    ...normalizedOther.sourceRefs,
    normalizedBase.sourceRef,
    normalizedOther.sourceRef,
  ]);
  const mergedItemIds = uniqueStrings([
    ...normalizedBase.mergedItemIds,
    ...normalizedOther.mergedItemIds,
    normalizedOther.id,
  ]);
  const timeline = [
    ...normalizedBase.timeline,
    ...normalizedOther.timeline,
    buildTouchEvent(`Merged ${normalizedOther.id} into ${normalizedBase.id}.`, 'merged'),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    title: chooseLonger(normalizedBase.title, normalizedOther.title),
    source: normalizedBase.source,
    project: choosePreferred(normalizedBase.project, normalizedOther.project) ?? 'General',
    owner: choosePreferred(normalizedBase.owner, normalizedOther.owner) ?? 'Unassigned',
    status: chooseMoreUrgentStatus(normalizedBase.status, normalizedOther.status),
    priority: chooseHigherPriority(normalizedBase.priority, normalizedOther.priority),
    dueDate: chooseEarlierDate(normalizedBase.dueDate, normalizedOther.dueDate) ?? todayIso(),
    promisedDate: chooseEarlierDate(normalizedBase.promisedDate, normalizedOther.promisedDate),
    lastTouchDate: chooseLaterDate(normalizedBase.lastTouchDate, normalizedOther.lastTouchDate) ?? todayIso(),
    nextTouchDate: chooseEarlierDate(normalizedBase.nextTouchDate, normalizedOther.nextTouchDate) ?? todayIso(),
    nextAction: chooseLonger(normalizedBase.nextAction, normalizedOther.nextAction),
    summary: chooseLonger(normalizedBase.summary, normalizedOther.summary),
    tags: uniqueStrings([...normalizedBase.tags, ...normalizedOther.tags]),
    sourceRef: sourceRefs[0] ?? normalizedBase.sourceRef,
    sourceRefs,
    mergedItemIds,
    waitingOn: choosePreferred(normalizedBase.waitingOn, normalizedOther.waitingOn),
    notes: mergeNotes(normalizedBase, normalizedOther),
    timeline,
    category: normalizedBase.category === 'General' ? normalizedOther.category : normalizedBase.category,
    owesNextAction: normalizedBase.owesNextAction !== 'Unknown' ? normalizedBase.owesNextAction : normalizedOther.owesNextAction,
    escalationLevel: escalationWeight(normalizedBase.escalationLevel) >= escalationWeight(normalizedOther.escalationLevel)
      ? normalizedBase.escalationLevel
      : normalizedOther.escalationLevel,
    cadenceDays: Math.min(normalizedBase.cadenceDays, normalizedOther.cadenceDays),
    contactId: normalizedBase.contactId ?? normalizedOther.contactId,
    companyId: normalizedBase.companyId ?? normalizedOther.companyId,
    threadKey: normalizedBase.threadKey ?? normalizedOther.threadKey,
    draftFollowUp: normalizedBase.draftFollowUp || normalizedOther.draftFollowUp || '',
  };
}

export function followUpHealthScore(item: FollowUpItem): number {
  let score = 0;
  score += priorityWeight[item.priority] * 10;
  score += escalationWeight(item.escalationLevel) * 8;
  if (item.status === 'At risk') score += 20;
  if (isOverdue(item)) score += 18;
  if (needsNudge(item)) score += 12;
  if (item.promisedDate && new Date(item.promisedDate).getTime() < Date.now() && item.status !== 'Closed') score += 10;
  if (daysSince(item.lastTouchDate) >= Math.max(3, item.cadenceDays)) score += 8;
  return score;
}

export function buildReviewBuckets(items: FollowUpItem[]): ReviewBucket[] {
  const openItems = items.filter((item) => item.status !== 'Closed');
  const buckets: ReviewBucket[] = [
    {
      key: 'needsNudge',
      label: 'Needs nudge',
      helper: 'Open items whose next touch or follow-up cadence is due now.',
      itemIds: openItems.filter(needsNudge).sort((a, b) => followUpHealthScore(b) - followUpHealthScore(a)).map((item) => item.id),
    },
    {
      key: 'dueThisWeek',
      label: 'Due this week',
      helper: 'Due now or within the next 7 days.',
      itemIds: openItems.filter((item) => daysUntil(item.dueDate) <= 7).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((item) => item.id),
    },
    {
      key: 'staleWaiting',
      label: 'Stale waiting',
      helper: 'Waiting items that have gone quiet longer than their touch cadence.',
      itemIds: openItems.filter((item) => (item.status === 'Waiting on external' || item.status === 'Waiting internal') && daysSince(item.lastTouchDate) >= Math.max(3, item.cadenceDays)).sort((a, b) => daysSince(b.lastTouchDate) - daysSince(a.lastTouchDate)).map((item) => item.id),
    },
    {
      key: 'escalated',
      label: 'Escalated',
      helper: 'Watch, escalate, and critical accountability items.',
      itemIds: openItems.filter((item) => item.escalationLevel !== 'None').sort((a, b) => followUpHealthScore(b) - followUpHealthScore(a)).map((item) => item.id),
    },
    {
      key: 'snoozed',
      label: 'Snoozed',
      helper: 'Items intentionally deferred to a later touch date.',
      itemIds: openItems.filter(isSnoozed).sort((a, b) => new Date(a.snoozedUntilDate ?? a.nextTouchDate).getTime() - new Date(b.snoozedUntilDate ?? b.nextTouchDate).getTime()).map((item) => item.id),
    },
  ];
  return buckets;
}

export function applySavedView(items: FollowUpItem[], activeView: SavedViewKey): FollowUpItem[] {
  switch (activeView) {
    case 'Today':
      return items.filter((item) => item.status !== 'Closed' && (isOverdue(item) || isDueToday(item) || needsNudge(item)));
    case 'Waiting':
      return items.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal');
    case 'Needs nudge':
      return items.filter(needsNudge);
    case 'At risk':
      return items.filter((item) => item.status === 'At risk' || item.priority === 'Critical' || item.escalationLevel === 'Critical');
    case 'Overdue':
      return items.filter((item) => isOverdue(item));
    case 'By project':
    case 'All':
    default:
      return items;
  }
}

export function sortByProjectThenDue(items: FollowUpItem[]): FollowUpItem[] {
  return [...items].sort((a, b) => {
    const projectCompare = (a.project || 'General').localeCompare(b.project || 'General');
    if (projectCompare !== 0) return projectCompare;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export interface ProjectDashboardRow {
  projectId?: string;
  project: string;
  owner: string;
  status: ProjectRecord['status'];
  openCount: number;
  waitingCount: number;
  overdueCount: number;
  atRiskCount: number;
  criticalCount: number;
  needsNudgeCount: number;
  documentCount: number;
  healthScore: number;
}

export function resolveProjectName(projectId: string | undefined, projectName: string | undefined, projects: ProjectRecord[]): string {
  if (projectId) {
    const match = projects.find((project) => project.id === projectId);
    if (match) return match.name;
  }
  return (projectName || 'General').trim() || 'General';
}

export function buildProjectDashboard(items: FollowUpItem[], projects: ProjectRecord[], documentCounts: Record<string, number> = {}): ProjectDashboardRow[] {
  const grouped = new Map<string, FollowUpItem[]>();
  items.forEach((item) => {
    const key = item.projectId || item.project || 'General';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });
  const rows = projects.map((project) => {
    const projectItems = grouped.get(project.id) ?? items.filter((item) => item.project === project.name && !item.projectId);
    return {
      projectId: project.id,
      project: project.name,
      owner: project.owner,
      status: project.status,
      openCount: projectItems.filter((item) => item.status !== 'Closed').length,
      waitingCount: projectItems.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length,
      overdueCount: projectItems.filter(isOverdue).length,
      atRiskCount: projectItems.filter((item) => item.status === 'At risk').length,
      criticalCount: projectItems.filter((item) => item.priority === 'Critical' || item.escalationLevel === 'Critical').length,
      needsNudgeCount: projectItems.filter(needsNudge).length,
      documentCount: documentCounts[project.id] ?? 0,
      healthScore: projectItems.reduce((sum, item) => sum + followUpHealthScore(item), 0),
    };
  });
  return rows.sort((a, b) => b.healthScore - a.healthScore || a.project.localeCompare(b.project));
}

export interface OwnerSummaryRow {
  owner: string;
  activeCount: number;
  waitingCount: number;
  overdueCount: number;
  needsNudgeCount: number;
  escalatedCount: number;
}

export function buildOwnerSummary(items: FollowUpItem[]): OwnerSummaryRow[] {
  const grouped = new Map<string, FollowUpItem[]>();
  items.forEach((item) => {
    const key = item.owner || 'Unassigned';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });
  return [...grouped.entries()].map(([owner, ownerItems]) => ({
    owner,
    activeCount: ownerItems.filter((item) => item.status !== 'Closed').length,
    waitingCount: ownerItems.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length,
    overdueCount: ownerItems.filter(isOverdue).length,
    needsNudgeCount: ownerItems.filter(needsNudge).length,
    escalatedCount: ownerItems.filter((item) => item.escalationLevel !== 'None').length,
  })).sort((a, b) => b.activeCount - a.activeCount);
}

export interface RelationshipSummaryRow {
  id: string;
  label: string;
  subtitle: string;
  openCount: number;
  waitingCount: number;
  overdueCount: number;
  averageTouchAge: number;
}

export function buildContactSummary(items: FollowUpItem[], contacts: ContactRecord[], companies: CompanyRecord[]): RelationshipSummaryRow[] {
  return contacts.map((contact) => {
    const linked = items.filter((item) => item.contactId === contact.id);
    const company = companies.find((entry) => entry.id === contact.companyId);
    const averageTouchAge = linked.length ? Math.round(linked.reduce((sum, item) => sum + daysSince(item.lastTouchDate), 0) / linked.length) : 0;
    return {
      id: contact.id,
      label: contact.name,
      subtitle: [contact.role, company?.name].filter(Boolean).join(' • ') || 'No company linked',
      openCount: linked.filter((item) => item.status !== 'Closed').length,
      waitingCount: linked.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length,
      overdueCount: linked.filter(isOverdue).length,
      averageTouchAge,
    };
  }).sort((a, b) => b.openCount - a.openCount || b.overdueCount - a.overdueCount);
}

export function buildCompanySummary(items: FollowUpItem[], companies: CompanyRecord[]): RelationshipSummaryRow[] {
  return companies.map((company) => {
    const linked = items.filter((item) => item.companyId === company.id);
    const averageTouchAge = linked.length ? Math.round(linked.reduce((sum, item) => sum + daysSince(item.lastTouchDate), 0) / linked.length) : 0;
    return {
      id: company.id,
      label: company.name,
      subtitle: company.type,
      openCount: linked.filter((item) => item.status !== 'Closed').length,
      waitingCount: linked.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length,
      overdueCount: linked.filter(isOverdue).length,
      averageTouchAge,
    };
  }).sort((a, b) => b.openCount - a.openCount || b.overdueCount - a.overdueCount);
}

export function buildWeeklyProjectReport(project: string, items: FollowUpItem[], contacts: ContactRecord[], companies: CompanyRecord[]): string {
  const linked = items.filter((item) => item.project === project && item.status !== 'Closed').sort((a, b) => followUpHealthScore(b) - followUpHealthScore(a));
  const waitingCount = linked.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length;
  const overdueCount = linked.filter(isOverdue).length;
  const nudgeCount = linked.filter(needsNudge).length;
  const header = [
    `# ${project} weekly follow-up report`,
    '',
    `Open follow-ups: ${linked.length}`,
    `Waiting items: ${waitingCount}`,
    `Overdue items: ${overdueCount}`,
    `Needs nudge: ${nudgeCount}`,
  ];
  const body = linked.map((item) => {
    const contact = contacts.find((entry) => entry.id === item.contactId)?.name;
    const company = companies.find((entry) => entry.id === item.companyId)?.name;
    return [
      `- ${item.title}`,
      `  Status: ${item.status} | Priority: ${item.priority} | Escalation: ${item.escalationLevel}`,
      `  Due: ${formatDate(item.dueDate)} | Next touch: ${formatDate(item.nextTouchDate)}${item.promisedDate ? ` | Promised: ${formatDate(item.promisedDate)}` : ''}`,
      `  Owes next action: ${item.owesNextAction}${item.waitingOn ? ` (${item.waitingOn})` : ''}`,
      `  Contact: ${contact ?? '—'} | Company: ${company ?? '—'}`,
      `  Next action: ${item.nextAction}`,
    ].join('\n');
  });
  return [...header, '', ...body].join('\n');
}

export function buildDraftText(item: FollowUpItem, contact?: ContactRecord, company?: CompanyRecord): string {
  const recipient = contact?.name || item.waitingOn || company?.name || 'team';
  return [
    `Subject: Follow-up on ${item.project} - ${item.title}`,
    '',
    `Hi ${recipient},`,
    '',
    `Following up on ${item.title}.`,
    item.summary ? `${item.summary}` : '',
    '',
    `Current next step on our side: ${item.nextAction}`,
    item.promisedDate ? `The promised date on this item is ${formatDate(item.promisedDate)}.` : '',
    `Please let me know the current status and any action needed from us to keep this moving.`,
    '',
    'Thank you,',
    item.owner,
  ].filter(Boolean).join('\n');
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const output: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      output.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  output.push(current.trim());
  return output;
}

function normalizeHeader(header: string): string {
  return header.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function detectSource(raw?: string): SourceType {
  const value = raw?.toLowerCase() ?? '';
  if (value.includes('note')) return 'Notes';
  if (value.includes('todo')) return 'To-do';
  if (value.includes('excel') || value.includes('sheet')) return 'Excel';
  return 'Email';
}

function detectStatus(raw?: string): FollowUpStatus {
  const value = raw?.toLowerCase() ?? '';
  if (value.includes('waiting') && value.includes('external')) return 'Waiting on external';
  if (value.includes('waiting') && value.includes('internal')) return 'Waiting internal';
  if (value.includes('progress')) return 'In progress';
  if (value.includes('risk')) return 'At risk';
  if (value.includes('closed') || value.includes('done') || value.includes('complete')) return 'Closed';
  return 'Needs action';
}

function detectPriority(raw?: string): FollowUpPriority {
  const value = raw?.toLowerCase() ?? '';
  if (value.includes('critical')) return 'Critical';
  if (value.includes('high')) return 'High';
  if (value.includes('low')) return 'Low';
  return 'Medium';
}

function parseDateValue(raw?: string): string {
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

export function parseDelimitedText(text: string, delimiter?: ',' | '\t'): ImportPreviewRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const resolvedDelimiter = delimiter ?? (lines[0].includes('\t') ? '\t' : ',');
  const headers = splitDelimitedLine(lines[0], resolvedDelimiter).map(normalizeHeader);

  return lines.slice(1).map((line, index) => {
    const cells = splitDelimitedLine(line, resolvedDelimiter);
    const get = (key: string) => {
      const headerIndex = headers.findIndex((header) => header === key);
      return headerIndex >= 0 ? cells[headerIndex] ?? '' : '';
    };

    return {
      id: createId(`IMP${index + 1}`),
      title: get('title') || get('item') || get('issue') || `Imported item ${index + 1}`,
      project: get('project') || 'General',
      owner: get('owner') || 'Unassigned',
      status: detectStatus(get('status')),
      priority: detectPriority(get('priority')),
      dueDate: parseDateValue(get('duedate') || get('due')),
      nextAction: get('nextaction') || get('action') || 'Review imported row and confirm next step.',
      summary: get('summary') || get('detail') || get('description') || '',
      source: detectSource(get('source')),
      sourceRef: get('sourceref') || get('link') || 'Imported row',
      notes: get('notes') || '',
      tags: uniqueStrings((get('tags') || '').split(',').map((tag) => tag.trim())),
    } satisfies ImportPreviewRow;
  });
}
