import type {
  FollowUpItem,
  ProjectRecord,
  RecordIntegrityReason,
  RecordLifecycleState,
  TaskItem,
} from '../../types';
import { normalizeIdentity } from '../../lib/entities';
import { todayIso } from '../../lib/utils';

const PLACEHOLDER_PROJECTS = new Set(['general']);
const PLACEHOLDER_OWNERS = new Set(['unassigned']);

export interface IntegrityResult {
  lifecycleState: RecordLifecycleState;
  reviewReasons: RecordIntegrityReason[];
  invalidReason?: string;
  dataQuality: 'valid_live' | 'review_required' | 'draft';
}

function hasLegacyExecutionShape(record: Pick<FollowUpItem | TaskItem, 'lifecycleState' | 'dataQuality' | 'provenance'>): boolean {
  return !record.lifecycleState || !record.dataQuality || !record.provenance || record.provenance.sourceType === 'manual';
}

function resolveProject(projectId: string | undefined, projectName: string | undefined, projects: ProjectRecord[]): ProjectRecord | undefined {
  if (projectId) {
    const direct = projects.find((project) => project.id === projectId);
    if (direct) return direct;
  }
  const normalizedName = normalizeIdentity(projectName);
  if (!normalizedName) return undefined;
  const byName = projects.find((project) => normalizeIdentity(project.name) === normalizedName);
  if (byName) return byName;
  return projects.find((project) => (project.aliases || []).includes(normalizedName));
}

function projectReasons(project: ProjectRecord | undefined, rawProjectName?: string): RecordIntegrityReason[] {
  const reasons: RecordIntegrityReason[] = [];
  if (!project) {
    reasons.push('missing_project_link');
    if (PLACEHOLDER_PROJECTS.has(normalizeIdentity(rawProjectName))) reasons.push('placeholder_project');
    return reasons;
  }
  if (project.deletedAt) reasons.push('deleted_project');
  if (project.status === 'Complete' || project.status === 'On hold') reasons.push('archived_project');
  return reasons;
}

function ownerReasons(owner?: string): RecordIntegrityReason[] {
  const normalized = normalizeIdentity(owner);
  if (!normalized) return ['missing_owner', 'missing_accountable_owner'];
  if (PLACEHOLDER_OWNERS.has(normalized)) return ['placeholder_owner'];
  return [];
}

function provenanceReasons(sourceRef?: string): RecordIntegrityReason[] {
  return sourceRef?.trim() ? [] : ['missing_provenance', 'weak_execution_provenance'];
}

function toIntegrityResult(reasons: RecordIntegrityReason[]): IntegrityResult {
  if (reasons.length === 0) {
    return { lifecycleState: 'ready', reviewReasons: [], dataQuality: 'valid_live' };
  }
  return {
    lifecycleState: 'review_required',
    reviewReasons: reasons,
    dataQuality: 'review_required',
    invalidReason: reasons.join(', '),
  };
}

function withLegacyReasonIfNeeded(
  reasons: RecordIntegrityReason[],
  record: Pick<FollowUpItem | TaskItem, 'lifecycleState' | 'dataQuality' | 'provenance'>,
): RecordIntegrityReason[] {
  const hasLegacyShape = hasLegacyExecutionShape(record);
  if (!hasLegacyShape) return reasons;
  return reasons.includes('legacy_record_requires_cleanup') ? reasons : [...reasons, 'legacy_record_requires_cleanup'];
}

function normalizeLegacyProvenance(
  provenance: FollowUpItem['provenance'] | TaskItem['provenance'] | undefined,
  sourceRef: string | undefined,
  fallbackRef: string,
): NonNullable<FollowUpItem['provenance']> {
  if (provenance && provenance.sourceType !== 'manual') {
    return {
      ...provenance,
      sourceRef: provenance.sourceRef || sourceRef || fallbackRef,
      capturedAt: provenance.capturedAt || todayIso(),
    };
  }
  return {
    sourceType: 'migration',
    sourceRef: provenance?.sourceRef || sourceRef || fallbackRef,
    capturedAt: provenance?.capturedAt || todayIso(),
    sourceBatchId: provenance?.sourceBatchId,
  };
}

export function repairLegacyFollowUpForHydration(item: FollowUpItem, projects: ProjectRecord[]): FollowUpItem {
  const linkedProject = resolveProject(item.projectId, item.project, projects);
  const hasBusinessIntegrityIssue = [
    ...projectReasons(linkedProject, item.project),
    ...ownerReasons(item.owner),
    ...provenanceReasons(item.sourceRef),
  ].length > 0;
  if (hasBusinessIntegrityIssue || !hasLegacyExecutionShape(item)) return item;
  return {
    ...item,
    projectId: linkedProject?.id ?? item.projectId,
    project: linkedProject?.name ?? item.project,
    lifecycleState: 'ready',
    dataQuality: 'valid_live',
    reviewReasons: [],
    invalidReason: undefined,
    needsCleanup: false,
    provenance: normalizeLegacyProvenance(item.provenance, item.sourceRef, item.id),
  };
}

