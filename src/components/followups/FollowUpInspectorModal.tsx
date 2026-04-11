import { ItemDetailPanel } from '../ItemDetailPanel';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader } from '../ui/AppPrimitives';
import type { FollowUpItem } from '../../types';

export function FollowUpInspectorModal({
  open,
  selectedFollowUp,
  personalMode,
  onClose,
}: {
  open: boolean;
  selectedFollowUp: FollowUpItem | null;
  personalMode: boolean;
  onClose: () => void;
}) {
  if (!open || !selectedFollowUp) return null;

  const ownerLabel = personalMode ? selectedFollowUp.owner : (selectedFollowUp.assigneeDisplayName || selectedFollowUp.owner);

  return (
    <AppModal size="wide" onBackdropClick={onClose} onClose={onClose} ariaLabel="Follow-up detail">
      <AppModalHeader
        title={selectedFollowUp.title}
        subtitle={`${selectedFollowUp.project} • ${ownerLabel}`}
        onClose={onClose}
      />
      <AppModalBody>
        <ItemDetailPanel personalMode={personalMode} inModal onRequestClose={onClose} />
      </AppModalBody>
      <AppModalFooter>
        <button type="button" className="action-btn" onClick={onClose}>Close</button>
      </AppModalFooter>
    </AppModal>
  );
}
