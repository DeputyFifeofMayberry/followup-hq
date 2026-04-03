import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { applySavedView, formatDate, fromDateInputValue, isOverdue, needsNudge, priorityTone, sortByProjectThenDue, statusTone, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppShellCard, EmptyState } from './ui/AppPrimitives';

export function TrackerTable({ personalMode = false }: { personalMode?: boolean }) {
  const { items, contacts, companies, selectedId, setSelectedId, search, projectFilter, statusFilter, activeView, updateItem } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    search: s.search,
    projectFilter: s.projectFilter,
    statusFilter: s.statusFilter,
    activeView: s.activeView,
    updateItem: s.updateItem,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const viewedItems = applySavedView(items, activeView);
    return viewedItems.filter((item) => {
      const contact = contacts.find((entry) => entry.id === item.contactId)?.name ?? '';
      const company = companies.find((entry) => entry.id === item.companyId)?.name ?? '';
      const haystack = [item.id, item.title, item.project, item.owner, item.nextAction, item.summary, item.tags.join(' '), contact, company, item.threadKey ?? ''].join(' ').toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesProject = projectFilter === 'All' || item.project === projectFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [items, contacts, companies, search, projectFilter, statusFilter, activeView]);

  const columns = useMemo<ColumnDef<FollowUpItem>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Follow-up',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium text-slate-900">{item.title}</div>
            <div className="text-xs text-slate-500">{item.project} • {personalMode ? item.owner : `${item.owner} • ${item.id}`}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        const editing = selectedId === item.id || editingRowId === item.id;
        return (
          <div className="row-field" onClick={(e) => e.stopPropagation()}>
            <div className="row-field-display"><Badge variant={statusTone(item.status)}>{item.status}</Badge></div>
            {editing ? (
              <select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as FollowUpItem['status'] })} className="field-input row-field-edit !w-[170px] !py-1.5 text-xs">
                <option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
              </select>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const item = row.original;
        const editing = selectedId === item.id || editingRowId === item.id;
        return (
          <div className="row-field" onClick={(e) => e.stopPropagation()}>
            <div className="row-field-display"><Badge variant={priorityTone(item.priority)}>{item.priority}</Badge></div>
            {editing ? (
              <select value={item.priority} onChange={(event) => updateItem(item.id, { priority: event.target.value as FollowUpItem['priority'] })} className="field-input row-field-edit !w-[120px] !py-1.5 text-xs">
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ row }) => {
        const item = row.original;
        const editing = selectedId === item.id || editingRowId === item.id;
        return (
          <div className="row-field" onClick={(e) => e.stopPropagation()}>
            <div className="row-field-display text-xs text-slate-700">{formatDate(item.dueDate)}</div>
            {editing ? <input type="date" value={toDateInputValue(item.dueDate)} onChange={(event) => updateItem(item.id, { dueDate: fromDateInputValue(event.target.value) })} className="field-input row-field-edit !w-[150px] !py-1.5 text-xs" /> : null}
            <div className="flex gap-1">
              {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
              {needsNudge(item) ? <Badge variant="warn">Nudge</Badge> : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'nextAction',
      header: 'Next action',
      cell: ({ row }) => (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-600 max-w-[240px] truncate">{row.original.nextAction || 'No next action set'}</div>
          <button onClick={(e) => { e.stopPropagation(); setEditingRowId((value) => value === row.original.id ? null : row.original.id); }} className="action-btn row-edit-toggle !px-2 !py-1 text-xs"><Pencil className="h-3.5 w-3.5" />Edit</button>
        </div>
      ),
    },
  ], [contacts, companies, updateItem, personalMode, selectedId, editingRowId]);

  const table = useReactTable({ data: filteredItems, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const groupedByProject = useMemo(() => {
    const ordered = sortByProjectThenDue(filteredItems);
    return ordered.reduce<Record<string, FollowUpItem[]>>((acc, item) => {
      acc[item.project] = [...(acc[item.project] ?? []), item];
      return acc;
    }, {});
  }, [filteredItems]);

  return (
    <AppShellCard className="p-0">
      {activeView === 'By project' ? (
        <div className="space-y-4 p-4">
          {Object.entries(groupedByProject).map(([project, projectItems]) => (
            <div key={project} className="rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">{project}</div>
              <div className="grid gap-0">
                {projectItems.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <button key={item.id} onClick={() => setSelectedId(item.id)} className={active ? 'tracker-project-row tracker-project-row-active' : 'tracker-project-row'}>
                      <div>
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.owner} • Due {formatDate(item.dueDate)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusTone(item.status)}>{item.status}</Badge>
                        <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredItems.length === 0 ? <EmptyState title="No items found" message="Adjust your filters or create a new follow-up." /> : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse tracker-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const active = row.original.id === selectedId;
                const editing = active || editingRowId === row.original.id;
                return (
                  <tr key={row.id} onClick={() => setSelectedId(row.original.id)} className={active ? 'tracker-row tracker-row-active' : 'tracker-row'} data-editing={editing ? 'true' : 'false'}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top text-sm text-slate-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 ? <div className="p-4"><EmptyState title="No items found" message="Adjust your filters or create a new follow-up." /></div> : null}
        </div>
      )}
    </AppShellCard>
  );
}
