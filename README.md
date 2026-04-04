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

## Notes

- The rebrand preserves core product architecture while updating language and shell identity to SetPoint.
- Internal data model names such as `FollowUp` remain in code where they are stable implementation details.
