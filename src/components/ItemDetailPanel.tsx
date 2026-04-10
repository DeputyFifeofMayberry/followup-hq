import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileEdit, Link2, Send, Trash2, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { addDaysIso, formatDate, formatDateTime, parseRunningNotes, priorityTone, statusTone, todayIso } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { AppBadge, AppShellCard, SegmentedControl } from './ui/AppPrimitives';
import { FollowUpActionModal } from './actions/FollowUpActionModal';
import type { FollowUpActionFeedback, FollowUpActionType } from './actions/followUpActionTypes';
import { getLinkedTasksForFollowUp } from '../lib/recordContext';
import { useFollowUpLaneContext, useFollowUpsViewModel } from '../domains/followups';
import { editSurfaceCtas } from '../lib/editSurfacePolicy';
import { deriveFollowUpRecommendedAction } from '../domains/shared';
import { getExecutionLaneNextSelection } from '../domains/shared/executionLane/helpers';
import type { FollowUpItem, FollowUpStatus } from '../types';

// Quick one-click touch logging keyed to current status, eliminating the modal for the most common daily actions.
interface QuickTouchOption {
  label: string;
  summary: string;
  nextStatus?: FollowUpStatus;
}

function getQuickTouchOptions(status: FollowUpStatus): QuickTouchOption[] {
  switch (status) {
    case 'Waiting on external':
      return [
        { label: 'No reply yet', summary: 'No reply yet — holding.' },
        { label: 'Reply received', summary: 'Reply received.', nextStatus: 'In progress' },
        { label: 'Following up again', summary: 'Sent a follow-up nudge.' },
      ];
    case 'Waiting internal':
      return [
        { label: 'Still waiting', summary: 'Still waiting on internal response.' },
        { label: 'Internal response in', summary: 'Internal response received.', nextStatus: 'In progress' },
      ];
    case 'Needs action':
      return [
        { label: 'Drafted & sent', summary: 'Drafted and sent outbound.', nextStatus: 'Waiting on external' },
        { label: 'On it', summary: 'Actively working this.', nextStatus: 'In progress' },
        { label: 'Needs more info', summary: 'Awaiting more information before action.' },
      ];
    case 'In progress':
      return [
        { label: 'On track', summary: 'On track — continuing.' },
        { label: 'Sent update', summary: 'Sent a status update.', nextStatus: 'Waiting on external' },
        { label: 'Hit a snag', summary: 'Encountered a snag, monitoring.', nextStatus: 'At risk' },
      ];
    case 'At risk':
      return [
        { label: 'Escalated', summary: 'Escalated to team for resolution.' },
        { label: 'Risk contained', summary: 'Risk contained, back on track.', nextStatus: 'In progress' },
      ];
    default:
      return [{ label: 'Checked in', summary: 'Checked in — no update.' }];
  }
}

function QuickTouchBar({ item, addTouchLog, onFeedback }: {
  item: FollowUpItem;
  addTouchLog: (entry: { id: string; summary: string; status?: FollowUpStatus; nextTouchDate?: string }) => void;
  onFeedback: (feedback: FollowUpActionFeedback) => void;
}) {
  const options = getQuickTouchOptions(item.status);
  const logQuick = (option: QuickTouchOption) => {
    const nextTouchDate = addDaysIso(todayIso(), item.cadenceDays || 3);
    addTouchLog({ id: item.id, summary: option.summary, status: option.nextStatus, nextTouchDate });
    onFeedback({ tone: 'success', message: `${option.summary} Next touch ${formatDate(nextTouchDate)}.` });
  };
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
        <Zap className="h-3 w-3" />Quick log
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.label} onClick={() => logQuick(option)} className="action-btn">{option.label}</button>
        ))}
      </div>
    </div>
  );
}

