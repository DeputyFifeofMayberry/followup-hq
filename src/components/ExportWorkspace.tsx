import { Download, FileSpreadsheet, Filter, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  buildCsvRows,
  exportCsvFile,
  exportWorkbookFile,
  EXPORT_DETAIL_OPTIONS,
  FOLLOW_UP_PRIORITY_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  filterFollowUps,
  filterTasks,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type ExportDetailLevel,
  type ExportOptions,
} from '../lib/export';
import { useAppStore } from '../store/useAppStore';
import type { SavedViewKey } from '../types';
import { AppShellCard, SectionHeader, WorkspacePage } from './ui/AppPrimitives';

const savedViewOptions: SavedViewKey[] = ['All', 'Closed', 'Today', 'Waiting', 'Needs nudge', 'At risk', 'Overdue', 'By project'];

const defaultOptions: ExportOptions = {
  dataset: 'combined',
  detailLevel: 'standard',
  fileBaseName: 'followup_hq_report',
  includeSummarySheet: true,
  includeNotes: true,
  includeTimeline: false,
  includeSourceRefs: false,
  includeDrafts: false,
  includeTags: true,
  includeLinkedRecordColumns: true,
  includeTrustColumns: true,
  followUps: {
    savedView: 'All',
    project: 'All',
    owner: 'All',
    statuses: ['All'],
    priorities: ['All'],
    search: '',
    dueFrom: '',
    dueTo: '',
    nextTouchFrom: '',
    nextTouchTo: '',
    includeClosed: true,
    onlyOverdue: false,
    onlyNeedsNudge: false,
    tagQuery: '',
    includeReviewRequired: false,
    includeDraftRecords: false,
  },
  tasks: {
    project: 'All',
    owner: 'All',
    statuses: ['All'],
    priorities: ['All'],
    search: '',
    dueFrom: '',
    dueTo: '',
    linkedOnly: false,
    includeDone: true,
    tagQuery: '',
    includeReviewRequired: false,
    includeDraftRecords: false,
  },
};

function toggleSelection<T extends string>(values: Array<'All' | T>, value: T): Array<'All' | T> {
  if (values.includes('All')) return [value];
  if (values.includes(value)) {
    const next = values.filter((entry) => entry !== value);
    return next.length ? next : ['All'];
  }
  return [...values, value];
}

function SelectionButtons<T extends string>({
  values,
  options,
  onChange,
}: {
  values: Array<'All' | T>;
  options: readonly T[];
  onChange: (next: Array<'All' | T>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(['All'])}
        className={values.includes('All') ? 'rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700'}
      >
        All
      </button>
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(toggleSelection(values, option))}
            className={active ? 'rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700'}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  helper: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400" />
      <span>
        <span className="block font-medium text-slate-900">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{helper}</span>
      </span>
    </label>
  );
}

