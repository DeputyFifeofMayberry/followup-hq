import { ArrowUpDown } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { daysUntil, formatDate, needsNudge, priorityTone, statusTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { AppMode, FollowUpColumnKey, FollowUpItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { AppShellCard, AppBadge, EmptyState, ExecutionLaneFooterMeta } from './ui/AppPrimitives';
import { selectFollowUpRows } from '../lib/followUpSelectors';
import { getModeConfig } from '../lib/appModeConfig';
import type { FollowUpAttentionSignal } from '../domains/followups';
import { TrackerMobileList } from './TrackerMobileList';
import { useViewportBand } from '../hooks/useViewport';
import { getExecutionLaneNextSelection } from '../domains/shared/executionLane/helpers';

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
  return { label: item.nextAction || 'Set next move', tone: 'info' };
}

export function TrackerTable({
  personalMode = false,
  appMode = personalMode ? 'personal' : 'team',
  embedded = false,
  selectedAttentionSignal,
  onRowOpen,
  subtitle,
}: {
  personalMode?: boolean;
  appMode?: AppMode;
  embedded?: boolean;
  selectedAttentionSignal?: FollowUpAttentionSignal | null;
  onRowOpen?: (id: string) => void;
  subtitle?: string;
}) {
  const { items, contacts, companies, selectedId, setSelectedId, search, activeView, followUpFilters, followUpColumns, selectedFollowUpIds, toggleFollowUpSelection, selectAllVisibleFollowUps, markNudged, followUpTableDensity, openTouchModal, snoozeItem, deleteItem, confirmFollowUpSent, updateItem } = useAppStore(useShallow((s) => ({
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
    openTouchModal: s.openTouchModal,
    snoozeItem: s.snoozeItem,
    deleteItem: s.deleteItem,
    confirmFollowUpSent: s.confirmFollowUpSent,
    updateItem: s.updateItem,
  })));
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const modeConfig = getModeConfig(appMode);
  const { isMobileLike } = useViewportBand();

  const filteredItems = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);

  const handleDelete = (id: string) => {
    const target = filteredItems.find((item) => item.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Delete follow-up \"${target.title}\"? This cannot be undone.`);
    if (!confirmed) return;
    deleteItem(id);
    const progression = getExecutionLaneNextSelection(filteredItems.map((item) => item.id), selectedId, [id]);
    if (selectedId === id) setSelectedId(progression.nextSelectedId ?? null);
  };

  const baseColumns = useMemo<Record<FollowUpColumnKey, ColumnDef<FollowUpItem>>>(() => ({
    title: {
      accessorKey: 'title',
      header: 'Follow-up',
      cell: ({ row }) => {
        const active = row.original.id === selectedId;
        const matterNow = getWhatMattersNow(row.original);
        const supportMeta = [
          row.original.project,
          !personalMode ? (row.original.assigneeDisplayName || row.original.owner) : row.original.owner,
          row.original.owner !== (row.original.assigneeDisplayName || row.original.owner) ? `Owner: ${row.original.owner}` : null,
        ].filter(Boolean);
        return (
          <div className="tracker-title-cell">
            <div className="tracker-title-primary">{row.original.title}</div>
            <div className="tracker-title-secondary">{matterNow.label}</div>
            <div className="mt-1 text-xs text-slate-500">{supportMeta.join(' • ')}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <AppBadge tone={matterNow.tone}>{matterNow.tone === 'info' ? 'What matters now' : matterNow.label}</AppBadge>
              {row.original.priority === 'Critical' ? <AppBadge tone="warn">Critical priority</AppBadge> : null}
              {active && selectedAttentionSignal ? <AppBadge tone={selectedAttentionSignal.tone === 'default' ? 'info' : selectedAttentionSignal.tone}>{selectedAttentionSignal.label}</AppBadge> : null}
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
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); onRowOpen?.(row.original.id); }}>Open</button>
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); setSelectedId(row.original.id); openTouchModal(); }}>Log touch</button>
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); markNudged(row.original.id); }}>Nudge</button>
            <button type="button" className="action-btn !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); snoozeItem(row.original.id, 2); }}>Snooze</button>
            <button type="button" className="action-btn action-btn-danger !px-2 !py-1 text-xs !font-medium" onClick={(event) => { event.stopPropagation(); handleDelete(row.original.id); }}>Delete</button>
          </div>
        ),
      },
    ];
  }, [followUpColumns, filteredItems, selectedFollowUpIds, selectAllVisibleFollowUps, toggleFollowUpSelection, markNudged, personalMode, baseColumns, onRowOpen, setSelectedId, openTouchModal, snoozeItem]);

  const table = useReactTable({ data: filteredItems, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const mobileBody = (
    <TrackerMobileList
      items={filteredItems}
      selectedId={selectedId}
      selectedCount={selectedFollowUpIds.length}
      appMode={appMode}
      personalMode={personalMode}
      onSelect={setSelectedId}
      onLogTouch={(id) => {
        setSelectedId(id);
        openTouchModal();
      }}
      onNudge={markNudged}
      onSnooze={(id) => snoozeItem(id, 2)}
      onMarkSent={(id) => confirmFollowUpSent(id, 'Marked sent from mobile execution surface.')}
      onStatusChange={(id, status) => updateItem(id, { status })}
    />
  );

  const desktopBody = (
    <>
      {subtitle ? <div className="px-3 pt-2 text-xs text-slate-500">{subtitle}</div> : null}
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
              const active = row.original.id === selectedId;
              return (
                <tr
                  key={row.id}
                  onClick={() => { setSelectedId(row.original.id); onRowOpen?.(row.original.id); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(row.original.id);
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
        {filteredItems.length === 0 ? <div className="p-4"><EmptyState title="No follow-ups found" message="Adjust filters or clear search to find matching follow-ups." /></div> : null}
      </div>
      <ExecutionLaneFooterMeta
        shownCount={filteredItems.length}
        selectedCount={selectedFollowUpIds.length}
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
