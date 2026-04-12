import type { AppMode } from '../types';
import { brand } from '../config/brand';

export type WorkspaceKey = 'overview' | 'followups' | 'tasks' | 'intake' | 'directory' | 'exports';
export type WorkspaceCategory = 'core' | 'support';
export type WorkspaceActionKey = 'new-followup' | 'new-task' | 'new-work' | 'none';

export interface WorkspacePrimaryAction {
  label: string;
  actionKey: WorkspaceActionKey;
  primary?: boolean;
}

export interface WorkspaceHealthContext {
  navCounts: Partial<Record<WorkspaceKey, number>>;
  totalItems: number;
  combinedCleanup: number;
}

export interface WorkspaceMeta {
  userLabel: string;
  shellTitle: string;
  shellPurpose: string;
  category: WorkspaceCategory;
  startSurface: boolean;
  primaryAction?: WorkspacePrimaryAction;
  healthLabel: (context: WorkspaceHealthContext) => string;
}

export interface AppModeConfig {
  displayName: string;
  shellLabel: string;
  shellDescription: string;
  supportViewsMuted: boolean;
  supportActionsSecondary: boolean;
  emphasizeCoordinationActions: boolean;
  showOwnerHeavyControls: boolean;
  trackerOwnerContext: 'compact' | 'full';
  overviewSubtitle: string;
  taskSubtitle: string;
  directorySubtitle: string;
  projectsSubtitle: string;
  relationshipsSubtitle: string;
  workspaceMeta: Record<WorkspaceKey, WorkspaceMeta>;
}

const workspaceOrder: WorkspaceKey[] = ['overview', 'followups', 'tasks', 'intake', 'directory', 'exports'];

export const getWorkspaceOrder = () => workspaceOrder;

const buildWorkspaceMeta = (mode: AppMode): Record<WorkspaceKey, WorkspaceMeta> => ({
  overview: {
    userLabel: 'Overview',
    shellTitle: 'Overview',
    shellPurpose: "Start here to triage today's work and route it into execution.",
    category: 'core',
    startSurface: true,
    primaryAction: { label: 'Create work item', actionKey: 'new-work', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.overview || 0} require same-day direction`,
  },
  followups: {
    userLabel: 'Follow Ups',
    shellTitle: 'Follow Ups',
    shellPurpose: mode === 'personal'
      ? 'Track follow-up commitments, nudges, and closeout readiness.'
      : 'Track team commitments, escalations, and closeout readiness.',
    category: 'core',
    startSurface: false,
    primaryAction: { label: 'Add follow-up', actionKey: 'new-followup', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.followups || 0} active commitments`,
  },
  tasks: {
    userLabel: 'Tasks',
    shellTitle: 'Tasks',
    shellPurpose: mode === 'personal'
      ? 'Execute assigned tasks and handoffs.'
      : 'Execute team tasks with ownership and linked commitment context.',
    category: 'core',
    startSurface: false,
    primaryAction: { label: 'Add task', actionKey: 'new-task', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.tasks || 0} open tasks`,
  },
  intake: {
    userLabel: 'Intake',
    shellTitle: 'Intake',
    shellPurpose: mode === 'personal'
      ? 'Review inbound work before routing it into Follow Ups or Tasks.'
      : 'Review inbound team updates before routing them into Follow Ups or Tasks.',
    category: 'support',
    startSurface: false,
    healthLabel: ({ combinedCleanup }) => `${combinedCleanup} need cleanup`,
  },
  directory: {
    userLabel: 'Directory',
    shellTitle: 'Directory',
    shellPurpose: mode === 'personal'
      ? 'Master directory for projects, people, and companies.'
      : 'Operational directory for projects, people, and companies.',
    category: 'support',
    startSurface: false,
    healthLabel: ({ totalItems }) => `${totalItems} linked follow-ups`,
  },
  exports: {
    userLabel: 'Reports',
    shellTitle: 'Reports',
    shellPurpose: mode === 'personal'
      ? 'Operational reports for execution pressure, risk, and closeout readiness.'
      : 'Team reporting workspace for execution pressure, accountability, and export handoff.',
    category: 'support',
    startSurface: false,
    healthLabel: ({ navCounts }) => `${navCounts.exports || 0} reports need attention`,
  },
});

export const appModeConfig: Record<AppMode, AppModeConfig> = {
  personal: {
    displayName: 'Personal',
    shellLabel: `${brand.appName} workspace`,
    shellDescription: 'Personal execution workspace.',
    supportViewsMuted: true,
    supportActionsSecondary: true,
    emphasizeCoordinationActions: false,
    showOwnerHeavyControls: false,
    trackerOwnerContext: 'compact',
    overviewSubtitle: 'Start here: triage and route the highest-priority work.',
    taskSubtitle: 'Execution queue for assigned actions and measurable completion.',
    directorySubtitle: 'Master context for projects, people, and companies.',
    projectsSubtitle: 'Operational project pressure is available in Directory > Operational context.',
    relationshipsSubtitle: 'People and company relationship context now lives inside Directory.',
    workspaceMeta: buildWorkspaceMeta('personal'),
  },
  team: {
    displayName: 'Team',
    shellLabel: `${brand.appName} workspace`,
    shellDescription: 'Team coordination workspace.',
    supportViewsMuted: false,
    supportActionsSecondary: false,
    emphasizeCoordinationActions: true,
    showOwnerHeavyControls: true,
    trackerOwnerContext: 'full',
    overviewSubtitle: 'Start here: triage team work, blockers, and interventions.',
    taskSubtitle: 'Execution queue with owner, assignee, and linked commitment context.',
    directorySubtitle: 'Master context for operational projects, people, and companies.',
    projectsSubtitle: 'Operational project pressure is available in Directory > Operational context.',
    relationshipsSubtitle: 'People and company relationship context now lives inside Directory.',
    workspaceMeta: buildWorkspaceMeta('team'),
  },
};

export const getModeConfig = (mode: AppMode) => appModeConfig[mode];
