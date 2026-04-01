import { CheckCircle2, Plus, Search, TriangleAlert, X, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applySavedView, isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

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

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const projects = useMemo(() => ['All', ...new Set(items.map((item) => item.project))], [items]);
  const statuses = ['All', 'Needs action', 'Waiting on external', 'Waiting internal', 'In progress', 'At risk', 'Closed'] as const;

  const viewItems = useMemo(() => applySavedView(items, activeView), [items, activeView]);
  const filteredCount = useMemo(() => viewItems.filter((item) => {
    const matchesSearch = [item.id, item.title, item.project, item.owner, item.nextAction, item.summary, item.tags.join(' ')].join(' ').toLowerCase().includes(search.toLowerCase());
    const matchesProject = projectFilter === 'All' || item.project === projectFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesProject && matchesStatus;
  }).length, [viewItems, search, projectFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: viewItems.length,
    overdue: viewItems.filter(isOverdue).length,
    needsNudge: viewItems.filter(needsNudge).length,
    atRisk: viewItems.filter((item) => item.status === 'At risk' || item.escalationLevel === 'Critical').length,
  }), [viewItems]);

  const chips = [
    { key: 'All' as const, label: 'All', count: stats.total },
    { key: 'Overdue' as const, label: 'Overdue', count: stats.overdue, icon: TriangleAlert },
    { key: 'Needs nudge' as const, label: 'Needs nudge', count: stats.needsNudge },
    { key: 'At risk' as const, label: 'At risk', count: stats.atRisk, icon: Zap },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="followup-toolbar-head">
        <div>
          <div className="text-lg font-semibold text-slate-950">Follow-up workspace</div>
          <div className="mt-1 text-sm text-slate-500">Quick filters up top. Tracker and selected record side by side below.</div>
        </div>
        <button onClick={openCreateModal} className="action-btn">
          <Plus className="h-4 w-4" />
          Add follow-up
        </button>
      </div>

      <div className="followup-chip-row mt-4">
        {chips.map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={activeView === key ? 'followup-chip followup-chip-active' : 'followup-chip'}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>

      <div className="followup-filter-grid mt-4">
        <label className="field-block">
          <span className="field-label">Search follow-ups</span>
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, project, owner, next action, tags"
              className="field-input search-field-input"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} className="search-clear-btn" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </label>

        <label className="field-block">
          <span className="field-label">Project filter</span>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="field-input"
          >
            {projects.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </label>

        <label className="field-block">
          <span className="field-label">Status filter</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="field-input"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="followup-toolbar-foot mt-4">
        <div className="text-sm text-slate-500">
          <span className="font-medium text-slate-900">{filteredCount}</span> shown
          {selectedItem ? <span className="mx-2 text-slate-300">•</span> : null}
          {selectedItem ? <span>Selected: <span className="font-medium text-slate-900">{selectedItem.title}</span></span> : <span>Pick a row below to work a record.</span>}
        </div>

        <div className="followup-action-row">
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
    </section>
  );
}
