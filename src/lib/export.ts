import type { FollowUpItem, FollowUpPriority, FollowUpStatus, SavedViewKey, TaskItem, TaskPriority, TaskStatus } from '../types';
import { applySavedView, daysSince, formatDate, formatDateTime, isOverdue, needsNudge } from './utils';
import { isReviewRecord, isTrustedLiveRecord } from '../domains/records/integrity';

export type ExportDataset = 'followUps' | 'tasks' | 'combined';
export type ExportDetailLevel = 'simple' | 'standard' | 'detailed';

export interface FollowUpExportFilters {
  savedView: SavedViewKey;
  project: string;
  owner: string;
  statuses: Array<'All' | FollowUpStatus>;
  priorities: Array<'All' | FollowUpPriority>;
  search: string;
  dueFrom: string;
  dueTo: string;
  nextTouchFrom: string;
  nextTouchTo: string;
  includeClosed: boolean;
  onlyOverdue: boolean;
  onlyNeedsNudge: boolean;
  tagQuery: string;
  includeReviewRequired: boolean;
  includeDraftRecords: boolean;
}

export interface TaskExportFilters {
  project: string;
  owner: string;
  statuses: Array<'All' | TaskStatus>;
  priorities: Array<'All' | TaskPriority>;
  search: string;
  dueFrom: string;
  dueTo: string;
  linkedOnly: boolean;
  includeDone: boolean;
  tagQuery: string;
  includeReviewRequired: boolean;
  includeDraftRecords: boolean;
}

export interface ExportOptions {
  dataset: ExportDataset;
  detailLevel: ExportDetailLevel;
  fileBaseName: string;
  includeSummarySheet: boolean;
  includeNotes: boolean;
  includeTimeline: boolean;
  includeSourceRefs: boolean;
  includeDrafts: boolean;
  includeTags: boolean;
  includeLinkedRecordColumns: boolean;
  includeTrustColumns: boolean;
  followUps: FollowUpExportFilters;
  tasks: TaskExportFilters;
}

export const FOLLOW_UP_STATUS_OPTIONS: FollowUpStatus[] = [
  'Needs action',
  'Waiting on external',
  'Waiting internal',
  'In progress',
  'At risk',
  'Closed',
];

export const FOLLOW_UP_PRIORITY_OPTIONS: FollowUpPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const TASK_STATUS_OPTIONS: TaskStatus[] = ['To do', 'In progress', 'Blocked', 'Done'];
export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const EXPORT_DETAIL_OPTIONS: ExportDetailLevel[] = ['simple', 'standard', 'detailed'];

async function loadXlsx() {
  return import('xlsx');
}

