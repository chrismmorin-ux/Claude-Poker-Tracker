# Surface — Online View

**ID:** `online-view`
**Code paths:**
- `src/components/views/OnlineView/OnlineView.jsx` (199 lines — thin orchestrator)
- `./SeatGrid.jsx`, `./SeatDetailPanel.jsx`, `./CompactSeatStrip.jsx`
- `./Tier1_GlanceStrip.jsx`, `./RangeAdvantageBar.jsx`, `./BoardTexturePills.jsx`
- `./LiveRecommendations.jsx`, `./HandPlanTree.jsx`, `./BlockerInsightStrip.jsx`
- `./VillainBrief.jsx`, `./VulnerabilityCallout.jsx`, `./SupportingObservations.jsx`
- `./ExtensionPanel.jsx`, `./MiniCard.jsx`, `./onlineConstants.js`, `./panelTokens.js`
- `./panels/*` — per-panel composition helpers
- `src/components/ui/VillainProfileModal.jsx`
- Contexts: `SyncBridgeContext`, `OnlineSessionContext`, `OnlineAnalysisContext`

**Route / entry points:**
- `SCREEN.ONLINE` (routed via `uiReducer`).
- Opens from: bottom-nav / menu; auto-routes here when extension sends its first payload on a fresh install.
- Closes to: any other screen via nav.

