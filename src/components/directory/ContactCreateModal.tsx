import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface ContactCreateModalProps {
  open: boolean;
  name: string;
  role: string;
  onNameChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function ContactCreateModal({ open, name, role, onNameChange, onRoleChange, onClose, onCreate }: ContactCreateModalProps) {
  if (!open) return null;
  return (
    <AppModal onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="New contact" subtitle="Create a people directory record." onClose={onClose} />
      <AppModalBody>
        <div className="space-y-2">
          <label className="field-block"><span className="field-label">Name *</span><input className="field-input" value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
          <label className="field-block"><span className="field-label">Role</span><input className="field-input" value={role} onChange={(event) => onRoleChange(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={onCreate}>Create</button></div>
      </AppModalBody>
    </AppModal>
  );
}
