import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileEdit, Link2, Send, SquareCheckBig } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, createId, escalationTone, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { AppBadge, AppShellCard } from './ui/AppPrimitives';
import { FollowUpActionModal } from './actions/FollowUpActionModal';
import type { FollowUpActionFeedback, FollowUpActionType } from './actions/followUpActionTypes';
import { getLinkedTasksForFollowUp, getRelatedRecordBundle } from '../lib/recordContext';
import { CloseoutReadinessCard } from './CloseoutReadinessCard';
import { useFollowUpLaneContext } from '../domains/followups';
import { editSurfaceCtas, editSurfacePolicy } from '../lib/editSurfacePolicy';
import { selectFollowUpRows } from '../lib/followUpSelectors';
import { deriveFollowUpRecommendedAction } from '../domains/shared';
import { getExecutionLaneNextSelection } from '../domains/shared/executionLane/helpers';

export function ItemDetailPanel({ personalMode = false }: { personalMode?: boolean }) {
  const {
    items,
    tasks,
    projects,
    contacts,
    companies,
    updateItem,
    deleteItem,
    openRecordEditor,
    addTask,
    addTouchLog,
    openDraftModal,
    setSelectedTaskId,
    openRecordDrawer,
    attemptFollowUpTransition,
    isRecordDirty,
    search,
    activeView,
    followUpFilters,
    selectedId,
    setSelectedId,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    openRecordEditor: s.openRecordEditor,
    addTask: s.addTask,
    addTouchLog: s.addTouchLog,
    openDraftModal: s.openDraftModal,
    setSelectedTaskId: s.setSelectedTaskId,
    openRecordDrawer: s.openRecordDrawer,
    attemptFollowUpTransition: s.attemptFollowUpTransition,
    isRecordDirty: s.isRecordDirty,
    search: s.search,
    activeView: s.activeView,
    followUpFilters: s.followUpFilters,
    selectedId: s.selectedId,
    setSelectedId: s.setSelectedId,
  })));
  const laneContext = useFollowUpLaneContext();
  const item = laneContext.selectedItem;

  const [showActivity, setShowActivity] = useState(false);
  const [activeAction, setActiveAction] = useState<FollowUpActionType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FollowUpActionFeedback | null>(null);

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline.slice(0, showActivity ? 50 : 3) : []), [item, showActivity]);
  const visibleQueueIds = useMemo(
    () => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }).map((entry) => entry.id),
    [items, contacts, companies, search, activeView, followUpFilters],
  );

  const recommendedAction = useMemo(() => {
    if (!item) return null;
    return deriveFollowUpRecommendedAction(item, {
      nextMove: laneContext.nextMove,
      attentionSignal: laneContext.attentionSignal,
      closeoutReady: laneContext.closeoutEvaluation?.readiness === 'ready_to_close',
      hasDuplicateAttention: laneContext.hasDuplicateAttention,
      linkedBlocked: Boolean(laneContext.linkedTaskSummary?.blocked),
    });
  }, [item, laneContext.nextMove, laneContext.attentionSignal, laneContext.closeoutEvaluation?.readiness, laneContext.hasDuplicateAttention, laneContext.linkedTaskSummary?.blocked]);

  useEffect(() => {
    setActiveAction(null);
    setActionFeedback(null);
  }, [item?.assigneeDisplayName, item?.id, item?.nextAction, item?.nextTouchDate, item?.owner]);

  if (!item) {
    return <AppShellCard className="tracker-detail-panel p-5 premium-inspector" surface="inspector"><div className="text-lg font-semibold text-slate-950">Command surface</div><p className="mt-2 text-sm text-slate-500">Select a follow-up to see what matters, take one action, and continue.</p></AppShellCard>;
  }

  const runRecommendedAction = () => {
    if (!recommendedAction) return;
    if (recommendedAction.id === 'draft') {
      openDraftModal(item.id);
      setActionFeedback({ tone: 'success', message: 'Draft flow opened.' });
      return;
    }
    if (recommendedAction.id === 'log_touch') {
      const nextTouchDate = addDaysIso(todayIso(), item.cadenceDays || 3);
      addTouchLog({ id: item.id, summary: 'Logged touch from recommended action.', status: 'Waiting on external', nextTouchDate });
      setActionFeedback({ tone: 'success', message: `Touch logged. Next touch ${formatDate(nextTouchDate)}.` });
      return;
    }
    if (recommendedAction.id === 'waiting_on_response') return setActiveAction('waiting_on_response');
    if (recommendedAction.id === 'snooze') return setActiveAction('snooze');
    if (recommendedAction.id === 'escalate') {
      updateItem(item.id, { escalationLevel: item.escalationLevel === 'Critical' ? 'Critical' : 'Escalate', status: 'At risk' });
      setActionFeedback({ tone: 'warn', message: 'Escalation applied.' });
      return;
    }
    if (recommendedAction.id === 'close') return setActiveAction('close');
  };

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);
  const linkedTasks = getLinkedTasksForFollowUp(item.id, tasks);
  const relatedBundle = getRelatedRecordBundle({ type: 'followup', id: item.id }, { items, tasks, projects, contacts, companies });
  const closeout = laneContext.closeoutEvaluation;
  const followUpDirty = isRecordDirty('followup', item.id);

  return (
    <AppShellCard className="tracker-detail-panel p-4 premium-inspector" surface="inspector">
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
        <button onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')} className="action-btn"><FileEdit className="h-4 w-4" />{editSurfaceCtas.fullEditFollowUp}</button>
      </div>

      <div className="followup-operational-summary">
        {laneContext.attentionSignal ? <AppBadge tone={laneContext.attentionSignal.tone === 'default' ? 'info' : laneContext.attentionSignal.tone}>{laneContext.attentionSignal.label}</AppBadge> : null}
        {laneContext.linkedTaskSummary ? <AppBadge tone={laneContext.linkedTaskSummary.blocked > 0 ? 'danger' : 'info'}>Linked work {laneContext.linkedTaskSummary.open}/{laneContext.linkedTaskSummary.total}</AppBadge> : null}
        <AppBadge tone="info">{editSurfacePolicy.context.intent}</AppBadge>
      </div>

      <div className="detail-card inspector-block mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this matters now</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{laneContext.attentionSignal?.helperText ?? 'No active blockers.'}</div>
        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended next move</div>
        <div className="mt-1 flex items-center gap-2">
          <AppBadge tone={recommendedAction?.tone === 'default' ? 'info' : (recommendedAction?.tone ?? 'info')}>{recommendedAction?.label ?? laneContext.nextMove?.label ?? 'Update next move'}</AppBadge>
        </div>
        <div className="mt-1 text-sm text-slate-700">{recommendedAction?.reason ?? laneContext.nextMove?.reason ?? 'Move this record forward with one clear action.'}</div>
      </div>

      {actionFeedback ? <div className={`mb-3 rounded-xl border p-2 text-xs ${actionFeedback.tone === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : actionFeedback.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{actionFeedback.message}</div> : null}
      {laneContext.workflowWarnings.length ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{laneContext.workflowWarnings.slice(0, 2).map((warning) => <div key={warning}>{warning}</div>)}</div> : null}

      <div className="detail-card inspector-block">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Take action now</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={runRecommendedAction} className="primary-btn">{recommendedAction?.label ?? 'Update next move'}</button>
          <button onClick={() => { openDraftModal(item.id); setActionFeedback({ tone: 'success', message: 'Draft flow opened.' }); }} className="action-btn"><Send className="h-4 w-4" />Draft</button>
          <button onClick={() => { const nextTouchDate = addDaysIso(todayIso(), item.cadenceDays || 3); addTouchLog({ id: item.id, summary: 'Logged touch from quick action.', status: 'Waiting on external', nextTouchDate }); setActionFeedback({ tone: 'success', message: `Touch logged. Next touch ${formatDate(nextTouchDate)}.` }); }} className="action-btn">Log touch</button>
          <button onClick={() => setActiveAction('waiting_on_response')} className="action-btn">Waiting</button>
          <button onClick={() => setActiveAction('snooze')} className="action-btn">Snooze</button>
          <button onClick={() => setActiveAction('escalate')} className="action-btn">Escalate</button>
          <button onClick={() => setActiveAction('close')} className="action-btn"><CheckCircle2 className="h-4 w-4" />Close</button>
          <button onClick={() => { addTask({ id: createId('TSK'), title: `Task: ${item.title}`, project: item.project, projectId: item.projectId, owner: item.owner, status: 'To do', priority: item.priority, dueDate: item.nextTouchDate || item.dueDate, startDate: todayIso(), summary: item.summary, nextStep: item.nextAction || 'Complete next step.', notes: '', tags: ['From follow-up'], linkedFollowUpId: item.id, contextNote: `Supports follow-up: ${item.title}`, completionImpact: 'advance_parent', contactId: item.contactId, companyId: item.companyId, createdAt: todayIso(), updatedAt: todayIso(), lastCompletedAction: 'Delegated as task', lastActionAt: todayIso() }); setActionFeedback({ tone: 'success', message: 'Linked task created.' }); }} className="action-btn"><SquareCheckBig className="h-4 w-4" />Create task</button>
        </div>
      </div>

      <div className="detail-card inspector-block mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full edit</div>
        <p className="mt-2 text-sm text-slate-600">Deep editing now happens in the full editor window so fields stay structured and reachable.</p>
        <button className="action-btn mt-2" onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')}><FileEdit className="h-4 w-4" />Open full edit window</button>
      </div>

      <details className="detail-card inspector-block mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Supporting context</summary>
        <div className="mt-3 space-y-3">
          <div className="text-sm text-slate-700">{contact?.name ?? '—'} · {company?.name ?? '—'} · Due {formatDate(item.dueDate)} · Next touch {formatDate(item.nextTouchDate)}</div>
          {closeout ? (
            <CloseoutReadinessCard
              evaluation={closeout}
              onAddCompletionNote={() => setActiveAction('close')}
              onOpenTask={(taskId) => { setSelectedTaskId(taskId); openRecordDrawer({ type: 'task', id: taskId }); }}
              onReviewLinkedRecords={() => openRecordDrawer({ type: 'followup', id: item.id })}
            />
          ) : null}
          <div className="text-xs text-slate-600">{noteEntries.length} notes · {item.timeline.length} events · {relatedBundle.counts.relationships} related records</div>
        </div>
      </details>

      <details className="detail-card inspector-block mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Notes & recent history</summary>
        <div className="mt-2 space-y-2">
          {activityEntries.length ? activityEntries.map((entry) => <div key={entry.id} className="timeline-row"><div className="timeline-dot" /><div><div className="text-sm font-medium text-slate-900">{entry.summary}</div><div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div></div></div>) : <div className="text-xs text-slate-500">No recent activity.</div>}
          {item.timeline.length > activityEntries.length ? <button onClick={() => setShowActivity((value) => !value)} className="action-btn">{showActivity ? 'Show less' : 'Show more'}</button> : null}
        </div>
      </details>

      <details className="detail-card inspector-block mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Maintenance & deep edit</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="action-btn" onClick={() => openRecordDrawer({ type: 'followup', id: item.id })}><Link2 className="h-4 w-4" />{editSurfaceCtas.openContext}</button>
          <button className="action-btn" onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')}><FileEdit className="h-4 w-4" />{editSurfaceCtas.fullEditFollowUp}</button>
        </div>
        {linkedTasks.length ? <div className="mt-3 space-y-2">{linkedTasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 list-row-family"><div><div className="text-sm font-medium text-slate-900">{task.title}</div><div className="text-xs text-slate-500">{task.status} · Due {formatDate(task.dueDate)}</div></div><button className="action-btn" onClick={() => { setSelectedTaskId(task.id); openRecordDrawer({ type: 'task', id: task.id }); }}>Open child</button></div>)}</div> : null}
      </details>

      <FollowUpActionModal
        item={item}
        action={activeAction}
        onClose={() => setActiveAction(null)}
        followUpActions={{ attemptFollowUpTransition, deleteItem, updateItem }}
        onCommitted={(feedback) => {
          const committedAction = activeAction;
          setActionFeedback(feedback);
          setActiveAction(null);
          const removedIds = committedAction === 'close' || committedAction === 'delete' ? [item.id] : [];
          const progression = getExecutionLaneNextSelection(visibleQueueIds.filter((id) => !removedIds.includes(id)), selectedId, removedIds);
          if (progression.nextSelectedId && progression.nextSelectedId !== selectedId) {
            setSelectedId(progression.nextSelectedId);
          }
        }}
      />
    </AppShellCard>
  );
}
