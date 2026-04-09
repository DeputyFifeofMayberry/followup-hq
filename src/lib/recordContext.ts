import type { CompanyRecord, ContactRecord, FollowUpItem, ProjectRecord, TaskItem } from '../types';
import { isOverdue, isTaskOverdue } from './utils';

export type RecordType = 'followup' | 'task' | 'project' | 'contact' | 'company';

export interface RecordRef {
  type: RecordType;
  id: string;
}

export interface RecordContextState {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
}

export interface RecordDescriptor {
  id: string;
  type: RecordType;
  title: string;
  subtitle: string;
  status?: string;
  priority?: string;
  owner?: string;
  projectId?: string;
  projectName?: string;
  contactId?: string;
  companyId?: string;
  dueDate?: string;
  updatedAt?: string;
  isClosed: boolean;
}

export interface RelatedRecordBundle {
  selected: RecordDescriptor | null;
  related: RecordDescriptor[];
  counts: RelatedRecordCounts;
}

export interface RelatedRecordCounts {
  relationships: number;
  openChildWork: number;
  blockedChildWork: number;
  overdueChildWork: number;
  timelineEvents: number;
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function projectMatches(project: string | undefined, projectId: string | undefined, targetIdOrName: string): boolean {
  if (!targetIdOrName) return false;
  return projectId === targetIdOrName || project === targetIdOrName;
}

export function getLinkedFollowUpForTask(task: TaskItem, items: FollowUpItem[]): FollowUpItem | null {
  if (!task.linkedFollowUpId) return null;
  return items.find((item) => item.id === task.linkedFollowUpId) ?? null;
}

export function getLinkedTasksForFollowUp(followUpId: string, tasks: TaskItem[]): TaskItem[] {
  return tasks.filter((task) => task.linkedFollowUpId === followUpId);
}

export function getProjectLinkedRecords(projectIdOrName: string, state: RecordContextState) {
  const project = state.projects.find((entry) => entry.id === projectIdOrName || entry.name === projectIdOrName);
  const followups = state.items.filter((item) => projectMatches(item.project, item.projectId, projectIdOrName));
  const tasks = state.tasks.filter((task) => projectMatches(task.project, task.projectId, projectIdOrName));
  const followUpContactIds = followups.map((item) => item.contactId).filter(Boolean) as string[];
  const taskContactIds = tasks.map((task) => task.contactId).filter(Boolean) as string[];
  const followUpCompanyIds = followups.map((item) => item.companyId).filter(Boolean) as string[];
  const taskCompanyIds = tasks.map((task) => task.companyId).filter(Boolean) as string[];
  const directContactIds = project?.linkedContactIds ?? [];
  const directCompanyIds = project?.linkedCompanyIds ?? [];
  const contacts = uniqueById(state.contacts.filter((contact) => [...followUpContactIds, ...taskContactIds, ...directContactIds].includes(contact.id)));
  const companies = uniqueById(state.companies.filter((company) => [...followUpCompanyIds, ...taskCompanyIds, ...directCompanyIds, ...contacts.map((contact) => contact.companyId).filter(Boolean) as string[]].includes(company.id)));
  return { followups, tasks, contacts, companies };
}

export function getCompanyLinkedRecords(companyId: string, state: RecordContextState) {
  const contacts = state.contacts.filter((contact) => contact.companyId === companyId);
  const contactIds = contacts.map((contact) => contact.id);
  const followups = state.items.filter((item) => item.companyId === companyId || (item.contactId && contactIds.includes(item.contactId)));
  const tasks = state.tasks.filter((task) => task.companyId === companyId || (task.contactId && contactIds.includes(task.contactId)));
  const projectKeys = new Set<string>([
    ...followups.map((item) => item.projectId || item.project),
    ...tasks.map((task) => task.projectId || task.project),
  ].filter(Boolean));
  const projects = state.projects.filter((project) => projectKeys.has(project.id) || projectKeys.has(project.name) || (project.linkedCompanyIds ?? []).includes(companyId));
  return { followups, tasks, contacts, projects };
}

export function getContactLinkedRecords(contactId: string, state: RecordContextState) {
  const contact = state.contacts.find((entry) => entry.id === contactId) ?? null;
  const followups = state.items.filter((item) => item.contactId === contactId);
  const tasks = state.tasks.filter((task) => task.contactId === contactId);
  const company = contact?.companyId ? state.companies.find((entry) => entry.id === contact.companyId) ?? null : null;
  const projectKeys = new Set<string>([
    ...followups.map((item) => item.projectId || item.project),
    ...tasks.map((task) => task.projectId || task.project),
  ].filter(Boolean));
  const projects = state.projects.filter((project) => projectKeys.has(project.id) || projectKeys.has(project.name) || (project.linkedContactIds ?? []).includes(contactId));
  return { contact, company, followups, tasks, projects };
}

export function toRecordDescriptor(record: FollowUpItem | TaskItem | ProjectRecord | ContactRecord | CompanyRecord, type: RecordType): RecordDescriptor {
  if (type === 'followup') {
    const item = record as FollowUpItem;
    return {
      id: item.id,
      type,
      title: item.title,
      subtitle: item.project,
      status: item.status,
      priority: item.priority,
      owner: item.assigneeDisplayName || item.owner,
      projectId: item.projectId,
      projectName: item.project,
      contactId: item.contactId,
      companyId: item.companyId,
      dueDate: item.dueDate,
      updatedAt: item.lastActionAt || item.lastTouchDate,
      isClosed: item.status === 'Closed',
    };
  }
  if (type === 'task') {
    const task = record as TaskItem;
    return {
      id: task.id,
      type,
      title: task.title,
      subtitle: task.project,
      status: task.status,
      priority: task.priority,
      owner: task.assigneeDisplayName || task.owner,
      projectId: task.projectId,
      projectName: task.project,
      contactId: task.contactId,
      companyId: task.companyId,
      dueDate: task.dueDate,
      updatedAt: task.updatedAt,
      isClosed: task.status === 'Done',
    };
  }
  if (type === 'project') {
    const project = record as ProjectRecord;
    return {
      id: project.id,
      type,
      title: project.name,
      subtitle: project.phase || project.status,
      status: project.status,
      owner: project.owner,
      updatedAt: project.updatedAt,
      isClosed: project.status === 'Complete',
    };
  }
  if (type === 'contact') {
    const contact = record as ContactRecord;
    return {
      id: contact.id,
      type,
      title: contact.name,
      subtitle: contact.role,
      status: contact.relationshipStatus,
      owner: contact.internalOwner,
      companyId: contact.companyId,
      updatedAt: contact.lastContactedAt || contact.lastResponseAt,
      isClosed: contact.active === false,
    };
  }
  const company = record as CompanyRecord;
  return {
    id: company.id,
    type,
    title: company.name,
    subtitle: company.type,
    status: company.relationshipStatus,
    owner: company.internalOwner,
    updatedAt: company.lastReviewedAt,
    isClosed: company.active === false,
  };
}

function deriveCounts(related: RecordDescriptor[], state: RecordContextState): RelatedRecordCounts {
  const relatedTaskIds = related.filter((entry) => entry.type === 'task').map((entry) => entry.id);
  const relatedFollowUpIds = related.filter((entry) => entry.type === 'followup').map((entry) => entry.id);
  const taskRows = state.tasks.filter((task) => relatedTaskIds.includes(task.id));
  const followUpRows = state.items.filter((item) => relatedFollowUpIds.includes(item.id));
  const openChildWork = taskRows.filter((task) => task.status !== 'Done').length + followUpRows.filter((item) => item.status !== 'Closed').length;
  const blockedChildWork = taskRows.filter((task) => task.status === 'Blocked').length + followUpRows.filter((item) => item.status === 'At risk').length;
  const overdueChildWork = taskRows.filter(isTaskOverdue).length + followUpRows.filter(isOverdue).length;
  const timelineEvents = followUpRows.reduce((sum, item) => sum + item.timeline.length + (item.auditHistory?.length ?? 0), 0)
    + taskRows.reduce((sum, task) => sum + (task.auditHistory?.length ?? 0), 0);
  return {
    relationships: related.length,
    openChildWork,
    blockedChildWork,
    overdueChildWork,
    timelineEvents,
  };
}

export function getRelatedRecordBundle(ref: RecordRef, state: RecordContextState): RelatedRecordBundle {
  let selected: RecordDescriptor | null = null;
  let related: RecordDescriptor[] = [];

  if (ref.type === 'followup') {
    const item = state.items.find((entry) => entry.id === ref.id);
    if (!item) return { selected: null, related: [], counts: deriveCounts([], state) };
    selected = toRecordDescriptor(item, 'followup');
    const linkedTasks = getLinkedTasksForFollowUp(item.id, state.tasks).map((task) => toRecordDescriptor(task, 'task'));
    const projectRecords = item.projectId ? getProjectLinkedRecords(item.projectId, state) : getProjectLinkedRecords(item.project, state);
    related = uniqueById([
      ...linkedTasks,
      ...projectRecords.tasks.filter((task) => task.id !== item.id).map((task) => toRecordDescriptor(task, 'task')),
      ...projectRecords.followups.filter((followup) => followup.id !== item.id).map((followup) => toRecordDescriptor(followup, 'followup')),
      ...projectRecords.contacts.map((contact) => toRecordDescriptor(contact, 'contact')),
      ...projectRecords.companies.map((company) => toRecordDescriptor(company, 'company')),
    ]);
  } else if (ref.type === 'task') {
    const task = state.tasks.find((entry) => entry.id === ref.id);
    if (!task) return { selected: null, related: [], counts: deriveCounts([], state) };
    selected = toRecordDescriptor(task, 'task');
    const parent = getLinkedFollowUpForTask(task, state.items);
    const projectRecords = task.projectId ? getProjectLinkedRecords(task.projectId, state) : getProjectLinkedRecords(task.project, state);
    related = uniqueById([
      ...(parent ? [toRecordDescriptor(parent, 'followup')] : []),
      ...projectRecords.tasks.filter((entry) => entry.id !== task.id).map((entry) => toRecordDescriptor(entry, 'task')),
      ...projectRecords.followups.map((entry) => toRecordDescriptor(entry, 'followup')),
      ...projectRecords.contacts.map((entry) => toRecordDescriptor(entry, 'contact')),
      ...projectRecords.companies.map((entry) => toRecordDescriptor(entry, 'company')),
    ]);
  } else if (ref.type === 'project') {
    const project = state.projects.find((entry) => entry.id === ref.id);
    if (!project) return { selected: null, related: [], counts: deriveCounts([], state) };
    selected = toRecordDescriptor(project, 'project');
    const projectRecords = getProjectLinkedRecords(project.id, state);
    related = uniqueById([
      ...projectRecords.followups.map((entry) => toRecordDescriptor(entry, 'followup')),
      ...projectRecords.tasks.map((entry) => toRecordDescriptor(entry, 'task')),
      ...projectRecords.contacts.map((entry) => toRecordDescriptor(entry, 'contact')),
      ...projectRecords.companies.map((entry) => toRecordDescriptor(entry, 'company')),
    ]);
  } else if (ref.type === 'contact') {
    const linked = getContactLinkedRecords(ref.id, state);
    if (!linked.contact) return { selected: null, related: [], counts: deriveCounts([], state) };
    selected = toRecordDescriptor(linked.contact, 'contact');
    related = uniqueById([
      ...linked.followups.map((entry) => toRecordDescriptor(entry, 'followup')),
      ...linked.tasks.map((entry) => toRecordDescriptor(entry, 'task')),
      ...linked.projects.map((entry) => toRecordDescriptor(entry, 'project')),
      ...(linked.company ? [toRecordDescriptor(linked.company, 'company')] : []),
    ]);
  } else {
    const company = state.companies.find((entry) => entry.id === ref.id);
    if (!company) return { selected: null, related: [], counts: deriveCounts([], state) };
    selected = toRecordDescriptor(company, 'company');
    const linked = getCompanyLinkedRecords(company.id, state);
    related = uniqueById([
      ...linked.followups.map((entry) => toRecordDescriptor(entry, 'followup')),
      ...linked.tasks.map((entry) => toRecordDescriptor(entry, 'task')),
      ...linked.contacts.map((entry) => toRecordDescriptor(entry, 'contact')),
      ...linked.projects.map((entry) => toRecordDescriptor(entry, 'project')),
    ]);
  }

  return {
    selected,
    related,
    counts: deriveCounts(related, state),
  };
}
