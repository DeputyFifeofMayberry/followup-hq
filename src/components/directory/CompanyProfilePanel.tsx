import { getCompanyLinkedRecords } from '../../lib/recordContext';
import { useAppStore } from '../../store/useAppStore';
import type { CompanyRecord } from '../../types';

interface CompanyProfilePanelProps {
  company: CompanyRecord | null;
  onOpenProject: (projectId: string) => void;
}

export function CompanyProfilePanel({ company, onOpenProject }: CompanyProfilePanelProps) {
  const { items, tasks, contacts, companies, projects } = useAppStore();
  if (!company) return <div className="text-sm text-slate-600">Select a company to view details.</div>;
  const linked = getCompanyLinkedRecords(company.id, { items, tasks, contacts, companies, projects });
  const primaryContact = company.primaryContactId ? contacts.find((entry) => entry.id === company.primaryContactId) : null;
  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="font-semibold">{company.name}</div>
        <div className="text-xs text-slate-600">{company.type}</div>
        <div className="mt-1 text-xs text-slate-600">Primary contact: {primaryContact?.name || '—'}</div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-1 text-xs font-medium uppercase text-slate-500">Linked projects</div>
        {linked.projects.length === 0 ? <div className="text-xs text-slate-500">No linked projects.</div> : linked.projects.map((project) => <button key={project.id} className="mr-1 rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onOpenProject(project.id)}>{project.name}</button>)}
      </div>
      <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
        Linked work summary: {linked.followups.length} follow-ups • {linked.tasks.length} tasks
      </div>
    </div>
  );
}
