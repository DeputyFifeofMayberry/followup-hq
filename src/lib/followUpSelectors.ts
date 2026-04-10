import type { CompanyRecord, ContactRecord, FollowUpAdvancedFilters, FollowUpItem, SavedViewKey } from '../types';
import { daysUntil, isOverdue, needsNudge } from './utils';
import { isExecutionReady } from '../domains/records/integrity';

interface FollowUpSelectorInput {
  items: FollowUpItem[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
  search: string;
  activeView: SavedViewKey;
  filters: FollowUpAdvancedFilters;
}

interface FollowUpViewScopeInput extends Omit<FollowUpSelectorInput, 'activeView'> {}

export interface FollowUpViewCounts {
  allItems: number;
  allOpen: number;
  needsNudge: number;
  atRisk: number;
  readyToClose: number;
  closed: number;
}

export const primaryFollowUpViews: SavedViewKey[] = ['All items', 'All', 'Needs nudge', 'At risk', 'Ready to close', 'Closed'];
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

function isClosed(item: FollowUpItem): boolean {
  return item.status === 'Closed';
}

function isOpen(item: FollowUpItem): boolean {
  return !isClosed(item);
}

function isAtRisk(item: FollowUpItem): boolean {
  return item.status === 'At risk' || item.escalationLevel === 'Critical';
}

function isReadyToClose(item: FollowUpItem): boolean {
  // An item with no linked tasks is a close candidate the moment it's open.
  // An item with linked tasks is only a close candidate once all tasks are done.
  return isOpen(item) && ((item.linkedTaskCount ?? 0) === 0 || !!item.allLinkedTasksDone);
}

function inDateRange(iso: string | undefined, range: FollowUpAdvancedFilters['dueDateRange']): boolean {
  if (range === 'all') return true;
  if (!iso) return false;
  const value = new Date(iso).getTime();
  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  if (range === 'overdue') return value < now;
  if (range === 'today') return value >= startMs && value < startMs + 86400000;
  if (range === 'this_week') return value <= now + 7 * 86400000;
  if (range === 'next_7_days') return value >= startMs && value <= now + 7 * 86400000;
  return true;
}

function applySavedView(items: FollowUpItem[], view: SavedViewKey): FollowUpItem[] {
  const openItems = items.filter(isOpen);
  switch (view) {
    case 'All items':
      return items;
    case 'All':
      return openItems;
    case 'Closed':
      return items.filter(isClosed);
    case 'Today':
      return openItems.filter((item) => isOverdue(item) || daysUntil(item.dueDate) <= 0 || needsNudge(item));
    case 'Waiting':
    case 'Waiting on others':
      return openItems.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal' || !!item.waitingOn);
    case 'Needs nudge':
      return openItems.filter(needsNudge);
    case 'At risk':
      return openItems.filter(isAtRisk);
    case 'Overdue':
      return openItems.filter(isOverdue);
    case 'Ready to close':
      return openItems.filter(isReadyToClose);
    case 'Promises due this week':
      return openItems.filter((item) => !!item.promisedDate && daysUntil(item.promisedDate) <= 7);
    case 'Blocked by child tasks':
      return openItems.filter((item) => (item.blockedLinkedTaskCount ?? 0) > 0 || item.childWorkflowSignal === 'blocked');
    default:
      return openItems;
  }
}

function applyBaseFilters(items: FollowUpItem[], input: FollowUpViewScopeInput): FollowUpItem[] {
  const { contacts, companies, search, filters } = input;
  const scopedItems = filters.cleanupOnly
    ? items.filter((item) => !isExecutionReady(item) || item.needsCleanup)
    : items.filter((item) => isExecutionReady(item));
  const term = search.trim().toLowerCase();

  return scopedItems.filter((item) => {
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
    if (filters.cleanupOnly && !item.needsCleanup) return false;

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

export function buildFollowUpCounts(rows: FollowUpItem[]) {
  const openRows = rows.filter(isOpen);
  return {
    total: rows.length,
    allOpen: openRows.length,
    closed: rows.length - openRows.length,
    overdue: openRows.filter(isOverdue).length,
    needsNudge: openRows.filter(needsNudge).length,
    atRisk: openRows.filter(isAtRisk).length,
    waiting: openRows.filter((item) => item.status.includes('Waiting') || !!item.waitingOn).length,
    readyToClose: openRows.filter(isReadyToClose).length,
    promisesDueThisWeek: openRows.filter((item) => !!item.promisedDate && daysUntil(item.promisedDate) <= 7).length,
    blockedByChild: openRows.filter((item) => (item.blockedLinkedTaskCount ?? 0) > 0).length,
    overdueTouches: openRows.filter((item) => {
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
