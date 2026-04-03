import type {
  CompanyRecord,
  ContactRecord,
  FollowUpItem,
  IntakeDocumentRecord,
  ProjectHealthSummary,
  ProjectHealthTier,
  ProjectRecord,
  ProjectSortKey,
  ProjectStatus,
  TaskItem,
} from '../types';
import { daysSince, isOverdue, isTaskDeferred, isTaskOverdue, needsNudge, todayIso } from './utils';

export type ProjectSavedViewKey = 'All projects' | 'Hot projects' | 'Closeout' | 'Waiting on external' | 'Blocked by tasks' | 'Docs need review' | 'Low activity / stale';

export interface ProjectFilterState {
  query: string;
  status: 'All' | ProjectStatus;
  owner: 'All' | string;
  healthTier: 'All' | ProjectHealthTier;
  hasOverdueFollowUp: 'all' | 'yes' | 'no';
  hasNeedsNudge: 'all' | 'yes' | 'no';
  hasBlockedTask: 'all' | 'yes' | 'no';
  hasOverdueTask: 'all' | 'yes' | 'no';
  intakeReview: 'all' | 'needs_review' | 'stale_docs' | 'none';
  activity: 'all' | 'recent' | 'stale';
}

export interface ProjectDerivedRecord {
  project: ProjectRecord;
  health: ProjectHealthSummary;
  openFollowUps: FollowUpItem[];
  openTasks: TaskItem[];
  intakeDocs: IntakeDocumentRecord[];
  overdueFollowUpCount: number;
  blockedTaskCount: number;
  overdueTaskCount: number;
  deferredTaskCount: number;
  updatedAt: string;
  contacts: ContactRecord[];
  companies: CompanyRecord[];
}

const STALE_DAYS = 10;
const DOC_STALE_DAYS = 14;

export const defaultProjectFilters: ProjectFilterState = {
  query: '',
  status: 'All',
  owner: 'All',
  healthTier: 'All',
  hasOverdueFollowUp: 'all',
  hasNeedsNudge: 'all',
  hasBlockedTask: 'all',
  hasOverdueTask: 'all',
  intakeReview: 'all',
  activity: 'all',
};

function buildHealth(project: ProjectRecord, openFollowUps: FollowUpItem[], openTasks: TaskItem[], docs: IntakeDocumentRecord[], updatedAt: string): ProjectHealthSummary {
  const overdueFollowUps = openFollowUps.filter(isOverdue).length;
  const needsNudgeCount = openFollowUps.filter(needsNudge).length;
  const atRisk = openFollowUps.filter((item) => item.status === 'At risk').length;
  const waiting = openFollowUps.filter((item) => item.status === 'Waiting on external' || item.status === 'Waiting internal').length;
  const blockedTasks = openTasks.filter((task) => task.status === 'Blocked').length;
  const overdueTasks = openTasks.filter(isTaskOverdue).length;
  const deferredTasks = openTasks.filter(isTaskDeferred).length;
  const readyToCloseSignals = openFollowUps.filter((item) => item.childWorkflowSignal === 'ready_to_close').length;
  const docsNeedingReview = docs.filter((doc) => doc.disposition === 'Unprocessed').length;
  const staleIntakeDocs = docs.filter((doc) => daysSince(doc.uploadedAt) >= DOC_STALE_DAYS && doc.disposition !== 'Archived' && doc.disposition !== 'Converted to follow-up').length;
  const staleActivityDays = daysSince(updatedAt);

  const score = (
    openFollowUps.length * 1
    + overdueFollowUps * 4
    + needsNudgeCount * 2
    + atRisk * 4
    + blockedTasks * 5
    + overdueTasks * 4
    + deferredTasks * 2
    + docsNeedingReview * 2
    + staleIntakeDocs * 2
    + Math.max(0, staleActivityDays - STALE_DAYS)
    - readyToCloseSignals * 2
  );

  const tier: ProjectHealthTier = score >= 36 ? 'Critical' : score >= 22 ? 'High' : score >= 10 ? 'Moderate' : 'Low';

  const indicators = {
    blocked: blockedTasks > 0,
    overdue: overdueFollowUps > 0 || overdueTasks > 0,
    stale: staleActivityDays >= STALE_DAYS,
    waitingHeavy: waiting >= 3 || (openFollowUps.length > 0 && waiting / openFollowUps.length >= 0.5),
    closeoutReady: project.status === 'Closeout' || readyToCloseSignals > 0 || (openFollowUps.length === 0 && openTasks.length === 0 && docsNeedingReview === 0),
  };

  const reasons = [
    overdueTasks ? `${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'}` : '',
    blockedTasks ? `${blockedTasks} blocked task${blockedTasks === 1 ? '' : 's'}` : '',
    overdueFollowUps ? `${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? '' : 's'}` : '',
    atRisk ? `${atRisk} at-risk follow-up${atRisk === 1 ? '' : 's'}` : '',
    needsNudgeCount ? `${needsNudgeCount} follow-up${needsNudgeCount === 1 ? '' : 's'} need nudge` : '',
    docsNeedingReview ? `${docsNeedingReview} intake doc${docsNeedingReview === 1 ? '' : 's'} need review` : '',
    indicators.stale ? `No meaningful update for ${staleActivityDays} days` : '',
    indicators.closeoutReady ? 'Closeout-ready signals present' : '',
  ].filter(Boolean);

  return {
    score,
    tier,
    reasons,
    indicators,
    breakdown: {
      openFollowUps: openFollowUps.length,
      overdueFollowUps,
      needsNudge: needsNudgeCount,
      atRiskFollowUps: atRisk,
      waitingFollowUps: waiting,
      blockedTasks,
      overdueTasks,
      deferredTasks,
      readyToCloseSignals,
      docsNeedingReview,
      staleIntakeDocs,
      staleActivityDays,
    },
  };
}

