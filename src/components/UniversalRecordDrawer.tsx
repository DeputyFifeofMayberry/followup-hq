import { ArrowRight, Link2, X } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatDateTime } from '../lib/utils';
import { buildFollowUpChildRollup } from '../lib/childWorkRollups';
import { getRelatedRecordBundle, type RecordDescriptor, type RecordType } from '../lib/recordContext';
import { useAppStore } from '../store/useAppStore';
import { EmptyState } from './ui/AppPrimitives';
import { evaluateFollowUpCloseout } from '../lib/closeoutReadiness';
import { CloseoutReadinessCard } from './CloseoutReadinessCard';
import { editSurfaceCtas, editSurfacePolicy } from '../lib/editSurfacePolicy';

const typeLabel: Record<RecordType, string> = {
  followup: 'Follow-up',
  task: 'Task',
  project: 'Project',
  contact: 'Contact',
  company: 'Company',
};

function summaryRows(record: RecordDescriptor) {
  return [
    { label: 'Status', value: record.status || '—' },
    { label: 'Priority', value: record.priority || '—' },
    { label: 'Owner', value: record.owner || '—' },
    { label: 'Project', value: record.projectName || '—' },
    { label: 'Due', value: record.dueDate ? formatDateTime(record.dueDate) : '—' },
    { label: 'Updated', value: record.updatedAt ? formatDateTime(record.updatedAt) : '—' },
  ];
}

