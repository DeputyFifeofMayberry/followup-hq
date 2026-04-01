import { CheckCircle2, Clock3, Plus, Search, Send, TriangleAlert, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { applySavedView, isOverdue, needsNudge } from '../lib/utils';

export function ControlBar() {
  const {
    items,
    search,
    projectFilter,
    statusFilter,
    activeView,
    selectedId,
    setSearch,
    setProjectFilter,
    setStatusFilter,
    setActiveView,
    openCreateModal,
    openEditModal,
    openTouchModal,
    markNudged,
    snoozeItem,
    cycleEscalation,
    updateItem,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    search: s.search,
    projectFilter: s.projectFilter,
    statusFilter: s.statusFilter,
    activeView: s.activeView,
    selectedId: s.selectedId,
    setSearch: s.setSearch,
    setProjectFilter: s.setProjectFilter,
    setStatusFilter: s.setStatusFilter,
    setActiveView: s.setActiveView,
    openCreateModal: s.openCreateModal,
    openEditModal: s.openEditModal,
    openTouchModal: s.openTouchModal,
    markNudged: s.markNudged,
    snoozeItem: s.snoozeItem,
    cycleEscalation: s.cycleEscalation,
    updateItem: s.updateItem,
  })));

  const projects = useMemo(() => ['All', ...new Set(items.map((item) => item.project))], [items]);
  const statuses = ['All', 'Needs action', 'Waiting on external', 'Waiting internal', 'In progress', 'At risk', 'Closed'] as const;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const viewItems = useMemo(() => applySavedView(items, activeView), [items, activeView]);
  const stats = useMemo(() => ({
    total: viewItems.length,
    overdue: viewItems.filter(isOverdue).length,
    needsNudge: viewItems.filter(needsNudge).length,
    atRisk: viewItems.filter((item) => item.status === 'At risk' || item.escalationLevel === 'Critical').length,
  }), [viewItems]);

  const statButtons = [
    { key: 'All' as const, label: 'In queue', count: stats.total, icon: Clock3 },
    { key: 'Overdue' as const, label: 'Overdue', count: stats.overdue, icon: TriangleAlert },
    { key: 'Needs nudge' as const, label: 'Needs nudge', count: stats.needsNudge, icon: Send },
    { key: 'At risk' as const, label: 'At risk', count: stats.atRisk, icon: Zap },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {statButtons.map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={activeView === key ? 'saved-view-card saved-view-card-active !w-auto !px-4 !py-3' : 'saved-view-card !w-auto !px-4 !py-3'}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon className="h-4 w-4" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="text-lg font-semibold text-slate-950">{count}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title, project, owner, tags, next action"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            >
              {projects.map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={openCreateModal} className="primary-btn"><Plus className="h-4 w-4" />Add follow-up</button>
            <button onClick={() => selectedItem && openEditModal(selectedItem.id)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Edit</button>
            <button onClick={() => selectedItem && openTouchModal()} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Log touch</button>
            <button onClick={() => selectedItem && markNudged(selectedItem.id)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Mark nudged</button>
            <button onClick={() => selectedItem && snoozeItem(selectedItem.id, 2)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Snooze 2d</button>
            <button onClick={() => selectedItem && cycleEscalation(selectedItem.id)} disabled={!selectedItem} className="action-btn disabled:cursor-not-allowed disabled:opacity-50">Escalate</button>
            <button
              onClick={() => selectedItem && updateItem(selectedItem.id, { status: selectedItem.status === 'Closed' ? 'Needs action' : 'Closed' })}
              disabled={!selectedItem}
              className="action-btn disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {selectedItem?.status === 'Closed' ? 'Reopen' : 'Close'}
            </button>
          </div>
        </div>

        {selectedItem ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Selected:</span> {selectedItem.title}
            <span className="mx-2 text-slate-300">•</span>
            {selectedItem.project}
            <span className="mx-2 text-slate-300">•</span>
            {selectedItem.owner}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Select a row to unlock quick actions for nudge, snooze, escalate, touch log, and closeout.
          </div>
        )}
      </div>
    </section>
  );
}
