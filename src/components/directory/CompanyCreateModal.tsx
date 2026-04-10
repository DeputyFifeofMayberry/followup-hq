import type { CompanyType } from '../../types';
import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface CompanyCreateModalProps {
  open: boolean;
  name: string;
  type: CompanyType;
  onNameChange: (value: string) => void;
  onTypeChange: (value: CompanyType) => void;
  onClose: () => void;
  onCreate: () => void;
}

const companyTypes: CompanyType[] = ['Government', 'Owner', 'Vendor', 'Subcontractor', 'Consultant', 'Internal', 'Other'];

export function CompanyCreateModal({ open, name, type, onNameChange, onTypeChange, onClose, onCreate }: CompanyCreateModalProps) {
  if (!open) return null;
  return (
    <AppModal onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="New company" subtitle="Create a company directory record." onClose={onClose} />
      <AppModalBody>
        <div className="space-y-2">
          <label className="field-block"><span className="field-label">Name *</span><input className="field-input" value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
          <label className="field-block"><span className="field-label">Type</span><select className="field-input" value={type} onChange={(event) => onTypeChange(event.target.value as CompanyType)}>{companyTypes.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={onCreate}>Create</button></div>
      </AppModalBody>
    </AppModal>
  );
}
