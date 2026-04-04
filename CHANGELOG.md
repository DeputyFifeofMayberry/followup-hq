# Changelog

## 2026-04-04

### Deficiency 2 Phase 2: correction workflow hardening follow-through
- Tightened queue operational ranking with clearer next-step hints and stronger weighting for blockers, duplicate risk, and easy-win approvals so reviewers can process pending items in a deliberate order (`src/lib/intakeReviewQueue.ts`).
- Added reviewer action-hint helpers for high-signal field triage (reason, recommended next step, and blocker emphasis), then wired those outputs directly into Intake Review so weak/conflicting fields are explicit and actionable (`src/lib/intakeEvidence.ts`, `src/components/UniversalIntakeWorkspace.tsx`).
- Reworked the intake review workspace into a more guided left/center/right correction flow with inline field-status context, stronger readiness messaging, clearer decision emphasis, safer override presentation, and side-by-side match comparison ergonomics (`src/components/UniversalIntakeWorkspace.tsx`).

### Deficiency 2 Phase 2: intake review correction workbench
- Reframed the Universal Intake workspace into a reviewer-first three-zone flow (prioritized review queue, guided candidate correction form, and evidence/match/safety inspector) so reviewers can correct weak fields and make decisions faster in one pass (`src/components/UniversalIntakeWorkspace.tsx`).
- Added explicit review-readiness and operational priority shaping in intake queue construction (`ready to approve`, `ready after correction`, `needs link decision`, `reference likely`, `unsafe to create`) to better prioritize correction, duplicate handling, and quick wins (`src/lib/intakeReviewQueue.ts`).
- Expanded field-review helpers with actionable reviewer hints, top reasons, and candidate-vs-existing compare rows so the UI can answer “why weak” and “what next” directly during correction (`src/lib/intakeEvidence.ts`).
- Extended reviewer edit tracking to include type, assignee, priority, waiting on, and summary corrections so review decisions capture richer correction intent (`src/store/useAppStore.ts`, `src/types.ts`).

### Deficiency 2 Phase 1: trustworthy Quick Add foundation
- Replaced the old heuristic-only Quick Add parsing path with a layered parser foundation in `src/lib/universalCapture.ts` (normalize input, explicit token extraction, known entity matching, kind/due/priority inference, title and next-step derivation, field-level evidence, and confidence calculation).
- Added context-aware project/owner matching priority so explicit tokens win first, then active context, then known exact/fuzzy entity matches, then recent-entry fallback—with explicit field evidence showing where each choice came from.
- Expanded capture parse output to include field-level evidence (status, confidence, source, and reasons), parser notes, and normalized token output so downstream UI/review flows can explain parser decisions instead of only showing a single confidence score.
- Tightened direct import gating in Quick Add by requiring strong title + kind confidence, safe ownership/project detection, and no conflicts before auto-import; otherwise capture routes to Intake Review with clearer warning language.
- Updated Quick Add parse preview messaging and field trust UI to show evidence status (explicit/matched/contextual/inferred/missing) and stronger direct-import vs review-needed trust cues (`src/components/UniversalCapture.tsx`, `src/lib/intakeEvidence.ts`).

### Phase 3 single daily cockpit overhaul (execution-lane cohesion)
- Reworked Follow Ups and Tasks into clearer sibling execution lanes with the same rhythm: compact summary strip, focused control row, queue-first list area, contextual state strip, and right-side inspector action depth (`src/App.tsx`, `src/components/ControlBar.tsx`, `src/components/TaskWorkspace.tsx`).
- Reduced default control-surface density in both lanes by keeping search + top filters visible and moving lower-frequency filters/saved-view management behind `View options` progressive disclosure (`src/components/ControlBar.tsx`, `src/components/TaskWorkspace.tsx`).
- Standardized row action hierarchy across lanes by trimming inline actions to high-frequency quick actions (Follow Ups: nudge + next touch; Tasks: done + block/unblock) while emphasizing inspector-driven context-heavy decisions (`src/components/TrackerTable.tsx`, `src/components/TaskWorkspace.tsx`).
- Tightened lane-purpose copy so Overview remains triage while Follow Ups and Tasks read as explicit execution lanes with clearer inspector-first guidance (`src/App.tsx`, `src/components/ControlBar.tsx`, `src/components/TaskWorkspace.tsx`).
- Unified visual grammar for execution controls, list rows, and contextual batch/foot strips to reduce cross-workspace drift and strengthen one-product cohesion (`src/styles/workspaces.css`).

