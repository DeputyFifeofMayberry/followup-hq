import { createId } from '../../lib/utils';
import {
  builtInReportTemplates,
  defaultReportDraftState,
  reportDraftEquals,
  sanitizeReportDraftState,
  sanitizeSavedReportDefinition,
  sanitizeSavedReportDefinitions,
  toReportDraftState,
} from '../../lib/reports/savedDefinitions';
import type { ReportDraftPatch, ReportDraftState, SavedReportDefinition } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

function mergeDraft(current: ReportDraftState, patch: ReportDraftPatch): ReportDraftState {
  return sanitizeReportDraftState({
    reportType: patch.reportType ?? current.reportType,
    scope: {
      ...current.scope,
      ...patch.scope,
    },
    display: {
      ...current.display,
      ...patch.display,
    },
    export: {
      ...current.export,
      ...patch.export,
    },
  });
}

function toSavedDefinition(input: {
  id?: string;
  name: string;
  draft: ReportDraftState;
  isPinned?: boolean;
  isBuiltInTemplate?: boolean;
  basedOnTemplate?: SavedReportDefinition['basedOnTemplate'];
}): SavedReportDefinition {
  const now = new Date().toISOString();
  return {
    id: input.id ?? createId('REPORT'),
    name: input.name,
    reportType: input.draft.reportType,
    scope: input.draft.scope,
    display: input.draft.display,
    export: input.draft.export,
    createdAt: now,
    updatedAt: now,
    isPinned: input.isPinned ?? false,
    isBuiltInTemplate: input.isBuiltInTemplate ?? false,
    basedOnTemplate: input.basedOnTemplate,
  };
}

export function createReportDefinitionsSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'createSavedReportDefinition' | 'updateSavedReportDefinition' | 'deleteSavedReportDefinition' | 'duplicateSavedReportDefinition' |
  'pinSavedReportDefinition' | 'openSavedReportDefinition' | 'setLastOpenedReportDefinition' | 'setReportDraft' |
  'saveActiveReportDraft' | 'saveReportDraftAsNew' | 'revertActiveReportDraft'
