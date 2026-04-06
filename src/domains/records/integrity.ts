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

function resolveProject(projectId: string | undefined, projectName: string | undefined, projects: ProjectRecord[]): ProjectRecord | undefined {
  if (projectId) {
    const direct = projects.find((project) => project.id === projectId);
    if (direct) return direct;
  }
  const byName = projects.find((project) => normalizeIdentity(project.name) === normalizeIdentity(projectName));
  if (byName) return byName;
  return projects.find((project) => (project.aliases || []).includes(normalizeIdentity(projectName)));
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

export function enforceFollowUpIntegrity(item: FollowUpItem, projects: ProjectRecord[]): FollowUpItem {
  const linkedProject = resolveProject(item.projectId, item.project, projects);
  const reasons = [
    ...projectReasons(linkedProject, item.project),
    ...ownerReasons(item.owner),
    ...provenanceReasons(item.sourceRef),
  ];
  const integrity = toIntegrityResult(Array.from(new Set(reasons)));
  return {
    ...item,
    projectId: linkedProject?.id,
    project: linkedProject?.name ?? item.project,
    lifecycleState: integrity.lifecycleState,
    reviewReasons: integrity.reviewReasons,
    invalidReason: integrity.invalidReason,
    dataQuality: integrity.dataQuality,
    provenance: item.provenance ?? { sourceType: 'manual', sourceRef: item.sourceRef, capturedAt: todayIso() },
    needsCleanup: integrity.lifecycleState !== 'ready' ? true : item.needsCleanup,
  };
}

export function enforceTaskIntegrity(task: TaskItem, projects: ProjectRecord[]): TaskItem {
  const linkedProject = resolveProject(task.projectId, task.project, projects);
  const reasons = [
    ...projectReasons(linkedProject, task.project),
    ...ownerReasons(task.owner),
    ...provenanceReasons(task.provenance?.sourceRef || task.summary),
  ];
  const integrity = toIntegrityResult(Array.from(new Set(reasons)));
  return {
    ...task,
    projectId: linkedProject?.id,
    project: linkedProject?.name ?? task.project,
    lifecycleState: integrity.lifecycleState,
    reviewReasons: integrity.reviewReasons,
    invalidReason: integrity.invalidReason,
    dataQuality: integrity.dataQuality,
    provenance: task.provenance ?? { sourceType: 'manual', sourceRef: task.summary?.slice(0, 120), capturedAt: todayIso() },
    needsCleanup: integrity.lifecycleState !== 'ready' ? true : task.needsCleanup,
  };
}

export function isExecutionReady(record: Pick<FollowUpItem | TaskItem, 'lifecycleState'>): boolean {
  return record.lifecycleState === 'ready' || record.lifecycleState === 'active';
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
