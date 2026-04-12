import { createId } from '../../lib/utils';
import { buildReportRunDelta } from '../../lib/reports/reportComparison';
import { sortReportRunsNewestFirst } from '../../lib/reports/reportRuns';
import type { ReportRunRecord } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

const MAX_REPORT_RUN_HISTORY = 200;

function trimRuns(runs: ReportRunRecord[]): ReportRunRecord[] {
  return sortReportRunsNewestFirst(runs).slice(0, MAX_REPORT_RUN_HISTORY);
}

export function createReportRunsSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'recordReportRun' | 'recordReportRunExport' | 'getReportRunHistoryForDefinition' | 'getMostRecentReportRunForDefinition'
> {
  return {
    recordReportRun: (input) => {
      const now = new Date().toISOString();
      const previousRun = input.reportDefinitionId
        ? get().reportRuns.find((run) => run.reportDefinitionId === input.reportDefinitionId)
        : undefined;
      const nextRun: ReportRunRecord = {
        ...input,
        id: createId('RPRUN'),
        ranAt: now,
        deltaFromPrevious: undefined,
        exportRecords: [],
      };
      nextRun.deltaFromPrevious = buildReportRunDelta(nextRun, previousRun);
      set((state: AppStore) => ({
        reportRuns: trimRuns([nextRun, ...state.reportRuns]),
        savedReportDefinitions: input.reportDefinitionId
          ? state.savedReportDefinitions.map((definition) => (
            definition.id === input.reportDefinitionId
              ? { ...definition, lastRunAt: now }
              : definition
          ))
          : state.savedReportDefinitions,
      }));
      queuePersist();
      return nextRun.id;
    },
    recordReportRunExport: ({ runId, format, fileName, detailLevel, includeSummarySheet }) => {
      let changed = false;
      set((state: AppStore) => ({
        reportRuns: state.reportRuns.map((run) => {
          if (run.id !== runId) return run;
          changed = true;
          return {
            ...run,
            exportRecords: [
              {
                id: createId('RPEXP'),
                exportedAt: new Date().toISOString(),
                format,
                fileName,
                detailLevel,
                includeSummarySheet,
              },
              ...run.exportRecords,
            ],
          };
        }),
      }));
      if (changed) queuePersist();
    },
    getReportRunHistoryForDefinition: (definitionId, limit = 10) => {
      const runs = get().reportRuns.filter((run) => run.reportDefinitionId === definitionId);
      return sortReportRunsNewestFirst(runs).slice(0, Math.max(1, limit));
    },
    getMostRecentReportRunForDefinition: (definitionId) => (
      get().reportRuns.find((run) => run.reportDefinitionId === definitionId)
    ),
  };
}
