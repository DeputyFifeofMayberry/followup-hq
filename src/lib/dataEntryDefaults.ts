import type { FollowUpFormInput, SourceType, TaskItem, TaskStatus } from '../types';
import { addDaysIso, todayIso } from './utils';

const STORAGE_KEY = 'followup-hq:data-entry-defaults:v1';

type DefaultsState = {
  followUpOwner?: string;
  followUpProject?: string;
  followUpProjectId?: string;
  followUpSource?: SourceType;
  followUpStatus?: FollowUpFormInput['status'];
  followUpCadenceDays?: number;
  taskOwner?: string;
  taskProject?: string;
  taskProjectId?: string;
  taskStatus?: TaskStatus;
  lastWorkMode?: 'followup' | 'task';
};

export type RecentEntryContext = {
  owner?: string;
  project?: string;
  projectId?: string;
};

function readDefaults(): DefaultsState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DefaultsState;
  } catch {
    return {};
  }
}

function writeDefaults(next: DefaultsState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getRecentEntryContext(): RecentEntryContext {
  const recents = readDefaults();
  return {
    owner: recents.followUpOwner || recents.taskOwner,
    project: recents.followUpProject || recents.taskProject,
    projectId: recents.followUpProjectId || recents.taskProjectId,
  };
}

export function buildSmartFollowUpDefaults(context: { projectFilter?: string; projectId?: string; projectName?: string } = {}): FollowUpFormInput {
  const now = todayIso();
  const recents = readDefaults();
  const projectFromContext = context.projectFilter && context.projectFilter !== 'All' ? context.projectFilter : context.projectName;
  const project = projectFromContext || recents.followUpProject || '';
  const status = recents.followUpStatus || 'Needs action';
  const isWaiting = status === 'Waiting on external' || status === 'Waiting internal';
  const cadenceDays = recents.followUpCadenceDays || (isWaiting ? 2 : 3);

  return {
    title: '',
    source: recents.followUpSource || 'Email',
    project,
    projectId: context.projectId || recents.followUpProjectId || '',
    owner: recents.followUpOwner || '',
    status,
    priority: 'Medium',
    dueDate: addDaysIso(now, 2),
    promisedDate: '',
    nextTouchDate: addDaysIso(now, cadenceDays),
    nextAction: '',
    summary: '',
    tags: [],
    sourceRef: '',
    waitingOn: '',
    notes: '',
    category: 'General',
    owesNextAction: isWaiting ? 'Client' : 'Unknown',
    escalationLevel: 'None',
    cadenceDays,
    contactId: '',
    companyId: '',
    threadKey: '',
    draftFollowUp: '',
  };
}

export function rememberFollowUpDefaults(input: FollowUpFormInput) {
  const recents = readDefaults();
  writeDefaults({
    ...recents,
    followUpOwner: input.owner || recents.followUpOwner,
    followUpProject: input.project || recents.followUpProject,
    followUpProjectId: input.projectId || recents.followUpProjectId,
    followUpSource: input.source,
    followUpStatus: input.status,
    followUpCadenceDays: input.cadenceDays,
    lastWorkMode: 'followup',
  });
}

export function buildSmartTaskDefaults(context: { projectFilter?: string; projectId?: string; projectName?: string } = {}): TaskItem {
  const recents = readDefaults();
  const now = todayIso();
  const projectFromContext = context.projectFilter && context.projectFilter !== 'All' ? context.projectFilter : context.projectName;
  const project = projectFromContext || recents.taskProject || '';
  return {
    id: '',
    title: '',
    project,
    projectId: context.projectId || recents.taskProjectId,
    owner: recents.taskOwner || '',
    status: recents.taskStatus || 'To do',
    priority: 'Medium',
    dueDate: '',
    startDate: now,
    summary: '',
    nextStep: '',
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function rememberTaskDefaults(task: TaskItem) {
  const recents = readDefaults();
  writeDefaults({
    ...recents,
    taskOwner: task.owner || recents.taskOwner,
    taskProject: task.project || recents.taskProject,
    taskProjectId: task.projectId || recents.taskProjectId,
    taskStatus: task.status,
    lastWorkMode: 'task',
  });
}

export function getRecentWorkMode(): 'followup' | 'task' {
  return readDefaults().lastWorkMode || 'followup';
}
