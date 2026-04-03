import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { formatDate, fromDateInputValue, priorityTone, statusTone, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { FollowUpColumnKey, FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppShellCard, EmptyState } from './ui/AppPrimitives';
import { selectFollowUpRows } from '../lib/followUpSelectors';

const columnOrder: FollowUpColumnKey[] = ['title', 'project', 'owner', 'assignee', 'status', 'priority', 'dueDate', 'nextTouchDate', 'promisedDate', 'waitingOn', 'escalation', 'actionState', 'linkedTaskSummary', 'nextAction'];

export function TrackerTable({ personalMode = false }: { personalMode?: boolean }) {
  const { items, contacts, companies, selectedId, setSelectedId, search, activeView, followUpFilters, followUpColumns, selectedFollowUpIds, toggleFollowUpSelection, selectAllVisibleFollowUps, updateItem, markNudged } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
    search: s.search,
    activeView: s.activeView,
    followUpFilters: s.followUpFilters,
    followUpColumns: s.followUpColumns,
    selectedFollowUpIds: s.selectedFollowUpIds,
    toggleFollowUpSelection: s.toggleFollowUpSelection,
    selectAllVisibleFollowUps: s.selectAllVisibleFollowUps,
    updateItem: s.updateItem,
    markNudged: s.markNudged,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);

  const filteredItems = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);

  const baseColumns: Record<FollowUpColumnKey, ColumnDef<FollowUpItem>> = {
    title: { accessorKey: 'title', header: 'Title', cell: ({ row }) => <div><div className="font-medium text-slate-900">{row.original.title}</div><div className="text-xs text-slate-500">{personalMode ? row.original.project : row.original.id}</div></div> },
    project: { accessorKey: 'project', header: 'Project' },
    owner: { accessorKey: 'owner', header: 'Owner' },
    assignee: { id: 'assigneeDisplayName', accessorFn: (row) => row.assigneeDisplayName || row.owner, header: 'Assignee' },
    status: { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusTone(row.original.status)}>{row.original.status}</Badge> },
    priority: { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={priorityTone(row.original.priority)}>{row.original.priority}</Badge> },
    dueDate: { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate) },
    nextTouchDate: { accessorKey: 'nextTouchDate', header: 'Next touch', cell: ({ row }) => formatDate(row.original.nextTouchDate) },
    promisedDate: { accessorKey: 'promisedDate', header: 'Promised', cell: ({ row }) => formatDate(row.original.promisedDate) },
    waitingOn: { accessorKey: 'waitingOn', header: 'Waiting on', cell: ({ row }) => row.original.waitingOn || '—' },
    escalation: { accessorKey: 'escalationLevel', header: 'Escalation' },
    actionState: { accessorKey: 'actionState', header: 'Action state', cell: ({ row }) => row.original.actionState || 'Draft created' },
    linkedTaskSummary: { id: 'linkedTaskSummary', accessorFn: (row) => `${row.openLinkedTaskCount ?? 0}/${row.linkedTaskCount ?? 0}`, header: 'Linked tasks', cell: ({ row }) => `${row.original.openLinkedTaskCount ?? 0}/${row.original.linkedTaskCount ?? 0} open` },
    nextAction: { accessorKey: 'nextAction', header: 'Next action', cell: ({ row }) => <div className="max-w-[220px] truncate text-xs">{row.original.nextAction}</div> },
  };

  const columns = useMemo<ColumnDef<FollowUpItem>[]>(() => {
    const dynamic = columnOrder.filter((key) => followUpColumns.includes(key)).map((key) => baseColumns[key]);
    return [
      {
        id: 'select',
        header: () => <input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedFollowUpIds.includes(item.id))} onChange={(event) => selectAllVisibleFollowUps(event.target.checked ? filteredItems.map((item) => item.id) : [])} />,
        cell: ({ row }) => <input type="checkbox" checked={selectedFollowUpIds.includes(row.original.id)} onChange={() => toggleFollowUpSelection(row.original.id)} onClick={(event) => event.stopPropagation()} />,
        enableSorting: false,
      },
      ...dynamic,
      {
        id: 'quickActions',
        header: 'Quick actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button className="action-btn !px-2 !py-1 text-xs" onClick={(event) => { event.stopPropagation(); markNudged(row.original.id); }}>Nudge</button>
            <button className="action-btn !px-2 !py-1 text-xs" onClick={(event) => { event.stopPropagation(); updateItem(row.original.id, { status: row.original.status === 'Closed' ? 'Needs action' : 'Closed' }); }}>{row.original.status === 'Closed' ? 'Reopen' : 'Close'}</button>
            <input className="field-input !w-[130px] !py-1 text-xs" type="date" value={toDateInputValue(row.original.nextTouchDate)} onClick={(event) => event.stopPropagation()} onChange={(event) => updateItem(row.original.id, { nextTouchDate: fromDateInputValue(event.target.value) })} />
          </div>
        ),
      },
    ];
  }, [followUpColumns, filteredItems, selectedFollowUpIds, selectAllVisibleFollowUps, toggleFollowUpSelection]);

  const table = useReactTable({ data: filteredItems, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <AppShellCard className="p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse tracker-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {header.isPlaceholder ? null : (
                      <button className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const active = row.original.id === selectedId;
              return (
                <tr key={row.id} onClick={() => setSelectedId(row.original.id)} className={active ? 'tracker-row tracker-row-active' : 'tracker-row'}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top text-sm text-slate-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 ? <div className="p-4"><EmptyState title="No items found" message="Adjust filters or create a follow-up." /></div> : null}
      </div>
    </AppShellCard>
  );
}
