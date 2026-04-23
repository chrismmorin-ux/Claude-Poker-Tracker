# Line Audit — 2026-04-22 — `btn-vs-bb-srp-ip-dry-q72r`

**Line:** `btn-vs-bb-srp-ip-dry-q72r` — BTN vs BB · SRP · Dry Q♠7♥2♣
**File:** `src/utils/postflopDrillContent/lines.js` lines 21–680
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough (setup / villain action / `correct` flag / frameworks / copy / bucket-teaching readiness / external validation). External-validation queries against GTO Wizard, Upswing, and PokerCoaching.
**Status:** Closed 2026-04-22 — LSW-F2 shipped all 6 findings same day (A1 live-pool BB-flat acknowledgment, A2 framework trim `capped_range_check` → `nut_advantage`, A3 pot-odds precision ~30% → ~27%, A4 "99 blocks 99" rewrite, A5 50% sizing preserved with rationale sentence, A6 terminal pots 16.0 → 22.7). POKER_THEORY.md §9.2 appended (live-pool BB-flat-range divergence).

---

## Executive summary

**Verdict: GREEN (light).** Every one of the 6 `correct` flag decisions is solver-aligned and externally confirmed. No P0/P1 blockers. The line is pedagogically clean: merged-sizing cbet on a dry Q-high, a brick-turn double-barrel, a correct turn-probe defense, and two thin-value + one bluff-catch river nodes that demonstrate sizing-by-range-shape. The `river_after_turn_checkback` CALL answer is **strongly** validated by GTO Wizard's "Calling Down Over-Bluffed Lines in Lower Limits" — population over-bluffs this exact capped-IP line, making the call not just break-even but +EV vs real opponents.

**Nine findings produced.** All P2/P3 — no shipping blocker. Main themes: (a) the authored BB flat-range premise ("3bets KK+/AA pre") is an **older live-pool convention** — modern solver has BB 3bet TT+/AJs+/AQo+. This is Category D if acknowledged, Category B if not. (b) One pot-odds math imprecision (27.3% stated as ~30%) — same failure mode class as A1's `river_checkback` P1, but lower severity here because the spot isn't threshold-sensitive. (c) Two copy nits ("99 blocks 99 itself"; "TPTK-ish" language does not appear here — this line is cleaner than A1 on that dimension). (d) One framework-citation stretch (`capped_range_check` on `flop_root` where BB's check isn't yet range-capping).

**Routing:** 1 POKER_THEORY.md §9.2 entry for the BB live-pool-flat-range divergence; 4 Stream F2 content-fix items (all small, bundleable into one commit if owner approves same-session ship); 0 Stream G engine tickets; 3 HIGH-leverage bucket-teaching targets (all river nodes — archetype flips cleanly on each).

---

## Scope