> {
  return {
    createSavedReportDefinition: ({ name, basedOnTemplateId, draft }) => {
      const base = basedOnTemplateId
        ? get().savedReportDefinitions.find((entry) => entry.id === basedOnTemplateId)
        : undefined;
      const nextDraft = mergeDraft(base ? toReportDraftState(base) : defaultReportDraftState, draft ?? {});
      const definition = sanitizeSavedReportDefinition(toSavedDefinition({
        name,
        draft: nextDraft,
        basedOnTemplate: base?.basedOnTemplate ?? 'custom',
      }));
      set((state: AppStore) => ({
        savedReportDefinitions: sanitizeSavedReportDefinitions([definition, ...state.savedReportDefinitions]),
        activeReportDefinitionId: definition.id,
        lastOpenedReportDefinitionId: definition.id,
        reportDraft: toReportDraftState(definition),
      }));
      queuePersist();
      return definition.id;
    },
    updateSavedReportDefinition: (id, patch) => {
      let changed = false;
      set((state: AppStore) => ({
        savedReportDefinitions: state.savedReportDefinitions.map((entry) => {
          if (entry.id !== id) return entry;
          changed = true;
          const next = sanitizeSavedReportDefinition({
            ...entry,
            ...patch,
            updatedAt: new Date().toISOString(),
          });
          return next;
        }),
        reportDraft: state.activeReportDefinitionId === id
          ? mergeDraft(state.reportDraft, {
            reportType: patch.reportType,
            scope: patch.scope,
            display: patch.display,
            export: patch.export,
          })
          : state.reportDraft,
      }));
      if (changed) queuePersist();
    },
    deleteSavedReportDefinition: (id) => {
      let changed = false;
      set((state: AppStore) => {
        const target = state.savedReportDefinitions.find((entry) => entry.id === id);
        if (!target || target.isBuiltInTemplate) return state;
        changed = true;
        const remaining = sanitizeSavedReportDefinitions(state.savedReportDefinitions.filter((entry) => entry.id !== id));
        const fallback = remaining[0]?.id ?? builtInReportTemplates[0]?.id ?? null;
        const nextActive = state.activeReportDefinitionId === id ? fallback : state.activeReportDefinitionId;
        const nextLastOpened = state.lastOpenedReportDefinitionId === id ? fallback : state.lastOpenedReportDefinitionId;
        const activeDefinition = remaining.find((entry) => entry.id === nextActive) ?? remaining[0];
        return {
          savedReportDefinitions: remaining,
          activeReportDefinitionId: nextActive,
          lastOpenedReportDefinitionId: nextLastOpened,
          reportRuns: state.reportRuns.filter((run) => run.reportDefinitionId !== id),
          reportDraft: activeDefinition ? toReportDraftState(activeDefinition) : defaultReportDraftState,
        };
      });
      if (changed) queuePersist();
    },
    duplicateSavedReportDefinition: (id, name) => {
      const source = get().savedReportDefinitions.find((entry) => entry.id === id);
      if (!source) return null;
      const clone = sanitizeSavedReportDefinition(toSavedDefinition({
        name: name ?? `${source.name} Copy`,
        draft: toReportDraftState(source),
        basedOnTemplate: source.basedOnTemplate ?? 'custom',
      }));
      set((state: AppStore) => ({
        savedReportDefinitions: sanitizeSavedReportDefinitions([clone, ...state.savedReportDefinitions]),
        activeReportDefinitionId: clone.id,
        lastOpenedReportDefinitionId: clone.id,
        reportDraft: toReportDraftState(clone),
      }));
      queuePersist();
      return clone.id;
    },
    pinSavedReportDefinition: (id, pinned) => {
      let changed = false;
      set((state: AppStore) => ({
        savedReportDefinitions: state.savedReportDefinitions.map((entry) => {
          if (entry.id !== id || entry.isPinned === pinned) return entry;
          changed = true;
          return {
            ...entry,
            isPinned: pinned,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
      if (changed) queuePersist();
    },
    openSavedReportDefinition: (id) => {
      const target = get().savedReportDefinitions.find((entry) => entry.id === id);
      if (!target) return;
      set({
        activeReportDefinitionId: id,
        lastOpenedReportDefinitionId: id,
        reportDraft: toReportDraftState(target),
      });
      queuePersist();
    },
    setLastOpenedReportDefinition: (id) => {
      set({ lastOpenedReportDefinitionId: id });
      queuePersist();
    },
    setReportDraft: (patch) => {
      set((state: AppStore) => ({
        reportDraft: mergeDraft(state.reportDraft, patch),
      }));
    },
    saveActiveReportDraft: () => {
      const state = get();
      const activeId = state.activeReportDefinitionId;
      if (!activeId) return;
      let changed = false;
      set((current: AppStore) => ({
        savedReportDefinitions: current.savedReportDefinitions.map((entry) => {
          if (entry.id !== activeId || entry.isBuiltInTemplate) return entry;
          const nextDraft = mergeDraft(toReportDraftState(entry), current.reportDraft);
          changed = true;
          return {
            ...entry,
            reportType: nextDraft.reportType,
            scope: nextDraft.scope,
            display: nextDraft.display,
            export: nextDraft.export,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
      if (changed) queuePersist();
    },
    saveReportDraftAsNew: (name) => {
      const state = get();
      const active = state.savedReportDefinitions.find((entry) => entry.id === state.activeReportDefinitionId);
      const definition = sanitizeSavedReportDefinition(toSavedDefinition({
        name,
        draft: sanitizeReportDraftState(state.reportDraft),
        basedOnTemplate: active?.basedOnTemplate ?? 'custom',
      }));
      set((current: AppStore) => ({
        savedReportDefinitions: sanitizeSavedReportDefinitions([definition, ...current.savedReportDefinitions]),
        activeReportDefinitionId: definition.id,
        lastOpenedReportDefinitionId: definition.id,
        reportDraft: toReportDraftState(definition),
      }));
      queuePersist();
      return definition.id;
    },
    revertActiveReportDraft: () => {
      const state = get();
      const active = state.savedReportDefinitions.find((entry) => entry.id === state.activeReportDefinitionId);
      if (!active) return;
      const saved = toReportDraftState(active);
      if (reportDraftEquals(saved, state.reportDraft)) return;
      set({ reportDraft: saved });
    },
  };
}
