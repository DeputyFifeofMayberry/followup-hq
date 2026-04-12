import { deriveRecordSaveStatusModel } from '../recordSaveStatus';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testRecordDoesNotShowSavingForOtherRecords(): void {
  const model = deriveRecordSaveStatusModel({
    canonicalStage: 'saving',
    canonicalStageLabel: 'Saving',
    canonicalStageDescription: 'Saving',
    isDirty: false,
    isEditingSurface: false,
    hasLocalUnsavedChanges: true,
    hasConflict: false,
    isSyncSaving: true,
    persistenceMode: 'supabase',
    ledger: {
      type: 'followup',
      id: 'abc',
      lastCloudConfirmedRevision: 3,
      lastCloudConfirmedAt: '2026-04-12T10:00:00.000Z',
    },
  });
  assert(model.stage === 'cloud-confirmed', `expected clean unrelated record to stay cloud-confirmed, got ${model.stage}`);
}

(function run() {
  testRecordDoesNotShowSavingForOtherRecords();
})();