- **Nodes audited:** 14 total (6 decision + 8 terminal)
- **Decision nodes:** `flop_root`, `turn_brick`, `turn_checked_back`, `river_after_barrel`, `river_after_turn_checkback`, `river_after_flop_checkback`
- **Terminal nodes:** `terminal_thin_value_win` (×2 parents), `terminal_overbet_river` (×2 parents), `terminal_gave_up_value` (×2 parents), `terminal_bluff_catch_win`, `terminal_overfold`, `terminal_turn_spew`, `terminal_overfold_river`, `terminal_river_raise_spew`
- **Frameworks referenced by this line:** `range_advantage`, `range_morphology`, `board_tilt`, `capped_range_check`, `nut_advantage`
- **Heroes:** BTN open (hero A♠Q♣ pinned on flop_root; earlier-street nodes reuse the same combo implicitly) vs BB flat, effStack 100bb, SRP, dry Q-high rainbow board
- **Pot-type:** SRP. Preflop pot = 2.5 (BTN open) + 2.5 (BB call) + 0.5 (SB dead) = 5.5bb ✓ reconciles with `flop_root.pot = 5.5`.
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` / RT-108 drift test); UI rendering (companion surface audits cover v2 panel).

---

## Cross-node observations

- **Every `correct` flag is solver-aligned and externally validated.** This is a materially cleaner line than A1 (T96ss 3BP), which had three P1 content errors. Q72r is a more stable reference because the spot is structurally simple: clear range advantage, clear board-tilt, clear capped-checker dynamic, no "is the donk actually justified" premise wobble.
- **The authored villain flat range is live-pool, not solver-current.** `flop_root.why` says "BB flats without the overpairs (3bets KK+/AA pre)." Modern solver has BB 3bet QQ+/JJ/TT/AJs+/AQo+ at 100bb vs BTN open ([PokerCoaching 100bb HUNL charts](https://poker-coaching.s3.amazonaws.com/tools/preflop-charts/100bb-hunl-cash-game-charts.pdf); [Betting Data Lab](https://betting-data-lab.com/poker-3bet-range-strategy-for-cash-games-what-actually-works/)). The authored "KK+/AA" 3bet range is a historical/live-pool convention — it is defensible **if acknowledged as live-pool framing**, given the line's stated target ("the reference HU line — the most common single-raised-pot position matchup in **live cash**"). Without acknowledgment, a solver-educated student who reads the `why` section will correctly flag it as outdated. Route to Cat-D divergence with one-line acknowledgment in the `why` copy, and a POKER_THEORY.md §9.2 entry.
- **Sizings sit at the high end of defensible ranges in two places.** BB's turn probe at 60% pot (`turn_checked_back`) is large for a dry-brick turn-probe — solver mix is dominantly 25–40% on dry boards, with some 60%+ as a minority mixed size ([GTO Wizard — The Turn Probe Bet](https://blog.gtowizard.com/the-turn-probe-bet/)). Hero's thin-value bet at 50% on `river_after_flop_checkback` is larger than the canonical 33% for thin value against weak pairs (ref [Somuchpoker — Thin Value](https://somuchpoker.com/poker-term/mastering-thin-value-bets-poker-expert-guide)). Both are within acceptable range — not wrong — but the line misses a chance to *teach the canonical sizing* at those two spots.
- **Two terminal nodes are reached from two different decision paths.** `terminal_thin_value_win` is reached from `river_after_barrel → 33%` AND `river_after_flop_checkback → 50%`. `terminal_overbet_river` is reached from `river_after_barrel → 75%` AND `river_after_flop_checkback → overbet 125%`. `terminal_gave_up_value` is reached from `river_after_barrel → check back` AND `river_after_flop_checkback → check back`. Unlike the A1 finding (`terminal_flop_overfold` reused for a *correct* path and a *wrong* path), the Q72r terminals reuse is *semantically consistent* — all parent paths teach the same lesson (thin-value hits / oversizing fails / passivity forfeits). Pot values diverge slightly between parents but the copy is path-agnostic. **No finding required** — this is deliberately shared pedagogy. Flag for LSW-B2 widening: if bucket-teaching is added to the parents, the terminal sub-copy may need to diverge.
- **Archetype responsiveness is HIGH on 3 river nodes.** `river_after_barrel` (fish: widen thin-value sizing to keep stations in; nit: check back), `river_after_turn_checkback` (fish: fold; reg/pro: call — the canonical polar-bluff-catch archetype flip), `river_after_flop_checkback` (fish: bet 50%; regs: bet 33%). This makes Q72r the **second highest bucket-teaching leverage line** in the roster after T96 3BP.
- **No pot-accounting cascades.** Unlike A1 (`river_brick_v_checkraises` 108/71.4/90/200 drift), Q72r pot values reconcile cleanly across every node.

---

## Node-by-node findings

### `flop_root` — flop · BB checks on Q♠7♥2♣

- **1. Setup:** ✓ Q72r = canonical dry high-card reference texture. BTN opens 2.5bb, BB flats 2.5bb → pot 5.5bb. A♠Q♣ as pinned hero combo is textbook TPTK-no-draw (rainbow board, no straight potential for AQ).
- **2. Villain action:** ✓ BB checks flop. Solver-consistent — BB's flat-call range vs BTN open checks close to 100% on dry high-card flops out of position ([GTO Wizard — Flop Heuristics IP C-Betting](https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/)).
- **3. `correct` flag:** Cbet 33% ✓ solver-canonical merged-range cbet on dry high-card where PFR has range advantage without strong nut dominance. Cbet 75% false ✓ — polarized sizing with a merged range folds out exactly the hands we beat. Check back false ✓ — forfeits EV against BB's wide whiff-and-weak-pair range.
- **4. Frameworks:** `range_advantage` ✓, `range_morphology` ✓, `board_tilt` ✓. `capped_range_check` is a **stretch** — BB's check on the flop is range-wide, not selective/capping. The framework is about exploiting *selectively capped* ranges (typically turn/river check lines). See L-flop_root-F2.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales per branch: ✓ specific (mentions "88-TT middle pair, low pocket pairs, KQ/QJ/QT weak TP that floats"). Solid poker language.
  - `why` section: contains the **outdated BB flat-range premise** — see L-flop_root-F1.
- **6. Bucket-teaching readiness:** PARTIAL. AQ on Q72r is TPTK and wants to cbet 33% in every archetype — no clean flip. A more interesting bucket teach would be a marginal TP hand (QT, QJ) or a middle pocket pair (TT, 99) where the cbet/check decision shifts. Flag as candidate for **widening with a different hero combo** in LSW-B2 rather than authoring archetype-split on AQ.
- **7. External validation:** 3 queries issued. 1 A, 1 D, 1 B.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "33% cbet is correct on Q72r with merged range" | GTO Wizard merged range c-bet 33% dry high-card solver | [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/); [Upswing — Bet Sizing Strategy 8 Rules](https://upswingpoker.com/bet-size-strategy-tips-rules/) | "You should bet 33% when you have a range advantage but not a significant nut advantage"; on dry boards "we have no incentive to bet big because of the low value of fold equity"; solver strategy on dry ace/K/Q-high = 70%+ bet frequency dominated by 33% | **A** |
| 2 | "BB 3bets KK+/AA pre and flats everything else" | BB flat range 100bb cash BB 3bet JJ QQ KK AA | [PokerCoaching 100bb HUNL Charts](https://poker-coaching.s3.amazonaws.com/tools/preflop-charts/100bb-hunl-cash-game-charts.pdf); [Betting Data Lab — 3bet Range Strategy](https://betting-data-lab.com/poker-3bet-range-strategy-for-cash-games-what-actually-works/) | Modern solver: BB 3bets TT+/AJs+/AQo+ with polarization (premium pairs + blocker-bluffs); QQ 3bets 98% across positions. Authored "3bets KK+/AA" is an **older live-pool convention**, not solver-current. | **D** (intentional live-pool divergence — acceptable with acknowledgment; currently unacknowledged) |
| 3 | "BTN has range advantage AND nut advantage on Q72r" | range advantage nut advantage BTN vs BB Q-high dry SRP | [Upswing — Bet Size Strategy](https://upswingpoker.com/bet-size-strategy-tips-rules/) (combinatorial reasoning) | Range advantage: YES, BTN has more Qx combos (AQ, KQ, QJs, QTs, QQ), more overpairs (AA, KK, JJ-88 vs BB's JJ-88 if QQ+ 3bet), more suited connector reach. Nut advantage: **weaker than claimed** — if BB's flat range includes QQ (live pool), both players have 3 QQ combos (tied on top sets); 77/22 sets tied; no two-pair combos for either; nut edge reduces to TPTK density (BTN slightly favored). Copy's phrasing "range AND nut advantage" overstates slightly. | **B** (minor precision — if the authored BB range is live-pool-flat-QQ, nut advantage is modest, not strong) |

#### Findings on `flop_root`

- **L-flop_root-F1 — "BB 3bets KK+/AA pre" premise is outdated vs solver; OK as live-pool framing but unacknowledged** (Dimension 5, Category D)
  - **Severity:** 2 (P2). Teaches a specific BB range composition that modern solver disagrees with. Student who cross-references against solver will flag this as wrong. But since the line explicitly targets live cash ("the reference HU line — the most common single-raised-pot position matchup in live cash"), the live-pool range assumption is defensible *if labeled*.
  - **Observation:** `lines.js:79–84` — `why.body` says "BB flats without the overpairs (3bets KK+/AA pre)." Modern solver (GTO Wizard 100bb HUNL charts, PokerCoaching) has BB 3bet TT+/AJs+/AQo+ with polarization (QQ+ always, JJ/TT majority, AK majority, blocker bluffs). Population data shows live BBs at 2/5–5/10 *do* flat QQ-TT more often than solver suggests — so the authored live-pool framing is true of the target pool, but the copy states it as generic fact rather than as an exploit-target profile.
  - **Recommended fix:** One-sentence acknowledgment in the `why` section, **not** a range rewrite. Proposed revision (last two sentences of the `why` block):
    > "…BB flats without the overpairs at the stakes this line targets (live cash flats QQ-TT much more often than solver, which 3bets QQ+/JJ/TT). Its nut region on this flop is ~2–5% (77, 22 sets, rare QQ if flatted) and its typical value hands cap at AQ/KQ top-pair-good. Range advantage clearly favors BTN; nut advantage is modest, not strong."
  - **Effort:** S — 2-sentence rewrite.
  - **Risk:** None — tightens the frame rather than changing the teaching.
  - **Proposed backlog item:** `LSW-F2-A1 — flop_root BB 3bet range live-pool acknowledgment`.

- **L-flop_root-F2 — `capped_range_check` framework citation is a stretch** (Dimension 4)
  - **Severity:** 1 (P3). Framework is loosely related, not on-point. Student who reads the framework will find it discusses capped range dynamics on turn/river after range-narrowing lines, not flop-wide checks.
  - **Observation:** `lines.js:65 frameworks: ['range_advantage', 'range_morphology', 'board_tilt', 'capped_range_check']`. At the flop with BB still on its full flat range, BB's check is not selectively capping anything — BB checks close to 100% of its flat range.
  - **Recommended fix:** Drop `capped_range_check` from `flop_root.frameworks`. Keep it on `turn_brick` where it actually applies (BB's flop call capped its range). Alternative: replace with `nut_advantage` framework (which IS relevant here and is cited on later nodes of this line).
  - **Effort:** S — single array edit.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F2-A2 — flop_root framework citation trim`.

