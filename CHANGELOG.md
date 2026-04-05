# Changelog

## 2026-04-04

### Deficiency 2 Phase 1: save/sync trust visibility foundation
- Added a shared save/sync status language helper that maps internal persistence + sync meta state (`hydrated`, `persistenceMode`, `syncState`, `saveError`) into consistent user-facing labels, descriptions, and tones so shell and secondary surfaces use one trust vocabulary (`src/lib/syncStatus.ts`, `src/components/PersistenceBanner.tsx`).
- Added a compact shell-level Save & sync status control in the workspace header with an always-available indicator and an on-demand detail panel that explains current save state, persistence mode (`Supabase-backed` vs `Browser/local only`), last successful sync time, and the latest save error when present (`src/components/SyncStatusControl.tsx`, `src/App.tsx`, `src/styles/primitives.css`).
- Preserved existing persistence queue behavior and callbacks while making trust state visible without introducing noisy save toasts or changing underlying save architecture in this phase (`src/store/persistenceQueue.ts`, `src/store/useAppStore.ts`).

### Deficiency 1 Phase 5: closeout orchestration + readiness explanations
- Added a shared follow-up closeout readiness evaluator that centralizes hard blockers, override-required conditions, warnings, and ready signals with plain-language explanations (open/blocked/overdue child tasks, missing completion context, unresolved waiting state, and intake-review ambiguity) to power cross-record close decisions consistently (`src/lib/closeoutReadiness.ts`).
- Updated follow-up transition validation to consume centralized closeout readiness logic for close transitions, preserving current transition APIs while making override requirements and blocker/warning messaging consistent and explainable (`src/lib/workflowPolicy.ts`).
- Introduced a reusable closeout readiness UI card and surfaced it across key execution surfaces so users can see why closure is blocked, what can close with override, and what to do next (open blocking child task, add completion note, review linked records) (`src/components/CloseoutReadinessCard.tsx`, `src/components/ItemDetailPanel.tsx`, `src/components/UniversalRecordDrawer.tsx`, `src/components/OverviewPage.tsx`, `src/components/TaskWorkspace.tsx`).

### Deficiency 1 Phase 4: global record search + expanded command palette navigation
- Added a typed global in-memory record search index that reuses shared record descriptors (`toRecordDescriptor`) across follow-ups, tasks, projects, contacts, and companies, plus lightweight linked-reference hints for command-driven record jumps (`src/lib/commandPaletteConfig.ts`, `src/lib/recordContext.ts`).
- Expanded command palette coverage from create/workspace only into a grouped command system (Create, Navigation, Records, Workspaces) with direct record open, linked-record jump commands, project context open commands, and “open selected item in universal drawer” behavior while keeping existing workspace/open-create actions intact (`src/lib/commandPaletteConfig.ts`, `src/App.tsx`).
- Upgraded command matching from simple substring checks to ranked matching with exact/starts-with/token-aware scoring and record/context-aware search text so object navigation is faster and more relevant (`src/lib/commandPaletteConfig.ts`).
- Updated command palette rendering to show grouped result sections and contextual subtitles so users can quickly distinguish record type/context before opening (`src/App.tsx`).

### Deficiency 1 Phase 3: relationship-aware actions + parent/child rollups
- Added shared child-work rollup helpers that centralize linked-task counts, blocked/overdue/ready signals, and explicit readiness explanations so follow-up readiness messaging is derived consistently in one place (`src/lib/childWorkRollups.ts`, `src/domains/tasks/helpers.ts`, `src/lib/workflowPolicy.ts`).
- Extended follow-up and task detail experiences with relationship-aware operations (create child task from parent, link/unlink existing task-child relationships, open parent from child, open child from parent) while preserving existing creation/edit flows (`src/components/ItemDetailPanel.tsx`, `src/components/TaskWorkspace.tsx`).
- Upgraded the universal record drawer to surface parent/child relationship actions and rollup explanations directly in the shared detail shell for clearer cross-record execution context (`src/components/UniversalRecordDrawer.tsx`).
- Improved lane-level linked-task visibility by adding explicit blocked/overdue/all-done reason messaging in follow-up table linked-task summaries instead of implicit counts alone (`src/components/TrackerTable.tsx`).

