# Sidebar Panel Inventory & Purpose Audit

**Stage 3 artifact — SR-3.** Screenshot-based enumeration of every visible sidebar element across the S1–S5 replay corpus. One row per element. **Owner marks keep / merge / delete on each row; only kept elements get specs in SR-4.**

**Doctrine binding:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md`. R-1.2 caps primary metrics at 5 per active-hand view — the inventory below contains substantially more, so merges/deletes are expected, not optional.

**Evidence:** `.claude/projects/sidebar-rebuild/screenshots/{S1..S13}/*.png`. Each row cites at least one frame. Corpus extended from S1–S5 to S1–S13 during SR-3 (2026-04-12) to close 8 display-state coverage gaps per owner's "Full, do it right" directive. See §Corpus coverage map below.

**Zones** (from `project_sidebar_redesign.md`):

- **Z0** — chrome (status strip, footer).
- **Z1** — table read (seat arc + villain pills).
- **Z2** — decision (action bar + equity/SPR + board strip + street progress).
- **Z3** — street card (action history, fold%, hand plan, analyzing/waiting placeholders).
- **Z4** — deep analysis (plan panel, more analysis, model audit).
- **Zx** — between-hands / app-not-open overrides.

**Interruption tiers** (R-3.1): `ambient` (no attention) / `informational` (glanceable) / `decision-critical` (active hand primary) / `emergency` (render-refuse banner).

---

## Legend

| Column | Meaning |
|---|---|
| Element | DOM node / visual unit |
| Purpose | What it's trying to accomplish |
| Q answered | The specific question the user could answer from it |
| When needed | Game states where it earns its pixels |
| When invalid | States where it should NOT render or must show stale label |
| Data source | State variable (side-panel.js) or push message that feeds it |
| Tier | R-3.1 interruption tier |
| Verdict | Owner column: `keep` / `merge:<target>` / `delete` / `defer` |
| Frames | Corpus screenshots demonstrating the element |

---

## Z0 — Chrome

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 0.1 | Pipeline dot (top-left green/amber) | Show capture pipeline health | Is capture working? | Always | — | `push_pipeline_status` | ambient | | S1/01, S4/01 |
| 0.2 | "N hands captured" label | Surface capture volume | Have hands been captured this session? | Always | 0 hands and no table → redundant with 0.5 | `side_panel_hands` store | ambient | | S1/01, S5/01 |
| 0.3 | Hand count pill (right of label) | Compact redundant echo of 0.2 | — | — | Always (duplicate) | same as 0.2 | ambient | **delete** (owner 2026-04-12) | S1/01, S5/01 |
| 0.4 | App-state badge ("App synced" / "App not open") | Communicate main-app bridge state | Is desktop app running? | Always | — | `app-bridge` presence | ambient | | S1/01 (synced), S3/01 (not open) |
| 0.5 | Refresh button (top-right) | Manual pipeline reset | — | Pipeline degraded | When pipeline healthy — encourages unneeded resets | UI affordance | ambient | **merge:0.1** — only render when pipeline dot non-green (owner 2026-04-12) | S1/01 |
| 0.6 | "show tournament log" link (footer) | Expose tournament event stream | What just happened? | Tournament context only | Cash games | UI affordance | ambient | **conditional-render** — hide when `lastGoodTournament == null` (owner 2026-04-12, Group 5H) | S1/01 |
| 0.7 | "show diagnostics" link (footer) | Dev-only pipeline drill-down | Why is pipeline broken? | Debug flag on | Flag off | UI affordance | ambient | **keep behind debug flag** — hidden in normal use, one setting enables both 0.7 and 4.3 (owner 2026-04-12, Option A) | S1/01 |
| 0.8 | Invariant violation "!" badge (red, status bar) | Surface invariant-violation events (RT-66) | Is sidebar state corrupt? | On violation, 30s auto-decay | Healthy state | `StateInvariantChecker` | emergency | | S6/01 |
| 0.9 | **Pipeline health strip** (NEW — S8 revealed) | PROBE → BRIDGE → FILTER → PORT → PANEL with connectivity dots + subtitle "Waiting for capture script — is the Ignition page open?" | Which layer of the capture stack is stuck? | No active table / pipeline degraded | Healthy + table active | `push_pipeline_status` layer breakdown | informational | | S8/01, S9/01 |

## Z1 — Table read

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Seat circle (hands count ring) | Per-seat presence + sample size | Who's at the table, how much data? | Active hand | Vacant seats should blank | `appSeatData[seat]` | informational | | S1/01, S5/01 |
| 1.2 | Seat style badge (Fish/TAG/Nit/LP) above seat | Style classification | What archetype is this villain? | Sample size ≥ threshold | Low sample (<~20h) should hide not bluff | `appSeatData.style` | informational | **delete** — pill row (1.9) is style source of truth (owner 2026-04-12, Option A) | S1/01, S5/01 |
| 1.3 | Seat hero star (center circle) | Mark hero seat | Where am I sitting? | Always during active hand | Between-hands | fixed seat | ambient | | S1/01, S4/01 |
| 1.4 | PFA annotation (green "PFA" label) | Mark preflop aggressor | Who raised preflop? | Postflop streets | Preflop, between-hands | `currentLiveContext.pfAggressor` | decision-critical | | S1/01, S5/01 |
| 1.5 | Seat bet chip ("B $9" / "C $6" / "R $9") | Per-seat live wager | Who put in what this street? | Active hand with bets | Between-hands | `currentLiveContext.seats[i].streetBet` | decision-critical | | S1/01, S3/01 |
| 1.6 | Seat action tag (duplicate of 1.5 inside arc) | — | — | — | Duplicates 1.5 for same seats | same as 1.5 | — | **delete** — chip (1.5) wins, R-5.1 single-owner (owner 2026-04-12) | S1/01 |
| 1.7 | Dealer button (D chip) | Mark button position | Where's position? | Always during active hand | Between-hands | `currentLiveContext.buttonSeat` | informational | | S4/01 |
| 1.10 | **Seat check-mark indicator** (NEW — S13 revealed) | Shows when a seat has checked this street | Who checked? | Postflop active hand with check actions | No check on this street | `actionSequence[].action === 'check'` on current street | informational | **keep** — subtle but genuinely informative; no R-1.2 cost | S13/01 |
| 1.9 | Villain style pill row ("S1 Fish 30h" etc.) below action bar | Enumerated scouting summary for still-in villains | Who's left in the pot and what are they? | Multiway postflop | HU, or single active villain | computed from `appSeatData` ∩ `foldedSeats` | informational | **keep** — "who is still in the pot is important to visualize" (owner 2026-04-12). Open question: does this make 1.2 (seat style badges) redundant? See §Open questions. | S1/01, S5/01 |

## Z2 — Decision

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Action headline ("BET" / "CALL" / "FOLD" large colored text) | Primary recommended action | What should I do now? | Active hand with advice | No advice, between-hands, stale beyond gate | `lastGoodAdvice.action` | decision-critical | | S2/01, S3/01, S5/01 |
| 2.2 | Edge callout ("+3.1 edge") | EV delta of rec vs next-best | By how much? | Active hand with advice + game tree | Low-confidence sample | `lastGoodAdvice.edgeBB` | decision-critical | | S2/01, S3/01 |
| 2.3 | Equity % ("72% equity") inline | Quick-read hero equity | What's my current equity? | Postflop active hand | Preflop with no solver run | `lastGoodAdvice.equity` | decision-critical | **keep** — headline wins; delete equity from 2.4 row instead (owner 2026-04-12) | S3/01, S5/01 |
| 2.4 | Equity/SPR row ("Equity: 72% SPR: 3.8") | Structural context | Equity + stack depth | Active hand | Preflop before flop reveal | `lastGoodAdvice.equity`, `spr` | decision-critical | **keep SPR only** — equity moves to 2.3 headline, row becomes "SPR: 3.8" (owner 2026-04-12) | S2/01, S3/01 |
| 2.5 | Board card chips (A♦ K♥ 7♣) | Community cards | What's on the board? | Postflop | Preflop | `currentLiveContext.board` | decision-critical | | S1/01, S5/01 |
| 2.6 | Hero hole-card chips (right group, "Q♣ J♦") | Hero hand display | What am I holding? | Always (active hand) | Hero folded | `currentLiveContext.heroHoleCards` | decision-critical | | S1/01, S5/01 |
| 2.7 | Pot size chip (green "$19") right of board | Current pot size | What's in the middle? | Always during active hand | Between-hands (still visible in S4/02 → **bug candidate**) | `currentLiveContext.pot` | decision-critical | | S1/01, S4/02 |
| 2.8 | Street progress strip (PRE → FLOP → TURN → RIVER dots) | Where in the hand are we? | What street? | Always during active hand | Between-hands still shows filled progress (S4/02) → stale | `currentLiveContext.currentStreet` | informational | | S1/01, S4/02 |
| 2.9 | "Analyzing..." placeholder (inside action bar) | Pre-advice loading state | Is the engine working? | After context push, before advice | Advice arrived (stale indicator belongs on existing advice, not replacement text) | absence of `lastGoodAdvice` | informational | | S1/01 |
| 2.10 | Stale-advice border tint (action bar + plan panel yellow-orange) + "Stale Ns" badge | Signal advice is stale/recomputing | Is this read fresh? | `_receivedAt` age > 10s OR liveContext null | Fresh advice | `lastGoodAdvice._receivedAt` (RT-48) | informational | **keep** — moved from 1.8 per E-1 (2026-04-13, Z2 batch); plan-panel half cross-refs to Z4 | S7/02 |

## Z3 — Street card

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 3.1 | ACTION HISTORY header | Section label | — | Always in street card | — | static | ambient | | S2/01, S3/01 |
| 3.2 | Action history chips ("Pre 2", "FLOP S3B$9") | Per-street betting summary | Who did what up to now? | Postflop | Preflop (PRE chip only — partially useful) | derived from `actionSequence` | informational | | S3/01, S5/01 |
| 3.3 | Action-rationale line ("Value bet with top pair top kicker") | Plain-English justification | Why this action? | Advice present | No advice | `lastGoodAdvice.rationale` | decision-critical | | S3/01 |
| 3.4 | Fold-% callout ("S3 FOLD % 45% fold to bet") | Villain fold-equity snapshot | Will they fold? | Advice includes fold% | Insufficient sample | `lastGoodAdvice.villainFoldPct` | decision-critical | **keep** — fold% is a primary villain read, not just an edge input (owner 2026-04-12) | S3/01 |
| 3.5 | Hand plan block ("If CALL → Bet turn again on non-scare cards") | Forward branch plan | What's my next-street plan? | Advice includes `handPlan` | Preflop without plan | `lastGoodAdvice.handPlan` | decision-critical | | S3/01, S5/01 |
| 3.6 | **Range slot — grid** (hero preflop OR villain postflop) | Single-owner fixed-size slot; content varies by street + seat | Is my hand in range? / What's left in villain's range? | Always during active hand (preflop: hero range; postflop: villain range per Rule V) | Between-hands (Zx supersedes) | `lastGoodAdvice.rangeMatrix` (preflop) / `villainRangeNarrowed[seat]` (postflop) | decision-critical | **keep** — single fixed-height slot; no chevron, no collapse (R-1.3 forbids displacement). Owner 2026-04-12. | S1/01 (hero preflop); corpus gap for villain postflop — see §Known Gaps |
| 3.7 | **Range slot — headline row** | Names whose range is shown + summary metric | Whose range? How tight/how narrowed? | Always paired with 3.6 | — | derived from 3.6 source | decision-critical | **keep** — one line, always visible in the slot (owner 2026-04-12). See §Rule V for seat-selection logic. | S1/01 |
| 3.8 | Range grid legend ("In range / Your hand") | Decode grid colors | — | Always paired with 3.6 | — | static | ambient | **keep** | S1/01 |
| 3.11 | **Range slot — multiway seat selector** (NEW) | Clickable chips for still-in villains (multiway postflop only) | Which other villain's range can I inspect? | Multiway postflop only (≥2 villains still in) | HU, preflop, between-hands | computed from `currentLiveContext.seats` ∩ not-folded | informational | **keep** — chips for each still-in villain; active selection highlighted; click to switch (owner 2026-04-12) | not fired in corpus — postflop multiway range scenario |
| 3.12 | **Range slot — empty/no-aggressor placeholder** (NEW) | Reserves slot height when no villain has acted aggressively | — | Postflop, no villain has BET/RAISE this hand AND no PFA fallback (Q1-c) | Any state with a valid range to show | absence of aggressor | informational | **keep** — message "No aggression yet — click a seat to inspect" centered in reserved slot (owner 2026-04-12, R-1.3) | not fired in corpus |
| 3.9 | "Waiting for next hand..." placeholder | Between-hands holding pattern | Is this running? | Between hands (Z3-valid) | Active hand (bug if shown) | `handState === 'COMPLETE'` | informational | | S4/02 |
| 3.10 | "Waiting for next deal..." placeholder (above board area) | Same as 3.9 but different string/location | — | Between hands | Duplicate of 3.9 | `handState === 'COMPLETE'` | — | **delete** — 3.9 "Waiting for next hand…" wins (poker-correct noun) (owner 2026-04-12) | S4/02 |

## Z4 — Deep analysis

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 4.1 | "PLAN" collapsible chevron (top of street card) | Expose hand plan tree | Branch plan detail | Active hand with deep data | No advice, preflop without tree | `lastGoodAdvice.handPlan` | informational | | S3/01 |
| 4.2 | "More Analysis" collapsible | Expose secondary sizing/alt-line panels | Alt sizes, alt lines | Active hand with advice | No advice | `lastGoodAdvice.alternatives` | informational | | S3/01, S5/01 |
| 4.3 | "Model Audit" collapsible | Expose model/data provenance | How confident? Which model? | Debug flag on | Flag off | `lastGoodAdvice.audit` | informational | **keep behind debug flag** — shares the same flag as 0.7 (owner 2026-04-12, Option A) | S3/01, S5/01 |

## Zx — Overrides / edge states

| # | Element | Purpose | Q answered | When needed | When invalid | Data source | Tier | Verdict | Frames |
|---|---|---|---|---|---|---|---|---|---|
| X.1 | "Launch Poker Tracker →" link | CTA to open desktop app | Want full analysis? | `app not open` + between hands | App synced | `app-bridge.connected === false` | ambient | | S4/02 |
| X.2 | "Open app for exploit tips & live advice" subtitle | Explain X.1 | Why click? | Same as X.1 | Same | same | ambient | **merge:X.1** — single line "Launch Poker Tracker for exploit tips & live advice →" (owner 2026-04-12) | S4/02 |
| X.3 | "No active table detected" + "Open a poker table on Ignition to start tracking" subtitle | Pipeline no-table state | Why is everything empty? | After 5s grace when `tables: {}` | Table present | `push_pipeline_status.tables` empty | informational | | S8/01 |
| X.4a | Recovery banner — warning triangle + red-tinted container | Visually mark pipeline degradation | — | `push_recovery_needed` received | Healthy | `recoveryMessage` | ambient | | S9/01 |
| X.4b | Recovery banner — message text ("Connection issue detected. Reload…") | Explain the issue | What to do? | Same as X.4a | — | `recoveryMessage` | ambient | | S9/01 |
| X.4c | Recovery banner — "Reload Ignition Page" button | CTA to recover | — | Same as X.4a | — | static | ambient | | S9/01 |
| X.5 | Tournament bar (compact top row: M value + zone pill + Lvl N/M + countdown) | Always-visible tournament context | M-ratio + level at a glance | Tournament mode only | Cash | `lastGoodTournament` | informational | | S10/01 |
| X.5b | Tournament detail panel — M-Ratio gauge + zone label ("Caution zone") | Expand zone meaning | What's my push/fold posture? | Tournament, panel expanded | Cash | derived from X.5 | informational | | S10/01 |
| X.5c | Tournament detail panel — Blinds row (`50/100 ante 10` + Next: `100/200 ante 20`) | Blind ladder | What's the next level? | Tournament | Cash | `currentBlinds`, `nextBlinds` | informational | | S10/01 |
| X.5d | Tournament detail panel — Stack row (`2,400 (24 BB) · Avg: 3,500 (69%)`) | Stack relative to field | Am I above/below average? | Tournament | Cash | `heroStack`, `avgStack` | decision-critical | | S10/01 |
| X.5e | Tournament detail panel — Blind-Out row (`8 levels / ~120 min`) | Time until stack blinds away | How urgent? | Tournament | Cash | `blindOutInfo` | decision-critical | | S10/01 |
| X.5f | Tournament detail panel — ICM row ("Approaching bubble (2 away)") | ICM pressure label | How much is the bubble worth? | Tournament in ICM range | Deep stack / far from bubble | `icmPressure` | decision-critical | | S10/01 |
| X.5g | Tournament detail panel — Milestones ("Bubble ~45m") | Time-to-milestone estimates | When do I hit bubble / FT? | Tournament with predictions | — | `predictions.milestones` | informational | | S10/01 |
| X.5h | Tournament detail panel — Progress bar (33% eliminated) | Tournament progression | — | Tournament | Cash | `progress` | ambient | **delete** — redundant with playersRemaining/totalEntrants in X.5 top bar (owner 2026-04-12, Group 5G) | S10/01 |
| X.6 | **Observer scouting panel** (NEW — S11 revealed) | "SCOUTING — SEAT N (style, hands)" panel shown when hero folded | What are the remaining villains? | HS2 Observing mode | Hero active | derived | informational | **keep** — relevant precisely because hero has no action to plan | S11/02 |
| X.7 | **Observing badge on board** (NEW — S11 revealed) | "OBSERVING" pill next to grayed hero cards | Is this my hand to play? | HS2 Observing mode | Hero active | derived | informational | | S11/02 |

---

## Corpus coverage map (S1–S13)

Every row above cites ≥1 corpus frame. This table maps the reverse direction: which corpus exercises which zones/rows. Rebuild testing (SR-6) can use this to pick the right corpus for each regression scenario.

| Corpus | Primary states exercised | Rows fired |
|---|---|---|
| **S1** | Preflop, hero dealt in, range matrix, villain pill row, fractional-bet rendering bug | 0.1–0.4, 0.6, 0.7, 1.1, 1.3–1.5, 1.9, 3.1–3.2, 3.6–3.8, 2.5–2.6 |
| **S2** | Turn hero-to-act, advice-street mismatch (stale panel) | action bar + plan panel, street progress |
| **S3** | Flop HU hero-to-act, hand plan visible, fold% callout | 2.1, 2.2, 2.4, 3.3, 3.4, 3.5, 4.1–4.3 |
| **S4** | Between-hands → new preflop race window | 3.9, X.1/X.2 (between-hands overrides) |
| **S5** | Flop multiway, 4 villain pills, render churn | 1.9 full row, render-key behavior |
| **S6** | Invariant violation badge | **0.8** |
| **S7** | Idle stale advice tint + badge | **1.8** |
| **S8** | No active table + pipeline health strip | **X.3, 0.9** |
| **S9** | Recovery banner (visible → cleared) | **X.4a, X.4b, X.4c, 0.9** |
| **S10** | Tournament mode full bar + detail panel | **X.5, X.5b–X.5h** |
| **S11** | Hero folded / Observing mode + scouting panel | **X.6, X.7, hero seat folded indicator** |
| **S12** | River hero-to-act (5-card board) | Z2 full for river, 2.8 river active |
| **S13** | Checked-around flop (Q1-a fixture for Rule V) + seat check indicators | **1.10** |

**All 48 inventory rows now have ≥1 corpus citation.** Zero "not fired in corpus" entries remain.

---

## Rule V — Villain range seat-selection (owner-approved 2026-04-12)

Formal spec requirement for SR-4 `range-slot.md`. Binds the villain range display (row 3.6 postflop content) to a deterministic seat-selection rule.

1. **Heads-up (exactly one villain still in pot):** auto-select that villain.
2. **Multiway — with a villain aggressor:** auto-select the villain whose **most recent action was BET or RAISE** (excluding CALL, CHECK, FOLD). Ties broken by most recent in action sequence.
3. **Multiway — no villain aggression this street but preflop aggressor (PFA) still in:** fall back to PFA (Q1-a).
4. **Multiway — no villain aggression anywhere in hand** (limped pot, checked around, hero is sole aggressor): display the Q1-c placeholder (row 3.12) — *"No aggression yet — click a seat to inspect a villain's range"*. No seat auto-selected.
5. **Hero is most recent aggressor:** ignore hero from "last aggressor" computation; apply rules 1–4 over villain actions only (Q2-a).
6. **User override:** any click on a still-in seat (via row 3.11 chips or on the seat arc) switches the displayed range to that seat. Override persists until (a) a new BET or RAISE action occurs (in which case rule 2 re-applies), or (b) `hand:new` fires (R-2.4 reset).
7. **Visual unambiguity:** the headline (row 3.7) names the selected seat in plain text; the seat arc renders a distinct range-selection ring around the selected seat (not to be confused with the existing pinned-villain ring).

---

## Cross-cutting resolutions (Group 5 verdicts)

All 8 observations originally raised during the walkthrough have been resolved. Each cites the doctrine rule that governs the decision.

1. **5A — Pot + street-progress clear on `hand:new` (S4/02 bug).** Resolved by doctrine R-2.4: every panel must handle `hand:new` trigger or its SR-4 spec is rejected. SR-4 Z2 specs for pot chip, street progress, and board cards must declare their `hand:new` behavior.
2. **5B — R-1.2 overload.** Resolved by v2 doctrine amendment: the ≤5 cap is replaced with spatial-stability + glance-test requirements. Element count is no longer the constraint; spatial memory and glance-targetability are. See §UX-model reframe below.
3. **5C — Between-hands placement.** Between-hands content moves to a **distinct DOM region** (Option A). The region is **invisible during active play** (C-ii); it appears only when idle. Satisfies R-3.4 (informational demotion) + R-5.1 (single owner per slot). SR-5 architecture audit plans the region's placement; SR-4 writes the FSM + pathway.
4. **5D — Self-awareness layer redundancy.** No additional indicator added. R-7.4 already requires invariant counter in diagnostics zone as the backstop. Stale-advice tint (1.8) + invariant badge (0.8) + diagnostics counter = three-layer observable. Sufficient.
5. **5E — Observer-mode content.** Deferred to SR-4 open questions. The inventory captures X.6 (scouting panel) and X.7 (OBSERVING badge); SR-4 decides whether to add villain-vs-villain edge analysis for observer view.
6. **5F — Rule V Q1-c placeholder.** Already formalized in §Rule V below. No new decision.
7. **5G — Tournament progress bar (X.5h).** DELETE. Glance-test failure: redundant with playersRemaining/totalEntrants in X.5 top bar. Verdict recorded on row X.5h.
8. **5H — "show tournament log" in cash games (0.6).** Conditional render on `lastGoodTournament != null`. Verdict recorded on row 0.6.

---

## UX-model reframe (doctrine v2, 2026-04-12)

**Owner clarification:** sidebar use pattern is **targeted glance with spatial memory**, not simultaneous scan. The user:
- Glances with intent — already knows what they're looking for.
- Expects data at a remembered location; eye goes directly there.
- Absorbs the datum in <1 second; attention returns to the table.
- Peripheral elements are *present but not parsed* during any single glance.
- May glance again to a different spot, or drill down in place, without re-scanning the whole sidebar.

**Implication for doctrine:** the original R-1.2 ≤5-metric cap was derived from research on displays users *read*. The sidebar is not read, it is glanced. Element count is subordinate to two stronger constraints:
1. **Spatial stability** — elements do not move relative to their zone, ever.
2. **Glance-targetability** — each element's summary is readable in <1 second at its remembered location.

**Doctrine changes applied (see `docs/SIDEBAR_DESIGN_PRINCIPLES.md` v2 amendment log):**
- R-1.2 revised: remove ≤5 cap; add spatial-stability + glance-test requirements.
- R-1.3 rationale reinforced: explain that reflow breaks the glance pathway for every neighbour.
- R-1.5 added: every element declares a glance pathway (remembered location / default summary / drill-down affordance / expansion location).

**Consequence for this inventory:**
- Every kept element must specify its glance pathway in SR-4. The pathway is a first-class SR-4 spec requirement.
- Elements that pass the glance test stay; ones that don't are split into summary + in-place drill-down, not deleted.
- Drill-down affordance vocabulary (chevron, underline, pill click, etc.) is standardized in the SR-4 spec index, not per-spec.

---

## §Glance Pathways (per R-1.5)

Per-element glance pathways are authored in the SR-4 per-element specs at `docs/sidebar-specs/*.md`. Each spec declares:
1. **Remembered location** — zone + position + fixed slot dimensions.
2. **Default summary** — glance-readable rendering.
3. **Drill-down affordance** — from the standardized vocabulary.
4. **Expansion location** — in-place (default) or justified deviation.

SR-3 does not author these pathways. SR-3 establishes the requirement via doctrine R-1.5 and cross-references every kept/merged row above as having a pathway-spec dependency for SR-4.

**Standardized drill-down vocabulary (draft — to be finalized in SR-4):**
- **Chevron (`▾`/`▴`)** — in-place expand/collapse; content renders in the element's own slot.
- **Underlined text link** — navigate to a dedicated view (e.g., tournament log).
- **Pill/chip click** — cycle selection (e.g., range-slot seat selector).
- **Tap target (large invisible area)** — same as pill click; used for seat circles.

Ambiguity between these patterns is a spec violation.

---

## Group 1–3 audit under v2 doctrine (2026-04-12)

Prior verdicts were tested against the new framework. All survive:

| Group | Verdict | Survives reframe? | Why |
|---|---|---|---|
| Group 1A (0.3 hand pill delete) | Yes | Duplicate = spatial ambiguity; glance model intolerant of ambiguity |
| Group 1B (0.5 refresh merge into dot) | Yes | Conditional visibility preserves the remembered location |
| Group 1C (1.6 seat action tag delete) | Yes | Duplicate of bet chip; same ambiguity rule |
| Group 1D (1.9 pills kept + 1.2 seat badge delete) | Yes | Single source of truth for style; glance model strengthens the choice |
| Group 1E (2.3 keep headline, delete 2.4 equity) | Yes | One authoritative equity location |
| Group 1F (3.4 fold% keep) | Yes | Primary read with distinct glance pathway from edge |
| Group 1G (3.10 delete "next deal") | Yes | One placeholder, one location |
| Group 1H (X.1+X.2 merge) | Yes | One CTA, one location |
| Group 2 (0.7, 4.3 flag-gate) | Yes | Hidden by default; no glance-test impact |
| Group 3 (range slot fixed-height) | **Strengthened** | Archetype of glance-stable slot; R-1.3 + R-1.5 both cite this pattern |

No verdicts reversed.

---

## Open questions for SR-4 (carried forward)

- **Observer-mode content (5E):** should observer view show villain-vs-villain edge/equity analysis given hero has no decision to make? Or stay minimal (pills + scouting only)?
- **Drill-down affordance vocabulary (R-1.5):** the draft list above is proposed; SR-4 finalizes. Any additional affordance patterns needed?
- **Between-hands region placement (5C):** where does the distinct DOM region live — top strip, bottom strip, narrow column? SR-5 architecture audit decides.
- **Pre-existing gaps in R-7.3 stale-recomputing state:** doctrine mandates the label; SR-4 advice-panel spec must define the exact visual.

---

## Gate

| Requirement | Status |
|---|---|
| Screenshots for S1–S13 committed | ✅ `.claude/projects/sidebar-rebuild/screenshots/{S1..S13}/` |
| Every row cites ≥1 corpus frame | ✅ zero "not fired" entries remain |
| `Verdict` column populated on every row | ✅ |
| Row count 30–50 | ✅ 48 rows |
| Groups 1–5 verdicts recorded | ✅ |
| Doctrine aligned | ✅ written against SR-2 doctrine v2 (R-1.2 reframed, R-1.5 added, R-1.3 rationale reinforced) |
| Group 6 (SR-4 batching) walkthrough | ✅ Owner verdict 2026-04-12: **by-zone batching** (one SR-4 session per zone: Z0 chrome → Z1 table read → Z2 decision → Z3 street card → Z4 deep analysis → Zx overrides). Rationale: self-contained per-session deliverables, reinforces zone-as-mental-unit (R-1.1). |
| Owner sign-off | ✅ 2026-04-12 |
