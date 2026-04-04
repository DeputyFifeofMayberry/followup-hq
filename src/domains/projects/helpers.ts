import { createId, todayIso } from '../../lib/utils';
import type { FollowUpItem, ProjectRecord, TaskItem } from '../../types';

export function projectCanonicalKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function stampProject(project: ProjectRecord, patch: Partial<ProjectRecord> = {}): ProjectRecord {
  return { ...project, ...patch, updatedAt: todayIso() };
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
