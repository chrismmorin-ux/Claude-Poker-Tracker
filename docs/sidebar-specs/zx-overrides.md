# Zx — Overrides / edge states (SR-4 batch 6 — final)

**Status:** DRAFT for owner review — 2026-04-13.
**Doctrine:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` v2.
**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Zx (rows X.1, X.3, X.4a–c, X.5, X.5b–g, X.6, X.7).
**Template:** `docs/sidebar-specs/README.md` (8-field spec).

Zx is the sidebar's **override / edge-state surface** — rows that mount only when the live-context pipeline is in a non-default state (app disconnected, no table, recovery needed, tournament mode, observer mode). Unlike Z0–Z4 which carve up the active-hand layout deterministically, Zx specs declare *who owns which slot when an override fires*. Every Zx spec MUST answer the zone-takeover question (R-3.2 / R-3.3 / R-3.4): preempt, coexist, or overlay.

**Omitted rows:**
- **X.2** — merged into X.1 per owner 2026-04-12 (Group 1H). X.1 is the single-line CTA.
- **X.5h** — deleted per owner 2026-04-12 (Group 5G); redundant with X.5 top-bar counts.

**Spec count:** 11 elements (X.1, X.3, X.4 composite, X.5, X.5b, X.5c, X.5d, X.5e, X.5f, X.5g, X.6, X.7). X.4a/b/c are authored as one composite spec (batch invariant 5).

---

# §A — App-sync + pipeline overrides

## Row X.1 — "Launch Poker Tracker →" CTA (absorbs X.2)

### 1. Inventory row
`#X.1 "Launch Poker Tracker →" link` — CTA to open the desktop app. **Absorbs X.2** ("Open app for exploit tips & live advice" subtitle) per owner 2026-04-12 Group 1H merge verdict. Final form is the single-line text "Launch Poker Tracker for exploit tips & live advice →" (owner 2026-04-12).

### 2. Doctrine citations
R-1.1 (fixed Zx slot, not a wandering banner), R-1.5 (glance pathway: between-hands users glance to the bottom of the sidebar to see the prompt), R-2.1 (FSM-owned mount/unmount — see §6), R-2.4 (`hand:new` interaction declared), R-3.1 (`ambient` tier — never preempts an active decision), R-3.4 (between-hands placement — does not render during active hands), R-5.1 (single owner of the app-launch slot).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, single-row "app launch prompt" slot positioned immediately below the street-card / between-hands content (DOM id `app-launch-prompt`). Full sidebar width, fixed height ~36 px (gold-link line + faint subtitle line). Slot does not move when X.1 mounts/unmounts; the rest of the panel does not reflow because Z4 sits below `app-launch-prompt` and the slot's collapse is a Zx-permitted slot-collapse (batch invariant 7).
- **Default summary** — single-line gold link text "Launch Poker Tracker →" centered, with the absorbed X.2 subtitle ("Open app for exploit tips & live advice") rendering as faint micro-text on a second line. Click anywhere on the link span opens the app. Per owner verdict, the merged single-line variant "Launch Poker Tracker for exploit tips & live advice →" is the canonical text; the two-line layout is the current implementation and is acceptable for SR-6 transition (see §8).
- **Drill-down affordance** — **Underlined text link** (per README vocabulary) — but rendered without underline by current visual treatment (gold weight is the affordance signal). Clicking opens a new browser tab via `chrome.tabs.create({ url: getAppUrl() })`. Not in-place expansion; navigates outside the sidebar.
- **Expansion location** — n/a (navigates to a separate tab).

### 4. Data contract
- **Source:**
  - Connection state: `appConnected` (boolean) — the same field used by 0.4 (App-state badge). When `appConnected === false`, X.1 mounts.
  - URL target: `getAppUrl()` (side-panel.js:49) — returns the configured Poker Tracker URL.
  - Between-hands gate: `classifyBetweenHandsMode()` returning a non-null mode (`REFLECTION`/`OBSERVING`/`WAITING`) OR `currentLiveContext.state` ∈ {`IDLE`, `COMPLETE`, null}. X.1 must not render mid-hand even when `appConnected === false` — see §6 mount FSM and batch invariant 1.
- **Compute:**
  - Pure boolean predicate `shouldShowAppLaunch = (!appConnected) && betweenHandsOrIdle`. No aggregation, no derivation.
  - The "App connected" alternative state (current `renderAppLaunchPrompt` path at side-panel.js:1228) — "App connected — analyzing opponents…" — is **not part of X.1**. That is a separate `ambient` confirmation rendered in the same slot when `appConnected === true`. Spec treats it as "X.1 absent, slot reused for the confirmation"; the slot's owner (renderAppLaunchPrompt) is single per R-5.1.
- **Invalid states:**
  - `appConnected === true` → X.1 does not render (slot may render the "App connected" confirmation instead, owned by the same renderer).
  - `appConnected === false` AND a live hand is in progress → X.1 does not render (R-3.4 + batch invariant 1; mid-hand mounts would compete with Z2 decision-critical content).
  - `appConnected === undefined` (boot race) → X.1 does not render until `appConnected` resolves to a defined boolean. No flicker on first paint.

### 5. Interruption tier
`ambient` (matches inventory). The CTA is a between-hands prompt; it never pulses, animates, or preempts anything. R-3.2 forbids promotion to `decision-critical` even if the user has been disconnected for a long time.

### 6. Render lifecycle
- **Mount condition:** `appConnected === false` AND `betweenHandsOrIdle === true`. Both predicates must hold. Concretely, the FSM observes `(appConnected, currentLiveContext.state, classifyBetweenHandsMode())` and mounts X.1 only on the transition into the conjunction. No render-coordinator short-circuiting (batch invariant 1).
- **Update triggers (renderKey fingerprint fields):**
  - `appConnected` (boolean flip).
  - `currentLiveContext.state` (transition into/out of `IDLE`/`COMPLETE`).
  - `betweenHandsMode` (the `REFLECTION`/`OBSERVING`/`WAITING`/null classification, already in the snapshot per render-coordinator).
