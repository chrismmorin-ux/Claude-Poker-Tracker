# Navigation & Information Architecture

**Type:** System-coherence artifact (per LIFECYCLE.md Gate-1 "System-coherence audit" scope; SHC precedent).
**Status:** Authored 2026-06-20 (plan `shimmying-moseying-lantern`), describing the navigation model **as
built** after the Homebase throughpoint work. Read this before any navigation-touching change.

This document is the single durable answer to "how does navigation work in this app, and where does X
belong?" Per-view surface docs describe individual screens; this describes how they connect. The
AI-conversation design-audit (2026-06-20) flagged the absence of this artifact as the reason future nav
work would be reasoned from scratch.

---

## The model in one paragraph

The app has **one** navigation state — `uiState.currentView` (a `SCREEN.*` value), mutated only via
`setCurrentScreen` / `SET_SCREEN`. There is no router library and no URL routing (a one-shot deep-link hash
on mount excepted). **Homebase is the hub**: the default entry screen and the place all journeys return to.
Two complementary nav surfaces reach it, and the set of routable screens is defined in one place.

## Source of truth: the view registry

`src/constants/viewRegistry.jsx` is the **single source of truth** for routable views. Each `SCREEN.*` maps
to one entry `{ name, component | render, eager?, orientation?, hash?, noScale?, deferred? }`. The router
(`ViewRouter` in `src/PokerTracker.jsx`), the deep-link hash map (`HASH_TO_SCREEN`), and the orientation
policy (`VIEW_TO_ORIENTATION`) all **derive** from it.

- **Adding a view = one registry entry.** Do not hand-maintain a router switch, a hash map, and an
  orientation map separately — that fragmentation is what let `CALIBRATION_DASHBOARD` ship as a `SCREEN`
  constant with no router case (it rendered nothing). A registry test
  (`src/constants/__tests__/viewRegistry.test.js`) asserts **every `SCREEN` has an entry** — drift fails CI.
- **A not-yet-built screen** is registered with `deferred: true` → renders an explicit stub, never nothing.
- `ShowdownView` is intentionally **not** in the registry: it's an overlay toggled by `isShowdownViewOpen`,
  not by `currentView`, handled directly in `ViewRouter`.

## The two navigation surfaces

| Surface | Where it lives | Role |
|---------|----------------|------|
| **Homebase** (`HomebaseView`) | The default entry screen | The hub. Primary tiles (Live Table, Online) + a secondary nav grid + the results dashboard. The launchpad for between-sessions use. |
| **`CollapsibleSidebar`** | Inside `TableView` only | In-flow nav during/around live play. Carries the table-specific seat-position widget + session venue/game editors. Has its own "Home" item. |
| **`NavShell`** (`src/components/ui/NavShell.jsx`) | App-root overlay, every screen **except** Homebase, Table, auth, showdown | A fixed one-tap **Home** button — the throughpoint glue so any screen returns to the hub. Implemented as an overlay (not a wrapping bar) because ~20 views are pixel-fit `ScaledContainer` layouts with their own in-header back buttons. |
| **`HealthIndicator`** (`src/components/ui/HealthIndicator.jsx`) | App-root overlay, every screen | Not navigation per se — the operator health signal (silent until a sync/extension/error fault), tappable to the relevant screen. |

## Routing contracts

- **Default entry:** `initialUiState.currentView === SCREEN.HOMEBASE` (`uiReducer.js`).
- **Error-boundary return** (`onReturnToTable` in ViewRouter VEB): resolves to `SCREEN.TABLE` if a session
  is active, else `SCREEN.HOMEBASE`. (Was hardwired to TABLE before Homebase existed.)
- **In-view "Back to Table" buttons** (most views render their own) are unchanged — they mean "return to the
  live table," distinct from NavShell's "Home." Both are legitimate; they go to different places.
- **Deep links:** registry `hash` entries populate `HASH_TO_SCREEN`; a matching `window.location.hash` on
  mount navigates once, then clears.
- **Orientation:** registry `orientation: 'portrait'` entries populate `VIEW_TO_ORIENTATION`; everything else
  defaults to landscape. Portrait surfaces are fluid field-entry screens (Sessions, Settings, Player Finder,
  Player Profile); the 1600×720 `ScaledContainer` design is the landscape default. Homebase is fluid but
  landscape-family (no portrait lock) to avoid an orientation flip on entry → table.

## The tile-promotion rule (which destinations earn a Homebase tile)

Homebase tiles are **high-frequency destinations only**. Current tiles: Live Table, Online (primary);
Stats, Sessions, Players, Hand Review, Self Coach (secondary); Settings (header). **Long-tail destinations
stay off Homebase** and are reachable via the in-table sidebar (and NavShell Home from anywhere):
Extension, Printable Refresher, Tournament, Analysis, Anchor Library, Lesson Detail, Player Finder/Profile.

When asked to add a Homebase tile: confirm the destination is genuinely high-frequency. If it's long-tail,
it belongs on the sidebar, not Homebase — adding it dilutes the launchpad. This is an **owner-curated**
list; ask before adding a tile.

## Where things belong (decision guide)

- **A new top-level screen?** → add a `SCREEN.*` constant + one `viewRegistry.jsx` entry + a
  `surfaces/<id>.md` artifact. Decide eager (hot path) vs lazy, and orientation.
- **Reachable from the hub directly?** → only if high-frequency (tile-promotion rule). Else sidebar/long-tail.
- **An operator/health signal?** → extend `HealthIndicator`, not a per-view widget (avoids the
  "trapped in one view" outage-blindness the audit found).
- **A persistent affordance on every screen?** → an app-root overlay (like NavShell/HealthIndicator),
  not a wrapping chrome bar (it would reflow the pixel-fit `ScaledContainer` views).

## Known open questions

- Should a future dense Homebase variant expose long-tail destinations (a "More" affordance), or do they
  stay sidebar-only forever? (Owner-curated for now.)
- `bb/100` is not computed anywhere (stake is free-text `gameType`); dashboards are $-based until BB parsing
  exists.

## Related

- `surfaces/homebase-view.md` — the hub surface.
- `surfaces/table-view.md` + `CollapsibleSidebar` — the in-table nav.
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — the extension sidebar is a separate surface system (Z0–Z4).
- `jtbd/domains/app-entry.md` — the app-entry / orientation jobs this navigation serves.
- design-audit evidence (2026-06-20) in `.claude/workstream/evidence/design/` — the audit that produced this.

## Change log

- 2026-06-20 — Created. Documents the navigation model as built after the Homebase throughpoint work
  (view registry + NavShell + the two-surface model + tile-promotion rule). Authored after the code
  (cross-critic sequencing: a navigation-IA doc written before the registry refactor would have canonized
  the fragmented prior state).
