import { useMemo, useState } from 'react';
import { CalendarClock, FileEdit, Trash2 } from 'lucide-react';
import { Badge } from './Badge';
import { escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

export function ItemDetailPanel() {
  const {
    selectedId,
    items,
    contacts,
    companies,
    updateItem,
    deleteItem,
    openEditModal,
    openTouchModal,
    addRunningNote,
  } = useAppStore(useShallow((s) => ({
    selectedId: s.selectedId,
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    openEditModal: s.openEditModal,
    openTouchModal: s.openTouchModal,
    addRunningNote: s.addRunningNote,
  })));
  const item = items.find((entry) => entry.id === selectedId) ?? null;
  const [noteDraft, setNoteDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item?.notes]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 6) : []), [item, showActivity]);

  if (!item) {
    return (
      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Item details</div>
        <p className="mt-2 text-sm text-slate-500">Select a follow-up to see details, running notes, and recent activity.</p>
      </aside>
    );
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);

  return (
    <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
          <button onClick={openTouchModal} className="action-btn"><CalendarClock className="h-4 w-4" />Touch log</button>
          <button onClick={() => { if (window.confirm('Delete this follow-up? This cannot be undone.')) deleteItem(item.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">At a glance</div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div><span className="font-medium text-slate-900">Project:</span> {item.project}</div>
            <div><span className="font-medium text-slate-900">Owner:</span> {item.owner}</div>
            <div><span className="font-medium text-slate-900">Due:</span> {formatDate(item.dueDate)}</div>
            <div><span className="font-medium text-slate-900">Next touch:</span> {formatDate(item.nextTouchDate)}</div>
            {item.promisedDate ? <div><span className="font-medium text-slate-900">Promised:</span> {formatDate(item.promisedDate)}</div> : null}
            {item.waitingOn ? <div><span className="font-medium text-slate-900">Waiting on:</span> {item.waitingOn}</div> : null}
            <div><span className="font-medium text-slate-900">Source:</span> {item.source}</div>
            <div><span className="font-medium text-slate-900">Source ref:</span> {item.sourceRef || '—'}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationships</div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div><span className="font-medium text-slate-900">Contact:</span> {contact?.name ?? '—'}</div>
            <div><span className="font-medium text-slate-900">Company:</span> {company?.name ?? '—'}</div>
            <div><span className="font-medium text-slate-900">Who owes next move:</span> {item.owesNextAction}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">Summary</div>
        <div className="mt-2 text-sm text-slate-600">{item.summary || 'No summary entered yet.'}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">Next action</div>
        <textarea value={item.nextAction} onChange={(event) => updateItem(item.id, { nextAction: event.target.value })} className="field-textarea mt-2" />
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Running notes</div>
            <div className="text-xs text-slate-500">Each note is stamped automatically so you get a clean running log.</div>
          </div>
          <div className="text-xs text-slate-500">{noteEntries.length} entr{noteEntries.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="field-textarea mt-3" placeholder="Type a note, update, or phone call summary…" />
        <div className="mt-3 flex justify-end">
          <button onClick={() => { if (!noteDraft.trim()) return; addRunningNote(item.id, noteDraft); setNoteDraft(''); }} className="primary-btn">Add note</button>
        </div>
        <div className="mt-4 space-y-3">
          {noteEntries.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">{formatDateTime(entry.at)}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{entry.text}</div>
            </div>
          ))}
          {noteEntries.length === 0 ? <div className="text-sm text-slate-500">No notes yet.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Recent activity</div>
            <div className="text-xs text-slate-500">Keep this compact unless you need the full history.</div>
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
    </aside>
  );
}
