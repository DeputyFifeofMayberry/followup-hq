import type { RecordDescriptor } from '../../lib/recordContext';

export interface RecordSummaryBadge {
  label: string;
  tone: 'info' | 'warn' | 'danger' | 'success' | 'default';
}

export interface RecordSurfaceSummary {
  title: string;
  typeLabel: string;
  subtitle: string;
  badges: RecordSummaryBadge[];
  metadata: Array<{ label: string; value: string }>;
}

const typeLabels = {
  followup: 'Follow-up',
  task: 'Task',
  project: 'Project',
  contact: 'Contact',
  company: 'Company',
} as const;

export function buildRecordSurfaceSummary(record: RecordDescriptor, options?: { dirty?: boolean; dirtyCount?: number }): RecordSurfaceSummary {
  const badges: RecordSummaryBadge[] = [];
  if (record.status) badges.push({ label: record.status, tone: 'info' });
  if (record.priority) badges.push({ label: record.priority, tone: record.priority === 'Critical' ? 'danger' : record.priority === 'High' ? 'warn' : 'default' });
  if (options?.dirty) badges.push({ label: options.dirtyCount ? `${options.dirtyCount} unsaved` : 'Unsaved edits', tone: 'warn' });

  return {
    title: record.title,
    typeLabel: typeLabels[record.type],
    subtitle: [record.projectName, record.owner, record.subtitle].filter(Boolean).join(' · '),
    badges,
    metadata: [
      { label: 'Updated', value: record.updatedAt || '—' },
      { label: 'Due', value: record.dueDate || '—' },
      { label: 'Owner', value: record.owner || '—' },
      { label: 'Project', value: record.projectName || '—' },
    ],
  };
}
