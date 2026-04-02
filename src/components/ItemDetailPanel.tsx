import { useEffect, useMemo, useState } from 'react';
import { FileEdit, Save, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

export function ItemDetailPanel() {
  const {
    selectedId,
    items,
    contacts,
    companies,
    updateItem,
    deleteItem,
    openEditModal,
    addRunningNote,
  } = useAppStore(useShallow((s) => ({
    selectedId: s.selectedId,
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    openEditModal: s.openEditModal,
    addRunningNote: s.addRunningNote,
  })));

  const item = items.find((entry) => entry.id === selectedId) ?? null;
  const [noteDraft, setNoteDraft] = useState('');
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 6) : []), [item, showActivity]);

  useEffect(() => {
    setNextActionDraft(item?.nextAction ?? '');
  }, [item?.id, item?.nextAction]);

  if (!item) {
    return (
      <aside className="tracker-detail-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Selected follow-up</div>
        <p className="mt-2 text-sm text-slate-500">Select a row in the tracker to see the summary, next action, notes, and recent activity here.</p>
      </aside>
    );
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);

  return (
    <aside className="tracker-detail-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="followup-detail-head">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected follow-up</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{item.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusTone(item.status)}>{item.status}</Badge>
            <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
            <Badge variant={escalationTone(item.escalationLevel)}>{item.escalationLevel}</Badge>
          </div>
        </div>
        <div className="detail-actions-row">
          <button onClick={() => openEditModal(item.id)} className="action-btn"><FileEdit className="h-4 w-4" />Edit</button>
          <button onClick={() => { if (window.confirm('Delete this follow-up? This cannot be undone.')) deleteItem(item.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      </div>

      <div className="followup-detail-body">
        <div className="detail-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</div>
          <textarea
            value={nextActionDraft}
            onChange={(event) => setNextActionDraft(event.target.value)}
            className="field-textarea mt-2"
            placeholder="Enter the next move here"
          />
          <div className="mt-3 flex justify-end">
            <button onClick={() => updateItem(item.id, { nextAction: nextActionDraft })} className="action-btn">
              <Save className="h-4 w-4" />
              Save next action
            </button>
          </div>
        </div>

        <div className="detail-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</div>
          <div className="mt-2 text-sm text-slate-600">{item.summary || 'No summary entered yet.'}</div>
        </div>

        <div className="detail-card detail-facts-grid">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</div>
            <div className="mt-1 text-sm text-slate-900">{item.project}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</div>
            <div className="mt-1 text-sm text-slate-900">{item.owner}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</div>
            <div className="mt-1 text-sm text-slate-900">{formatDate(item.dueDate)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next touch</div>
            <div className="mt-1 text-sm text-slate-900">{formatDate(item.nextTouchDate)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div>
            <div className="mt-1 text-sm text-slate-900">{contact?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</div>
            <div className="mt-1 text-sm text-slate-900">{company?.name ?? '—'}</div>
          </div>
        </div>

        <div className="detail-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Running notes</div>
              <div className="text-xs text-slate-500">Stamped automatically so the note trail stays clean.</div>
            </div>
            <div className="text-xs text-slate-500">{noteEntries.length} entr{noteEntries.length === 1 ? 'y' : 'ies'}</div>
          </div>
          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="field-textarea mt-3" placeholder="Type a note, update, or phone call summary…" />
          <div className="mt-3 flex justify-end">
            <button onClick={() => { if (!noteDraft.trim()) return; addRunningNote(item.id, noteDraft); setNoteDraft(''); }} className="action-btn">Add note</button>
          </div>
          <div className="mt-4 space-y-3">
            {noteEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-500">{formatDateTime(entry.at)}</div>
                <div className="mt-1 note-pre-wrap text-sm text-slate-700">{entry.text}</div>
              </div>
            ))}
            {noteEntries.length === 0 ? <div className="text-sm text-slate-500">No notes yet.</div> : null}
          </div>
        </div>

        <div className="detail-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Recent activity</div>
              <div className="text-xs text-slate-500">Compact by default.</div>
            </div>
            <button onClick={() => setShowActivity((value) => !value)} className="action-btn">{showActivity ? 'Show fewer' : 'Show more'}</button>
          </div>
          <div className="timeline-list mt-3">
            {activityEntries.map((entry) => (
              <div key={entry.id} className="timeline-row">
                <div className="timeline-dot" />
                <div>
                  <div className="text-sm font-medium text-slate-900">{entry.summary}</div>
                  <div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
