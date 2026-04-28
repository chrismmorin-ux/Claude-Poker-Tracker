# Internal Observation Pass — Sidebar Coherence Inventory (Visual + Architectural)

**Date:** 2026-04-27
**Auditor:** Claude (main)
**Working project name:** Sidebar Holistic Coherence (SHC)
**Gate:** 3 (Research — deliverables #4 + #5)
**Scope:** Scope A locked (fluent-user / training-cost only; no first-impression / E-IGNITION concerns).
**Method:** Visual layer derived from pre-existing harness screenshots (16 static + 8 temporal in `ignition-poker-tracker/side-panel/harness/screenshots/`) + fixtures.js state shapes. Architectural layer derived from direct read of `render-orchestrator.js`, `render-tiers.js`, `render-street-card.js`, `side-panel.js`, `shared/design-tokens.js`, `shared/stats-engine.js`. **No live `npm run harness` walk** this session — flagged as a follow-up if the existing screenshots are stale relative to current main.
**Status:** DRAFT — pending owner review

---

## Executive summary

This document is the **load-bearing prerequisite** flagged by Gate 2 outside-lens (Stage E6 / Required follow-up #5): the shell spec at Gate 4 must be both *authorable* (vocabulary inventory) and *implementable* (mechanism inventory). Without the architectural pass, two zones can comply with the same shell-spec rule and still diverge in behavior because their state-clearing conditions differ.

**Headline findings:**

1. **D-1 confirmed in 3 code locations** (Z2 unified header, Z2 context strip, Z4 glance tier) — three different visual treatments for `mq.overallSource`, all consuming the *same upstream data*. The architectural divergence is purely presentational; the inputs are unified.
2. **D-2 confirmed in 7 design-token roles + 1 status-dot class** — `#fbbf24` (yellow) is canonical-yellow for `trust-marginal`, `action-call`, `priority-med`, `m-yellow`, `color-warning`, plus `status-dot yellow` (connectivity disconnect) and pipeline-health yellow (waiting). One color, no semantic isolation.
3. **D-3 confirmed with disjoint mechanisms** — Z0 pipeline-health is *state-derived per render* (no timer); Z2 stale-advice is *threshold-driven on age + 1Hz refresh timer*; the underlying staleness signal for Z3 deep content is *two-phase timer* (60s indicator at 60s, full clear at 120s). Three sources of staleness truth, three different clearing models.
4. **Two writers contend for the `#status-dot` class** (`buildStatusBar()` in render-orchestrator.js + `renderConnectionStatus()` in side-panel.js). Per-render order matters; race risk acknowledged in code comments but not asserted.
5. **Sample-size displayed in 2+ string formats across zones** — `n=45` (Z2 unified header + Z4 glance), `45h` (stat chips in Z2 context strip + Z4 villain pills), and inline numerals elsewhere. Same concept, different lexical shape per surface.
6. **Chevron affordance shows direction inconsistency** — "More Analysis" displays chevron-up (▴) in expanded state; "Villain Range" / "Fold Curve" / "Model Audit" display chevron-right (▸) in collapsed state. Mixed direction-as-state semantic.

---

## Part 1 — Visual layer catalog (Item #4)

The catalog is organized by **concept-class** (per shell-spec terminology), not by zone — because the entire SHC question is whether the same concept renders consistently across zones.

### CC-A — Status / connectivity / pipeline-health

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-A-1 | Z0 connection status dot | All fixtures (top-left of status bar) | Colored dot (green / yellow / red) + status text to its right | Green=tracking+hands; yellow=waiting/disconnect/SW-not-responding; red=contextDead |
| CC-A-2 | Z0 hand count | All fixtures with hands (top-right) | Numeric `190` in gold/yellow color | Becomes `0` in `noTable` and `appDisconnected` shows `78` (last-known) |
| CC-A-3 | Z0 app-status badge | All fixtures (top-right) | Pill: green "App synced" / orange "App not open" | Distinct from CC-A-1; only encodes app-bridge state, not table/SW state |
| CC-A-4 | Z0 pipeline-health strip | `noTable` only (visible when `!hasHands`) | Five gray dots labeled `PROBE` `BRIDGE` `FILTER` `PORT` `PANEL` connected by hairline | Hidden once hands arrive |
| CC-A-5 | Recovery banner | Not in any standard fixture; appears on `recoveryState` | Banner with "Reload Ignition Page" button | Triggered by `connState.cause === 'contextDead'` |

**Cross-element observations:**
- Three independent surfaces (CC-A-1, CC-A-3, CC-A-4) communicate connectivity-class state. Each uses a different shape-class (dot vs pill vs strip-of-dots).
- The pipeline-health strip (CC-A-4) only appears when there's nothing else to render — it acts as an *empty-state* educator rather than a persistent-status indicator.
- Yellow appears in CC-A-1 (disconnect), CC-A-2 (hand count is gold-colored which reads similar to yellow at small size), and CC-A-3 (orange "App not open" which is adjacent to yellow in palette). **Three adjacent-color surfaces in the 16-pixel-tall status bar with no shared semantic key.**

### CC-B — Freshness / staleness

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-B-1 | Z2 stale-advice badge | `temporal-staleContextTimeout` + visible only in temporal flow | Text badge `Stale Ns` (with aging counter) OR `Stale — recomputing` (street-mismatch variant) | Appended to `action-bar` DOM node; refreshes every 1000ms |
| CC-B-2 | Z0 connection-status dot transition to yellow | `appDisconnected` fixture | Same dot shape as CC-A-1, color flip | Also conveys staleness implicitly (no fresh data flowing) but primary semantic is connectivity |
| CC-B-3 | Z3 "Waiting for next deal…" / "Waiting for flop…" / "Analyzing…" placeholders | `betweenHands` / `appDisconnected` / `preflopNoAdvice` | Plain muted-gray text in centered banner | Acts as freshness signal by absence (no live decision content) |
| CC-B-4 | Z2 cards-strip blanking on hand-end | `betweenHands` (after street ends) | Pot pill + street pill disappear when `live.state === 'COMPLETE' \|\| 'IDLE'` | SR-6.12 Z2 §2.7/§2.8 — explicit hand-live guard before rendering pot/street pills |

**Cross-element observations:**
- Three different visual treatments for "data is no longer current": text badge (CC-B-1), color flip on existing dot (CC-B-2), placeholder text (CC-B-3), and content-disappearance (CC-B-4). **No shape-class consistency across them.**
- Only CC-B-1 includes an aging counter; the others are binary (signal present/absent).
- D-3 forensics verbatim: "A user who learns 'yellow dot = stale data' from Z0 will not recognize 'Stale 23s' text badge in Z2 as the same concept-class."

### CC-C — Confidence / sample-size / model-quality

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-C-1 | Z2 unified header confidence dot | `flopWithAdvice`, `pinnedVillainOverride`, `riverValueBet` (any with advice) | `confidence-dot green/yellow/red` adjacent to `n=NN` text in villain-meta row | Tooltip carries "Player model" / "Mixed (model + population)" / "Population estimate" |
| CC-C-2 | Z2 context strip opacity-on-value | (same as CC-C-1) | CSS class `conf-player`/`conf-mixed`/`conf-population` modulates opacity of the *data value* itself (Equity, Pot odds, Model size) | **Has no legend.** Value-brightness only. Opacity tiers per spec §4: 100%/80%/60%. |
| CC-C-3 | Z4 glance-confidence dot + n= label | (any with advice that surfaces glance tier) | `confidence-dot green/yellow/red` + adjacent `confidence-label` text `n=NN` | Same dot shape as CC-C-1; difference is the inline label vs sibling-element label |
| CC-C-4 | Stat-chip sample suffix | `betweenHands`, `flopWithAdvice` (Z3 villain pills) | Text suffix on style-chip rows, e.g. `S1 Fish 30h`, `S3 TAG 45h CB:72%` | Uses `Nh` format ("hands") — different lexical form from `n=NN` in CC-C-1/C-3 |
| CC-C-5 | Style badge color | All fixtures with stats | Categorical color per style: Fish=red-pink, LAG=orange, TAG=green, Nit=blue, LP=yellow, Reg=purple | `STYLE_COLORS` in `shared/stats-engine.js:327` |
| CC-C-6 | Inline stat without confidence treatment | `flopWithAdvice` Z3 (`CB:72%`) | Plain numeric stat with no opacity, no dot, no n= | Inconsistent with CC-C-2's value-opacity treatment |

**Cross-element observations (D-1 forensics confirmed):**
- CC-C-1 + CC-C-2 + CC-C-3 all consume the **same upstream signal** (`advice.modelQuality.overallSource`) but render it three distinct ways: dot, opacity, dot+label.
- Within Z2 alone (CC-C-1 + CC-C-2), the confidence treatment splits across two visual idioms — *the user has to learn both even if they only ever look at Z2*.
- CC-C-2 (opacity) is **invisible to anyone scanning for confidence** — it modulates value-brightness with no legend; a fluent user who learned the dot in CC-C-1 has no signal to recognize it.
- CC-C-4 vs CC-C-1/C-3 is a **lexical inconsistency** (`30h` vs `n=30`), not a visual-shape inconsistency. Same concept, different text.
- CC-C-5 (style badges) carry color semantics (Fish=red is *negative-coded*, TAG=green is *positive-coded*) which collide with confidence-dot color semantics (red=low-confidence vs red=Fish-style). **Two color semantics on the same hue.**

### CC-D — Affordance vocabulary (drill-down + interaction)

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-D-1 | "More Analysis" expandable section header | All fixtures with advice (Z4) | Header text + chevron-up `▴` (when expanded) / chevron-down (when collapsed) | Up = expanded; Down = collapsed (spatial-direction maps to state) |
| CC-D-2 | "Villain Range · 66 combos" / "Fold Curve · Personalized" / "Model Audit" sub-section headers | `flopWithAdvice`, `riverValueBet` (Z4) | Header text + chevron-right `▸` (collapsed) | Right = collapsed; **inconsistent with CC-D-1's down-as-collapsed** |
| CC-D-3 | "show tournament log" / "show diagnostics" links | `noTable`, `betweenHands` | Underlined gray-blue text | Underline = navigation link affordance |
| CC-D-4 | Big colored action button | All advice fixtures (Z2 unified header) | Large bold text in colored pill (CALL=yellow, BET=green, RAISE=green, FOLD=red) + `+1.8bb` EV adjacent | Color = action-class category |
| CC-D-5 | Tappable seat-arc circle | All fixtures | Circular ring around seat number with action-amount text below | Click affordance not visually signposted (no chevron, no underline); discovered by user |
| CC-D-6 | Stat-chip pin affordance | Fixtures with Z3 stat chips | Stat chip in dark-gray pill | Click pins villain (per app-spec); not visually signposted |
| CC-D-7 | Star ★ on hero seat | All fixtures with hero | Gold star in seat circle | Decorative-with-meaning (hero indicator) |
| CC-D-8 | Diamond ♦ on blocker line | `flopWithAdvice` (Z3) | Cyan/blue diamond glyph before blocker text | Decorative-with-meaning (blocker emphasis) |
| CC-D-9 | "PFA" badge on seat | `flopWithAdvice` (Z1 seat arc) | Small orange/red text label `PFA` above seat circle | Action-class label (preflop-aggressor) |
| CC-D-10 | "B $12" / "C $6" action labels under seat | All fixtures with action | Single-letter action code + amount, color-coded | B=bet, C=call, R=raise; categorical |

**Cross-element observations:**
- **Chevron direction is the dominant affordance inconsistency:** CC-D-1 uses up/down (state semantic); CC-D-2 uses right (toggle semantic). A fluent user who learns CC-D-1's "down means collapsed" has the wrong mental model for CC-D-2.
- Three independent click-affordance treatments coexist: chevron (CC-D-1, CC-D-2), underline (CC-D-3), no-affordance-but-clickable (CC-D-4, CC-D-5, CC-D-6). The R-1.5 dangling SR-4-spec-index reference is unenforceable because there is no canonical chevron-vs-underline-vs-no-signpost rule.
- Decorative glyphs (CC-D-7 star, CC-D-8 diamond) are reusable but not enumerated — a future panel could invent a new glyph without conflicting with existing rules.

### CC-E — Tournament-specific signals

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-E-1 | Tournament bar with M-ratio | `betweenHandsTournament` only | Pill `M 8.5` (yellow background, dark text), separator, `Lvl 9 22/120` text | M-color zones: `m-green/m-yellow/m-orange/m-red` (`design-tokens.js:75-79`) |
| CC-E-2 | ICM zone label on seat | `betweenHandsTournament` (above hero seat) | `ID:?2/?` text in green | Tournament-only annotation |

**Cross-element observations:**
- M-ratio yellow (`#fbbf24`) is **the same hex** as confidence-yellow (CC-C-1) and disconnect-yellow (CC-A-1) — D-2 in action: a user glancing at the tournament bar processes the same color signal as a low-confidence advice indicator, with no visual disambiguation.

### CC-F — Decision content (recommendations + EV bars + range bars)

| ID | Visual signal | Where (zones / fixtures) | Visual treatment | Notes |
|---|---|---|---|---|
| CC-F-1 | Hand-plan branch label | `flopWithAdvice` (Z3 hand plan) | "If CALL" pill (cyan) + arrow → "Barrel favorable turns" | Pill color matches CC-D-4 action-class |
| CC-F-2 | EV bar (green/red split) | `flopWithAdvice` (under "Barrel favorable turns") | Horizontal bar: green-left, red-right, with `18/47` numerator | Visualizes EV split |
| CC-F-3 | Range-vs bar | `flopWithAdvice` ("RANGE VS S3") | Horizontal bar: "Hero 54%" green-left, "Villain 46%" red-right | Same shape as CC-F-2 — different concept |
| CC-F-4 | Sizing fold-curve bars | `riverValueBet` (Z3 fold-by-sizing rows) | Horizontal bars per sizing row, color-coded by fold% (red→yellow→green continuous) | Color encodes fold% magnitude (gradient, not categorical) |
| CC-F-5 | Weakness annotation dot | `flopWithAdvice` (last row in Z3) | Red bullet `●` + text "S3: Overfolds to flop raises…" | Red bullet is the only signal; no "weakness" label, no severity indicator |

**Cross-element observations:**
- CC-F-2 and CC-F-3 are visually indistinguishable bar treatments encoding **different concepts** (EV-of-action vs range-equity-split). A fluent user reads them by context label, not shape.
- CC-F-4 introduces a **gradient color scheme** (red→yellow→green continuous) on top of the categorical scheme used everywhere else (red=fold/Fish, yellow=marginal/disconnect, green=value/TAG). Two color systems on bars in the same zone.

---

## Part 2 — Architectural mechanism map (Item #5)

For each visual signal in Part 1, this section documents: (a) the code that computes it, (b) the trigger that changes its state, (c) the condition that clears it, (d) the timer it's bound to (if any).

### CC-A — Status / connectivity / pipeline-health

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-A-1 | `buildStatusBar()` `render-orchestrator.js:1324-1343` (sets `dotClass`); `renderConnectionStatus()` `side-panel.js:198-218` (also sets `dot.className`) | `pipeline.tableCount`, `handCount`, `connState.connected/cause` | Pipeline-status push, connection-state callback | Per-render replacement (CSS class swap on `#status-dot`) | **NONE** — state-derived per render |
| CC-A-2 | `applyState()` `harness.js:80-85` (and equivalent in side-panel.js); `$('hand-count').textContent = handCount` | Sum of `cachedSeatStats[*].sampleSize` | `handsUpdated` push, `cachedSeatStats` recompute | Per-render | NONE |
| CC-A-3 | `updateAppStatus()` `side-panel.js:253-263` | `lastGoodExploits.appConnected` | `push_exploits` with `appConnected` field | Per-render replacement (className + textContent) | NONE |
| CC-A-4 | `pipeline-health` element (separate render path; visibility toggled by `applyState` based on `hasHands`) | `pipeline.tables` shape | Pipeline-status push | Hidden when `hasHands === true` | NONE |
| CC-A-5 | `recovery-banner` element; `renderRecoveryBanner()` (around `side-panel.js:170-193`) | `connState.cause === 'contextDead'` | Connection callback | User clicks "Reload" → `coordinator.dispatch('recoveryBanner', 'userReload')`; `coordinator.scheduleTimer('recoveryBtn_reEnable', 5000)` re-enables button after 5s | 5s re-enable timer (per-button) |

**Architectural finding A-A:** **CC-A-1 has two writers** that race per render. `buildStatusBar()` returns `{dotClass, text}` consumed by the harness `applyState()` and (separately, in a path I haven't traced exhaustively) likely by `updateStatusBar()` in side-panel.js. `renderConnectionStatus()` *also* sets `dot.className` directly. The order of these two writes per `scheduleRender` cycle is implicit. Comment at `side-panel.js:204-207`: *"text ownership belongs to the status-bar renderer"* — but **dot ownership is dual.** Race is currently latent because both writers tend to converge on the same value when state is consistent, but a connection event arriving between renders could flip the dot to a value that the next status-bar render overrides.

**Architectural finding A-B:** **CC-A-1 and CC-A-4 are different data sources for the same conceptual question** (is the pipeline healthy?). CC-A-1 derives from `connState` + `pipeline.tableCount` + `handCount`; CC-A-4 derives from `pipeline.tables` shape (per-stage health). They could disagree under partial-failure conditions (e.g., `BRIDGE` stage broken but service worker still responding).

### CC-B — Freshness / staleness

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-B-1 | `computeAdviceStaleness()` `side-panel.js:1058-1066`; `updateStaleAdviceBadge()` `:1068-1087` | `advice._receivedAt` (age in ms) + `ctx.currentStreet` (mismatch detection) | `_receivedAt` is set by `coordinator.handleAdvice` (RT-59 path); badge appears when age > 10_000 OR `advice.currentStreet !== ctx.currentStreet` | `badge.remove()` when `isStale === false` (badge re-appears on next stale tick) | **1Hz interval** via `coordinator.scheduleTimer('adviceAgeBadge', …, 1000, 'interval')` `side-panel.js:1093-1099`; cancelled on table-switch (RT-60 contract) |
| CC-B-2 | `renderConnectionStatus()` `side-panel.js:212-214` | `connState.cause === 'disconnect'` | Connection-state callback | Connection re-established → callback resets connState | NONE |
| CC-B-3 | `buildActionBarHTML()` `render-orchestrator.js:293-298` ("Waiting for next deal…"), `:301-306` ("Analyzing…") | `!hasAdvice && !isLive` (waiting); `!hasAdvice && isLive` (analyzing) | Per-render derivation | New advice arrives (`hasAdvice === true`) | NONE |
| CC-B-4 | Inline check in `buildActionBarHTML()` `render-orchestrator.js:220` — `handLive` guard | `live.state === 'COMPLETE' \|\| 'IDLE'` blanks pot + street | Live-context push with new state | Per-render derivation; pot/street re-appear on next live state | NONE |

**Architectural finding B-A (D-3 expanded):** Three staleness mechanisms with **three independent clearing models:**
- CC-B-1 (Z2 stale-advice): age-based, 1Hz refresh, threshold = 10_000ms OR street-mismatch. Cleared by *fresh advice push* OR *street alignment*. Mechanism is **timer-driven aging counter**.
- CC-B-2 (Z0 disconnect): connection-event-driven, no timer. Cleared by *connection re-established*. Mechanism is **state-event-driven**.
- CC-B-3 (placeholder): per-render-derived from current state, no timer. Cleared by *advice arrival*. Mechanism is **state-derived absence-of-data**.
- The **two-phase staleContext timer** (`side-panel.js:536-548`) is *not directly visible* but governs whether `currentLiveContext` itself gets nulled at 120s — which then makes CC-B-3 ("Waiting…") fire. Mechanism is **data-clearing timer that surfaces visually only by changing what other renderers can read**.

**Implication for shell spec:** R-1.7 (staleness shape-class consistency) is satisfiable in spec via `dot/badge/strip` enumeration, but **the four listed mechanisms above clear on different events** — even if every freshness signal becomes a `dot`, the dot in Z0 would clear on connection-event, the dot in Z2 would clear on advice-push, the dot in Z3 would clear on render-derivation. **A user seeing two zones report different staleness states for the same underlying fact** would be a spec-compliant outcome under R-1.7 alone. R-1.7's *Caveat* in doctrine v3 is exactly this — confirmed here with code citations.

### CC-C — Confidence / sample-size / model-quality

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-C-1 | `buildPlanPanelHTML()` (or `_buildStandardActionBar` + `uh-villain-side` block) `render-orchestrator.js:149-169` — sets `confidence-dot ${confClass}` | `advice.modelQuality.overallSource` ∈ {`'player_model'`, `'mixed'`, other} | Advice-push updates `mq.overallSource` | Per-render replacement (innerHTML rebuild) | NONE |
| CC-C-2 | `buildContextStripHTML()` `render-orchestrator.js:441-444` — `confClass = conf-player/conf-mixed/conf-population`; applied to value spans at lines 450, 462, 465, 470 | Same as CC-C-1 (`advice.modelQuality.overallSource`) | Advice-push | Per-render | NONE |
| CC-C-3 | `renderTier1Glance()` (or equivalent) `render-tiers.js:67-74` — `confidence-dot ${confClass}` + `<span class="confidence-label">n=NN</span>` | Same as CC-C-1 (`advice.modelQuality.overallSource`) | Advice-push | Per-render | NONE |
| CC-C-4 | `buildBetweenHandsHTML()` (table reads section) — appends `Nh` suffix from `cachedSeatStats[seat].sampleSize` | `cachedSeatStats[*].sampleSize` (computed from hand history, not from `mq`) | Hand-stats refresh (`refreshHandStats`) | Per-render | NONE |
| CC-C-5 | `STYLE_COLORS` lookup `shared/stats-engine.js:327-335` — `{ bg, text }` per style | `vStyle` (derived from style classification — separate from `mq`) | Stats recompute on hand-update | Per-render | NONE |
| CC-C-6 | Inline stat strings in `render-street-card.js` and `render-tiers.js` (e.g., `CB:72%`) | `cbet`, `foldToCbet`, etc. from `cachedSeatStats` | Hand-stats refresh | Per-render | NONE |

**Architectural finding C-A (D-1 expanded):** CC-C-1, CC-C-2, CC-C-3 are **fed from the same `advice.modelQuality.overallSource` upstream value** but render via three different DOM patterns:
- CC-C-1: `confidence-dot` element (visual shape), tooltip carries semantic label
- CC-C-2: opacity CSS class on the data-value `<span>` (no separate visual), no legend
- CC-C-3: `confidence-dot` element + sibling `confidence-label` text (different DOM structure than CC-C-1 even though both use `confidence-dot`)

**The architectural divergence is purely presentational; no upstream data divergence.** This means a Gate 4 shell-spec consolidation could trivially unify these without touching state-management — purely a render-layer change. **Lowest-cost-to-fix forensic in the audit.**

**Architectural finding C-B:** CC-C-4 is a **second confidence-related signal driven from a different upstream** (`cachedSeatStats[*].sampleSize` rather than `mq.overallSource`). The two upstreams update on different cadences:
- `cachedSeatStats` recomputed in `refreshHandStats()` `side-panel.js:386-393` only when `tableHands.length` changes from cached count
- `advice.modelQuality` updates per `push_action_advice`
- **Possible to be in a state where Z3 villain pill says `45h` while Z2 confidence dot is yellow (mixed)** — both true at different moments, but visually they coexist on screen.

**Architectural finding C-C:** CC-C-5 (style-badge color) and confidence-dot color (CC-C-1) **share the same hue palette** (red/yellow/green) for unrelated semantics. No code-level guard prevents new contributors from picking a color that collides further. D-2 forensic operates at design-tokens layer (line 31 trust-marginal vs line 47 action-call), but the collision is visible in render layer too.

### CC-D — Affordance vocabulary

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-D-1 | "More Analysis" expandable — handler in `side-panel.js` (collapse state) + render in `render-tiers.js` | Local UI state (collapsed/expanded boolean) | User click on header | Per-click toggle | NONE |
| CC-D-2 | Sub-section headers (Villain Range, Fold Curve, Model Audit) | Local UI state per section | User click on header | Per-click toggle | NONE |
| CC-D-3 | "show tournament log" / "show diagnostics" — anchor links | Static UI elements | User click navigates | n/a | NONE |
| CC-D-4 | `_buildStandardActionBar()` `render-orchestrator.js:128-138` — `<span class="action-badge ${badgeClass}">` | `rec.action` from advice.recommendations[0] | Advice-push | Per-render | NONE |
| CC-D-5 | `buildSeatArcHTML()` `render-orchestrator.js:~1100-1230` (full seat-arc render) | `cachedSeatStats`, `currentLiveContext.foldedSeats`, `pinnedVillainSeat` | Stats-refresh, live-context push, click | Click changes `pinnedVillainSeat`; render replaces DOM | NONE |
| CC-D-6 | Stat-chip rendering in `render-street-card.js` / villain-pills section; click handler dispatches `rangeSelectedSeat` set | `cachedSeatStats`, `pinnedVillainSeat` | User click | Pinned villain cleared on `bet`/`raise` action (`side-panel.js:500-511`) or hand boundary | NONE |
| CC-D-7 / CC-D-8 / CC-D-9 / CC-D-10 | Inline literals in render functions | Various | n/a (decorative or per-render derivation) | Per-render | NONE |

**Architectural finding D-A:** **CC-D-1 and CC-D-2 use different chevron direction conventions** — same code base, different sections. A search for chevron usage would show this as a pattern-divergence; no rule currently constrains it. The R-1.5 dangling SR-4-spec-index reference is the rule that should cover this; the absent index makes the divergence undetectable by automated lint.

**Architectural finding D-B:** **CC-D-5 and CC-D-6 (pin affordance) are not visually signposted.** A click-handler exists but no chevron/underline/badge tells the user it's clickable. Discoverability relies on tooltip-on-hover or trial-and-error. This is the *opposite* of CC-D-1's over-signposting (chevron + clickable header). **Inconsistency: some clickable elements signpost; others don't.**

### CC-E — Tournament

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-E-1 | Tournament bar render — `side-panel.js:561` ($('tournament-bar') manipulation), `:596` (mini variant) | `lastGoodTournament` (set by `push_tournament`) | Tournament push | **Cleared on table switch** (`coordinator.clearForTableSwitch`) | NONE |
| CC-E-2 | ICM zone label — within tournament bar | Same as CC-E-1 | Tournament push | Same as CC-E-1 | NONE |

**Architectural finding E-A:** CC-E-1's `m-yellow` color hex is identical to confidence-yellow / disconnect-yellow / warning-yellow / call-action-yellow per design-tokens.js. The token name `m-yellow` is *positionally* labeled (M-zone-2) but uses `#fbbf24` — D-2 forensic confirmed.

### CC-F — Decision content

| ID | Compute site | State source | Trigger to change | Clearing condition | Timer |
|---|---|---|---|---|---|
| CC-F-1 | Hand-plan branch in `render-street-card.js` (hand-plan section) | `advice.handPlan` (one branch per hero action) | Advice-push | Per-render | NONE |
| CC-F-2 | EV bar in hand-plan branch | `advice.handPlan[*].ev`, `successCount/totalCount` | Advice-push | Per-render | NONE |
| CC-F-3 | Range-vs bar in `render-street-card.js` ("RANGE VS S3" section) | `advice.heroEquity`, `1 - heroEquity` | Advice-push | Per-render | NONE |
| CC-F-4 | Sizing fold-curve bars in `render-street-card.js:908` — `color = foldPct >= 50 ? 'var(--m-green)' : foldPct >= 30 ? 'var(--m-yellow)' : 'var(--m-red)'` | `foldMeta.curve[*].foldPct` | Advice-push | Per-render | NONE |
| CC-F-5 | Weakness annotation in `render-street-card.js` (or weakness section) | `lastGoodWeaknesses` (set by `push_exploits`) | Exploits push | Per-render | NONE |

**Architectural finding F-A:** **CC-F-4 reuses `m-green/m-yellow/m-red` tokens for fold% gradient coloring** (`render-street-card.js:908`) — these are tournament M-ratio tokens being repurposed for fold-percentage semantics. **Token-name vs use-site mismatch.** The tokens encode their *intended* semantic (M-ratio zones) but get applied to a different concept (fold equity). D-2 widening: not just one color shared across roles, but a *named token bundle* shared across roles.

**Architectural finding F-B:** CC-F-2 and CC-F-3 use visually-identical bar shapes for different concepts. No shared component; each rendered inline by its own render function. A future shell-spec "bar" affordance would need to either (a) treat them as the same primitive with different labels, or (b) introduce a shape difference (e.g., divider style) to distinguish them.

---

## Part 3 — Cross-cutting findings

### F-1: D-1 forensic is a render-layer-only divergence
CC-C-1, CC-C-2, CC-C-3 share upstream `advice.modelQuality.overallSource`. The D-1 violation is presentational, not architectural. **Consolidation cost is low** — a single render helper that picks one treatment fixes all three sites.

### F-2: D-3 forensic is architectural and not closed by R-1.7
Each freshness signal has a different clearing model (per-render-derived, threshold-driven 1Hz timer, connection-event-driven, two-phase aging timer). R-1.7's shape-class enumeration unifies *appearance* but not *behavior*. **Mechanism coherence (when does the signal clear?) is the load-bearing concern** for fluency-acquiring users.

### F-3: D-2 forensic widens beyond design-tokens
Beyond the 7 token roles + 2 status-dot uses cataloged in Gate 2, the M-ratio token bundle (`m-green/m-yellow/m-red`) is **reused at the render-layer for fold-percentage semantics** (`render-street-card.js:908`). The token-as-value-source-of-truth assumption is broken whenever a render function reaches for a semantically-named token to color an unrelated concept.

### F-4: Status dot has dual ownership
`#status-dot` className is set by both `buildStatusBar()` (status-bar renderer) and `renderConnectionStatus()` (connection callback path). Race-condition latent. Doctrine R-2.3 exists to prevent `classList.toggle` outside FSM transitions — this is the same class of risk on a per-render path.

### F-5: Click-affordance discipline is bimodal
Some clickable elements over-signpost (chevron + header → CC-D-1, CC-D-2). Some clickable elements under-signpost (seat-arc circle, stat-chip pin → CC-D-5, CC-D-6). No consistent rule. **CC-91 (predictable affordance vocabulary) cannot be served until this is reconciled.**

### F-6: Lexical inconsistency in sample-size display
`n=45` (Z2 unified header + Z4 glance) vs `45h` (Z3 stat chips) for the same underlying value. Same shape-class (text suffix) but different lexical form.

### F-7: Decorative-vs-semantic glyph vocabulary is unbounded
Star (hero), diamond (blocker), bullet ●, chevrons (▴ ▸), arrow (→). No enumeration; new panels can invent. **Not a violation today** but a drift risk.

### F-8: `betweenHands` and `staleContextTimeout` screenshots are visually identical
Both render "Waiting for next deal…" + table reads. The user cannot visually distinguish "between hands, fresh" from "stale context, just timed out." Mechanism diverges (one is `state === COMPLETE`, the other is `currentLiveContext` nulled by 120s timer) but visual presentation is the same. **Possible spec gap:** stale-but-was-live should look different from clean-between-hands.

---

## Part 4 — Method limitations and follow-ups

### Limitations of this pass

- **Did not run `npm run harness` live** — used pre-existing screenshots in `harness/screenshots/`. If the rendering has changed since those screenshots were generated, the visual catalog is stale. Verification: run `npm run harness:build` and diff the screenshots.
- **Did not exhaustively read every render function.** Coverage focused on advice header, context strip, glance tier, status bar, staleness logic, design tokens, style colors. `render-street-card.js` (handPlan, fold curves, range bar, weaknesses) was sampled, not fully traced. **Likely additional drift exists in the unread sections.**
- **Did not inspect CSS file** — the `.confidence-dot.green` / `.conf-player` opacity values, `.stale-badge` styling, etc. are inferred from class names + spec mentions. CSS file may carry additional drift not visible in JS.
- **Did not run dynamic interactions** (clicking a chevron, pinning a villain, hovering a tooltip). Only static rendering examined.
- **No telemetry on user re-decoding cost** — F8's hypothesis (stale-but-was-live should look different) cannot be empirically supported without observation. Falls into [SFA3] proto caveat in `personas/situational/sidebar-fluency-acquiring.md`.

### Concrete follow-ups (not blocking Gate 4)

1. Live harness pass: run `npm run harness` + Playwright MCP to refresh screenshots and verify the catalog matches current main. Estimated: 30 minutes.
2. CSS audit: read `side-panel.css` (or equivalent) to confirm opacity values + `confidence-dot` color hex assignments match assumed design-tokens.
3. Exhaustive render-function trace: cover `render-street-card.js` `render-tiers.js` end-to-end. Likely surfaces additional D-1-class divergences in hand-plan / range / weakness sections.
4. Dynamic-interaction pass: trace what happens to each signal on hand-boundary, table-switch, app-disconnect, hero-fold. Confirms RT-60 / SR-6.x clearing contracts haven't drifted.

These follow-ups are tracked but **not gating** for the Gate 4 shell spec — the catalog above is sufficient to author the spec; the follow-ups would refine it.

---

## Cross-references

- **SHC Gate 1:** `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` §4.2 missing artifacts.
- **SHC Gate 2:** `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` Stage E5 (D-1, D-2, D-3 forensics), §Required follow-ups Gate 3 items 4 + 5.
- **Doctrine v3:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.6 (treatment-type consistency, citing D-1) + R-1.7 (staleness shape-class consistency, citing D-3) + R-1.7 *Caveat* (mechanism coherence is shell-spec concern).
- **Persona:** `docs/design/personas/situational/sidebar-fluency-acquiring.md` (Gate 3 deliverable #1).
- **JTBDs:** CC-90 (system-recognition), CC-91 (predictable affordance vocabulary), CC-92 (panel-blame / data-provenance), CC-93 (trust-the-stack) in `docs/design/jtbd/domains/cross-cutting.md` (Gate 3 deliverable #2).
- **Competitive review:** `docs/design/evidence/LEDGER.md` EVID-2026-04-27-COMP-{PT4, H2N, NOTECADDY, DRIVEHUD, GTOWIZARD, CROSS-PATTERNS} (Gate 3 deliverable #3).
- **Failure post-mortem:** `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` (S1–S5 + M1–M8 — structural baseline that this design-language pass sits on top of).

## Change log

- 2026-04-27 — Created. Gate 3 deliverables #4 (visual layer catalog) + #5 (architectural mechanism map) consolidated. Method limitations + follow-ups documented. Feeds Gate 3 deliverable #6 (sidebar-coherence-baseline.md) and Gate 4 shell-spec authoring.
