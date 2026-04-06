export type EditSurfaceRole = 'execution' | 'quick_edit' | 'full_edit' | 'context' | 'maintenance' | 'transition';

/**
 * Deficiency 4 / Phase 1 canonical hierarchy:
 * 1) execution (lane inspectors)
 * 2) full_edit (full record modal)
 * 3) context (record drawer + linked context)
 * 4) transition (structured, validated workflow moves)
 * 5) maintenance (lower-priority admin/destructive controls)
 *
 * This helper is intentionally lightweight; it standardizes language and role
 * intent without introducing a heavy UI framework.
 */
export const editSurfacePolicy: Record<EditSurfaceRole, {
  label: string;
  intent: string;
}> = {
  execution: {
    label: 'Take action now',
    intent: 'Fast operational updates while moving work forward in-lane.',
  },
  quick_edit: {
    label: 'Quick edit',
    intent: 'Patch one or two common fields without entering the full editor.',
  },
  full_edit: {
    label: 'Edit full record',
    intent: 'Open the full edit modal for complete metadata maintenance.',
  },
  context: {
    label: 'Open record context',
    intent: 'Inspect linked records and surrounding context in the record drawer.',
  },
  maintenance: {
    label: 'Maintenance',
    intent: 'Lower-priority admin/destructive controls and cleanup actions.',
  },
  transition: {
    label: 'Workflow transition',
    intent: 'Validated/high-friction transitions with warnings or blockers.',
  },
};

export const editSurfaceCtas = {
  fullEditTask: 'Edit full task',
  fullEditProject: 'Edit full project',
  fullEditFollowUp: 'Edit full follow-up',
  quickEditFollowUp: 'Quick edit follow-up',
  quickEditTask: 'Quick edit task',
  quickEditRecord: editSurfacePolicy.quick_edit.label,
  fullEditRecord: editSurfacePolicy.full_edit.label,
  openContext: editSurfacePolicy.context.label,
} as const;
