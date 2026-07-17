# Droploid Electron — UI Overhaul Task Plan

## Goal
Modern liquid glass UI with App Store-concept design. All features stay functional. Phases executed sequentially.

## Design Principles
- **Liquid Glass**: multi-layer blur + specular top-edge highlight + ambient color blobs + saturate
- **App Store DNA**: large icons, clean type hierarchy, generous spacing, section labels
- **No hardcoded data**: all UI driven by state/IPC (unchanged)
- **macOS native feel**: traffic-light drag region, vibrancy simulation

## Phases

### Phase 1 — Design System ✅ DONE
**Files:** `globals.css`
- Liquid glass CSS utility classes: `.glass-xs .glass-sm .glass-md .glass-lg .glass-panel`
- Specular top-edge highlight on every glass element (`inset 0 1px 0 rgba(255,255,255,0.1)`)
- Ambient background blob tokens
- Complete color token expansion (add `-dim` `-ring` variants for all state colors)
- Noise texture pseudo-element
- New animation keyframes: `liquid-shimmer`, `glow-breath`, `float-subtle`
- Better scrollbar styling

### Phase 2 — Sidebar Redesign ✅ DONE
**Files:** `components/Sidebar/index.tsx`
- Width 248px, glass background (glass-md)
- Org switcher: compact avatar + name pill
- App list: App Store-style — 44px rounded-[10px] icon, bold name, mono caption
- Selected: glass-sm highlight + left accent bar + glow
- Link button: dashed glass card (not just text)
- Footer: glass bottom bar

### Phase 3 — TopBar + TabBar ✅ DONE
**Files:** `components/Workspace/TopBar.tsx`, `components/Workspace/TabBar.tsx`
- TopBar: frameless glass float, no hard border — soft gradient separator
- App badge: pill with platform color
- Buttons: glass-xs hover states
- Deploy button: gradient fill with inner glow
- TabBar: centered segmented pill control (iOS-style), not spanning full width

### Phase 4 — Overview + History Tabs ✅ DONE
**Files:** `components/Workspace/OverviewTab.tsx`, `components/Workspace/HistoryTab.tsx`
- Overview: 2-up hero stat cards (success rate big number, last build), project details glass card below
- History: timeline-style rows with result color left bar, better spacing

### Phase 5 — Deploy Panel + Release Tab ✅ DONE
**Files:** `components/DeployPanel/index.tsx`, `components/Workspace/ReleaseTab.tsx`
- Deploy: glass panel with richer step nav, glassy input fields
- Release: glass progress indicator, better checkpoint timeline

### Phase 6 — Light / Dark Mode ✅ DONE
**Files:** `globals.css`, `index.html`, `uiStore.ts`, `Sidebar/index.tsx`

Sub-phases:
- **6A CSS**: `[data-theme="light"]` overrides for all custom-property tokens + all `.glass-*` classes + `::view-transition` CSS for circular reveal
- **6B Store**: `theme` + `toggleTheme(x,y)` in `uiStore`, persists via `localStorage`, applies `data-theme` on `<html>`; View Transition circular clip-path from button origin
- **6C Toggle UI**: Animated Sun/Moon button in Sidebar footer; animated icon swap via Framer Motion `AnimatePresence`; `index.html` inline script reads localStorage pre-React to prevent flash

## Status Legend
- ✅ DONE  
- 🔄 IN PROGRESS  
- ⬜ PENDING

---
## Previous parity fixes (complete)
- Hydration fix (orgStore.load on splash)
- Build event wiring (buildStore.startListening on mount)
- DeployPanel preflight fix (useEffect not onAnimationComplete)
- Icon loading (local-file:// protocol)