- **Unmount condition:** any of — `appConnected` flips to `true`; `currentLiveContext.state` transitions into a live street (`PREFLOP`/`FLOP`/`TURN`/`RIVER`); `hand:new` event fires while the connection is still down (treated as "hand started" — X.1 unmounts and the active-hand layout takes over).
- **`hand:new` behavior (R-2.4):** `hand:new` unmounts X.1 unconditionally if it was mounted. The next between-hands moment re-evaluates the predicate; if `appConnected` is still false, X.1 re-mounts. There is no "remember I dismissed this" — X.1 has no dismiss affordance, and re-mounting on the next between-hands gap is the correct ambient behavior.

### 7. Corpus coverage
- Default mounted (between-hands, app disconnected): **S4/02** (between-hands frame with app disconnected variant).
- App connected confirmation in same slot: **S1/01** (default healthy frame — confirms slot reuse).
- Mid-hand suppression (app disconnected during live hand): **TODO corpus extension** — current corpus does not exercise the explicit "X.1 must NOT render mid-hand even when disconnected" assertion. Flag for SR-6.
- Single-line merged text (post-merge canonical form): **TODO corpus extension** — current S4/02 still exercises the two-line layout. SR-6 implementation PR for the merge will need a fresh corpus frame.

### 8. Rejected alternatives
- **Persistent banner across hands** was rejected: violates R-3.4 (between-hands content stays between hands) and would compete with Z2/Z3 for vertical space mid-hand.
- **Two-line layout** (current implementation: gold link + faint subtitle on separate lines) is the in-flight form pending SR-6 migration to the single-line merged text. Inventory verdict is the single-line form; SR-6 ships the migration. Both forms occupy the same slot, so the slot-owner contract is unaffected.
- **Dismissable variant** (X-button to silence the prompt for the session) was rejected: the prompt is the only signal that exploit tips are unavailable; silencing it would leave the user with no explanation for why Z2/Z4 are sparse.

---

## Row X.3 — "No active table detected" message

### 1. Inventory row
`#X.3 "No active table detected" + "Open a poker table on Ignition to start tracking" subtitle` — pipeline no-table state.

### 2. Doctrine citations
R-1.1, R-1.5, R-2.1 (5 s grace FSM), R-2.4 (cross-hand by definition — there is no hand), R-3.1 (`informational`), R-3.3 (full-zone takeover of Z1–Z4), R-5.1 (single owner of the no-table slot).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, replaces Z1–Z4 entirely. DOM id `no-table` mounts in place of `hud-content`. Full sidebar width, full height of the active-hand stack (vertical centering acceptable).
- **Default summary** — primary text "No active table detected" (medium weight) + subtitle "Open a poker table on Ignition to start tracking" (faint micro-text). Static, no data-driven content.
- **Drill-down affordance** — none (glance-only). The user's action is taken outside the sidebar (open a table in Ignition); no in-sidebar affordance is meaningful.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:**
  - Pipeline state: `lastPipeline.tables` (object). Empty → no-table candidate state.
  - Grace timer: `coordinator._timers.tableGrace` (5 s, registered per RT-60 contract — see side-panel.js:227). The timer arms when `tables` becomes empty AND a previous active table existed.
  - Hand history gate: `hasTableHands` (set false only after the grace expires and confirms no hands).
- **Compute:**
  - Pure boolean `shouldShowNoTable = !hasTableHands` (per renderAll at side-panel.js:1565).
  - The grace timer is the FSM that prevents flicker on transient pipeline blips.
- **Invalid states:**
  - `tables` empty for < 5 s (grace pending) → X.3 does NOT render. The previous Z1–Z4 layout stays (or shows stale-tinted content if applicable per Z2 invariant 8).
  - `lastPipeline === null` (boot before first pipeline status) → X.3 does NOT render (would mislead user into thinking pipeline is dead when it has not yet reported). Show the boot/connecting state in 0.9 instead.

### 5. Interruption tier
`informational` (matches inventory). X.3 takes over the entire active-hand layout, but it is not a decision-critical preempt because no decision is possible without a table — there is nothing to interrupt.

### 6. Render lifecycle
- **Mount condition:** `hasTableHands === false` after the 5 s grace expires (or at boot if no table ever existed).
- **Update triggers (renderKey fingerprint fields):**
  - `hasTableHands` (boolean flip).
  - `lastPipeline.tables` size (transitions to/from empty).
- **Unmount condition:** `hasTableHands === true` (a table is detected and hands begin flowing).
- **`hand:new` behavior (R-2.4):** N/A — X.3 is the explicit "no hands at all" state. `hand:new` cannot fire while X.3 is mounted; the first `hand:new` after X.3 unmounts it via `hasTableHands` flipping true.

### 7. Corpus coverage
- Default no-table state: **S8/01** (no active table + pipeline health strip).
- Z0 chrome persistence during X.3: **S8/01** (Z0 still renders — see batch invariant 2).
- Grace-period transient (tables empty < 5 s, X.3 suppressed): **TODO corpus extension** — current corpus does not exercise the grace timer's negative path. Flag for SR-6.

### 8. Rejected alternatives
- **No grace timer** (immediate X.3 mount on empty `tables`) was rejected: pipeline status messages can briefly report empty `tables` during a tab reload or table switch; immediate mount caused HUD flicker per RT-60 root cause analysis. The 5 s grace is the minimum that absorbs observed transients.
- **Hiding Z0 chrome during X.3** was rejected: the user needs the pipeline-health strip (0.9) and pipeline dot (0.1) to diagnose *why* no table is detected. Z0 must persist (batch invariant 2).

---

## Row X.4 — Recovery banner (composite: X.4a triangle + X.4b message + X.4c button)

### 1. Inventory row
`#X.4a` (warning triangle + red-tinted container) + `#X.4b` (message text) + `#X.4c` ("Reload Ignition Page" button). Authored as **one composite spec** per batch invariant 5 — the three sub-rows never render independently; they compose a single visual unit (triangle + message + CTA in a tinted container).

