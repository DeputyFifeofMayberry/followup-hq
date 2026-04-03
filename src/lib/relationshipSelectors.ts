import type { CompanyRecord, CompanyType, ContactRecord, FollowUpItem, TaskItem } from '../types';
import { daysSince, isOverdue, isTaskOverdue } from './utils';

export type RelationshipEntityType = 'contact' | 'company';
export type RelationshipSortKey = 'pressure' | 'name' | 'activeProjects' | 'waiting' | 'overdue' | 'touchAge' | 'risk';

export interface RelationshipSummary {
  id: string;
  entityType: RelationshipEntityType;
  name: string;
  subtitle: string;
  role?: string;
  companyType?: CompanyType;
  internalOwner: string;
  riskTier: 'Low' | 'Medium' | 'High' | 'Critical';
  relationshipStatus: 'Active' | 'Watch' | 'Escalated' | 'Dormant';
  openFollowUps: number;
  waitingFollowUps: number;
  overdueFollowUps: number;
  openTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  activeProjectCount: number;
  averageTouchAge: number;
  linkedRiskCount: number;
  stale: boolean;
  pressureScore: number;
}

export interface RelationshipFilterState {
  search: string;
  entityType: 'all' | RelationshipEntityType;
  companyType: 'all' | CompanyType;
  role: 'all' | string;
  minActiveProjects: number;
  minWaitingPressure: number;
  minOverduePressure: number;
  minBlockedTaskPressure: number;
  staleOnly: boolean;
  internalOwner: 'all' | string;
  riskTier: 'all' | RelationshipSummary['riskTier'];
}

export interface RelationshipSavedView {
  id: string;
  label: string;
  description: string;
  filter: Partial<RelationshipFilterState>;
  sortBy?: RelationshipSortKey;
  sortDirection?: 'asc' | 'desc';
}

export const defaultRelationshipFilter: RelationshipFilterState = {
  search: '',
  entityType: 'all',
  companyType: 'all',
  role: 'all',
  minActiveProjects: 0,
  minWaitingPressure: 0,
  minOverduePressure: 0,
  minBlockedTaskPressure: 0,
  staleOnly: false,
  internalOwner: 'all',
  riskTier: 'all',
};

export const relationshipSavedViews: RelationshipSavedView[] = [
  {
    id: 'hot_contacts',
    label: 'Hot contacts',
    description: 'Contacts with immediate pressure across follow-ups and tasks.',
    filter: { entityType: 'contact', minWaitingPressure: 1, minOverduePressure: 1 },
    sortBy: 'pressure',
    sortDirection: 'desc',
  },
  {
    id: 'gov_bottlenecks',
    label: 'Government bottlenecks',
    description: 'Government entities with waiting and overdue pressure.',
    filter: { companyType: 'Government', minWaitingPressure: 1, minOverduePressure: 1 },
    sortBy: 'overdue',
    sortDirection: 'desc',
  },
  {
    id: 'vendors_overdue',
    label: 'Vendors with overdue work',
    description: 'Vendor relationships that have overdue follow-ups or tasks.',
    filter: { companyType: 'Vendor', minOverduePressure: 1 },
    sortBy: 'overdue',
    sortDirection: 'desc',
  },
  {
    id: 'dormant_records',
    label: 'Dormant records',
    description: 'Relationships with stale touch history.',
    filter: { staleOnly: true },
    sortBy: 'touchAge',
    sortDirection: 'desc',
  },
  {
    id: 'multi_project_companies',
    label: 'Multi-project companies',
    description: 'Companies active across multiple projects.',
    filter: { entityType: 'company', minActiveProjects: 2 },
    sortBy: 'activeProjects',
    sortDirection: 'desc',
  },
];

function pressureFrom(summary: Pick<RelationshipSummary, 'waitingFollowUps' | 'overdueFollowUps' | 'blockedTasks' | 'overdueTasks' | 'linkedRiskCount'>): number {
  return summary.waitingFollowUps + summary.overdueFollowUps * 2 + summary.blockedTasks * 2 + summary.overdueTasks * 2 + summary.linkedRiskCount;
}

function normalizeRisk(input?: string): RelationshipSummary['riskTier'] {
  if (input === 'Critical' || input === 'High' || input === 'Medium') return input;
  return 'Low';
}

function normalizeRelationshipStatus(input?: string): RelationshipSummary['relationshipStatus'] {
  if (input === 'Watch' || input === 'Escalated' || input === 'Dormant') return input;
  return 'Active';
}

