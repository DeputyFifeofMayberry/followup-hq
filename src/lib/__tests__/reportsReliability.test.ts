import assert from 'node:assert/strict';
import { sanitizeReportDraftState, sanitizeSavedReportDefinitions } from '../reports/savedDefinitions';
import { createReportRunSignature, sanitizeReportRuns } from '../reports/reportRuns';
import type { ReportRunRecord, SavedReportDefinition } from '../../types';

const sanitizedLegacy = sanitizeReportDraftState({
  reportType: 'project_health',
  scope: { mode: 'all_open' as unknown as 'trusted_live_only', includeClosed: true, project: '  Alpha  ', owner: '  ' },
  display: { rowLimit: 999, highlightThreshold: 'watch', showReasonDetails: true },
});
assert.equal(sanitizedLegacy.scope.mode, 'trusted_live_only', 'legacy scope modes should normalize to trusted_live_only');
assert.equal(sanitizedLegacy.scope.project, 'Alpha', 'project filter should be trimmed');
assert.equal(sanitizedLegacy.scope.owner, undefined, 'empty owner filter should normalize to undefined');
assert.equal(sanitizedLegacy.display.rowLimit, 50, 'rowLimit should clamp to upper bound');

const definitions = sanitizeSavedReportDefinitions([
  {
    id: 'custom-1',
    name: '  ',
    reportType: 'followup_risk',
    scope: { mode: 'owner' as unknown as 'trusted_live_only', includeClosed: false },
    display: { rowLimit: 1, highlightThreshold: 'watch', showReasonDetails: true },
    export: { detailLevel: 'standard', includeSummarySheet: true },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isPinned: false,
    isBuiltInTemplate: false,
  } as SavedReportDefinition,
]);
const custom = definitions.find((entry) => entry.id === 'custom-1');
assert(custom, 'custom definition should still exist after merge/sanitize');
assert.equal(custom?.name, 'Untitled report', 'blank names should get deterministic fallback');
assert.equal(custom?.scope.mode, 'trusted_live_only', 'legacy saved scope mode should normalize');
assert.equal(custom?.display.rowLimit, 5, 'rowLimit should clamp to lower bound');

const signatureA = createReportRunSignature({ reportType: 'executive_snapshot', scope: { mode: 'trusted_live_only', includeClosed: false } });
const signatureB = createReportRunSignature({ reportType: 'executive_snapshot', scope: { mode: 'trusted_live_only', includeClosed: false, project: ' ' } });
assert.equal(signatureA, signatureB, 'run signatures should be stable for semantically equivalent drafts');

const runs: ReportRunRecord[] = sanitizeReportRuns([
  {
    id: 'run-1',
    ranAt: '2026-04-10T12:00:00.000Z',
    reportDefinitionId: 'valid-definition',
    reportNameSnapshot: 'Exec',
    reportType: 'executive_snapshot',
    scopeMode: 'trusted_live_only',
    summary: { includedCount: 1, excludedCount: 0, confidenceTier: 'high', confidenceLabel: 'High', summaryMetrics: [], exclusionBreakdown: [] },
    exportRecords: [{
      id: '',
      exportedAt: '2026-04-10T12:01:00.000Z',
      format: 'csv',
      fileName: '',
      detailLevel: 'standard',
      includeSummarySheet: true,
    } as unknown as ReportRunRecord['exportRecords'][number]],
  },
  {
    id: 'run-2',
    ranAt: '2026-04-11T12:00:00.000Z',
    reportDefinitionId: 'orphan-definition',
    reportNameSnapshot: 'Exec',
    reportType: 'executive_snapshot',
    scopeMode: 'trusted_live_only',
    summary: { includedCount: 1, excludedCount: 0, confidenceTier: 'high', confidenceLabel: 'High', summaryMetrics: [], exclusionBreakdown: [] },
    exportRecords: [],
  },
], { validDefinitionIds: new Set(['valid-definition']) });
assert.equal(runs.length, 1, 'runs should drop orphaned definition references during hydration');
assert.equal(runs[0].exportRecords.length, 0, 'invalid export records should be filtered from persisted run history');
