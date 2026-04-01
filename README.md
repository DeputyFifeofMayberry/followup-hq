# FollowUp HQ - Phase 11

Desktop follow-up command center built with React, TypeScript, Vite, and Tauri.

## What Phase 11 adds

- drag-and-drop email intake on the Unified Intake panel
- file picker fallback for email files
- support for:
  - `.eml` structured parsing
  - `.msg` Outlook file best-effort parsing
  - `.txt` / `.html` loose email imports
- dropped-email review queue
- one-click convert from dropped email into a tracked follow-up
- persistence for the dropped-email queue across restarts
- Tauri window config updated for HTML5 drag-and-drop on Windows
- clean upload batch file included (`zip.bat`)

## Existing major features

- master follow-up tracker
- duplicate review and merge workflow
- daily review engine
- project / owner dashboards
- Outlook connection, sync, and thread-aware suggestions
- local persistence with browser fallback and Tauri SQLite mode

## Local run

```powershell
npm install
npm run tauri dev
```

## Packaging a clean upload ZIP

Use `zip.bat` from the project root. It excludes heavy generated folders such as:

- `node_modules`
- `dist`
- `target`
- `.git`
- `.vite`
- `src-tauri\target`

It writes a smaller upload ZIP to your desktop.
