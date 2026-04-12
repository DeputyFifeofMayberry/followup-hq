import assert from 'node:assert/strict';
import { createReportDefinitionsSlice } from '../reportDefinitionsSlice';
import { builtInReportTemplates, toReportDraftState } from '../../../lib/reports/savedDefinitions';
import type { AppStore } from '../../types';

let queueCount = 0;

let state = {
  savedReportDefinitions: builtInReportTemplates,
  activeReportDefinitionId: builtInReportTemplates[0].id,
  lastOpenedReportDefinitionId: builtInReportTemplates[0].id,
  reportDraft: toReportDraftState(builtInReportTemplates[0]),
  reportRuns: [
    {
      id: 'run-1',
      ranAt: '2026-04-12T00:00:00.000Z',
      reportDefinitionId: builtInReportTemplates[0].id,
      reportNameSnapshot: builtInReportTemplates[0].name,
      reportType: builtInReportTemplates[0].reportType,
      scopeMode: builtInReportTemplates[0].scope.mode,
      summary: { includedCount: 1, excludedCount: 0, confidenceTier: 'high', confidenceLabel: 'High', summaryMetrics: [], exclusionBreakdown: [] },
      exportRecords: [],
    },
  ],
} as unknown as AppStore;

const set = ((updater: unknown) => {
  const update = updater as ((current: AppStore) => Partial<AppStore>) | Partial<AppStore>;
  if (typeof updater === 'function') {
    state = { ...state, ...(update as (current: AppStore) => Partial<AppStore>)(state) };
    return;
  }
  state = { ...state, ...(update as Partial<AppStore>) };
}) as unknown as (update: unknown) => void;

const get = () => state;
const slice = createReportDefinitionsSlice(
  set as never,
  get as never,
  { queuePersist: () => { queueCount += 1; } } as never,
);

const createdId = slice.createSavedReportDefinition({
  name: 'Reliability Test',
  draft: {
    reportType: 'owner_workload',
    scope: { mode: 'trusted_live_only', includeClosed: false },
    display: { rowLimit: 12, highlightThreshold: 'watch', showReasonDetails: true },
    export: { detailLevel: 'standard', includeSummarySheet: true },
  },
});

slice.updateSavedReportDefinition(createdId, {
  reportType: 'data_quality',
  scope: { mode: 'all_open' as unknown as 'trusted_live_only', includeClosed: true },
  display: { rowLimit: 999, highlightThreshold: 'watch', showReasonDetails: true },
});

assert.equal(state.reportDraft.reportType, 'data_quality', 'updating active definition should keep active draft synced');
assert.equal(state.reportDraft.scope.mode, 'trusted_live_only', 'legacy scope values should be normalized while updating definition');
assert.equal(state.reportDraft.display.rowLimit, 50, 'active draft rowLimit should be clamped during updates');

slice.deleteSavedReportDefinition(builtInReportTemplates[0].id);
assert.equal(state.savedReportDefinitions.some((entry) => entry.id === builtInReportTemplates[0].id), true, 'built-in templates should remain protected from delete');

slice.deleteSavedReportDefinition(createdId);
assert.equal(state.reportRuns.length, 1, 'deleting unrelated definition should not remove other report runs');

const createdId2 = slice.createSavedReportDefinition({
  name: 'Delete Me',
  draft: { reportType: 'executive_snapshot' },
});
state.reportRuns = [{
  id: 'run-2',
  ranAt: '2026-04-12T00:00:00.000Z',
  reportDefinitionId: createdId2,
  reportNameSnapshot: 'Delete Me',
  reportType: 'executive_snapshot',
  scopeMode: 'trusted_live_only',
  summary: { includedCount: 1, excludedCount: 0, confidenceTier: 'high', confidenceLabel: 'High', summaryMetrics: [], exclusionBreakdown: [] },
  exportRecords: [],
}];
slice.deleteSavedReportDefinition(createdId2);
assert.equal(state.reportRuns.length, 0, 'deleting definition should prune its run history to avoid stale references');
assert(queueCount > 0, 'report definition mutations should queue persistence');
