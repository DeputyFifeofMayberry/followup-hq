# SetPoint

**From intake to closeout.**

SetPoint is a construction execution workspace built for operations leads, project managers, and coordinators who need to capture inbound work and drive it through accountable completion.

It is intentionally structured around execution lanes and pressure lenses:

- **Overview** — start-of-day cockpit for triage, priorities, and routing
- **Follow Ups** — commitment execution lane
- **Tasks** — work execution lane
- **Intake** — inbound capture, review, and approval funnel
- **Projects** — project context and pressure lens
- **Relationships** — stakeholder and coordination lens
- **Exports** — reporting support and status-pack output

## Product workflow

SetPoint is designed to convert incoming information into finished work:

1. Capture inbound updates, emails, and files in **Intake**.
2. Triage and approve items in **Overview**.
3. Route work into **Follow Ups** (commitments) or **Tasks** (execution).
4. Monitor risk and pressure via **Projects** and **Relationships**.
5. Produce snapshots and closeout-ready outputs from **Exports**.

## Tech stack

- React + TypeScript + Vite
- Zustand state management
- Tauri desktop shell
- Supabase authentication and persistence

## Local setup

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run in browser dev mode

```bash
npm run dev
```

### Build web bundle

```bash
npm run build
```

### Run lint checks

```bash
npm run lint
```

### Tauri desktop development (optional)

```bash
npm run tauri dev
```

## Environment variables

Create a `.env` file (or equivalent environment configuration) with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Without these values, the app shows a startup warning and blocks sign-in.

## Supabase persistence schema requirements

SetPoint expects these **public** tables for cloud persistence:

- `follow_up_items` (`user_id`, `record_id`, `record`, `deleted_at`, `updated_at`)
- `tasks` (`user_id`, `record_id`, `record`, `deleted_at`, `updated_at`)
- `projects` (`user_id`, `record_id`, `record`, `deleted_at`, `updated_at`)
- `contacts` (`user_id`, `record_id`, `record`, `deleted_at`, `updated_at`)
- `companies` (`user_id`, `record_id`, `record`, `deleted_at`, `updated_at`)
- `user_preferences` (`user_id`, `auxiliary`, `migration_complete`, `updated_at`)
- `save_batches` (`id`, `batch_id`, `user_id`, `device_id`, `session_id`, `status`, `schema_version`, `client_payload_hash`, `server_payload_hash`, `operation_count`, `result_summary`, `error_summary`, `created_at`, `received_at`, `committed_at`, `updated_at`)
- `app_snapshots` (legacy migration compatibility: `user_id`, `snapshot`, `updated_at`)

Entity tables use `jsonb` `record` payloads and upsert on `(user_id, record_id)`. SetPoint now uses record-level sync operations: changed rows are upserted, and deletes are persisted explicitly as tombstones (`deleted_at`) rather than inferred from whole-table omission. `user_preferences` is unique on `user_id`.

### Required migration

Apply migrations in `supabase/migrations/`, including:

- `20260402_entity_persistence.sql`
- `20260405_persistence_schema_hardening.sql`
- `20260405_phase3_record_level_sync.sql`
- `20260406_phase1_authoritative_save_batches.sql`

Use your normal Supabase migration workflow (for example via Supabase CLI in your deployment pipeline). If migrations are not applied to the active project, cloud reads/writes will fail.

### RLS expectations

Each persistence table uses authenticated user-scoped RLS:

- `auth.uid() = user_id` for select/insert/update/delete.

If these policies are missing or incorrect, you will see permission-denied persistence failures.

## Authoritative save pipeline (Phase 1)

SetPoint now uses a **single server-authoritative save batch RPC** for cloud commits:

1. Client computes record-level pending operations + local fallback cache.
2. Client builds one save batch envelope (`batchId`, operation counts, deterministic payload hash, device/session ids).
3. Client calls `supabase.rpc('apply_save_batch', { batch })`.
4. PostgreSQL applies all entity + auxiliary writes atomically and returns a durable receipt.
5. UI marks cloud confirmation only when receipt status is `committed`.

### Receipt semantics

- `batchId`: unique id for one authoritative save attempt/replay.
- `status`: `committed` / `rejected`.
- `committedAt`: server commit timestamp used for cloud-confirmed timeline.
- `operationCount` + per-entity counts: what the server applied.
- `touchedTables`: exact persisted tables in the atomic transaction.
- `clientPayloadHash` + `serverPayloadHash`: deterministic hash comparison between client envelope and server-normalized payload.
- `hashMatch`: `true` when hashes match exactly for the committed payload.

### Out of scope in this phase

The Phase 1 overhaul intentionally does **not** include:

- manual verification workflows,
- cloud/local diff & recovery center,
- conflict resolution UX or merge tooling.

### Diagnosing `PGRST205` / missing `public.follow_up_items`

`PGRST205` means PostgREST could not find the table in schema cache for the connected project. Common causes:

1. wrong Supabase project URL (environment mismatch),
2. migrations not applied,
3. table name/schema mismatch.

SetPoint now runs a persistence schema preflight on startup and reports explicit diagnostics (including connected Supabase host) when required tables are missing.

### If local cache works but cloud reads fail

1. Confirm `VITE_SUPABASE_URL` points to the intended project.
2. Verify migrations have been applied in that project.
3. Confirm required tables exist under `public`.
4. Confirm RLS owner policies exist and use `auth.uid() = user_id`.
5. Re-open the app and check the Trust Center diagnostic:
   - connected Supabase host,
   - failing table,
   - error code (for example `PGRST205`).

## Notes

- The rebrand preserves core product architecture while updating language and shell identity to SetPoint.
- Internal data model names such as `FollowUp` remain in code where they are stable implementation details.


## Save confirmation vs verification (Phase 2)

SetPoint now models save reliability in three distinct layers:

1. **Save confirmation** — a committed save receipt proves the server accepted a batch.
2. **Verification** — a verification run proves whether current cloud state matches current local intended state at verification time.
3. **Recovery review** — if verification finds mismatches, Recovery Center exposes exactly what differs and why.

### Verify now

Use **Verify now** from the Save status control (or Recovery Center) to trigger a fresh cloud read and deterministic comparison against the current local intended state.

- Verify now is read-only: it does **not** mutate data.
- Successful match: UI can show **Verified match with current cloud data**.
- Mismatch found: UI shows **Recovery review needed** with entity/category counts and record-level details.
- Read failure: UI shows **Could not verify current cloud match** and preserves the prior successful verification result.

### Recovery Center

Recovery Center is the dedicated review workspace for verification incidents.

It includes:
- top-level verification status and timestamps,
- local/cloud snapshot summaries,
- mismatch queue grouped/filterable by entity/category,
- mismatch detail panel with timestamps, digests, and optional previews,
- controlled actions: Verify now, re-run cloud read, mark reviewed (session), export report.

### Verification report export

SetPoint can export a structured verification incident JSON report for debugging/support/self-review. Exports include mismatch details, counts, schema info, trust posture, and receipt metadata, while excluding secrets/tokens.

### Still out of scope after Phase 2

- full conflict resolution,
- multi-device merge decision UX,
- broad automatic repair,
- broad batch rollback tooling.
