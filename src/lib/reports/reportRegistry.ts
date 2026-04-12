import type { ReportType } from '../../types';
import { buildDataQualityReport } from './dataQuality';
import { buildExecutiveSnapshotReport } from './executiveSnapshot';
import { buildFollowUpRiskReport } from './followUpRisk';
import { buildOwnerWorkloadReport } from './ownerAggregation';
import { buildProjectHealthReport } from './projectAggregation';
import type { ReportDefinition, ReportResultMap, ReportSelectorItem } from './contracts';

export const reportDefinitions: { [K in ReportType]: ReportDefinition<K> } = {
  executive_snapshot: {
    id: 'executive_snapshot',
    label: 'Executive snapshot',
    description: 'Live execution posture for leaders.',
    build: buildExecutiveSnapshotReport,
  },
  project_health: {
    id: 'project_health',
    label: 'Project health',
    description: 'Pressure concentration and health severity by project.',
    build: buildProjectHealthReport,
  },
  owner_workload: {
    id: 'owner_workload',
    label: 'Owner workload',
    description: 'Owner load ranked by due-now and blocked pressure.',
    build: buildOwnerWorkloadReport,
  },
  followup_risk: {
    id: 'followup_risk',
    label: 'Follow-up risk',
    description: 'Commitment risk based on timing, waiting, and dependency pressure.',
    build: buildFollowUpRiskReport,
  },
  data_quality: {
    id: 'data_quality',
    label: 'Data quality / cleanup',
    description: 'Operational remediation buckets for integrity cleanup, drilldown, and route-to-fix actions.',
    build: buildDataQualityReport,
  },
};

export const reportSelectorItems: ReportSelectorItem[] = Object.values(reportDefinitions).map((definition) => ({
  id: definition.id,
  label: definition.label,
  description: definition.description,
}));

export function runReport<T extends ReportType>(reportType: T, args: Parameters<typeof reportDefinitions[T]['build']>[0]): ReportResultMap[T] {
  return reportDefinitions[reportType].build(args);
}
