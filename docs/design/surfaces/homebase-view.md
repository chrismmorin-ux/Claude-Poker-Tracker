# Surface — Homebase View

**ID:** `homebase-view`
**Code paths:**
- `src/components/views/HomebaseView/HomebaseView.jsx` (launchpad tile grid)
- Route: `src/PokerTracker.jsx` (eager-imported, routed via `SCREEN.HOMEBASE`)
- Default entry: `src/reducers/uiReducer.js` (`initialUiState.currentView`)
- Nav back-link: `src/components/ui/CollapsibleSidebar.jsx` (Home nav item)

**Route / entry points:**
- `SCREEN.HOMEBASE` (routed via `uiReducer`).
- **This is the app's default entry screen** — shown on every cold load (replaced TableView as the
  default, 2026-06-19).
- Opens from: app launch; "Home" item in the in-table sidebar.
- Closes to: any major view via a tile (`setCurrentScreen`).

**Product line:** Main app. Pure navigation/launchpad surface — no engine or analysis logic.
**Tier placement:** Free (navigation is universal).
**Last reviewed:** 2026-06-19

---

## Purpose

The first screen on app entry — a calm, minimal launchpad that lets the player choose what to do
instead of being dropped straight onto the live table. Routes to the four primary jobs: start/resume a
live session, review past results, practice/study, and reach any major area. It is a thin presentational
router over UI + session context; it owns no business state.

**Why it exists:** before this surface, the app opened directly into `TableView`, and the only global
navigation (`CollapsibleSidebar`) lived *inside* the table — so every other destination required first
being on the table. Homebase gives the app a neutral hub.

## JTBD served

Primary:
- App-entry orientation — "when I open the app, let me choose what I'm here to do."
- Start / **resume** a live session (one-tap into `TableView`; the resume affordance is load-bearing
  when a session is active).
- Review past results (Stats / Sessions).
- Practice / study (Self Coach, Hand Review).

Secondary:
- Reach online play (Ignition) without first entering the live table.
- Navigation hub for the high-frequency destinations (long-tail views remain on the in-table sidebar).

## Personas served

- Core founder/player (live + online) — the same cast served everywhere, at the "just opened the app"
  moment. No new persona introduced (Gate 1 GREEN-leaning-YELLOW; new-surface → Gate 2 GREEN).

---

## Anatomy

