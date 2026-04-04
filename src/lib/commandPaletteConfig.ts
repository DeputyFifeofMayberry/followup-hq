import type { WorkspaceKey } from './appModeConfig';

export interface AppCommand {
  label: string;
  run: () => void;
}

export function buildCommandPaletteConfig(input: {
  orderedWorkspaces: WorkspaceKey[];
  getWorkspaceLabel: (workspace: WorkspaceKey) => string;
  openCreateModal: () => void;
  openCreateTaskModal: () => void;
  setWorkspace: (workspace: WorkspaceKey) => void;
}): AppCommand[] {
  const base: AppCommand[] = [
    { label: 'New follow-up', run: () => input.openCreateModal() },
    { label: 'New task', run: () => input.openCreateTaskModal() },
  ];

  const workspaceCommands = input.orderedWorkspaces.map((key) => ({
    label: `Open ${input.getWorkspaceLabel(key).toLowerCase()}`,
    run: () => input.setWorkspace(key),
  }));

  return [...base, ...workspaceCommands];
}

export function filterCommands(commands: AppCommand[], query: string): AppCommand[] {
  const normalized = query.trim().toLowerCase();
  return commands.filter((command) => command.label.toLowerCase().includes(normalized));
}