export function buildRelationshipSummaries(items: FollowUpItem[], tasks: TaskItem[], contacts: ContactRecord[], companies: CompanyRecord[]): RelationshipSummary[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));

  const contactSummaries: RelationshipSummary[] = contacts.map((contact) => {
    const linkedFollowUps = items.filter((item) => item.contactId === contact.id);
    const linkedTasks = tasks.filter((task) => task.contactId === contact.id);
    const projectKeys = new Set<string>();
    linkedFollowUps.forEach((item) => projectKeys.add(item.projectId || item.project));
    linkedTasks.forEach((task) => projectKeys.add(task.projectId || task.project));
    const touchAges = [
      ...linkedFollowUps.map((item) => daysSince(item.lastTouchDate)),
      ...linkedTasks.map((task) => daysSince(task.updatedAt)),
    ];
    const waitingFollowUps = linkedFollowUps.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal' || !!item.waitingOn).length;
    const overdueFollowUps = linkedFollowUps.filter(isOverdue).length;
    const openFollowUps = linkedFollowUps.filter((item) => item.status !== 'Closed').length;
    const openTasks = linkedTasks.filter((task) => task.status !== 'Done').length;
    const blockedTasks = linkedTasks.filter((task) => task.status === 'Blocked').length;
    const overdueTasks = linkedTasks.filter(isTaskOverdue).length;
    const linkedRiskCount = linkedFollowUps.filter((item) => item.escalationLevel === 'Critical' || item.status === 'At risk').length
      + linkedTasks.filter((task) => task.priority === 'Critical' || task.status === 'Blocked').length;
    const averageTouchAge = touchAges.length ? Math.round(touchAges.reduce((sum, age) => sum + age, 0) / touchAges.length) : 999;
    const summary: RelationshipSummary = {
      id: contact.id,
      entityType: 'contact',
      name: contact.name,
      subtitle: companyById.get(contact.companyId || '')?.name || 'No company linked',
      role: contact.role,
      companyType: companyById.get(contact.companyId || '')?.type,
      internalOwner: contact.internalOwner || 'Unassigned',
      riskTier: normalizeRisk(contact.riskTier),
      relationshipStatus: normalizeRelationshipStatus(contact.relationshipStatus),
      openFollowUps,
      waitingFollowUps,
      overdueFollowUps,
      openTasks,
      blockedTasks,
      overdueTasks,
      activeProjectCount: projectKeys.size,
      averageTouchAge: Number.isFinite(averageTouchAge) ? averageTouchAge : 999,
      linkedRiskCount,
      stale: averageTouchAge >= 14,
      pressureScore: 0,
    };
    return { ...summary, pressureScore: pressureFrom(summary) };
  });

  const companySummaries: RelationshipSummary[] = companies.map((company) => {
    const linkedContactIds = contacts.filter((contact) => contact.companyId === company.id).map((contact) => contact.id);
    const linkedFollowUps = items.filter((item) => item.companyId === company.id || (item.contactId && linkedContactIds.includes(item.contactId)));
    const linkedTasks = tasks.filter((task) => task.companyId === company.id || (task.contactId && linkedContactIds.includes(task.contactId)));
    const projectKeys = new Set<string>();
    linkedFollowUps.forEach((item) => projectKeys.add(item.projectId || item.project));
    linkedTasks.forEach((task) => projectKeys.add(task.projectId || task.project));
    const touchAges = [
      ...linkedFollowUps.map((item) => daysSince(item.lastTouchDate)),
      ...linkedTasks.map((task) => daysSince(task.updatedAt)),
    ];
    const waitingFollowUps = linkedFollowUps.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal' || !!item.waitingOn).length;
    const overdueFollowUps = linkedFollowUps.filter(isOverdue).length;
    const openFollowUps = linkedFollowUps.filter((item) => item.status !== 'Closed').length;
    const openTasks = linkedTasks.filter((task) => task.status !== 'Done').length;
    const blockedTasks = linkedTasks.filter((task) => task.status === 'Blocked').length;
    const overdueTasks = linkedTasks.filter(isTaskOverdue).length;
    const linkedRiskCount = linkedFollowUps.filter((item) => item.escalationLevel === 'Critical' || item.status === 'At risk').length
      + linkedTasks.filter((task) => task.priority === 'Critical' || task.status === 'Blocked').length;
    const averageTouchAge = touchAges.length ? Math.round(touchAges.reduce((sum, age) => sum + age, 0) / touchAges.length) : 999;
    const summary: RelationshipSummary = {
      id: company.id,
      entityType: 'company',
      name: company.name,
      subtitle: company.type,
      companyType: company.type,
      internalOwner: company.internalOwner || 'Unassigned',
      riskTier: normalizeRisk(company.riskTier),
      relationshipStatus: normalizeRelationshipStatus(company.relationshipStatus),
      openFollowUps,
      waitingFollowUps,
      overdueFollowUps,
      openTasks,
      blockedTasks,
      overdueTasks,
      activeProjectCount: projectKeys.size,
      averageTouchAge: Number.isFinite(averageTouchAge) ? averageTouchAge : 999,
      linkedRiskCount,
      stale: averageTouchAge >= 14,
      pressureScore: 0,
    };
    return { ...summary, pressureScore: pressureFrom(summary) };
  });

  return [...contactSummaries, ...companySummaries];
}

