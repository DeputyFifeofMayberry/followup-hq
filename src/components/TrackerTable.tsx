import { ArrowUpDown } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { formatDate, fromDateInputValue, priorityTone, statusTone, toDateInputValue } from '../lib/utils';
import { validateFollowUpTransition } from '../lib/workflowPolicy';
import { useAppStore } from '../store/useAppStore';
import type { AppMode, FollowUpColumnKey, FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppShellCard, EmptyState } from './ui/AppPrimitives';
import { selectFollowUpRows } from '../lib/followUpSelectors';
import { getModeConfig } from '../lib/appModeConfig';

const columnOrder: FollowUpColumnKey[] = ['title', 'project', 'owner', 'assignee', 'status', 'priority', 'dueDate', 'nextTouchDate', 'promisedDate', 'waitingOn', 'escalation', 'actionState', 'linkedTaskSummary', 'nextAction'];

export function TrackerTable({ personalMode = false, appMode = personalMode ? 'personal' : 'team' }: { personalMode?: boolean; appMode?: AppMode }) {
  const { items, contacts, companies, selectedId, setSelectedId, search, activeView, followUpFilters, followUpColumns, selectedFollowUpIds, toggleFollowUpSelection, selectAllVisibleFollowUps, updateItem, markNudged } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    selectedId: s.selectedId,
    tasks: s.tasks,
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
    attemptFollowUpTransition: s.attemptFollowUpTransition,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const modeConfig = getModeConfig(appMode);

  const filteredItems = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);

  const baseColumns: Record<FollowUpColumnKey, ColumnDef<FollowUpItem>> = {
    title: { accessorKey: 'title', header: 'Work item', cell: ({ row }) => <div className="tracker-title-cell"><div className="tracker-title-primary">{row.original.title}</div><div className="tracker-title-secondary">{personalMode ? row.original.project : row.original.id}</div></div> },
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
    nextAction: { accessorKey: 'nextAction', header: 'Next action', cell: ({ row }) => <div className="max-w-[220px] truncate text-xs text-slate-600">{row.original.nextAction}</div> },
  };

  const columns = useMemo<ColumnDef<FollowUpItem>[]>(() => {
    const effectiveColumnOrder = personalMode && followUpColumns.includes('owner') && followUpColumns.includes('assignee')
      ? columnOrder.filter((key) => key !== 'owner')
      : columnOrder;
    const dynamic = effectiveColumnOrder.filter((key) => followUpColumns.includes(key)).map((key) => baseColumns[key]);
    return [
      {
        id: 'select',
        header: () => <input aria-label="Select all visible follow-ups" type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedFollowUpIds.includes(item.id))} onChange={(event) => selectAllVisibleFollowUps(event.target.checked ? filteredItems.map((item) => item.id) : [])} />,
        cell: ({ row }) => <input aria-label={`Select ${row.original.title}`} type="checkbox" checked={selectedFollowUpIds.includes(row.original.id)} onChange={() => toggleFollowUpSelection(row.original.id)} onClick={(event) => event.stopPropagation()} />,
        enableSorting: false,
      },
      ...dynamic,
      {
        id: 'quickActions',
        header: 'Quick actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button type="button" className="action-btn !px-2 !py-1 text-xs" onClick={(event) => { event.stopPropagation(); markNudged(row.original.id); }}>Nudge</button>
            <button type="button" className="action-btn !px-2 !py-1 text-xs" onClick={(event) => {
              event.stopPropagation();
              if (row.original.status === 'Closed') {
                updateItem(row.original.id, { status: 'Needs action' });
                return;
              }
              const note = window.prompt('Close follow-up note (required unless override):', row.original.completionNote || '');
              const baseValidation = validateFollowUpTransition({ record: row.original, from: row.original.status, to: 'Closed', patch: { status: 'Closed', completionNote: note || undefined }, context: { tasks } });
              if (!baseValidation.allowed && baseValidation.overrideAllowed) {
                const proceed = window.confirm(`${baseValidation.blockers.join(' ')}\nClose parent anyway with override?`);
                if (!proceed) return;
                attemptFollowUpTransition(row.original.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined }, { override: true });
                return;
              }
              if (!baseValidation.allowed) {
                window.alert(baseValidation.blockers.join(' '));
                return;
              }
              const result = attemptFollowUpTransition(row.original.id, 'Closed', { actionState: 'Complete', completionNote: note || undefined });
              if (result.validation.warnings.length) window.alert(result.validation.warnings.join('\n'));
            }}>{row.original.status === 'Closed' ? 'Reopen' : 'Close'}</button>
            <input aria-label={`Next touch date for ${row.original.title}`} className="field-input !w-[130px] !py-1 text-xs" type="date" value={toDateInputValue(row.original.nextTouchDate)} onClick={(event) => event.stopPropagation()} onChange={(event) => updateItem(row.original.id, { nextTouchDate: fromDateInputValue(event.target.value) })} />
          </div>
        ),
      },
    ];
  }, [followUpColumns, filteredItems, selectedFollowUpIds, selectAllVisibleFollowUps, toggleFollowUpSelection, markNudged, updateItem, personalMode]);

  const table = useReactTable({ data: filteredItems, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <AppShellCard className="p-0 tracker-table-surface" surface="data">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse tracker-table">
          <thead className="tracker-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className="tracker-head-cell" aria-sort={header.column.getCanSort() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none') : undefined}>
                    {header.isPlaceholder ? null : (
                      <button type="button" className="tracker-head-btn" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? <ArrowUpDown className="h-3.5 w-3.5" /> : null}
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
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.original.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(row.original.id);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={active}
                  className={active ? 'tracker-row tracker-row-active list-row-family-active' : 'tracker-row'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="tracker-cell">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 ? <div className="p-4"><EmptyState title="No items found" message="Adjust filters, clear search, or create a follow-up." /></div> : null}
      </div>
      <div className="text-xs text-slate-500 tracker-table-foot">{selectedFollowUpIds.length > 0 ? `${selectedFollowUpIds.length} rows selected for bulk workflow.` : (modeConfig.trackerOwnerContext === 'compact' ? 'Execution view: owner details are reduced so next action and timing stay primary.' : 'Coordination view: owner and assignee context stays visible for assignment decisions.')}</div>
    </AppShellCard>
  );
}
