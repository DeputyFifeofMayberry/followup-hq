import { Activity, Building2, FileSpreadsheet, Inbox, ListChecks, ListTodo } from 'lucide-react';
import type { WorkspaceKey } from './appModeConfig';

export const workspaceIcons: Record<WorkspaceKey, typeof ListChecks> = {
  overview: ListChecks,
  followups: Activity,
  tasks: ListTodo,
  intake: Inbox,
  directory: Building2,
  exports: FileSpreadsheet,
};

export function normalizeWorkspaceSelection(value: string): WorkspaceKey {
  if (value === 'tracker' || value === 'followups') return 'followups';
  if (value === 'queue' || value === 'overview' || value === 'worklist') return 'overview';
  if (value === 'outlook' || value === 'intake') return 'intake';
  if (value === 'projects' || value === 'relationships' || value === 'directory') return 'directory';
  return value as WorkspaceKey;
}