### Phase 2 single daily cockpit overhaul (Overview simplification + triage-first flow)
- Reworked `src/components/OverviewPage.tsx` into a clearer four-part cockpit flow: compact daily focus strip, explicit triage action row, calmer primary queue surface with progressive disclosure, and a tighter action-led inspector.
- Reduced default Overview control density by keeping preset/search/sort visible while moving density, advanced filters, date constraints, owner/assignee filters, and saved views into a single `View options` disclosure panel.
- Refined queue scan hierarchy by emphasizing title-first rows with constrained secondary metadata, lighter chip clusters, concise urgency reasons, and detailed-only supplemental context.
- Cleaned up selection state and bulk action presentation so temporary bulk controls only appear when rows are selected and prioritize core actions first (`close`, `done`, `nudge`, `snooze`) with secondary actions de-emphasized.
- Tightened visual rhythm and hierarchy in workspace styling for Overview strips, controls, row scan patterns, and inspector context blocks to reduce nested-box heaviness and improve first-paint calm (`src/styles/workspaces.css`).

### Phase 1 single daily cockpit foundation (IA + shell hierarchy)
- Centralized workspace IA metadata in `src/lib/appModeConfig.ts` with a single workspace contract (label, purpose, category, daily-start flag, universal-capture visibility, primary action, and health label builder), while preserving existing internal workspace keys and mode behavior.
- Refactored `src/App.tsx` to consume centralized workspace metadata for navigation sections, header copy, command palette workspace commands, and per-workspace primary actions, removing the duplicate inline shell workspace definitions.
- Standardized user-facing naming so the `worklist` workspace is consistently presented as **Overview** and reinforced as the start-of-day surface with explicit shell/nav treatment.
- Tightened shell hierarchy styling by strengthening core-vs-support nav separation, adding support mute behavior in personal mode, introducing a dedicated "Start here" nav indicator, and reducing header copy competition (`src/styles/shell.css`, `src/styles/workspaces.css`).
- Updated lingering UI copy that still referenced "worklist" in user-facing text (`src/components/PersonalAgendaBoard.tsx`).

## 2026-04-03

### Phase 8 final graphics pass (left rail typography/color fix first)
- Rebuilt left navigation rail typography and state hierarchy with dedicated rail text tokens, improved brand stack rhythm, non-opacity muted states, and a purpose-built command palette trigger that now visually belongs to the dark rail (`src/index.css`, `src/App.tsx`).
- Refined rail card language for active/inactive/muted states with crisper icon-label alignment, stronger count pill treatment, and clearer readable contrast across personal and team modes (`src/index.css`, `src/App.tsx`).
- Applied one final graphics polish pass across shared UI primitives and workspace surfaces by tightening modal header typography, stat tile hierarchy, tracker table header/title typography, and command/tab chip consistency (`src/components/ui/AppPrimitives.tsx`, `src/components/OverviewPage.tsx`, `src/components/TrackerTable.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ProjectCommandCenter.tsx`, `src/components/RelationshipBoard.tsx`, `src/components/OutlookPanel.tsx`, `src/components/ItemDetailPanel.tsx`, `src/index.css`).

### Phase 8 final visual consolidation and subtractive reset
- Removed stacked material override generations in `src/index.css` and replaced them with one consolidated authenticated surface model (shell, hero, command, data, row, inspector, muted, modal, warning) so the app no longer relies on conflicting legacy white-first vs premium vs Phase 7 layers.
- Re-based shared row and dense-work patterns onto a single row family and active-state treatment used by overview queue rows, tracker rows, task rows, project cards, relationship rows, and linked-entity rows, reducing duplicate row/card assumptions across pages.
- Consolidated control/form/modal materials into one consistent input/control + modal hierarchy and removed additive per-page command-surface overrides that were fighting shared primitives.
- Tightened primitive ownership by adding `SurfaceBlock` in `AppPrimitives` and using primitive-driven support blocks in intake messaging surfaces while removing redundant app-shell-card stacking in component markup.
- Simplified page component class usage to avoid duplicate row/surface wrappers (overview toolbar, tracker rows, task rows, project cards, relationship rows, item detail cards), making the primitive/CSS system the single visual source of truth.

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