### Deficiency 1 Phase 2: universal record drawer / detail shell
- Added a global universal record drawer surface with a consistent detail shell (Summary, Linked records, Timeline/history, Context/metadata) that can open from anywhere and navigate between related records using the shared cross-record descriptor/bundle foundation from Phase 1 (`src/components/UniversalRecordDrawer.tsx`, `src/lib/recordContext.ts`, `src/App.tsx`).
- Added shared UI state/actions for a single source of truth for drawer context/open-close behavior, so all workspaces can launch the same cross-record detail surface without prop drilling (`src/store/state/types.ts`, `src/store/state/initialState.ts`, `src/store/types.ts`, `src/store/slices/uiSlice.ts`).
- Wired lightweight “Open record” entry hooks into key surfaces (follow-up rows, task rows, project detail linked entities, and relationship portfolio/detail linked entities) while preserving existing lane-specific inspectors and workspace behavior for low-regression rollout (`src/components/TrackerTable.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ProjectCommandCenter.tsx`, `src/components/RelationshipBoard.tsx`).
- Added drawer-specific styling that reuses existing SetPoint surface semantics while introducing a right-side object-centric detail layer (`src/styles/workspaces.css`).

### Deficiency 1 Phase 1: shared cross-record execution foundation
- Added a typed cross-record relationship module that normalizes follow-ups, tasks, projects, contacts, and companies into one record descriptor shape, plus reusable selectors for linked follow-up/task relationships, project/company/contact-linked records, related-record bundles, and shared derived counts (relationships, open/blocked/overdue child work, timeline/audit events) (`src/lib/recordContext.ts`).
- Refactored task workspace and follow-up detail inspector to consume the shared cross-record selectors for linked parent/child retrieval and related-record rollups, reducing ad hoc record lookups in component logic (`src/components/TaskWorkspace.tsx`, `src/components/ItemDetailPanel.tsx`).
- Updated project and relationship derivation selectors to route linking logic through the shared cross-record foundation so project/relationship surfaces now consume common relationship lookup behavior instead of duplicating per-surface linkage filtering (`src/lib/projectSelectors.ts`, `src/lib/relationshipSelectors.ts`, `src/components/RelationshipBoard.tsx`).

### Deficiency 3 Phase 3: architecture boundary hardening, selector/view-model APIs, and workflow regression checks
- Added explicit component-facing domain view-model hooks for execution queue, follow-ups, tasks, intake review, and projects so major workflow screens can consume shaped APIs instead of broad raw store selection (`src/domains/shared/hooks/useExecutionQueueViewModel.ts`, `src/domains/followups/hooks/useFollowUpsViewModel.ts`, `src/domains/tasks/hooks/useTasksViewModel.ts`, `src/domains/intake/hooks/useIntakeReviewViewModel.ts`, `src/domains/projects/hooks/useProjectsViewModel.ts`).
- Introduced domain boundary barrels and shared queue selectors to make public import paths clearer and to keep selector logic close to domain ownership (`src/domains/shared/selectors/executionQueueSelectors.ts`, `src/domains/shared/index.ts`, `src/domains/followups/index.ts`, `src/domains/tasks/index.ts`, `src/domains/intake/index.ts`, `src/domains/projects/index.ts`).
- Moved major workspace components toward view-model consumption (Overview queue cockpit, follow-up tracker workspace, tasks workspace, forwarding intake reviewer) to reduce direct coupling to low-level store structure while preserving `useAppStore` as the stable source of truth (`src/components/OverviewPage.tsx`, `src/components/app/TrackerWorkspace.tsx`, `src/components/TaskWorkspace.tsx`, `src/components/ForwardingIntakeWorkspace.tsx`).
- Added a dedicated automated test command and architecture-hardening checks for selector behavior, mutation-effect cross-domain sync, persistence payload shaping, intake review matching, and intake decision lifecycle action contracts (`package.json`, `src/testRunner.ts`, `src/domains/shared/selectors/__tests__/executionQueueSelectors.test.ts`, `src/domains/followups/__tests__/followUpSelectors.test.ts`, `src/store/useCases/__tests__/mutationEffects.test.ts`, `src/store/state/__tests__/persistence.test.ts`, `src/lib/intake/__tests__/reviewPipeline.test.ts`, `src/lib/__tests__/intakeLifecycle.test.ts`).


