import { AlertTriangle, Building2, Clock3, Users } from 'lucide-react';
import { useMemo } from 'react';
import { isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { SavedViewKey } from '../types';

type WorkspaceKey = 'overview' | 'tracker' | 'intake' | 'projects' | 'relationships';

export function StatsGrid({ onOpenTrackerView, onOpenWorkspace }: { onOpenTrackerView: (view: SavedViewKey, project?: string) => void; onOpenWorkspace: (workspace: WorkspaceKey) => void }) {
  const { items, contacts, companies, hydrated } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    hydrated: s.hydrated,
  })));

  const stats = useMemo(() => {
    const open = items.filter((item) => item.status !== 'Closed').length;
    const nudge = items.filter(needsNudge).length;
    const overdue = items.filter((item) => isOverdue(item) || item.status === 'At risk' || item.escalationLevel === 'Critical').length;
    const linkedRelationships = items.filter((item) => item.contactId || item.companyId).length;

    return [
      { label: 'Open follow-ups', value: open, helper: 'The live master list', icon: Clock3, action: () => onOpenTrackerView('All') },
      { label: 'Needs nudge', value: nudge, helper: 'Due for a touchpoint now', icon: AlertTriangle, action: () => onOpenTrackerView('Needs nudge') },
      { label: 'Contacts / companies', value: `${contacts.length}/${companies.length}`, helper: `${linkedRelationships} linked items`, icon: Users, action: () => onOpenWorkspace('relationships') },
      { label: 'High-risk items', value: overdue, helper: 'Overdue, at risk, or critical', icon: Building2, action: () => onOpenTrackerView('At risk') },
    ];
  }, [items, contacts.length, companies.length, onOpenTrackerView, onOpenWorkspace]);

  if (!hydrated) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="animate-pulse">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="mt-3 h-10 w-16 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <button key={stat.label} onClick={stat.action} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</div>
                <div className="mt-2 text-xs text-slate-500">{stat.helper}</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}
