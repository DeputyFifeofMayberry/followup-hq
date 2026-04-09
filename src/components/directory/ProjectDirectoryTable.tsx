import { formatDate } from '../../lib/utils';
import type { ProjectDerivedRecord } from '../../lib/projectSelectors';
import { isUnclassifiedProject } from '../../domains/directory/hooks/useDirectoryViewModel';

interface ProjectDirectoryTableProps {
  rows: ProjectDerivedRecord[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
}

export function ProjectDirectoryTable({ rows, selectedProjectId, onSelectProject }: ProjectDirectoryTableProps) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {['Name', 'Code', 'Owner', 'Status', 'Client / Owner org', 'Phase', 'Target completion', 'Last reviewed', 'Linked contacts', 'Linked companies', 'Health'].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...rows.filter((row) => isUnclassifiedProject(row.project)), ...rows.filter((row) => !isUnclassifiedProject(row.project))].map((row) => (
            <tr key={row.project.id} className={selectedProjectId === row.project.id ? 'cursor-pointer border-b border-slate-100 bg-slate-50' : 'cursor-pointer border-b border-slate-100'} onClick={() => onSelectProject(row.project.id)}>
              <td className="px-2 py-2 font-medium">{isUnclassifiedProject(row.project) ? 'Unclassified' : row.project.name}</td>
              <td className="px-2 py-2">{row.project.code || '—'}</td>
              <td className="px-2 py-2">{row.project.owner || '—'}</td>
              <td className="px-2 py-2">{row.project.archived ? 'Archived' : row.project.status}</td>
              <td className="px-2 py-2">{row.project.clientOrg || row.project.ownerOrg || '—'}</td>
              <td className="px-2 py-2">{row.project.phase || '—'}</td>
              <td className="px-2 py-2">{formatDate(row.project.targetCompletionDate)}</td>
              <td className="px-2 py-2">{formatDate(row.project.lastReviewedAt)}</td>
              <td className="px-2 py-2">{row.contacts.length}</td>
              <td className="px-2 py-2">{row.companies.length}</td>
              <td className="px-2 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.health.tier} ({row.health.score})</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
