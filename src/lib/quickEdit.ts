import type { FollowUpItem, TaskItem } from '../types';

export interface QuickEditPatch {
  title?: string;
  dueDate?: string;
  owner?: string;
  project?: string;
  nextAction?: string;
  nextStep?: string;
}

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function applyQuickEditPatchToFollowUp(record: FollowUpItem, patch: QuickEditPatch): FollowUpItem {
  const next = { ...record };
  const title = normalize(patch.title);
  const owner = normalize(patch.owner);
  const project = normalize(patch.project);
  const nextAction = normalize(patch.nextAction);
  const dueDate = normalize(patch.dueDate);

  if (title) next.title = title;
  if (owner) {
    next.owner = owner;
    next.assigneeDisplayName = owner;
  }
  if (project) {
    next.project = project;
    next.projectId = undefined;
  }
  if (nextAction) next.nextAction = nextAction;
  if (dueDate) {
    next.dueDate = dueDate;
    next.nextTouchDate = dueDate;
  }

  return next;
}

export function applyQuickEditPatchToTask(record: TaskItem, patch: QuickEditPatch): TaskItem {
  const next = { ...record };
  const title = normalize(patch.title);
  const owner = normalize(patch.owner);
  const project = normalize(patch.project);
  const nextStep = normalize(patch.nextStep);
  const dueDate = normalize(patch.dueDate);

  if (title) next.title = title;
  if (owner) {
    next.owner = owner;
    next.assigneeDisplayName = owner;
  }
  if (project) {
    next.project = project;
    next.projectId = undefined;
  }
  if (nextStep) next.nextStep = nextStep;
  if (dueDate) next.dueDate = dueDate;

  return next;
}