export function repairLegacyTaskForHydration(task: TaskItem, projects: ProjectRecord[]): TaskItem {
  const linkedProject = resolveProject(task.projectId, task.project, projects);
  const hasBusinessIntegrityIssue = [
    ...projectReasons(linkedProject, task.project),
    ...ownerReasons(task.owner),
    ...provenanceReasons(task.provenance?.sourceRef || task.summary),
  ].length > 0;
  if (hasBusinessIntegrityIssue || !hasLegacyExecutionShape(task)) return task;
  return {
    ...task,
    projectId: linkedProject?.id ?? task.projectId,
    project: linkedProject?.name ?? task.project,
    lifecycleState: 'ready',
    dataQuality: 'valid_live',
    reviewReasons: [],
    invalidReason: undefined,
    needsCleanup: false,
    provenance: normalizeLegacyProvenance(task.provenance, task.provenance?.sourceRef || task.summary, task.id),
  };
}

export function enforceFollowUpIntegrity(item: FollowUpItem, projects: ProjectRecord[]): FollowUpItem {
  const linkedProject = resolveProject(item.projectId, item.project, projects);
  const reasons = withLegacyReasonIfNeeded(
    [
      ...projectReasons(linkedProject, item.project),
      ...ownerReasons(item.owner),
      ...provenanceReasons(item.sourceRef),
    ],
    item,
  );
  const integrity = toIntegrityResult(Array.from(new Set(reasons)));
  const provenance = item.provenance ?? {
    sourceType: 'migration',
    sourceRef: item.sourceRef || item.id,
    capturedAt: todayIso(),
  };
  return {
    ...item,
    projectId: linkedProject?.id,
    project: linkedProject?.name ?? item.project,
    lifecycleState: integrity.lifecycleState,
    reviewReasons: integrity.reviewReasons,
    invalidReason: integrity.invalidReason,
    dataQuality: integrity.dataQuality,
    provenance,
    needsCleanup: integrity.lifecycleState !== 'ready' ? true : item.needsCleanup,
  };
}

export function enforceTaskIntegrity(task: TaskItem, projects: ProjectRecord[]): TaskItem {
  const linkedProject = resolveProject(task.projectId, task.project, projects);
  const reasons = withLegacyReasonIfNeeded(
    [
      ...projectReasons(linkedProject, task.project),
      ...ownerReasons(task.owner),
      ...provenanceReasons(task.provenance?.sourceRef || task.summary),
    ],
    task,
  );
  const integrity = toIntegrityResult(Array.from(new Set(reasons)));
  const provenance = task.provenance ?? {
    sourceType: 'migration',
    sourceRef: task.summary?.slice(0, 120) || task.id,
    capturedAt: todayIso(),
  };
  return {
    ...task,
    projectId: linkedProject?.id,
    project: linkedProject?.name ?? task.project,
    lifecycleState: integrity.lifecycleState,
    reviewReasons: integrity.reviewReasons,
    invalidReason: integrity.invalidReason,
    dataQuality: integrity.dataQuality,
    provenance,
    needsCleanup: integrity.lifecycleState !== 'ready' ? true : task.needsCleanup,
  };
}

export function isExecutionReady(record: Pick<FollowUpItem | TaskItem, 'lifecycleState'>): boolean {
  return record.lifecycleState === 'ready' || record.lifecycleState === 'active';
}

export function isTrustedLiveRecord(record: Pick<FollowUpItem | TaskItem, 'lifecycleState' | 'reviewReasons' | 'needsCleanup' | 'dataQuality'>): boolean {
  return isExecutionReady(record)
    && !record.needsCleanup
    && (record.reviewReasons?.length ?? 0) === 0
    && (record.dataQuality === 'valid_live' || !record.dataQuality);
}

export function isReviewRecord(record: Pick<FollowUpItem | TaskItem, 'lifecycleState' | 'reviewReasons' | 'needsCleanup' | 'dataQuality'>): boolean {
  return record.lifecycleState === 'review_required'
    || record.dataQuality === 'review_required'
    || !!record.needsCleanup
    || (record.reviewReasons?.length ?? 0) > 0;
}

export function getIntegrityReasonLabel(reason: RecordIntegrityReason): string {
  const labels: Record<RecordIntegrityReason, string> = {
    missing_project_link: 'Select a real project before this can enter a live execution lane.',
    ambiguous_project_link: 'Project match is ambiguous. Resolve the canonical project before live approval.',
    placeholder_project: 'Placeholder project values cannot be used for live execution.',
    missing_accountable_owner: 'Set an accountable owner before this can be live.',
    missing_owner: 'Owner is required for execution.',
    missing_assignee_for_live_task: 'Assign this task before sending it to the live task lane.',
    missing_due_context: 'Add due context before this can be treated as live execution work.',
    weak_execution_provenance: 'Execution provenance is weak; review the source before live approval.',
    duplicate_resolution_required: 'Possible duplicate detected. Resolve link/update decision first.',
    legacy_record_requires_cleanup: 'Legacy record requires cleanup before live execution.',
    placeholder_owner: 'Placeholder owners cannot be used for live execution.',
    missing_provenance: 'Source provenance is missing.',
    archived_project: 'Linked project is archived; review before live execution.',
    deleted_project: 'Linked project was deleted; resolve project link before live execution.',
  };
  return labels[reason];
}
