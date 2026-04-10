import { createId, todayIso } from '../../lib/utils';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../types';

export function projectCanonicalKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function stampProject(project: ProjectRecord, patch: Partial<ProjectRecord> = {}): ProjectRecord {
  return { ...project, ...patch, updatedAt: todayIso() };
}

export function normalizeProjectRecord(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    name: (project.name || '').trim() || 'General',
    owner: (project.owner || '').trim() || 'Unassigned',
    code: project.code?.trim() || undefined,
    aliases: [...new Set((project.aliases ?? []).map((entry) => entry.trim()).filter(Boolean))],
    tags: [...new Set((project.tags ?? []).map((entry) => entry.trim()).filter(Boolean))],
    notes: (project.notes || '').trim(),
    linkedContactIds: [...new Set((project.linkedContactIds ?? []).filter(Boolean))],
    linkedCompanyIds: [...new Set((project.linkedCompanyIds ?? []).filter(Boolean))],
    contractReference: project.contractReference?.trim() || undefined,
    clientOrg: project.clientOrg?.trim() || undefined,
    ownerOrg: project.ownerOrg?.trim() || undefined,
    superintendent: project.superintendent?.trim() || undefined,
    leadAssignee: project.leadAssignee?.trim() || undefined,
    phase: project.phase?.trim() || undefined,
    targetCompletionDate: project.targetCompletionDate || undefined,
    nextMilestone: project.nextMilestone?.trim() || undefined,
    nextMilestoneDate: project.nextMilestoneDate || undefined,
    riskSummary: project.riskSummary?.trim() || undefined,
    currentBlocker: project.currentBlocker?.trim() || undefined,
    closeoutReadiness: typeof project.closeoutReadiness === 'number' ? project.closeoutReadiness : undefined,
    projectNextAction: project.projectNextAction?.trim() || undefined,
    location: project.location?.trim() || undefined,
    facility: project.facility?.trim() || undefined,
    building: project.building?.trim() || undefined,
    lastReviewedAt: project.lastReviewedAt || undefined,
    completionNote: project.completionNote?.trim() || undefined,
    archived: typeof project.archived === 'boolean' ? project.archived : undefined,
  };
}

export function deriveProjects(items: FollowUpItem[], existing: ProjectRecord[] = [], tasks: TaskItem[] = []): ProjectRecord[] {
  const byId = new Map(existing.map((project) => [project.id, project]));
  const byName = new Map(existing.map((project) => [projectCanonicalKey(project.name), project]));

  const upsertProject = (name: string, owner: string, projectId?: string) => {
    const normalizedName = (name || 'General').trim() || 'General';
    const existingById = projectId ? byId.get(projectId) : undefined;
    const existingByName = byName.get(projectCanonicalKey(normalizedName));

    if (existingById) {
      byId.set(existingById.id, stampProject(existingById, { name: normalizedName, owner: owner || existingById.owner }));
      byName.set(projectCanonicalKey(normalizedName), byId.get(existingById.id)!);
      return;
    }

    if (existingByName) {
      byId.set(existingByName.id, stampProject(existingByName, { owner: existingByName.owner || owner || 'Unassigned' }));
      return;
    }

    const created = {
      id: createId('PRJ'),
      name: normalizedName,
      owner: owner || 'Unassigned',
      status: 'Active',
      notes: '',
      tags: [],
      createdAt: todayIso(),
      updatedAt: todayIso(),
    } satisfies ProjectRecord;
    byId.set(created.id, created);
    byName.set(projectCanonicalKey(normalizedName), created);
  };

  items.forEach((item) => upsertProject(item.project || 'General', item.owner || 'Unassigned', item.projectId));
  tasks.forEach((task) => upsertProject(task.project || 'General', task.owner || 'Unassigned', task.projectId));

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
