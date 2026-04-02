import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileEdit, Save, Send, SquareCheckBig, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, buildTouchEvent, createId, escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

export function ItemDetailPanel() {
  const {
    selectedId,
    items,
    tasks,
    contacts,
    companies,
    updateItem,
    deleteItem,
    openEditModal,
    addRunningNote,
    addTask,
    addTouchLog,
    openDraftModal,
  } = useAppStore(useShallow((s) => ({
    selectedId: s.selectedId,
    items: s.items,
    tasks: s.tasks,
    contacts: s.contacts,
    companies: s.companies,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    openEditModal: s.openEditModal,
    addRunningNote: s.addRunningNote,
    addTask: s.addTask,
    addTouchLog: s.addTouchLog,
    openDraftModal: s.openDraftModal,
  })));

  const item = items.find((entry) => entry.id === selectedId) ?? null;
  const [noteDraft, setNoteDraft] = useState('');
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 6) : []), [item, showActivity]);

  useEffect(() => {
    setNextActionDraft(item?.nextAction ?? '');
    setAssigneeDraft(item?.assigneeDisplayName ?? item?.owner ?? '');
  }, [item?.id, item?.nextAction]);

  if (!item) {
    return <aside className="tracker-detail-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-lg font-semibold text-slate-950">Focus panel</div><p className="mt-2 text-sm text-slate-500">Select a follow-up to run action bundles and close the loop.</p></aside>;
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);
  const linkedTasks = tasks.filter((task) => task.linkedFollowUpId === item.id);
  const doneLinkedTasks = linkedTasks.filter((task) => task.status === 'Done').length;
  const blockedLinkedTasks = linkedTasks.filter((task) => task.status === 'Blocked').length;

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
        <button onClick={() => openEditModal(item.id)} className="action-btn"><FileEdit className="h-4 w-4" />Edit</button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Action console</div>
        <div className="mt-2 text-xs text-slate-500">Communication</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => openDraftModal(item.id)} className="action-btn"><Send className="h-4 w-4" />Send / Draft follow-up</button>
          <button onClick={() => addTouchLog({ id: item.id, summary: 'Sent follow-up bundle.', status: 'Waiting on external', nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3) })} className="action-btn">Log touch bundle</button>
          <button onClick={() => updateItem(item.id, { status: 'Waiting on external', waitingOn: item.waitingOn || item.owner, lastCompletedAction: 'Waiting on someone', lastActionAt: todayIso(), timeline: [buildTouchEvent('Marked waiting on external from action console.', 'bundle_action'), ...item.timeline] })} className="action-btn">Waiting on someone</button>
        </div>
        <div className="mt-3 text-xs text-slate-500">Workflow</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => addTask({ id: createId('TSK'), title: `Task: ${item.title}`, project: item.project, projectId: item.projectId, owner: item.owner, status: 'To do', priority: item.priority, dueDate: item.nextTouchDate || item.dueDate, startDate: todayIso(), summary: item.summary, nextStep: item.nextAction || 'Complete next step.', notes: '', tags: ['From follow-up'], linkedFollowUpId: item.id, contactId: item.contactId, companyId: item.companyId, createdAt: todayIso(), updatedAt: todayIso(), lastCompletedAction: 'Delegated as task', lastActionAt: todayIso() })} className="action-btn"><SquareCheckBig className="h-4 w-4" />Delegated as task</button>
          <button onClick={() => updateItem(item.id, { status: 'Closed', lastCompletedAction: 'Resolved', lastActionAt: todayIso(), timeline: [buildTouchEvent('Resolved via action console.', 'bundle_action'), ...item.timeline] })} className="action-btn"><CheckCircle2 className="h-4 w-4" />Resolve / Close</button>
        </div>
        <div className="mt-3 text-xs text-slate-500">Status / Timing</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => updateItem(item.id, { nextTouchDate: addDaysIso(todayIso(), 2), lastCompletedAction: 'Snoozed / Re-plan', lastActionAt: todayIso() })} className="action-btn">Snooze / Re-plan</button>
          <button onClick={() => updateItem(item.id, { escalationLevel: item.escalationLevel === 'Critical' ? 'Watch' : 'Critical', lastCompletedAction: 'Escalated', lastActionAt: todayIso() })} className="action-btn">Escalate</button>
          <button onClick={() => { if (window.confirm('Delete this follow-up? This cannot be undone.')) deleteItem(item.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      </div>

      <div className="followup-detail-body">
        <div className="detail-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked workflow card</div>
          <div className="mt-2 text-sm text-slate-700">Parent state: <span className="font-semibold text-slate-900">{item.status}</span></div>
          <div className="mt-1 text-sm text-slate-700">Child tasks: {linkedTasks.length} · Blocked: {blockedLinkedTasks} · Complete: {doneLinkedTasks}</div>
          <div className="mt-2 rounded-xl bg-slate-100 p-2 text-xs text-slate-700">{linkedTasks.length > 0 && linkedTasks.every((task) => task.status === 'Done') ? 'All linked tasks complete. Close this follow-up or set a new waiting-on date.' : 'Keep linked tasks moving, then close out this follow-up.'}</div>
        </div>
        <div className="detail-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</div>
          <textarea value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} className="field-textarea mt-2" placeholder="Enter the next move here" />
          <div className="mt-3 flex justify-end"><button onClick={() => updateItem(item.id, { nextAction: nextActionDraft })} className="action-btn"><Save className="h-4 w-4" />Save next action</button></div>
        </div>

        <div className="detail-card detail-facts-grid">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</div><div className="mt-1 text-sm text-slate-900">{item.project}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</div><div className="mt-1 text-sm text-slate-900">{item.owner}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignee</div><div className="mt-1 text-sm text-slate-900">{item.assigneeDisplayName || item.owner}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</div><div className="mt-1 text-sm text-slate-900">{formatDate(item.dueDate)}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next touch</div><div className="mt-1 text-sm text-slate-900">{formatDate(item.nextTouchDate)}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div><div className="mt-1 text-sm text-slate-900">{contact?.name ?? '—'}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</div><div className="mt-1 text-sm text-slate-900">{company?.name ?? '—'}</div></div>
        </div>
        <div className="detail-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment workflow</div>
          <div className="mt-2 flex gap-2">
            <input value={assigneeDraft} onChange={(event) => setAssigneeDraft(event.target.value)} className="field-input" placeholder="Reassign to teammate" />
            <button onClick={() => updateItem(item.id, { assigneeDisplayName: assigneeDraft.trim() || 'Unassigned' })} className="action-btn">Quick reassign</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => updateItem(item.id, { assigneeDisplayName: 'Current user', assigneeUserId: 'user-current' })} className="action-btn">Claim</button>
            <button onClick={() => updateItem(item.id, { assigneeDisplayName: 'Unassigned', assigneeUserId: undefined })} className="action-btn">Unclaim</button>
          </div>
        </div>

        <div className="detail-card">
          <div className="text-sm font-semibold text-slate-900">Running notes</div>
          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="field-textarea mt-3" placeholder="Type a note, update, or phone call summary…" />
          <div className="mt-3 flex justify-end"><button onClick={() => { if (!noteDraft.trim()) return; addRunningNote(item.id, noteDraft); setNoteDraft(''); }} className="action-btn">Add note</button></div>
          <div className="mt-4 space-y-3">
            {noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-medium text-slate-500">{formatDateTime(entry.at)}</div><div className="mt-1 note-pre-wrap text-sm text-slate-700">{entry.text}</div></div>)}
          </div>
        </div>

        <div className="detail-card">
          <div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Recent activity</div></div><button onClick={() => setShowActivity((value) => !value)} className="action-btn">{showActivity ? 'Show fewer' : 'Show more'}</button></div>
          <div className="timeline-list mt-3">{activityEntries.map((entry) => <div key={entry.id} className="timeline-row"><div className="timeline-dot" /><div><div className="text-sm font-medium text-slate-900">{entry.summary}</div><div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div></div></div>)}</div>
        </div>
      </div>
    </aside>
  );
}