export function ItemDetailPanel({ personalMode = false, inModal = false, onRequestClose }: { personalMode?: boolean; inModal?: boolean; onRequestClose?: () => void }) {
  const {
    tasks, contacts, companies, updateItem, deleteItem, openRecordEditor, addTouchLog,
    openRecordDrawer, attemptFollowUpTransition, isRecordDirty, selectedId, setSelectedId, openDraftModal,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks, contacts: s.contacts, companies: s.companies, updateItem: s.updateItem, deleteItem: s.deleteItem,
    openRecordEditor: s.openRecordEditor, addTouchLog: s.addTouchLog, openDraftModal: s.openDraftModal,
    openRecordDrawer: s.openRecordDrawer, attemptFollowUpTransition: s.attemptFollowUpTransition, isRecordDirty: s.isRecordDirty,
    selectedId: s.selectedId, setSelectedId: s.setSelectedId,
  })));
  const laneContext = useFollowUpLaneContext();
  const viewModel = useFollowUpsViewModel();
  const item = laneContext.selectedItem;

  const [detailView, setDetailView] = useState<'focus' | 'context'>('focus');
  const [activeAction, setActiveAction] = useState<FollowUpActionType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FollowUpActionFeedback | null>(null);

  const noteEntries = useMemo(() => (item ? parseRunningNotes(item.notes) : []), [item]);
  const activityEntries = useMemo(() => (item ? item.timeline : []), [item]);
  const progressMilestones = useMemo(() => {
    if (!item) return [];
    const createdEvent = item.timeline.find((entry) => entry.type === 'created')
      ?? item.timeline[item.timeline.length - 1];
    const openedAt = item.provenance?.capturedAt || createdEvent?.at;
    const closedEvent = item.status === 'Closed'
      ? item.timeline.find((entry) => entry.type === 'status_changed' && /closed/i.test(entry.summary))
      : null;
    return [
      openedAt ? `Opened ${formatDateTime(openedAt)}` : null,
      item.lastTouchDate ? `Last touch ${formatDate(item.lastTouchDate)}` : null,
      item.lastActionAt ? `Last action ${formatDateTime(item.lastActionAt)}` : null,
      closedEvent ? `Closed ${formatDateTime(closedEvent.at)}` : null,
    ].filter(Boolean) as string[];
  }, [item]);
  const visibleQueueIds = useMemo(() => viewModel.filteredRows.map((entry) => entry.id), [viewModel.filteredRows]);

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
  }, [item?.id]);

  if (!item) {
    return <AppShellCard className="tracker-detail-panel p-5 premium-inspector" surface="inspector"><div className="text-lg font-semibold text-slate-950">Inspector ready</div><p className="mt-2 text-sm text-slate-500">Select a follow-up to review context, log progress, and move the queue forward.</p></AppShellCard>;
  }

  const contact = contacts.find((entry) => entry.id === item.contactId);
  const company = companies.find((entry) => entry.id === item.companyId);
  const linkedTasks = getLinkedTasksForFollowUp(item.id, tasks);
  const followUpDirty = isRecordDirty('followup', item.id);

  const content = (
    <>
      <div className="followup-detail-head">
        <div>
          <div className="inspector-kicker">Follow-up record</div>
          <div className="inspector-title">{item.title}</div>
          <div className="mt-2 text-sm text-slate-600">{recommendedAction?.reason ?? laneContext.nextMove?.reason ?? 'Take the clearest next step and keep momentum.'}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge kind="status" variant={statusTone(item.status)} withDot>{item.status}</Badge>
            <Badge kind="priority" variant={priorityTone(item.priority)}>{item.priority}</Badge>
            <Badge kind="meta" variant="neutral">{item.project}</Badge>
            <Badge kind="meta" variant="neutral">{personalMode ? item.owner : (item.assigneeDisplayName || item.owner)}</Badge>
            {followUpDirty ? <Badge variant="warn">Unsaved local edits</Badge> : null}
            {laneContext.attentionSignal ? <AppBadge tone={laneContext.attentionSignal.tone === 'default' ? 'info' : laneContext.attentionSignal.tone}>{laneContext.attentionSignal.label}</AppBadge> : null}
          </div>
        </div>
        <button onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')} className="action-btn"><FileEdit className="h-4 w-4" />{editSurfaceCtas.fullEditFollowUp}</button>
      </div>

      <SegmentedControl
        value={detailView}
        onChange={setDetailView}
        ariaLabel="Selected follow-up sections"
        className="followup-view-segmented"
        options={[
          { value: 'focus', label: 'What to do now' },
          { value: 'context', label: 'Context' },
        ]}
      />

      {actionFeedback ? <div className={`mb-3 rounded-xl border p-2 text-xs ${actionFeedback.tone === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : actionFeedback.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{actionFeedback.message}</div> : null}

      {detailView === 'focus' ? <div className="detail-card inspector-block">
        <QuickTouchBar item={item} addTouchLog={addTouchLog} onFeedback={setActionFeedback} />
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">More actions</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => openDraftModal(item.id)} className="action-btn"><Send className="h-4 w-4" />Draft</button>
          <button onClick={() => setActiveAction('waiting_on_response')} className="action-btn">Waiting</button>
          <button onClick={() => setActiveAction('snooze')} className="action-btn">Snooze</button>
          <button onClick={() => setActiveAction('escalate')} className="action-btn">Escalate</button>
          <button onClick={() => setActiveAction('close')} className="action-btn"><CheckCircle2 className="h-4 w-4" />Close</button>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Next move</div>
          <div className="mt-1">{item.nextAction || 'No next move set yet.'}</div>
        </div>
      </div> : null}

      {detailView === 'context' ? <div className="space-y-3">
        <details className="detail-card inspector-block" open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Supporting context</summary>
          <div className="mt-2 text-sm text-slate-700">{item.project} • {personalMode ? item.owner : (item.assigneeDisplayName || item.owner)} • Due {formatDate(item.dueDate)} • Next touch {formatDate(item.nextTouchDate)}</div>
          <div className="mt-2 text-xs text-slate-500">{contact?.name || 'No contact'} • {company?.name || 'No company'}</div>
        </details>

        <details className="detail-card inspector-block" open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Progress history</summary>
          <div className="mt-2 space-y-2">
            {progressMilestones.length ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                {progressMilestones.join(' • ')}
              </div>
            ) : null}
            {activityEntries.length ? activityEntries.map((entry) => <div key={entry.id} className="timeline-row"><div className="timeline-dot" /><div><div className="text-sm font-medium text-slate-900">{entry.summary}</div><div className="text-xs text-slate-500">{entry.type} • {formatDateTime(entry.at)}</div></div></div>) : <div className="text-xs text-slate-500">No recent activity.</div>}
            <div className="text-xs text-slate-500">{noteEntries.length} notes • {linkedTasks.length} linked tasks</div>
          </div>
        </details>

        <details className="detail-card inspector-block">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Maintenance</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="action-btn" onClick={() => openRecordDrawer({ type: 'followup', id: item.id })}><Link2 className="h-4 w-4" />Open context drawer</button>
            <button className="action-btn" onClick={() => openRecordEditor({ type: 'followup', id: item.id }, 'edit', 'workspace')}><FileEdit className="h-4 w-4" />{editSurfaceCtas.fullEditFollowUp}</button>
            <button className="action-btn action-btn-danger" onClick={() => setActiveAction('delete')}><Trash2 className="h-4 w-4" />Delete</button>
            {inModal ? <button className="action-btn" onClick={onRequestClose}>Close panel</button> : null}
          </div>
        </details>
      </div> : null}

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
          if (progression.nextSelectedId && progression.nextSelectedId !== selectedId) setSelectedId(progression.nextSelectedId);
          if (committedAction === 'delete') onRequestClose?.();
        }}
      />
    </>
  );

  if (inModal) return <div className="space-y-3">{content}</div>;
  return <AppShellCard className="tracker-detail-panel p-4 premium-inspector" surface="inspector">{content}</AppShellCard>;
}