```
┌──────────────────────────────────────────────────────────┐
│  Poker Tracker                                  [Settings]│
│                                                            │
│   ┌────────────────────┐   ┌────────────────────┐         │
│   │   ▶ LIVE TABLE     │   │   🌐 ONLINE        │   (primary, large)
│   │  Resume / Start    │   │   Ignition play    │         │
│   └────────────────────┘   └────────────────────┘         │
│                                                            │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│   │ Stats  │ │Sessions│ │Players │ │ Hand   │ │ Self   │  (secondary grid)
│   │        │ │        │ │        │ │ Review │ │ Coach  │  │
│   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Live Table** tile copy is state-aware (Gate-2-B affordance — resume must be obvious + never lie):
  - no active session → **"Live Table" / "Start a live session"**
  - recent active session → **"Resume Session" / "Active · 2h 14m · 47 hands"**
  - stale active session (active but started > 12h ago — almost certainly never ended) →
    **"Unfinished Session" / "Started Nd ago — tap to finish"**. Routes to the table, which owns the
    cash-out flow; the hub never fabricates a cash-out (financial integrity).
- Primary tiles (Live Table, Online) are large; nav destinations render in a secondary grid.
- **Dashboard band** sits between the primary tiles and the nav grid (see Dashboard section).
- Long-tail views (Extension, Refresher, Tournament, Analysis) are intentionally **not** tiled here —
  still reachable from the in-table sidebar and via the persistent Home throughpoint elsewhere.

## Dashboard (2026-06-20)

After a full `design-audit`, the launcher gained an at-a-glance dashboard (`HomebaseDashboard.jsx`),
assembled from existing, tested parts so the entry screen stays instant:

- **Results band** — reuses `InsightsBand` (Net P&L, $/hr, win rate, hands, best/worst + `BankrollChart`
  + by-stake/by-venue breakdowns) over all sessions. Renders behind a skeleton while sessions load.
- **Recent sessions** — compact list of the latest 5 completed sessions (date · venue · stake · duration ·
  hands · $). Empty state when there are none.
- **Study queue** — count of concepts needing work (`useSelfCoachMastery`, **count only** per the SCF
  source-util whitelist), deep-links to Self Coach.
- **"Since your last visit"** band (Lapsed Returner persona) — only when the gap since the last visit
  exceeds 3 days. Surfaces (a) **how your game changed while away** (sessions with `endTime` after the
  last visit, summarized) and (b) **what's new in the app** (unseen `WHATS_NEW` entries). Backed by
  `src/utils/lastVisit.js` (localStorage `lastVisitAt` + `lastSeenWhatsNewId`).

## State

- **UI (`useUI`):** `setCurrentScreen` — every tile dispatches `SET_SCREEN`.
- **Session (`useSession`):** `currentSession` + `hasActiveSession` (tile copy/context); `allSessions` +
  `loadAllSessions` (dashboard).
- **Auth (`useAuth`):** `userId` — threaded into session/coach reads (data-isolation).
- **Coach (`useSelfCoachMastery`):** study-queue count (count only — see SCF whitelist).
- **Local (localStorage):** `lastVisit` (returning-player band); `InsightsBand` collapse state (reused).
  No reducer/state-shape changes; the view performs no writes to user data.

## Props / context contract

- `scale: number` — drives `ScaledContainer` (fixed 1600×720 design scaled to fit), the **same model as
  TableView and every other landscape surface**. Founder report 2026-06-20: the earlier fluid layout
  sized differently from the rest of the app and the fixed health pill overlapped tiles in portrait;
  reverting to `ScaledContainer` makes Homebase fit one screen at the app's scale and letterboxes the
  fixed overlays into the margin. The launcher (header + tiles + nav) is fixed/always-visible; the
  variable-height **dashboard sits in an internal `overflow-y-auto` region**.
- **Fixed grids, not responsive breakpoints.** Inside `ScaledContainer` the design width is always 1600px,
  but Tailwind `sm:`/`md:` key off the *device* viewport — so this surface uses fixed `grid-cols-2`
  (primary) / `grid-cols-5` (nav) and fixed sizes, matching the rest of the ScaledContainer app.

## Key interactions

1. **Tap Live Table** → `SCREEN.TABLE` (no orientation flip — homebase stays landscape-family).
2. **Tap Online** → `SCREEN.ONLINE`.
3. **Tap Stats / Sessions / Players / Hand Review / Self Coach** → respective `SCREEN.*`.
4. **Tap Settings** → `SCREEN.SETTINGS`.
5. **Tap Study queue / a dashboard deep-link** → `SCREEN.SELF_COACH` / `SCREEN.SESSIONS`.

---

## Known behavior notes

- **Always shown first** — even with a session in progress the app lands here (owner decision: predictable
  over auto-skip). The state-aware Live Table tile makes returning to a live session one tap, and reframes
  a stale never-ended session as "Unfinished" so the copy never lies.
- **Throughpoint navigation** — Homebase is the app's nav hub. `NavShell` (`src/components/ui/NavShell.jsx`)
  renders a fixed Home button on every screen except Homebase, Table (the sidebar has its own Home item),
  auth screens, and the showdown overlay. The in-table `CollapsibleSidebar` Home item complements it.
- **Error-recovery routing** — `onReturnToTable` (ViewRouter VEB) now resolves to the table if a session is
  active, else Homebase (was hardwired to `SCREEN.TABLE`).
- **Health indicator** — `HealthIndicator` (app-root) shows a silent-until-broken pill (extension/sync/error
  faults) on every view. Not part of Homebase per se, but the operator signal the audit called for.

## Known issues

- bb/100 is not shown anywhere (dashboard is $-based) — `gameType` is free-text and BB isn't parsed.
  Deferred; surface uses $ + $/hr + win-rate, which exist. (design-audit: end-user note.)
- In portrait the whole 1600×720 design scales small (same as TableView in portrait) — acceptable; the app
  is used in landscape. The dashboard's reused `InsightsBand` keys its internal grid to the device viewport,
  so on a phone-width viewport its stat tiles under-use the wide scaled space (cosmetic; in a scroll region).

## Potentially missing

- A "what's new" detail surface — the returning-player band shows highlights from `WHATS_NEW`; there is no
  full changelog view in-app (links out to `docs/CHANGELOG.md` conceptually).
- Long-tail destinations (Extension, Refresher, Tournament, Analysis) remain sidebar-only by design; the
  promotion rule (which destinations earn a Homebase tile) is documented in `navigation-ia.md`.

---

## Test coverage

- `HomebaseView/__tests__/HomebaseView.test.jsx` — tiles render + dispatch; Live Table copy across
  no-session / recent / stale states.
- `HomebaseView/__tests__/HomebaseDashboard.test.jsx` — skeleton→data, study-queue count + routing,
  recent sessions, empty state, returning-player band (shows for a >3d gap, hidden for frequent users).
- `components/ui/__tests__/HealthIndicator.test.jsx` — silent when healthy; each fault tier + routing.
- `components/ui/__tests__/NavShell.test.jsx` — shows/hides per view; routes to Homebase.
- `constants/__tests__/viewRegistry.test.js` — every `SCREEN` has a registry entry (drift guard) + derived
  hash/orientation maps + `CALIBRATION_DASHBOARD` deferred.
- Default-view assertions in `reducers/__tests__/uiReducer.test.js` + `contexts/__tests__/UIContext.test.jsx`.

## Related surfaces

- `navigation-ia.md` — the cross-surface navigation/IA artifact (the throughpoint model, the two nav modes,
  the tile-promotion rule). Read this before any nav-touching change.
- `TableView` — the live-entry surface and former default; reached via the Live Table tile; keeps its own
  `CollapsibleSidebar`.
- `online-view`, `sessions-view`, `stats`, `self-coach-view`, `hand-replay-view` — tile/dashboard destinations.
- `CollapsibleSidebar` / `NavShell` / `HealthIndicator` — the navigation + operator chrome.

---

## Change log

- 2026-06-19 — Created. New default entry surface (Gate 1 + lightweight Gate 2 GREEN + Gate 4). Plan
  `shimmying-moseying-lantern`.
- 2026-06-20 (later) — Reverted Homebase to `ScaledContainer` (fixed 1600×720 scale-to-fit) after founder
  reported portrait sizing problems: the fluid layout sized differently from the rest of the app and the
  fixed health pill overlapped tiles. Now fits one screen like TableView; launcher fixed, dashboard in an
  internal scroll region; fixed grids (no viewport breakpoints inside the scaled design).
- 2026-06-20 — Expanded to dashboard + navigation throughpoint after a full `design-audit` (the audit is
  this work's Gate 2 Blind-Spot Roundtable; evidence `.claude/workstream/evidence/design/`). Added: results
  dashboard (`HomebaseDashboard.jsx`, reuses `InsightsBand`/`BankrollChart`), "since your last visit" band
  (Lapsed Returner persona, `lastVisit.js` + `whatsNew.js`), study-queue card (count-only per SCF
  whitelist), state-aware/stale-safe Live Table tile, fluid scrollable layout (dropped `ScaledContainer`;
  fixed grid overflow). Companion infra: `viewRegistry.jsx` (single-source router; fixed
  `CALIBRATION_DASHBOARD` silent-render drift), `NavShell` (one-tap Home throughpoint), `HealthIndicator`
  (operator surface L1→L2), conditional `onReturnToTable`. New artifact `navigation-ia.md`. Copy drift fixed
  ("Go to table" → "Live Table"). SCF source-util whitelist updated for the count-only read.
