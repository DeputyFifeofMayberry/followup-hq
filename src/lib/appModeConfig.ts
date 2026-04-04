import type { AppMode } from '../types';

export type WorkspaceKey = 'worklist' | 'followups' | 'tasks' | 'projects' | 'relationships' | 'outlook' | 'exports';
export type WorkspaceCategory = 'core' | 'support';
export type WorkspaceActionKey = 'new-followup' | 'new-task' | 'none';

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
  showUniversalCapture: boolean;
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
  projectsSubtitle: string;
  relationshipsSubtitle: string;
  workspaceMeta: Record<WorkspaceKey, WorkspaceMeta>;
}

const workspaceOrder: WorkspaceKey[] = ['worklist', 'followups', 'tasks', 'outlook', 'projects', 'relationships', 'exports'];

export const getWorkspaceOrder = () => workspaceOrder;

const buildWorkspaceMeta = (mode: AppMode): Record<WorkspaceKey, WorkspaceMeta> => ({
  worklist: {
    userLabel: 'Overview',
    shellTitle: 'Overview',
    shellPurpose: 'Start your day here. Triage priorities, review intake, and route work into execution lanes.',
    category: 'core',
    startSurface: true,
    showUniversalCapture: true,
    primaryAction: { label: 'New follow-up', actionKey: 'new-followup', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.worklist || 0} due now across your execution loop`,
  },
  followups: {
    userLabel: 'Follow Ups',
    shellTitle: 'Follow Ups',
    shellPurpose: mode === 'personal'
      ? 'Focused follow-up execution lane for commitments, nudges, and closure.'
      : 'Team follow-up execution lane for ownership, nudges, and closure.',
    category: 'core',
    startSurface: false,
    showUniversalCapture: true,
    primaryAction: { label: 'Add follow-up', actionKey: 'new-followup', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.followups || 0} active follow-ups`,
  },
  tasks: {
    userLabel: 'Tasks',
    shellTitle: 'Tasks',
    shellPurpose: mode === 'personal'
      ? 'Focused task execution lane for shipping assigned work quickly.'
      : 'Team task execution lane for assignees, throughput, and linked follow-ups.',
    category: 'core',
    startSurface: false,
    showUniversalCapture: true,
    primaryAction: { label: 'Add task', actionKey: 'new-task', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.tasks || 0} open tasks`,
  },
  outlook: {
    userLabel: 'Intake',
    shellTitle: 'Intake',
    shellPurpose: mode === 'personal'
      ? 'Support funnel for inbound capture, review, and handoff into Overview, Follow Ups, and Tasks.'
      : 'Team support funnel for inbound material, review safety, and execution routing.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: true,
    healthLabel: ({ combinedCleanup }) => `${combinedCleanup} need cleanup`,
  },
  projects: {
    userLabel: 'Projects',
    shellTitle: 'Projects',
    shellPurpose: mode === 'personal'
      ? 'Support view for project context, pressure checks, and reference details.'
      : 'Support view for project pressure, risk, and escalation context.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: ({ totalItems }) => `${totalItems} linked follow-ups`,
  },
  relationships: {
    userLabel: 'Relationships',
    shellTitle: 'Relationships',
    shellPurpose: mode === 'personal'
      ? 'Support view for relationship context and next-touch awareness.'
      : 'Support view for relationship health, history, and ownership context.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: ({ totalItems }) => `${totalItems} connected threads`,
  },
  exports: {
    userLabel: 'Exports',
    shellTitle: 'Exports',
    shellPurpose: mode === 'personal'
      ? 'Support view for snapshots and reporting outside daily execution.'
      : 'Support view for team reporting snapshots and status packs.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: () => 'Export-ready data',
  },
});

export const appModeConfig: Record<AppMode, AppModeConfig> = {
  personal: {
    displayName: 'Personal mode',
    shellLabel: 'Personal execution workspace',
    shellDescription: 'Daily execution lanes first, with support views kept intentionally secondary.',
    supportViewsMuted: true,
    supportActionsSecondary: true,
    emphasizeCoordinationActions: false,
    showOwnerHeavyControls: false,
    trackerOwnerContext: 'compact',
    overviewSubtitle: 'Start-of-day cockpit: process quickly, close loops, and keep momentum.',
    taskSubtitle: 'Execution-first task lane with minimal ownership overhead.',
    projectsSubtitle: 'Project context lens for pressure, risk, and execution routing.',
    relationshipsSubtitle: 'Coordination lens for stakeholder pressure and next-touch routing.',
    workspaceMeta: buildWorkspaceMeta('personal'),
  },
  team: {
    displayName: 'Team mode',
    shellLabel: 'Team coordination workspace',
    shellDescription: 'Overview starts the day, Follow Ups + Tasks execute, and support views provide context and intake handoff.',
    supportViewsMuted: false,
    supportActionsSecondary: false,
    emphasizeCoordinationActions: true,
    showOwnerHeavyControls: true,
    trackerOwnerContext: 'full',
    overviewSubtitle: 'Start-of-day cockpit with ownership, blockers, and intervention points.',
    taskSubtitle: 'Coordination-ready task lane with owner, assignee, and parent context.',
    projectsSubtitle: 'Project pressure lens for ownership context, blockers, and lane routing.',
    relationshipsSubtitle: 'Stakeholder coordination lens for pressure, risk, and follow-through.',
    workspaceMeta: buildWorkspaceMeta('team'),
  },
};

export const getModeConfig = (mode: AppMode) => appModeConfig[mode];
