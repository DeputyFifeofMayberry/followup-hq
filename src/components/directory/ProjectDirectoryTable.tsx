import { formatDate } from '../../lib/utils';
import type { ProjectDerivedRecord } from '../../lib/projectSelectors';
import { isUnclassifiedProject } from '../../domains/directory/hooks/useDirectoryViewModel';
import { RecordSaveStatus } from '../save/RecordSaveStatus';

interface ProjectDirectoryTableProps {
  rows: ProjectDerivedRecord[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
}

export function ProjectDirectoryTable({ rows, selectedProjectId, onSelectProject }: ProjectDirectoryTableProps) {
  const orderedRows = [...rows.filter((row) => isUnclassifiedProject(row.project)), ...rows.filter((row) => !isUnclassifiedProject(row.project))];

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {['Project', 'Owner', 'Status', 'Target / milestone', 'Linked records', 'Pressure'].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row) => {
            const pressure = row.overdueFollowUpCount + row.overdueTaskCount + row.blockedTaskCount;
            return (
              <tr key={row.project.id} className={selectedProjectId === row.project.id ? 'cursor-pointer border-b border-slate-100 bg-slate-50' : 'cursor-pointer border-b border-slate-100'} onClick={() => onSelectProject(row.project.id)}>
                <td className="px-2 py-2">
                  <div className="font-medium text-slate-900">{isUnclassifiedProject(row.project) ? 'Unclassified' : row.project.name}</div>
                  <div className="text-xs text-slate-500">{row.project.code || 'No code'} • {row.project.clientOrg || row.project.ownerOrg || 'No owner org set'}</div>
                  {selectedProjectId === row.project.id ? <div className="mt-1"><RecordSaveStatus record={{ type: 'project', id: row.project.id }} compact /></div> : null}
                </td>
                <td className="px-2 py-2">{row.project.owner || '—'}</td>
                <td className="px-2 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.project.archived ? 'Archived' : row.project.status}</span>
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">
                  <div>{formatDate(row.project.targetCompletionDate) || 'No target date'}</div>
                  <div>{row.project.nextMilestone || 'No milestone'}{row.project.nextMilestoneDate ? ` • ${formatDate(row.project.nextMilestoneDate)}` : ''}</div>
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">{row.contacts.length} contacts • {row.companies.length} companies</td>
                <td className="px-2 py-2 text-xs">
                  <div className="font-medium text-slate-700">{row.health.tier} ({row.health.score})</div>
                  <div className="text-slate-500">{pressure} active pressure signals</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
