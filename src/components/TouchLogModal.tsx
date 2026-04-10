import { useEffect, useState } from 'react';
import { fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader } from './ui/AppPrimitives';

export function TouchLogModal() {
  const { item, touchModalOpen, closeTouchModal, addTouchLog } = useAppStore(useShallow((s) => ({
    item: s.items.find((entry) => entry.id === s.selectedId) ?? null,
    touchModalOpen: s.touchModalOpen,
    closeTouchModal: s.closeTouchModal,
    addTouchLog: s.addTouchLog,
  })));

  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [nextTouchDate, setNextTouchDate] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [waitingOn, setWaitingOn] = useState('');

  useEffect(() => {
    if (!touchModalOpen) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [touchModalOpen]);

  useEffect(() => {
    if (!touchModalOpen || !item) return;
    setSummary('');
    setStatus('');
    setDueDate(toDateInputValue(item.dueDate));
    setNextTouchDate(toDateInputValue(item.nextTouchDate));
    setPromisedDate(toDateInputValue(item.promisedDate));
    setWaitingOn(item.waitingOn ?? '');
  }, [touchModalOpen, item]);

  if (!touchModalOpen || !item) return null;

  return (
    <AppModal size="standard">
      <AppModalHeader
        title="Touch updatepoint"
        subtitle="Record outcome and update key dates."
        onClose={closeTouchModal}
      />
      <AppModalBody>
        <div className="form-section">
          <div className="form-section-title">Touch summary</div>
          <div className="field-block">
            <label className="field-label">Summary</label>
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="field-textarea" />
            <div className="field-help">Use outcome-focused notes so audit history stays high signal.</div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">State updates (optional)</div>
          <div className="form-grid-two">
            <div className="field-block">
              <label className="field-label">Optional new status</label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-input">
                <option value="">Keep current</option>
                <option>Needs action</option>
                <option>Waiting on external</option>
                <option>Waiting internal</option>
                <option>In progress</option>
                <option>At risk</option>
                <option>Closed</option>
              </select>
            </div>
            <div className="field-block"><label className="field-label">Due date</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field-input" /></div>
            <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={nextTouchDate} onChange={(event) => setNextTouchDate(event.target.value)} className="field-input" /></div>
            <div className="field-block"><label className="field-label">Promised date</label><input type="date" value={promisedDate} onChange={(event) => setPromisedDate(event.target.value)} className="field-input" /></div>
            <div className="field-block span-two"><label className="field-label">Waiting on</label><input value={waitingOn} onChange={(event) => setWaitingOn(event.target.value)} className="field-input" /></div>
          </div>
        </div>
      </AppModalBody>

      <AppModalFooter>
        <button onClick={closeTouchModal} className="action-btn">Cancel</button>
        <button
          onClick={() => {
            addTouchLog({
              id: item.id,
              summary: summary || 'Logged a touchpoint without summary.',
              status: status ? (status as typeof item.status) : undefined,
              dueDate: dueDate ? fromDateInputValue(dueDate) : undefined,
              nextTouchDate: nextTouchDate ? fromDateInputValue(nextTouchDate) : undefined,
              promisedDate: promisedDate ? fromDateInputValue(promisedDate) : undefined,
              waitingOn,
            });
          }}
          className="primary-btn"
        >
          Save touchpoint
        </button>
      </AppModalFooter>
    </AppModal>
  );
}