### 2. Doctrine citations
R-1.1 (fixed banner slot), R-1.5 (glance pathway: high-contrast tinted container is the glance signal), R-2.1 (FSM: armed by `push_recovery_needed`, cleared by `push_recovery_cleared` or successful `push_pipeline_diagnostics`), R-2.5 (no internal timers — strictly message-driven), R-3.1 (`ambient` per inventory, but see batch invariant 4 for the elevated-attention treatment), R-3.3 (overlay, not replacement), R-5.1 (single owner: `recoveryMessage` coordinator key).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, banner slot positioned at the top of the sidebar's main scroll area, above Z1–Z4 but below Z0 chrome. DOM id `recovery-banner`. Full sidebar width, fixed height ~64 px (triangle + 2-line message + button row). Banner is an **overlay**, not a replacement — Z1–Z4 continue to render below it.
- **Default summary** — composite:
  - **X.4a:** Warning triangle glyph at left (~16 px), red-tinted container background (full banner width).
  - **X.4b:** Message text right of the triangle, default copy "Connection issue detected. Reload the Ignition page to start capturing." (overridable via `recoveryMessage` payload).
  - **X.4c:** "Reload Ignition Page" button right-aligned, full-width on narrow viewports.
- **Drill-down affordance** — **Tap target** for the X.4c button (≥ 40×40 px). Triangle and message are non-interactive (pure ambient signal).
- **Expansion location** — in-place (banner does not expand; clicking the button triggers a side-effect `conn.send({ type: 'reload_ignition_tabs' })` and disables itself for 5 s).

### 4. Data contract
- **Source:**
  - Mount signal: `recoveryMessage` (coordinator key, set by `push_recovery_needed` or `push_silence_alert` with level `stale`/`dead`).
  - Clear signal: `push_recovery_cleared` (clears `recoveryMessage`); also auto-cleared by `push_pipeline_diagnostics` reporting `gameWsMessageCount > 0` (side-panel.js:96 — the "traffic resumed" implicit clear).
  - Button text: static "Reload Ignition Page" / "Reloading…" (5 s disabled state after click).
- **Compute:**
  - Pure boolean `shouldShowRecovery = (recoveryMessage != null)`.
  - Button click sends `{ type: 'reload_ignition_tabs' }` to the service worker; banner stays mounted until the clear signal arrives (does NOT optimistically unmount on click).
- **Invalid states:**
  - `recoveryMessage === ''` (empty string) — treat as falsy; do not render an empty banner. The default copy is applied at message-handler time (side-panel.js:102), so an empty string indicates a malformed push and should be suppressed.
  - Multiple sequential `push_recovery_needed` with different messages — latest message wins; banner re-renders text in place without a remount (no flicker).

### 5. Interruption tier
`ambient` (matches inventory). The banner uses high-contrast color and a CTA button, but it does NOT animate, pulse, or auto-scroll — per R-3.2, ambient signals can be visually loud but must not interrupt an active decision. Z1–Z4 remain interactive while the banner is up (batch invariant 4).

### 6. Render lifecycle
- **Mount condition:** `recoveryMessage` becomes non-null. Three message types arm it:
  1. `push_recovery_needed` (explicit recovery request from the capture pipeline).
  2. `push_silence_alert` with `level === 'stale'` or `'dead'` (sustained no-traffic).
  3. (No third type currently — silence alert with `level === 'warn'` does NOT mount the banner.)
- **Update triggers (renderKey fingerprint fields):**
  - `recoveryMessage` identity (null vs non-null + text content).
  - `recoveryButtonState` (idle / disabled-after-click / re-enabled). 5 s `setTimeout` re-enable in side-panel.js:172 should be migrated to `coordinator.registerTimer('recoveryButtonReEnable', ...)` under SR-6 to comply with RT-60 (current code is direct `setTimeout` — flag as gap, not blocking for spec).
- **Unmount condition:** `recoveryMessage` becomes null via `push_recovery_cleared`, OR `push_pipeline_diagnostics.gameWsMessageCount > 0` implicitly clears it (side-panel.js:96).
- **`hand:new` behavior (R-2.4):** `hand:new` does NOT clear the banner. Recovery is a pipeline-level concern orthogonal to hand boundaries; a recovery prompt that arrived mid-hand must persist into the next hand if the underlying pipeline issue is unresolved. Cross-hand persistence is correct here (analogous to tournament data per batch invariant 3).

### 7. Corpus coverage
- Banner mounted with default message: **S9/01** (recovery banner visible).
- Banner cleared via `push_recovery_cleared`: **S9/01** (the same scenario sequences mount → clear; replay-harness has explicit before/after frames per `replay-harness/dist/driver.js:648`).
- Implicit clear via traffic resumption: **TODO corpus extension** — `push_pipeline_diagnostics` auto-clear path is exercised in code but not in a dedicated S-frame. Flag for SR-6.
- Multi-message replacement (latest message wins): **TODO corpus extension**.

### 8. Rejected alternatives
- **Modal dialog overlay** was rejected: blocks Z1–Z4 interaction; recovery is "your data may be stale, here is a fix" — not "stop everything". Banner overlay preserves the live-context glance pathway.
- **Auto-reload without user click** was rejected: reloading the Ignition page mid-hand could lose seat state or interfere with active gameplay. The reload is always user-initiated.
- **Dismiss button on banner** was rejected: dismissing without resolving the underlying issue would leave the user unaware that data is degraded. The banner clears only when the pipeline reports recovery — that is the correct dismissal mechanism.

---

# §B — Tournament overlay

## Row X.5 — Tournament top bar

### 1. Inventory row
`#X.5 Tournament bar (compact top row: M value + zone pill + Lvl N/M + countdown)` — always-visible tournament context.