**Product line:** Main app + cross-product (reads sidebar's WebSocket captures). The sidebar itself is a separate surface system (Z0–Z4 zones, doctrine at `docs/SIDEBAR_DESIGN_PRINCIPLES.md`).
**Tier placement:** Pro (full online analysis). A proposed Sidebar-Lite subscription (F-P16) would gate a simplified variant of this flow.
**Last reviewed:** 2026-04-21

---

## Purpose

Main-app companion surface for online play. Displays the currently-imported hand archive from the Ignition extension (or an imported JSON file), a per-seat tendency grid, per-seat detail panel (villain profile + live recommendations + range advantage + blockers + vulnerabilities + observations), and an extension-connected status indicator. Independent of the `TableView` live-entry surface — online play is auto-captured, not hand-entered.

**Architectural note:** all analysis, advisor, and extension push logic runs at app-root level, so advice flows even when this view is not active. The view is a renderer over app-root state.

## JTBD served

Primary:
- `JTBD-HE-13` auto-capture via sidebar (online)
- `JTBD-MH-01` see the recommended action for the current street (cross-surface; live surface is sidebar)
- `JTBD-MH-03` check bluff-catch frequency on current villain
- `JTBD-MH-04` sizing suggestion tied to villain's calling range
- `JTBD-MH-08` incorporate blockers in fold-equity math
- `JTBD-SR-24` filter by street / position / opponent-style (session selector + seat drill-in)
- (villain recognition) per-seat villain profile modal for post-hand study

Secondary:
- `JTBD-DE-72` raw JSON import (file input for offline imports)
- `JTBD-MT-62` offline-first — online view must gracefully render without extension connection

## Personas served

- [Multi-Tabler](../personas/core/multi-tabler.md) — primary (the sidebar is where they live; this view is secondary)
- [Online MTT Shark](../personas/core/online-mtt-shark.md) — primary
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — cross-format
- [Rounder](../personas/core/rounder.md) — occasional online
- Sidebar-specific personas (Multi-Tabler, Online MTT Shark) are canonically served on the sidebar surfaces (Z0–Z4); this view is the main-app counterpart.

---

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ Online Play    ● Extension connected   423 hands   │
├────────────────────────────────────────────────────┤
│ [!] Extension version mismatch banner (if any)     │
│ [!] Sync error banner (if any)                     │
├────────────────────────────────────────────────────┤
│ Session selector (when >1 online session)          │
│   [Table ABC123 (85h)] [Table DEF (42h)] ...       │
├────────────────────────────────────────────────────┤
│ EMPTY STATE (if no hands)                          │
│   "Waiting for hands..." / "No online data yet"    │
│   [Import from File]                               │
│                                                    │
│ POPULATED                                          │
│   SeatGrid — 9 seat cards with glance stats        │
│                                                    │
│   SeatDetailPanel (when seat selected)             │
│     Villain brief + profile open                   │
│     Live recommendations (collapsible)             │
│     Range advantage / board texture                │
│     Blockers / vulnerabilities / observations      │
│     Hand-plan tree                                 │
├────────────────────────────────────────────────────┤
│ [Import from File]                                 │
│ VillainProfileModal (overlay)                      │
└────────────────────────────────────────────────────┘
```

## State

- **SyncBridge (`useSyncBridge`):** `isExtensionConnected`, `versionMismatch`, `dismissVersionMismatch`, `importedCount`, `syncError`, `importFromJson`.
- **Online session (`useOnlineSession`):** `selectedSessionId`, `setSelectedSessionId`, `onlineSessions`, `loadSessions`.
- **Online analysis (`useOnlineAnalysisContext`):** `tendencyMap`, `handCount`, `isLoading`, `advice`.
- **Local:** `selectedSeat`, `profileModalOpen`, `expandedRec`, `recsExpanded`, `fileInputRef`.
- Writes: IDB via `importFromJson` (on file upload) and via the extension-sync pipeline (not this view directly).

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Select session** (when >1) → scope analysis to that table's hands.
2. **Click a seat card** → SeatDetailPanel renders for that seat.
3. **Open villain profile** (from SeatDetailPanel) → VillainProfileModal overlay.
4. **Expand a recommendation** → reveals its reasoning chain.
5. **Import from File** → file picker → `importFromJson(text)` → IDB write → `loadSessions`.
6. **Dismiss version-mismatch banner** → `dismissVersionMismatch`.
7. **Reload Page** (from mismatch banner) → `window.location.reload()`.

---

## Known behavior notes

- **Inline styles instead of Tailwind classes** — this view predates the design-token migration; visual polish lags the rest of the app.
- **App-root analysis** — the analysis pipeline is mounted outside this view. Advice flows to the extension sidebar regardless of whether this view is rendered.
- **Seat IDs are extension-sourced** — `selectedSeat` is an extension seat ID, not a main-app seat 1–9. Keep reconciliation in mind for any cross-view link.
- **Error surfaces (version mismatch, sync error)** render as banners; destructive actions (reload) are explicit.
- **No "Online Sessions" tab in the main SessionsView** — sidebar imports are stored in the shared `sessions` store but not separated in that view. Known flow gap (INVENTORY connections list).

## Known issues

- **DCOMP-W4-A3 combined Gate-2 + Gate-4 audit shipped 2026-04-22 — verdict RED.** 4 P0 findings (F1: no manual nav entry — verified via Playwright that OnlineView is only reachable via auto-route; F2: ExtensionPanel routing-vs-artifact drift; F3: `alert()` on import failure; F4: `window.location.reload()` on version mismatch with no diagnostic). 4 P1 (F5 Continue Anyway silences warning without degradation; F6 no import loading state; F7 touch targets <44 throughout; F8 inline-styles instead of Tailwind). 3 P2 + 3 P3/deferred. Full audit: `../audits/2026-04-22-blindspot-online-view.md`. Fixes queued as DCOMP-W4-A3-F1..F13 in BACKLOG.
- The sidebar has its own rigorous doctrine + program history (Sidebar Rebuild, Sidebar Trust Program). Wave 5 of the compliance roadmap will cross-map sidebar zones → framework heuristics; those surfaces are not this artifact.
- Wave 4 audit COMPLETE for online-view. Settings-view audit remains.

## Potentially missing

- **Online Sessions tab** in SessionsView — flow gap; this view is the only place they surface distinctly.
- **Sidebar-Lite subscription** (F-P16) — tier gate not implemented.
- **Version-mismatch resolution** — "continue anyway" may mask real incompatibilities; richer diagnostic UI could help.
- **Per-table settings** — the main app has venue / game defaults; online captures use the extension's config and don't inherit main-app settings.

---

## Test coverage

- Sub-components have their own unit tests (`OnlineView/__tests__/` — covers panels + SeatGrid + SeatDetailPanel).
- Extension sync contracts are tested in `ignition-poker-tracker/` (1,974 tests as of Sidebar Trust Program close).

## Related surfaces

- Sidebar (Z0–Z4) — the primary online-play surface; this view is the companion.
- `sessions-view` — unified session list includes online sessions but doesn't distinguish them.
- `hand-replay-view` — online hands replay here identically to live hands.
- `analysis-view` — online tendencies feed into PlayerAnalysisPanel.
- `settings-view` — extension connection does not currently surface here.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W4-A3 combined Gate-2 + Gate-4 audit appended; Known-issues updated with 13 findings. Headline finding: OnlineView has no manual nav entry — discovered via Playwright walk.