function matchesDateRange(dateIso: string | undefined, from: string, to: string): boolean {
  if (!dateIso) return false;
  const date = new Date(dateIso).getTime();
  if (from) {
    const fromDate = new Date(`${from}T00:00:00`).getTime();
    if (date < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59`).getTime();
    if (date > toDate) return false;
  }
  return true;
}

function includesText(values: Array<string | undefined>, search: string): boolean {
  if (!search.trim()) return true;
  const haystack = values.filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function includesTag(tags: string[], tagQuery: string): boolean {
  if (!tagQuery.trim()) return true;
  const query = tagQuery.trim().toLowerCase();
  return tags.some((tag) => tag.toLowerCase().includes(query));
}

export function filterFollowUps(items: FollowUpItem[], filters: FollowUpExportFilters): FollowUpItem[] {
  const savedViewItems = applySavedView(items, filters.savedView);
  return savedViewItems.filter((item) => {
    const reviewRecord = isReviewRecord(item);
    const isDraft = item.lifecycleState === 'draft' || item.dataQuality === 'draft';
    if (!filters.includeReviewRequired && reviewRecord) return false;
    if (!filters.includeDraftRecords && isDraft) return false;
    if (!reviewRecord && !isDraft && !isTrustedLiveRecord(item)) return false;
    if (!filters.includeClosed && item.status === 'Closed') return false;
    if (filters.project !== 'All' && item.project !== filters.project) return false;
    if (filters.owner !== 'All' && item.owner !== filters.owner) return false;
    if (!filters.statuses.includes('All') && !filters.statuses.includes(item.status)) return false;
    if (!filters.priorities.includes('All') && !filters.priorities.includes(item.priority)) return false;
    if (filters.onlyOverdue && !isOverdue(item)) return false;
    if (filters.onlyNeedsNudge && !needsNudge(item)) return false;
    if ((filters.dueFrom || filters.dueTo) && !matchesDateRange(item.dueDate, filters.dueFrom, filters.dueTo)) return false;
    if ((filters.nextTouchFrom || filters.nextTouchTo) && !matchesDateRange(item.nextTouchDate, filters.nextTouchFrom, filters.nextTouchTo)) return false;
    if (!includesTag(item.tags, filters.tagQuery)) return false;

    return includesText(
      [
        item.id,
        item.title,
        item.project,
        item.owner,
        item.summary,
        item.nextAction,
        item.notes,
        item.waitingOn,
        item.sourceRef,
        item.tags.join(' '),
      ],
      filters.search,
    );
  });
}

export function filterTasks(tasks: TaskItem[], filters: TaskExportFilters): TaskItem[] {
  return tasks.filter((task) => {
    const reviewRecord = isReviewRecord(task);
    const isDraft = task.lifecycleState === 'draft' || task.dataQuality === 'draft';
    if (!filters.includeReviewRequired && reviewRecord) return false;
    if (!filters.includeDraftRecords && isDraft) return false;
    if (!reviewRecord && !isDraft && !isTrustedLiveRecord(task)) return false;
    if (!filters.includeDone && task.status === 'Done') return false;
    if (filters.project !== 'All' && task.project !== filters.project) return false;
    if (filters.owner !== 'All' && task.owner !== filters.owner) return false;
    if (!filters.statuses.includes('All') && !filters.statuses.includes(task.status)) return false;
    if (!filters.priorities.includes('All') && !filters.priorities.includes(task.priority)) return false;
    if (filters.linkedOnly && !task.linkedFollowUpId) return false;
    if ((filters.dueFrom || filters.dueTo) && !matchesDateRange(task.dueDate, filters.dueFrom, filters.dueTo)) return false;
    if (!includesTag(task.tags, filters.tagQuery)) return false;

    return includesText(
      [
        task.id,
        task.title,
        task.project,
        task.owner,
        task.summary,
        task.nextStep,
        task.notes,
        task.tags.join(' '),
      ],
      filters.search,
    );
  });
}

function buildFollowUpRows(items: FollowUpItem[], options: ExportOptions): Array<Record<string, string | number>> {
  return items.map((item) => {
    const base: Record<string, string | number> = {
      ID: item.id,
      Title: item.title,
      Project: item.project,
      Owner: item.owner,
      Status: item.status,
      Priority: item.priority,
      Due: formatDate(item.dueDate),
      'Next Touch': formatDate(item.nextTouchDate),
      'Next Action': item.nextAction,
    };

    if (options.detailLevel !== 'simple') {
      base.Source = item.source;
      base.Category = item.category;
      base.Escalation = item.escalationLevel;
      base['Owes Next Action'] = item.owesNextAction;
      base['Last Touch'] = formatDate(item.lastTouchDate);
      base['Promised Date'] = formatDate(item.promisedDate);
      base['Waiting On'] = item.waitingOn ?? '';
      base.Summary = item.summary;
      base['Days Since Last Touch'] = daysSince(item.lastTouchDate);
      base['Needs Nudge'] = needsNudge(item) ? 'Yes' : 'No';
      base.Overdue = isOverdue(item) ? 'Yes' : 'No';
    }

    if (options.includeTags) {
      base.Tags = item.tags.join(', ');
    }

    if (options.includeLinkedRecordColumns) {
      base['Contact ID'] = item.contactId ?? '';
      base['Company ID'] = item.companyId ?? '';
      base['Project ID'] = item.projectId ?? '';
      base['Thread Key'] = item.threadKey ?? '';
    }
    if (options.includeTrustColumns) {
      base['Lifecycle State'] = item.lifecycleState || '';
      base['Data Quality'] = item.dataQuality || '';
      base['Needs Cleanup'] = item.needsCleanup ? 'Yes' : 'No';
      base['Review Reasons'] = item.reviewReasons?.join(' | ') || '';
      base['Integrity Summary'] = item.invalidReason || '';
    }

    if (options.detailLevel === 'detailed' || options.includeSourceRefs) {
      base['Source Ref'] = item.sourceRef;
      base['All Source Refs'] = item.sourceRefs.join(' | ');
      base['Merged Item IDs'] = item.mergedItemIds.join(', ');
      base['Last Nudged At'] = formatDateTime(item.lastNudgedAt);
      base['Snoozed Until'] = formatDate(item.snoozedUntilDate);
      base['Cadence Days'] = item.cadenceDays;
    }

    if (options.detailLevel === 'detailed' || options.includeNotes) {
      base.Notes = item.notes;
    }

    if (options.detailLevel === 'detailed' || options.includeDrafts) {
      base['Draft Follow Up'] = item.draftFollowUp ?? '';
    }

    if (options.detailLevel === 'detailed' || options.includeTimeline) {
      base.Timeline = item.timeline.map((event) => `${formatDateTime(event.at)} | ${event.type} | ${event.summary}`).join('\n');
    }

    return base;
  });
}

function buildTaskRows(tasks: TaskItem[], options: ExportOptions): Array<Record<string, string | number>> {
  return tasks.map((task) => {
    const base: Record<string, string | number> = {
      ID: task.id,
      Title: task.title,
      Project: task.project,
      Owner: task.owner,
      Status: task.status,
      Priority: task.priority,
      Due: formatDate(task.dueDate),
      'Next Step': task.nextStep,
    };

    if (options.detailLevel !== 'simple') {
      base['Start Date'] = formatDate(task.startDate);
      base['Completed At'] = formatDateTime(task.completedAt);
      base['Created At'] = formatDateTime(task.createdAt);
      base['Updated At'] = formatDateTime(task.updatedAt);
      base.Summary = task.summary;
    }

    if (options.includeTags) {
      base.Tags = task.tags.join(', ');
    }

    if (options.includeLinkedRecordColumns) {
      base['Linked Follow Up ID'] = task.linkedFollowUpId ?? '';
      base['Contact ID'] = task.contactId ?? '';
      base['Company ID'] = task.companyId ?? '';
      base['Project ID'] = task.projectId ?? '';
    }
    if (options.includeTrustColumns) {
      base['Lifecycle State'] = task.lifecycleState || '';
      base['Data Quality'] = task.dataQuality || '';
      base['Needs Cleanup'] = task.needsCleanup ? 'Yes' : 'No';
      base['Review Reasons'] = task.reviewReasons?.join(' | ') || '';
      base['Integrity Summary'] = task.invalidReason || '';
    }

    if (options.detailLevel === 'detailed' || options.includeNotes) {
      base.Notes = task.notes;
    }

    return base;
  });
}

function autoSizeSheet(xlsx: Awaited<ReturnType<typeof loadXlsx>>, sheet: Record<string, unknown>): void {
  const range = xlsx.utils.decode_range((sheet['!ref'] as string | undefined) ?? 'A1:A1');
  const widths: Array<{ wch: number }> = [];

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    let maxLength = 12;
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: column })] as { v?: unknown } | undefined;
      const cellText = cell?.v == null ? '' : String(cell.v);
      maxLength = Math.max(maxLength, Math.min(48, cellText.length + 2));
    }
    widths.push({ wch: maxLength });
  }

  sheet['!cols'] = widths;
}

function appendSheet(
  xlsx: Awaited<ReturnType<typeof loadXlsx>>,
  workbook: import('xlsx').WorkBook,
  name: string,
  rows: Array<Record<string, string | number>>,
): void {
  const sheet = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No records matched the selected filters.' }]) as Record<string, unknown>;
  autoSizeSheet(xlsx, sheet);
  xlsx.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function buildSummaryRows(
  followUps: FollowUpItem[],
  tasks: TaskItem[],
  options: ExportOptions,
): Array<Record<string, string | number>> {
  return [
    { Metric: 'Generated At', Value: formatDateTime(new Date().toISOString()) },
    { Metric: 'Dataset', Value: options.dataset },
    { Metric: 'Detail Level', Value: options.detailLevel },
    { Metric: 'Follow-ups Exported', Value: followUps.length },
    { Metric: 'Follow-ups Trusted Live', Value: followUps.filter((item) => isTrustedLiveRecord(item)).length },
    { Metric: 'Follow-ups Review Required', Value: followUps.filter((item) => isReviewRecord(item)).length },
    { Metric: 'Follow-ups Draft', Value: followUps.filter((item) => item.lifecycleState === 'draft' || item.dataQuality === 'draft').length },
    { Metric: 'Open Follow-ups', Value: followUps.filter((item) => item.status !== 'Closed').length },
    { Metric: 'Overdue Follow-ups', Value: followUps.filter(isOverdue).length },
    { Metric: 'Needs Nudge Follow-ups', Value: followUps.filter(needsNudge).length },
    { Metric: 'Tasks Exported', Value: tasks.length },
    { Metric: 'Tasks Trusted Live', Value: tasks.filter((task) => isTrustedLiveRecord(task)).length },
    { Metric: 'Tasks Review Required', Value: tasks.filter((task) => isReviewRecord(task)).length },
    { Metric: 'Tasks Draft', Value: tasks.filter((task) => task.lifecycleState === 'draft' || task.dataQuality === 'draft').length },
    { Metric: 'Open Tasks', Value: tasks.filter((task) => task.status !== 'Done').length },
    { Metric: 'Blocked Tasks', Value: tasks.filter((task) => task.status === 'Blocked').length },
    { Metric: 'Linked Tasks', Value: tasks.filter((task) => task.linkedFollowUpId).length },
  ];
}

export async function exportWorkbookFile(followUps: FollowUpItem[], tasks: TaskItem[], options: ExportOptions): Promise<string> {
  const xlsx = await loadXlsx();
  const workbook = xlsx.utils.book_new();

  if (options.includeSummarySheet) {
    appendSheet(xlsx, workbook, 'Summary', buildSummaryRows(followUps, tasks, options));
  }

  if (options.dataset === 'followUps' || options.dataset === 'combined') {
    appendSheet(xlsx, workbook, 'Follow Ups', buildFollowUpRows(followUps, options));
  }

  if (options.dataset === 'tasks' || options.dataset === 'combined') {
    appendSheet(xlsx, workbook, 'Tasks', buildTaskRows(tasks, options));
  }

  const fileName = sanitizedFileName(options.fileBaseName, 'xlsx');
  xlsx.writeFile(workbook, fileName, { compression: true });
  return fileName;
}

function sanitizedFileName(baseName: string, extension: 'xlsx' | 'csv'): string {
  const safeBase = baseName.trim().replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'followup_hq_export';
  return `${safeBase}_${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export async function exportCsvFile(rows: Array<Record<string, string | number>>, fileBaseName: string): Promise<string> {
  const xlsx = await loadXlsx();
  const worksheet = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No records matched the selected filters.' }]);
  const csv = xlsx.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const fileName = sanitizedFileName(fileBaseName, 'csv');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return fileName;
}

export function buildCsvRows(
  followUps: FollowUpItem[],
  tasks: TaskItem[],
  options: ExportOptions,
): Array<Record<string, string | number>> {
  if (options.dataset === 'followUps') return buildFollowUpRows(followUps, options);
  if (options.dataset === 'tasks') return buildTaskRows(tasks, options);
  return [
    ...buildFollowUpRows(followUps, options).map((row) => ({ RecordType: 'Follow Up', ...row })),
    ...buildTaskRows(tasks, options).map((row) => ({ RecordType: 'Task', ...row })),
  ];
}
