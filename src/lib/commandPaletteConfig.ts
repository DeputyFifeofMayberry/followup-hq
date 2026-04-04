import type { WorkspaceKey } from './appModeConfig';
import { toRecordDescriptor, type RecordDescriptor, type RecordRef, type RecordType } from './recordContext';
import type { CompanyRecord, ContactRecord, FollowUpItem, ProjectRecord, TaskItem } from '../types';

export type AppCommandGroup = 'Create' | 'Workspaces' | 'Records' | 'Navigation';

export interface AppCommand {
  id: string;
  label: string;
  subtitle?: string;
  group: AppCommandGroup;
  recordType?: RecordType;
  searchableText: string;
  run: () => void;
}

export interface CommandPaletteRecordSearchIndex {
  descriptors: RecordDescriptor[];
  descriptorByRef: Map<string, RecordDescriptor>;
  linkedRefsByDescriptorId: Map<string, RecordRef[]>;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(command: AppCommand, rawQuery: string): number {
  const query = normalize(rawQuery);
  if (!query) return 1;
  const label = normalize(command.label);
  const subtitle = normalize(command.subtitle ?? '');
  const haystack = normalize(command.searchableText);

  if (label === query) return 240;
  if (label.startsWith(query)) return 180;
  if (subtitle === query) return 170;

  const tokens = query.split(' ').filter(Boolean);
  const labelTokens = label.split(' ').filter(Boolean);
  const subtitleTokens = subtitle.split(' ').filter(Boolean);
  const haystackTokens = haystack.split(' ').filter(Boolean);

  let score = 0;
  for (const token of tokens) {
    if (labelTokens.includes(token)) {
      score += 35;
      continue;
    }
    if (subtitleTokens.includes(token)) {
      score += 24;
      continue;
    }
    if (labelTokens.some((entry) => entry.startsWith(token))) {
      score += 22;
      continue;
    }
    if (subtitleTokens.some((entry) => entry.startsWith(token))) {
      score += 16;
      continue;
    }
    if (haystackTokens.some((entry) => entry.startsWith(token))) {
      score += 12;
      continue;
    }
    if (haystack.includes(token)) {
      score += 8;
      continue;
    }
    return -1;
  }

  if (command.group === 'Records') score += 6;
  return score;
}

function refKey(type: RecordType, id: string): string {
  return `${type}:${id}`;
}

export function buildGlobalRecordSearchIndex(input: {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
}): CommandPaletteRecordSearchIndex {
  const descriptors = [
    ...input.items.map((item) => toRecordDescriptor(item, 'followup')),
    ...input.tasks.map((task) => toRecordDescriptor(task, 'task')),
    ...input.projects.map((project) => toRecordDescriptor(project, 'project')),
    ...input.contacts.map((contact) => toRecordDescriptor(contact, 'contact')),
    ...input.companies.map((company) => toRecordDescriptor(company, 'company')),
  ];

  const descriptorByRef = new Map<string, RecordDescriptor>();
  descriptors.forEach((descriptor) => {
    descriptorByRef.set(refKey(descriptor.type, descriptor.id), descriptor);
  });

  const linkedRefsByDescriptorId = new Map<string, RecordRef[]>();
  input.items.forEach((item) => {
    const refs: RecordRef[] = [];
    if (item.linkedTaskCount || item.openLinkedTaskCount) {
      input.tasks
        .filter((task) => task.linkedFollowUpId === item.id)
        .slice(0, 4)
        .forEach((task) => refs.push({ type: 'task', id: task.id }));
    }
    if (item.projectId) refs.push({ type: 'project', id: item.projectId });
    linkedRefsByDescriptorId.set(refKey('followup', item.id), refs);
  });

  input.tasks.forEach((task) => {
    const refs: RecordRef[] = [];
    if (task.linkedFollowUpId) refs.push({ type: 'followup', id: task.linkedFollowUpId });
    if (task.projectId) refs.push({ type: 'project', id: task.projectId });
    linkedRefsByDescriptorId.set(refKey('task', task.id), refs);
  });

  input.projects.forEach((project) => {
    linkedRefsByDescriptorId.set(refKey('project', project.id), []);
  });

  input.contacts.forEach((contact) => {
    const refs: RecordRef[] = [];
    if (contact.companyId) refs.push({ type: 'company', id: contact.companyId });
    linkedRefsByDescriptorId.set(refKey('contact', contact.id), refs);
  });

  input.companies.forEach((company) => {
    const refs: RecordRef[] = [];
    if (company.primaryContactId) refs.push({ type: 'contact', id: company.primaryContactId });
    linkedRefsByDescriptorId.set(refKey('company', company.id), refs);
  });

  return { descriptors, descriptorByRef, linkedRefsByDescriptorId };
}

const recordTypeLabel: Record<RecordType, string> = {
  followup: 'Follow-up',
  task: 'Task',
  project: 'Project',
  contact: 'Contact',
  company: 'Company',
};

function descriptorSubtitle(descriptor: RecordDescriptor): string {
  return [descriptor.projectName, descriptor.status, descriptor.owner].filter(Boolean).join(' • ');
}

export function buildCommandPaletteConfig(input: {
  orderedWorkspaces: WorkspaceKey[];
  getWorkspaceLabel: (workspace: WorkspaceKey) => string;
  openCreateModal: () => void;
  openCreateTaskModal: () => void;
  setWorkspace: (workspace: WorkspaceKey) => void;
  openRecordDrawer: (ref: RecordRef) => void;
  openProjectContext: (projectName: string) => void;
  openSelectedInDrawer: () => void;
  recordIndex: CommandPaletteRecordSearchIndex;
}): AppCommand[] {
  const base: AppCommand[] = [
    { id: 'create-followup', group: 'Create', label: 'New follow-up', searchableText: 'new follow-up create', run: () => input.openCreateModal() },
    { id: 'create-task', group: 'Create', label: 'New task', searchableText: 'new task create', run: () => input.openCreateTaskModal() },
    { id: 'nav-open-selected', group: 'Navigation', label: 'Open selected item in universal drawer', searchableText: 'open selected record drawer detail', run: () => input.openSelectedInDrawer() },
  ];

  const workspaceCommands = input.orderedWorkspaces.map((key) => {
    const workspaceLabel = input.getWorkspaceLabel(key);
    return {
      id: `workspace-${key}`,
      group: 'Workspaces' as const,
      label: `Open ${workspaceLabel.toLowerCase()}`,
      subtitle: workspaceLabel,
      searchableText: `open workspace ${workspaceLabel}`,
      run: () => input.setWorkspace(key),
    };
  });

  const recordCommands = input.recordIndex.descriptors.map((descriptor) => ({
    id: `record-${descriptor.type}-${descriptor.id}`,
    group: 'Records' as const,
    recordType: descriptor.type,
    label: `${recordTypeLabel[descriptor.type]} · ${descriptor.title}`,
    subtitle: descriptorSubtitle(descriptor),
    searchableText: [
      descriptor.title,
      descriptor.subtitle,
      descriptor.status,
      descriptor.owner,
      descriptor.projectName,
      recordTypeLabel[descriptor.type],
      descriptor.id,
    ].filter(Boolean).join(' '),
    run: () => {
      if (descriptor.type === 'project') {
        input.openProjectContext(descriptor.title);
      }
      input.openRecordDrawer({ type: descriptor.type, id: descriptor.id });
    },
  }));

  const linkedNavigationCommands: AppCommand[] = input.recordIndex.descriptors.flatMap((descriptor) => {
    const linkedRefs = input.recordIndex.linkedRefsByDescriptorId.get(refKey(descriptor.type, descriptor.id)) ?? [];
    return linkedRefs.reduce<AppCommand[]>((commands, linkedRef) => {
      const linkedDescriptor = input.recordIndex.descriptorByRef.get(refKey(linkedRef.type, linkedRef.id));
      if (!linkedDescriptor) return commands;
      commands.push({
          id: `jump-${descriptor.type}-${descriptor.id}-${linkedRef.type}-${linkedRef.id}`,
          group: 'Navigation' as const,
          recordType: linkedDescriptor.type,
          label: `Jump to linked ${recordTypeLabel[linkedDescriptor.type].toLowerCase()} · ${linkedDescriptor.title}`,
          subtitle: `${recordTypeLabel[descriptor.type]} · ${descriptor.title}`,
          searchableText: `jump linked ${descriptor.title} ${linkedDescriptor.title} ${recordTypeLabel[linkedDescriptor.type]}`,
          run: () => input.openRecordDrawer({ type: linkedDescriptor.type, id: linkedDescriptor.id }),
      });
      return commands;
    }, []);
  });

  const projectContextCommands = input.recordIndex.descriptors
    .filter((descriptor) => descriptor.type === 'project')
    .map((project) => ({
      id: `project-context-${project.id}`,
      group: 'Navigation' as const,
      recordType: 'project' as const,
      label: `Open project context · ${project.title}`,
      subtitle: project.subtitle,
      searchableText: `project context lane ${project.title} ${project.subtitle}`,
      run: () => input.openProjectContext(project.title),
    }));

  return [...base, ...workspaceCommands, ...projectContextCommands, ...linkedNavigationCommands, ...recordCommands];
}

export function filterCommands(commands: AppCommand[], query: string): AppCommand[] {
  const ranked = commands
    .map((command, index) => ({ command, score: scoreMatch(command, query), index }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
  return ranked.map((entry) => entry.command);
}