---

### `turn_brick` — turn · BB checks on 3♦ (brick) after calling flop cbet

- **1. Setup:** ✓ pot 9.1 reconciles with flop 5.5 + BTN cbet 1.8 + BB call 1.8 = 9.1.
- **2. Villain action:** ✓ BB checks brick turn. Solver-consistent — once BB's flop call cap-narrows its range, check frequency on brick turns is high.
- **3. `correct` flag:** Bet 50% ✓ correct (merged-range continuation, value-gets and denies equity to floats). Check back false ✓ (gives up equity from BB's weak-pair float range). Overbet 150% false ✓ (wrong range-shape match — merged range prefers medium sizing).
- **4. Frameworks:** `range_advantage` ✓, `nut_advantage` ✓. Both apt.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales: ✓ solid. The overbet rationale is particularly well-written — "Hero's range on the turn is still merged — mostly top-pair and overpairs that do not want to get raised off" correctly identifies the range-shape mismatch.
  - `why` section: ✓ accurate description of BB's continuing range.
  - `adjust` section (vs station): ✓ clean — acknowledges the archetype shift without inverting the primary answer.
- **6. Bucket-teaching readiness:** PARTIAL. With AQ (TPTK) the bet-50% decision is stable across archetypes. The interesting archetype-dependent decision on this node is **sizing** — smaller vs station to keep weak pairs in, larger vs nit for protection. Flag for potential future sizing-teaching but not high-leverage bet/check binary.
- **7. External validation:** 1 query issued. 1 A.

#### 7a. External-validation log for `turn_brick`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "50% double-barrel on brick turn after flop cbet called on dry board is correct merged sizing" | solver BTN double barrel frequency brick turn Q-high SRP BB call 50% | [Upswing — Turn Barreling on Bricks](https://upswingpoker.com/c-bet-turn-barreling-bricks/); [PokerCoaching — Middle Pair Q8s BTN vs BB](https://pokercoaching.com/blog/middle-pair-poker-strategy-with-q8s-btn-vs-bb-in-a-100bb-cash-game/) | "On boards like 9-4-2r, T-6-2r, or A-Q-4r, a 50-70% sizing often performs better than a small probe because it punishes middling pairs and weak top pairs that can't afford to peel twice." Turn barrel range = top pair+ for value, stronger draws for bluffs on dry textures. | **A** |

#### Findings on `turn_brick`

- ✓ **No findings.** Node is clean.

---

### `turn_checked_back` — turn · BB leads 60% into hero's checked-flop range

- **1. Setup:** ✓ pot 5.5 preserved through flop check-back. BB leads turn = classic probe-bet spot.
- **2. Villain action:** Partial. BB probing turn 60% on brick dry 3♦ is **on the large end** of the solver mix. Solver probe-bet frequency on turn = 31% average across BTN vs BB spots, with dry-board sizing mostly 25–40% ([GTO Wizard — Probe Betting](https://blog.gtowizard.com/probe-betting/)). 60% is plausible as a minority mixed size or as a population-pool exploit sizing. Flag for live-pool acknowledgment (tied to L-flop_root-F1). Not a correctness issue for hero's response — hero's defense is the same at any sizing above 40% in this spot.
- **3. `correct` flag:** Call ✓. Fold false ✓. Raise false ✓.
- **4. Frameworks:** `capped_range_check` ✓ (hero's checked-flop range IS capped here — framework correctly applied). `board_tilt` ✓.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales per branch: ✓ solid. MDF claim ("defend ~63% of our range") computes correctly (5.5 / (5.5 + 3.3) = 62.5%).
  - **Pot-odds claim is imprecise** — see L-turn_checked_back-F1.
  - `mismatch` section: ✓ accurate — explains the range-opening when hero checks.
  - `why` section: ✓ clean.
- **6. Bucket-teaching readiness:** HIGH LEVERAGE. Classic archetype flip:
  - vs FISH / NIT: fold (fish rarely probe-bluff; nit over-folds suggest their probe range is value-heavy)
  - vs REG / PRO: call (wider probe-bluff frequency; population over-probes on checked flops)
- **7. External validation:** 2 queries issued. 1 A, 1 C-ish.

#### 7a. External-validation log for `turn_checked_back`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "BB probes turn 60% pot after IP checks back dry flop" | BB probe bet turn after IP check back flop frequency sizing solver 60% dry | [GTO Wizard — Probe Betting](https://blog.gtowizard.com/probe-betting/); [GTO Wizard — The Turn Probe Bet](https://blog.gtowizard.com/the-turn-probe-bet/) | "Turn probe bet frequency = 31% average" across BTN vs BB spots. Sizing: "small sizing (25-40% pot) is used for range bets on dry boards." On brick cards: "mixed sizes — small for marginal, large for value." 60% is high-end of the mix; not dominant. | **A** (call is correct at any probe sizing ≥ 25%); sizing framing could label as "BB's occasional larger probe" in the copy |
| 2 | "Pot odds of ~30% to call BB's 60%-pot bet" | pot odds 60% pot bet required equity standard formula | Standard formula `bet / (pot + bet + call)` | For 60% pot bet: 0.6P / (1.6P + 0.6P) = 0.6 / 2.2 = **27.3%**, not 30%. The "~30%" claim overstates by ~3 percentage points. Not threshold-sensitive here (the call is clearly +EV at either threshold because BB over-probes population-wide) but copy is less precise than it should be for a teaching tool. | **B** (minor math imprecision) |

#### Findings on `turn_checked_back`

- **L-turn_checked_back-F1 — Pot odds math imprecision** (Dimension 5, Cat B)
  - **Severity:** 1 (P3). Same failure class as A1's `river_checkback` P1, but materially lower severity here because the call is clearly +EV at either 27.3% or 30% (hero's pair + ace-high + BDFD hands all comfortably clear either threshold); the wrong number doesn't mis-teach the decision.
  - **Observation:** `lines.js:260-262` — `rationale: "Pot odds of ~30% require modest equity"` — correct number is 27.3% for a 60% pot bet.
  - **Recommended fix:** Change "~30%" to "~27%" in the Call rationale. Keep the "modest equity" framing — it's still the right takeaway. OR keep 30% as a rounded upper-bound acknowledgment ("roughly 30%, actually closer to 27%") to teach the rounding-conservative habit.
  - **Effort:** S — single-word edit.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F2-A3 — turn_checked_back pot-odds precision`.

---

### `river_after_barrel` — river · 8♠ brick · BB checks after calling two streets

- **1. Setup:** ✓ pot 18.1 reconciles with turn 9.1 + BTN bet 4.5 + BB call 4.5 = 18.1.
- **2. Villain action:** ✓ BB checks river after flat-flat line. Solver-consistent — BB's range is condensed to pair-heavy hands that prefer showdown.
- **3. `correct` flag:** Bet 33% thin value ✓ solver-canonical — against a condensed pair-heavy range, 33% is the thin-value sweet spot. Bet 75% false ✓ (sizing leak against condensed). Check back false ✓ (forfeits the thin value we've earned).
- **4. Frameworks:** `range_morphology` ✓, `nut_advantage` ✓.
- **5. Copy:** ✓ Clean. `why` section is particularly well-constructed — "Sizing matches the shape of villain's range, not the strength of your own hand. Condensed ranges get small bets. Polar ranges get big bets." This is the single best sentence in the line.
- **6. Bucket-teaching readiness:** HIGH LEVERAGE. Archetype flip:
  - vs FISH / STATION: widen thin value even further (smaller sizing, more combos); value-own them more aggressively
  - vs REG: 33% as authored
  - vs NIT / TIGHT REG: consider check back — their capped calling range is too condensed (only Qx calls) and we're rarely ahead
- **7. External validation:** 1 query issued. 1 A.

#### 7a. External-validation log for `river_after_barrel`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "33% thin value with TPTK against condensed capped pair-heavy range is canonical" | thin value river bet TPTK AQ versus capped condensed range after double barrel called | [Somuchpoker — Thin Value Masterclass](https://somuchpoker.com/poker-term/mastering-thin-value-bets-poker-expert-guide); [PokerListings — Top 5 Thin Value Spots](https://www.pokerlistings.com/strategy/top-5-thin-value-spots); [GTO Wizard — Are You Leaving Value on the River?](https://blog.gtowizard.com/are_you_leaving_value_on_the_river/) | "For thin value bets, keep your sizing small, usually around one-quarter to one-third of the pot." "The more condensed your range is versus a polarized villain's range, the smaller you want to bet, and the more polarized your range against villain's condensed range, the bigger you want to bet." Confirms 33% as canonical. | **A** |

#### Findings on `river_after_barrel`

- ✓ **No findings.** Node is clean.

---

### `river_after_turn_checkback` — river · BB polar 75% bet after hero checks back turn

- **1. Setup:** ✓ pot 9.1 preserved through turn check-back. Hero is bluff-catching here with 99 (re-reading the authored rationale confirms the implicit combo is 99, not the earlier A♠Q♣ — the line implicitly narrows hero's range on the check-back branch to medium pairs and other showdown-valuable non-nut hands).
- **2. Villain action:** ✓ BB polar 75% bet after hero's capped check-back turn. **Strongly solver-consistent** — BB's turn-probe-got-called line that now sees hero check-back-turn triggers polar river aggression at ~50% frequency ([GTO Wizard — Calling Down Over-Bluffed Lines](https://blog.gtowizard.com/calling-down-the-over-bluffed-lines-in-lower-limits/)).
- **3. `correct` flag:** Call ✓ **strongly correct** — solver says call, population over-bluffs this exact line making the call even more +EV. Fold false ✓. Raise false ✓.
- **4. Frameworks:** `range_morphology` ✓. Could add a bluff-catch framework if one exists.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales: ✓ solid on Fold and Raise branches. **Call rationale has a sloppy copy line** — see L-river_after_turn_checkback-F1.
  - `mismatch` section: ✓ accurate — correctly identifies the capped-IP-checked-turn signal.
  - `why` section: ✓ — "25-35% bluffs depending on opponent type" matches GTO Wizard's "population over-bluffs this line."
- **6. Bucket-teaching readiness:** HIGH LEVERAGE. The canonical polar-bluff-catch archetype flip:
  - vs FISH: fold (fish rarely polarize; the bet is almost always value)
  - vs REG: call (solver indifference + population over-bluff makes call +EV)
  - vs PRO / AGGRESSIVE REG: call (their polar ranges include honest bluffs)
  - vs NIT: fold (under-bluffer — the bet is almost always value)
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `river_after_turn_checkback`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "BB over-bluffs river after IP checks back turn; calling with medium pair is +EV" | BB river bet frequency after IP checks back turn SRP capped range polar bluff frequency 75% pot bet | [GTO Wizard — Building Better River Strategies](https://blog.gtowizard.com/building_better_river_strategies/) | "When UTG checks behind on the turn instead of betting 75% pot, BB shows much more aggressive river play—still roughly 50% betting frequency, but preferring larger bets including some overbets." | **A** |
| 2 | "Population over-bluffs this exact spot at low-mid stakes; 99 is a call" | medium pocket pair 99 bluff catch call polar river bet capped range BB lead dry board 100bb cash | [GTO Wizard — Calling Down Over-Bluffed Lines in Lower Limits](https://blog.gtowizard.com/calling-down-the-over-bluffed-lines-in-lower-limits/) | "When Villain has over-bluffed earlier streets, they arrive on the river with more bluffs than in theory, making it even easier to get out of line on the river." "If you find yourself on the river facing a bet with a bluff catcher…you should most likely close your eyes and call again. Yes, even with bottom pair!" Directly supports the authored CALL answer. | **A** |

#### Findings on `river_after_turn_checkback`

- **L-river_after_turn_checkback-F1 — "99 blocks 99 itself" sloppy copy** (Dimension 5)
  - **Severity:** 1 (P3). The phrase is nonsensical as written — hero holding 99 doesn't block 99 in any meaningful sense (it removes 3 combos of 99 from villain's range, but "blocks itself" is a conceptual error that will confuse any student who reads blocker theory carefully).
  - **Observation:** `lines.js:397–399` — Call rationale: *"Our medium pair blocks some of villain's slowplay region (QQ impossible here since we're on 99, but 99 blocks 99 itself)."* The "QQ impossible" parenthetical is also wrong as constructed — QQ is not impossible here just because hero has 99; QQ is rare/impossible because BB 3bets QQ pre in most frameworks, unrelated to hero's combo.
  - **Recommended fix:** Rewrite the blocker sentence. Suggested:
    > "Our 99 removes 3 slow-play combos from villain's range (can't hold 99), a modest un-blocker effect on the bluff side (99 doesn't block BB's A5s/A4s/suited-broadway bluff region). The decision rests on population bluff frequency, not on blockers here."
  - **Effort:** S — 2-sentence rewrite within existing rationale.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F2-A4 — river_after_turn_checkback blocker copy fix`.

---

### `river_after_flop_checkback` — river · BB checks after turn probe called + river check

- **1. Setup:** ✓ pot 12.1 reconciles with turn 5.5 + BB bet 3.3 + BTN call 3.3 = 12.1.
- **2. Villain action:** ✓ BB checks river after turn-probe-got-called. Consistent with the give-up frame — if BB had value, BB would bet for protection / thin value; the check signals weakness.
- **3. `correct` flag:** Bet 50% ✓ thin value against weak-pair-heavy give-up range. Check back false ✓ (forfeits value). Overbet 125% false ✓ (folds out the weak pairs we beat).
- **4. Frameworks:** `range_morphology` ✓.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales: ✓ solid — correctly identifies "weak pair will hero-call our modest sizing enough of the time."
  - `prose` + `why` sections: ✓ clean.
- **6. Bucket-teaching readiness:** PARTIAL. Thin-value bet is correct across most archetypes; a potential archetype split exists on **sizing** (33% vs fish to keep stations in, 50% vs reg as authored, check back vs nit whose give-up range is too tight). Flag as sizing-teaching candidate, not a clean bet/check binary flip.
- **7. External validation:** 1 query issued. 1 A (with mild sizing nit).

#### 7a. External-validation log for `river_after_flop_checkback`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "50% thin value vs weak-pair give-up range with TPTK is canonical" | BB probe turn called then checks river thin value sizing against give-up range TPTK exploitative | [GTO Wizard — Are You Leaving Value on the River?](https://blog.gtowizard.com/are_you_leaving_value_on_the_river/); [Somuchpoker — Thin Value Masterclass](https://somuchpoker.com/poker-term/mastering-thin-value-bets-poker-expert-guide) | "Top and lower pair hands use smaller bet sizes to pursue thin value when opponents don't raise enough." "For thin value bets, keep your sizing small, usually around one-quarter to one-third of the pot." Confirms the bet itself but hints that 33% would be closer to canonical than 50%. 50% is defensible because BB's give-up range is slightly wider than pure condensed (weaker/less-polarized than `river_after_barrel`'s post-double-barrel condensed range). | **A** (with sizing nuance — 50% is within acceptable range but 33% would be more canonical; flag as P3 if owner wants more alignment with thin-value canon) |

#### Findings on `river_after_flop_checkback`

- **L-river_after_flop_checkback-F1 — 50% sizing is at the upper end of thin-value canon; 33% would be more solver-aligned** (Dimension 5)
  - **Severity:** 1 (P3). Not wrong — 50% is defensible in this spot because BB's range is weaker but less-condensed than in `river_after_barrel`. But if the line is meant to *teach* thin-value sizing canon, 33% is the textbook answer.
  - **Observation:** `lines.js:463–471` — Bet 50% is the correct branch. Thin-value literature consistently recommends 25–33% sizing. 50% is an uncommon thin-value choice.
  - **Recommended fix (optional, defer to owner):** Two options. (a) Change 50% → 33% to match canon; update the rationale to reference `range_morphology` framework more explicitly ("weak-give-up range + our merged value hand = small bet"). (b) Keep 50% and add a sentence acknowledging the sizing-choice rationale ("We use 50% here rather than 33% because BB's probe-turn-then-check-river range is *weaker* than a double-barrel-called range — we can size up slightly and still get called by weak pairs."). (a) teaches canon; (b) teaches spot-specific reasoning. Either is fine.
  - **Effort:** S either way.
  - **Proposed backlog item:** `LSW-F2-A5 — river_after_flop_checkback sizing canon choice` (LOW priority, owner preference).

---

### Terminals — light walk

All 8 terminal nodes checked for pot-accounting consistency and copy-path reuse:

- **`terminal_thin_value_win`** — pot 18.1. Reached from `river_after_barrel → 33% thin value` (pot after hero's 6-bet thin call: 18.1 + 6 + 6 = 30.1, but terminal shows 18.1 i.e. preserved parent pot as "situation pot before the decision resolves" convention — this is consistent across all terminals in this line). ✓ clean.
- **`terminal_overbet_river`** — pot 18.1. Reached from `river_after_barrel → 75%` and `river_after_flop_checkback → 125% overbet`. Pot values from the two parents differ (18.1 vs 12.1) but the terminal preserves `river_after_barrel`'s pot. Mild ambiguity — same class as A1's `terminal_river_overbet_spew` finding. ✓ copy is path-agnostic so no correctness issue.
- **`terminal_gave_up_value`** — pot 18.1. Reached from 2 parents (`river_after_barrel → check back` and `river_after_flop_checkback → check back`). Pot differs (18.1 vs 12.1). ✓ copy is path-agnostic.
- **`terminal_bluff_catch_win`** — pot 16.0. Reached from `river_after_turn_checkback → call`. Math: turn-checkback pot 9.1 → 9.1 + 6.8 BB bet + 6.8 hero call = 22.7. Terminal shows 16.0 — **does not reconcile.** Minor P3 finding below.
- **`terminal_overfold`** — pot 5.5. Reached from `turn_checked_back → fold`. Pot after hero folds = 5.5 + BB's 3.3 win (the pot before BB's bet); the 5.5 represents pre-bet pot. Consistent with author convention. ✓
- **`terminal_turn_spew`** — pot 5.5. Same convention. ✓
- **`terminal_overfold_river`** — pot 9.1. Reached from `river_after_turn_checkback → fold`. ✓ preserves the pre-river-bet turn pot.
- **`terminal_river_raise_spew`** — pot 16.0. Reached from `river_after_turn_checkback → raise`. Same 16.0 value as `terminal_bluff_catch_win` (ends the same way with pot-post-call), shares the arithmetic question. Minor P3.

#### Findings on terminals

- **L-terminals-F1 — `terminal_bluff_catch_win` + `terminal_river_raise_spew` pot value 16.0 doesn't reconcile cleanly** (Dimension 1)
  - **Severity:** 1 (P3). Turn pot 9.1 + BB's 75% bet 6.825 + hero's 6.825 call = 22.75. Terminal shows 16.0. The terminal pot may be intended as "turn pot before river action" = 9.1, but 16.0 = 9.1 × ~1.76 doesn't correspond to any authored action.
  - **Observation:** `lines.js:583 terminal_bluff_catch_win.pot: 16.0`; `lines.js:666 terminal_river_raise_spew.pot: 16.0`.
  - **Hypothesis:** 16.0 may be a leftover from an earlier authoring round when pot sizes were different (e.g., an earlier turn-pot of 8 × 2 sizing), never updated when river node was finalized.
  - **Recommended fix:** Recompute. If terminal represents "pot at showdown after hero's call," correct value is 22.75 rounded to 22.7 or 22.8. If terminal represents "pot before river bet," it should be 9.1.
  - **Effort:** S — two numeric edits.
  - **Risk:** Low — changes a displayed number with no logic dependencies.
  - **Proposed backlog item:** `LSW-F2-A6 — terminal_bluff_catch_win + terminal_river_raise_spew pot values`.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-flop_root-F1 — BB 3bet range live-pool acknowledgment | 2 | S | P2 | D (with B-risk if unlabeled) |
| 2 | L-flop_root-F2 — `capped_range_check` framework drop | 1 | S | P3 | structural |
| 3 | L-turn_checked_back-F1 — pot-odds math ~30% → ~27% | 1 | S | P3 | B |
| 4 | L-river_after_turn_checkback-F1 — "99 blocks 99" copy rewrite | 1 | S | P3 | B |
| 5 | L-river_after_flop_checkback-F1 — 50% sizing canon choice | 1 | S | P3 | B (owner preference) |
| 6 | L-terminals-F1 — terminal_bluff_catch_win + terminal_river_raise_spew pot | 1 | S | P3 | structural |

**Zero P0/P1 findings.** No shipping blocker.

**All 6 findings are small, single-file, bundle-able into one commit.** Per A1 precedent, same-session LSW-F2 ship is recommended if owner approves.

---

## Bucket-teaching queue (flows into Stream B / C)

For the 6 decision nodes in this line:

| Node | Hero combo | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale / Leverage |
|------|------------|------------------------------|--------------------------------------|----------------------|
| `flop_root` | A♠Q♣ (TPTK, authored) | `topPairGood, overpair, middlePair, weakDraw, air` | cbet33%:{all:T} — **no clean flip** | PARTIAL. AQ wants to cbet in every archetype. Widening with a marginal combo (e.g., TT middle pair) would be higher-leverage. |
| `turn_brick` | A♠Q♣ | `topPairGood, overpair, middlePair, weakKicker, air` | bet50%:{all:T} — **no clean flip** | PARTIAL. Archetype flip would be on sizing, not bet/check. |
| `turn_checked_back` | e.g., K♠Q♦ (weak TP with showdown) | `topPair, middlePair, overpair, ace-high, air` | call:{fish:F,reg:T,pro:T}; fold:{fish:T,reg:F,pro:F} | **HIGH LEVERAGE.** Population over-probes after a checked flop; regs call, nits fold. |
| `river_after_barrel` | A♠Q♣ (TPTK) | `topPairGood, overpair, twoPair, set, ace-high` | bet33%:{fish:T,reg:T,pro:T}; sizing widens vs station (bet25%) vs condenses vs nit (check back) | **HIGH LEVERAGE.** Canonical thin-value-sizing archetype split. |
| `river_after_turn_checkback` | 9♣9♠ (medium pair) | `topPair, middlePair, underpair, ace-high, air` | call:{fish:F,reg:T,pro:T}; fold:{fish:T,reg:F,pro:F} | **HIGH LEVERAGE.** The canonical polar-bluff-catch archetype flip. Depends on L-river_after_turn_checkback-F1 copy fix first. |
| `river_after_flop_checkback` | A♠Q♣ (TPTK) | `topPair, overpair, twoPair, air` | bet50%:{all:T}; sizing flips 33% vs station / 50% vs reg / check-back vs nit | PARTIAL. Sizing flip, not bet/check binary. |

**Three HIGH-leverage targets** for LSW-B2 widening, all on river nodes. Order by student-value per session:

1. `river_after_turn_checkback` — canonical bluff-catch archetype flip. Most directly teachable.
2. `river_after_barrel` — thin-value sizing flip. High leverage.
3. `turn_checked_back` — call-vs-probe archetype flip. Moderately less leveraged than the two river nodes because turn decisions are less threshold-sensitive (the call is +EV across wider archetype range).

---

## Category-C engine findings (deferred pending solver access)

**None.** Unlike A1 (which surfaced `HERO_BUCKET_TYPICAL_EQUITY.topPair` wet-board over-estimate and `ARCHETYPE_BUCKET_MULTIPLIERS.fish` insufficiency), the Q72r line's engine reads map cleanly to solver-anchored numbers:

- AQ on Q72r with TPTK = `topPairGood` bucket = canonical high equity vs BB's flat-call range. No known engine value issue here.
- Fold-frequency calculations across all 6 decision nodes use population-plausible priors without any single prior being obviously miscalibrated.

Re-audit if solver access confirms Q72r-specific equity anomalies in the bucket-EV engine. **For this audit: 0 Stream G tickets.**

---

## Documented divergence (for POKER_THEORY.md §9)

- **D1 (new) — BB 3bet range assumption is live-pool, not solver-current.** `btn-vs-bb-srp-ip-dry-q72r` assumes BB 3bets KK+/AA pre and flats everything else. Modern solver has BB 3bet TT+/AJs+/AQo+ at 100bb vs BTN open. The line is intentionally live-pool-oriented (the ["reference HU line — the most common SRP matchup in **live cash**"](../../../../src/utils/postflopDrillContent/lines.js#L14-L19)). Once L-flop_root-F1 is fixed (one-line acknowledgment in the `why` section), this divergence is documented and acceptable.
- **Action:** append to POKER_THEORY.md §9 (existing section from A1 D1). Proposed entry §9.2: *"BB's flat-call range vs BTN open at 100bb in `btn-vs-bb-srp-ip-dry-q72r` assumes BB flats QQ-JJ-TT and 3bets only KK+/AA. This is a live-pool convention (live BBs at 2/5–5/10 flat QQ-TT more than solver suggests), not modern solver. Documented as intentional live-pool framing."*

---

## Accuracy verdict

**GREEN (light).** Zero P0/P1 findings. All 6 decision nodes have solver-correct primary answers. The line is ready for Stream B2 widening as-is; the 6 P2/P3 findings can bundle into LSW-F2 same-session or defer without blocking downstream work.

**Specifically:** `river_after_turn_checkback` has the **strongest external validation** of any decision node in the roster so far (GTO Wizard directly supports "call with any bluff-catcher" as the canonical answer). This node is the highest-priority LSW-B2 widening target in the library.

**Line is cleaner than A1.** Where A1 had 3 P1 blockers (reversed nut-advantage premise, pot-odds math error, pot-accounting cascade) and needed LSW-F1 to ship before B-stream widening, Q72r has no shipping blockers and can proceed to widening regardless of F2 timing.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** [owner pending]
- **Closed:** [pending — tied to LSW-F2 ship decision]

---

## Change log

- 2026-04-22 — Draft (external-validation methodology applied per 2026-04-22 project charter standard).

---

## Sources (web research citations)

- [GTO Wizard — The Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)
- [GTO Wizard — Flop Heuristics IP C-Betting in Cash Games](https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/)
- [GTO Wizard — Probe Betting](https://blog.gtowizard.com/probe-betting/)
- [GTO Wizard — The Turn Probe Bet](https://blog.gtowizard.com/the-turn-probe-bet/)
- [GTO Wizard — Building Better River Strategies](https://blog.gtowizard.com/building_better_river_strategies/)
- [GTO Wizard — Calling Down Over-Bluffed Lines in Lower Limits](https://blog.gtowizard.com/calling-down-the-over-bluffed-lines-in-lower-limits/)
- [GTO Wizard — Are You Leaving Value on the River?](https://blog.gtowizard.com/are_you_leaving_value_on_the_river/)
- [Upswing — Bet Sizing Strategy 8 Rules](https://upswingpoker.com/bet-size-strategy-tips-rules/)
- [Upswing — When Should You Continue Barreling on a Brick Turn Card?](https://upswingpoker.com/c-bet-turn-barreling-bricks/)
- [Somuchpoker — Thin Value Masterclass](https://somuchpoker.com/poker-term/mastering-thin-value-bets-poker-expert-guide)
- [PokerListings — Top 5 Thin Value Spots](https://www.pokerlistings.com/strategy/top-5-thin-value-spots)
- [PokerCoaching — Middle Pair Poker Strategy with Q8s](https://pokercoaching.com/blog/middle-pair-poker-strategy-with-q8s-btn-vs-bb-in-a-100bb-cash-game/)
- [PokerCoaching — 100bb HUNL Cash Game Charts](https://poker-coaching.s3.amazonaws.com/tools/preflop-charts/100bb-hunl-cash-game-charts.pdf)
- [Betting Data Lab — 3bet Range Strategy for Cash Games](https://betting-data-lab.com/poker-3bet-range-strategy-for-cash-games-what-actually-works/)
