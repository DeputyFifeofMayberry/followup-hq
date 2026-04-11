import type { CompanyRecord, ContactRecord, FollowUpAdvancedFilters, FollowUpItem, SavedViewKey } from '../types';
import { daysUntil, localDayDelta } from './utils';
import {
  classifyFollowUpItem,
  getSavedViewLaneKey,
  type FollowUpClassification,
  type FollowUpLaneKey,
} from '../domains/followups/helpers/followUpLanes';

interface FollowUpSelectorInput {
  items: FollowUpItem[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
  search: string;
  activeView: SavedViewKey;
  filters: FollowUpAdvancedFilters;
}

type FollowUpViewScopeInput = Omit<FollowUpSelectorInput, 'activeView'>;

export interface FollowUpViewCounts {
  allItems: number;
  allOpen: number;
  needsNudge: number;
  atRisk: number;
  readyToClose: number;
  closed: number;
}

export type FollowUpQueuePressureKey = 'allOpen' | 'needsNudge' | 'atRisk' | 'waiting' | 'overdue';

export type FollowUpQueuePressureCounts = Record<FollowUpQueuePressureKey, number>;

export const primaryFollowUpViews: SavedViewKey[] = ['All items', 'All', 'Needs nudge', 'At risk', 'Closed'];
export const secondaryFollowUpViews: SavedViewKey[] = ['Today', 'Waiting', 'Overdue', 'By project', 'Waiting on others', 'Promises due this week', 'Blocked by child tasks'];

export type FollowUpRowAffectingOptionKey =
  | 'activeView'
  | 'search'
  | 'status'
  | 'project'
  | 'owner'
  | 'assignee'
  | 'waitingOn'
  | 'escalation'
  | 'priority'
  | 'actionState'
  | 'category'
  | 'dueDateRange'
  | 'nextTouchDateRange'
  | 'promisedDateRange'
  | 'linkedTaskState'
  | 'cleanupOnly';

export type FollowUpRowAffectingOption = {
  key: FollowUpRowAffectingOptionKey;
  label: string;
};

function labelDateRange(range: FollowUpAdvancedFilters['dueDateRange']): string {
  if (range === 'all') return 'All dates';
  if (range === 'overdue') return 'Overdue';
  if (range === 'today') return 'Today';
  if (range === 'this_week') return 'This week';
  return 'Next 7 days';
}

function labelLinkedTaskState(state: FollowUpAdvancedFilters['linkedTaskState']): string {
  if (state === 'blocked_child') return 'Blocked child tasks';
  if (state === 'overdue_child') return 'Overdue child tasks';
  if (state === 'all_children_done') return 'All child tasks done';
  if (state === 'has_open_children') return 'Has open child tasks';
  if (state === 'none') return 'No child tasks';
  return 'All';
}

export function getActiveFollowUpRowAffectingOptions(input: {
  search: string;
  activeView: SavedViewKey;
  filters: FollowUpAdvancedFilters;
}): FollowUpRowAffectingOption[] {
  const entries: FollowUpRowAffectingOption[] = [];
  const term = input.search.trim();
  if (secondaryFollowUpViews.includes(input.activeView)) entries.push({ key: 'activeView', label: `View: ${input.activeView}` });
  if (term) entries.push({ key: 'search', label: `Search: ${term}` });
  if (input.filters.status !== 'All') entries.push({ key: 'status', label: `Status: ${input.filters.status}` });
  if (input.filters.project !== 'All') entries.push({ key: 'project', label: `Project: ${input.filters.project}` });
  if (input.filters.owner !== 'All') entries.push({ key: 'owner', label: `Owner: ${input.filters.owner}` });
  if (input.filters.assignee !== 'All') entries.push({ key: 'assignee', label: `Assignee: ${input.filters.assignee}` });
  if (input.filters.waitingOn !== 'All') entries.push({ key: 'waitingOn', label: `Waiting on: ${input.filters.waitingOn}` });
  if (input.filters.escalation !== 'All') entries.push({ key: 'escalation', label: `Escalation: ${input.filters.escalation}` });
  if (input.filters.priority !== 'All') entries.push({ key: 'priority', label: `Priority: ${input.filters.priority}` });
  if (input.filters.actionState !== 'All') entries.push({ key: 'actionState', label: `Action: ${input.filters.actionState}` });
  if (input.filters.category !== 'All') entries.push({ key: 'category', label: `Category: ${input.filters.category}` });
  if (input.filters.dueDateRange !== 'all') entries.push({ key: 'dueDateRange', label: `Due date: ${labelDateRange(input.filters.dueDateRange)}` });
  if (input.filters.nextTouchDateRange !== 'all') entries.push({ key: 'nextTouchDateRange', label: `Touch date: ${labelDateRange(input.filters.nextTouchDateRange)}` });
  if (input.filters.promisedDateRange !== 'all') entries.push({ key: 'promisedDateRange', label: `Promised: ${labelDateRange(input.filters.promisedDateRange)}` });
  if (input.filters.linkedTaskState !== 'all') entries.push({ key: 'linkedTaskState', label: `Linked tasks: ${labelLinkedTaskState(input.filters.linkedTaskState)}` });
  if (input.filters.cleanupOnly) entries.push({ key: 'cleanupOnly', label: 'Cleanup only' });
  return entries;
}

function isReadyToClose(item: FollowUpItem, classification: FollowUpClassification): boolean {
  return classification.isOpen && ((item.linkedTaskCount ?? 0) === 0 || !!item.allLinkedTasksDone);
}

function inDateRange(iso: string | undefined, range: FollowUpAdvancedFilters['dueDateRange']): boolean {
  if (range === 'all') return true;
  if (!iso) return false;
  const dayDelta = localDayDelta(new Date(), iso);
  if (range === 'overdue') return dayDelta < 0;
  if (range === 'today') return dayDelta === 0;
  if (range === 'this_week') return dayDelta <= 7;
  if (range === 'next_7_days') return dayDelta >= 0 && dayDelta <= 7;
  return true;
}

function hasLane(classification: FollowUpClassification, lane: FollowUpLaneKey): boolean {
  return classification.laneMemberships.has(lane);
}

function applySavedView(items: FollowUpItem[], view: SavedViewKey): FollowUpItem[] {
  const lane = getSavedViewLaneKey(view);
  if (lane) {
    return items.filter((item) => hasLane(classifyFollowUpItem(item), lane));
  }

  const openItems = items.filter((item) => classifyFollowUpItem(item).isOpen);
  switch (view) {
    case 'Ready to close':
      return openItems.filter((item) => isReadyToClose(item, classifyFollowUpItem(item)));
    case 'Promises due this week':
      return openItems.filter((item) => !!item.promisedDate && daysUntil(item.promisedDate) <= 7);
    case 'Blocked by child tasks':
      return openItems.filter((item) => (item.blockedLinkedTaskCount ?? 0) > 0 || item.childWorkflowSignal === 'blocked');
    case 'By project':
    default:
      return openItems;
  }
}

function applyBaseFilters(items: FollowUpItem[], input: FollowUpViewScopeInput): FollowUpItem[] {
  const { contacts, companies, search, filters } = input;
  const term = search.trim().toLowerCase();

  return items.filter((item) => {
    const classification = classifyFollowUpItem(item);
    const includeForCleanupMode = filters.cleanupOnly
      ? classification.isCleanupOnly
      : classification.isExecutionReady;
    if (!includeForCleanupMode) return false;

    const contact = contacts.find((entry) => entry.id === item.contactId)?.name ?? '';
    const company = companies.find((entry) => entry.id === item.companyId)?.name ?? '';
    const haystack = [
      item.id,
      item.title,
      item.project,
      item.owner,
      item.assigneeDisplayName || '',
      item.nextAction,
      item.summary,
      item.tags.join(' '),
      contact,
      company,
      item.threadKey ?? '',
      item.waitingOn ?? '',
    ].join(' ').toLowerCase();

    if (term && !haystack.includes(term)) return false;
    if (filters.project !== 'All' && item.project !== filters.project) return false;
    if (filters.status !== 'All' && item.status !== filters.status) return false;
    if (filters.assignee !== 'All' && (item.assigneeDisplayName || item.owner) !== filters.assignee) return false;
    if (filters.owner !== 'All' && item.owner !== filters.owner) return false;
    if (filters.waitingOn !== 'All' && (item.waitingOn || 'Unspecified') !== filters.waitingOn) return false;
    if (filters.escalation !== 'All' && item.escalationLevel !== filters.escalation) return false;
    if (filters.priority !== 'All' && item.priority !== filters.priority) return false;
    if (filters.actionState !== 'All' && (item.actionState || 'Draft created') !== filters.actionState) return false;
    if (filters.category !== 'All' && item.category !== filters.category) return false;
    if (!inDateRange(item.dueDate, filters.dueDateRange)) return false;
    if (!inDateRange(item.nextTouchDate, filters.nextTouchDateRange)) return false;
    if (!inDateRange(item.promisedDate, filters.promisedDateRange)) return false;

    if (filters.linkedTaskState === 'blocked_child' && (item.blockedLinkedTaskCount ?? 0) === 0) return false;
    if (filters.linkedTaskState === 'overdue_child' && (item.overdueLinkedTaskCount ?? 0) === 0) return false;
    if (filters.linkedTaskState === 'all_children_done' && !item.allLinkedTasksDone) return false;
    if (filters.linkedTaskState === 'has_open_children' && (item.openLinkedTaskCount ?? 0) === 0) return false;
    if (filters.linkedTaskState === 'none' && (item.linkedTaskCount ?? 0) > 0) return false;
    return true;
  });
}

export function selectFollowUpRows(input: FollowUpSelectorInput): FollowUpItem[] {
  const baseRows = applyBaseFilters(input.items, input);
  return applySavedView(baseRows, input.activeView);
}

export function selectFollowUpViewCounts(input: FollowUpViewScopeInput): FollowUpViewCounts {
  const baseRows = applyBaseFilters(input.items, input);
  return {
    allItems: applySavedView(baseRows, 'All items').length,
    allOpen: applySavedView(baseRows, 'All').length,
    needsNudge: applySavedView(baseRows, 'Needs nudge').length,
    atRisk: applySavedView(baseRows, 'At risk').length,
    readyToClose: applySavedView(baseRows, 'Ready to close').length,
    closed: applySavedView(baseRows, 'Closed').length,
  };
}

export function selectFollowUpQueuePressureCounts(input: FollowUpViewScopeInput): FollowUpQueuePressureCounts {
  const baseRows = applyBaseFilters(input.items, input);
  return {
    allOpen: applySavedView(baseRows, 'All').length,
    needsNudge: applySavedView(baseRows, 'Needs nudge').length,
    atRisk: applySavedView(baseRows, 'At risk').length,
    waiting: applySavedView(baseRows, 'Waiting').length,
    overdue: applySavedView(baseRows, 'Overdue').length,
  };
}

export function buildFollowUpCounts(rows: FollowUpItem[]) {
  const classifications = rows.map((item) => ({ item, classification: classifyFollowUpItem(item) }));
  return {
    total: rows.length,
    allOpen: classifications.filter(({ classification }) => classification.isOpen).length,
    closed: classifications.filter(({ classification }) => classification.isClosed).length,
    overdue: classifications.filter(({ classification }) => classification.isOverdue).length,
    needsNudge: classifications.filter(({ classification }) => classification.laneMemberships.has('needs_nudge')).length,
    atRisk: classifications.filter(({ classification }) => classification.isAtRisk).length,
    waiting: classifications.filter(({ classification }) => classification.isWaiting).length,
    readyToClose: classifications.filter(({ item, classification }) => isReadyToClose(item, classification)).length,
    promisesDueThisWeek: classifications.filter(({ item, classification }) => classification.isOpen && !!item.promisedDate && daysUntil(item.promisedDate) <= 7).length,
    blockedByChild: classifications.filter(({ item, classification }) => classification.isOpen && (item.blockedLinkedTaskCount ?? 0) > 0).length,
    overdueTouches: classifications.filter(({ item, classification }) => {
      if (!classification.isOpen) return false;
      const touchDelta = daysUntil(item.nextTouchDate);
      return Number.isFinite(touchDelta) && touchDelta < 0;
    }).length,
  };
}

export const defaultFollowUpFilters: FollowUpAdvancedFilters = {
  project: 'All',
  status: 'All',
  assignee: 'All',
  owner: 'All',
  waitingOn: 'All',
  escalation: 'All',
  priority: 'All',
  actionState: 'All',
  category: 'All',
  dueDateRange: 'all',
  nextTouchDateRange: 'all',
  promisedDateRange: 'all',
  linkedTaskState: 'all',
  cleanupOnly: false,
};
