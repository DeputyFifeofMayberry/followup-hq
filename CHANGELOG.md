# Changelog

## 2026-04-03

### Trust and execution upgrades
- Reworked universal intake matching into a document-oriented review pipeline with richer field confidence/evidence and upgraded duplicate/update/link scoring across title, project, due-date proximity, waiting-on overlap, summary, and source references (`src/lib/intake/reviewPipeline.ts`, `src/lib/universalIntake.ts`).
- Upgraded Universal Intake Workspace to support high-confidence vs needs-review queues, apply-and-next behavior, and keyboard-driven review actions for faster safe triage (`src/components/UniversalIntakeWorkspace.tsx`).
- Expanded follow-up outbound drafting with recipients/templates, send-history proof visibility, and structured send confirmation metadata to improve outbound trust (`src/components/FollowUpDraftModal.tsx`, `src/lib/outboundMessages.ts`).
- Added canonical entity normalization helpers for projects/contacts/companies with alias-merging support to reduce identity drift (`src/lib/entities.ts`, `src/types.ts`).
- Added a safer bulk action flow in the execution cockpit with preview, warning surface, and undo for recent bulk updates (`src/lib/bulkActions.ts`, `src/components/OverviewPage.tsx`).
- Added targeted self-check coverage for intake scoring, entity normalization, outbound transitions, and bulk preview/apply semantics (`src/lib/__tests__/trust-upgrades.test.ts`).

### Phase 2 execution workspace redesign
- Redesigned the Overview daily execution queue with lighter top hierarchy, primary-vs-advanced control separation, premium row styling, and a more intentional queue inspector action panel (`src/components/OverviewPage.tsx`, `src/index.css`).
- Upgraded the Follow-Up tracker into a polished execution table with stronger sticky header, row states, quick-action grouping, and in-view summary stats (`src/components/TrackerTable.tsx`, `src/index.css`).
- Refined Task Workspace controls, list rows, and inspector grouping to reduce clutter while preserving all execution functionality and dense operational context (`src/components/TaskWorkspace.tsx`, `src/index.css`).
- Re-composed Project Command Center into a more cohesive command surface with better project rail, detail hierarchy, health scanning, and cleaner action/list subpanels (`src/components/ProjectCommandCenter.tsx`, `src/index.css`).
- Added shared page-level styling updates to improve control density, spacing rhythm, selected states, and consistent premium surface treatment across execution screens (`src/index.css`).