### 2. Doctrine citations
R-1.1, R-1.3 (no reflow when expanded — detail panel grows downward in place), R-1.5, R-2.1 (FSM: mount on `lastGoodTournament` non-null; toggle is user-driven), R-2.4 (cross-hand persistence — see batch invariant 3), R-3.1 (`informational`), R-3.2 (does not preempt Z2 decision-critical), R-5.1 (single owner of the tournament zone).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, positioned **inside the active-hand stack** (DOM id `tournament-bar`, between `plan-panel` and `street-progress` per `side-panel.html:1586`). NOT above Z0; NOT a new top-level zone. Per the gotcha "tournament bar placement" in the handoff: this spec **declares X.5 as a Zx-overlay-inside-Z2-region** that coexists with Z2/Z3 — it does not extend Z0 (which would expand Z0's chrome scope) and it does not preempt Z2 (which would violate R-3.2). Full sidebar width, fixed collapsed height ~28 px.
- **Default summary** — single-row layout: M value (e.g. `M 14`) + zone pill (`SAFE`/`CAUTION`/`PUSH`/`SHOVE` color-coded) + level marker (`Lvl 7/15`) + countdown (`02:34`). All four glance-readable in one strip.
- **Drill-down affordance** — **Tap target** on the entire bar (≥ 40 px height). Click toggles the X.5b–g detail panel (DOM id `tournament-detail`).
- **Expansion location** — in place; detail panel grows downward in the next slot (DOM id `tournament-detail`, immediately below the bar). Z2/Z3 below the detail panel reflow downward only when the detail panel is open — this is a **scoped exception to R-1.3**, justified because the user explicitly opened the panel and the reflow is contained to the tournament zone (analogous to Z4's collapsible reflow permission, batch invariant 7).

### 4. Data contract
- **Source:**
  - `lastGoodTournament` (coordinator key, set by `push_tournament` handler).
  - Toggle state: `tournamentDetailOpen` (coordinator key — new under SR-6, parallel to `planPanelOpen`).
- **Compute:**
  - M value, zone classification, level marker, countdown — all derived from `lastGoodTournament` fields by the existing tournament rendering path (render-coordinator.js:259+, harness/harness.js:273+).
  - Countdown ticks down every second via a coordinator-registered timer (`tournamentCountdown`, 1 Hz, RT-60 contract).
- **Invalid states:**
  - `lastGoodTournament == null` → X.5 (and all of X.5b–g) do NOT render. Cash-game mode is the implicit absence state.
  - Tournament data exists but countdown field is missing → render M + zone + level only; countdown slot blanks in place per R-1.3 (the bar's slot stays the same width; the countdown digits are replaced with `—:—`).

### 5. Interruption tier
`informational` (matches inventory). Tournament context is reference data, not a decision interrupt. The zone pill color (CAUTION/PUSH/SHOVE) communicates urgency at a glance but does not pulse or animate.

### 6. Render lifecycle
- **Mount condition:** first `push_tournament` arrives with non-null payload.
- **Update triggers (renderKey fingerprint fields):**
  - `lastGoodTournament` identity (replaced object).
  - `lastGoodTournament.currentLevelEndsAt` (countdown re-render driver — but countdown ticks via the 1 Hz timer, not renderKey, to avoid full re-render every second).
  - `tournamentDetailOpen` (toggle).
- **Unmount condition:** table switch to a cash table clears `lastGoodTournament` (render-coordinator.js:550 reset path). Tournament-end clears it via the same path.
- **`hand:new` behavior (R-2.4):** Tournament data **persists across `hand:new`** — this is the explicit cross-hand-persistence exception (batch invariant 3). The tournament is one continuous context spanning many hands; resetting on `hand:new` would defeat its purpose. `tournamentDetailOpen` ALSO persists across `hand:new` (the user opened the detail panel for the tournament context, not for this hand).

### 7. Corpus coverage
- Default mounted (tournament mode, bar visible): **S10/01**.
- Detail panel open (X.5 + X.5b–g visible): **S10/01** (same scenario exercises both states; harness covers expanded variant).
- Tournament-end transition (bar unmounts): **TODO corpus extension**.
- Mid-hand level transition (bar updates, hand continues): **TODO corpus extension**.

### 8. Rejected alternatives
- **Tournament bar above Z0** (new top-level zone) was rejected: would expand Z0's scope from "chrome + pipeline" to "chrome + pipeline + tournament context"; doctrine treats Z0 as the OS-level chrome, and tournament context is per-table, not per-app.
- **Tournament data resets on `hand:new`** was rejected: the tournament is the cross-hand context. Resetting per hand would force the user to re-derive M-ratio and ICM pressure every hand from raw stack/blind data — defeating the purpose of the bar.
- **Always-expanded (no toggle)** was rejected: the detail panel (X.5b–g) consumes ~120 px of vertical space; mid-hand users with active Z2 decisions need that real estate. Toggle-to-open is the correct default-collapsed posture.

---

## Row X.5b — M-Ratio gauge + zone label

### 1. Inventory row
`#X.5b Tournament detail panel — M-Ratio gauge + zone label ("Caution zone")`.

### 2. Doctrine citations
R-1.3 (fixed slot inside detail panel), R-1.5, R-3.1, R-5.1 (single owner: tournament detail renderer).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 1 of the X.5 detail panel. Full panel width, fixed height ~32 px (gauge bar + label).
- **Default summary** — horizontal gauge fills left-to-right colored by zone (`SAFE`/`CAUTION`/`PUSH`/`SHOVE`); label text "Caution zone" (or matching zone label) below the gauge.
- **Drill-down affordance** — none (glance-only — drill-down is X.5 toggle that opens this row).
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** derived from X.5 — `lastGoodTournament.M` value mapped to a 0..1 gauge fill via established M-zone thresholds.
- **Compute:** zone classification is the same function used by X.5; X.5b uses the gauge form, X.5 uses the pill form.
- **Invalid states:** `M === null` → row blanks in place ("M unavailable" placeholder, R-4.2). Detail panel does NOT collapse on missing field (R-1.3 within the open panel — same rule as Z2 stable layout).

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** detail panel open (X.5 toggled).
- **Update triggers:** `lastGoodTournament.M` identity.
- **Unmount condition:** detail panel collapses, OR X.5 unmounts (tournament ends / table switch).
- **`hand:new` behavior:** persists with X.5 (cross-hand).

### 7. Corpus coverage
- Default visible: **S10/01**.
- M zone transition (e.g. SAFE → CAUTION): **TODO corpus extension**.

### 8. Rejected alternatives
- (None recorded; row is a straightforward zone visualization.)

---

## Row X.5c — Blinds row (current + next)

### 1. Inventory row
`#X.5c Tournament detail panel — Blinds row (50/100 ante 10 + Next: 100/200 ante 20)`.

### 2. Doctrine citations
R-1.3, R-1.5, R-3.1, R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 2 of X.5 detail panel. Full panel width, fixed height ~24 px (single line).
- **Default summary** — two segments separated by a divider: current `SB/BB ante A`, "Next:" prefix + next-level `SB/BB ante A`.
- **Drill-down affordance** — none.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** `lastGoodTournament.currentBlinds`, `lastGoodTournament.nextBlinds`.
- **Compute:** string formatting only.
- **Invalid states:** `nextBlinds == null` (final level) → render current only; "Next:" segment blanks in place (R-1.3 inside open panel) with placeholder "Next: —". Row does not collapse.

### 5. Interruption tier
`informational`.

### 6. Render lifecycle
- **Mount condition:** detail panel open.
- **Update triggers:** `currentBlinds`/`nextBlinds` identity.
- **Unmount condition:** detail panel collapses or X.5 unmounts.
- **`hand:new` behavior:** persists.

### 7. Corpus coverage
- Default: **S10/01**.
- Final-level no-next state: **TODO corpus extension**.

### 8. Rejected alternatives
- (None.)

---

## Row X.5d — Stack row (BB count + avg comparison)

### 1. Inventory row
`#X.5d Tournament detail panel — Stack row (2,400 (24 BB) · Avg: 3,500 (69%))` — **`decision-critical` tier per inventory**.

### 2. Doctrine citations
R-1.3, R-1.5, R-3.1, R-3.2 (`decision-critical` tier — see batch invariant 8 for the in-zone scope), R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 3 of X.5 detail panel. Full panel width, fixed height ~24 px.
- **Default summary** — `<heroStack> (<bbCount> BB)` + `· Avg: <avgStack> (<heroPct>%)`. Comma-separated chip counts + BB-relative + percent-of-avg.
- **Drill-down affordance** — none.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** `lastGoodTournament.heroStack`, `lastGoodTournament.bigBlind`, `lastGoodTournament.avgStack`.
- **Compute:** `bbCount = floor(heroStack / bigBlind)`, `heroPct = round(100 * heroStack / avgStack)`.
- **Invalid states:** `avgStack == null` → render hero side only; "Avg:" segment placeholder. Row does not collapse.

### 5. Interruption tier
`decision-critical` (matches inventory). Per batch invariant 8: the `decision-critical` tier here applies **within the tournament zone when the detail panel is open** — X.5d takes glance priority over X.5b/c/g among the panel's rows, but does NOT preempt Z2's action headline (which owns `decision-critical` for active hands). When the detail panel is closed, `decision-critical` does not apply (the row is not rendered).

### 6. Render lifecycle
- **Mount condition:** detail panel open.
- **Update triggers:** `heroStack`, `avgStack`, `bigBlind` identity.
- **Unmount condition:** detail panel collapses or X.5 unmounts.
- **`hand:new` behavior:** persists; values update as new tournament data arrives.

### 7. Corpus coverage
- Default: **S10/01**.
- Hero below average (visual "below" treatment): **TODO corpus extension**.

### 8. Rejected alternatives
- **Promoting X.5d to a Z2 slot during deep-stack tournaments** was rejected: R-3.2 forbids cross-zone preemption; if stack pressure needs to drive Z2 advice, the correct path is to thread it into the existing Z2 reasoning (already done via SPR-zone in 2.4), not to relocate the row.

---

## Row X.5e — Blind-Out row (levels + minutes)

### 1. Inventory row
`#X.5e Tournament detail panel — Blind-Out row (8 levels / ~120 min)` — **`decision-critical` tier per inventory**.

### 2. Doctrine citations
R-1.3, R-1.5, R-3.1, R-3.2 (in-zone `decision-critical` per batch invariant 8), R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 4 of X.5 detail panel. Fixed height ~24 px.
- **Default summary** — `<N> levels / ~<M> min` — level count to blind-out + estimated minutes.
- **Drill-down affordance** — none.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** `lastGoodTournament.blindOutInfo` (`{ levels, minutes }`).
- **Compute:** string formatting.
- **Invalid states:** `blindOutInfo == null` → "Blind-out: —" placeholder. Row does not collapse.

### 5. Interruption tier
`decision-critical` (matches inventory; same in-zone scope as X.5d per batch invariant 8).

### 6. Render lifecycle
- **Mount condition:** detail panel open.
- **Update triggers:** `blindOutInfo` identity.
- **Unmount condition:** detail panel collapses or X.5 unmounts.
- **`hand:new` behavior:** persists.

### 7. Corpus coverage
- Default: **S10/01**.
- Critical urgency state (< 3 levels): **TODO corpus extension**.

### 8. Rejected alternatives
- (None.)

---

## Row X.5f — ICM row

### 1. Inventory row
`#X.5f Tournament detail panel — ICM row ("Approaching bubble (2 away)")` — **`decision-critical` tier per inventory**.

### 2. Doctrine citations
R-1.3, R-1.5, R-3.1, R-3.2 (in-zone `decision-critical` per batch invariant 8), R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 5 of X.5 detail panel. Fixed height ~24 px.
- **Default summary** — ICM context label, e.g. "Approaching bubble (2 away)" or "Final table" or "Money".
- **Drill-down affordance** — none.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** `lastGoodTournament.icmPressure` (label + state).
- **Compute:** label is server-derived; sidebar renders verbatim.
- **Invalid states:** `icmPressure == null` (deep-stack / far from money) → row **conditionally renders** per inventory ("Deep stack / far from bubble" hide condition). This is a permitted Zx slot-collapse within the open detail panel because ICM is a presence/absence-by-design field; the user does not expect it always present.

### 5. Interruption tier
`decision-critical` (matches inventory; in-zone scope per batch invariant 8).

### 6. Render lifecycle
- **Mount condition:** detail panel open AND `icmPressure != null`.
- **Update triggers:** `icmPressure` identity.
- **Unmount condition:** detail panel collapses, X.5 unmounts, OR `icmPressure` becomes null (deep stack again).
- **`hand:new` behavior:** persists.

### 7. Corpus coverage
- Default: **S10/01** (bubble approach scenario).
- Far-from-bubble (X.5f absent): **TODO corpus extension**.

### 8. Rejected alternatives
- (None — conditional render is owner-approved per inventory.)

---

## Row X.5g — Milestones

### 1. Inventory row
`#X.5g Tournament detail panel — Milestones ("Bubble ~45m")`.

### 2. Doctrine citations
R-1.3, R-1.5, R-3.1, R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, row 6 of X.5 detail panel. Fixed height ~24 px.
- **Default summary** — milestone label list, e.g. "Bubble ~45m · Final table ~3h".
- **Drill-down affordance** — none.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** `lastGoodTournament.predictions.milestones` (array of label strings).
- **Compute:** join with " · " separator.
- **Invalid states:** `predictions == null` OR `milestones` empty → row blanks in place ("Milestones: —"). Detail panel does not collapse (R-1.3 stable open layout).

### 5. Interruption tier
`informational` (matches inventory). Predictions are reference data, not decision drivers.

### 6. Render lifecycle
- **Mount condition:** detail panel open.
- **Update triggers:** `predictions.milestones` identity.
- **Unmount condition:** detail panel collapses or X.5 unmounts.
- **`hand:new` behavior:** persists.

### 7. Corpus coverage
- Default: **S10/01**.
- No-predictions state (X.5g placeholder): **TODO corpus extension**.

### 8. Rejected alternatives
- (None.)

---

# §C — Observer mode

## Row X.6 — Observer scouting panel

### 1. Inventory row
`#X.6 Observer scouting panel` — "SCOUTING — Seat N (style, hands)" panel shown when hero folded mid-hand and the live hand continues.

### 2. Doctrine citations
R-1.1 (fixed slot — uses the between-hands content slot), R-1.5, R-2.1 (FSM: mounted via `classifyBetweenHandsMode() === 'OBSERVING'`), R-2.4 (`hand:new` → re-evaluate mode), R-3.1 (`informational` per inventory), R-3.3 (legitimate `informational` takeover of the Z2 slot per batch invariant 6 — there is no active hero decision to preempt), R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, between-hands content slot (DOM id `between-hands`, mounts in place of Z2 decision content). Full sidebar width, fixed height variable by content (~120 px typical).
- **Default summary** — header "SCOUTING — Seat N (Style, Nh)" + up to 3 vulnerability lines + up to 2 street tendency lines + 1 showdown anchor line. Per render-orchestrator.js:872+.
- **Drill-down affordance** — none in the current implementation. Future: pill-click on focus seat to cycle (deferred to SR-5+); spec records this as glance-only for now.
- **Expansion location** — n/a.

### 4. Data contract
- **Source:**
  - Mode signal: `classifyBetweenHandsMode(liveContext, heroSeat, lastGoodAdvice, modeAExpired) === 'OBSERVING'` (render-orchestrator.js:798). Predicate: hero has folded AND hand is still live (`state` ∈ {`PREFLOP`/`FLOP`/`TURN`/`RIVER`}).
  - Focus seat: `_selectScoutFocusSeat(liveContext, appSeatData, focusedVillainSeat)` — picks the active villain with app data, or the first active villain.
  - Per-seat content: `appSeatData[focusSeat].villainProfile` (vulnerabilities, street tendencies, showdown anchors).
- **Compute:** vulnerability sort by severity desc, take top 3; street tendencies take top 2.
- **Invalid states:**
  - No active villains remain (`activeSeatNumbers` minus hero is empty) → render "Observing hand…" placeholder (render-orchestrator.js:864).
  - `appSeatData` empty (app disconnected mid-hand) → render the same placeholder; no scouting content available.

### 5. Interruption tier
`informational` (matches inventory). Per batch invariant 6: Observer mode is the explicit case where Z2's `decision-critical` tier **does not apply** because there is no active hero decision; the slot's tier reverts to `informational` for the duration of the observer state. This is NOT a R-3.2 / R-3.3 violation — it is the absence of a `decision-critical` precondition.

### 6. Render lifecycle
- **Mount condition:** `classifyBetweenHandsMode === 'OBSERVING'` for the current snapshot.
- **Update triggers (renderKey fingerprint fields):**
  - `betweenHandsMode` (transition into/out of OBSERVING).
  - `focusedVillainSeat` (cycle target).
  - `appSeatData[focusSeat].villainProfile` identity.
  - `liveContext.activeSeatNumbers` (active set narrows as villains fold).
- **Unmount condition:** mode transitions away from OBSERVING (hand completes → WAITING; new hand starts → null/active-hand layout).
- **`hand:new` behavior (R-2.4):** `hand:new` re-evaluates `classifyBetweenHandsMode`. If hero is dealt in, the observer panel unmounts and Z2 re-mounts. If hero sits out the next hand (rare), observer state persists on the new hand. No internal state on X.6 to reset.

### 7. Corpus coverage
- Default mounted (hero folded, hand continues): **S11/02**.
- No-villain placeholder: **TODO corpus extension** — current corpus does not exercise the "all villains folded after hero, but hand technically still live" edge.
- App-disconnected mid-observer: **TODO corpus extension**.

### 8. Rejected alternatives
- **Hiding the sidebar entirely when hero folds** was rejected: observer time is high-value scouting time per the inventory rationale ("relevant precisely because hero has no action to plan"); the panel is the explicit replacement for the (now-irrelevant) decision content.
- **Promoting X.6 to `decision-critical`** was rejected: there is no decision being made; the scouting data is reference / pattern-recognition input for *future* hands. `informational` is the correct tier.

---

## Row X.7 — Observing badge on board

### 1. Inventory row
`#X.7 Observing badge on board` — "OBSERVING" pill next to grayed hero cards when hero has folded.

### 2. Doctrine citations
R-1.1, R-1.5, R-3.1, R-5.1.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Zx, overlay on Z1 board area (positioned next to hero hole-card slot 2.6, NOT replacing it — hero cards remain rendered but grayed). DOM is rendered inline in the seat/board markup at render-orchestrator.js:201 / 513 (`<span class="uh-observing">Observing</span>`).
- **Default summary** — small pill text "OBSERVING" or "Observing" with subdued color treatment, immediately adjacent to grayed-out hero hole cards.
- **Drill-down affordance** — none (glance-only).
- **Expansion location** — n/a.

### 4. Data contract
- **Source:** same OBSERVING mode signal as X.6 — `classifyBetweenHandsMode === 'OBSERVING'`.
- **Compute:** none; pill is a static label conditional on mode.
- **Invalid states:** mode != OBSERVING → pill not rendered; hero cards return to normal (non-grayed) treatment.

### 5. Interruption tier
`informational`. The pill is a passive ambient confirmation that the user's grayed cards are intentional, not a bug.

### 6. Render lifecycle
- **Mount condition:** mode === OBSERVING (paired with X.6 mount; same predicate).
- **Update triggers:** `betweenHandsMode`.
- **Unmount condition:** mode != OBSERVING.
- **`hand:new` behavior:** identical to X.6 — re-evaluates on `hand:new`.

### 7. Corpus coverage
- Default visible (paired with X.6): **S11/02**.

### 8. Rejected alternatives
- **Hiding hero cards entirely** was rejected: the user wants to see what they folded (hindsight value, especially when paired with the X.6 scouting context). Graying preserves the cards as reference; the pill explains the gray.

---

# Batch invariants (Zx-wide)

These bind every Zx element and answer the central Zx question: who owns which slot when an override fires. Stage 6 PR reviews check each as a gate.

1. **Between-hands vs active-hand FSM for X.1 (R-2.4 + R-3.4).** X.1 (the app-launch CTA) has a strict mount predicate: `(appConnected === false) AND (betweenHandsOrIdle === true)`. The `betweenHandsOrIdle` predicate is true when `currentLiveContext.state ∈ {IDLE, COMPLETE, null}` OR `classifyBetweenHandsMode()` returns a non-null mode. There is **no render-coordinator short-circuit** — the FSM owns the lifecycle; the renderer mirrors FSM state. Concretely: even if `appConnected` flips false mid-hand, X.1 must NOT mount until the live hand resolves. Mid-hand mounts would compete with Z2 for slot priority and violate R-3.4's "between-hands content stays between hands" rule.

2. **Z0 chrome persistence during X.3 (no-table) and X.4 (recovery).** When X.3 (no active table) takes over Z1–Z4, **Z0 chrome MUST persist**. The pipeline dot (0.1), hands-captured label (0.2), app-state badge (0.4), invariant badge (0.8), and pipeline-health strip (0.9) all continue rendering. The user needs Z0 to diagnose *why* there is no table. Same rule applies during X.4 recovery banner (banner is an overlay; Z0 stays). The only Zx state that suppresses Z0 is none — Z0 is always-on except during `display:none` on the entire side panel (which is outside Zx's purview).

3. **Tournament data cross-hand persistence (R-2.4 exception).** `lastGoodTournament` and `tournamentDetailOpen` both persist across `hand:new`. The tournament is the cross-hand context — a single "session" spanning many hands — and resetting it per hand would defeat its purpose (forcing M-ratio re-derivation every hand from raw data the user already has memorized). This is an explicit exception to the Z4 rule that user-toggle state resets on `hand:new`. The exception is justified because Z4 collapsibles are *per-hand drill-downs* (this hand's plan, this hand's alternatives) while X.5's detail panel is a *per-tournament drill-down* (this tournament's stack/blinds/ICM). Different scope → different reset rule.

4. **Recovery banner overlay semantics (R-3.3).** X.4 is an overlay, NOT a replacement. While the banner is mounted: Z1–Z4 continue to render and remain interactive; the banner sits above them in the DOM stack (top of `hud-content` scroll area). The banner uses high-contrast palette (red tint + warning triangle) to draw attention but does NOT animate, pulse, or auto-scroll — `ambient` tier per R-3.1. The user can read advice, click a seat, expand the plan panel, etc., while the banner is up. Only the X.4c reload button is an interactive element on the banner itself.

5. **X.4 composite-spec authoring (handoff invariant 5).** X.4a (triangle), X.4b (message text), X.4c (reload button) are authored as **one composite spec** rather than three linked specs. The three sub-rows never render independently — they compose a single visual unit (tinted container with triangle + message + button) whose lifecycle is driven by a single coordinator key (`recoveryMessage`). DOM ownership is a single renderer (`showRecoveryBanner` / `hideRecoveryBanner`, side-panel.js:156). Future spec amendments touch the X.4 composite as a unit; introducing a sub-row spec would require an R-11 amendment to this batch invariant.

6. **Observer mode tier release (R-3.1 + R-3.2 reading).** When `classifyBetweenHandsMode === 'OBSERVING'`, the Z2 slot's `decision-critical` tier (R-3.2) **does not apply** because there is no active hero decision in progress — hero has folded; the live hand continues with the remaining villains; hero has nothing to plan. The slot's tier reverts to `informational` for the duration of the observer state, and X.6 (scouting panel) is a legitimate `informational` takeover of the Z2 slot. This is **not** a R-3.2 / R-3.3 violation — there is no `decision-critical` precondition to violate. When the next hand starts and hero is dealt in, the precondition returns and Z2 re-mounts with its normal `decision-critical` content. X.7 (observing pill) is paired with X.6 by the same predicate.

7. **Tournament bar placement: Zx-overlay-inside-active-hand-stack, NOT a Z0 extension.** The tournament bar (X.5) and its detail panel (X.5b–g) live **inside the `hud-content` scroll area**, between `plan-panel` (Z3 boundary) and `street-progress` (Z3 strip). This places them in the active-hand stack, not above Z0. Doctrine consequence: Z0's scope remains "chrome + pipeline status" and is NOT extended to "chrome + pipeline status + tournament context". The tournament bar is a Zx zone that coexists with Z2/Z3 — it does not preempt the Z2 decision content (R-3.2 honored) and it does not push Z0 down (Z0's slot is unaffected). When the X.5 detail panel is open, Z2/Z3 below it reflow downward — this is a scoped exception to R-1.3, justified because the user explicitly opened the panel and the reflow is contained to the tournament zone (analogous to Z4 batch invariant 7).

8. **`decision-critical` tier scope for X.5d/e/f (handoff invariant 8).** Three tournament rows carry `decision-critical` tier per inventory (X.5d Stack, X.5e Blind-Out, X.5f ICM). R-3.2 reads "decision-critical is baseline during active hands, owned by Z2 action headline". Zx is off-path from Z2's headline, so the `decision-critical` tier on X.5d/e/f cannot mean "preempts Z2". The scope is **in-zone**: when the X.5 detail panel is open, X.5d/e/f take glance priority **within the panel** over X.5b/c/g (which are `informational`). They do NOT preempt Z2. When the detail panel is closed, the tier is moot (rows are not rendered). The visual treatment on X.5d/e/f when the panel is open may use a brighter accent color than X.5b/c/g to signal in-zone priority, but no animation/pulse. If a future audit determines that stack/blind-out/ICM pressure should drive an active-hand interrupt, the correct path is to **thread the data into Z2's existing reasoning** (already done for SPR-zone via 2.4), not to relocate the row out of Zx.

9. **Cross-zone contracts inherited from prior batches (no redeclaration).** Zx inherits, it does not redeclare:
   - **Stale-advice tint** (cross-zone contract from `z2-decision.md` batch invariant 8). No Zx row currently renders advice-derived content directly, so the contract has no Zx half. If a future Zx row surfaces advice-derived data (unlikely — observer notes are villainProfile-derived, not advice-derived), it inherits the contract via Z2's data source, renderKey field, and 1 Hz timer — never adds independent ones.
   - **Debug-flag contract** (`settings.debugDiagnostics` from `z0-chrome.md` 0.7 + `z4-deep-analysis.md` batch invariant 6). No Zx row is gated by this flag per current inventory.
   - **Timer registration** (RT-60). All Zx timers (X.3 5 s grace, X.4c 5 s re-enable, X.5 1 Hz countdown) MUST register via `coordinator.registerTimer(...)`. The existing X.4c re-enable uses a direct `setTimeout` (side-panel.js:172) and is flagged for SR-6 migration; not blocking for this spec.

10. **Slot-collapse permissions in Zx.** Zx differs from Z2/Z3 (which strictly forbid slot collapse per R-1.3) and Z4 (which permits within-zone collapse per Z4 batch invariant 7). Zx permissions:
    - **X.1 slot** (`app-launch-prompt`) — permitted to collapse to 0 px when X.1 unmounts (app connected and not in confirmation state). Slot is below the active-hand stack and above nothing user-visible; collapse does not corrupt spatial memory.
    - **X.3 takeover slot** — replaces Z1–Z4 entirely; Z1–Z4 collapse to 0 px while X.3 is mounted. This is permitted because X.3 is a full-zone takeover (R-3.3) and the user's spatial memory for Z1–Z4 explicitly does not apply when no table exists (the data has nothing to render).
    - **X.4 banner slot** — permitted to collapse to 0 px when banner unmounts; Z1–Z4 reflow upward to fill. Permitted because the banner is an overlay-style mount whose absence is the default state.
    - **X.5 tournament slot** — collapses to 0 px in cash mode (no `lastGoodTournament`); active-hand stack reflows. Permitted because cash and tournament are mutually exclusive contexts; the user's spatial memory for tournament rows is conditional on tournament mode.
    - **X.6/X.7 observer slot** — X.6 reuses the between-hands content slot (no independent collapse); X.7 is inline in the seat markup (collapses with mode transition). Both permitted because they are mode-conditional.

---

# Escalations

**None new from this batch.** The Zx specs fit within existing doctrine and prior-batch decisions. Specifically:

- **E-2 (Z1 Rule V seat-arc ring)** — not a Zx concern; pending owner decision is carried forward to SR-5.
- **E-3 (Z2 S4/02-a + S4/02-b regressions)** — SR-6 follow-up; Zx has no analogous between-hands persistence regressions to flag (X.1 is between-hands by design; X.5 tournament data cross-hand persistence is the explicit inverse case and is correct per batch invariant 3).
- **Z3 + Z4 corpus gaps from prior batches** — SR-6 harness additions; Zx unaffected.
- **New Zx corpus TODOs** — flagged across §7 of multiple specs (X.1 mid-hand suppression + single-line merged text, X.3 grace negative path, X.4 implicit-clear + multi-message, X.5 tournament-end + mid-hand level transition, X.5b zone transition, X.5c final-level state, X.5d below-average state, X.5e critical urgency, X.5f far-from-bubble absent state, X.5g no-predictions, X.6 no-villain placeholder + app-disconnected mid-observer). None block this batch; all feed SR-6 harness extension.
- **One non-blocking code gap noted** (X.4c re-enable timer): currently uses direct `setTimeout` instead of `coordinator.registerTimer` (RT-60 contract). Spec declares the correct contract; SR-6 migration ticket recommended (not opened from this batch).

No R-11 amendment is requested by this batch.

---

# Self-check (per README authoring order + handoff deliverables checklist)

- [x] One spec section per kept Zx row in inventory order (X.1, X.3, X.4 composite, X.5, X.5b–g, X.6, X.7).
- [x] Specs grouped per handoff: §A (X.1, X.3, X.4), §B (X.5 + X.5b–g), §C (X.6, X.7).
- [x] 8-field template used verbatim on every spec (§8 present on all eleven specs; "(None)" or "(None recorded)" used where no rejected alternative exists).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥ 1 doctrine rule cited in §2 on every spec.
- [x] ≥ 1 S-frame cited in §7 on every spec; corpus gaps flagged as TODO for SR-6.
- [x] Every spec declares §6 `hand:new` behavior (R-2.4) — including cross-hand persistence for X.5 family and "N/A — no hand context" for X.3.
- [x] Zone-takeover contract declared per Zx state — batch invariants 1, 2, 4, 6, 7 + per-spec §3 location field.
- [x] Between-hands FSM declared for X.1 — batch invariant 1 + X.1 §6.
- [x] Tournament overlay cohesion rule declared — batch invariants 3, 7, 8 + X.5 §3/§6.
- [x] Observer mode tier-release rule declared — batch invariant 6 + X.6 §5.
- [x] Recovery banner composite-spec decision documented — batch invariant 5 + X.4 §1.
- [x] X.1 absorption of X.2 declared in X.1 §1 and §8.
- [x] `decision-critical` tier audit for X.5d/e/f documented (in-zone scope, not cross-zone preempt) — batch invariant 8 + X.5d §5 / X.5e §5 / X.5f §5.
- [x] No spec re-opens an inventory verdict; no new R-11 escalation.
- [x] Owner review requested.
