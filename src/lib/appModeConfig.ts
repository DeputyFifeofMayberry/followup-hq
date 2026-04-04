import type { AppMode } from '../types';

export type WorkspaceKey = 'worklist' | 'followups' | 'tasks' | 'projects' | 'relationships' | 'outlook' | 'exports';

export interface WorkspaceModeMeta {
  title: string;
  purpose: string;
  healthLabel: string;
  actions: Array<{ label: string; actionKey: 'new-followup' | 'new-task' | 'none'; primary?: boolean }>;
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
  workspaceMeta: Record<WorkspaceKey, Omit<WorkspaceModeMeta, 'healthLabel'>>;
}

export const appModeConfig: Record<AppMode, AppModeConfig> = {
  personal: {
    displayName: 'Personal mode',
    shellLabel: 'Personal execution workspace',
    shellDescription: 'Run your day with less coordination noise and faster execution decisions.',
    supportViewsMuted: true,
    supportActionsSecondary: true,
    emphasizeCoordinationActions: false,
    showOwnerHeavyControls: false,
    trackerOwnerContext: 'compact',
    overviewSubtitle: 'My work today: process quickly, close loops, and keep momentum.',
    taskSubtitle: 'Execution-first task board with minimal ownership overhead.',
    projectsSubtitle: 'Support lens for project context, pressure checks, and reference details.',
    relationshipsSubtitle: 'Support lens for relationship context and next-touch clarity.',
    workspaceMeta: {
      worklist: { title: 'Worklist', purpose: 'Execute your next highest-value move quickly.', actions: [{ label: 'New follow-up', actionKey: 'new-followup', primary: true }] },
      followups: { title: 'Follow Ups', purpose: 'Keep commitments moving with concise execution context.', actions: [{ label: 'Add follow-up', actionKey: 'new-followup', primary: true }] },
      tasks: { title: 'Tasks', purpose: 'Process task execution with fewer management controls.', actions: [{ label: 'Add task', actionKey: 'new-task', primary: true }] },
      outlook: { title: 'Intake', purpose: 'Capture inbound work and convert it into clear next actions.', actions: [] },
      projects: { title: 'Projects', purpose: 'Secondary project lens for context and pressure checks.', actions: [] },
      relationships: { title: 'Relationships', purpose: 'Secondary relationship lens for support and risk awareness.', actions: [] },
      exports: { title: 'Exports', purpose: 'Export snapshots when external reporting is needed.', actions: [] },
    },
  },
  team: {
    displayName: 'Team mode',
    shellLabel: 'Team coordination workspace',
    shellDescription: 'Coordinate assignments, monitor ownership, and intervene on pressure early.',
    supportViewsMuted: false,
    supportActionsSecondary: false,
    emphasizeCoordinationActions: true,
    showOwnerHeavyControls: true,
    trackerOwnerContext: 'full',
    overviewSubtitle: 'Coordination-aware queue with ownership, blockers, and intervention points.',
    taskSubtitle: 'Coordination-ready task workspace with owner, assignee, and parent context.',
    projectsSubtitle: 'Operational project view for ownership, intervention, and portfolio pressure.',
    relationshipsSubtitle: 'Operational relationship view for ownership, risk, and follow-through.',
    workspaceMeta: {
      worklist: { title: 'Worklist', purpose: 'Coordinate the active queue with clear ownership and pressure signals.', actions: [{ label: 'New follow-up', actionKey: 'new-followup', primary: true }] },
      followups: { title: 'Follow Ups', purpose: 'Manage assignment clarity, action state, and accountability across follow-ups.', actions: [{ label: 'Add follow-up', actionKey: 'new-followup', primary: true }] },
      tasks: { title: 'Tasks', purpose: 'Track execution ownership and linked workflow readiness by assignee.', actions: [{ label: 'Add task', actionKey: 'new-task', primary: true }] },
      outlook: { title: 'Intake', purpose: 'Route inbound intake for team review, cleanup, and assignment.', actions: [] },
      projects: { title: 'Projects', purpose: 'Operational project coordination surface for intervention and escalation.', actions: [] },
      relationships: { title: 'Relationships', purpose: 'Operational relationship coordination view with ownership and risk signals.', actions: [] },
      exports: { title: 'Exports', purpose: 'Produce team-ready reporting snapshots and status packs.', actions: [] },
    },
  },
};

export const getModeConfig = (mode: AppMode) => appModeConfig[mode];
