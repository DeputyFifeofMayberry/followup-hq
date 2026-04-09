import type { AppMode } from '../types';

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
    shellPurpose: 'Start-of-day cockpit for triage, routing decisions, and immediate execution control.',
    category: 'core',
    startSurface: true,
    primaryAction: { label: 'Create work item', actionKey: 'new-work', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.overview || 0} require same-day direction`,
  },
  followups: {
    userLabel: 'Follow Ups',
    shellTitle: 'Follow Ups',
    shellPurpose: mode === 'personal'
      ? 'Commitment execution lane for owner follow-through, nudges, and closeout readiness.'
      : 'Team commitment lane for accountable follow-through, escalation, and closeout.',
    category: 'core',
    startSurface: false,
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
    primaryAction: { label: 'Add task', actionKey: 'new-task', primary: true },
    healthLabel: ({ navCounts }) => `${navCounts.tasks || 0} open tasks`,
  },
  intake: {
    userLabel: 'Intake',
    shellTitle: 'Intake',
    shellPurpose: mode === 'personal'
      ? 'Inbound capture and review funnel for routing approved work into execution lanes.'
      : 'Team intake funnel for inbound material, review safety, and disciplined routing.',
    category: 'support',
    startSurface: false,
    healthLabel: ({ combinedCleanup }) => `${combinedCleanup} need cleanup`,
  },
  directory: {
    userLabel: 'Directory',
    shellTitle: 'Directory',
    shellPurpose: mode === 'personal'
      ? 'Master-data directory for projects, people, and companies with optional operational pressure context.'
      : 'Unified operations directory for projects and relationships with routing context as a secondary panel.',
    category: 'support',
    startSurface: false,
    healthLabel: ({ totalItems }) => `${totalItems} linked follow-ups`,
  },
  exports: {
    userLabel: 'Exports',
    shellTitle: 'Exports',
    shellPurpose: mode === 'personal'
      ? 'Reporting support surface for operational snapshots and closeout-ready exports.'
      : 'Reporting support surface for team snapshots, status packs, and audit-ready exports.',
    category: 'support',
    startSurface: false,
    healthLabel: () => 'Export-ready data',
  },
});

export const appModeConfig: Record<AppMode, AppModeConfig> = {
  personal: {
    displayName: 'Personal mode',
    shellLabel: 'SetPoint personal execution workspace',
    shellDescription: 'Overview starts the day, Follow Ups + Tasks execute work, and support views maintain context from intake to closeout.',
    supportViewsMuted: true,
    supportActionsSecondary: true,
    emphasizeCoordinationActions: false,
    showOwnerHeavyControls: false,
    trackerOwnerContext: 'compact',
    overviewSubtitle: 'Start-of-day cockpit: intake triage, execution routing, and closeout control.',
    taskSubtitle: 'Execution-first work lane for assigned actions and measurable completion.',
    directorySubtitle: 'Unified project and relationship directory for clear master-data management.',
    projectsSubtitle: 'Operational project pressure is available in Directory > Operational context.',
    relationshipsSubtitle: 'People and company relationship context now lives inside Directory.',
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
    directorySubtitle: 'Unified project and relationship directory for operational accountability.',
    projectsSubtitle: 'Operational project pressure is available in Directory > Operational context.',
    relationshipsSubtitle: 'People and company relationship context now lives inside Directory.',
    workspaceMeta: buildWorkspaceMeta('team'),
  },
};

export const getModeConfig = (mode: AppMode) => appModeConfig[mode];
