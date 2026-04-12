import type { ReportDraftState, ReportTemplateKind, SavedReportDefinition } from '../../types';

export const defaultReportDraftState: ReportDraftState = {
  reportType: 'executive_snapshot',
  scope: {
    mode: 'trusted_live_only',
    includeClosed: false,
  },
  display: {
    rowLimit: 8,
    highlightThreshold: 'watch',
    showReasonDetails: true,
  },
  export: {
    detailLevel: 'standard',
    includeSummarySheet: true,
  },
};

function buildBuiltInTemplate(input: {
  id: string;
  name: string;
  reportType: ReportDraftState['reportType'];
  basedOnTemplate: ReportTemplateKind;
  isPinned?: boolean;
  scope?: Partial<ReportDraftState['scope']>;
  display?: Partial<ReportDraftState['display']>;
  export?: Partial<ReportDraftState['export']>;
}): SavedReportDefinition {
  const timestamp = new Date(0).toISOString();
  return {
    id: input.id,
    name: input.name,
    reportType: input.reportType,
    scope: {
      ...defaultReportDraftState.scope,
      ...input.scope,
    },
    display: {
      ...defaultReportDraftState.display,
      ...input.display,
    },
    export: {
      ...defaultReportDraftState.export,
      ...input.export,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    isPinned: input.isPinned ?? true,
    isBuiltInTemplate: true,
    basedOnTemplate: input.basedOnTemplate,
  };
}



function normalizeScopeMode(mode: ReportDraftState['scope']['mode'] | 'all_open' | 'project' | 'owner'): ReportDraftState['scope']['mode'] {
  if (mode === 'all_open' || mode === 'project' || mode === 'owner') return 'trusted_live_only';
  return mode;
}

export const builtInReportTemplates: SavedReportDefinition[] = [
  buildBuiltInTemplate({
    id: 'report-template-executive-snapshot',
    name: 'Executive Snapshot',
    reportType: 'executive_snapshot',
    basedOnTemplate: 'executive_snapshot',
    display: { rowLimit: 8, highlightThreshold: 'watch' },
  }),
  buildBuiltInTemplate({
    id: 'report-template-weekly-pm-project-health',
    name: 'Weekly PM Project Health',
    reportType: 'project_health',
    basedOnTemplate: 'weekly_pm_project_health',
    display: { rowLimit: 12, highlightThreshold: 'watch' },
  }),
  buildBuiltInTemplate({
    id: 'report-template-owner-workload-review',
    name: 'Owner Workload Review',
    reportType: 'owner_workload',
    basedOnTemplate: 'owner_workload_review',
    display: { rowLimit: 12, highlightThreshold: 'watch' },
  }),
  buildBuiltInTemplate({
    id: 'report-template-followup-risk-review',
    name: 'Follow-up Risk Review',
    reportType: 'followup_risk',
    basedOnTemplate: 'followup_risk_review',
    display: { rowLimit: 10, highlightThreshold: 'at_risk' },
  }),
  buildBuiltInTemplate({
    id: 'report-template-data-quality-cleanup-audit',
    name: 'Data Quality / Cleanup Audit',
    reportType: 'data_quality',
    basedOnTemplate: 'data_quality_cleanup_audit',
    scope: { mode: 'cleanup_audit' },
    display: { rowLimit: 20, highlightThreshold: 'watch' },
  }),
];

export function mergeBuiltInReportTemplates(saved: SavedReportDefinition[] | undefined): SavedReportDefinition[] {
  const persisted = saved ?? [];
  const custom = persisted.filter((entry) => !entry.isBuiltInTemplate);
  const builtInsById = new Map(
    persisted
      .filter((entry) => entry.isBuiltInTemplate)
      .map((entry) => [entry.id, entry]),
  );

  const normalizedBuiltIns = builtInReportTemplates.map((template) => {
    const persistedMatch = builtInsById.get(template.id);
    if (!persistedMatch) return template;
    return {
      ...template,
      ...persistedMatch,
      isBuiltInTemplate: true,
      basedOnTemplate: template.basedOnTemplate,
      name: template.name,
    };
  });

  return [...normalizedBuiltIns, ...custom];
}

export function toReportDraftState(definition: SavedReportDefinition): ReportDraftState {
  return {
    reportType: definition.reportType,
    scope: {
      ...defaultReportDraftState.scope,
      ...definition.scope,
      mode: normalizeScopeMode(definition.scope.mode as ReportDraftState['scope']['mode'] | 'all_open' | 'project' | 'owner'),
    },
    display: {
      ...defaultReportDraftState.display,
      ...definition.display,
      rowLimit: clampRowLimit(definition.display?.rowLimit),
    },
    export: {
      ...defaultReportDraftState.export,
      ...definition.export,
    },
  };
}

export function reportDraftEquals(a: ReportDraftState, b: ReportDraftState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clampRowLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return defaultReportDraftState.display.rowLimit;
  return Math.max(5, Math.min(50, Math.round(limit)));
}

export function sanitizeReportDraftState(draft: Partial<ReportDraftState> | undefined): ReportDraftState {
  return {
    reportType: draft?.reportType ?? defaultReportDraftState.reportType,
    scope: {
      ...defaultReportDraftState.scope,
      ...draft?.scope,
      mode: normalizeScopeMode((draft?.scope?.mode ?? defaultReportDraftState.scope.mode) as ReportDraftState['scope']['mode'] | 'all_open' | 'project' | 'owner'),
      includeClosed: Boolean(draft?.scope?.includeClosed ?? defaultReportDraftState.scope.includeClosed),
      project: draft?.scope?.project?.trim() || undefined,
      owner: draft?.scope?.owner?.trim() || undefined,
    },
    display: {
      ...defaultReportDraftState.display,
      ...draft?.display,
      rowLimit: clampRowLimit(draft?.display?.rowLimit),
    },
    export: {
      ...defaultReportDraftState.export,
      ...draft?.export,
    },
  };
}

export function sanitizeSavedReportDefinition(definition: SavedReportDefinition): SavedReportDefinition {
  const sanitizedDraft = sanitizeReportDraftState(toReportDraftState(definition));
  return {
    ...definition,
    name: definition.name?.trim() || 'Untitled report',
    reportType: sanitizedDraft.reportType,
    scope: sanitizedDraft.scope,
    display: sanitizedDraft.display,
    export: sanitizedDraft.export,
    isPinned: Boolean(definition.isPinned),
    isBuiltInTemplate: Boolean(definition.isBuiltInTemplate),
    basedOnTemplate: definition.basedOnTemplate ?? 'custom',
  };
}

export function sanitizeSavedReportDefinitions(definitions: SavedReportDefinition[] | undefined): SavedReportDefinition[] {
  return mergeBuiltInReportTemplates(definitions).map(sanitizeSavedReportDefinition);
}
