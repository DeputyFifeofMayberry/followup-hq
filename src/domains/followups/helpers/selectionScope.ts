import type { FollowUpItem } from '../../../types';

export interface FollowUpSelectionScope {
  selectedIds: string[];
  actionableIds: string[];
  hiddenIds: string[];
  missingIds: string[];
}

export function deriveFollowUpSelectionScope(items: FollowUpItem[], visibleRows: FollowUpItem[], selectedIds: string[]): FollowUpSelectionScope {
  const allIds = new Set(items.map((item) => item.id));
  const visibleIds = new Set(visibleRows.map((item) => item.id));
  const dedupedSelected = Array.from(new Set(selectedIds));

  const existingSelected = dedupedSelected.filter((id) => allIds.has(id));
  const missingIds = dedupedSelected.filter((id) => !allIds.has(id));
  const actionableIds = existingSelected.filter((id) => visibleIds.has(id));
  const hiddenIds = existingSelected.filter((id) => !visibleIds.has(id));

  return {
    selectedIds: existingSelected,
    actionableIds,
    hiddenIds,
    missingIds,
  };
}
