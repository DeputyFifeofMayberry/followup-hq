# Developer Notes — Trust Upgrade Pass (2026-04-03)

## Major files changed
- `src/lib/intake/reviewPipeline.ts`
- `src/lib/universalIntake.ts`
- `src/components/UniversalIntakeWorkspace.tsx`
- `src/components/OverviewPage.tsx`
- `src/components/FollowUpDraftModal.tsx`
- `src/lib/entities.ts`
- `src/lib/outboundMessages.ts`
- `src/lib/bulkActions.ts`
- `src/lib/__tests__/trust-upgrades.test.ts`
- `src/types.ts`
- `CHANGELOG.md`

## Data model changes
- Added `IntakeReviewRecord` and field-level review typing for evidence+confidence (`src/types.ts`).
- Added `IntakeReviewOutcome` enum for explicit intake outcomes (create/update/link/reference/reject).
- Added alias fields on `ProjectRecord`, `ContactRecord`, and `CompanyRecord` for canonical identity handling.

## Migration notes
- Changes are backward-compatible: newly added fields are optional.
- Existing persisted rows hydrate without transformation because new properties are additive and default safely when absent.
- Alias normalization utilities are available for future progressive migrations where free-text fields are mapped to canonical entities.

## Future work remaining
- Full persisted `outbound_messages` state should be wired into `useAppStore` and Supabase tables.
- Bulk action engine should be centralized in store services (currently preview/apply UX in `OverviewPage` is an initial safety layer).
- Intake review records should be persisted as first-class entities (currently represented by model and immediate candidate surface).
- Entity typeahead should be uniformly adopted in every create/edit form (task/follow-up/project/relationship flows).
