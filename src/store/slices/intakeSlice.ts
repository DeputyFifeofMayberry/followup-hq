import { buildBatchRecord, buildCandidatesFromAsset, parseIntakeFile } from '../../lib/universalIntake';
import { evaluateIntakeImportSafety } from '../../lib/intakeImportSafety';
import { appendReviewerFeedback } from '../../domains/shared/audit';
import { enforceFollowUpIntegrity, enforceTaskIntegrity, getIntegrityReasonLabel, isExecutionReady } from '../../domains/records/integrity';
import { addDaysIso, buildTouchEvent, createId, todayIso } from '../../lib/utils';
import { fileFromIntakeRetrySource } from '../../lib/intakeRetryCache';
import { enrichFollowUpFromIntakeLink, enrichTaskFromIntakeLink } from '../../lib/intakeLinking';
import type { FollowUpItem, IntakeReviewerFeedbackField, TaskItem } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

export function createIntakeSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'stageIntakeCandidate' | 'approveIntakeCandidate' | 'discardIntakeCandidate' | 'saveIntakeCandidateAsReference' |
  'ingestIntakeFiles' | 'updateIntakeWorkCandidate' | 'decideIntakeWorkCandidate' | 'batchApproveHighConfidence' |
  'ingestIntakeText' | 'archiveIntakeBatch' | 'clearFinalizedIntakeCandidates' | 'removeIntakeAsset' | 'retryIntakeAssetParse' | 'deleteIntakeBatchIfEmpty'