function matchesTriState(value: boolean, filter: 'all' | 'yes' | 'no'): boolean {
  if (filter === 'all') return true;
  return filter === 'yes' ? value : !value;
}

export function buildProjectDerivedRecords(
  projects: ProjectRecord[],
  items: FollowUpItem[],
  tasks: TaskItem[],
  intakeDocuments: IntakeDocumentRecord[],
  contacts: ContactRecord[],
  companies: CompanyRecord[],
): ProjectDerivedRecord[] {
  const now = todayIso();
  return projects.map((project) => {
    const openFollowUps = items.filter((item) => item.projectId === project.id && item.status !== 'Closed');
    const openTasks = tasks.filter((task) => task.projectId === project.id && task.status !== 'Done');
    const docs = intakeDocuments.filter((doc) => doc.projectId === project.id);

    const projectDates = [project.updatedAt, project.lastReviewedAt, ...openFollowUps.map((item) => item.lastActionAt || item.lastTouchDate), ...openTasks.map((task) => task.updatedAt), ...docs.map((doc) => doc.uploadedAt)]
      .filter(Boolean) as string[];
    const updatedAt = projectDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || now;

    const projectContacts = contacts.filter((contact) => openFollowUps.some((item) => item.contactId === contact.id) || openTasks.some((task) => task.contactId === contact.id));
    const projectCompanies = companies.filter((company) => openFollowUps.some((item) => item.companyId === company.id) || openTasks.some((task) => task.companyId === company.id));
    const health = buildHealth(project, openFollowUps, openTasks, docs, updatedAt);

    return {
      project,
      health,
      openFollowUps,
      openTasks,
      intakeDocs: docs,
      overdueFollowUpCount: health.breakdown.overdueFollowUps,
      blockedTaskCount: health.breakdown.blockedTasks,
      overdueTaskCount: health.breakdown.overdueTasks,
      deferredTaskCount: health.breakdown.deferredTasks,
      updatedAt,
      contacts: projectContacts,
      companies: projectCompanies,
    };
  });
}

export function applyProjectFilters(rows: ProjectDerivedRecord[], filters: ProjectFilterState): ProjectDerivedRecord[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (query) {
      const haystack = [row.project.name, row.project.owner, row.project.code, row.project.clientOrg, row.project.phase, row.project.projectNextAction].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.status !== 'All' && row.project.status !== filters.status) return false;
    if (filters.owner !== 'All' && row.project.owner !== filters.owner) return false;
    if (filters.healthTier !== 'All' && row.health.tier !== filters.healthTier) return false;
    if (!matchesTriState(row.overdueFollowUpCount > 0, filters.hasOverdueFollowUp)) return false;
    if (!matchesTriState(row.health.breakdown.needsNudge > 0, filters.hasNeedsNudge)) return false;
    if (!matchesTriState(row.blockedTaskCount > 0, filters.hasBlockedTask)) return false;
    if (!matchesTriState(row.overdueTaskCount > 0, filters.hasOverdueTask)) return false;
    if (filters.intakeReview === 'needs_review' && row.health.breakdown.docsNeedingReview === 0) return false;
    if (filters.intakeReview === 'stale_docs' && row.health.breakdown.staleIntakeDocs === 0) return false;
    if (filters.intakeReview === 'none' && (row.health.breakdown.docsNeedingReview > 0 || row.health.breakdown.staleIntakeDocs > 0)) return false;
    if (filters.activity === 'recent' && row.health.breakdown.staleActivityDays >= STALE_DAYS) return false;
    if (filters.activity === 'stale' && row.health.breakdown.staleActivityDays < STALE_DAYS) return false;
    return true;
  });
}

