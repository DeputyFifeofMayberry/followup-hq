import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, FileEdit, MoreHorizontal, Save, Send, SquareCheckBig, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, applyLifecycleBundle, createId, escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { SegmentedControl } from './ui/AppPrimitives';

type DetailTab = 'overview' | 'actions' | 'notes' | 'activity';

export function ItemDetailPanel({ personalMode = false }: { personalMode?: boolean }) {
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
    openEditTaskModal,
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
    openEditTaskModal: s.openEditTaskModal,
  })));

  const item = items.find((entry) => entry.id === selectedId) ?? null;
  const [noteDraft, setNoteDraft] = useState('');
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 6) : []), [item, showActivity]);

  useEffect(() => {
    setNextActionDraft(item?.nextAction ?? '');
    setAssigneeDraft(item?.assigneeDisplayName ?? item?.owner ?? '');
    setActiveTab('overview');
  }, [item?.id, item?.nextAction]);

  if (!item) {
    return <aside className="tracker-detail-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-lg font-semibold text-slate-950">Focus panel</div><p className="mt-2 text-sm text-slate-500">Select a follow-up to run action bundles and close the loop.</p></aside>;
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);
  const linkedTasks = tasks.filter((task) => task.linkedFollowUpId === item.id);
  const doneLinkedTasks = item.doneLinkedTaskCount ?? linkedTasks.filter((task) => task.status === 'Done').length;
  const blockedLinkedTasks = item.blockedLinkedTaskCount ?? linkedTasks.filter((task) => task.status === 'Blocked').length;
  const overdueLinkedTasks = item.overdueLinkedTaskCount ?? linkedTasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate).getTime() < Date.now()).length;
  const openLinkedTasks = item.openLinkedTaskCount ?? linkedTasks.filter((task) => task.status !== 'Done').length;

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

      <div className="detail-primary-actions mt-4">
        <button onClick={() => openDraftModal(item.id)} className="action-btn"><Send className="h-4 w-4" />Draft follow-up</button>
        <button onClick={() => addTouchLog({ id: item.id, summary: 'Logged touch from quick action.', status: 'Waiting on external', nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3) })} className="action-btn">Log touch</button>
        <button onClick={() => addTask({ id: createId('TSK'), title: `Task: ${item.title}`, project: item.project, projectId: item.projectId, owner: item.owner, status: 'To do', priority: item.priority, dueDate: item.nextTouchDate || item.dueDate, startDate: todayIso(), summary: item.summary, nextStep: item.nextAction || 'Complete next step.', notes: '', tags: ['From follow-up'], linkedFollowUpId: item.id, contextNote: `Supports follow-up: ${item.title}`, completionImpact: 'advance_parent', contactId: item.contactId, companyId: item.companyId, createdAt: todayIso(), updatedAt: todayIso(), lastCompletedAction: 'Delegated as task', lastActionAt: todayIso() })} className="action-btn"><SquareCheckBig className="h-4 w-4" />Linked task</button>
        <button onClick={() => { const openLinked = linkedTasks.filter((task) => task.status !== 'Done').length; if (openLinked > 0 && !window.confirm(`There are ${openLinked} open linked tasks. Close follow-up anyway?`)) return; updateItem(item.id, applyLifecycleBundle(item, 'resolve_and_close')); }} className="action-btn"><CheckCircle2 className="h-4 w-4" />Close</button>
        <details className="detail-overflow-actions">
          <summary className="action-btn"><MoreHorizontal className="h-4 w-4" />More <ChevronDown className="h-4 w-4" /></summary>
          <div className="detail-overflow-menu">
            <button onClick={() => updateItem(item.id, { ...applyLifecycleBundle(item, 'waiting_on_response'), waitingOn: item.waitingOn || item.owner })} className="action-btn">Waiting on response</button>
            <button onClick={() => updateItem(item.id, { nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3), lastCompletedAction: 'Snoozed', lastActionAt: todayIso() })} className="action-btn">Snooze</button>
            <button onClick={() => updateItem(item.id, applyLifecycleBundle(item, 'escalate'))} className="action-btn">Escalate</button>
            <button onClick={() => { if (window.confirm('Delete this follow-up? This cannot be undone.')) deleteItem(item.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
          </div>
        </details>
      </div>

      <div className="mt-4">
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'actions', label: 'Actions' },
            { value: 'notes', label: `Notes (${noteEntries.length})` },
            { value: 'activity', label: 'Activity' },
          ]}
        />
      </div>

      <div className="followup-detail-body">
        {activeTab === 'overview' ? (
          <>
            <div className="detail-card inspector-card detail-summary-grid">
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.status}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(item.dueDate)}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.nextAction || 'No next action set'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ownership</div><div className="mt-1 text-sm font-semibold text-slate-900">Owner: {item.owner}</div><div className="text-sm text-slate-700">Assignee: {item.assigneeDisplayName || item.owner}</div><div className="text-sm text-slate-700">External: {contact?.name ?? '—'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow state</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.linkedTaskCount ?? linkedTasks.length} linked · {openLinkedTasks} open · {blockedLinkedTasks} blocked · {overdueLinkedTasks} overdue · {doneLinkedTasks} done</div><div className="mt-1 text-xs text-slate-500">{item.allLinkedTasksDone ? 'Ready to close or advance.' : blockedLinkedTasks > 0 ? 'Blocked child pressure on parent.' : 'Execution in progress.'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next touch</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(item.nextTouchDate)}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action lifecycle</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.actionState || 'Draft created'}</div></div>
            </div>

            <div className="detail-card inspector-card detail-facts-grid">
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</div><div className="mt-1 text-sm text-slate-900">{item.project}</div></div>
              {!personalMode ? <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignee</div><div className="mt-1 text-sm text-slate-900">{item.assigneeDisplayName || item.owner}</div></div> : null}
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</div><div className="mt-1 text-sm text-slate-900">{company?.name ?? '—'}</div></div>
            </div>
            <div className="detail-card inspector-card">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked tasks</div>
              <div className="mt-2 space-y-2">
                {linkedTasks.length === 0 ? <div className="text-sm text-slate-500">No linked tasks yet.</div> : linkedTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2">
                    <div><div className="text-sm font-medium text-slate-900">{task.title}</div><div className="text-xs text-slate-500">{task.status} · Due {formatDate(task.dueDate)}</div></div>
                    <button className="action-btn" onClick={() => openEditTaskModal(task.id)}>Open task</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {activeTab === 'actions' ? (
          <>
            <div className="detail-card inspector-card">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update next action</div>
              <textarea value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} className="field-textarea mt-2" placeholder="Enter the next move here" />
              <div className="mt-3 flex justify-end"><button onClick={() => updateItem(item.id, { nextAction: nextActionDraft })} className="action-btn"><Save className="h-4 w-4" />Save next action</button></div>
            </div>
            {!personalMode ? (
              <div className="detail-card inspector-card">
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
            ) : null}
          </>
        ) : null}

        {activeTab === 'notes' ? (
          <div className="detail-card inspector-card">
            <div className="text-sm font-semibold text-slate-900">Running notes</div>
            <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="field-textarea mt-3" placeholder="Type a note, update, or phone call summary…" />
            <div className="mt-3 flex justify-end"><button onClick={() => { if (!noteDraft.trim()) return; addRunningNote(item.id, noteDraft); setNoteDraft(''); }} className="action-btn">Add note</button></div>
            <div className="mt-4 space-y-3">
              {noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-medium text-slate-500">{formatDateTime(entry.at)}</div><div className="mt-1 note-pre-wrap text-sm text-slate-700">{entry.text}</div></div>)}
            </div>
          </div>
        ) : null}

        {activeTab === 'activity' ? (
          <div className="detail-card inspector-card">
            <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">Recent activity</div><button onClick={() => setShowActivity((value) => !value)} className="action-btn">{showActivity ? 'Show fewer' : 'Show more'}</button></div>
            <div className="timeline-list mt-3">{activityEntries.map((entry) => <div key={entry.id} className="timeline-row"><div className="timeline-dot" /><div><div className="text-sm font-medium text-slate-900">{entry.summary}</div><div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div></div></div>)}</div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
