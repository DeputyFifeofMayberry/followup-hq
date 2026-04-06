import { buildBatchRecord, buildCandidatesFromAsset, parseIntakeFile } from '../../lib/universalIntake';
import { evaluateIntakeImportSafety } from '../../lib/intakeImportSafety';
import { appendReviewerFeedback } from '../../domains/shared/audit';
import { enforceFollowUpIntegrity, enforceTaskIntegrity, getIntegrityReasonLabel, isExecutionReady } from '../../domains/records/integrity';
import { addDaysIso, buildTouchEvent, createId, todayIso } from '../../lib/utils';
import type { FollowUpItem, IntakeReviewerFeedbackField, TaskItem } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

export function createIntakeSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'stageIntakeCandidate' | 'approveIntakeCandidate' | 'discardIntakeCandidate' | 'saveIntakeCandidateAsReference' |
  'ingestIntakeFiles' | 'updateIntakeWorkCandidate' | 'decideIntakeWorkCandidate' | 'batchApproveHighConfidence'
> {
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
    decideIntakeWorkCandidate: (candidateId, decision, linkedRecordId, options) => { const state = get(); const candidate = state.intakeWorkCandidates.find((entry) => entry.id === candidateId); if (!candidate) return; if (decision === 'reject') { set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'rejected', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'rejected', overrideApplied: true, correctedFields: candidate.reviewEdits ?? [] }) })); queuePersist(); return; }
      if (decision === 'reference') { state.addIntakeDocument({ name: candidate.title, kind: 'Text', project: candidate.project, owner: candidate.owner, sourceRef: `Intake asset ${candidate.assetId}`, notes: candidate.summary, tags: ['intake', 'reference'] }); set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, approvalStatus: 'reference', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'saved_reference', overrideApplied: true, correctedFields: candidate.reviewEdits ?? [] }) })); queuePersist(); return; }
      if (decision === 'link' && linkedRecordId) { set((inner: AppStore) => ({ intakeWorkCandidates: inner.intakeWorkCandidates.map((entry) => entry.id === candidateId ? { ...entry, linkedRecordId, approvalStatus: 'linked', updatedAt: todayIso() } : entry), intakeReviewerFeedback: appendReviewerFeedback(inner.intakeReviewerFeedback, { source: 'universal_intake', candidateId: candidate.id, candidateKind: 'intake_work', sourceAssetId: candidate.assetId, suggestedType: candidate.candidateType, suggestedAction: candidate.suggestedAction, finalDecision: 'linked_existing', overrideApplied: true, correctedFields: [...(candidate.reviewEdits ?? []), 'linking_decision'] }) })); queuePersist(); return; }
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
      queuePersist();
    },
    batchApproveHighConfidence: () => { const state = get(); state.intakeWorkCandidates.filter((candidate) => candidate.approvalStatus === 'pending' && evaluateIntakeImportSafety(candidate).safeToBatchApprove).forEach((candidate) => { const action = candidate.candidateType === 'task' || candidate.candidateType === 'update_existing_task' ? 'approve_task' : 'approve_followup'; state.decideIntakeWorkCandidate(candidate.id, action); }); },
  };
}
