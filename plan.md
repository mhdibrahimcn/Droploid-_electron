# Droploid Electron — Feature Parity Plan

Reference: `/Users/mac/Documents/Conceptmate_workspace/MAC apps/droploid_flutter`

## Gap Analysis

### Critical Bugs (app broken for returning users)

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | Orgs/apps never load on startup | `orgStore.load()` never called | Call during splash in App.tsx |
| 2 | Build events never received | `buildStore.startListening()` never called | Call in Workspace on mount |
| 3 | Preflight loads unreliably | `onAnimationComplete` heuristic fragile | Replace with `useEffect` on `deployPanelOpen` |
| 4 | App icons don't load | `file://` blocked by renderer origin | Use `local-file://` protocol (done ✓) |

### Parity Status vs Flutter

| Feature | Flutter | Electron | Status |
|---------|---------|----------|--------|
| Org create/edit/delete | ✓ | ✓ | ✅ Done |
| App link + icon detect | ✓ | ✓ | ✅ Done |
| State hydration on launch | ✓ | ✗ | 🔴 Bug #1 |
| Deploy wizard (4 steps) | ✓ | ✓ | ✅ Done |
| Build event streaming | ✓ | ✓ (wiring ✗) | 🔴 Bug #2 |
| Terminal log view | ✓ | ✓ | ✅ Done |
| Build history tab | ✓ | ✓ | ✅ Done |
| Release/active build tab | ✓ | ✓ | ✅ Done |
| Promote sheet | ✓ | ✓ | ✅ Done |
| Settings + tool checker | ✓ | ✓ | ✅ Done |
| Setup wizard | ✓ | ✓ | ✅ Done |
| iOS credentials (Keychain) | ✓ | ✓ | ✅ Done |
| Android credentials (Keychain) | ✓ | ✓ | ✅ Done |
| Preflight checker | ✓ | ✓ | ✅ Done |
| Version bumper | ✓ | ✓ | ✅ Done |
| Command palette | ✗ | ✓ | ✅ Bonus |
| Org detail page | ✗ | ✓ | ✅ Bonus |

## Implementation Phases

### Phase 1 — Hydration (CRITICAL)
Fix startup initialization: call `orgStore.load()` during the 1.5s splash so orgs + apps are ready by the time user sees the workspace. Auto-selects first org (already in `load()` impl).

### Phase 2 — Build Event Wiring (CRITICAL)
Wire `buildStore.startListening()` in Workspace component on mount. Ensures IPC events for log lines, checkpoints, and build completion flow to the UI.

### Phase 3 — DeployPanel Preflight Fix
Replace `onAnimationComplete` heuristic with a `useEffect` watching `deployPanelOpen`. More reliable, avoids race with framer-motion animation lifecycle.

## Architecture Notes

- Data persisted: `electron-store` (orgs, apps, build_runs) + macOS Keychain (iOS/Android creds)
- IPC pattern: contextBridge preload → renderer `ipc.invoke()` / `ipc.on()`
- `orgStore.load()` already auto-selects `orgs[0]` — cascade to apps works via Workspace `useEffect`
- Build listeners use `ipc.on()` which returns a cleanup function — properly supported
