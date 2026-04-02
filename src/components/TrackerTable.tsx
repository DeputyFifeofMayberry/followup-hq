import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { applySavedView, escalationTone, formatDate, fromDateInputValue, isOverdue, needsNudge, priorityTone, sortByProjectThenDue, statusTone, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';

export function TrackerTable({ personalMode = false }: { personalMode?: boolean }) {
  const {
    items,
    contacts,
    companies,
    selectedId,
    setSelectedId,
    search,
    projectFilter,
    statusFilter,
    activeView,
    duplicateReviews,
    updateItem,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    search: s.search,
    projectFilter: s.projectFilter,
    statusFilter: s.statusFilter,
    activeView: s.activeView,
    duplicateReviews: s.duplicateReviews,
    updateItem: s.updateItem,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);

  const owners = useMemo(() => Array.from(new Set(items.map((item) => item.owner))).sort(), [items]);

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
      header: 'Item',
      cell: ({ row }) => {
        const item = row.original;
        const duplicateCount = duplicateReviews.find((review) => review.itemId === item.id)?.candidates.length ?? 0;
        const company = companies.find((entry) => entry.id === item.companyId)?.name;
        return (
          <div className="space-y-1">
            <div className="font-medium text-slate-900">{item.title}</div>
            <div className="text-xs text-slate-500">
              {item.id} • {item.project}
              {company ? ` • ${company}` : ''}
              {duplicateCount > 0 ? ` • ${duplicateCount} dupes` : ''}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select value={row.original.status} onChange={(event) => updateItem(row.original.id, { status: event.target.value as FollowUpItem['status'] })} className="field-input !w-[180px] !py-1.5 text-xs">
            <option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option>
          </select>
          {needsNudge(row.original) ? <Badge variant="warn">Nudge</Badge> : null}
        </div>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select value={row.original.priority} onChange={(event) => updateItem(row.original.id, { priority: event.target.value as FollowUpItem['priority'] })} className="field-input !w-[120px] !py-1.5 text-xs">
            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
          <Badge variant={escalationTone(row.original.escalationLevel)}>{row.original.escalationLevel}</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'owner',
      header: personalMode ? 'Contact / Waiting on' : 'Owner / Waiting on',
      cell: ({ row }) => (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {personalMode ? (
            <div className="rounded-xl bg-slate-100 px-2 py-1.5 text-xs text-slate-700">{row.original.owner || '—'}</div>
          ) : (
            <select value={row.original.owner} onChange={(event) => updateItem(row.original.id, { owner: event.target.value })} className="field-input !w-[170px] !py-1.5 text-xs">
              {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
          )}
          <input value={row.original.waitingOn ?? ''} onChange={(event) => updateItem(row.original.id, { waitingOn: event.target.value })} placeholder="Waiting on" className="field-input !w-[170px] !py-1.5 text-xs" />
        </div>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Dates',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs text-slate-500">Due
              <input type="date" value={toDateInputValue(item.dueDate)} onChange={(event) => updateItem(item.id, { dueDate: fromDateInputValue(event.target.value) })} className="field-input !mt-1 !w-[160px] !py-1.5 text-xs" />
            </label>
            <label className="text-xs text-slate-500">Next touch
              <input type="date" value={toDateInputValue(item.nextTouchDate)} onChange={(event) => updateItem(item.id, { nextTouchDate: fromDateInputValue(event.target.value) })} className="field-input !mt-1 !w-[160px] !py-1.5 text-xs" />
            </label>
            {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
          </div>
        );
      },
    },
    {
      id: 'nextAction',
      header: 'Next action',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <textarea
            defaultValue={row.original.nextAction}
            onBlur={(event) => updateItem(row.original.id, { nextAction: event.target.value })}
            className="field-textarea !min-h-[64px] !w-[260px] text-xs"
          />
        </div>
      ),
    },
  ], [duplicateReviews, companies, owners, updateItem, personalMode]);

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const groupedByProject = useMemo(() => {
    const ordered = sortByProjectThenDue(filteredItems);
    return ordered.reduce<Record<string, FollowUpItem[]>>((acc, item) => {
      acc[item.project] = [...(acc[item.project] ?? []), item];
      return acc;
    }, {});
  }, [filteredItems]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Master follow-up tracker</h2>
        <p className="mt-1 text-sm text-slate-500">Inline-edit status, owner, dates, and next action directly from the grid.</p>
      </div>

      {activeView === 'By project' ? (
        <div className="space-y-4 p-4">
          {Object.entries(groupedByProject).map(([project, projectItems]) => (
            <div key={project} className="rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">{project}</div>
              <div className="grid gap-0">
                {projectItems.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={active ? 'tracker-project-row tracker-project-row-active' : 'tracker-project-row'}
                    >
                      <div>
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.owner} • Due {formatDate(item.dueDate)} • Next touch {formatDate(item.nextTouchDate)}</div>
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
          {filteredItems.length === 0 ? <div className="px-4 py-6 text-sm text-slate-500">No items match the current filters.</div> : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const active = row.original.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.original.id)}
                    className={active ? 'cursor-pointer border-b border-slate-200 bg-sky-50/60' : 'cursor-pointer border-b border-slate-200 hover:bg-slate-50'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-4 align-top text-sm text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 ? <div className="px-4 py-6 text-sm text-slate-500">No items match the current filters.</div> : null}
        </div>
      )}
    </section>
  );
}
