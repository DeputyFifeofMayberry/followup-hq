# AGENTS.md

## Mission
Build SetPoint / FollowUpHQ into a polished, dependable daily workflow tool.

Do not optimize for activity.
Optimize for meaningful product progress.

Every change should improve at least one of:
- trust
- clarity
- speed
- reliability
- daily usability

---

## Core standard
Do not make small, safe changes by default.

Find the highest-leverage problem in the requested area and solve it properly.

Always ask:
- What is the biggest real problem here?
- Why does it matter in repeated daily use?
- Is this a root-cause fix or a symptom fix?
- What change would most improve the product?

Reject low-leverage patches unless clearly justified.

---

## Product intent
This is not a demo app.

It is a serious workflow tool for capturing, organizing, triaging, and completing follow-ups, tasks, intake items, and project work.

The product should feel:
- professional
- clear
- fast
- stable
- intentional

When choosing between “works” and “good enough to rely on,” choose the latter.

---

## Required process
For any non-trivial task:

1. Read the real implementation first.
2. Trace the affected workflow from start to finish.
3. Identify the main bug, friction point, or trust gap.
4. Solve the real problem, not just the visible symptom.
5. Keep the fix coherent across the feature.
6. Verify with the strongest relevant checks available.
7. Update docs if behavior changed.
8. Update `CHANGELOG.md` whenever code changes are made.

Do not claim something is fixed unless it was actually verified.

If verification is limited, state exactly:
- what was checked
- what was not checked
- what remains uncertain

---

## Scope rules
Do not widen scope carelessly.

But do not keep scope artificially small when the real fix crosses:
- multiple components
- layout containers
- shared UI primitives
- state boundaries
- validation logic
- persistence paths

Prefer the smallest change that fully solves the real problem.
Do not prefer the smallest diff if it leaves the issue in place.

---

## What to inspect first
Use the repository structure as the source of truth.

Key areas:
- `src/` = main app
- `src-tauri/` = desktop shell behavior
- `e2e/` = end-to-end and visual verification
- `scripts/` = support scripts
- `supabase/migrations/` = schema and persistence history
- `package.json` = commands
- `README.md` = current setup and product guidance
- `DEVELOPER_NOTES.md` = developer guidance
- `CHANGELOG.md` = required update target

Before changing a feature, identify:
- page or route entry point
- parent layout wrapper
- feature container
- main child components
- state owner
- validation path
- save/load path
- shared component or style dependencies

Do not patch a downstream component without checking the upstream container or shared dependency first.

---

## File review order
For UI or workflow tasks, review in this order when applicable:

1. page or route entry
2. page shell / layout wrapper
3. feature container
4. child forms / tables / panels / modals
5. shared UI components
6. state store / hooks / derived state
7. validation and submit logic
8. persistence path
9. related tests
10. related helpers or config

For desktop issues, inspect both `src/` and `src-tauri/`.
For persistence issues, inspect both UI save/load flow and `supabase/migrations/`.

---

## UI / UX standard
Optimize for fast scanning, clarity, and confidence first.

Every screen should make these obvious:
- what this page is for
- what matters most right now
- what the user should do next

Prioritize:
- strong information hierarchy
- consistent spacing and alignment
- low-friction data entry
- clear primary actions
- quieter secondary actions
- readable forms and tables
- responsive layouts that use space well
- obvious empty states
- predictable behavior

Avoid:
- crammed layouts
- one-column compression
- wasted space beside dense content
- duplicate save actions
- inconsistent button styling
- visual noise
- unclear labels
- hidden requirements
- cramped modals

If something looks out of place, do not restyle it in isolation.
Check the surrounding system and make it belong.

---

## Layout rules
When fixing layout issues, inspect:
- page shell
- parent containers
- max-width rules
- grid and flex structure
- overflow behavior
- breakpoints
- modal sizing
- scroll regions

Do not assume the visible broken component is the root cause.

If a page is crammed, left-stacked, misaligned, or wasting space:
- identify the real container constraint
- fix the layout system
- verify at realistic desktop widths
- check for nearby regressions

---

## Forms and data entry
Data entry is core to the product and must feel fast and dependable.

Forms should:
- use space well
- show important inputs first
- make requirements obvious
- avoid duplicate controls
- guide completion clearly
- minimize friction
- preserve user input reliably
- behave consistently across quick-create and full-edit flows

Do not force users to interpret formatting rules that the UI already controls.

Prefer:
- clean sectioning
- clear defaults
- direct validation near the field
- concise helper text only where useful

---

## State and persistence
If state is buggy, inspect:
- state ownership
- duplicated state
- derived state
- effect timing
- form synchronization
- re-render behavior
- cross-component coupling

If data is saved or loaded, verify:
- source of truth
- field naming consistency
- default values
- transformation logic
- null / empty handling
- displayed state after save
- backend or Supabase mapping

Do not patch over state bugs with extra flags unless the model is understood.

If a selection bounces, reverts, or desyncs:
- identify the authoritative state
- simplify sync paths
- remove conflicting updates
- verify the interaction end to end

---

## Engineering standard
Prefer root-cause fixes over symptom fixes.

Examples:
- If layout is broken, inspect parent structure and width constraints, not just child styles.
- If a modal feels messy, fix the workflow and composition, not just spacing.
- If a control feels wrong, check action hierarchy and shared UI patterns, not just color.
- If a flow is confusing, fix the flow, not just labels.

When appropriate, make coordinated multi-file improvements instead of shallow single-file patches.

Do not leave behind:
- dead code
- duplicate paths
- half-wired UI
- unused helpers
- placeholder logic presented as finished

---

## Verification standard
Use the strongest relevant verification available.

Start with the real repo commands when applicable:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run tauri dev`
- `npm run e2e:alignment`

Also use relevant:
- end-to-end checks in `e2e/`
- Playwright flows
- screenshots
- targeted tests

A fix is not complete just because the code compiles.

If the task is UI-related:
- verify the rendered result
- inspect the actual layout behavior
- confirm the exact issue is gone

If the task affects a workflow:
- verify the workflow from start to finish

If a command fails because of the environment, say so clearly and use the strongest remaining verification available.

Do not claim verification that did not happen.

---

## Current hot spots
Give extra scrutiny to:
- create work item layout and spacing
- tasks scanability and sort/filter clarity
- follow-up workflow readability and control hierarchy
- control consistency across views
- state sync bugs that cause selections or form inputs to revert
- visual verification for UI fixes

---

## Known failure patterns to avoid
Do not:
- make broad unfocused changes across unrelated areas
- mark UI fixed without rendered verification
- tweak child components when the parent layout is the problem
- add more controls when hierarchy is already unclear
- keep duplicate save actions without strong reason
- rely on helper text to explain away a bad workflow
- make isolated styling changes that conflict with the surrounding UI
- stop at a superficial fix if the workflow still feels bad
- remove functionality unless clearly justified

---

## Reporting standard
When reporting work:
- summarize the real issue found
- explain the root-cause fix
- note important secondary changes
- state verification performed
- state limitations clearly
- mention `CHANGELOG.md` update if code changed

Do not overstate confidence.
Do not imply screenshots or validation happened if they did not.

---

## Definition of done
A task is done only when:
- the real issue was identified
- the implemented change addresses the root cause
- the affected workflow was verified as well as possible
- related regressions were considered
- `CHANGELOG.md` was updated if code changed
- important limitations were clearly stated

Do not present partial implementation as complete.

---

## Changelog requirement
Every time code changes are made, update `CHANGELOG.md`.

The changelog entry should reflect:
- what changed
- why it changed
- any notable user-facing impact

This is required, not optional.