export function UniversalRecordDrawer() {
  const { recordDrawerRef, closeRecordDrawer, openRecordDrawer, openEditModal, openEditTaskModal, items, tasks, projects, contacts, companies } = useAppStore(useShallow((s) => ({
    recordDrawerRef: s.recordDrawerRef,
    closeRecordDrawer: s.closeRecordDrawer,
    openRecordDrawer: s.openRecordDrawer,
    openEditModal: s.openEditModal,
    openEditTaskModal: s.openEditTaskModal,
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
  })));

  const bundle = useMemo(() => {
    if (!recordDrawerRef) return null;
    return getRelatedRecordBundle(recordDrawerRef, { items, tasks, projects, contacts, companies });
  }, [recordDrawerRef, items, tasks, projects, contacts, companies]);


  const childRollup = useMemo(() => {
    if (!recordDrawerRef || recordDrawerRef.type !== 'followup') return null;
    const item = items.find((entry) => entry.id === recordDrawerRef.id);
    if (!item) return null;
    return buildFollowUpChildRollup(item.id, item.status, tasks);
  }, [recordDrawerRef, items, tasks]);
  const closeout = useMemo(() => {
    if (!recordDrawerRef || recordDrawerRef.type !== 'followup') return null;
    const item = items.find((entry) => entry.id === recordDrawerRef.id);
    if (!item) return null;
    return evaluateFollowUpCloseout(item, tasks);
  }, [recordDrawerRef, items, tasks]);

  const parentFollowUp = useMemo(() => {
    if (!recordDrawerRef || recordDrawerRef.type !== 'task') return null;
    const task = tasks.find((entry) => entry.id === recordDrawerRef.id);
    if (!task?.linkedFollowUpId) return null;
    return items.find((entry) => entry.id === task.linkedFollowUpId) ?? null;
  }, [recordDrawerRef, tasks, items]);

  const timeline = useMemo(() => {
    if (!recordDrawerRef) return [] as Array<{ id: string; at: string; label: string }>;
    if (recordDrawerRef.type === 'followup') {
      const item = items.find((entry) => entry.id === recordDrawerRef.id);
      if (!item) return [];
      return [
        ...item.timeline.map((event) => ({ id: event.id, at: event.at, label: `[${event.type}] ${event.summary}` })),
        ...(item.auditHistory ?? []).map((event) => ({ id: event.id, at: event.at, label: `[${event.action}] ${event.summary}` })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }
    if (recordDrawerRef.type === 'task') {
      const task = tasks.find((entry) => entry.id === recordDrawerRef.id);
      if (!task) return [];
      return (task.auditHistory ?? []).map((event) => ({ id: event.id, at: event.at, label: `[${event.action}] ${event.summary}` }))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }
    const descriptor = bundle?.selected;
    return descriptor?.updatedAt ? [{ id: `${descriptor.id}-updated`, at: descriptor.updatedAt, label: 'Record updated' }] : [];
  }, [recordDrawerRef, bundle?.selected, items, tasks]);

  if (!recordDrawerRef) return null;

  return (
    <div className="record-drawer-backdrop" onClick={closeRecordDrawer} role="presentation">
      <aside className="record-drawer app-shell-card app-shell-card-inspector" onClick={(event) => event.stopPropagation()} aria-label="Universal record drawer">
        <div className="record-drawer-head">
          <div>
            <div className="inspector-kicker">Record context drawer</div>
            <div className="inspector-title">{bundle?.selected ? `${typeLabel[bundle.selected.type]} · ${bundle.selected.title}` : 'Record unavailable'}</div>
            <div className="text-xs text-slate-500 mt-1">{editSurfacePolicy.context.intent}</div>
          </div>
          <button onClick={closeRecordDrawer} className="action-btn"><X className="h-4 w-4" />Close</button>
        </div>

        {!bundle?.selected ? <EmptyState title="Record not found" message="This record is no longer available." /> : (
          <div className="record-drawer-body">
            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Context actions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {recordDrawerRef.type === 'followup' ? <button onClick={() => openEditModal(recordDrawerRef.id)} className="action-btn">{editSurfaceCtas.fullEditFollowUp}</button> : null}
                {recordDrawerRef.type === 'task' ? <button onClick={() => openEditTaskModal(recordDrawerRef.id)} className="action-btn">{editSurfaceCtas.fullEditTask}</button> : null}
              </div>
            </section>

            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Summary</div>
              <div className="detail-summary-grid">
                {summaryRows(bundle.selected).map((row) => (
                  <div key={row.label}><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{row.value}</div></div>
                ))}
              </div>
            </section>

            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Linked records</div>
              <div className="space-y-2 mt-2">
                {bundle.related.slice(0, 12).map((related) => (
                  <button key={`${related.type}-${related.id}`} onClick={() => openRecordDrawer({ type: related.type, id: related.id })} className="record-drawer-link-row">
                    <div className="text-sm font-medium text-slate-900">{related.title}</div>
                    <div className="text-xs text-slate-500">{typeLabel[related.type]} • {related.status || related.subtitle || 'No status'}</div>
                  </button>
                ))}
                {bundle.related.length === 0 ? <div className="text-xs text-slate-500">No linked records found.</div> : null}
              </div>
            </section>

            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Relationship actions</div>
              <div className="space-y-2 mt-2">
                {recordDrawerRef.type === 'followup' ? (
                  <>
                    <div className="text-xs text-slate-600">{childRollup?.summaryLabel || 'No linked child tasks.'}</div>
                    {(childRollup?.explanations || []).map((reason) => <div key={reason} className="text-xs text-slate-600">• {reason}</div>)}
                    {closeout ? (
                      <CloseoutReadinessCard
                        evaluation={closeout}
                        onOpenTask={(taskId) => openRecordDrawer({ type: 'task', id: taskId })}
                        onReviewLinkedRecords={() => openRecordDrawer({ type: 'followup', id: recordDrawerRef.id })}
                      />
                    ) : null}
                    {bundle.related.filter((entry) => entry.type === 'task').slice(0, 3).map((entry) => (
                      <button key={entry.id} onClick={() => openRecordDrawer({ type: 'task', id: entry.id })} className="record-drawer-link-row">
                        <div className="text-sm font-medium text-slate-900"><ArrowRight className="inline h-3.5 w-3.5" />Open child task</div>
                        <div className="text-xs text-slate-500">{entry.title}</div>
                      </button>
                    ))}
                  </>
                ) : null}
                {recordDrawerRef.type === 'task' && parentFollowUp ? (
                  <button onClick={() => openRecordDrawer({ type: 'followup', id: parentFollowUp.id })} className="record-drawer-link-row">
                    <div className="text-sm font-medium text-slate-900"><Link2 className="inline h-3.5 w-3.5" />Open parent follow-up</div>
                    <div className="text-xs text-slate-500">{parentFollowUp.title}</div>
                  </button>
                ) : null}
              </div>
            </section>

            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Timeline / history</div>
              <div className="space-y-2 mt-2">
                {timeline.slice(0, 20).map((event) => (
                  <div key={event.id} className="record-drawer-timeline-row"><div className="text-xs text-slate-500">{formatDateTime(event.at)}</div><div className="text-sm text-slate-700">{event.label}</div></div>
                ))}
                {timeline.length === 0 ? <div className="text-xs text-slate-500">No timeline available for this record.</div> : null}
              </div>
            </section>

            <section className="inspector-block">
              <div className="workspace-inspector-section-title">Context / metadata</div>
              <div className="mt-2 text-xs text-slate-600">
                Related links: {bundle.counts.relationships} · Open child work: {bundle.counts.openChildWork} · Blocked child work: {bundle.counts.blockedChildWork} · Overdue child work: {bundle.counts.overdueChildWork}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