export function filterRelationshipSummaries(rows: RelationshipSummary[], filter: RelationshipFilterState): RelationshipSummary[] {
  const term = filter.search.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = [row.name, row.subtitle, row.role || '', row.internalOwner].join(' ').toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (filter.entityType !== 'all' && row.entityType !== filter.entityType) return false;
    if (filter.companyType !== 'all' && row.companyType !== filter.companyType) return false;
    if (filter.role !== 'all' && (row.role || 'Unknown') !== filter.role) return false;
    if (row.activeProjectCount < filter.minActiveProjects) return false;
    if (row.waitingFollowUps < filter.minWaitingPressure) return false;
    if (row.overdueFollowUps + row.overdueTasks < filter.minOverduePressure) return false;
    if (row.blockedTasks < filter.minBlockedTaskPressure) return false;
    if (filter.staleOnly && !row.stale) return false;
    if (filter.internalOwner !== 'all' && row.internalOwner !== filter.internalOwner) return false;
    if (filter.riskTier !== 'all' && row.riskTier !== filter.riskTier) return false;
    return true;
  });
}

function riskWeight(risk: RelationshipSummary['riskTier']): number {
  if (risk === 'Critical') return 4;
  if (risk === 'High') return 3;
  if (risk === 'Medium') return 2;
  return 1;
}

export function sortRelationshipSummaries(rows: RelationshipSummary[], sortBy: RelationshipSortKey, direction: 'asc' | 'desc'): RelationshipSummary[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortBy === 'name') return dir * a.name.localeCompare(b.name);
    if (sortBy === 'activeProjects') return dir * (a.activeProjectCount - b.activeProjectCount || a.pressureScore - b.pressureScore);
    if (sortBy === 'waiting') return dir * (a.waitingFollowUps - b.waitingFollowUps || a.pressureScore - b.pressureScore);
    if (sortBy === 'overdue') return dir * ((a.overdueFollowUps + a.overdueTasks) - (b.overdueFollowUps + b.overdueTasks) || a.pressureScore - b.pressureScore);
    if (sortBy === 'touchAge') return dir * (a.averageTouchAge - b.averageTouchAge || a.pressureScore - b.pressureScore);
    if (sortBy === 'risk') return dir * (riskWeight(a.riskTier) - riskWeight(b.riskTier) || a.pressureScore - b.pressureScore);
    return dir * (a.pressureScore - b.pressureScore || a.overdueFollowUps - b.overdueFollowUps);
  });
}

export function buildOwnerSummaryWithTasks(items: FollowUpItem[], tasks: TaskItem[]) {
  const owners = new Set<string>();
  items.forEach((item) => owners.add(item.owner || 'Unassigned'));
  tasks.forEach((task) => owners.add(task.owner || 'Unassigned'));
  return [...owners].map((owner) => {
    const ownerItems = items.filter((item) => (item.owner || 'Unassigned') === owner);
    const ownerTasks = tasks.filter((task) => (task.owner || 'Unassigned') === owner);
    return {
      owner,
      activeCount: ownerItems.filter((item) => item.status !== 'Closed').length + ownerTasks.filter((task) => task.status !== 'Done').length,
      waitingCount: ownerItems.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal' || !!item.waitingOn).length,
      overdueCount: ownerItems.filter(isOverdue).length + ownerTasks.filter(isTaskOverdue).length,
      needsNudgeCount: ownerItems.filter((item) => item.status !== 'Closed' && item.nextTouchDate && new Date(item.nextTouchDate).getTime() <= Date.now()).length,
      escalatedCount: ownerItems.filter((item) => item.escalationLevel !== 'None').length + ownerTasks.filter((task) => task.status === 'Blocked').length,
    };
  }).sort((a, b) => b.activeCount - a.activeCount);
}
