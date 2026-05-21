# Surface — Live Anchor Badge

**ID:** `live-anchor-badge`
**Parent zone:** Main-app `TableView/LiveAdviceBar` (Row 6, appended below hand-plan row). Mirror on extension sidebar `Z2 Decision` deferred to follow-up — v1 main-app only.
**Product line:** Main-app live in-game surface (TableView). Sidebar mirror is future work.
**Tier placement:** Decision-critical (inherits LiveAdviceBar's tier — anchor signal is part of the decision context).
**Last reviewed:** 2026-05-09 (Gate 4 authoring; companion to Gate 1 entry audit `audits/2026-05-09-entry-eal-stream-c-live-anchor-badge.md`)

**Code paths:**
- `src/components/views/TableView/LiveAnchorBadge.jsx` (new — stateless presentational component)
- `src/components/views/TableView/LiveAdviceBar.jsx` (modified — adds Row 6 hosting the badge)
- `src/components/views/TableView/SizingPresetsPanel.jsx` (modified — adds `●` overlay on anchor-recommended preset)
- `src/components/views/TableView/CommandStrip.jsx` (modified — single matcher subscription, props down to both consumers)
- `src/components/ui/ConfidenceDial.jsx` (new — extracted from `AnchorCard.jsx:58-76` for shared use)
- `src/hooks/useExploitAnchorsForLive.js` (new — subscription hook)
- `src/utils/anchorLibrary/liveObservationWriter.js` (new — headless system-observation writer)
- `src/reducers/anchorLibraryReducer.js` (modified — `ANCHOR_BADGE_TAPPED` + `OBSERVATION_FIRED_LIVE` cases)

**Related docs:**
- `docs/design/surfaces/live-exploit-citation.md` — sibling surface (parallel signal class — predicate-level citation; coexists in different row when ENABLE_EXPLOIT_CITATION ships)
- `docs/design/surfaces/anchor-library.md` — study surface (host of the same anchor data; long-press transparency panel)
- `docs/projects/exploit-anchor-library/anti-patterns.md` — AP-07 (cross-surface contamination) is the load-bearing constraint
- `docs/projects/exploit-anchor-library/WRITERS.md` — W-PP-2 system-observation writer pattern (line 47)
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` — EAL Gate 2 covering this surface

---

## Purpose

Render a glanceable badge on the live in-game surface when an authored `ExploitAnchor` (archetype-level pattern) matches the current villain × line. Hero gets archetype-level confirmation in ≤1.5s — distinct from the predicate-level `live-exploit-citation` (which exposes assumption-level "why"). System-observation writer logs every fire (gated on enrollment) so Tier 2 calibration accrues evidence without owner action.

Fulfills the **archetype-recognition signal** — Hero acts with archetype-level conviction without re-deriving the underlying assumption chain mid-decision.

**Non-goals (explicit):**
- Calibration state on live (observed rate, CI, retirement progress). **AP-07 hard refusal.**
- Predicate-level citation. That's `live-exploit-citation`.
- Immediate Z4 expansion on tap. Drill is **deferred** per AP-07 line 112 — tap stores intent; HandReplay (post-hand) consumes it.
- Owner-facing observation capture. That's `HandReplayView/ReviewPanel` Section G (already shipped).
- Multiway anchor matching beyond top-1 by composite. Schema v1.1 §9.2 research agenda.

---

## JTBD served

Primary (inherited):
- `JTBD-MH-01` — See the recommended action for the current street (badge is a secondary signal alongside primary advice; never replaces).
- `JTBD-MH-13` — Dismiss or downrank a live-cited assumption in the moment (silent override — Hero plays the alternate action; badge does not fight).

Adjacent / not served by this surface:
- `JTBD-MH-12` — Predicate-level citation. Served by `live-exploit-citation`.
- `JTBD-MH-10` — Plain-English "why". Served by `live-exploit-citation`'s drill.

Deferred (proposed for follow-up Gate 3 if needed):
- **`JTBD-MH-14` (proposed)** — Archetype-level pattern recognition for current hand line. v1 ships under inherited MH-01 + MH-13.

---

## Personas served

Primary:
- [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — load-bearing 1.5s glance budget.

Secondary:
- [Chris (live player)](../personas/core/chris-live-player.md)
- [Weekend Warrior](../personas/core/weekend-warrior.md)
- [Rounder](../personas/core/rounder.md)
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md)

Not served:
- [Newcomer](../personas/core/newcomer.md) — anchor features are advanced; threshold gate is follow-up work.
- [Scholar (drills-only)](../personas/core/scholar-drills-only.md) — study territory; AnchorLibraryView.
- Sidebar-primary personas (Multi-Tabler, Online MTT Shark) — sidebar mirror is future work.

---

## Anatomy

### Compact form (only-form; no expansion on live)

Renders inline within LiveAdviceBar as Row 6 (appended below hand-plan row), beneath the hand-plan-guidance row:

```
┌─ LiveAdviceBar ─────────────────────────────────┐
│ 🟢 BET 75%  EV +0.27bb  82% conf  HIGH VAR     │  ← Row 1 — primary action
│ Reasoning: villain folds turn 38%               │  ← Row 1.5 — reasoning
│ (PREFLOP ONLY — flop archetype breakdown row)   │  ← Row 1.75 — preflop only
│ Equity ███▌▏▏ 64%  Wet  R+ N+  F:38 C:42 R:20  │  ← Row 2 — equity / texture / villain response
│ If raised, fold; alt: check turn for pot ctrl   │  ← Row 3 — hand-plan
│ ● Nit scare-fold  ▮▮▮▮▮▯▯▯▯▯                   │  ← Row 6 — ANCHOR BADGE (new)
└─────────────────────────────────────────────────┘
```

Characteristics:
- **Single line**, ≤ 40 characters target width (well within R-1.2's <1s glance test).
- **Status-dot glyph** (●) — borrows AnchorCard's status vocabulary; only `active`-status anchors ever reach this surface (matcher's `DEFAULT_LIVE_STATUSES`).
- **Archetype name** — ≤ 3 words per H-PLT01 (Gate 2 voice). H-PLT04 socially-discreet: name must be opaque to a tablemate's glance ("Nit scare-fold" OK; "Exploit villain's overfold tendency" NOT OK).
- **Confidence dial** — 10-segment `▮`/`▯` block bar from `ConfidenceDial` (extracted from AnchorCard).
- **No tap affordance text** — tap is a deferred-drill primitive (AP-07 line 112), but no visible "tap →" hint per H-PLT04 socially-discreet rule. Discoverable through study-mode familiarity.
- **No observed-rate, no n=, no CI, no retirement state, no trend.** AP-07 hard floor — enforced by component-level snapshot test on forbidden tokens.

### SizingPresetsPanel embed (companion surface)

When the matched anchor's `consequence.sizingShift` maps to a rendered preset button, decorate that button with a small `●` overlay (top-right corner, 6px diameter, status-dot color):

```
┌─ Sizing presets ─────────────┐
│  $4    $8 ●   $12    $20    │   ← `●` on the anchor-recommended preset
│  1.5x  2x      3x     5x    │
└──────────────────────────────┘
```

Characteristics:
- Pure decoration; no copy change; no layout change.
- Inherits the badge's status-dot vocabulary.
- Absent when no anchor matches OR when `consequence.sizingShift` doesn't align with any rendered preset.

### No expanded form on live

Per AP-07 line 112: tap on the live surface deep-links to the Calibration Dashboard for that anchor in a non-live context (between hands, post-session). v1 stub — tap dispatches `ANCHOR_BADGE_TAPPED` with `{anchorId, tappedAt, handId}`; UI consequence is deferred to v2 when the Calibration Dashboard or a between-hands drill panel ships.

---

## Doctrine rule compliance

### Autonomy red lines (EAL — 9 lines)

| Line | Compliance |
|---|---|
| #1 Opt-in enrollment | Observation writer short-circuits unless `enrollment_state === 'enrolled'`. Matcher still fires for advice purposes regardless (per `WRITERS.md:47`). |
| #2 Transparency screen | Long-press path lives in study-mode AnchorLibraryView — not on live surface. Live surface respects 1.5s budget; transparency is post-session-chris territory. |
| #3 Durable override | Retire / unretire / suppress live in Calibration Dashboard (future) and AnchorLibraryView (shipped). Badge does not show retirement state per AP-07. |
| #4 Three-way reversibility | N/A on live — observation writer is append-only; reversibility lives in study-mode reset flows. |
| #5 No streaks / shame / notifications | Badge is informative, never evaluative. No "You ignored this anchor 3 times" copy. |
| #6 Flat anchor index | Library access stays in study-mode; live surface shows only the matched anchor. |
| #7 Editor's-note tone | Archetype names are stated, not proclaimed ("Nit scare-fold", not "DEVASTATING NIT EDGE"). |
| #8 No cross-surface contamination | **AP-07 hard floor.** Badge shows only `archetypeName + ConfidenceDial`. Component snapshot test pins forbidden tokens. |
| #9 Incognito observation | Owner-facing capture (Section G) supports incognito mode. System observation writer is gated on enrollment; if owner has not enrolled, fires don't write. |

### Heuristic compliance (Gate 2 Stage E carry-over)

| Heuristic | Compliance |
|---|---|
| H-PLT01 (sub-second glanceability) | Single line ≤ 40 chars; status-dot + ≤3-word name + 10-segment dial. Read in <1s. |
| H-PLT04 (socially discreet) | Archetype names are opaque to a tablemate glance. Naming convention enforced in seed authoring + future-anchor authoring template. No "exploit", "fold tendency", "overfold" in display text — these are schema-level fields, not rendered. |
| H-PLT07 (state-aware primary action) | On LiveAdviceBar tap = deferred drill (queued). On Calibration Dashboard tap = retire / override (future surface). Surface-specific primary action enforced by interaction handler. |
| H-N03 (user control & freedom) | Hero overrides the badge by playing the alternate action (MH-13 silent override). No "dismiss this anchor live" affordance — that would cross AP-07 (calibration state on live). |
| H-N06 (recognition > recall) | Archetype name shown in full (not just `anchor.id`). Perception primitive names live in study-mode detail panel. |
| H-ML06 (touch targets ≥ 44×44 scaled) | Row 6 occupies a full row of LiveAdviceBar; tap target is the entire row at scaled-1600×720 viewport. SizingPresetsPanel `●` overlay sits on existing 44×44 preset button (decoration only; no separate target). |

### Glance-test rule (R-1.2 carry-over from sidebar doctrine)

Compact form is single-line ≤ 40 chars (well under 64 char ceiling). Read in <1s by glance-trained user. **Glance-test does not apply to deferred-drill** since that surface renders post-hand or between hands.

---

## State / props / context

- **From reducers/contexts:**
  - `AnchorLibraryContext` — `selectActiveAnchors()` returns `Anchor[]` filtered to status=active.
  - `GameContext` — `actionHistory` shape provides matcher input.
  - Player tendencies / Online analysis — provides `villainStyle` for matcher input.
  - `useLiveEquity()` output — confirms "live decision context exists" gate (matcher only runs when there's a hero hand × board × villain identifiable).

- **From hooks:**
  - `useExploitAnchorsForLive()` — returns `{topAnchor, allMatches}`. Memoized on situation-key change.

- **Mutates:**
  - Dispatches `ANCHOR_BADGE_TAPPED` on tap (records `{anchorId, tappedAt, handId}` for deferred-drill consumption).
  - Dispatches `OBSERVATION_FIRED_LIVE` on every classifier fire (when enrolled). Reducer appends to anchor's `evidence.systemObservations[]`.

- **Assumes about environment:**
  - Hero has 2 hole cards + 3+ community cards (live decision in progress).
  - Active villain is identifiable.
  - At least one anchor in the library has `status === 'active'`.
  - When matcher returns multiple matches, top-1 by `quality.composite` (or first-match if composite absent in v1) becomes `topAnchor`.

---

## Key interactions

1. **Matcher fires for current situation** → `useExploitAnchorsForLive` returns `topAnchor` non-null. LiveAdviceBar renders Row 6 with the badge. SizingPresetsPanel decorates the matching preset.
2. **Hero plays an action** → `actionHistory` updates → matcher re-evaluates next frame → badge may transition (different anchor, no anchor, same anchor with refreshed dial).
3. **Hero taps badge** → dispatches `ANCHOR_BADGE_TAPPED`. **No immediate visual change** (deferred drill v2 work). Reducer stores `pending_deferred_drill: {anchorId, tappedAt, handId}`.
4. **System observation writer fires** → gated check `enrollment_state === 'enrolled'`; if pass, dispatches `OBSERVATION_FIRED_LIVE`; reducer appends record + writes via `putPrimitive` (W-PP-2 pattern). Idempotent on `(situationKey, handId, anchorId)` triple.
5. **New hand starts** → `actionHistory` resets → matcher returns no matches → Row 6 absent. SizingPresetsPanel overlay absent.
6. **Anchor retired mid-session** (study-mode action) → matcher's `DEFAULT_LIVE_STATUSES` filter excludes retired anchors → badge disappears next frame.
7. **`useLiveEquity` reports computing / no-villain** → matcher gates skip (no situation context); badge absent.

---

## Performance targets

| Operation | Budget |
|---|---|
| Matcher invocation per hand-state change | ≤ 16ms (one frame) |
| Badge render | ≤ 8ms |
| Observation writer (in-memory + putPrimitive dispatch) | ≤ 50ms (async, off the render path) |

CI enforces via existing performance test patterns (`__tests__/performance/`).

---

## Edge cases

| Case | Behavior |
|---|---|
| **No anchor matches current line** | Row 6 absent. SizingPresetsPanel overlay absent. LiveAdviceBar height shrinks one row. |
| **Multiple anchors match** | Top-1 by `quality.composite`. Secondary matches available only in study-mode (AnchorLibraryView). |
| **Matched anchor has `consequence.sizingShift` not aligned to any rendered preset** | Badge renders normally; SizingPresetsPanel overlay absent. |
| **`useLiveEquity` is computing or villain unidentifiable** | Matcher does not run (no situation context). Badge absent. |
| **Hero has 0 hole cards** | `useLiveEquity` gates upstream; matcher does not run. |
| **Matched anchor is in `expiring` status** | Filtered out by `DEFAULT_LIVE_STATUSES` (`Object.freeze(['active'])`). Never reaches badge. |
| **Anchor library is empty** | `selectActiveAnchors()` returns `[]`; matcher returns `[]`; badge absent. |
| **Owner not enrolled in observation accrual** | Badge still renders (matcher fires for advice purposes); observation writer short-circuits (no IDB write). |
| **`putPrimitive` write fails** (IDB error) | Failure logged; UI unaffected; observation lost (acceptable — write is best-effort). |
| **Multiway hand with 2+ active villains** | Single-villain top-1 via `useLiveEquity`'s villain selection. Multiway generalization deferred (schema v1.1 §9.2). |

---

## Test coverage

### Component tests (`src/components/views/TableView/__tests__/LiveAnchorBadge.test.jsx`)

- Renders archetype name + status-dot + `<ConfidenceDial>` when `anchor` prop set.
- Renders nothing when `anchor` prop is null/undefined.
- **AP-07 forbidden-DOM snapshot test** — confirms no rendered text contains: `n=`, `%`, `CI`, `±`, `stale`, `expiring`, `retired`, `predicted`, `observed`, `gap`, `dividend`, `sample`, `posterior`. Run against an anchor input that has all those fields populated.
- Tap dispatches `ANCHOR_BADGE_TAPPED` with `{anchorId, tappedAt, handId}`.
- Status-dot glyph uses `●` (active) — non-active never reaches component.
- Archetype name renders truncated/elided if > 40 chars (defensive — authored anchors are ≤3 words but defensive cap exists).
- Tap is the only interaction on live (no long-press on live — that's study-mode).

### Hook tests (`src/hooks/__tests__/useExploitAnchorsForLive.test.js`)

- Builds `situation` argument shape correctly from game state.
- Returns `{topAnchor: null, allMatches: []}` when no anchors match.
- Returns top-1 by composite when multiple match.
- Memoized — does not re-invoke matcher when situation-key unchanged.
- Re-invokes matcher when villainStyle changes.
- Re-invokes matcher when actionHistory changes.

### Writer tests (`src/utils/anchorLibrary/__tests__/liveObservationWriter.test.js`)

- Short-circuits when `enrollmentState !== 'enrolled'`.
- Writes via injected `putPrimitive` callback when enrolled.
- Idempotent on `(situationKey, handId, anchorId)` triple.
- Pure function (no side effects beyond the injected callback).

### Doctrine-compliance tests

- Component AP-07 enforcement (above) — pinned via snapshot test on forbidden tokens.
- LiveAdviceBar Row 6 mounts the badge component — integration test against the rendered tree.

### Visual regression (deferred to follow-up if time-constrained)

- Playwright at 1600×720: anchor matches → Row 6 renders → snapshot.
- Playwright at 1600×720: no anchor matches → Row 6 absent → snapshot.

---

## Related surfaces

- **`live-exploit-citation`** — sibling surface; predicate-level citation; coexists in different LiveAdviceBar row (when ENABLE_EXPLOIT_CITATION ships in future Phase 9 of exploit-deviation project).
- **`anchor-library`** — study surface; transparency panel; long-press detail; same anchor data, different render rules.
- **`hand-replay-view`** — host of HandReplay's deferred-drill panel (future v2 consumer of `pending_deferred_drill` state).
- **`calibration-dashboard`** — future surface; tap deep-link target per AP-07 line 112; out of scope for v1.

---

## Change log

- **2026-05-09** — Created in Gate 4 of SPR-059 (WS-016 EAL Stream C). Companion to Gate 1 audit `audits/2026-05-09-entry-eal-stream-c-live-anchor-badge.md`. Inherits constraints from 2026-04-24 EAL Blind-Spot Roundtable (Gate 2). v1 main-app TableView only; sidebar mirror deferred. Tap interaction is deferred-drill stub (v2 wires HandReplay consumer).
