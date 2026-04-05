import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileEdit, Link2, Save, Send, SquareCheckBig, Trash2, Unlink2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, createId, escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { AppBadge, AppShellCard, SegmentedControl } from './ui/AppPrimitives';
import { FollowUpActionModal } from './actions/FollowUpActionModal';
import type { FollowUpActionFeedback, FollowUpActionType } from './actions/followUpActionTypes';
import { getLinkedTasksForFollowUp, getRelatedRecordBundle } from '../lib/recordContext';
import { CloseoutReadinessCard } from './CloseoutReadinessCard';
import { useFollowUpLaneContext } from '../domains/followups';

type DetailTab = 'overview' | 'act' | 'details';

export function ItemDetailPanel({ personalMode = false }: { personalMode?: boolean }) {
  const {
    items,
    tasks,
    projects,
    contacts,
    companies,
    updateItem,
    deleteItem,
    openEditModal,
    addRunningNote,
    addTask,
    addTouchLog,
    openDraftModal,
    updateTask,
    setSelectedTaskId,
    openRecordDrawer,
    attemptFollowUpTransition,
    isRecordDirty,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    openEditModal: s.openEditModal,
    addRunningNote: s.addRunningNote,
    addTask: s.addTask,
    addTouchLog: s.addTouchLog,
    openDraftModal: s.openDraftModal,
    updateTask: s.updateTask,
    setSelectedTaskId: s.setSelectedTaskId,
    openRecordDrawer: s.openRecordDrawer,
    attemptFollowUpTransition: s.attemptFollowUpTransition,
    isRecordDirty: s.isRecordDirty,
  })));
  const laneContext = useFollowUpLaneContext();
  const item = laneContext.selectedItem;

  const [noteDraft, setNoteDraft] = useState('');
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [activeAction, setActiveAction] = useState<FollowUpActionType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FollowUpActionFeedback | null>(null);
  const [linkTaskIdDraft, setLinkTaskIdDraft] = useState('');

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 8) : []), [item, showActivity]);

  useEffect(() => {
    setNextActionDraft(item?.nextAction ?? '');
    setAssigneeDraft(item?.assigneeDisplayName ?? item?.owner ?? '');
    setActiveTab('overview');
    setActiveAction(null);
    setActionFeedback(null);
    setLinkTaskIdDraft('');
  }, [item?.assigneeDisplayName, item?.id, item?.nextAction, item?.owner]);

  if (!item) {
    return <AppShellCard className="tracker-detail-panel p-5 premium-inspector" surface="inspector"><div className="text-lg font-semibold text-slate-950">Focus panel</div><p className="mt-2 text-sm text-slate-500">Select a follow-up to review details and run actions.</p></AppShellCard>;
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);
  const linkedTasks = getLinkedTasksForFollowUp(item.id, tasks);
  const relatedBundle = getRelatedRecordBundle({ type: 'followup', id: item.id }, { items, tasks, projects, contacts, companies });
  const closeout = laneContext.closeoutEvaluation;
  const followUpDirty = isRecordDirty('followup', item.id);
  const unlinkedSiblingTasks = tasks.filter((task) => !task.linkedFollowUpId && task.project === item.project);

  const linkTaskToFollowUp = () => {
    if (!linkTaskIdDraft) return;
    updateTask(linkTaskIdDraft, { linkedFollowUpId: item.id, contextNote: `Linked from follow-up ${item.title}` });
    setActionFeedback({ tone: 'success', message: 'Linked task added. Queue and closeout readiness were refreshed.' });
    setLinkTaskIdDraft('');
  };

  return (
    <AppShellCard className="tracker-detail-panel p-5 premium-inspector" surface="inspector">
      <div className="followup-detail-head">
        <div>
          <div className="inspector-kicker">Selected follow-up</div>
          <div className="inspector-title">{item.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusTone(item.status)}>{item.status}</Badge>
            <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
            <Badge variant={escalationTone(item.escalationLevel)}>{item.escalationLevel}</Badge>
            {followUpDirty ? <Badge variant="warn">Unsaved local edits</Badge> : null}
          </div>
        </div>
        <button onClick={() => openEditModal(item.id)} className="action-btn"><FileEdit className="h-4 w-4" />Edit</button>
      </div>

      <div className="followup-operational-summary">
        {laneContext.attentionSignal ? <AppBadge tone={laneContext.attentionSignal.tone === 'default' ? 'info' : laneContext.attentionSignal.tone}>{laneContext.attentionSignal.label}</AppBadge> : null}
        {laneContext.hasDuplicateAttention ? <AppBadge tone="warn">Possible duplicates</AppBadge> : null}
        {laneContext.linkedTaskSummary ? <AppBadge tone={laneContext.linkedTaskSummary.blocked > 0 ? 'danger' : 'info'}>Linked work {laneContext.linkedTaskSummary.open}/{laneContext.linkedTaskSummary.total}</AppBadge> : null}
      </div>

      <div className="detail-card inspector-block mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs attention</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{laneContext.attentionSignal?.helperText ?? 'No active blockers.'}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Next move</div>
        <div className="mt-1 flex items-center gap-2">
          <AppBadge tone={laneContext.nextMove?.tone === 'default' ? 'info' : (laneContext.nextMove?.tone ?? 'info')}>{laneContext.nextMove?.label ?? 'Set next move'}</AppBadge>
        </div>
        <div className="mt-1 text-sm text-slate-700">{laneContext.nextMove?.reason ?? 'Capture the next move and keep cadence tight.'}</div>
      </div>

      {actionFeedback ? <div className={`mb-3 rounded-xl border p-2 text-xs ${actionFeedback.tone === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : actionFeedback.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{actionFeedback.message}</div> : null}
      {laneContext.workflowWarnings.length ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{laneContext.workflowWarnings.map((warning) => <div key={warning}>{warning}</div>)}</div> : null}

      <div className="mt-4">
        <SegmentedControl
          value={activeTab}
          onChange={(value) => setActiveTab(value as DetailTab)}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'act', label: 'Act' },
            { value: 'details', label: `Details (${noteEntries.length} notes)` },
          ]}
        />
      </div>

      <div className="followup-detail-body">
        {activeTab === 'overview' ? (
          <>
            <div className="detail-card detail-summary-grid inspector-block">
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner / assignee</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.owner} · {item.assigneeDisplayName || item.owner}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due / next touch</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(item.dueDate)} · {formatDate(item.nextTouchDate)}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact / company</div><div className="mt-1 text-sm font-semibold text-slate-900">{contact?.name ?? '—'} · {company?.name ?? '—'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.nextAction || 'No next action set'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked work</div><div className="mt-1 text-sm font-semibold text-slate-900">{laneContext.linkedTaskSummary?.summaryLabel ?? 'No linked work yet'}</div></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record depth</div><div className="mt-1 text-sm font-semibold text-slate-900">{noteEntries.length} notes · {item.timeline.length} events · {relatedBundle.counts.relationships} related</div></div>
            </div>
            {closeout ? (
              <div className="detail-card inspector-block">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closeout readiness</div>
                <div className="mt-2">
                  <CloseoutReadinessCard
                    evaluation={closeout}
                    onAddCompletionNote={() => setActiveAction('close')}
                    onOpenTask={(taskId) => { setSelectedTaskId(taskId); openRecordDrawer({ type: 'task', id: taskId }); }}
                    onReviewLinkedRecords={() => openRecordDrawer({ type: 'followup', id: item.id })}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === 'act' ? (
          <>
            <div className="detail-card inspector-block">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-through actions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => { openDraftModal(item.id); setActionFeedback({ tone: 'success', message: 'Draft flow opened. Keep queue selection on this record to complete send/confirm.' }); }} className="action-btn"><Send className="h-4 w-4" />Draft follow-up</button>
                <button onClick={() => { const nextTouchDate = addDaysIso(todayIso(), item.cadenceDays || 3); addTouchLog({ id: item.id, summary: 'Logged touch from quick action.', status: 'Waiting on external', nextTouchDate }); setActionFeedback({ tone: 'success', message: `Touch logged. Next touch moved to ${formatDate(nextTouchDate)}.` }); }} className="action-btn">Log touch</button>
                <button onClick={() => { addTask({ id: createId('TSK'), title: `Task: ${item.title}`, project: item.project, projectId: item.projectId, owner: item.owner, status: 'To do', priority: item.priority, dueDate: item.nextTouchDate || item.dueDate, startDate: todayIso(), summary: item.summary, nextStep: item.nextAction || 'Complete next step.', notes: '', tags: ['From follow-up'], linkedFollowUpId: item.id, contextNote: `Supports follow-up: ${item.title}`, completionImpact: 'advance_parent', contactId: item.contactId, companyId: item.companyId, createdAt: todayIso(), updatedAt: todayIso(), lastCompletedAction: 'Delegated as task', lastActionAt: todayIso() }); setActionFeedback({ tone: 'success', message: 'Linked task created. Linked-work rollup and closeout state updated.' }); }} className="action-btn"><SquareCheckBig className="h-4 w-4" />Create linked task</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setActiveAction('waiting_on_response')} className="action-btn">Waiting on response</button>
                <button onClick={() => setActiveAction('snooze')} className="action-btn">Snooze</button>
                <button onClick={() => setActiveAction('escalate')} className="action-btn">Escalate</button>
                <button onClick={() => setActiveAction('close')} className="action-btn"><CheckCircle2 className="h-4 w-4" />Close</button>
              </div>
            </div>
            <div className="detail-card inspector-block">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution steering</div>
              <div className="mt-2 grid gap-2">
                <textarea value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} className="field-textarea" placeholder="Set the next move" />
                <div className="flex gap-2">
                  <input value={assigneeDraft} onChange={(event) => setAssigneeDraft(event.target.value)} className="field-input" placeholder="Owner / assignee" />
                  <button
                    onClick={() => {
                      updateItem(item.id, {
                        nextAction: nextActionDraft,
                        assigneeDisplayName: assigneeDraft.trim() || 'Unassigned',
                      });
                      setActionFeedback({ tone: 'success', message: 'Execution update saved.' });
                    }}
                    className="action-btn"
                  >
                    <Save className="h-4 w-4" />Save execution update
                  </button>
                </div>
              </div>
              {!personalMode ? <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => updateItem(item.id, { assigneeDisplayName: 'Current user', assigneeUserId: 'user-current' })} className="action-btn">Claim</button><button onClick={() => updateItem(item.id, { assigneeDisplayName: 'Unassigned', assigneeUserId: undefined })} className="action-btn">Unclaim</button></div> : null}
            </div>
          </>
        ) : null}

        {activeTab === 'details' ? (
          <>
            <div className="detail-card inspector-block">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Notes</div>
                <div className="text-xs text-slate-500">{noteEntries.length} entries</div>
              </div>
              <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="field-textarea mt-3" placeholder="Type a note, update, or phone call summary…" />
              <div className="mt-3 flex justify-end"><button onClick={() => { if (!noteDraft.trim()) return; addRunningNote(item.id, noteDraft); setNoteDraft(''); setActionFeedback({ tone: 'success', message: 'Note saved to selected follow-up history.' }); }} className="action-btn">Add note</button></div>
              <div className="mt-4 space-y-3">
                {noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-medium text-slate-500">{formatDateTime(entry.at)}</div><div className="mt-1 note-pre-wrap text-sm text-slate-700">{entry.text}</div></div>)}
              </div>
            </div>

            <div className="detail-card inspector-block">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked-task management</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="action-btn" onClick={() => openRecordDrawer({ type: 'followup', id: item.id })}><Link2 className="h-4 w-4" />Open record drawer</button>
                <select value={linkTaskIdDraft} onChange={(event) => setLinkTaskIdDraft(event.target.value)} className="field-input !w-auto">
                  <option value="">Link existing task…</option>
                  {unlinkedSiblingTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </select>
                <button className="action-btn" onClick={linkTaskToFollowUp} disabled={!linkTaskIdDraft}>Link task</button>
                <button onClick={() => setActiveAction('delete')} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
              </div>
              <div className="mt-2 space-y-2">
                {linkedTasks.length === 0 ? <div className="text-sm text-slate-500">No linked tasks yet. Create one from Act.</div> : linkedTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 list-row-family">
                    <div><div className="text-sm font-medium text-slate-900">{task.title}</div><div className="text-xs text-slate-500">{task.status} · Due {formatDate(task.dueDate)}</div></div>
                    <div className="flex gap-2">
                      <button className="action-btn" onClick={() => { setSelectedTaskId(task.id); openRecordDrawer({ type: 'task', id: task.id }); }}>Open child</button>
                      <button className="action-btn" onClick={() => { updateTask(task.id, { linkedFollowUpId: undefined, contextNote: 'Unlinked from follow-up parent' }); setActionFeedback({ tone: 'warn', message: 'Task unlinked from selected follow-up.' }); }}><Unlink2 className="h-4 w-4" />Unlink</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-card inspector-block">
              <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-slate-900">Activity history</div><button onClick={() => setShowActivity((value) => !value)} className="action-btn">{showActivity ? 'Show less' : 'Show more'}</button></div>
              <div className="timeline-list mt-3">{activityEntries.map((entry) => <div key={entry.id} className="timeline-row"><div className="timeline-dot" /><div><div className="text-sm font-medium text-slate-900">{entry.summary}</div><div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div></div></div>)}</div>
            </div>
          </>
        ) : null}
      </div>
      <FollowUpActionModal
        item={item}
        action={activeAction}
        onClose={() => setActiveAction(null)}
        followUpActions={{ attemptFollowUpTransition, deleteItem, updateItem }}
        onCommitted={(feedback) => {
          setActionFeedback(feedback);
          setActiveTab('overview');
        }}
      />
    </AppShellCard>
  );
}
