# Changelog

## 2026-04-03

### Phase 7 material and color harmony rebalance
- Rebuilt authenticated surface materials around a tighter tonal system (hero/content/elevated/muted/row/inspector/modal/input) with shared CSS tokens, reducing bright-white defaults and aligning main surfaces to the graphite + amber + steel-blue shell direction (`src/index.css`).
- Reduced white dominance across high-traffic work areas by retuning list rows, data rows, tracker rows, filter/bulk strips, empty states, and inspector blocks to layered off-white/slate materials with richer selected/hover states (`src/index.css`, `src/components/TaskWorkspace.tsx`, `src/components/RelationshipBoard.tsx`).
- Harmonized controls and forms with the new material language by shifting shared input backgrounds/borders, action-button neutrals, and modal chrome/body/footer surfaces into integrated tinted materials instead of stark white panels (`src/index.css`, `src/components/OutlookPanel.tsx`).
- Updated command-heavy surfaces and support panels (Outlook tabs/chips, relationship support panels, project saved-view emphasis, loading/config states) to remove isolated white pops and maintain calmer hierarchy while preserving readability (`src/components/OutlookPanel.tsx`, `src/components/RelationshipBoard.tsx`, `src/components/ProjectCommandCenter.tsx`, `src/App.tsx`).

### Phase 6 cohesion and design-system enforcement
- Consolidated shared UI primitives around explicit surface families (`shell`, `hero`, `command`, `data`, `inspector`, `muted`, `warning`, `modal`) and applied those consistently to shell cards and modal wrappers so panels inherit one visual language by default (`src/components/ui/AppPrimitives.tsx`, `src/index.css`).
- Standardized cross-page anatomy and control rhythm in overview, task, project, relationship, and intake workspaces by aligning hero/header surfaces, toolbar/filter rows, advanced filter containers, and bulk strips (`src/components/OverviewPage.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ProjectCommandCenter.tsx`, `src/components/RelationshipBoard.tsx`, `src/components/OutlookPanel.tsx`, `src/index.css`).
- Unified row/card/list-item treatment across queue rows, table rows, task rows, project cards, and relationship rows using shared family classes for hover/selected state and padding rhythm to reduce one-off row styling drift (`src/components/OverviewPage.tsx`, `src/components/TrackerTable.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ProjectCommandCenter.tsx`, `src/components/RelationshipBoard.tsx`, `src/index.css`).
- Standardized inspector/detail surfaces for follow-up and task detail experiences by moving inspector panes onto shared inspector surfaces and common inspector block sections for facts, notes, timeline, and linked items (`src/components/ItemDetailPanel.tsx`, `src/components/TaskWorkspace.tsx`, `src/index.css`).
- Harmonized modal language further by making command palette and modal shells use the shared modal surface treatment instead of bespoke wrappers, reducing legacy modal/surface drift (`src/App.tsx`, `src/components/ui/AppPrimitives.tsx`, `src/index.css`).

### Phase 5 authenticated visual art-direction upgrade
- Re-art directed the signed-in shell with a branded graphite frame, ambient glows, premium control-spine nav rail, and stronger page chrome so authenticated screens carry the same identity quality as login (`src/App.tsx`, `src/index.css`).
- Introduced clearer material hierarchy in shared primitives with explicit command/data/inspector surfaces plus richer stat-tile tones to prevent “everything is the same white card” repetition (`src/components/ui/AppPrimitives.tsx`, `src/index.css`).
- Upgraded data-dense work surfaces (overview queue rows, tracker table headers/rows, task workspace list+inspector) with stronger selected states, richer hover/active treatment, and more deliberate contrast hierarchy (`src/components/OverviewPage.tsx`, `src/components/TrackerTable.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ItemDetailPanel.tsx`, `src/index.css`).
- Elevated project, relationship, and intake command centers with darker premium command-surface styling, improved typography contrast, and branded amber/steel accents for a more distinctive operational product feel (`src/components/ProjectCommandCenter.tsx`, `src/components/RelationshipBoard.tsx`, `src/components/OutlookPanel.tsx`, `src/index.css`).

### Phase 4 UI refinement and product hardening
- Added a final interaction/accessibility baseline in shared primitives: improved segmented-control keyboard behavior (arrow navigation + roving tab), and standardized empty-state announcements for assistive tech (`src/components/ui/AppPrimitives.tsx`).
- Polished global UI behavior for focus visibility, reduced-motion support, button press/disabled affordances, modal scroll containment, and denser table/list readability with safer wrapping at narrow widths (`src/index.css`).
- Hardened workspace shell interaction quality with clearer nav semantics, command palette dialog semantics, ESC close behavior, focus return behavior, and lightweight command filtering/no-results handling (`src/App.tsx`).
- Refined tracker table usability with sticky headers, stronger keyboard row interaction, explicit checkbox/date action labels, and improved no-results guidance (`src/components/TrackerTable.tsx`).
- Improved execution queue keyboard flow by preventing global j/k navigation from hijacking form typing, plus clearer row selection semantics for checkboxes and active queue rows (`src/components/OverviewPage.tsx`).

### Trust and execution upgrades
- Reworked universal intake matching into a document-oriented review pipeline with richer field confidence/evidence and upgraded duplicate/update/link scoring across title, project, due-date proximity, waiting-on overlap, summary, and source references (`src/lib/intake/reviewPipeline.ts`, `src/lib/universalIntake.ts`).
- Upgraded Universal Intake Workspace to support high-confidence vs needs-review queues, apply-and-next behavior, and keyboard-driven review actions for faster safe triage (`src/components/UniversalIntakeWorkspace.tsx`).
- Expanded follow-up outbound drafting with recipients/templates, send-history proof visibility, and structured send confirmation metadata to improve outbound trust (`src/components/FollowUpDraftModal.tsx`, `src/lib/outboundMessages.ts`).
- Added canonical entity normalization helpers for projects/contacts/companies with alias-merging support to reduce identity drift (`src/lib/entities.ts`, `src/types.ts`).
- Added a safer bulk action flow in the execution cockpit with preview, warning surface, and undo for recent bulk updates (`src/lib/bulkActions.ts`, `src/components/OverviewPage.tsx`).
- Added targeted self-check coverage for intake scoring, entity normalization, outbound transitions, and bulk preview/apply semantics (`src/lib/__tests__/trust-upgrades.test.ts`).

### Phase 3 UI overhaul: secondary surface polish
- Introduced a unified modal product layer with reusable modal primitives (header/body/footer, sizing variants, sticky action bars, and improved overlay treatment) and applied it across create, import, touch-log, merge, and follow-up drafting flows (`src/components/ui/AppPrimitives.tsx`, `src/index.css`, `src/components/CreateWorkModal.tsx`, `src/components/ImportWizardModal.tsx`, `src/components/TouchLogModal.tsx`, `src/components/MergeModal.tsx`, `src/components/FollowUpDraftModal.tsx`).
- Refined capture and intake polish by upgrading confidence chips, confirmation states, and intake review tray readability to better support quick decision-making (`src/components/UniversalCapture.tsx`, `src/index.css`).
- Improved Relationship workspace hierarchy and scanability with cleaner portfolio row styling, stronger active states, and clearer empty-state guidance (`src/components/RelationshipBoard.tsx`, `src/index.css`).
- Improved secondary workspace cohesion by tightening Outlook intake tab framing and aligning inspector card treatment in detail flows (`src/components/OutlookPanel.tsx`, `src/components/ItemDetailPanel.tsx`).