export function ExportWorkspace() {
  const { items, tasks } = useAppStore(useShallow((s) => ({ items: s.items, tasks: s.tasks })));
  const [options, setOptions] = useState<ExportOptions>(defaultOptions);
  const [lastExportMessage, setLastExportMessage] = useState('');

  const followUpProjects = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.project))).sort()], [items]);
  const followUpOwners = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.owner))).sort()], [items]);
  const taskProjects = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.project))).sort()], [tasks]);
  const taskOwners = useMemo(() => ['All', ...Array.from(new Set(tasks.map((task) => task.owner))).sort()], [tasks]);

  const filteredFollowUps = useMemo(() => filterFollowUps(items, options.followUps), [items, options.followUps]);
  const filteredTasks = useMemo(() => filterTasks(tasks, options.tasks), [tasks, options.tasks]);

  const detailHelper = useMemo(() => {
    const map: Record<ExportDetailLevel, string> = {
      simple: 'Lean export with only core execution fields.',
      standard: 'Balanced export with reporting context and summary fields.',
      detailed: 'Full export for audits, handoffs, and recordkeeping.',
    };
    return map[options.detailLevel];
  }, [options.detailLevel]);

  const updateOptions = (patch: Partial<ExportOptions>) => setOptions((current) => ({ ...current, ...patch }));
  const updateFollowUps = (patch: Partial<ExportOptions['followUps']>) => setOptions((current) => ({ ...current, followUps: { ...current.followUps, ...patch } }));
  const updateTasks = (patch: Partial<ExportOptions['tasks']>) => setOptions((current) => ({ ...current, tasks: { ...current.tasks, ...patch } }));

  const handleWorkbookExport = async () => {
    const fileName = await exportWorkbookFile(filteredFollowUps, filteredTasks, options);
    setLastExportMessage('Workbook exported: ' + fileName);
  };

  const handleCsvExport = async () => {
    const fileName = await exportCsvFile(buildCsvRows(filteredFollowUps, filteredTasks, options), options.fileBaseName);
    setLastExportMessage('CSV exported: ' + fileName);
  };

  const resetFilters = () => {
    setOptions(defaultOptions);
    setLastExportMessage('');
  };

  const showFollowUps = options.dataset !== 'tasks';
  const showTasks = options.dataset !== 'followUps';

  return (
    <WorkspacePage>
      <AppShellCard className="workspace-summary-strip" surface="hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            title="Exports"
            subtitle="Filter records, preview scope, and export reports."
            compact
            actions={<div className="text-xs text-slate-500 inline-flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" />Operational report export</div>}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetFilters} className="action-btn"><RefreshCcw className="h-4 w-4" />Reset</button>
            <button type="button" onClick={handleCsvExport} className="action-btn"><Download className="h-4 w-4" />Quick CSV</button>
            <button type="button" onClick={handleWorkbookExport} className="primary-btn"><FileSpreadsheet className="h-4 w-4" />Export workbook</button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Follow-ups in report</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{filteredFollowUps.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Tasks in report</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{filteredTasks.length}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-sm text-amber-700">Detail preset</div>
            <div className="mt-2 text-lg font-semibold text-slate-950 capitalize">{options.detailLevel}</div>
            <div className="mt-1 text-xs text-slate-600">{detailHelper}</div>
          </div>
        </div>
        {lastExportMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{lastExportMessage}</div> : null}
      </AppShellCard>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Filter className="h-4 w-4" />Report options</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="field-block">
                <span className="field-label">Dataset</span>
                <select value={options.dataset} onChange={(event) => updateOptions({ dataset: event.target.value as ExportOptions['dataset'] })} className="field-input">
                  <option value="followUps">Follow-ups only</option>
                  <option value="tasks">Tasks only</option>
                  <option value="combined">Combined report</option>
                </select>
              </label>
              <label className="field-block">
                <span className="field-label">Detail level</span>
                <select value={options.detailLevel} onChange={(event) => updateOptions({ detailLevel: event.target.value as ExportDetailLevel })} className="field-input">
                  {EXPORT_DETAIL_OPTIONS.map((level) => <option key={level} value={level} className="capitalize">{level}</option>)}
                </select>
              </label>
              <label className="field-block">
                <span className="field-label">File name</span>
                <input value={options.fileBaseName} onChange={(event) => updateOptions({ fileBaseName: event.target.value })} className="field-input" placeholder="followup_hq_report" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ToggleRow checked={options.includeSummarySheet} onChange={(checked) => updateOptions({ includeSummarySheet: checked })} label="Include summary sheet" helper="Adds rolled-up counts for the exported records." />
              <ToggleRow checked={options.includeTags} onChange={(checked) => updateOptions({ includeTags: checked })} label="Include tags" helper="Keeps tag columns in the export output." />
              <ToggleRow checked={options.includeLinkedRecordColumns} onChange={(checked) => updateOptions({ includeLinkedRecordColumns: checked })} label="Include linked record IDs" helper="Adds contact, company, project, thread, and linked follow-up columns where relevant." />
              <ToggleRow checked={options.includeTrustColumns} onChange={(checked) => updateOptions({ includeTrustColumns: checked })} label="Include lifecycle / trust columns" helper="Adds lifecycle state, cleanup flags, and review reasons to support audits." />
              <ToggleRow checked={options.includeNotes} onChange={(checked) => updateOptions({ includeNotes: checked })} label="Include notes" helper="Useful for full narrative handoff and historical context." />
              <ToggleRow checked={options.includeSourceRefs} onChange={(checked) => updateOptions({ includeSourceRefs: checked })} label="Include source references" helper="Adds raw source links and merged-source fields for follow-ups." />
              <ToggleRow checked={options.includeTimeline} onChange={(checked) => updateOptions({ includeTimeline: checked })} label="Include timelines" helper="Adds the full follow-up activity timeline as a multiline cell." />
              <ToggleRow checked={options.includeDrafts} onChange={(checked) => updateOptions({ includeDrafts: checked })} label="Include draft follow-ups" helper="Exports saved follow-up draft text for correspondence prep." />
            </div>
          </section>

          {showFollowUps ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Follow-up filters</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="field-block">
                  <span className="field-label">Saved view</span>
                  <select value={options.followUps.savedView} onChange={(event) => updateFollowUps({ savedView: event.target.value as SavedViewKey })} className="field-input">
                    {savedViewOptions.map((view) => <option key={view} value={view}>{view}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span className="field-label">Project</span>
                  <select value={options.followUps.project} onChange={(event) => updateFollowUps({ project: event.target.value })} className="field-input">
                    {followUpProjects.map((project) => <option key={project} value={project}>{project}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span className="field-label">Owner</span>
                  <select value={options.followUps.owner} onChange={(event) => updateFollowUps({ owner: event.target.value })} className="field-input">
                    {followUpOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </label>
                <label className="field-block md:col-span-2 xl:col-span-3">
                  <span className="field-label">Search</span>
                  <input value={options.followUps.search} onChange={(event) => updateFollowUps({ search: event.target.value })} className="field-input" placeholder="Title, next action, notes, source ref, waiting on" />
                </label>
                <label className="field-block">
                  <span className="field-label">Due from</span>
                  <input type="date" value={options.followUps.dueFrom} onChange={(event) => updateFollowUps({ dueFrom: event.target.value })} className="field-input" />
                </label>
                <label className="field-block">
                  <span className="field-label">Due to</span>
                  <input type="date" value={options.followUps.dueTo} onChange={(event) => updateFollowUps({ dueTo: event.target.value })} className="field-input" />
                </label>
                <label className="field-block">
                  <span className="field-label">Tag contains</span>
                  <input value={options.followUps.tagQuery} onChange={(event) => updateFollowUps({ tagQuery: event.target.value })} className="field-input" placeholder="owner, closeout, RFI" />
                </label>
                <label className="field-block">
                  <span className="field-label">Next touch from</span>
                  <input type="date" value={options.followUps.nextTouchFrom} onChange={(event) => updateFollowUps({ nextTouchFrom: event.target.value })} className="field-input" />
                </label>
                <label className="field-block">
                  <span className="field-label">Next touch to</span>
                  <input type="date" value={options.followUps.nextTouchTo} onChange={(event) => updateFollowUps({ nextTouchTo: event.target.value })} className="field-input" />
                </label>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Statuses</div>
                  <SelectionButtons values={options.followUps.statuses} options={FOLLOW_UP_STATUS_OPTIONS} onChange={(statuses) => updateFollowUps({ statuses })} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priorities</div>
                  <SelectionButtons values={options.followUps.priorities} options={FOLLOW_UP_PRIORITY_OPTIONS} onChange={(priorities) => updateFollowUps({ priorities })} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ToggleRow checked={options.followUps.includeClosed} onChange={(checked) => updateFollowUps({ includeClosed: checked })} label="Include closed" helper="Keep completed follow-ups in the report." />
                <ToggleRow checked={options.followUps.onlyOverdue} onChange={(checked) => updateFollowUps({ onlyOverdue: checked })} label="Only overdue" helper="Restrict follow-ups to items past due." />
                <ToggleRow checked={options.followUps.onlyNeedsNudge} onChange={(checked) => updateFollowUps({ onlyNeedsNudge: checked })} label="Only needs nudge" helper="Restrict to follow-ups that should be touched now." />
                <ToggleRow checked={options.followUps.includeReviewRequired} onChange={(checked) => updateFollowUps({ includeReviewRequired: checked })} label="Include review-required" helper="Opt in unresolved review records for cleanup/audit reports." />
                <ToggleRow checked={options.followUps.includeDraftRecords} onChange={(checked) => updateFollowUps({ includeDraftRecords: checked })} label="Include drafts" helper="Include draft-state records for intake and cleanup exports." />
              </div>
            </section>
          ) : null}

          {showTasks ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Task filters</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="field-block">
                  <span className="field-label">Project</span>
                  <select value={options.tasks.project} onChange={(event) => updateTasks({ project: event.target.value })} className="field-input">
                    {taskProjects.map((project) => <option key={project} value={project}>{project}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span className="field-label">Owner</span>
                  <select value={options.tasks.owner} onChange={(event) => updateTasks({ owner: event.target.value })} className="field-input">
                    {taskOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span className="field-label">Tag contains</span>
                  <input value={options.tasks.tagQuery} onChange={(event) => updateTasks({ tagQuery: event.target.value })} className="field-input" placeholder="coordination, field, submittal" />
                </label>
                <label className="field-block md:col-span-2 xl:col-span-3">
                  <span className="field-label">Search</span>
                  <input value={options.tasks.search} onChange={(event) => updateTasks({ search: event.target.value })} className="field-input" placeholder="Title, summary, next step, notes" />
                </label>
                <label className="field-block">
                  <span className="field-label">Due from</span>
                  <input type="date" value={options.tasks.dueFrom} onChange={(event) => updateTasks({ dueFrom: event.target.value })} className="field-input" />
                </label>
                <label className="field-block">
                  <span className="field-label">Due to</span>
                  <input type="date" value={options.tasks.dueTo} onChange={(event) => updateTasks({ dueTo: event.target.value })} className="field-input" />
                </label>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Statuses</div>
                  <SelectionButtons values={options.tasks.statuses} options={TASK_STATUS_OPTIONS} onChange={(statuses) => updateTasks({ statuses })} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priorities</div>
                  <SelectionButtons values={options.tasks.priorities} options={TASK_PRIORITY_OPTIONS} onChange={(priorities) => updateTasks({ priorities })} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ToggleRow checked={options.tasks.includeDone} onChange={(checked) => updateTasks({ includeDone: checked })} label="Include done tasks" helper="Keep completed tasks in the report history." />
                <ToggleRow checked={options.tasks.linkedOnly} onChange={(checked) => updateTasks({ linkedOnly: checked })} label="Only linked tasks" helper="Restrict to tasks attached to a follow-up record." />
                <ToggleRow checked={options.tasks.includeReviewRequired} onChange={(checked) => updateTasks({ includeReviewRequired: checked })} label="Include review-required" helper="Opt in unresolved review tasks for cleanup/audit reports." />
                <ToggleRow checked={options.tasks.includeDraftRecords} onChange={(checked) => updateTasks({ includeDraftRecords: checked })} label="Include drafts" helper="Include draft tasks in exports when auditing intake work." />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Export preview</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Workbook structure</div>
                <div className="mt-2">{options.includeSummarySheet ? 'Summary sheet included.' : 'Summary sheet omitted.'}</div>
                <div className="mt-1">{showFollowUps ? `Follow-up sheet: ${filteredFollowUps.length} rows.` : 'Follow-up sheet not included.'}</div>
                <div className="mt-1">{showTasks ? `Task sheet: ${filteredTasks.length} rows.` : 'Task sheet not included.'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Current detail output</div>
                <div className="mt-2">{detailHelper}</div>
                <div className="mt-2">Notes: {options.includeNotes ? 'included' : 'hidden'}</div>
                <div className="mt-1">Tags: {options.includeTags ? 'included' : 'hidden'}</div>
                <div className="mt-1">Linked IDs: {options.includeLinkedRecordColumns ? 'included' : 'hidden'}</div>
                <div className="mt-1">Source refs: {options.includeSourceRefs ? 'included' : 'hidden'}</div>
                <div className="mt-1">Timelines: {options.includeTimeline ? 'included' : 'hidden'}</div>
                <div className="mt-1">Drafts: {options.includeDrafts ? 'included' : 'hidden'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">Use cases</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="font-medium text-slate-900">Executive summary</div>
                <div className="mt-1">Use `simple` with a single project or owner filter for a quick status report.</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Weekly coordination report</div>
                <div className="mt-1">Use `combined`, keep the summary sheet on, and add due date or nudge filters.</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Audit or handoff package</div>
                <div className="mt-1">Use `detailed` and enable notes, timelines, source refs, and linked record columns.</div>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </WorkspacePage>
  );
}



