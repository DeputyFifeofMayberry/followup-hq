import { createId } from '../../lib/utils';
import type {
  RecordEditorSession,
  RecordEditorValidationResult,
  RecordTypeEditorAdapter,
  RecordEditorMode,
  RecordEditorSurface,
  RecordEditorSavePayload,
} from './types';
import type { RecordRef } from '../../lib/recordContext';

function shallowEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function computeDirtyFields<TDraft>(initialDraft: TDraft, draft: TDraft): Array<keyof TDraft> {
  const keys = Array.from(new Set([...Object.keys(initialDraft as object), ...Object.keys(draft as object)])) as Array<keyof TDraft>;
  return keys.filter((key) => !shallowEqual(initialDraft[key], draft[key]));
}

export function buildSavePayload<TRecord, TDraft, TPayload>(
  adapter: RecordTypeEditorAdapter<TRecord, TDraft, TPayload>,
  mode: RecordEditorMode,
  record: TRecord | null,
  draft: TDraft,
  dirtyFieldKeys: Array<keyof TDraft>,
): RecordEditorSavePayload<TPayload> | null {
  if (mode === 'edit' && dirtyFieldKeys.length === 0) return null;
  return {
    mode,
    changedFieldCount: dirtyFieldKeys.length,
    payload: adapter.toSavePayload(draft, { mode, record, changedFields: dirtyFieldKeys }),
  };
}

export function createRecordEditorSession<TRecord, TDraft, TPayload>(params: {
  adapter: RecordTypeEditorAdapter<TRecord, TDraft, TPayload>;
  recordRef: RecordRef;
  mode: RecordEditorMode;
  record?: TRecord | null;
  sourceSurface?: RecordEditorSurface;
  sourceRef?: RecordRef | null;
}): RecordEditorSession<TRecord, TDraft, TPayload> {
  const { adapter, mode, record } = params;
  const baseDraft = mode === 'edit' && record ? adapter.toDraft(record) : adapter.createEmptyDraft();
  const validation = adapter.validateDraft(baseDraft);
  const dirtyFieldKeys: Array<keyof TDraft> = [];
  return {
    sessionId: createId('EDS'),
    recordRef: params.recordRef,
    mode,
    sourceSurface: params.sourceSurface,
    sourceRef: params.sourceRef,
    adapterKey: adapter.key,
    initialRecord: record ?? null,
    initialDraft: baseDraft,
    draft: baseDraft,
    dirtyFieldKeys,
    dirty: false,
    validation,
    savePayload: buildSavePayload(adapter, mode, record ?? null, baseDraft, dirtyFieldKeys),
  };
}

export function updateRecordEditorDraft<TRecord, TDraft, TPayload>(
  session: RecordEditorSession<TRecord, TDraft, TPayload>,
  adapter: RecordTypeEditorAdapter<TRecord, TDraft, TPayload>,
  updater: (draft: TDraft) => TDraft,
): RecordEditorSession<TRecord, TDraft, TPayload> {
  const nextDraft = updater(session.draft);
  const dirtyFieldKeys = computeDirtyFields(session.initialDraft, nextDraft);
  const validation: RecordEditorValidationResult<TDraft> = adapter.validateDraft(nextDraft);
  return {
    ...session,
    draft: nextDraft,
    dirtyFieldKeys,
    dirty: dirtyFieldKeys.length > 0,
    validation,
    savePayload: buildSavePayload(adapter, session.mode, session.initialRecord, nextDraft, dirtyFieldKeys),
  };
}

export function resetRecordEditorDraft<TRecord, TDraft, TPayload>(
  session: RecordEditorSession<TRecord, TDraft, TPayload>,
  adapter: RecordTypeEditorAdapter<TRecord, TDraft, TPayload>,
): RecordEditorSession<TRecord, TDraft, TPayload> {
  const validation = adapter.validateDraft(session.initialDraft);
  return {
    ...session,
    draft: session.initialDraft,
    dirtyFieldKeys: [],
    dirty: false,
    validation,
    savePayload: null,
  };
}

export function commitRecordEditorSave<TRecord, TDraft, TPayload>(
  session: RecordEditorSession<TRecord, TDraft, TPayload>,
  adapter: RecordTypeEditorAdapter<TRecord, TDraft, TPayload>,
): RecordEditorSession<TRecord, TDraft, TPayload> {
  const validation = adapter.validateDraft(session.draft);
  return {
    ...session,
    initialDraft: session.draft,
    dirtyFieldKeys: [],
    dirty: false,
    validation,
    savePayload: null,
  };
}