> {
  const recomputeBatchStats = (collections: Pick<AppStore, 'intakeAssets' | 'intakeWorkCandidates' | 'intakeBatches'>, batchId: string) => {
    const batch = collections.intakeBatches.find((entry) => entry.id === batchId);
    if (!batch) return null;
    const assets = collections.intakeAssets.filter((asset) => asset.batchId === batchId && !asset.parentAssetId);
    const candidates = collections.intakeWorkCandidates.filter((candidate) => candidate.batchId === batchId);
    const pendingCandidates = candidates.filter((candidate) => candidate.approvalStatus === 'pending');
    const finalizedCandidates = candidates.length - pendingCandidates.length;
    const failedParses = assets.filter((asset) => asset.parseStatus === 'failed').length;
    const nextStatus = batch.status === 'archived'
      ? 'archived'
      : assets.length === 0 && candidates.length === 0
        ? 'completed'
        : failedParses > 0 && pendingCandidates.length === 0
          ? 'failed'
          : pendingCandidates.length === 0 && candidates.length > 0
            ? 'completed'
            : 'review';
    return {
      ...batch,
      status: nextStatus as typeof batch.status,
      assetIds: assets.map((asset) => asset.id),
      stats: {
        filesProcessed: assets.length,
        candidatesCreated: candidates.length,
        highConfidence: candidates.filter((candidate) => candidate.confidence >= 0.9).length,
        failedParses,
        duplicatesFlagged: candidates.filter((candidate) => candidate.duplicateMatches.length > 0 || !!candidate.suspectedDuplicateGroupId).length,
        activeCandidates: pendingCandidates.length,
        finalizedCandidates,
      },
    };
  };

  const recomputeAllBatchStats = (collections: Pick<AppStore, 'intakeAssets' | 'intakeWorkCandidates' | 'intakeBatches'>) => ({
    intakeBatches: collections.intakeBatches
      .map((batch) => recomputeBatchStats(collections, batch.id) ?? batch)
      .filter((batch): batch is NonNullable<ReturnType<typeof recomputeBatchStats>> => !!batch),
  });

  const enforceCandidateApprovalIntegrity = (candidateId: string, asType: 'task' | 'followup') => {
    const state = get();
    const candidate = state.intakeWorkCandidates.find((entry) => entry.id === candidateId);
    if (!candidate) return { allowed: false, reasons: ['Candidate not found.'] };
    if (asType === 'task') {
      const draft = enforceTaskIntegrity({
        id: createId('TSK'),
        title: candidate.title,
        project: candidate.project || '',
        owner: candidate.owner || '',
        status: 'To do',
        priority: candidate.priority,
        dueDate: candidate.dueDate,
        summary: candidate.summary,
        nextStep: candidate.nextStep || candidate.title,
        notes: `Imported from intake asset ${candidate.assetId}`,
        tags: [...candidate.tags, 'intake'],
        createdAt: todayIso(),
        updatedAt: todayIso(),
        provenance: { sourceType: 'intake', sourceRef: `Intake asset ${candidate.assetId}`, capturedAt: todayIso(), sourceBatchId: candidate.batchId },
      }, state.projects);
      return { allowed: isExecutionReady(draft), reasons: (draft.reviewReasons || []).map(getIntegrityReasonLabel), draft };
    }
    const draft = enforceFollowUpIntegrity({
      id: createId(),
      title: candidate.title,
      source: 'Notes',
      project: candidate.project || '',
      owner: candidate.owner || '',
      status: 'Needs action',
      priority: candidate.priority,
      dueDate: candidate.dueDate || addDaysIso(todayIso(), 2),
      lastTouchDate: todayIso(),
      nextTouchDate: candidate.dueDate || addDaysIso(todayIso(), 3),
      nextAction: candidate.nextStep || candidate.title,
      summary: candidate.summary,
      tags: [...candidate.tags, 'intake'],
      sourceRef: `Intake asset ${candidate.assetId}`,
      sourceRefs: [`Intake asset ${candidate.assetId}`],
      mergedItemIds: [],
      waitingOn: candidate.waitingOn,
      notes: '',
      timeline: [buildTouchEvent('Created from universal intake review queue.', 'imported')],
      category: 'Coordination',
      owesNextAction: 'Unknown',
      escalationLevel: 'None',
      cadenceDays: 3,
      provenance: { sourceType: 'intake', sourceRef: `Intake asset ${candidate.assetId}`, capturedAt: todayIso(), sourceBatchId: candidate.batchId },
    }, state.projects);
    return { allowed: isExecutionReady(draft), reasons: (draft.reviewReasons || []).map(getIntegrityReasonLabel), draft };
  };

  return {
    stageIntakeCandidate: (candidate) => { set((state: AppStore) => ({ intakeCandidates: [candidate, ...state.intakeCandidates] })); queuePersist(); },
    approveIntakeCandidate: (candidateId, mode) => { const state = get(); const candidate = state.intakeCandidates.find((entry) => entry.id === candidateId); if (!candidate) return; const asType = mode ?? candidate.suggestedType; if (asType === 'task') { state.addTask(enforceTaskIntegrity({ id: createId('TSK'), title: candidate.draft.title, project: candidate.detectedProject || '', owner: candidate.detectedOwner || '', status: 'To do', priority: candidate.priority, dueDate: candidate.detectedDueDate, summary: candidate.draft.summary, nextStep: candidate.draft.nextStep || candidate.draft.title, notes: '', tags: ['Intake review'], createdAt: todayIso(), updatedAt: todayIso(), needsCleanup: candidate.confidenceTier !== 'high', provenance: { sourceType: 'quick_capture', sourceRef: 'Quick capture intake', capturedAt: todayIso() } }, state.projects)); } else { state.addItem(enforceFollowUpIntegrity({ id: createId(), title: candidate.draft.title, source: 'Notes', project: candidate.detectedProject || '', owner: candidate.detectedOwner || '', status: 'Needs action', priority: candidate.priority, dueDate: candidate.detectedDueDate || addDaysIso(todayIso(), 1), lastTouchDate: todayIso(), nextTouchDate: candidate.detectedDueDate || addDaysIso(todayIso(), 2), nextAction: candidate.draft.nextAction || candidate.draft.title, summary: candidate.draft.summary, tags: ['Intake review'], sourceRef: 'Quick capture intake', sourceRefs: [], mergedItemIds: [], waitingOn: candidate.waitingOn, notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3, needsCleanup: candidate.confidenceTier !== 'high', cleanupReasons: [], provenance: { sourceType: 'quick_capture', sourceRef: 'Quick capture intake', capturedAt: todayIso() } }, state.projects)); } set((inner: AppStore) => ({ intakeCandidates: inner.intakeCandidates.filter((entry) => entry.id !== candidateId), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'quick_capture', candidateId: candidate.id, candidateKind: 'quick_capture', suggestedType: candidate.suggestedType, suggestedAction: 'create_new', finalDecision: asType === 'task' ? 'approved_task' : 'approved_followup', overrideApplied: asType !== candidate.suggestedType, correctedFields: asType !== candidate.suggestedType ? ['type'] : [] }) })); queuePersist(); },
    discardIntakeCandidate: (candidateId) => { set((state: AppStore) => { const candidate = state.intakeCandidates.find((entry) => entry.id === candidateId); if (!candidate) return state; return { intakeCandidates: state.intakeCandidates.filter((entry) => entry.id !== candidateId), intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, { source: 'quick_capture', candidateId: candidate.id, candidateKind: 'quick_capture', suggestedType: candidate.suggestedType, suggestedAction: 'create_new', finalDecision: 'rejected', overrideApplied: true, correctedFields: [] }) }; }); queuePersist(); },
    saveIntakeCandidateAsReference: (candidateId) => { const candidate = get().intakeCandidates.find((entry) => entry.id === candidateId); if (!candidate) return; get().addIntakeDocument({ name: candidate.draft.title, kind: 'Text', project: candidate.detectedProject, owner: candidate.detectedOwner, sourceRef: 'Quick capture', notes: candidate.rawText, tags: ['reference'] }); set((state: AppStore) => ({ intakeCandidates: state.intakeCandidates.filter((entry) => entry.id !== candidateId), intakeReviewerFeedback: appendReviewerFeedback(state.intakeReviewerFeedback, { source: 'quick_capture', candidateId: candidate.id, candidateKind: 'quick_capture', suggestedType: candidate.suggestedType, suggestedAction: 'create_new', finalDecision: 'saved_reference', overrideApplied: true, correctedFields: [] }) })); },
    ingestIntakeFiles: async (files, source = 'drop') => { if (!files.length) return; const state = get(); const batch = buildBatchRecord([]); const parsedAssetGroups = await Promise.all(files.map((file) => parseIntakeFile(file, batch.id))); const assets = parsedAssetGroups.flat().map((asset) => ({ ...asset, source })); const candidates = assets.flatMap((asset) => buildCandidatesFromAsset(asset, state.items, state.tasks)); const assetIds = assets.filter((asset) => !asset.parentAssetId).map((asset) => asset.id); const finalizedBatch = { ...batch, assetIds, status: 'review' as const, stats: { filesProcessed: assets.length, candidatesCreated: candidates.length, highConfidence: candidates.filter((candidate) => candidate.confidence >= 0.9).length, failedParses: assets.filter((asset) => asset.parseStatus === 'failed').length, duplicatesFlagged: candidates.filter((candidate) => candidate.duplicateMatches.length > 0).length } }; set((inner: AppStore) => ({ intakeAssets: [...assets, ...inner.intakeAssets], intakeWorkCandidates: [...candidates, ...inner.intakeWorkCandidates], intakeBatches: [finalizedBatch, ...inner.intakeBatches] })); queuePersist(); },
    updateIntakeWorkCandidate: (candidateId, patch) => { set((state: AppStore) => ({ intakeWorkCandidates: state.intakeWorkCandidates.map((candidate) => { if (candidate.id !== candidateId) return candidate; const editKeys: IntakeReviewerFeedbackField[] = []; if (patch.title !== undefined && patch.title !== candidate.title) editKeys.push('title'); if (patch.project !== undefined && patch.project !== candidate.project) editKeys.push('project'); if (patch.owner !== undefined && patch.owner !== candidate.owner) editKeys.push('owner'); if (patch.assignee !== undefined && patch.assignee !== candidate.assignee) editKeys.push('assignee'); if (patch.dueDate !== undefined && patch.dueDate !== candidate.dueDate) editKeys.push('dueDate'); if (patch.priority !== undefined && patch.priority !== candidate.priority) editKeys.push('priority'); if (patch.waitingOn !== undefined && patch.waitingOn !== candidate.waitingOn) editKeys.push('waitingOn'); if (patch.nextStep !== undefined && patch.nextStep !== candidate.nextStep) editKeys.push('nextStep'); if (patch.summary !== undefined && patch.summary !== candidate.summary) editKeys.push('summary'); if (patch.candidateType !== undefined && patch.candidateType !== candidate.candidateType) editKeys.push('type'); const nextEdits = [...new Set([...(candidate.reviewEdits ?? []), ...editKeys])] as typeof candidate.reviewEdits; return { ...candidate, ...patch, reviewEdits: nextEdits, updatedAt: todayIso() }; }) })); queuePersist(); },
    decideIntakeWorkCandidate: (candidateId, decision, linkedRecordId, options) => { const state = get(); const candidate = state.intakeWorkCandidates.find((entry) => entry.id === candidateId); if (!candidate) return; if (decision === 'reject') { set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'rejected', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'rejected', overrideApplied: true, correctedFields: candidate.reviewEdits ?? [] }) })); set((latest: AppStore) => recomputeAllBatchStats(latest)); queuePersist(); return; }
      if (decision === 'reference') { state.addIntakeDocument({ name: candidate.title, kind: 'Text', project: candidate.project, owner: candidate.owner, sourceRef: `Intake asset ${candidate.assetId}`, notes: candidate.summary, tags: ['intake', 'reference'] }); set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'reference', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'saved_reference', overrideApplied: true, correctedFields: candidate.reviewEdits ?? [] }) })); set((latest: AppStore) => recomputeAllBatchStats(latest)); queuePersist(); return; }
      if (decision === 'link' && linkedRecordId) {
        set((inner: AppStore) => ({
          items: inner.items.map((item) => item.id === linkedRecordId ? enrichFollowUpFromIntakeLink(item, candidate) : item),
          tasks: inner.tasks.map((task) => task.id === linkedRecordId ? enrichTaskFromIntakeLink(task, candidate) : task),
          intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, linkedRecordId, approvalStatus: 'linked', updatedAt: todayIso() } : entry),
          intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'linked_existing', overrideApplied: true, correctedFields: [...(candidate.reviewEdits ?? []), 'linking_decision'] }),
        }));
        set((latest: AppStore) => recomputeAllBatchStats(latest));
        queuePersist();
        return;
      }
      const safety = evaluateIntakeImportSafety(candidate);
      if ((decision === 'approve_task' || decision === 'approve_followup') && !safety.safeToCreateNew && !options?.overrideUnsafeCreate) return;
      if (decision === 'approve_task') {
        const integrity = enforceCandidateApprovalIntegrity(candidateId, 'task');
        if (!integrity.allowed && !options?.overrideUnsafeCreate) {
          set((inner: AppStore) => ({
            intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? {
              ...entry,
              approvalStatus: 'pending',
              warnings: [...new Set([...(entry.warnings || []), ...integrity.reasons])],
              updatedAt: todayIso(),
            } : entry),
          }));
          queuePersist();
          return;
        }
        const id = createId('TSK');
        state.addTask({ ...(integrity.draft as TaskItem), id });
        set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, createdRecordId: id, approvalStatus: 'imported', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'approved_task', overrideApplied: candidate.candidateType !== 'task', correctedFields: [...(candidate.reviewEdits ?? []), ...(candidate.candidateType !== 'task' ? (['type'] as IntakeReviewerFeedbackField[]) : [])], duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate }) }));
        set((latest: AppStore) => recomputeAllBatchStats(latest));
        queuePersist();
        return;
      }
      const integrity = enforceCandidateApprovalIntegrity(candidateId, 'followup');
      if (!integrity.allowed && !options?.overrideUnsafeCreate) {
        set((inner: AppStore) => ({
          intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? {
            ...entry,
            approvalStatus: 'pending',
            warnings: [...new Set([...(entry.warnings || []), ...integrity.reasons])],
            updatedAt: todayIso(),
          } : entry),
        }));
        queuePersist();
        return;
      }
      const followupId = createId();
      state.addItem({ ...(integrity.draft as FollowUpItem), id: followupId });
      set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, createdRecordId: followupId, approvalStatus: 'imported', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'approved_followup', overrideApplied: candidate.candidateType !== 'followup', correctedFields: [...(candidate.reviewEdits ?? []), ...(candidate.candidateType !== 'followup' ? (['type'] as IntakeReviewerFeedbackField[]) : [])], duplicateRiskOverride: !safety.safeToCreateNew && !!options?.overrideUnsafeCreate }) }));
      set((latest: AppStore) => recomputeAllBatchStats(latest));
      queuePersist();
    },
    batchApproveHighConfidence: () => { const state = get(); state.intakeWorkCandidates.filter((candidate) => candidate.approvalStatus === 'pending' && evaluateIntakeImportSafety(candidate).safeToBatchApprove).forEach((candidate) => { const action = candidate.candidateType === 'task' || candidate.candidateType === 'update_existing_task' ? 'approve_task' : 'approve_followup'; state.decideIntakeWorkCandidate(candidate.id, action); }); },

    ingestIntakeText: async (rawText, titleHint) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;
      const normalizedTitle = (titleHint || `Pasted intake ${todayIso()}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'pasted-note';
      const file = new File([trimmed], `${normalizedTitle}.txt`, { type: 'text/plain' });
      await get().ingestIntakeFiles([file], 'manual_paste');
    },
    archiveIntakeBatch: (batchId) => {
      set((state: AppStore) => ({ intakeBatches: state.intakeBatches.map((batch) => batch.id === batchId ? { ...batch, status: 'archived' } : batch) }));
      set((latest: AppStore) => recomputeAllBatchStats(latest));
      queuePersist();
    },
    clearFinalizedIntakeCandidates: (batchId) => {
      set((state: AppStore) => ({ intakeWorkCandidates: state.intakeWorkCandidates.filter((candidate) => {
        if (candidate.approvalStatus === 'pending') return true;
        return batchId ? candidate.batchId !== batchId : false;
      }) }));
      set((latest: AppStore) => recomputeAllBatchStats(latest));
      queuePersist();
    },
    removeIntakeAsset: (assetId) => {
      set((state: AppStore) => {
        const removedIds = new Set([assetId]);
        state.intakeAssets.filter((asset) => asset.parentAssetId === assetId || asset.rootAssetId === assetId).forEach((asset) => removedIds.add(asset.id));
        return {
          intakeAssets: state.intakeAssets.filter((asset) => !removedIds.has(asset.id)),
          intakeWorkCandidates: state.intakeWorkCandidates.filter((candidate) => !removedIds.has(candidate.assetId)),
          intakeBatches: state.intakeBatches.map((batch) => ({ ...batch, assetIds: batch.assetIds.filter((id) => !removedIds.has(id)) })),
        };
      });
      set((latest: AppStore) => recomputeAllBatchStats(latest));
      queuePersist();
    },
    retryIntakeAssetParse: async (assetId) => {
      const state = get();
      const asset = state.intakeAssets.find((entry) => entry.id === assetId);
      if (!asset) return;
      if (!asset.retrySource) {
        set((inner: AppStore) => ({ intakeAssets: inner.intakeAssets.map((entry) => entry.id === assetId ? { ...entry, lastRetryAt: todayIso(), lastRetryStatus: 'failed', lastRetryMessage: asset.retryUnavailableReason || 'Retry source not available for this legacy asset.' } : entry) }));
        queuePersist();
        return;
      }
      const retryFile = fileFromIntakeRetrySource(asset.retrySource);
      const reparsed = await parseIntakeFile(retryFile, asset.batchId);
      const reparsedAsset = reparsed.find((entry) => !entry.parentAssetId);
      if (!reparsedAsset) {
        set((inner: AppStore) => ({ intakeAssets: inner.intakeAssets.map((entry) => entry.id === assetId ? { ...entry, lastRetryAt: todayIso(), lastRetryStatus: 'failed', lastRetryMessage: 'Retry parse returned no root asset.' } : entry) }));
        queuePersist();
        return;
      }
      const candidates = buildCandidatesFromAsset(reparsedAsset, state.items, state.tasks);
      set((inner: AppStore) => ({
        intakeAssets: [{ ...reparsedAsset, id: assetId, lastRetryAt: todayIso(), lastRetryStatus: reparsedAsset.parseStatus === 'failed' ? 'failed' : 'success', lastRetryMessage: reparsedAsset.parseStatus === 'failed' ? (reparsedAsset.errors[0] || 'Retry parse failed.') : 'Retry parse completed from original upload bytes.' }, ...inner.intakeAssets.filter((entry) => entry.id !== assetId && entry.parentAssetId !== assetId && entry.rootAssetId !== assetId)],
        intakeWorkCandidates: [...candidates.map((candidate) => ({ ...candidate, assetId })), ...inner.intakeWorkCandidates.filter((entry) => entry.assetId !== assetId)],
      }));
      set((latest: AppStore) => recomputeAllBatchStats(latest));
      queuePersist();
    },
    deleteIntakeBatchIfEmpty: (batchId) => {
      set((state: AppStore) => {
        const hasAssets = state.intakeAssets.some((asset) => asset.batchId === batchId);
        const hasCandidates = state.intakeWorkCandidates.some((candidate) => candidate.batchId === batchId);
        if (hasAssets || hasCandidates) return state;
        return { intakeBatches: state.intakeBatches.filter((batch) => batch.id !== batchId) };
      });
      queuePersist();
    },

  };
}
