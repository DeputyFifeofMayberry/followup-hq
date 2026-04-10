import { buildFollowUpFromDroppedEmail } from '../../lib/emailDrop';
import { validateFollowUpTransition } from '../../lib/workflowPolicy';
import { buildDraftText, buildTouchEvent, createId, normalizeItem, todayIso, addDaysIso, appendRunningNote } from '../../lib/utils';
import { buildPairKey } from '../../lib/duplicateDetection';
import { applyTaskRollupsToItems } from '../../domains/tasks/helpers';
import { applyItemRules, buildImportedItem, nextEscalation, syncProjectNamePatch, withItemUpdate } from '../../domains/followups/helpers';
import { makeAuditEntry } from '../../domains/shared/audit';
import { enforceFollowUpIntegrity } from '../../domains/records/integrity';
import { buildBlockedTransitionToast, buildBulkResultToast, buildFollowUpUpdateTitle, shouldToastFollowUpPatch } from '../../lib/actionFeedback';
import { isMeaningfulUndoableFollowUpUpdate } from '../../lib/undo';
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
      const before = get().items.find((item) => item.id === id);
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
          return enforceFollowUpIntegrity(
            applyItemRules(normalizeItem({ ...item, ...normalizedPatch, timeline, auditHistory, updatedByUserId: 'user-current', updatedByDisplayName: 'Current user' })),
            state.projects,
          );
        });
        return applyItemMutationEffects(state, items);
      });
      if (before && shouldToastFollowUpPatch(patch)) {
        get().pushToast({ tone: 'success', title: buildFollowUpUpdateTitle(before, patch), source: 'followups.updateItem', recordType: 'followup', recordIds: [id] });
      }
      const after = get().items.find((item) => item.id === id);
      if (before && after && isMeaningfulUndoableFollowUpUpdate(patch)) {
        get().registerUndoEntry({
          actionKind: 'followup_update',
          title: buildFollowUpUpdateTitle(before, patch),
          entityRefs: [{ type: 'followup', id }],
          dirtyRecordRefs: [{ type: 'followup', id }],
          snapshots: [{ entityType: 'followup', id, before, after }],
          overlapPolicy: 'latest-only',
        });
      }
      queuePersist({ dirtyRecords: [{ type: 'followup', id }] });
    },
    addItem: (item) => {
      set((state: AppStore) => {
        const timeline = item.timeline?.length ? item.timeline : [buildTouchEvent('Follow-up created.', 'created')];
        const normalized = enforceFollowUpIntegrity(
          applyItemRules(normalizeItem({ ...item, timeline, auditHistory: [makeAuditEntry({ actorUserId: item.createdByUserId || 'user-current', actorDisplayName: item.createdByDisplayName || 'Current user', action: 'created', summary: 'Record created.' }), ...(item.auditHistory || [])] })),
          state.projects,
        );
        const items = [normalized, ...state.items].map(normalizeItem);
        return { ...applyItemMutationEffects(state, items), selectedId: normalized.id, itemModal: { open: false, mode: 'create', itemId: null }, createWorkDraft: null };
      });
      get().pushToast({ tone: 'success', title: 'Follow-up created', source: 'followups.addItem', recordType: 'followup', recordIds: [item.id] });
      queuePersist({ dirtyRecords: [{ type: 'followup', id: item.id }] });
    },
    deleteItem: (id) => {
      const before = get().items.find((item) => item.id === id);
      const intakeBefore = get().intakeDocuments.filter((doc) => doc.linkedFollowUpId === id).map((doc) => ({ id: doc.id, before: doc }));
      const dismissedBefore = get().dismissedDuplicatePairs;
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
      if (before) {
        const undoId = get().registerUndoEntry({
          actionKind: 'followup_delete',
          title: 'Follow-up deleted',
          entityRefs: [{ type: 'followup', id }],
          dirtyRecordRefs: [{ type: 'followup', id }],
          snapshots: [{ entityType: 'followup', id, before, after: null }],
          auxiliarySnapshot: { dismissedDuplicatePairs: dismissedBefore, intakeDocuments: intakeBefore },
        });
        get().pushToast({ tone: 'warning', kind: 'undo_offer', title: 'Follow-up deleted', source: 'followups.deleteItem', recordType: 'followup', recordIds: [id], action: undoId ? { label: 'Undo', actionId: undoId } : undefined });
      }
      queuePersist({ dirtyRecords: [{ type: 'followup', id }] });
    },
    addRunningNote: (id, note) => {
      set((state: AppStore) => {
        const items = withItemUpdate(state.items, id, (item) => ({ ...item, notes: appendRunningNote(item.notes, note), lastTouchDate: todayIso(), timeline: [buildTouchEvent('Added a running note entry.', 'note'), ...item.timeline] }));
        return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
      });
      get().pushToast({ tone: 'success', title: 'Running note added', source: 'followups.addRunningNote', recordType: 'followup', recordIds: [id] });
      queuePersist({ dirtyRecords: [{ type: 'followup', id }] });
    },
    attemptFollowUpTransition: (id, status, patch = {}, options) => {
      const state = get();
      const record = state.items.find((item) => item.id === id);
      if (!record) return { applied: false, validation: { allowed: false, blockers: ['Follow-up not found.'], warnings: [], requiredFields: [], overrideAllowed: false, recommendedNextActions: [], readyToClose: false } };
      const validation = validateFollowUpTransition({ record, from: record.status, to: status, patch: { ...patch, status }, context: { tasks: state.tasks }, override: !!options?.override });
      if (!validation.allowed) {
        const blocked = buildBlockedTransitionToast('followup', status, 1);
        if (!options?.suppressToast) {
          get().pushToast({ tone: 'warning', title: blocked.title, message: blocked.message, source: 'followups.attemptFollowUpTransition', recordType: 'followup', recordIds: [id] });
        }
        return { applied: false, validation };
      }
      get().updateItem(id, { ...patch, status });
      return { applied: true, validation };
    },
    runValidatedBatchFollowUpTransition: (ids, status, patch = {}, options) => {
      const warnings: string[] = [];
      let affected = 0;
      let skipped = 0;
      const beforeById = new Map(ids.map((id) => [id, get().items.find((item) => item.id === id)]));
      ids.forEach((id) => {
        const result = get().attemptFollowUpTransition(id, status, patch, { ...options, suppressToast: true });
        if (result.applied) affected += 1; else { skipped += 1; if (result.validation.blockers.length) warnings.push(`${id}: ${result.validation.blockers.join(' ')}`); }
        if (result.validation.warnings.length) warnings.push(`${id}: ${result.validation.warnings.join(' ')}`);
      });
      const feedback = buildBulkResultToast({ affected, skipped, warnings }, status);
      const affectedIds = ids.filter((id) => {
        const before = beforeById.get(id);
        const after = get().items.find((item) => item.id === id);
        return !!before && !!after && before.status !== after.status;
      });
      let undoId: string | null = null;
      if (affectedIds.length) {
        undoId = get().registerUndoEntry({
          actionKind: 'followup_bulk_transition',
          title: feedback.title,
          message: feedback.message,
          entityRefs: affectedIds.map((id) => ({ type: 'followup' as const, id })),
          dirtyRecordRefs: affectedIds.map((id) => ({ type: 'followup' as const, id })),
          snapshots: affectedIds.map((id) => ({ entityType: 'followup' as const, id, before: beforeById.get(id) ?? null, after: get().items.find((item) => item.id === id) ?? null })),
          operationSummary: { affected, skipped, warnings },
        });
      }
      get().pushToast({ kind: 'bulk_result', tone: feedback.tone, title: feedback.title, message: feedback.message, source: 'followups.runValidatedBatchFollowUpTransition', recordType: 'followup', recordIds: ids, operationSummary: { affected, skipped, warnings }, action: undoId ? { label: 'Undo', actionId: undoId } : undefined });
      return { affected, skipped, warnings };
    },
    addTouchLog: ({ id, summary, status, dueDate, nextTouchDate, promisedDate, waitingOn }) => {
      const before = get().items.find((item) => item.id === id);
      const todayDateOnly = new Date().toISOString().slice(0, 10);
      set((state: AppStore) => {
        const items = withItemUpdate(state.items, id, (item) => ({ ...item, status: status ?? item.status, dueDate: dueDate ?? item.dueDate, nextTouchDate: nextTouchDate ?? addDaysIso(todayIso(), item.cadenceDays), promisedDate: promisedDate !== undefined ? promisedDate : item.promisedDate, waitingOn: waitingOn !== undefined ? waitingOn : item.waitingOn, lastTouchDate: todayIso(), lastReviewedDate: todayDateOnly, timeline: [buildTouchEvent(summary, status && status !== item.status ? 'status_changed' : 'touched'), ...item.timeline] }));
        return { items, touchModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) };
      });
      get().pushToast({ tone: 'success', title: 'Touch logged', source: 'followups.addTouchLog', recordType: 'followup', recordIds: [id] });
      const after = get().items.find((item) => item.id === id);
      if (before && after) get().registerUndoEntry({ actionKind: 'followup_touch_log', title: 'Touch logged', entityRefs: [{ type: 'followup', id }], dirtyRecordRefs: [{ type: 'followup', id }], snapshots: [{ entityType: 'followup', id, before, after }] });
      queuePersist({ dirtyRecords: [{ type: 'followup', id }] });
    },
    importItems: (rows) => { set((state: AppStore) => { const imported = rows.map(buildImportedItem); const items = [...imported, ...state.items].map(normalizeItem); return { items, selectedId: imported[0]?.id ?? state.selectedId, importModalOpen: false, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); const importedIds = rows.map((row) => row.id); const undoId = importedIds.length ? get().registerUndoEntry({ actionKind: 'bulk_action', title: `${rows.length} follow-ups imported`, message: 'Imported records removed on undo.', entityRefs: importedIds.map((id) => ({ type: 'followup' as const, id })), dirtyRecordRefs: importedIds.map((id) => ({ type: 'followup' as const, id })), snapshots: importedIds.map((id) => ({ entityType: 'followup' as const, id, before: null, after: get().items.find((item) => item.id === id) ?? null })), operationSummary: { affected: rows.length, skipped: 0, warnings: [] } }) : null; get().pushToast({ kind: 'bulk_result', tone: 'success', title: `${rows.length} follow-ups imported`, source: 'followups.importItems', recordType: 'followup', recordIds: importedIds, operationSummary: { affected: rows.length, skipped: 0, warnings: [] }, action: undoId ? { label: 'Undo', actionId: undoId } : undefined }); queuePersist({ dirtyRecords: importedIds.map((id) => ({ type: 'followup' as const, id })) }); },
    addDroppedEmailImports: (imports) => { if (!imports.length) return; set((state: AppStore) => { const existing = new Map(state.droppedEmailImports.map((entry) => [entry.sourceRef, entry])); imports.forEach((entry) => existing.set(entry.sourceRef, entry)); return { droppedEmailImports: Array.from(existing.values()) }; }); queuePersist(); },
    removeDroppedEmailImport: (id) => { set((state: AppStore) => ({ droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id) })); queuePersist(); },
    clearDroppedEmailImports: () => { set({ droppedEmailImports: [] }); queuePersist(); },
    convertDroppedEmailToItem: (id) => { const importItem = get().droppedEmailImports.find((entry) => entry.id === id); if (!importItem) return; const item = normalizeItem({ ...buildFollowUpFromDroppedEmail(importItem), timeline: [buildTouchEvent(`Imported from dropped email file ${importItem.fileName}.`, 'imported')] }); set((state: AppStore) => { const items = [item, ...state.items].map(normalizeItem); return { items, selectedId: item.id, droppedEmailImports: state.droppedEmailImports.filter((entry) => entry.id !== id), duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); queuePersist({ dirtyRecords: [{ type: 'followup', id: item.id }] }); },
    convertSignalToItem: (signalId) => { const signal = get().intakeSignals.find((entry) => entry.id === signalId); if (!signal) return; const state = get(); const item = enforceFollowUpIntegrity(normalizeItem({ id: createId(), title: signal.title, source: signal.source, project: '', owner: '', status: signal.urgency === 'High' ? 'Needs action' : 'In progress', priority: signal.urgency === 'High' ? 'High' : signal.urgency === 'Medium' ? 'Medium' : 'Low', dueDate: todayIso(), promisedDate: undefined, lastTouchDate: todayIso(), nextTouchDate: addDaysIso(todayIso(), signal.urgency === 'High' ? 1 : 3), nextAction: 'Review the intake signal and confirm owner, project, and next action.', summary: signal.detail, tags: ['Imported'], sourceRef: `Intake signal ${signal.id}`, sourceRefs: [`Intake signal ${signal.id}`], mergedItemIds: [], notes: '', timeline: [buildTouchEvent('Converted from intake signal.', 'imported')], category: 'General', owesNextAction: 'Unknown', escalationLevel: signal.urgency === 'High' ? 'Watch' : 'None', cadenceDays: signal.urgency === 'High' ? 2 : 4, draftFollowUp: '', provenance: { sourceType: 'quick_capture', sourceRef: `Intake signal ${signal.id}`, capturedAt: todayIso() } }), state.projects); set((inner: AppStore) => { const items = [item, ...inner.items].map(normalizeItem); return { items, intakeSignals: inner.intakeSignals.filter((entry) => entry.id !== signalId), selectedId: item.id, duplicateReviews: refreshDuplicates(items, inner.dismissedDuplicatePairs) }; }); queuePersist({ dirtyRecords: [{ type: 'followup', id: item.id }] }); },
    dismissDuplicatePair: (leftId, rightId) => { set((state: AppStore) => { const pairKey = buildPairKey(leftId, rightId); if (state.dismissedDuplicatePairs.includes(pairKey)) return state; const dismissedDuplicatePairs = [...state.dismissedDuplicatePairs, pairKey]; return { dismissedDuplicatePairs, duplicateReviews: refreshDuplicates(state.items, dismissedDuplicatePairs) }; }); queuePersist(); },
    mergeItems: (baseId, candidateId, draft) => { const baseBefore = get().items.find((item) => item.id === baseId); const candidateBefore = get().items.find((item) => item.id === candidateId); const dismissedBefore = get().dismissedDuplicatePairs; set((state: AppStore) => { const base = state.items.find((item) => item.id === baseId); const candidate = state.items.find((item) => item.id === candidateId); if (!base || !candidate) return state; const mergedRecord = normalizeItem({ ...base, ...draft, id: base.id, timeline: [buildTouchEvent(`Merged ${candidate.id} into this record.`, 'merged'), ...draft.timeline].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()) }); const dismissedDuplicatePairs = state.dismissedDuplicatePairs.filter((pairKey) => !pairKey.split('::').includes(candidateId)); const items = [mergedRecord, ...state.items.filter((item) => item.id !== baseId && item.id !== candidateId)].map(normalizeItem); return { items, dismissedDuplicatePairs, selectedId: baseId, mergeModal: { open: false, baseId: null, candidateId: null }, duplicateReviews: refreshDuplicates(items, dismissedDuplicatePairs) }; }); if (baseBefore && candidateBefore) { const baseAfter = get().items.find((item) => item.id === baseId) ?? null; const undoId = get().registerUndoEntry({ actionKind: 'followup_merge', title: 'Follow-ups merged', message: 'Duplicate merged into primary follow-up.', entityRefs: [{ type: 'followup', id: baseId }, { type: 'followup', id: candidateId }], dirtyRecordRefs: [{ type: 'followup', id: baseId }, { type: 'followup', id: candidateId }], snapshots: [{ entityType: 'followup', id: baseId, before: baseBefore, after: baseAfter }, { entityType: 'followup', id: candidateId, before: candidateBefore, after: null }], auxiliarySnapshot: { dismissedDuplicatePairs: dismissedBefore } }); get().pushToast({ kind: 'undo_offer', tone: 'success', title: 'Follow-ups merged', message: 'Duplicate merged into primary follow-up.', source: 'followups.mergeItems', recordType: 'followup', recordIds: [baseId, candidateId], action: undoId ? { label: 'Undo', actionId: undoId } : undefined }); } queuePersist({ dirtyRecords: [{ type: 'followup', id: baseId }, { type: 'followup', id: candidateId }] }); },
    markNudged: (id) => { const todayDateOnly = new Date().toISOString().slice(0, 10); set((state: AppStore) => { const items = withItemUpdate(state.items, id, (item) => ({ ...item, lastTouchDate: todayIso(), lastNudgedAt: todayIso(), lastReviewedDate: todayDateOnly, nextTouchDate: addDaysIso(todayIso(), item.cadenceDays), snoozedUntilDate: undefined, timeline: [buildTouchEvent('Marked as nudged and pushed to next touch date.', 'nudged'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); get().pushToast({ tone: 'success', title: 'Marked as nudged', source: 'followups.markNudged', recordType: 'followup', recordIds: [id] }); queuePersist(); },
    snoozeItem: (id, days) => { set((state: AppStore) => { const until = addDaysIso(todayIso(), days); const items = withItemUpdate(state.items, id, (item) => ({ ...item, snoozedUntilDate: until, nextTouchDate: until, timeline: [buildTouchEvent(`Snoozed for ${days} day${days === 1 ? '' : 's'}.`, 'snoozed'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); get().pushToast({ tone: 'info', title: `Follow-up snoozed for ${days} day${days === 1 ? '' : 's'}`, source: 'followups.snoozeItem', recordType: 'followup', recordIds: [id] }); queuePersist(); },
    cycleEscalation: (id) => { set((state: AppStore) => { const items = withItemUpdate(state.items, id, (item) => ({ ...item, escalationLevel: nextEscalation(item.escalationLevel), timeline: [buildTouchEvent(`Escalation moved to ${nextEscalation(item.escalationLevel)}.`, 'escalated'), ...item.timeline] })); return { items, duplicateReviews: refreshDuplicates(items, state.dismissedDuplicatePairs) }; }); const escalation = get().items.find((item) => item.id === id)?.escalationLevel; get().pushToast({ tone: escalation === 'Critical' ? 'warning' : 'info', title: `Escalation moved to ${escalation ?? 'next level'}`, source: 'followups.cycleEscalation', recordType: 'followup', recordIds: [id] }); queuePersist(); },
    batchUpdateFollowUps: (ids, patch, summary) => {
      if (!ids.length) return;
      if (patch.status) { get().runValidatedBatchFollowUpTransition(ids, patch.status, patch); set({ selectedFollowUpIds: [] }); queuePersist(); return; }
      if (patch.nextTouchDate && !patch.snoozedUntilDate) { ids.forEach((id) => get().attemptFollowUpTransition(id, 'Waiting internal', { ...patch, snoozedUntilDate: patch.nextTouchDate })); set({ selectedFollowUpIds: [] }); queuePersist(); return; }
      const beforeById = new Map(ids.map((id) => [id, get().items.find((item) => item.id === id)]));
      set((state: AppStore) => {
        const idSet = new Set(ids);
        const items = state.items.map((item) => !idSet.has(item.id) ? item : normalizeItem({ ...item, ...patch, timeline: [buildTouchEvent(summary, 'bundle_action'), ...item.timeline], lastActionAt: todayIso(), lastCompletedAction: summary, auditHistory: [makeAuditEntry({ actorUserId: 'user-current', actorDisplayName: 'Current user', action: 'updated', summary }), ...(item.auditHistory || [])] }));
        return { items: applyTaskRollupsToItems(items, state.tasks), selectedFollowUpIds: [] };
      });
      const affectedIds = ids.filter((id) => beforeById.get(id) && get().items.find((item) => item.id === id));
      const undoId = affectedIds.length ? get().registerUndoEntry({
        actionKind: 'followup_bulk_patch',
        title: `${affectedIds.length} follow-ups updated`,
        message: summary,
        entityRefs: affectedIds.map((id) => ({ type: 'followup' as const, id })),
        dirtyRecordRefs: affectedIds.map((id) => ({ type: 'followup' as const, id })),
        snapshots: affectedIds.map((id) => ({ entityType: 'followup' as const, id, before: beforeById.get(id) ?? null, after: get().items.find((item) => item.id === id) ?? null })),
        operationSummary: { affected: affectedIds.length, skipped: 0, warnings: [] },
      }) : null;
      get().pushToast({ kind: 'bulk_result', tone: 'success', title: `${affectedIds.length} follow-ups updated`, source: 'followups.batchUpdateFollowUps', recordType: 'followup', recordIds: ids, operationSummary: { affected: affectedIds.length, skipped: 0, warnings: [] }, action: undoId ? { label: 'Undo', actionId: undoId } : undefined });
      queuePersist({ dirtyRecords: affectedIds.map((id) => ({ type: 'followup' as const, id })) });
    },
    updateDraftForItem: (id, draft) => { set((state: AppStore) => ({ items: withItemUpdate(state.items, id, (item) => ({ ...item, draftFollowUp: draft })) })); queuePersist({ dirtyRecords: [{ type: 'followup', id }] }); },
    generateDraftForItem: (id) => { set((state: AppStore) => { const item = state.items.find((entry) => entry.id === id); if (!item) return state; const contact = state.contacts.find((entry) => entry.id === item.contactId); const company = state.companies.find((entry) => entry.id === item.companyId); const draft = buildDraftText(item, contact, company); return { items: withItemUpdate(state.items, id, (entry) => ({ ...entry, draftFollowUp: draft })) }; }); queuePersist({ dirtyRecords: [{ type: 'followup', id }] }); },
    confirmFollowUpSent: (id, notes) => { const before = get().items.find((item) => item.id === id); set((state: AppStore) => ({ items: withItemUpdate(state.items, id, (item) => ({ ...item, actionState: 'Sent (confirmed)', status: 'Waiting on external', lastTouchDate: todayIso(), nextTouchDate: addDaysIso(todayIso(), item.cadenceDays || 3), lastCompletedAction: 'Sent follow-up (confirmed)', lastActionAt: todayIso(), actionReceipts: [{ id: createId('ACT'), at: todayIso(), actor: 'Current user', action: 'send_confirmed', confirmed: true, notes }, ...(item.actionReceipts || [])], timeline: [buildTouchEvent('Send confirmed by user in composer.', 'bundle_action'), ...item.timeline] })) })); get().pushToast({ tone: 'success', title: 'Follow-up marked as sent', source: 'followups.confirmFollowUpSent', recordType: 'followup', recordIds: [id] }); const after = get().items.find((item) => item.id === id); if (before && after) get().registerUndoEntry({ actionKind: 'followup_update', title: 'Follow-up marked as sent', entityRefs: [{ type: 'followup', id }], dirtyRecordRefs: [{ type: 'followup', id }], snapshots: [{ entityType: 'followup', id, before, after }] }); queuePersist({ dirtyRecords: [{ type: 'followup', id }] }); },
  };
}
