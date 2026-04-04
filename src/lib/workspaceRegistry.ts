import { Activity, BriefcaseBusiness, FileSpreadsheet, Inbox, ListChecks, ListTodo, Users } from 'lucide-react';
import type { WorkspaceKey } from './appModeConfig';

export const workspaceIcons: Record<WorkspaceKey, typeof ListChecks> = {
  worklist: ListChecks,
  followups: Activity,
  tasks: ListTodo,
  outlook: Inbox,
  projects: BriefcaseBusiness,
  relationships: Users,
  exports: FileSpreadsheet,
};

export function normalizeWorkspaceSelection(value: string): WorkspaceKey {
  if (value === 'tracker' || value === 'followups') return 'followups';
  if (value === 'queue' || value === 'overview') return 'worklist';
  if (value === 'outlook') return 'outlook';
  return value as WorkspaceKey;
}
