import { buildFollowUpFromDroppedEmail } from '../../lib/emailDrop';
import { validateFollowUpTransition } from '../../lib/workflowPolicy';
import { buildDraftText, buildTouchEvent, createId, normalizeItem, todayIso, addDaysIso, appendRunningNote } from '../../lib/utils';
import { buildPairKey } from '../../lib/duplicateDetection';
import { applyTaskRollupsToItems } from '../../domains/tasks/helpers';
import { applyItemRules, buildImportedItem, nextEscalation, syncProjectNamePatch, withItemUpdate } from '../../domains/followups/helpers';
import { makeAuditEntry } from '../../domains/shared/audit';
import type { TimelineEvent } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';
import { applyItemMutationEffects, refreshDuplicates } from '../useCases/mutationEffects';

export function createFollowUpsSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'updateItem' | 'addItem' | 'deleteItem' | 'addRunningNote' | 'attemptFollowUpTransition' | 'runValidatedBatchFollowUpTransition' |
  'addTouchLog' | 'importItems' | 'addDroppedEmailImports' | 'removeDroppedEmailImport' | 'clearDroppedEmailImports' |
  'convertDroppedEmailToItem' | 'convertSignalToItem' | 'dismissDuplicatePair' | 'mergeItems' | 'markNudged' | 'snoozeItem' |
  'cycleEscalation' | 'batchUpdateFollowUps' | 'updateDraftForItem' | 'generateDraftForItem' | 'confirmFollowUpSent'
