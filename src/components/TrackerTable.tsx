import { ArrowUpDown } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { formatDate, priorityTone, statusTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { AppMode, FollowUpColumnKey, FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppShellCard, AppBadge, EmptyState } from './ui/AppPrimitives';
import { selectFollowUpRows } from '../lib/followUpSelectors';
import { getModeConfig } from '../lib/appModeConfig';
import type { FollowUpAttentionSignal } from '../domains/followups';

const columnOrder: FollowUpColumnKey[] = ['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'linkedTaskSummary', 'project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'nextAction', 'actionState'];
const SUPPORT_COLUMNS = new Set(['project', 'owner', 'assigneeDisplayName', 'waitingOn', 'escalation', 'actionState', 'linkedTaskSummary', 'nextAction', 'promisedDate']);
const TIMING_COLUMNS = new Set(['status', 'dueDate', 'nextTouchDate', 'priority']);

export function TrackerTable({
  personalMode = false,
  appMode = personalMode ? 'personal' : 'team',
  embedded = false,
  selectedAttentionSignal,
}: {
  personalMode?: boolean;
  appMode?: AppMode;
  embedded?: boolean;
  selectedAttentionSignal?: FollowUpAttentionSignal | null;
}) {
  const { items, contacts, companies, selectedId, setSelectedId, search, activeView, followUpFilters, followUpColumns, selectedFollowUpIds, toggleFollowUpSelection, selectAllVisibleFollowUps, markNudged, followUpTableDensity } = useAppStore(useShallow((s) => ({
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
    markNudged: s.markNudged,
    followUpTableDensity: s.followUpTableDensity,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const modeConfig = getModeConfig(appMode);

  const filteredItems = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);

  const baseColumns = useMemo<Record<FollowUpColumnKey, ColumnDef<FollowUpItem>>>(() => ({
    title: {
      accessorKey: 'title',
      header: 'Work item',
      cell: ({ row }) => {
        const active = row.original.id === selectedId;
        return (
          <div className="tracker-title-cell">
            <div className="tracker-title-primary">{row.original.title}</div>
            <div className="tracker-title-secondary">{personalMode ? row.original.project : row.original.id}</div>
            {active && selectedAttentionSignal ? (
              <div className="mt-1">
                <AppBadge tone={selectedAttentionSignal.tone === 'default' ? 'info' : selectedAttentionSignal.tone}>{selectedAttentionSignal.label}</AppBadge>
              </div>
            ) : null}
          </div>
        );
      },
    },
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
    linkedTaskSummary: {
      id: 'linkedTaskSummary',
      accessorFn: (row) => `${row.openLinkedTaskCount ?? 0}/${row.linkedTaskCount ?? 0}`,
      header: 'Linked tasks',
      cell: ({ row }) => `${row.original.openLinkedTaskCount ?? 0}/${row.original.linkedTaskCount ?? 0} open`,
    },
    nextAction: { accessorKey: 'nextAction', header: 'Next action', cell: ({ row }) => <div className="max-w-[220px] truncate text-xs text-slate-600">{row.original.nextAction}</div> },
  }), [personalMode, selectedId, selectedAttentionSignal]);

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
        header: 'Quick',
        enableSorting: false,
        cell: ({ row }) => (
          <button type="button" className="action-btn !px-2 !py-1 text-xs" onClick={(event) => { event.stopPropagation(); markNudged(row.original.id); }}>Nudge</button>
        ),
      },
    ];
  }, [followUpColumns, filteredItems, selectedFollowUpIds, selectAllVisibleFollowUps, toggleFollowUpSelection, markNudged, personalMode, baseColumns]);

  const table = useReactTable({ data: filteredItems, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const tableBody = (
    <>
      <div className="overflow-x-auto">
        <table className={`min-w-full border-collapse tracker-table ${followUpTableDensity === 'comfortable' ? 'tracker-table-comfortable' : 'tracker-table-compact'}`}>
          <thead className="tracker-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className={[
                    'tracker-head-cell',
                    header.id === 'title' ? 'tracker-head-cell-identity' : '',
                    TIMING_COLUMNS.has(header.id) ? 'tracker-head-cell-timing' : '',
                    SUPPORT_COLUMNS.has(header.id) ? 'tracker-head-cell-support' : '',
                    header.id === 'quickActions' ? 'tracker-head-cell-action row-action-cell' : '',
                  ].filter(Boolean).join(' ')} aria-sort={header.column.getCanSort() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none') : undefined}>
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
                    <td key={cell.id} className={[
                      'tracker-cell',
                      cell.column.id === 'title' ? 'tracker-cell-identity' : '',
                      TIMING_COLUMNS.has(cell.column.id) ? 'tracker-cell-timing' : '',
                      SUPPORT_COLUMNS.has(cell.column.id) ? 'tracker-cell-support' : '',
                      cell.column.id === 'quickActions' ? 'row-action-cell' : '',
                    ].filter(Boolean).join(' ')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 ? <div className="p-4"><EmptyState title="No follow-ups found" message="Adjust filters, clear search, or Quick Add a follow-up." /></div> : null}
      </div>
      <div className="text-xs text-slate-500 tracker-table-foot">{selectedFollowUpIds.length > 0 ? `${selectedFollowUpIds.length} rows selected for bulk workflow.` : (modeConfig.trackerOwnerContext === 'compact' ? 'Execution view: owner details are reduced so next action and timing stay primary.' : 'Coordination view: owner and assignee context stays visible for assignment decisions.')}</div>
    </>
  );

  if (embedded) {
    return <div className="tracker-table-surface tracker-table-embedded">{tableBody}</div>;
  }

  return (
    <AppShellCard className="p-0 tracker-table-surface" surface="data">
      {tableBody}
    </AppShellCard>
  );
}
