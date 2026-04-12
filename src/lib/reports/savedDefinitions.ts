import type { ReportDraftState, ReportTemplateKind, SavedReportDefinition } from '../../types';

export const defaultReportDraftState: ReportDraftState = {
  reportType: 'executive_snapshot',
  scope: {
    mode: 'all_open',
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
    scope: definition.scope,
    display: definition.display,
    export: definition.export,
  };
}

export function reportDraftEquals(a: ReportDraftState, b: ReportDraftState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
