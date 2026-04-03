# Changelog

## 2026-04-03

### Phase 1 UI foundation overhaul
- Standardized the app-wide visual token system in `src/index.css` with reusable variables for canvas/surfaces, borders, text hierarchy, brand accents, semantic states, shadows, radii, and spacing rhythm to reduce style drift.
- Expanded shared UI primitives in `src/components/ui/AppPrimitives.tsx` with consistent button, panel, badge, nav item, segmented control, and workspace meta-pill building blocks.
- Rebuilt the authenticated app shell in `src/App.tsx` and CSS with improved shell framing, premium navigation rail treatment, stronger workspace header hierarchy, and more deliberate action/meta alignment.
- Applied global interaction polish for hover/focus/selected states, control readability, and surface contrast across shared buttons, inputs, cards, and shell-level components.

### Trust and execution upgrades
- Reworked universal intake matching into a document-oriented review pipeline with richer field confidence/evidence and upgraded duplicate/update/link scoring across title, project, due-date proximity, waiting-on overlap, summary, and source references (`src/lib/intake/reviewPipeline.ts`, `src/lib/universalIntake.ts`).
- Upgraded Universal Intake Workspace to support high-confidence vs needs-review queues, apply-and-next behavior, and keyboard-driven review actions for faster safe triage (`src/components/UniversalIntakeWorkspace.tsx`).
- Expanded follow-up outbound drafting with recipients/templates, send-history proof visibility, and structured send confirmation metadata to improve outbound trust (`src/components/FollowUpDraftModal.tsx`, `src/lib/outboundMessages.ts`).
- Added canonical entity normalization helpers for projects/contacts/companies with alias-merging support to reduce identity drift (`src/lib/entities.ts`, `src/types.ts`).
- Added a safer bulk action flow in the execution cockpit with preview, warning surface, and undo for recent bulk updates (`src/lib/bulkActions.ts`, `src/components/OverviewPage.tsx`).
- Added targeted self-check coverage for intake scoring, entity normalization, outbound transitions, and bulk preview/apply semantics (`src/lib/__tests__/trust-upgrades.test.ts`).
