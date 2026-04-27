# Surface — Anchor Library

**ID:** `anchor-library`
**Parent surface:** top-level routed view (`SCREEN.ANCHOR_LIBRARY`, new route added in Phase 5).
**Product line:** Main app. No extension-side equivalent — library browsing is a study-mode activity incompatible with the sidebar's live-decision focus.
**Tier placement:** Plus+ (Pro-tier for calibration data on cards; basic entries visible at Plus). Flag-gated via `ENABLE_ANCHOR_LIBRARY` for the Phase 5 ship.
**Last reviewed:** 2026-04-24 (Gate 4, Session 4)

**Code paths (future — Phase 5 of exploit-anchor-library project):**
- `src/components/views/AnchorLibraryView/AnchorLibraryView.jsx` (new — route root)
- `src/components/views/AnchorLibraryView/AnchorCard.jsx` (new — per-anchor row)
- `src/components/views/AnchorLibraryView/AnchorFilters.jsx` (new — style / street / polarity / tier / status chips)
- `src/components/views/AnchorLibraryView/AnchorDetailPanel.jsx` (new — long-press / ⓘ expand-in-place transparency panel)
- `src/components/views/AnchorLibraryView/AnchorEmptyState.jsx` (new — pre-seeding state + newcomer-threshold state)
- `src/hooks/useAnchorLibraryView.js` (new — filter + sort state; localStorage-persisted per hook convention)
- `src/hooks/useAnchorCardLongPress.js` (new — 400ms press threshold; discoverability tooltip on first render)
- `src/utils/anchorLibrary/librarySelectors.js` (new — `selectAnchorsFiltered(anchors, filters, sort)`; `selectActiveAnchors()` + `selectAllAnchors()` distinction per Gate 2 Stage D #6)
- `src/utils/anchorLibrary/anchorSortStrategies.js` (new — named-alphabetical (default), last-fired-at, sample-size; EXPLICITLY NOT "biggest edge" per AP-01 refusal)

**Related docs:**
- `docs/projects/exploit-anchor-library/schema-delta.md` §2 (`ExploitAnchor`) + §3.3 (`PerceptionPrimitive`)
- `docs/projects/exploit-anchor-library/WRITERS.md` §`exploitAnchors` (W-EA-3 study-override-writer — actions on this surface invoke it)
- `docs/projects/exploit-anchor-library/anti-patterns.md` §AP-01 (leaderboard), §AP-04 (calibration score), §AP-05 (unretire nudges)
- `docs/projects/exploit-anchor-library/gate3-owner-interview.md` §Q3 (long-press transparency — this surface is where Q3-B verdict lands)
- `docs/design/personas/core/chris-live-player.md` §Autonomy constraint red lines #2 (transparency on demand), #6 (flat access), #7 (editor's-note tone)
- `docs/design/surfaces/hand-replay-observation-capture.md` (related — capture writes observations; library surfaces anchors that match observations)
- `docs/design/journeys/anchor-retirement.md` (EAL-G4-J — retirement actions originate here or on Calibration Dashboard)
- `docs/design/surfaces/calibration-dashboard.md` (deep-dive target; long-press → dashboard-for-this-anchor deep-link)

---

## Purpose

The flat, filterable index of every anchor in the library — active, expiring, retired, and candidate. It is **the index**, not the deep-dive. Cards show name + confidence + status + ⓘ tap target; long-press or ⓘ-tap expands an inline transparency panel with observed vs predicted + evidence list + perception primitives. Deep-dive (full sparkline / per-firing detail / override actions) routes to the Calibration Dashboard for that anchor.

Fulfills **flat access** (red line #6) — adaptivity sets order, never gates content behind status. Retired anchors remain visible with their status tag; they are not hidden and never nudged for un-retirement (AP-05).

Non-goals (explicit):
- **Not a calibration deep-dive.** Per-firing metrics + full math + override actions live on `calibration-dashboard`. Long-press gives a summary; deep routes away.
- **Not a leaderboard.** Default sort is alphabetical by archetype name. No "biggest edge first" default (AP-01).
- **Not a gamified progress surface.** No scalar "mastery score" per anchor. No streaks, no badges (AP-03 / AP-04).
- **Not a live-surface mirror.** Calibration state + retirement progress are visible here (study surface); never on live `TableView` (red line #8 + AP-07).
- **Not a primitive browser.** PerceptionPrimitive library has its own browsing target (Phase 8 — out of Phase 1 surface-spec scope).
- **Not a capture surface.** Capture lives in `hand-replay-observation-capture`. Library is read-side with override write-sites; it does not originate observations.

---

## JTBD served

Primary:
- **`JTBD-DS-47`** — Skill map / mastery grid. The library is the anchor-archetype grid — "what exploits exist, which ones are firing, which are retired." Closest surface-level fulfillment of the Proposed-state DS-47; anchor-library extends the fulfillment into the exploit-archetype domain specifically.
- **`JTBD-DS-58`** — Validate-confidence-matches-experience (observed-vs-predicted transparency). Long-press panel surfaces enough to serve this partially; full surface is `calibration-dashboard`.

Secondary:
- **`JTBD-DS-59`** — Retire-advice-that-stopped-working. Card action (retire / suppress) is available inline via long-press panel; full retirement flow is `anchor-retirement` journey.
- **`JTBD-DS-44`** — Correct-answer reasoning. Long-press panel shows perception-primitive-by-name + GTO baseline rationale — the "why this anchor fires" reasoning.

Not served (explicit non-goals):
- **`JTBD-DS-57`** — Capture-the-insight. Library is read-side for observations. Capture lives on `hand-replay-observation-capture` surface.
- **`JTBD-MH-*`** — live mid-hand jobs. Library is study-mode only.

---

## Personas served

**Primary:**
- **`scholar-drills-only`** — primary study-block consumer. Generous cognitive budget; densest interaction with filters + sorts + long-press expansions.
- **`post-session-chris`** — post-session-review context. Checks library for "what fired tonight" via last-fired-at sort option; secondary to Calibration Dashboard for deep dives.

**Secondary:**
- **`presession-preparer`** — tonight's-villain-adjacent anchor recognition. Library view shown pre-session uses a **filter view without drift/trend visibility** (Gate 2 Stage C #5 — drift visibility pre-session introduces decision-hesitation). This surface handles the filter-switch explicitly: when entered via `SCREEN_REFERRER=PRESESSION`, long-press panel hides trend arrow + sparkline + "expiring" status chips (still shows retired-vs-active distinction).

**Explicitly excluded:**
- **`mid-hand-chris`** — no library access from live-decision context (red line #8).
- **`newcomer-first-hand`** — disqualifying. Library shows newcomer empty state ("Anchors unlock after N hands — your progress: M / N") until `newcomer-hand-threshold` crossed (threshold TBD per EAL-G4-NC).

---

## Anatomy

```
┌── AnchorLibraryView ─────────────────────────────────────────┐
│  [← Back]  Anchor Library                        (Esc key)   │
├──────────────────────────────────────────────────────────────┤
│  Filters row (flex-wrap; localStorage-persisted):            │
│  Style:   [ All ]  [ Fish ]  [ Nit ]  [ LAG ]  [ TAG ]       │
│  Street:  [ All ]  [ Flop ]  [ Turn ]  [ River ]             │
│  Polarity:[ All ]  [ Overfold ]  [ Overbluff ]  ...          │
│  Tier:    [ All ]  [ Tier 2 ]  [ Tier 1 candidate ]          │
│  Status:  [ All ]  [ Active ]  [ Expiring ]  [ Retired ]     │
│                                                              │
│  Sort: [ A-Z (default) ▾ ]   Showing N of M anchors           │
├──────────────────────────────────────────────────────────────┤
│  ┌── AnchorCard ──────────────────────────────────────── ⓘ ─┐│
│  │  Nit Over-Fold to River Overbet (4-Flush Scare)          ││
│  │  ● active  · Tier 2 · river · overfold                   ││
│  │  Confidence dial: ■■■■■■■□□□  (0.72)  · fired 34×         ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌── AnchorCard · expanded (long-press or ⓘ) ──────────── ▲ ─┐│
│  │  LAG Over-Bluff on River Probe after Turn XX             ││
│  │  ● active  · Tier 2 · river · overbluff · drill-only      ││
│  │  Confidence: ■■■■■□□□□□  (0.54)  · fired 22×              ││
│  │  ─────────────────────────────────────────────────────── ││
│  │  Transparency panel (long-press expanded):               ││
│  │   Observed rate:   58%   (CI 42-74%, n=22)               ││
│  │   Predicted rate:  65%   (GTO baseline: 40% MDF)         ││
│  │   Perception model: PP-02 (LAG treats XX as capping)     ││
│  │                    PP-05 (LAG doesn't integrate prior)   ││
│  │   Status: active    Last fired: 3 days ago               ││
│  │   [ Open Calibration Dashboard for this anchor → ]       ││
│  │   [ Retire ]  [ Suppress ]  [ Reset calibration ]        ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌── AnchorCard · retired (dimmed, flat-access) ──────── ⓘ ─┐│
│  │  TAG Over-Call on Turn Donk after Flop CB (example)      ││
│  │  ○ retired  · Tier 2 · turn · overcall                   ││
│  │  Confidence: ■■■□□□□□□□  (0.31)  · fired 47× pre-retire   ││
│  └──────────────────────────────────────────────────────────┘│
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

### Filter row — `AnchorFilters`

- **Filter chips** — 5 independent filter groups (Style / Street / Polarity / Tier / Status). Each chip is a toggle; "All" is the default (un-filtered). Multi-select within a group is allowed (e.g., Fish + Nit). State persists to localStorage per `useAnchorLibraryView` hook.
- **Sort dropdown** — 3 options: `A-Z by archetype name` (default), `Last fired (newest)`, `Sample size (largest)`. **Not present:** "Biggest edge" / "Highest confidence" (AP-01 refusal; leaderboard-by-edge is the canonical anti-pattern).
- **Showing N of M** — visible count hint; updates as filters change. No progress bar, no gamified progress indicator.

### Card — `AnchorCard`

Collapsed state per card:
- **Archetype name** — full name (e.g., "Nit Over-Fold to River Overbet on 4-Flush Scare"). Wraps to 2 lines max; truncates with ellipsis at 3+.
- **Status dot + chip** — `●` active / `○` retired / `◐` expiring / `⊘` suppressed / `?` candidate (non-firing). Status chip text: `active` / `retired` / `expiring` / `suppressed` / `candidate`.
- **Tier chip** — `Tier 2` (or `Tier 1 candidate` — Phase 2 only).
- **Street + polarity chips** — `river` / `turn` / `flop`; `overfold` / `overbluff` / `overcall` / `over-raise` / `under-defend`.
- **Confidence dial** — 10-segment bar showing `evidence.pointEstimate` (0-1 scaled). Accessible text alternative: `"Confidence 72% of 100%"`.
- **Firing count** — `fired N×` (from `validation.timesApplied`). Never shown with a "target" or "goal" count (no gamification).
- **ⓘ icon** — top-right corner; ≥44×44 tap target (H-ML06). Tap opens transparency panel (same behavior as long-press anywhere on the card).

### Expanded (long-press / ⓘ-tap) — inline transparency panel

- **Observed rate** — from Tier 2 `calibrationGap[anchor]`. Shown with sample size + credible interval. `"58% (CI 42-74%, n=22)"`.
- **Predicted rate** — from `gtoBaseline.referenceRate`. Shown with GTO method attribution. `"65% (GTO baseline: 40% MDF)"`.
- **Perception model** — list of `perceptionPrimitiveIds` rendered as `PP-NN — full name` (never raw IDs — H-N06 recognition > recall).
- **Status** — explicit; same as collapsed card chip but with fuller context (`"active — calibration within target zone"` vs `"expiring — retirement pending at session-close per retirement condition §2.6"`).
- **Last fired** — relative time (`"3 days ago"`, `"just now"`).
- **Deep-link to Calibration Dashboard** — `[ Open Calibration Dashboard for this anchor → ]` button; primary action in panel. Navigates with anchor deep-link.
- **Override actions** — `[ Retire ]`, `[ Suppress ]`, `[ Reset calibration ]`. Full retirement-flow routing lives on `anchor-retirement` journey; library surface is one of two entry points (other: Calibration Dashboard).
- **Copy discipline:** model-accuracy framing throughout. "Model's predicted rate" ✓ not "Your accuracy" ✗ (AP-06). The panel never evaluates the observer.

### Empty states

- **Pre-seeding (v18 migration running):** skeleton loader; does not show "no anchors" copy.
- **Post-seeding, zero filter matches:** `"No anchors match your filters. [Clear filters]"` — active action button.
- **Newcomer below threshold:** `"Anchors unlock after N hands — your progress: M / N. The library activates once enough hands have been reviewed to calibrate the first anchors."` No progress bar (gamification concern); text only.
- **All anchors retired (edge case):** flat list of retired anchors remains visible per red line #6. No hero-state copy implying "start over." Retired anchors are legitimate history, not a failure state.

---

## State

- **UI (`useUI`):** `currentScreen === SCREEN.ANCHOR_LIBRARY`. Entry from nav OR deep-link from toast (after capture save — "View in library").
- **Anchor library (`useAnchorLibrary`):**
  - Anchors from `exploitAnchors` store via `selectAllAnchors()` (includes retired — red line #6). Never uses raw store access; always selector (Gate 2 Stage D #6).
  - `observation_enrollment_state` — affects whether confidence dial shows "enrolled-live data" vs "seed-only prior."
- **View state (`useAnchorLibraryView`):**
  - `filters: { styles: [], streets: [], polarities: [], tiers: [], statuses: [] }` — localStorage-persisted; empty arrays mean "All."
  - `sort: 'alphabetical' | 'last-fired' | 'sample-size'` — localStorage-persisted.
  - `expandedCardIds: Set<string>` — session-scoped (not persisted); multiple cards may be expanded simultaneously.
  - `referrer: 'nav' | 'presession' | 'deep-link'` — affects presence/absence of drift/trend elements per persona rules.

### Mutations

- **Override actions** (Retire / Suppress / Reset) → W-EA-3 `study-override-writer` single-transaction per anchor.
- **Filter/sort changes** → `useAnchorLibraryView` localStorage writes (debounced 100ms).
- **Nothing else** — all other interactions are read-only.

### Environment assumptions

- `AnchorLibraryProvider` mounted at app root (Phase 5 task).
- `exploitAnchors` store seeded (fresh v18 migration guarantees this).
- `useScale` available for responsive scaling per 1600×720 landscape convention.

---

## Props / context contract

### `AnchorLibraryView` props
- `scale: number` — viewport scale from `useScale`.

### Context consumed
- `useAnchorLibrary()` — anchor list + enrollment state.
- `useAnchorLibraryView()` — filter/sort/expanded state.
- `useUI()` — navigation (to Calibration Dashboard on deep-link) + toast dispatch.

---

## Key interactions

1. **Filter change.** Tap a chip → toggles its inclusion in filter array → list re-renders. Chip state is visually obvious (filled vs outline). Multi-filter within a group is additive (OR within group); across groups is conjunctive (AND between groups).
2. **Sort change.** Tap sort dropdown → 3-option menu → select → list re-orders. Default A-Z is restored on "Reset sort" (lives in the dropdown as the first option, labeled `"A-Z (default)"`).
3. **Long-press card.** Press + hold 400ms on any card → expand inline transparency panel. First-run tooltip on first render: `"Long-press (or tap ⓘ) for details."` Dismissable; localStorage-gated once.
4. **ⓘ-tap.** Tap ⓘ icon (≥44×44) → same as long-press. Provides tap-based discoverability for users who don't discover long-press.
5. **Collapse.** Tap anywhere on expanded card (excluding interactive children like the deep-link button) OR tap the ▲ indicator → collapses. Another tap on a different card expands that one without auto-collapsing others.
6. **Deep-link to Calibration Dashboard.** Tap `[ Open Calibration Dashboard for this anchor → ]` in transparency panel → navigates with `anchorDeepLink = anchor.id`; Dashboard opens scrolled/filtered to that anchor.
7. **Override actions.** Tap `[ Retire ]` / `[ Suppress ]` / `[ Reset calibration ]` → enters the `anchor-retirement` journey at step 2 (confirmation). Journey doc carries the full flow.
8. **Back navigation.** Back button OR Escape → returns to caller (nav-referrer: home screen; deep-link-referrer: the originating surface, e.g., toast from capture).

### Keyboard / accessibility
- Filter chips are standard buttons, Tab-reachable.
- Sort dropdown is a standard `<select>` with arrow-key navigation.
- Card transparency panel is focus-trapped when expanded; Escape collapses.
- Status dot has `aria-label` matching the status chip text.
- Confidence dial has accessible text alt (`"Confidence 72% of 100%"`).

---

## Anti-patterns refused at this surface

- **AP-01 — Anchor leaderboard.** Default sort is A-Z, not edge-descending. Sort menu never includes "Biggest edge first" or equivalent. Enforced in `anchorSortStrategies.js` enumeration.
- **AP-04 — "Calibration score."** No scalar quality score shown on card or panel. Multi-dimensional calibration data (observed / predicted / CI / sample) is the only presentation.
- **AP-05 — "Retired anchors you might reconsider" nudges.** Retired anchors are visible in the flat-list per red line #6, but never surfaced with "reconsider" affordance, proactive panel, or auto-expand. Owner can re-enable via explicit action in the retirement journey; surface does not initiate.
- **AP-07 — Cross-surface calibration state leakage.** This surface IS a calibration-state-visible surface; it is NOT on the live-surface path. No live-surface elements render here (no advice bar, no seat avatars, no hand data).

---

## Red-line compliance checklist (Gate 5 test targets → EAL-G5-RL)

- **#1 Opt-in enrollment** — if `not-enrolled`, confidence dial shows "seed prior only" caption; no live-data mixing.
- **#2 Full transparency on demand** — long-press OR ⓘ-tap reaches transparency panel. DOM-reachable test: every `AnchorCard` has a `data-anchor-id` ⓘ button with role=button + `aria-expanded`.
- **#3 Durable overrides** — retirement flow (in retirement journey) persists; library never shows "reconsider retired" nudges.
- **#4 Three-way reversibility** — override actions visible and reachable from panel; no hiding reset behind multi-tap sequence.
- **#5 No streaks / engagement-pressure** — no streak indicator, no "this many anchors mastered," no progress bar on library header.
- **#6 Flat access** — retired + expiring + active all in the list; assert `selectAllAnchors().length === renderedCards.length` when no filters applied.
- **#7 Editor's-note tone** — empty states use matter-of-fact language ("Anchors unlock after N hands"), not gamified ("Keep going! M more hands to unlock").
- **#8 No cross-surface contamination** — assert no `TableView` / `LiveAdviceBar` components are children of AnchorLibraryView.
- **#9 Incognito observation mode** — N/A directly on this surface; library is read-side for observations.

---

## Known behavior notes

- **Card expansion without auto-collapse of others** — design choice for comparison use case (scholar comparing 2-3 anchors side-by-side). Consequence: long cards + many expansions produce long scroll. Panel itself is short (6-8 rows); acceptable.
- **Long-press threshold 400ms** — matches iOS/Android default + `useAnchorCardLongPress` hook. Faster feels accidental; slower feels laggy.
- **Presession referrer hides drift trends** but does not hide retired anchors. Retired is permanent state; drift is transient — they have different autonomy-implications. Only drift data is presession-dangerous.
- **ⓘ icon is always visible** — present on every card even before first long-press discovery. Belt-and-suspenders: tap-based users reach transparency without ever discovering long-press.
- **Filter state persistence** — localStorage per view hook convention; clears only on explicit "Clear filters" tap or localStorage purge. Survives app restarts.
- **Multi-anchor expansion + override action** — if owner expands 3 anchors and taps Retire on one, the other two remain expanded. Retirement journey for the tapped anchor proceeds in its own overlay.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass.

Placeholder for future audit findings:
- [AL-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target — EAL-Stream-D)
- `AnchorFilters.test.jsx` — chip toggle, multi-select within group, clear all.
- `AnchorCard.test.jsx` — status chip mapping, confidence dial rendering, ⓘ tap target size, expansion/collapse.
- `AnchorDetailPanel.test.jsx` — observed/predicted layout, perception-primitive-by-name rendering, deep-link button wiring, AP-06 copy verification.
- `AnchorLibraryView.test.jsx` — full view render with mixed statuses; empty states; presession referrer hiding drift.
- `useAnchorLibraryView.test.js` — localStorage persistence for filter/sort.
- `useAnchorCardLongPress.test.js` — 400ms threshold, first-run tooltip gating.
- `librarySelectors.test.js` — `selectAllAnchors` includes retired (red line #6 assertion).
- `anchorSortStrategies.test.js` — A-Z default; no "biggest edge" option exported (AP-01 assertion).

### Integration tests (Phase 5)
- `AnchorLibraryView.e2e.test.jsx` — filter → expand → deep-link-to-dashboard flow.
- Red-line assertion suite (EAL-G5-RL) — 9 assertions per red-line compliance checklist.

### Visual verification (Playwright)
- `EVID-PHASE5-EAL-S1-EMPTY-NEWCOMER` — newcomer empty state.
- `EVID-PHASE5-EAL-S1-POPULATED-MIXED` — 4 seed anchors with mixed statuses.
- `EVID-PHASE5-EAL-S1-EXPANDED` — transparency panel expanded on one card.
- `EVID-PHASE5-EAL-S1-FILTERED` — active filter chips applied.
- `EVID-PHASE5-EAL-S1-PRESESSION-REFERRER` — presession entry hides drift.

---

## Cross-surface dependencies

- **Calibration Dashboard (`calibration-dashboard`)** — deep-link target from transparency panel. Deep-link carries `anchorDeepLink` payload in UI state.
- **Anchor Retirement Journey (`anchor-retirement`)** — entry point from override actions on the transparency panel. Journey doc carries full flow.
- **Hand Replay Observation Capture (`hand-replay-observation-capture`)** — writes observations that the library surfaces. Cross-write: library's retirement action can originate from what the owner learned via capture.
- **Settings (future — EAL enrollment toggle location)** — enrollment state is read here; not mutated here.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 4 artifact (EAL-G4-S1). Full anatomy + filter/sort/card/panel/empty-state specs + 9 red-line compliance assertions + anti-pattern refusal cross-references + Phase 5 code-path plan + 5 Playwright evidence placeholders. Zero code changes.