> {
  return {
    updateItem: (id, patch) => {
      set((state: AppStore) => {
        const normalizedPatch = syncProjectNamePatch(patch, state.projects);
        const items = withItemUpdate(state.items, id, (item) => {
          const statusChanged = normalizedPatch.status && normalizedPatch.status !== item.status;
          const dueChanged = normalizedPatch.dueDate && normalizedPatch.dueDate !== item.dueDate;
          const assigneeChanged = (normalizedPatch.assigneeUserId && normalizedPatch.assigneeUserId !== item.assigneeUserId)
            || (normalizedPatch.assigneeDisplayName && normalizedPatch.assigneeDisplayName !== item.assigneeDisplayName);
          const promiseChanged = normalizedPatch.promisedDate !== undefined && normalizedPatch.promisedDate !== item.promisedDate;
          const timeline: TimelineEvent[] = [...item.timeline];
          const auditHistory = [...(item.auditHistory ?? [])];
          if (statusChanged) timeline.unshift(buildTouchEvent(`Status changed from ${item.status} to ${normalizedPatch.status}.`, 'status_changed'));
          if (dueChanged) timeline.unshift(buildTouchEvent('Due date updated.', 'touched'));
          if (promiseChanged) timeline.unshift(buildTouchEvent('Promised date updated.', 'touched'));
          if (statusChanged) auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'status_changed', field: 'status', from: item.status, to: normalizedPatch.status, summary: `Status changed to ${normalizedPatch.status}.` }));
          if (dueChanged) auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'due_date_changed', field: 'dueDate', from: item.dueDate, to: normalizedPatch.dueDate, summary: 'Due date updated.' }));
          if (assigneeChanged) auditHistory.unshift(makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'assignment_changed', field: 'assignee', from: item.assigneeDisplayName || item.owner, to: normalizedPatch.assigneeDisplayName || item.assigneeDisplayName || item.owner, summary: 'Ownership reassigned.' }));
          return applyItemRules(normalizeItem({ ...item, ...normalizedPatch, timeline, auditHistory, updatedByUserId: 'user-current', updatedByDisplayName: 'Current user' }));
        });
        return applyItemMutationEffects(state, items);
      });
      queuePersist();
    },
    addItem: (item) => {
      set((state: AppStore) => {
        const normalized = applyItemRules(normalizeItem({ ...item, auditHistory: [makeAuditEntry({ actorUserId: item.createdByUserId || 'user-current', actorDisplayName: item.createdByDisplayName || 'Current user', action: 'created', summary: 'Record created.' }), ...(item.auditHistory || [])] }));
        const items = [normalized, ...state.items].map(normalizeItem);
        return { ...applyItemMutationEffects(state, items), selectedId: normalized.id, itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null };
      });
      queuePersist();
    },
    deleteItem: (id) => {
      set((state: AppStore) => {
        const nextItems = state.items.filter((item) => item.id !== id).map(normalizeItem);
        const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(id));
        return {
          ...applyItemMutationEffects({ ...state, dismissedDuplicatePairs }, nextItems),
          intakeDocuments: state.intakeDocuments.map((doc) => doc.linkedFollowUpId === id ? { ...doc, linkedFollowUpId: undefined, disposition: 'Unprocessed' } : doc),
          dismissedDuplicatePairs,
          selectedId: state.selectedId === id ? nextItems[0]?.id ?? null : state.selectedId,
        };
      });
      queuePersist();
    },
    addRunningNote: (id, note) => {
      set((state: AppStore) => {
        const items = withItemUpdate(state.items, id, (item) => ({ ...item, notes: appendRunningNote(item.notes, note), lastTouchDate: todayIso(), timeline: [buildTouchEvent('Added a running note entry.', 'note'), ...item.timeline] }));
        return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
      });
      queuePersist();
    },
    attemptFollowUpTransition: (id, status, patch = {}, options) => {
      const state = get();
      const record = state.items.find((item) => item.id === id);
      if (!record) return { applied: false, validation: { allowed: false, blockers: ['Follow-up not found.'], warnings: [], requiredFields: [], overrideAllowed: false, recommendedNextActions: [], readyToClose: false } };
      const validation = validateFollowUpTransition({ record, from: record.status, to: status, patch: { ...patch, status }, context: { tasks: state.tasks }, override: !!options?.override });
      if (!validation.allowed) return { applied: false, validation };
      get().updateItem(id, { ...patch, status });
      return { applied: true, validation };
    },
    runValidatedBatchFollowUpTransition: (ids, status, patch = {}, options) => {
      const warnings: string[] = [];
      let affected = 0;
      let skipped = 0;
      ids.forEach((id) => {
        const result = get().attemptFollowUpTransition(id, status, patch, options);
        if (result.applied) affected += 1; else { skipped += 1; if (result.validation.blockers.length) warnings.push(`${id}: ${result.validation.blockers.join(' ')}`); }
        if (result.validation.warnings.length) warnings.push(`${id}: ${result.validation.warnings.join(' ')}`);
      });
      return { affected, skipped, warnings };
    },
    addTouchLog: ({ id, summary, status, dueDate, nextTouchDate, promisedDate, waitingOn }) => {
      set((state: AppStore) => {
        const items = withItemUpdate(state.items, id, (item) => ({ ...item, status: status ?? item.status, dueDate: dueDate ?? item.dueDate, nextTouchDate: nextTouchDate ?? addDaysIso(todayIso(), item.cadenceDays), promisedDate: promisedDate !== undefined ? promisedDate : item.promisedDate, waitingOn: waitingOn !== undefined ? waitingOn : item.waitingOn, lastTouchDate: todayIso(), timeline: [buildTouchEvent(summary, status && status !== item.status ? 'status_changed' : 'touched'), ...item.timeline] }));
        return { items, touchModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
      });
      queuePersist();
    },
    importItems: (rows) => { set((state: AppStore) => { const imported = rows.map(buildImportedItem); const items = [...imported, ...state.items].map(normalizeItem); return { items, selectedId: imported[0]?.id ?? state.selectedId, importModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    addDroppedEmailImports: (imports) => { if (!imports.length) return; set((state: AppStore) => { const existing = new Map(state.droppedEmailImports.map((entry) => [entry.sourceRef, entry])); imports.forEach((entry) => existing.set(entry.sourceRef, entry)); return { droppedEmailImports: Array.from(existing.values()) }; }); queuePersist(); },
    removeDroppedEmailImport: (id) => { set((state: AppStore) => ({ droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id) })); queuePersist(); },
    clearDroppedEmailImports: () => { set({ droppedEmailImports: [] }); queuePersist(); },
    convertDroppedEmailToItem: (id) => { const importItem = get().droppedEmailImports.find((entry) => entry.id === id); if (!importItem) return; const item = normalizeItem({ ...buildFollowUpFromDroppedEmail(importItem), timeline: [buildTouchEvent(`Imported from dropped email file ${importItem.fileName}.`, 'imported')] }); set((state: AppStore) => { const items = [item, ...state.items].map(normalizeItem); return { items, selectedId: item.id, droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id), duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    convertSignalToItem: (signalId) => { const signal = get().intakeSignals.find((entry) => entry.id === signalId); if (!signal) return; const item = normalizeItem({ id: createId(), title: signal.title, source: signal.source, project: 'General', owner: 'Unassigned', status: signal.urgency === 'High' ? 'Needs action' : 'In progress', priority: signal.urgency === 'High' ? 'High' : signal.urgency === 'Medium' ? 'Medium' : 'Low', dueDate: todayIso(), promisedDate: undefined, lastTouchDate: todayIso(), nextTouchDate: addDaysIso(todayIso(), signal.urgency === 'High' ? 1 : 3), nextAction: 'Review the intake signal and confirm owner, project, and next action.', summary: signal.detail, tags: ['Imported'], sourceRef: `Intake signal ${signal.id}`, sourceRefs: [`Intake signal ${signal.id}`], mergedItemIds: [], notes: '', timeline: [buildTouchEvent('Converted from intake signal.', 'imported')], category: 'General', owesNextAction: 'Unknown', escalationLevel: signal.urgency === 'High' ? 'Watch' : 'None', cadenceDays: signal.urgency === 'High' ? 2 : 4, draftFollowUp: '' }); set((state: AppStore) => { const items = [item, ...state.items].map(normalizeItem); return { items, intakeSignals: state.intakeSignals.filter((entry) => entry.id !== signalId), selectedId: item.id, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    dismissDuplicatePair: (leftId, rightId) => { set((state: AppStore) => { const pairKey = buildPairKey(leftId, rightId); if (state.dismissedDuplicatePairs.includes(pairKey)) return state; const dismissedDuplicatePairs = [...state.dismissedDuplicatePairs, pairKey]; return { dismissedDuplicatePairs, duplicateReviews: refreshDuplicates(state.items, dismissedDuplicatePairs) }; }); queuePersist(); },
    mergeItems: (baseId, candidateId, draft) => { set((state: AppStore) => { const base = state.items.find((item) => item.id === baseId); const candidate = state.items.find((item) => item.id === candidateId); if (!base || !candidate) return state; const mergedRecord = normalizeItem({ ...base, ...draft, id: base.id, timeline: [buildTouchEvent(`Merged ${candidate.id} into this record.`, 'merged'), ...draft.timeline].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()) }); const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(candidateId)); const items = [mergedRecord, ...state.items.filter((item) => item.id !== baseId && item.id !== candidateId)].map(normalizeItem); return { items, dismissedDuplicatePairs, selectedId: baseId, mergeModal: { open: false, baseId: null, candidateId: null }, duplicateReviews: refreshDuplicates(items, dismissedDuplicatePairs) }; }); queuePersist(); },
    markNudged: (id) => { set((state: AppStore) => { const items = withItemUpdate(state.items, id, (item) => ({ ...item, lastTouchDate: todayIso(), lastNudgedAt: todayIso(), nextTouchDate: addDaysIso(todayIso(), item.cadenceDays), snoozedUntilDate: undefined, timeline: [buildTouchEvent('Marked as nudged and pushed to next touch date.', 'nudged'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    snoozeItem: (id, days) => { set((state: AppStore) => { const until = addDaysIso(todayIso(), days); const items = withItemUpdate(state.items, id, (item) => ({ ...item, snoozedUntilDate: until, nextTouchDate: until, timeline: [buildTouchEvent(`Snoozed for ${days} day${days === 1 ? '' : 's'}.`, 'snoozed'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    cycleEscalation: (id) => { set((state: AppStore) => { const items = withItemUpdate(state.items, id, (item) => ({ ...item, escalationLevel: nextEscalation(item.escalationLevel), timeline: [buildTouchEvent(`Escalation moved to ${nextEscalation(item.escalationLevel)}.`, 'escalated'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist(); },
    batchUpdateFollowUps: (ids, patch, summary) => {
      if (!ids.length) return;
      if (patch.status) { get().runValidatedBatchFollowUpTransition(ids, patch.status, patch); set({ selectedFollowUpIds: [] }); queuePersist(); return; }
      if (patch.nextTouchDate && !patch.snoozedUntilDate) { ids.forEach((id) => get().attemptFollowUpTransition(id, 'Waiting internal', { ...patch, snoozedUntilDate: patch.nextTouchDate })); set({ selectedFollowUpIds: [] }); queuePersist(); return; }
      set((state: AppStore) => {
        const idSet = new Set(ids);
        const items = state.items.map((item) => !idSet.has(item.id) ? item : normalizeItem({ ...item, ...patch, timeline: [buildTouchEvent(summary, 'bundle_action'), ...item.timeline], lastActionAt: todayIso(), lastCompletedAction: summary, auditHistory: [makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'updated', summary }), ...(item.auditHistory || [])] }));
        return { items: applyTaskRollupsToItems(items, state.tasks), selectedFollowUpIds: [] };
      });
      queuePersist();
    },
    updateDraftForItem: (id, draft) => { set((state: AppStore) => ({ items: withItemUpdate(state.items, id, (item) => ({ ...item, draftFollowUp: draft })) })); queuePersist(); },
    generateDraftForItem: (id) => { set((state: AppStore) => { const item = state.items.find((entry) => entry.id === id); if (!item) return state; const contact = state.contacts.find((entry) => entry.id === item.contactId); const company = state.companies.find((entry) => entry.id === item.companyId); const draft = buildDraftText(item, contact, company); return { items: withItemUpdate(state.items, id, (entry) => ({ ...entry, draftFollowUp: draft })) }; }); queuePersist(); },
    confirmFollowUpSent: (id, notes) => { set((state: AppStore) => ({ items: withItemUpdate(state.items, id, (item) => ({ ...item, actionState: 'Sent (confirmed)', status: 'Waiting on external', lastTouchDate: todayIso(), nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3), lastCompletedAction: 'Sent follow-up (confirmed)', lastActionAt: todayIso(), actionReceipts: [{ id: createId('ACT'), at: todayIso(), actor: 'Current user', action: 'send_confirmed', confirmed: true, notes }, ...(item.actionReceipts || [])], timeline: [buildTouchEvent('Send confirmed by user in composer.', 'bundle_action'), ...item.timeline] })) })); queuePersist(); },
  };
}
