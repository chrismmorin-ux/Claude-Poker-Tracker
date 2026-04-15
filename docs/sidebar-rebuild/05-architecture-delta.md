# 05 — Architecture Delta (SR-5)

**Program:** Sidebar Rebuild (SR-0 → SR-7).
**Stage:** SR-5 architecture audit + ordered rebuild backlog.
**Status:** DRAFT — awaiting owner review. | **Authored:** 2026-04-13.
**Inputs:** six SR-4 spec files (`docs/sidebar-specs/*.md`), doctrine v2 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`), sealed inventory (`docs/SIDEBAR_PANEL_INVENTORY.md`), current render layer (`ignition-poker-tracker/side-panel/*.js` + `side-panel.html`).
**Output consumers:** SR-6 rebuild PRs behind `sidebarRebuild` flag (backlog §Ordered SR-6 items below), SR-7 cutover + post-mortem.

This is audit-only. No code modified. Every fix surfaces as an SR-6 backlog item.

---

## 0. Executive summary

The current sidebar is **architecturally on the right track since RT-43/60/61 and the Phase C/D sprint** — coordinator snapshot + renderKey + scheduleRender + registerTimer are in place and the primary render pipeline respects them. Residual gaps cluster in four areas:

1. **Zones are conceptual, not physical.** `side-panel.html` has no `<div class="zone-z0">` / `z1` / ... containers; all elements are flat siblings under `#hud-content` with no declared per-zone CSS height contracts. R-1.1 and R-1.4 are violated as a category, not at a specific line.
2. **Lifecycle is implicit.** No panel has a declared FSM (R-2.1). Transitions are inferred from state changes in message handlers; three panels (recovery banner, seat popover, deep expander) drive visibility via direct DOM mutation outside `scheduleRender`. RT-60 timer contract has 5 residual unregistered sites.
3. **Freshness is partial.** RT-48 stale-advice tint works, but (a) age is computed in two code paths, (b) no rendered value carries a `{value, timestamp, source, confidence}` record, and (c) `currentLiveContext` / `appSeatData` are full-replace-on-push (R-4.3 violation — ties to S1 rendering `$0` on partial payloads).
4. **Two user-visible regressions persist.** S4/02-a (pot chip stale between hands) and S4/02-b (street progress dots stale between hands) share a root cause: the between-hands Zx override does not blank Z2 live-context-derived elements. R-5.3 priority/routing was never declared for the Zx → Z2 overlap.

**Four blocking deltas require code changes before any zone-level PR ships:**

| # | Severity | Delta | Zone |
|---|---|---|---|
| B1 | blocking | 2.7 pot chip + 2.8 street progress stale between hands (S4/02-a, -b) | Z2 |
| B2 | blocking | 2.3 equity rendered in row 2 secondary slot, not inline on headline (R-5.1) | Z2 |
| B3 | blocking | 3.11 multiway seat selector missing entirely; 4.2 + 4.3 not separable collapsibles | Z3, Z4 |
| B4 | blocking | R-7.3 revoked 1-street gap still active at `render-coordinator.js:429` + `:513` | cross-cutting |

**Doctrine headline:** 27 of 33 numbered rules have at least one violating site. The 6 clean rules are R-1.5 (new, no specs coded yet), R-4.5 (confidence *is* threaded where it exists), R-6.1 (value-change durations in band), R-7.5 (N/A — no invariants have test-only labels to violate), and the two R-8 rules (out of code scope).

**Sequencing implication for SR-6:** foundation work (flag plumbing, renderKey completion, timer sweep, single-owner split of the street-card slot, freshness records) is a hard prerequisite for per-zone PRs. Per-zone PRs running in parallel before the foundation ships produces re-work. Owner has approved dependency-first sequencing.

---

## 1. Per-zone deltas

Each entry records one element: its current owner (file:line), the delta against SR-4 spec, and severity. `conformant` elements listed in aggregate per zone with exceptions called out.

### 1.1 Z0 — Chrome

| # | Element | Status | Delta |
|---|---|---|---|
| 0.1 | Pipeline dot (+ 0.5 absorbed) | conformant | — |
| 0.2 | "N captured" label | cosmetic gap | R-4.2 unknown placeholder `— captured` not exercised — code falls back to `0 captured` on missing count. |
| 0.4 | App-state badge | conformant | `updateAppStatus()` at `side-panel.js:203–208` mutates DOM directly without route through coordinator, but renderKey fingerprint captures the flip. Flagged under R-2.3, not a per-element bug. |
| 0.6 | Tournament-log link | behavioral | Conditional render on `lastGoodTournament != null` not traced to a single owner; slot reservation not enforced — if cash game, slot may collapse. |
| 0.7 | Diagnostics link | behavioral | **No debug-flag gate.** Current code always renders, toggles session-local `diagVisible` (`side-panel.js:1971–1979`). `settings.debugDiagnostics` key proposed by SR-4 is not instantiated in `chrome.storage.local`. |
| 0.8 | Invariant badge | conformant | RT-66 pattern shipped; emergency tier; 30s decay timer registered. |
| 0.9 | Pipeline health strip | conformant | — |

**Orphans in DOM:** none (0.3, 0.5 correctly absent).

### 1.2 Z1 — Table read

| # | Element | Status | Delta |
|---|---|---|---|
| 1.1 | Seat hands-count ring | behavioral | **Logarithmic ring-fill encoding missing.** Current code uses `.seat-sample-badge` text (`n=42`). Glance pathway R-1.5 violation: users read text, not geometry. R-4.2 placeholder `—` glyph for occupied-zero seats also missing. |
| 1.3 | Hero star | conformant | — |
| 1.4 | PFA annotation | conformant | — |
| 1.5 | Bet chip | conformant | Shared-slot priority with 1.10 enforced by data mutation (mutually exclusive streetBet/lastAction) rather than declared FSM — acceptable as-is per batch invariant 2. |
| 1.7 | Dealer button | conformant | — |
| 1.9 | Villain pill row | behavioral | Rule V Z1→Z3 contract: pill-click handler at `side-panel.js:1342–1359` mutates `pinnedVillainSeat` (module state → renderKey'd), which is then consumed by Z3 render-street-card. This is correct **data-flow** single-ownership but the "Z1 fires selection event, Z3 consumes" contract is not explicit in code — the coupling is via shared state, not event emission. Flag for spec-to-code contract clarification in SR-6. |
| 1.10 | Check indicator | conformant | — |
| 1.11 | Rule V seat-arc selection ring | **missing** | New inventory row per owner decision (this audit). Second visual channel on the seat circle. Not implemented. |

**Orphans in DOM:** none (1.2, 1.6 correctly absent; 1.8 correctly absent — lives in Z2 as 2.10).

### 1.3 Z2 — Decision

| # | Element | Status | Delta |
|---|---|---|---|
| 2.1 | Action headline | conformant | — |
| 2.2 | Edge callout | conformant | — |
| 2.3 | Equity inline | **blocking** | Renders in row 2 secondary-stat slot (`buildActionBarHTML` lines 341–344), not inline on the headline row. Spec declares 2.3 is sole equity owner inline with action word. Current form is the legacy combined layout that spec §8 explicitly rejects. |
| 2.4 | SPR row | conformant | — |
| 2.5 | Board chips | conformant | — |
| 2.6 | Hero cards | conformant | — |
| 2.7 | Pot chip | **blocking** | **S4/02-a regression.** Between-hands state does not clear `currentLiveContext.pot`; chip continues to show prior-hand pot. Root cause shared with 2.8 — Zx override fails to reset live-context-derived Z2 content. |
| 2.8 | Street progress strip | **blocking** | **S4/02-b regression.** Same root cause as 2.7 — filled dots persist between hands. Spec: reset all dots to hollow on `hand:new`. |
| 2.9 | "Analyzing…" placeholder | conformant | — |
| 2.10 | Stale tint + badge (absorbed 1.8) | conformant with caveat | Cross-zone contract with Z4 plan-panel: single timer (`adviceAgeBadge` registered) ✓. But age computation split across two sites (`side-panel.js:979` timer tick + `:1648` renderAll path). Coupling risk — see cross-cutting finding C7. |

### 1.4 Z3 — Street card

| # | Element | Status | Delta |
|---|---|---|---|
| 3.1 | Action history header | conformant | — |
| 3.2 | Action chips | conformant | — |
| 3.3 | Rationale | conformant | R-7.3 stale-recomputing suffix applied on street mismatch ✓. But this relies on the 1-street tolerance gate (R-7.3 revoked) still being active — see C4/B4. |
| 3.4 | Fold% callout | conformant | — |
| 3.5 | Hand plan tree | conformant | RT-61 auto-expand shipped correctly. |
| 3.6 | Range slot grid | conformant | Frame + XOR with 3.12 correct. |
| 3.7 | Range breakdown row | conformant | — |
| 3.8 | Range legend | conformant | Always rendered with grid. Grayed-with-3.12 path not explicitly traced — likely conformant but corpus gap per SR-4. |
| 3.9 | Waiting placeholder | conformant | — |
| 3.10 | DELETED ("Waiting for next deal") | verify | Needs confirmation no orphan DOM writes remain. |
| 3.11 | Multiway selector | **missing** | **No DOM, no handler.** `computeFocusedVillain` at `render-orchestrator.js:37–46` hardcodes priority; no user-driven tab/chip UI to override. Rule V item 6 (override) cannot fire from Z3; only from Z1 pill-click. |
| 3.12 | No-aggressor placeholder | conformant | — |

### 1.5 Z4 — Deep analysis

| # | Element | Status | Delta |
|---|---|---|---|
| 4.1 | PLAN chevron | behavioral | RT-61 auto-expand timer re-arms on every render of closed panel (`side-panel.js:1074 if (!isOpen)`). Spec: arm only on fresh advice arrival with non-empty `handPlan`. Also stale-tint cross-zone inheritance from Z2 (batch invariant 5) not applied to plan-panel body. |
| 4.2 | More Analysis collapsible | **blocking** | **Not separable from 4.3.** Current `deepExpanderOpen` (`side-panel.js:1146`) toggles both together. Spec requires `moreAnalysisOpen` + `modelAuditOpen` as independent coordinator keys. Content gate `lastGoodAdvice.alternatives` not enforced. |
| 4.3 | Model Audit collapsible | **blocking** | Same as 4.2 on split. Additionally: no `settings.debugDiagnostics` gate; spec requires full absence from DOM (not hidden) when flag off. No coordinator observer for flag flips. |

### 1.6 Zx — Overrides

| # | Element | Status | Delta |
|---|---|---|---|
| X.1 | Launch PT CTA (absorbed X.2) | conformant | `renderAppLaunchPrompt` at `side-panel.js:1212` — single-line merge implemented or trivially achievable. |
| X.3 | "No active table" + grace | conformant | 5s `tableGrace` timer registered ✓. |
| X.4 | Recovery banner (a/b/c) | behavioral | **X.4c known gap.** `setTimeout` at `side-panel.js:172` is bare — must use `coordinator.registerTimer('recoveryButtonReEnable', ...)`. Button disabled state also direct-DOM (R-5.2). |
| X.5 | Tournament top bar | conformant | DOM placement between `plan-panel` and `street-progress` at `side-panel.html:1586` matches spec (Zx-overlay-inside-active-hand-stack, not Z0 extension). |
| X.5b–g | Tournament detail rows | conformant | — |
| X.6 | Observer scouting panel | conformant | — |
| X.7 | OBSERVING badge | conformant | — |

---

## 2. Cross-cutting findings

### C1. Dual state ownership — **mostly resolved**
Primary render-driving state (`lastGoodAdvice`, `currentLiveContext`, `appSeatData`, `modeAExpired`, `staleContext`) lives in `coordinator._state`. Residual module-local state:
- `side-panel.js:1252` — `activePopoverSeat` (seat popover not coordinator-driven).
- `render-street-card.js:7–12` — `_prevStreet`, `_transitionTimer` (street-transition animation cache; private to render function).
- `side-panel.js:1699` — `cachedDiagnosticData` (unused after assignment; orphan from deleted panel).

**Disposition:** scope to SR-6 FSM work (C3). No user-visible defect.

### C2. Direct DOM mutations bypassing `scheduleRender`
Nine sites violate R-2.3:
1. `side-panel.js:125–126` — `onDisconnect` port callback → `status-dot.className` + `status-text.textContent`.
2. `side-panel.js:130–131` — `onContextDead` → same pattern.
3. `side-panel.js:136` — `onVersionMismatch` → `status-text.textContent`.
4. `side-panel.js:156–160` — `showRecoveryBanner` helper.
5. `side-panel.js:168–174` — recovery button click handler.
6. `side-panel.js:203–208` — `updateAppStatus` badge.
7. `side-panel.js:567–579` — tournament detail expand/collapse click handler mutates `detail.classList` + `chevron.classList` directly.
8. `side-panel.js:1149–1153` — deep expander click handler.
9. `side-panel.js:1328, 1338` — `showSeatPopover` / `hideSeatPopover` → `seatPopover.classList.remove/add`.

**Disposition:** SR-6 FSM authoring task (one FSM per panel). All of these get routed through the panel's transition handler.

### C3. Short-circuited FSMs
Three panels have no declared state machine and drive visibility via single-signal inference:
- **Recovery banner** (C2 #4/#5 sites) — no state enum, no named transitions; toggled by `push_recovery_needed` / `push_recovery_cleared`.
- **Deep expander** (C2 #8 site) — postflop auto-expand triggered by direct class mutation; no FSM with predicate.
- **Seat popover** (C2 #9 site) — `activePopoverSeat` module var is sole state.

Plus the **between-hands X.1 FSM**: spec declares predicate `(appConnected === false) AND betweenHandsOrIdle` with strict "no mid-hand mounts even if disconnected." Current code renders between-hands unconditionally when `snap.hasTableHands` is true (`side-panel.js:1670–1671`). No tier guard; no FSM gate.

### C4. Unregistered timers — **5 residual sites**
Per RT-60 contract, every `setTimeout`/`setInterval` must go through `coordinator.registerTimer`:
1. `side-panel.js:172` — recovery button re-enable (known — X.4c spec §6).
2. `side-panel.js:300–310` — `refreshHandStats` retry.
3. `side-panel.js:2169–2171` — diagnostics auto-refresh interval.
4. `side-panel.js:2200–2214` — fallback SW ping timeout.
5. `render-street-card.js:115, 126` — street-transition timers (module has no coordinator reference to register).

**Risk:** orphan-fire after table switch or tab unload.

### C5. renderKey fingerprint gaps
`buildRenderKey` at `render-coordinator.js:258–297` captures the main content fields but misses:
- `deepExpanderOpen` (in snapshot `:210`, not in key).
- `planPanelOpen` (in snapshot `:99`, not in key).
- `tournamentCollapsed` (in snapshot `:202`, not in key).
- `lastGoodExploits` (affects app-launch-prompt render at `:1691`).

`userCollapsedSections`, `focusedVillainSeat`, display-only `lastStreetCardHtml` — correctly excluded (derivable / display cache).

**Risk:** collapse/expand state can drift from DOM under concurrent updates.

### C6. Slot-collapse violations — **no Z2/Z3 violations**
`render-street-card.js:232` preserves slot height with zero-height placeholder ✓.
`side-panel.js:1012, 1030, 1056, 1169–1170` call `hideEl` on context strip, cards strip, plan panel, deep expander button — all in zones/elements where R-1.3 does not forbid collapse (or the zone's batch invariants permit unmount).

**No action.**

### C7. Stale-tint age computation split
Single data source (`lastGoodAdvice._receivedAt`) ✓. Single timer (`adviceAgeBadge`) ✓. Single render function (`updateStaleAdviceBadge`) ✓. But age is computed in two places: timer callback at `side-panel.js:979` and renderAll at `:1648`. Timer updates badge text; renderAll updates `.stale` class. Risk: one path stales before the other on edge timing.

**Disposition:** consolidate to one computation (SR-6, low-priority).

### C8. Full-replace-on-push partial-payload churn
`render-coordinator.js:482` — `this._state.currentLiveContext = { ...ctx, _receivedAt: ... }` replaces the entire object. `appSeatData` similarly full-replaced on exploit push. Violates R-4.3. Ties to symptom S1 (partial pushes drop prior fields → `$0` rendered).

### C9. R-7.3 revoked street-tolerance gate still active
`render-coordinator.js:429` permits 1-street gap (`(adviceRank - liveRank) <= 1`). Doctrine R-7.3 amendment revokes this; advice must match street exactly and transition through a declared "stale, recomputing" state. Second site at `:513` during mid-hand reconnect.

### C10. No `prefers-reduced-motion` handling
No `@media (prefers-reduced-motion: reduce)` block in `side-panel.html`. Pulse on status dot green runs on every tick (R-6.4 — but inert visually so low-impact).

### C11. `render-tiers.js` legacy structure
All functions (`renderGlanceStrip`, `renderQuickContext`, `renderDeepAnalysis`, `renderRangeBreakdownSection`, `renderAllRecsSection`, `renderStreetTendenciesSection`, `renderFoldCurveSection`, `renderFoldBreakdownSection`, `renderComboStatsSection`, `renderModelAuditSection`, `renderVulnerabilitiesSection`) map to Z4, but as one monolithic "deep analysis" block. SR-4 splits Z4 into three independent collapsibles (4.1, 4.2, 4.3). Current module structure makes the split awkward — SR-6 Z4 PR will need to extract `renderModelAuditSection` to its own owner.

---

## 3. Doctrine adherence audit

Rule-by-rule. `✓` = no violations found. Otherwise primary sites cited.

### §1 Hierarchy

- **R-1.1** — Zones not declared as explicit HTML containers (`side-panel.html:1563–1610` flat siblings). No fixed CSS heights per zone.
- **R-1.2** — Spatial-stability + glance-test not machine-verifiable without zone containers; implicit compliance.
- **R-1.3** — Violations at `side-panel.js:1670–1671` (between-hands collapse risk) and `render-street-card.js:54–71` (no explicit empty/stale state on `!isLive && !advice` branch). Non-violating sites at C6 noted.
- **R-1.4** — Same as R-1.1; zones lack DOM-boundary containers.
- **R-1.5** — ✓ (new rule; no specs yet coded against it — implementation lands in SR-6 Z* PRs).

### §2 Lifecycle FSMs

- **R-2.1** — No explicit FSMs anywhere. Lifecycle is handler-scattered.
- **R-2.2** — Violations at `render-street-card.js:115–127` (timer-driven transition without named event), `side-panel.js:1654–1655` (stale-class toggle without FSM trigger).
- **R-2.3** — 9 sites at C2.
- **R-2.4** — No explicit `hand:new` trigger mechanism. New-hand detection is implicit in `handleLiveContext` and not fanned out to panels. Every panel's `hand:new` behavior is declared in SR-4 specs; code must wire the trigger.
- **R-2.5** — 5 unregistered timers at C4.

### §3 Interruption tier

- **R-3.1** — No tier field on any rendered element. Tier is conceptual only.
- **R-3.2** — `side-panel.js:1671` renders between-hands during live hand without tier guard.
- **R-3.3** — Between-hands (informational) writes to street-card slot (decision-critical). No tier check.
- **R-3.4** — Primary driver of S4/02-a/b (B1). Between-hands has no declared distinct DOM region; overlaps Z2.

### §4 Freshness

- **R-4.1** — No `{value, timestamp, source, confidence}` records anywhere. Values are raw.
- **R-4.2** — Violations: `render-tiers.js:51` (`rec.ev ?? 0`), `render-street-card.js:145–150` (`detectStreetFromCards` defaults to `preflop`), Z0 row 0.2 (`— captured` fallback missing).
- **R-4.3** — C8 (full-replace-on-push).
- **R-4.4** — `updateStaleAdviceBadge` shipped (RT-48). No "stale, recomputing" label on advice panel during street mismatch (R-7.3 ties).
- **R-4.5** — ✓ (`confidence` threaded from `modelQuality.overallSource` at `render-tiers.js:69–74`).

### §5 Render contract

- **R-5.1** — street-card slot has 2 writers: `renderStreetCard` + (indirect via `renderBetweenHands`). Plan-panel slot: `renderPlanPanel` + class-toggles from stale-badge logic.
- **R-5.2** — 9 sites at C2.
- **R-5.3** — street-card slot content priority between advice + between-hands never declared. Current behavior: implicit `if (!isLive)` in `render-street-card.js:54–71`.
- **R-5.4** — 4 fields missing from renderKey (C5).
- **R-5.5** — `render-street-card.js:94–97` compares `innerHTML === html` ✓; `side-panel.js:1663` does likewise for street progress. Change-detection present.

### §6 Motion

- **R-6.1** — ✓ (`.value-flash 0.3s`, `.between-hands 200ms` opacity). Outlier: `.street-card.fade-in 0.15s` at `side-panel.html:739` is below the 200ms floor.
- **R-6.2** — `.deep-body max-height 0.35s` at `side-panel.html:1189` exceeds 300ms bound.
- **R-6.3** — No `prefers-reduced-motion` block (C10).
- **R-6.4** — `.status-dot.green` pulses on interval at `side-panel.html:54`. Visually inert but violates rule.

### §7 Invariants as gates

- **R-7.1** — `StateInvariantChecker` logs all violations post-render; no `warn`/`gate`/`emergency` level classification; no pre-render gate.
- **R-7.2** — `render-coordinator.js:354–368` logs after render, not before. Cross-panel invariant (advice-street vs context-street) evaluated but not used to block.
- **R-7.3** — **Revoked rule still active** at `render-coordinator.js:429` and `:513`. Plus no "stale, recomputing" label on advice panel. Primary blocking delta B4.
- **R-7.4** — Invariant badge + counter shipped via RT-66 ✓.
- **R-7.5** — ✓ (no invariants have test-only labels, but no rules are labeled at all — a spec gap, not a code violation).

---

## 4. Carried-input dispositions

### 4.1 Escalations from SR-4

- **E-2 (Z1 ring).** Rule V seat-arc selection ring. **Owner decision (this audit):** add as new inventory row **1.11**. New visual channel on the seat circle distinct from 1.1's hands-count ring and the existing pinned-villain ring. SR-6 ticket authored (see backlog item SR-6.11).
- **E-3 (Z2 between-hands regressions).** S4/02-a (pot) and S4/02-b (street progress). Audit confirms hypothesis — Zx override fails to clear Z2 live-context-derived elements on `hand:new`. Root cause is absence of explicit `hand:new` trigger fanning to Z2 panels. Fix rolls into SR-6.5 (FSM authoring) + SR-6.12 (Z2 PR).

### 4.2 Owner decisions forced at SR-5

1. **0.7 footer placement.** **Decided: bottom of sidebar** (true footer). Z0 is top-chrome; diagnostics is a low-priority utility link and belongs below the main content stack. SR-6.10 (Z0 PR) implements.
2. **E-2 Rule V ring.** **Decided: new inventory row 1.11** (above).
3. **`sidebarRebuild` flag scope.** **Decided: single flag.** Single boolean in `chrome.storage.local.settings.sidebarRebuild`. Matches SR-7 "flip flag default, delete legacy" model. Per-zone sub-flags would multiply branching without meaningful incremental rollback value.
4. **SR-6 sequencing.** **Decided: by dependency.** Foundation (flag plumbing, renderKey completion, timer sweep, slot-owner split, freshness records, R-7.3 revocation) → per-zone PRs → cleanup. Reflected in backlog ordering below.

### 4.3 Corpus gaps — rolled into SR-6.8

Per SR-4 spec §7 TODOs, ~19 corpus gaps across zones:
- Z0 (1): pipeline-dot tap event against S8/01.
- Z3 (3): 3.6-villain-postflop, 3.11-multiway-selector, 3.12-no-aggressor.
- Z4 (4): RT-61 auto-expand before/after, no-plan path, 4.2 one-block path, flag-off absence + flag-on no-audit.
- Zx (~12): X.1 mid-hand suppression + single-line merged text, X.3 grace negative path, X.4 implicit-clear + multi-message, X.5 tournament-end + mid-hand level transition, X.5b zone transition, X.5c final-level state, X.5d below-average state, X.5e critical urgency, X.5f far-from-bubble absent state, X.5g no-predictions, X.6 no-villain placeholder + app-disconnected mid-observer.

SR-6.8 is the harness corpus-extension PR; must ship early so later SR-6 PRs can regression-test against complete fixtures.

### 4.4 Code gaps named in SR-4 specs

- **X.4c re-enable timer** (`side-panel.js:172`). Picked up in C4 / SR-6.3.
- **`settings.debugDiagnostics` key.** Proposed in SR-4 Z0 §0.7 + Z4 §4.3; not yet implemented. Picked up in SR-6.1 (flag plumbing includes both settings keys).

---

## 5. Ordered SR-6 rebuild backlog (summary)

Full backlog entries authored in `.claude/BACKLOG.md`. Ordering below is by-dependency (foundation first, per-zone next, cleanup last). Each PR ships behind the `sidebarRebuild` flag.

| SR-6.# | Title | Size | Depends on | Gates |
|---|---|---|---|---|
| 6.1 | Foundation flag plumbing: `settings.sidebarRebuild` + `settings.debugDiagnostics` | S | — | R-5.1 |
| 6.2 | Harness corpus extension (~19 gaps) | M | 6.1 | R-8.3 |
| 6.3 | RT-60 sweep — 5 unregistered timers | S | 6.1 | R-2.5 |
| 6.4 | renderKey completion — 4 missing fields | S | 6.1 | R-5.4 |
| 6.5 | FSM authoring for recovery / seat-popover / deep-expander / between-hands / street-card | L | 6.1, 6.4 | R-2.1, R-2.2, R-2.3, R-2.4, R-3.2–3.4 |
| 6.6 | Freshness records + partial-payload retention (R-4.3 merge semantics) | M | 6.1 | R-4.1, R-4.2, R-4.3 |
| 6.7 | Revoke R-7.3 tolerance gate + "stale, recomputing" label | S | 6.5, 6.6 | R-7.1, R-7.3 |
| 6.8 | Explicit zone containers + per-zone fixed CSS heights | M | 6.1 | R-1.1, R-1.3, R-1.4 |
| 6.9 | `prefers-reduced-motion` + motion budget audit | S | 6.8 | R-6.1, R-6.2, R-6.3 |
| 6.10 | Z0 PR — 0.7 flag gate + 0.7 footer placement | S | 6.1, 6.8 | Z0 batch invariants |
| 6.11 | Z1 PR — 1.1 ring encoding + 1.11 selection ring + Rule V event contract | M | 6.5, 6.8 | Z1 batch invariants |
| 6.12 | Z2 PR — 2.3 equity move + 2.7/2.8 between-hands clear (B1, B2) | M | 6.5, 6.8 | Z2 batch invariants |
| 6.13 | Z3 PR — 3.11 multiway selector + 3.10 orphan removal + Rule V cross-zone | M | 6.5, 6.11 | Z3 batch invariants |
| 6.14 | Z4 PR — 4.2/4.3 collapsible split + debug-flag gate for 4.3 | M | 6.1, 6.8 | Z4 batch invariants |
| 6.15 | Zx PR — X.4c timer + X.5 placement verification + X.6/X.7 tier contract | S | 6.3, 6.5 | Zx batch invariants |
| 6.16 | Cleanup — remove `render-tiers.js` monolith; delete `deepExpanderOpen` legacy key; sweep orphan module state | M | 6.14 | R-5.1, R-5.2 |

**Total:** 16 SR-6 items. Foundation (6.1–6.9) is 9 items; per-zone (6.10–6.15) is 6 items; cleanup (6.16) is 1.

**Critical path length:** 6.1 → 6.5 → 6.12 (B1/B2 fix lands in item 12 of 16). If regressions S4/02-a/b become owner-urgent, they can be extracted as a hotfix outside the flag, but the principled path ships with 6.12.

---

## 6. Gate check

| Requirement | Status |
|---|---|
| Conformance per spec (§1) | ✅ 56 elements audited across Z0/Z1/Z2/Z3/Z4/Zx + 1 new (1.11) |
| Per-zone deltas graded blocking/behavioral/cosmetic | ✅ |
| Cross-cutting findings enumerated | ✅ 11 categories |
| Doctrine R-1.1 through R-7.5 swept | ✅ 27 rules with violations cited, 6 clean |
| Carried-input dispositions | ✅ E-2, E-3, X.4c, ~19 corpus gaps, 4 owner decisions resolved |
| Ordered SR-6 backlog authored | ✅ 16 items in `.claude/BACKLOG.md` |
| No code modified | ✅ audit-only |
| Owner approval | ⏳ pending |

Awaiting owner review.
