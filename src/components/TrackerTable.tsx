import { ArrowUpDown } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { daysUntil, formatDate, needsNudge, priorityTone, statusTone } from '../lib/utils';
import type { AppMode, FollowUpColumnKey, FollowUpItem } from '../types';
import { AppShellCard, AppBadge, EmptyState, ExecutionLaneFooterMeta } from './ui/AppPrimitives';
import { getModeConfig } from '../lib/appModeConfig';
import { TrackerMobileList } from './TrackerMobileList';
import { useViewportBand } from '../hooks/useViewport';
import { useFollowUpsViewModel } from '../domains/followups';

const columnOrder: FollowUpColumnKey[] = ['title', 'status', 'dueDate', 'nextTouchDate', 'priority', 'linkedTaskSummary', 'project', 'owner', 'assignee', 'promisedDate', 'waitingOn', 'escalation', 'nextAction', 'actionState'];
const SUPPORT_COLUMNS = new Set(['project', 'owner', 'assigneeDisplayName', 'waitingOn', 'escalation', 'actionState', 'nextAction', 'promisedDate']);
const TIMING_COLUMNS = new Set(['status', 'dueDate', 'nextTouchDate', 'priority']);
const SORTABLE_COLUMNS = new Set(['dueDate', 'nextTouchDate']);

function getWhatMattersNow(item: FollowUpItem): { label: string; tone: 'danger' | 'warn' | 'info' | 'success' } {
  const dueDelta = daysUntil(item.dueDate);
  const touchDelta = daysUntil(item.nextTouchDate);
  if (item.status === 'Closed') return { label: 'Closed record', tone: 'success' };
  if (dueDelta < 0) return { label: `Overdue by ${Math.abs(dueDelta)}d`, tone: 'danger' };
  if ((item.blockedLinkedTaskCount ?? 0) > 0) return { label: 'Blocked by linked work', tone: 'danger' };
  if (needsNudge(item)) return { label: touchDelta < 0 ? `Touch overdue ${Math.abs(touchDelta)}d` : 'Touch due today', tone: 'warn' };
  if (item.allLinkedTasksDone) return { label: 'Ready to close', tone: 'info' };
  if (item.status === 'Waiting on external' || item.status === 'Waiting internal' || item.waitingOn) return { label: 'Waiting on response', tone: 'info' };
  if (item.status === 'At risk' || item.escalationLevel === 'Critical') return { label: 'At risk', tone: 'warn' };
  if (item.nextAction) return { label: 'Next move set', tone: 'info' };
  return { label: 'Needs direction', tone: 'info' };
}

export function TrackerTable({
  personalMode = false,
  appMode = personalMode ? 'personal' : 'team',
  embedded = false,
  rows,
  onRowOpen,
}: {
  personalMode?: boolean;
  appMode?: AppMode;
  embedded?: boolean;
  rows: FollowUpItem[];
  onRowOpen?: (id: string) => void;
}) {
  const vm = useFollowUpsViewModel();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const modeConfig = getModeConfig(appMode);
  const { isMobileLike } = useViewportBand();

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
        const showUrgencyBadge = matterNow.tone !== 'info' || matterNow.label === 'Ready to close' || matterNow.label === 'Waiting on response';
        return (
          <div className="tracker-title-cell">
            <div className="tracker-title-primary">{row.original.title}</div>
            <div className="tracker-title-secondary">{matterNow.label}</div>
            <div className="tracker-title-next">Next move: {row.original.nextAction || 'No next move set'}</div>
            <div className="tracker-title-meta">{supportMeta.join(' • ')}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant={statusTone(row.original.status)}>{row.original.status}</Badge>
              {showUrgencyBadge && matterNow.tone !== 'info' ? <AppBadge tone={matterNow.tone}>{matterNow.label}</AppBadge> : null}
            </div>
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
    nextAction: { accessorKey: 'nextAction', header: 'Next move', cell: ({ row }) => <div className="max-w-[220px] truncate text-xs text-slate-600">{row.original.nextAction || '—'}</div> },
  }), [personalMode]);

  const columns = useMemo<ColumnDef<FollowUpItem>[]>(() => {
    const effectiveColumnOrder = personalMode && vm.followUpColumns.includes('owner') && vm.followUpColumns.includes('assignee')
      ? columnOrder.filter((key) => key !== 'owner')
      : columnOrder;
    const dynamic = effectiveColumnOrder.filter((key) => vm.followUpColumns.includes(key)).map((key) => baseColumns[key]);
    return [
      {
        id: 'select',
        header: () => <input aria-label="Select all visible follow-ups" type="checkbox" checked={rows.length > 0 && rows.every((item) => vm.selectedFollowUpIds.includes(item.id))} onChange={(event) => vm.selectAllVisibleFollowUps(event.target.checked ? rows.map((item) => item.id) : [])} />,
        cell: ({ row }) => <input aria-label={`Select ${row.original.title}`} type="checkbox" checked={vm.selectedFollowUpIds.includes(row.original.id)} onChange={() => vm.toggleFollowUpSelection(row.original.id)} onClick={(event) => event.stopPropagation()} />,
        enableSorting: false,
      },
      ...dynamic,
      {
        id: 'quickActions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1 row-quick-actions">
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); onRowOpen?.(row.original.id); }}>Inspect</button>
            <details className="tracker-row-more-actions">
              <summary>Act</summary>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.setSelectedId(row.original.id); vm.openTouchModal(); }}>Log touch</button>
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.markNudged(row.original.id); }}>Nudge</button>
                <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); vm.snoozeItem(row.original.id, 2); }}>Snooze</button>
              </div>
            </details>
          </div>
        ),
      },
    ];
  }, [vm.followUpColumns, rows, vm.selectedFollowUpIds, vm.selectAllVisibleFollowUps, vm.toggleFollowUpSelection, personalMode, baseColumns, onRowOpen, vm]);

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const mobileBody = (
    <TrackerMobileList
      items={rows}
      selectedId={vm.selectedId}
      selectedCount={vm.actionableSelectedFollowUpIds.length}
      appMode={appMode}
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
                    header.id === 'quickActions' ? 'tracker-head-cell-action row-action-cell' : '',
                  ].filter(Boolean).join(' ')} aria-sort={header.column.getCanSort() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none') : undefined}>
                    {header.isPlaceholder ? null : header.column.getCanSort() && SORTABLE_COLUMNS.has(header.id) ? (
                      <button type="button" className="tracker-head-btn" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3.5 w-3.5" />
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
                      cell.column.id === 'quickActions' ? 'row-action-cell' : '',
                    ].filter(Boolean).join(' ')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="p-4"><EmptyState title="No follow-ups found" message="Adjust filters or clear search to find matching follow-ups." /></div> : null}
      </div>
      <ExecutionLaneFooterMeta
        shownCount={rows.length}
        selectedCount={vm.actionableSelectedFollowUpIds.length}
        scopeSummary={modeConfig.trackerOwnerContext === 'compact' ? 'Execution view' : 'Coordination view'}
        hint={modeConfig.trackerOwnerContext === 'compact' ? 'Next move and timing stay primary.' : 'Owner and assignee remain visible for handoff decisions.'}
      />
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
