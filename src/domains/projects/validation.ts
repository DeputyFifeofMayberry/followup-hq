import type { ProjectRecord } from '../../types';

export interface ProjectValidationResult {
  errors: string[];
}

export interface NormalizedProjectInput {
  name: string;
  code?: string;
  aliases?: string[];
  tags?: string[];
  owner: string;
  notes: string;
  location?: string;
  facility?: string;
  building?: string;
}

export function normalizeDelimitedArray(values: string[] | undefined): string[] {
  return (values ?? []).map((entry) => entry.trim()).filter(Boolean);
}

export function normalizeProjectInput(input: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>): NormalizedProjectInput {
  return {
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    aliases: normalizeDelimitedArray(input.aliases),
    tags: normalizeDelimitedArray(input.tags),
    owner: input.owner.trim() || 'Unassigned',
    notes: input.notes.trim(),
    location: input.location?.trim() || undefined,
    facility: input.facility?.trim() || undefined,
    building: input.building?.trim() || undefined,
  };
}

function canon(value: string): string {
  return value.trim().toLowerCase();
}

export function validateProjectIdentity(
  input: Pick<ProjectRecord, 'name' | 'code'>,
  projects: ProjectRecord[],
  ignoreProjectId?: string,
): ProjectValidationResult {
  const errors: string[] = [];
  const normalizedName = canon(input.name || '');
  const normalizedCode = canon(input.code || '');
  if (!normalizedName) errors.push('Project name is required.');

  const hasDuplicateName = projects.some((project) => project.id !== ignoreProjectId && canon(project.name) === normalizedName);
  if (normalizedName && hasDuplicateName) errors.push('A project with this name already exists.');

  const hasDuplicateCode = normalizedCode
    ? projects.some((project) => project.id !== ignoreProjectId && canon(project.code || '') === normalizedCode)
    : false;
  if (hasDuplicateCode) errors.push('A project with this code already exists.');

  return { errors };
}
