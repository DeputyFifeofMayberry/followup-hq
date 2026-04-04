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
    shellPurpose: 'Start-of-day cockpit for triage, routing decisions, and immediate execution control.',
    category: 'core',
    startSurface: true,
    showUniversalCapture: true,
    primaryAction: { label: 'New follow-up', actionKey: 'new-followup', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.worklist || 0} require same-day direction`,
  },
  followups: {
    userLabel: 'Follow Ups',
    shellTitle: 'Follow Ups',
    shellPurpose: mode === 'personal'
      ? 'Commitment execution lane for owner follow-through, nudges, and closeout readiness.'
      : 'Team commitment lane for accountable follow-through, escalation, and closeout.',
    category: 'core',
    startSurface: false,
    showUniversalCapture: true,
    primaryAction: { label: 'Add follow-up', actionKey: 'new-followup', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.followups || 0} active commitments`,
  },
  tasks: {
    userLabel: 'Tasks',
    shellTitle: 'Tasks',
    shellPurpose: mode === 'personal'
      ? 'Work execution lane for assigned production tasks and handoffs.'
      : 'Team work lane for assignees, throughput, and linked commitment support.',
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
      ? 'Inbound capture and review funnel for routing approved work into execution lanes.'
      : 'Team intake funnel for inbound material, review safety, and disciplined routing.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: true,
    healthLabel: ({ combinedCleanup }) => `${combinedCleanup} need cleanup`,
  },
  projects: {
    userLabel: 'Projects',
    shellTitle: 'Projects',
    shellPurpose: mode === 'personal'
      ? 'Project context lens for pressure checks, risk visibility, and routing context.'
      : 'Project pressure lens for risk, ownership friction, and escalation context.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: ({ totalItems }) => `${totalItems} linked follow-ups`,
  },
  relationships: {
    userLabel: 'Relationships',
    shellTitle: 'Relationships',
    shellPurpose: mode === 'personal'
      ? 'Stakeholder lens for relationship context, next-touch awareness, and coordination pressure.'
      : 'Stakeholder coordination lens for relationship health, history, and ownership pressure.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: ({ totalItems }) => `${totalItems} connected threads`,
  },
  exports: {
    userLabel: 'Exports',
    shellTitle: 'Exports',
    shellPurpose: mode === 'personal'
      ? 'Reporting support surface for operational snapshots and closeout-ready exports.'
      : 'Reporting support surface for team snapshots, status packs, and audit-ready exports.',
    category: 'support',
    startSurface: false,
    showUniversalCapture: false,
    healthLabel: () => 'Export-ready data',
  },
});

export const appModeConfig: Record<AppMode, AppModeConfig> = {
  personal: {
    displayName: 'Personal mode',
    shellLabel: 'SetPoint personal execution workspace',
    shellDescription: 'Execution lanes stay primary while intake, pressure, and reporting context remain one click away.',
    supportViewsMuted: true,
    supportActionsSecondary: true,
    emphasizeCoordinationActions: false,
    showOwnerHeavyControls: false,
    trackerOwnerContext: 'compact',
    overviewSubtitle: 'Start-of-day cockpit: intake triage, execution routing, and closeout control.',
    taskSubtitle: 'Execution-first work lane for assigned actions and measurable completion.',
    projectsSubtitle: 'Project pressure lens for risk, context, and lane routing decisions.',
    relationshipsSubtitle: 'Stakeholder coordination lens for accountability, pressure, and next-touch routing.',
    workspaceMeta: buildWorkspaceMeta('personal'),
  },
  team: {
    displayName: 'Team mode',
    shellLabel: 'SetPoint team execution workspace',
    shellDescription: 'Overview starts the day, Follow Ups + Tasks execute work, and support views maintain context from intake to closeout.',
    supportViewsMuted: false,
    supportActionsSecondary: false,
    emphasizeCoordinationActions: true,
    showOwnerHeavyControls: true,
    trackerOwnerContext: 'full',
    overviewSubtitle: 'Start-of-day cockpit with ownership, blockers, and intervention points.',
    taskSubtitle: 'Coordination-ready work lane with owner, assignee, and parent commitment context.',
    projectsSubtitle: 'Project pressure lens for ownership context, blockers, and route-to-lane control.',
    relationshipsSubtitle: 'Stakeholder coordination lens for pressure, risk, and accountable follow-through.',
    workspaceMeta: buildWorkspaceMeta('team'),
  },
};

export const getModeConfig = (mode: AppMode) => appModeConfig[mode];