export function applyProjectSort(rows: ProjectDerivedRecord[], sortKey: ProjectSortKey, sortDirection: 'asc' | 'desc'): ProjectDerivedRecord[] {
  const sorted = [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return a.project.name.localeCompare(b.project.name);
      case 'updated':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'targetDate':
        return new Date(a.project.targetCompletionDate || '2999-12-31').getTime() - new Date(b.project.targetCompletionDate || '2999-12-31').getTime();
      case 'overdueWork':
        return (a.overdueFollowUpCount + a.overdueTaskCount) - (b.overdueFollowUpCount + b.overdueTaskCount);
      case 'health':
      default:
        return a.health.score - b.health.score;
    }
  });
  return sortDirection === 'asc' ? sorted : sorted.reverse();
}

export const projectSavedViews: Array<{ key: ProjectSavedViewKey; label: string; description: string; filters: Partial<ProjectFilterState>; sortKey: ProjectSortKey; sortDirection: 'asc' | 'desc' }> = [
  { key: 'All projects', label: 'All projects', description: 'Full portfolio.', filters: {}, sortKey: 'health', sortDirection: 'desc' },
  { key: 'Hot projects', label: 'Hot projects', description: 'High pressure work now.', filters: { healthTier: 'High' }, sortKey: 'health', sortDirection: 'desc' },
  { key: 'Closeout', label: 'Closeout', description: 'Projects in closeout phase.', filters: { status: 'Closeout' }, sortKey: 'updated', sortDirection: 'asc' },
  { key: 'Waiting on external', label: 'Waiting on external', description: 'High waiting pressure.', filters: { hasNeedsNudge: 'yes' }, sortKey: 'overdueWork', sortDirection: 'desc' },
  { key: 'Blocked by tasks', label: 'Blocked by tasks', description: 'Task blockers driving risk.', filters: { hasBlockedTask: 'yes' }, sortKey: 'health', sortDirection: 'desc' },
  { key: 'Docs need review', label: 'Docs need review', description: 'Intake docs need owner action.', filters: { intakeReview: 'needs_review' }, sortKey: 'updated', sortDirection: 'asc' },
  { key: 'Low activity / stale', label: 'Low activity / stale', description: 'Potentially neglected projects.', filters: { activity: 'stale' }, sortKey: 'updated', sortDirection: 'asc' },
];

export function buildProjectStatusReport(row: ProjectDerivedRecord): string {
  const { project, health } = row;
  return [
    `# ${project.name} status report`,
    '',
    `Summary`,
    `- Status: ${project.status}`,
    `- Owner: ${project.owner}`,
    `- Phase: ${project.phase || '—'}`,
    `- Target completion: ${project.targetCompletionDate || '—'}`,
    `- Next milestone: ${project.nextMilestone || '—'}${project.nextMilestoneDate ? ` (${project.nextMilestoneDate.slice(0, 10)})` : ''}`,
    `- Next action: ${project.projectNextAction || '—'}`,
    '',
    `Follow-up pressure`,
    `- Open: ${health.breakdown.openFollowUps}`,
    `- Overdue: ${health.breakdown.overdueFollowUps}`,
    `- Needs nudge: ${health.breakdown.needsNudge}`,
    `- At risk: ${health.breakdown.atRiskFollowUps}`,
    '',
    `Task pressure`,
    `- Open tasks: ${row.openTasks.length}`,
    `- Blocked: ${health.breakdown.blockedTasks}`,
    `- Overdue: ${health.breakdown.overdueTasks}`,
    `- Deferred: ${health.breakdown.deferredTasks}`,
    '',
    `Top blockers`,
    `- Project blocker: ${project.currentBlocker || 'None documented'}`,
    `- Blocked task count: ${health.breakdown.blockedTasks}`,
    '',
    `Intake/doc summary`,
    `- Total docs: ${row.intakeDocs.length}`,
    `- Needing review: ${health.breakdown.docsNeedingReview}`,
    `- Stale docs: ${health.breakdown.staleIntakeDocs}`,
    '',
    `Relationships`,
    `- Contacts linked: ${row.contacts.length}`,
    `- Companies linked: ${row.companies.length}`,
    '',
    `Health score: ${health.score} (${health.tier})`,
    `Drivers: ${health.reasons.join('; ') || 'No major pressure signals.'}`,
  ].join('\n');
}
