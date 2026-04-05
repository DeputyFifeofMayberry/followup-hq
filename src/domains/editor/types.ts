import type { RecordRef } from '../../lib/recordContext';

export type RecordEditorMode = 'create' | 'edit';
export type RecordEditorSurface = 'lane' | 'context_drawer' | 'workspace' | 'full_editor' | 'transition_flow' | 'capture';

export interface RecordEditorFieldConfig<TDraft> {
  key: keyof TDraft;
  label: string;
  required?: boolean;
  sectionKey: string;
}

export interface RecordEditorSectionConfig {
  key: string;
  label: string;
  description?: string;
}

export interface RecordEditorValidationIssue<TDraft> {
  field: keyof TDraft;
  message: string;
}

export interface RecordEditorValidationResult<TDraft> {
  valid: boolean;
  issues: Array<RecordEditorValidationIssue<TDraft>>;
}

export interface RecordEditorSavePayload<TPayload> {
  mode: RecordEditorMode;
  changedFieldCount: number;
  payload: TPayload;
}

export interface RecordEditorSession<TRecord, TDraft, TPayload> {
  sessionId: string;
  recordRef: RecordRef;
  mode: RecordEditorMode;
  sourceSurface?: RecordEditorSurface;
  sourceRef?: RecordRef | null;
  adapterKey: string;
  initialRecord: TRecord | null;
  initialDraft: TDraft;
  draft: TDraft;
  dirtyFieldKeys: Array<keyof TDraft>;
  dirty: boolean;
  validation: RecordEditorValidationResult<TDraft>;
  savePayload: RecordEditorSavePayload<TPayload> | null;
}

export interface RecordTypeEditorAdapter<TRecord, TDraft, TPayload> {
  key: string;
  recordType: RecordRef['type'];
  label: string;
  sections: RecordEditorSectionConfig[];
  fields: Array<RecordEditorFieldConfig<TDraft>>;
  createEmptyDraft: () => TDraft;
  toDraft: (record: TRecord) => TDraft;
  validateDraft: (draft: TDraft) => RecordEditorValidationResult<TDraft>;
  toSavePayload: (draft: TDraft, context: { mode: RecordEditorMode; record: TRecord | null; changedFields: Array<keyof TDraft> }) => TPayload;
}