### Deficiency 3 Phase 2: store composition and domain slice ownership
- Converted `useAppStore` from a giant implementation file into composition/bootstrap wiring that assembles dedicated slices for follow-ups, tasks, projects/intake docs, relationships, intake workflows, forwarding workflows, Outlook workflows, execution view controls, UI state, and initialization/meta concerns (`src/store/useAppStore.ts`, `src/store/slices/*.ts`).
- Introduced explicit internal store composition types and slice plumbing so internal ownership is clearer (`src/store/types.ts`, `src/store/slices/types.ts`).
- Added shared mutation effect helpers to centralize repeated post-mutation recomputation chains (project derivation, project attachment, task rollups, duplicate refresh), reducing ad hoc side-effect duplication across actions (`src/store/useCases/mutationEffects.ts`).
- Preserved one public `useAppStore` API and existing persistence payload/bootstrapping behavior while moving domain mutation implementations into slice modules for safer future boundary hardening.


### Deficiency 3 Phase 1: architecture seam creation and stabilization
- Established first-pass domain seams with new domain helper/type modules for follow-ups, tasks, projects, relationships, intake, and outlook so pure business transformations are no longer buried exclusively in the monolithic store (`src/domains/followups/helpers.ts`, `src/domains/tasks/helpers.ts`, `src/domains/projects/helpers.ts`, `src/domains/relationships/helpers.ts`, `src/domains/shared/audit.ts`, `src/domains/*/types.ts`).
- Refactored `useAppStore` toward composition by extracting core pure helpers (normalization, task rollups, project derivation/attachment, duplicate refresh support, audit/reviewer builders, persisted payload shaping) into dedicated modules and introducing explicit initial-state groupings for business/ui/meta boundaries (`src/store/useAppStore.ts`, `src/store/state/initialState.ts`, `src/store/state/types.ts`, `src/store/state/persistence.ts`).
- Reduced `App.tsx` orchestration sprawl by extracting workspace rendering and tracker workspace concerns into app-level components and moving workspace/command-palette glue into dedicated helper modules (`src/components/app/WorkspaceRenderer.tsx`, `src/components/app/TrackerWorkspace.tsx`, `src/lib/workspaceRegistry.ts`, `src/lib/commandPaletteConfig.ts`, `src/App.tsx`).
- Preserved runtime behavior and persistence compatibility while creating safer seams for future Phase 2/3 extraction work; this phase intentionally keeps a single exported `useAppStore` and existing persistence contracts stable.

### Deficiency 2 Phase 3: reviewer-feedback tuning loop
- Added a deterministic intake tuning model that converts recent reviewer feedback into operational posture outputs (trust posture, automation health, source direct-import readiness, bounded confidence floors, duplicate/link caution boosts, and explicit caution flags) with source-aware and field-aware correction analytics (`src/lib/intakeTuningModel.ts`).
- Expanded tuning insights from passive chips into an explainable ops surface with correction hotspots by source, override-rate patterns, actionable thresholds, forwarding rule friction reasons, and review-safe suggestions that can be consumed by multiple workspaces (`src/lib/intakeTuningInsights.ts`).
- Wired tuning outputs into intake queue behavior so `ready now`, `batch-safe`, prioritization, and alerts now account for tuning pressure (noisy sources, due-date/project guards, duplicate caution) without hidden parser mutation (`src/lib/intakeReviewQueue.ts`).
- Upgraded Universal Intake workspace with a concise operations tuning panel showing trust/automation posture, direct-import readiness by source, noisy-rule diagnostics, and explicit caution recommendations so reviewers can see why review posture changes over time (`src/components/UniversalIntakeWorkspace.tsx`).
- Improved forwarding intake routing quality visibility by feeding the same tuning model into queue safety behavior and by surfacing rule-level friction reasons directly in the rule list (`src/components/ForwardingIntakeWorkspace.tsx`).
- Improved Quick Add trust messaging by applying tuning-based readiness floors/guards and presenting contextual “why review is recommended” posture copy tied to recent reviewer behavior (`src/components/UniversalCapture.tsx`).

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
