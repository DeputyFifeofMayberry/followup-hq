import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { daysUntil, formatDate, isOverdue, needsNudge, priorityTone, statusTone } from '../lib/utils';
import type { FollowUpColumnKey, FollowUpItem } from '../types';
import { AppShellCard, EmptyState } from './ui/AppPrimitives';
import { TrackerMobileList } from './TrackerMobileList';
import { useViewportBand } from '../hooks/useViewport';
import { useFollowUpsViewModel } from '../domains/followups';

const columnOrder: FollowUpColumnKey[] = ['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'linkedTaskSummary', 'nextAction', 'project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'actionState'];
const SUPPORT_COLUMNS = new Set(['project', 'owner', 'assigneeDisplayName', 'waitingOn', 'escalation', 'actionState', 'promisedDate']);
const TIMING_COLUMNS = new Set(['status', 'dueDate', 'nextTouchDate', 'priority']);
const SORTABLE_COLUMNS = new Set(['dueDate', 'nextTouchDate']);

function getWhatMattersNow(item: FollowUpItem): { label: string; tone: 'danger' | 'warn' | 'info' | 'success' } {
  const dueDelta = daysUntil(item.dueDate);
  const touchDelta = daysUntil(item.nextTouchDate);
  if (item.status === 'Closed') return { label: 'Closed record', tone: 'success' };
  if (isOverdue(item)) return { label: `Overdue by ${Math.abs(dueDelta)}d`, tone: 'danger' };
  if ((item.blockedLinkedTaskCount ?? 0) > 0) return { label: 'Blocked by linked work', tone: 'danger' };
  if (needsNudge(item)) return { label: touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today', tone: 'warn' };
  if (item.status === 'Waiting on external' || item.status === 'Waiting internal' || item.waitingOn) return { label: 'Waiting on response', tone: 'info' };
  if (item.status === 'At risk' || item.escalationLevel === 'Critical') return { label: 'At risk', tone: 'warn' };
  if (item.nextAction) return { label: 'Next move set', tone: 'info' };
  return { label: 'Needs direction', tone: 'info' };
}

export function TrackerTable({
  personalMode = false,
  embedded = false,
  rows,
  onRowOpen,
  onRequestDelete,
}: {
  personalMode?: boolean;
  embedded?: boolean;
  rows: FollowUpItem[];
  onRowOpen?: (id: string) => void;
  onRequestDelete?: (item: FollowUpItem) => void;
}) {
  const vm = useFollowUpsViewModel();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const { isMobileLike } = useViewportBand();

  const visibleColumns = useMemo(
    () => vm.followUpColumns.includes('nextAction') ? vm.followUpColumns : [...vm.followUpColumns, 'nextAction'],
    [vm.followUpColumns],
  );

  const baseColumns = useMemo<Record<FollowUpColumnKey, ColumnDef<FollowUpItem>>>(() => ({
    title: {
      accessorKey: 'title',
      header: 'Follow-up',
      cell: ({ row }) => {
        const matterNow = getWhatMattersNow(row.original);
        const supportMeta = [
          row.original.project,
          !personalMode ? (row.original.assigneeDisplayName || row.original.owner) : row.original.owner,
          row.original.owner !== (row.original.assigneeDisplayName || row.original.owner) ? `Owner: ${row.original.owner}` : null,
        ].filter(Boolean);
        return (
          <div className="tracker-title-cell">
            <div className="tracker-title-primary">{row.original.title}</div>
            <div className={`tracker-title-secondary tracker-title-secondary-${matterNow.tone}`}>{matterNow.label}</div>
            <div className="tracker-title-meta">{supportMeta.join(' • ')}</div>
          </div>
        );
      },
    },
    project: { accessorKey: 'project', header: 'Project' },
    owner: { accessorKey: 'owner', header: 'Owner' },
    assignee: { id: 'assigneeDisplayName', accessorFn: (row) => row.assigneeDisplayName || row.owner, header: 'Assignee' },
    status: { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusTone(row.original.status)}>{row.original.status}</Badge> },
    priority: { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={priorityTone(row.original.priority)}>{row.original.priority}</Badge> },
    dueDate: { accessorKey: 'dueDate', header: 'Due', enableSorting: true, cell: ({ row }) => formatDate(row.original.dueDate) },
    nextTouchDate: { accessorKey: 'nextTouchDate', header: 'Next touch', enableSorting: true, cell: ({ row }) => formatDate(row.original.nextTouchDate) },
    promisedDate: { accessorKey: 'promisedDate', header: 'Promised', cell: ({ row }) => formatDate(row.original.promisedDate) },
    waitingOn: { accessorKey: 'waitingOn', header: 'Waiting on', cell: ({ row }) => row.original.waitingOn || '—' },
    escalation: { accessorKey: 'escalationLevel', header: 'Escalation' },
    actionState: { accessorKey: 'actionState', header: 'Action state', cell: ({ row }) => row.original.actionState || 'Draft created' },
    linkedTaskSummary: {
      id: 'linkedTaskSummary',
      accessorFn: (row) => `${row.openLinkedTaskCount ?? 0}/${row.linkedTaskCount ?? 0}`,
      header: 'Linked tasks',
      cell: ({ row }) => {
        const open = row.original.openLinkedTaskCount ?? 0;
        const total = row.original.linkedTaskCount ?? 0;
        return <div className="text-xs text-slate-700">{open}/{total} open</div>;
      },
    },
    nextAction: { accessorKey: 'nextAction', header: 'Next move', cell: ({ row }) => <div className="tracker-next-move-content text-xs text-slate-600">{row.original.nextAction || 'No next move set'}</div> },
  }), [personalMode]);

  const columns = useMemo<ColumnDef<FollowUpItem>[]>(() => {
    const effectiveColumnOrder = personalMode && visibleColumns.includes('owner') && visibleColumns.includes('assignee')
      ? columnOrder.filter((key) => key !== 'owner')
      : columnOrder;
    const dynamic = effectiveColumnOrder.filter((key) => visibleColumns.includes(key)).map((key) => baseColumns[key]);
    return [
      {
        id: 'select',
        header: () => {
          const visibleIds = rows.map((item) => item.id);
          return <input aria-label="Select all visible follow-ups" type="checkbox" checked={rows.length > 0 && visibleIds.every((id) => vm.selectedFollowUpIds.includes(id))} onChange={(event) => vm.selectAllVisibleFollowUps(visibleIds, event.target.checked)} />;
        },
        cell: ({ row }) => <input aria-label={`Select ${row.original.title}`} type="checkbox" checked={vm.selectedFollowUpIds.includes(row.original.id)} onChange={() => vm.toggleFollowUpSelection(row.original.id)} onClick={(event) => event.stopPropagation()} />,
        enableSorting: false,
      },
      ...dynamic,
      {
        id: 'quickActions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="row-quick-actions">
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); onRowOpen?.(row.original.id); }}>Inspect</button>
            <details className="tracker-row-more-actions">
              <summary><MoreHorizontal className="h-3.5 w-3.5" /> More</summary>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.setSelectedId(row.original.id); vm.openTouchModal(); }}>Log touch</button>
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.markNudged(row.original.id); }}>Nudge</button>
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.snoozeItem(row.original.id, 2); }}>Snooze</button>
                <button type="button" className="action-btn action-btn-danger !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); onRequestDelete?.(row.original); }}>Delete</button>
              </div>
            </details>
          </div>
        ),
      },
    ];
  }, [visibleColumns, rows, vm.selectedFollowUpIds, vm.selectAllVisibleFollowUps, vm.toggleFollowUpSelection, personalMode, baseColumns, onRowOpen, vm, onRequestDelete]);

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const mobileBody = (
    <TrackerMobileList
      items={rows}
      selectedId={vm.selectedId}
      personalMode={personalMode}
      onOpenDetails={(id) => {
        vm.setSelectedId(id);
        onRowOpen?.(id);
      }}
      onLogTouch={(id) => {
        vm.setSelectedId(id);
        vm.openTouchModal();
      }}
      onNudge={vm.markNudged}
      onSnooze={(id) => vm.snoozeItem(id, 2)}
      onDelete={(id) => {
        const item = rows.find((entry) => entry.id === id);
        if (item) onRequestDelete?.(item);
      }}
      emptyStateMessage={vm.emptyStateMessage}
      hasActiveRowNarrowing={vm.hasActiveRowNarrowing}
      onResetFilters={vm.resetAllRowAffectingOptions}
    />
  );

  const desktopBody = (
    <>
      <div className="overflow-x-auto">
        <table className={`min-w-full border-collapse tracker-table ${vm.followUpTableDensity === 'comfortable' ? 'tracker-table-comfortable' : 'tracker-table-compact'}`}>
          <thead className="tracker-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className={[
                    'tracker-head-cell',
                    header.id === 'title' ? 'tracker-head-cell-identity' : '',
                    TIMING_COLUMNS.has(header.id) ? 'tracker-head-cell-timing' : '',
                    SUPPORT_COLUMNS.has(header.id) ? 'tracker-head-cell-support' : '',
                    header.id === 'nextAction' ? 'tracker-head-cell-next-move' : '',
                    header.id === 'quickActions' ? 'tracker-head-cell-action row-action-cell' : '',
                    header.id === 'quickActions' ? 'tracker-head-cell-actions' : '',
                  ].filter(Boolean).join(' ')} aria-sort={header.column.getCanSort() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none') : undefined}>
                    {header.isPlaceholder ? null : header.column.getCanSort() && SORTABLE_COLUMNS.has(header.id) ? (
                      <button
                        type="button"
                        className={`tracker-head-btn ${header.column.getIsSorted() ? 'tracker-head-btn-active' : ''}`}
                        data-sort={header.column.getIsSorted() || 'none'}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'
                          ? <ArrowUp className="h-3.5 w-3.5 tracker-head-btn-icon" aria-hidden="true" />
                          : header.column.getIsSorted() === 'desc'
                            ? <ArrowDown className="h-3.5 w-3.5 tracker-head-btn-icon" aria-hidden="true" />
                            : <ArrowUpDown className="h-3.5 w-3.5 tracker-head-btn-icon" aria-hidden="true" />}
                      </button>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const active = row.original.id === vm.selectedId;
              return (
                <tr
                  key={row.id}
                  onClick={() => { vm.setSelectedId(row.original.id); onRowOpen?.(row.original.id); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      vm.setSelectedId(row.original.id);
                      onRowOpen?.(row.original.id);
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
                      cell.column.id === 'nextAction' ? 'tracker-cell-next-move' : '',
                      cell.column.id === 'quickActions' ? 'row-action-cell' : '',
                      cell.column.id === 'quickActions' ? 'tracker-cell-actions' : '',
                    ].filter(Boolean).join(' ')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-4 tracker-empty-state-wrap">
            <EmptyState title={vm.hasActiveRowNarrowing ? 'No follow-ups match the current filters' : 'No follow-ups yet'} message={vm.emptyStateMessage} />
            {vm.hasActiveRowNarrowing ? <button type="button" className="primary-btn" onClick={vm.resetAllRowAffectingOptions}>Reset filters</button> : null}
          </div>
        ) : null}
      </div>
    </>
  );

  const tableBody = isMobileLike ? mobileBody : desktopBody;

  if (embedded) {
    return <div className="tracker-table-surface tracker-table-embedded">{tableBody}</div>;
  }

  return (
    <AppShellCard className="p-0 tracker-table-surface" surface="data">
      {tableBody}
    </AppShellCard>
  );
}
