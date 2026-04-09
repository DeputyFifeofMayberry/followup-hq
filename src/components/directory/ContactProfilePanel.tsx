import { getContactLinkedRecords } from '../../lib/recordContext';
import { useAppStore } from '../../store/useAppStore';
import type { ContactRecord } from '../../types';

interface ContactProfilePanelProps {
  contact: ContactRecord | null;
  onOpenProject: (projectId: string) => void;
}

export function ContactProfilePanel({ contact, onOpenProject }: ContactProfilePanelProps) {
  const { items, tasks, contacts, companies, projects } = useAppStore();
  if (!contact) return <div className="text-sm text-slate-600">Select a contact to view details.</div>;
  const linked = getContactLinkedRecords(contact.id, { items, tasks, contacts, companies, projects });
  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="font-semibold">{contact.name}</div>
        <div className="text-xs text-slate-600">{contact.role || 'Contact'}</div>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-1 text-xs font-medium uppercase text-slate-500">Direct linked projects</div>
        {linked.projects.length === 0 ? <div className="text-xs text-slate-500">No linked projects.</div> : linked.projects.map((project) => <button key={project.id} className="mr-1 rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onOpenProject(project.id)}>{project.name}</button>)}
      </div>
      <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
        Linked work summary: {linked.followups.length} follow-ups • {linked.tasks.length} tasks
      </div>
    </div>
  );
}
