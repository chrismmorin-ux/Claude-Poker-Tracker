# Line Audit — 2026-04-22 — `btn-vs-bb-3bp-ip-wet-t96`

**Line:** `btn-vs-bb-3bp-ip-wet-t96` — BTN vs BB · 3BP · Wet T♥9♥6♠ — villain donks
**File:** `src/utils/postflopDrillContent/lines.js` lines 670–1295
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard, Upswing, Run It Once, PokerListings, Wikipedia.
**Status:** Closed 2026-04-22 — all P1/P2 findings shipped in LSW-F1; 1 P3 finding (framework citation on `river_brick_v_calls`) deferred per audit's own recommendation. Draft audit had awaited owner review; closed same-day after Stream F fixes landed.

---

## Executive summary

**Verdict: YELLOW.** The line is pedagogically strong and covers the right lessons (capped-range bluff-catching, oversizing trap, thin-value discipline on condensed rivers), but has three category-B content errors the student will carry forward and two category-D divergences from solver truth that we haven't labeled. No category-A findings contradicted by web research were structural; however, the framing of "BB has nut advantage on T96ss" is the reverse of what GTO Wizard documents for non-broadway middling flops in 3BP — the line teaches a real live-pool exploit dressed up as theoretically-grounded play. One P1 pot-odds math error and one P1 pot-accounting inconsistency are load-bearing enough to block widening (Stream B) on this line until fixed. Bucket-teaching readiness is HIGH on 3 of 5 decision nodes — this is the richest archetype-sensitive line in the library.

**Routing:** 3 Stream F tickets (content fixes), 2 Stream G tickets (deferred pending solver access), 1 POKER_THEORY.md §9 entry (intentional divergence — live-pool donk framing).

---

## Scope

- **Nodes audited:** 12 total (5 decision + 7 terminal)
- **Decision nodes:** `flop_root`, `turn_after_call`, `river_brick_v_calls`, `river_checkback`, `river_brick_v_checkraises`
- **Frameworks referenced by this line:** `range_advantage`, `range_morphology`, `board_tilt`, `capped_range_check`, `nut_advantage`
- **Heroes:** BTN call vs BB 3bet, effStack 90bb, 3BP, middling wet two-tone board
- **Out of scope:** bucket-EV engine numerical output per RT-108 drift test (separate coverage); UI rendering.

---

## Cross-node observations (read first)

Themes that span multiple nodes:

- **The line premises a live-pool villain, not a solver villain.** Solver BB OOP in 3BP on T96ss without range/nut advantage largely checks the flop (GTO Wizard: "Navigating Range Disadvantage as the 3-Bettor"; "Crush 3-Bet Pots OOP"). The authored flop donk IS realistic as a live-pool tendency but is framed as if BB has a theoretical reason to donk ("BB has nut advantage"). **This is the single most important finding in the audit** — the premise of the entire line rests on a reversed claim. Options: (a) reframe the line as "live-pool donk spot" and document in POKER_THEORY.md §9 as intentional divergence, or (b) keep the line but correct the authored rationale so BB's donk is labeled as an exploitable over-aggression, not a principled play.
- **Pot accounting drifts at 3 of 12 nodes.** Pot values at `river_brick_v_checkraises`, `terminal_flop_raise_folds_weak`, and `terminal_river_overbet_spew` don't derive cleanly from their parent-node sizings. For a teaching tool that cites pot-odds math, drift in the very numbers the math relies on erodes trust.
- **Terminal reuse creates copy mismatches.** `terminal_flop_overfold` is the target of both `flop_root → Fold` AND `river_checkback → Fold`. The copy addresses only the flop-fold mistake. A student who folds the river bluff-catcher gets copy about the flop-fold. Same issue on `terminal_river_overbet_spew`.
- **Archetype responsiveness is strong on 3 nodes.** `flop_root` (already done), `river_brick_v_calls`, and `river_checkback` each have a clean fish/reg/pro split where the correct answer flips. This is the highest-leverage line for Stream B2/C widening.

---

## Node-by-node findings

### `flop_root` — flop · BB donks 33% on T♥9♥6♠

- **1. Setup:** ✓ BTN-call-vs-BB-3bet, effStack 90, pot 20.5 reconcile with standard 2.5bb open / 10bb 3bet math (0.5 SB + 10 + 10 = 20.5). Hero holding J♥T♠ is an appropriate teaching combo.
- **2. Villain action:** **Partial.** BB donk 33% on T96ss is **rare in solver** but **real in live pool.** GTO Wizard's "Navigating Range Disadvantage" documents that non-broadway low/middling flops favor the PFR caller, so BB's equilibrium action is mostly check. The authored rationale framing the donk as nut-advantage-driven is reversed — on T96ss, BTN has nut advantage (99/TT sets, JT/T9/98 two-pair+ combos, suited-connector straights). Routes to B2 below.
- **3. `correct` flag:** Call correct across reg/pro ✓. Raise correct vs fish is **defensible but aggressive as a binary flip** — many fish archetypes call with their full donk range to a raise, making raise EV positive via thin value; but calling also realizes equity at a good price. The binary `fish:true` flag teaches "always raise vs fish" which oversimplifies. Routes to L-flop_root-F3 below.
- **4. Frameworks:** `range_advantage`, `range_morphology`, `board_tilt`. **Inverted citation** — if BB doesn't have nut advantage here, `range_advantage` is cited as support for something it doesn't support. `nut_advantage` is not cited but is precisely what the copy asserts. See B2.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationale Call: imprecise — "TPTK-ish" label for J♥T♠ on T-9-6 is sloppy (JT is top-pair-strong-kicker but NOT TPTK; TPTK would be AT). Routes to L-flop_root-F4.
  - Rationale Raise: "turns TPTK into a bluff" carries the same "TPTK" imprecision forward.
  - Rationale Fold: ✓ solid — "JTs type hands have ~40%+ equity" matches my mental combinatorial check (rough range: 37–44% depending on BB's bluff combos included).
  - `why` section: contains the false "nut advantage" claim. See L-flop_root-F2 below.
- **6. Bucket-teaching readiness:** YES — already implemented. Continues to be the vertical-slice exemplar.
- **7. External validation:** 4 queries issued. 1 A, 2 B, 1 D.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "BB has nut advantage on T96ss in 3BP vs BTN caller" | "BB 3bet range advantage nut advantage wet middling flop T9x" | GTO Wizard — "Navigating Range Disadvantage as the 3-Bettor" | "Flops with no broadway cards hurt the 3-bettor… PFR's middling pocket pairs and suited connectors connect well; 3-bettor's overpair advantage is diminished; defender retains more nut hands (sets, straights)" | **B** (our content wrong) |
| 2 | "BB donks 33% on T96ss in 3BP, justified by range/nut position" | "GTO solver BB donk frequency 3bet pot wet middling T96 two-tone" | GTO Wizard — "Crush 3-Bet Pots OOP" + "Turn Barreling in 3-Bet Pots" | Solver OOP 3-bettor on disadvantaged flops mostly checks and uses larger sizing when betting; donking is not the solver's default on middling two-tones | **D** (intentional divergence — the spot IS a real live-pool occurrence even though solver doesn't donk) |
| 3 | "JTs has ~40%+ equity vs BB's 3bet range on T96ss" | manual combinatorial review vs typical BB 3bet range (JJ+, AK/AQs, KQs, A5s-A4s bluffs) | PokerListings equity conventions + mental weighted avg | 37–44% depending on fraction of A-high blocker bluffs in BB's range. ~40% is defensible; within rounding of solver-ish ranges. | **A** (no disagreement) |
| 4 | "Thin-value raise vs fish with TP+BDFD is +EV" | "population pool donk bet frequency live low stakes exploitative BB" | 888poker + GTO Wizard "Is Donk Betting for Donkeys?" + Upswing "Donk Bet" | Live-pool fish donk ranges are wider/stickier; raising for thin value is a recognized exploit but requires the specific fish archetype that calls with wide donks. Not all "fish" archetypes behave this way — our binary flag is too coarse. | **B** (our content over-commits; reg/pro nuance already present but fish side oversimplifies) |

#### Findings on `flop_root`

- **L-flop_root-F1 — Pot-odds-for-calling claim (compute section)** — *Severity 0 — resolved under audit.* Pot-odds math in the `compute` section ("6.8 into 27.3 + 6.8, break-even = 6.8/34.1 ≈ 20%") is correct. No fix needed; recorded for completeness.

- **L-flop_root-F2 — "BB has nut advantage" is the reverse of reality on T96ss** (Dimension 2, 4, 5)
  - **Severity:** 3 (P1). The line's entire pedagogical frame rests on a false premise.
  - **Observation:** `lines.js:718–724` — the `why` section asserts "BB has nut advantage — more sets (TT, 99, 66), many overpairs (JJ-AA) that are under pressure and prefer to charge draws." External-source evidence (GTO Wizard) says the opposite for non-broadway middling boards: PFR caller (BTN) has more sets (99, TT, 66 at decent frequency in flat-3bet range), more two-pair combos (JT, T9, 98 suited), and more suited-connector straight potential. BB's overpair advantage is real, but "nut advantage" — the ability to have the *best* hands — is with BTN.
  - **Recommended fix:** Rewrite the `why` section to frame BB's donk as an *exploitable deviation from solver*, not a principled nut-advantage-driven play. Suggested revised copy:

    > "BB 3bet pre, hero called. BB leads 33% into the capped caller on T♥9♥6♠ — a wet, two-tone, highly-connected middle-board. In solver, BB checks this texture most of the time: BTN has more sets (99/TT/66) and more straight/two-pair combos (JT/T9/98 suited) than BB's 3bet range. **But live BBs donk this spot often** as a range-protection move, and understanding how to respond to the live-pool donk is where EV lives. BB's donk range is usually polarized: overpairs (JJ+) that want to charge draws, the occasional slow-played set, plus A-high blocker bluffs (A5s/A4s)."

  - **Effort:** S — single section rewrite, no schema change.
  - **Risk:** Copy must stay consistent with the turn-node rationale ("BB's range going into the turn was the flop-donk range") which assumes the polar-donk framing — no conflict.
  - **Proposed backlog item:** `LSW-F1-A1 — flop_root nut-advantage rewrite`.

- **L-flop_root-F3 — Raise-vs-fish binary flip is too aggressive** (Dimension 3, 5)
  - **Severity:** 2 (P2). Teaches "always raise vs fish" when reality is "sometimes raise, sometimes call, depending on the fish's specific donk tendencies."
  - **Observation:** `lines.js:779 correctByArchetype: { fish: true, reg: false, pro: false }` on the Raise branch. Against a wide-donking fish who calls raises with TP/middle pair, raise is +EV via thin value. Against a tighter fish who donks mostly made hands and folds to aggression, raise is -EV (folds the bluff combos we beat). The archetype-level binary obscures this.
  - **Recommended fix:** Keep the archetype flip but expand the rationale to acknowledge the sub-archetype distinction. Suggested addition to the Raise rationale: "Note: raise is only +EV against wide-donking fish (the 'calling-station donker'). Against a tighter fish whose donk range is mostly weak made hands that fold to aggression, calling still wins more."
  - **Effort:** S — copy addition only.
  - **Risk:** minor — adds 1–2 sentences.
  - **Proposed backlog item:** `LSW-F1-A2 — flop_root raise-vs-fish nuance`.

- **L-flop_root-F4 — "TPTK-ish" imprecision** (Dimension 5)
  - **Severity:** 1 (P3). Sloppy taxonomy in a bucket-teaching tool.
  - **Observation:** `lines.js:764` — "TPTK-ish with a backdoor flush." JT on T-9-6 is top-pair-Jack-kicker, a strong kicker but not top (AT is). The "-ish" suffix compounds: either it IS TPTK or it's top-pair-strong-kicker.
  - **Recommended fix:** Replace "TPTK-ish" with "top-pair-strong-kicker" across both rationales (Call + Raise).
  - **Effort:** S — find/replace.
  - **Proposed backlog item:** `LSW-F1-A3 — TPTK-ish → top-pair-strong-kicker`.

---

### `turn_after_call` — turn · 2♣ brick · BB checks

- **1. Setup:** ✓ pot 34.1 ≈ 34 reconciles with flop-pot 20.5 + BB's 6.8 donk + hero's 6.8 call.
- **2. Villain action:** ✓ BB checks brick turn after donk-call. Supported by GTO Wizard ("Turn Barreling in 3-Bet Pots" — "BB checks the majority of brick turns in both 40bb and 100bb stack depths").
- **3. `correct` flag:** Bet 66% correct ✓. Check-back correct=false with "most instructive spot in the line" meta-note is great pedagogy. Overbet 110% correct=false ✓.
- **4. Frameworks:** `range_morphology`, `capped_range_check` ✓ both apt.
- **5. Copy:** ✓ clean. "Brick turn after donk" framing is precise.
- **6. Bucket-teaching readiness:** PARTIAL. Archetype split is subtle here — the right bet SIZE may shift by archetype (larger vs reg for protection; smaller vs fish for thin value with stations), but the fundamental bet/check decision is stable. Flag for Stream B2 as potential but not high-leverage.
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `turn_after_call`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "BB checks brick turn after donking flop and getting called" | solver 3bet pot OOP turn strategy brick | GTO Wizard — "Turn Barreling in 3-Bet Pots" | Solver BB checks most brick turns in 3BP OOP at both 40bb and 100bb stack depths; shifts toward shove-or-check at short stacks, more checking + block-betting when deeper. | **A** |
| 2 | "Hero's 66% turn bet after BB's capped check is the +EV play" | solver IP turn bet sizing 3BP capped range | GTO Wizard "C-Betting IP in 3-Bet Pots" + Upswing bet-sizing rules | "When double barreling on the turn, always bet pretty large (66% pot or more)." IP player should exploit capped-OOP-check with value+protection bets in this size range. | **A** |

#### Findings on `turn_after_call`

- ✓ **No findings.** Node is clean.

---

### `river_brick_v_calls` — river · 3♦ brick · BB check-calls turn, checks river

- **1. Setup:** ✓ pot 78 reconciles with turn pot 34 + hero's 22bb (66%) + BB's 22bb call = 78.
- **2. Villain action:** ✓ BB check-call-check line is realistic for a condensed medium-made-hand range (JJ-QQ that didn't raise, some slow-played sets, weak aces that paired).
- **3. `correct` flag:** Check-back correct ✓. Thin value bet correct=false ✓. Overbet correct=false ✓.
- **4. Frameworks:** `range_morphology` ✓ apt but thin — only one framework cited on a node that teaches multiple concepts (value-own discipline, condensed-range dynamics, thin-value threshold).
- **5. Copy:** ✓ clean. "Condenses BB's range to medium made hands" is precise.
- **6. Bucket-teaching readiness:** YES — high leverage. Classic thin-value-vs-fish split:
  - vs FISH: bet 33% for thin value (fish calls with any pair, including hands we beat — K9, JT, T7, A-high missed)
  - vs REG: check-back (condensed calling range)
  - vs PRO: check-back (condensed calling range)
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `river_brick_v_calls`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "Thin river value with TP after c/c-c line in 3BP is -EV vs population" | top pair thin value river check behind 3bet pot condensed range | GTO Wizard — "Dominate the River in 3-Bet Pots OOP" + Upswing "Should You Check Behind With Top Pair?" | "On brick river runouts after having polarized previous streets when 100bb deep, you can often simplify to checking or going all-in." Thin value betting against a condensed range is systematically -EV. | **A** |
| 2 | "Against fish/stations, the thin value threshold shifts — bet becomes +EV" | live low-stakes thin value fish calling station check behind | Multiple (Upswing "how to value bet", PokerListings) | Thin value betting range EXPANDS against calling stations; smaller sizing keeps the worse hands in the call range that would fold to a larger bet. | **A** (supports the archetype-split recommendation for bucket widening) |

#### Findings on `river_brick_v_calls`

- **L-river_brick_v_calls-F1 — Framework citation is thin** (Dimension 4)
  - **Severity:** 1 (P3). Node teaches multiple concepts but cites only `range_morphology`.
  - **Observation:** `lines.js:887 frameworks: ['range_morphology']`. The node's copy discusses thin-value thresholds, bluff-catcher psychology, and condensed-range identification — all of these have framework IDs.
  - **Recommended fix:** Add `value_sizing` or `thin_value_discipline` framework if one exists; if not, defer to a later framework-authoring session. Do NOT add frameworks that don't exist just to pad.
  - **Effort:** S — one-line array edit, pending framework inventory.
  - **Proposed backlog item:** `LSW-F1-A4 — river_brick_v_calls framework citation` (LOW priority).

---

### `river_checkback` — river · 3♦ · hero checked-back turn · BB bets 75%

- **1. Setup:** ✓ pot 34 preserved through turn check-back.
- **2. Villain action:** ✓ BB polar river bet after checked turn — solver-consistent (GTO Wizard: checked-back IP = capped range; OOP fires polarized river range).
- **3. `correct` flag:** Call correct ✓. Fold false ✓. Raise/jam false ✓.
- **4. Frameworks:** `range_morphology` ✓. Could add `bluff_catch_framework` if one exists.
- **5. Copy:**
  - Prompt: ✓ clean
  - **`why` section contains P1 math error** — see L-river_checkback-F1 below. The claimed "25.5 to win 76.5 → ~25% equity" is wrong; correct is 30% for a 75% bet.
  - Rationales per branch: ✓ solid once the math error is fixed.
  - `adjust` section (tight 3-bettor): ✓ clean.
- **6. Bucket-teaching readiness:** YES — high leverage. This is THE canonical archetype-sensitive bluff-catch:
  - vs FISH: fold (fish rarely polarizes; their "river bet after I checked" is almost always value)
  - vs REG: call (polar range with 30-40% bluffs — pot odds pay)
  - vs PRO: call (polar range includes thin value + honest bluffs)
- **7. External validation:** 3 queries issued. 2 A, 1 B.

#### 7a. External-validation log for `river_checkback`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "Pot odds for a 75% pot bet = 25% equity" | "pot odds formula bet to call existing pot equity needed 75% pot bet breakeven" | Upswing — "Pot Odds Step by Step" + Wikipedia "Pot odds" + PokerListings | Standard formula: required equity = bet / (pot + bet). A 75% pot bet requires 0.75 / 1.75 = ~30% (more precisely `betSize / (pot_after_villain_bet + hero_call) = 0.75 / 2.5 = 30%`). A 50% bet requires 25%; a pot-size bet requires 33%. The authored "25%" matches a 50% bet, not a 75% bet. | **B** (our content wrong — internal inconsistency: sizing says 75%, math says 25%) |
| 2 | "BB's polar bluff frequency on the river after a checked turn is 30-40%" | "3bet pot BB check-back river after turn checked through bluff frequency" | GTO Wizard "Mastering Turn Play in 3-Bet Pots OOP" + PokerCoaching articles | Checked-back turn = capped IP range → OOP river aggression at high frequency with polar range. Exact bluff frequency varies by board but 30–40% is in the right ballpark for a population/solver average in this line. | **A** |
| 3 | "Population overfolds in this exact spot" | folding thresholds 3bet pots population overfold | Cardquant — "Folding Thresholds in 3-bet Pots" + GTO Wizard general | "All players, fish and regs, overfold in 3-bet pots immensely." The call-is-correct conclusion holds for the reg/pro archetype in particular. | **A** |

#### Findings on `river_checkback`

- **L-river_checkback-F1 — Pot odds math error (25% claimed, 30% correct)** (Dimension 5, cat B)
  - **Severity:** 3 (P1). This is a teaching tool and the math has to be right. Students are explicitly asked to internalize this number; if it's wrong, they internalize the wrong threshold.
  - **Observation:** `lines.js:978` — `why` section states: "Pot odds: 25.5 to win 76.5 → we need ~25% equity." Correct math per standard formula (bet / (pot + bet)) at the authored 75% bet size:
    - Pre-bet pot: 34bb
    - Villain bets 25.5bb (75% of 34)
    - Pot after villain bet, before hero calls: 59.5bb
    - Hero's required equity: 25.5 / (59.5 + 25.5) = 25.5 / 85 = **30%**, not 25%.
    - The "76.5" figure doesn't reconcile: if "25.5 to win 76.5" means "call 25.5 to win the pot-before-your-call", that pot would need to be 76.5bb, but the actual pot-after-villain-bet is 59.5bb. 76.5 doesn't derive from any authored sizing.
    - The "25%" figure is CORRECT for a **50% pot bet**, not a 75% pot bet. The villainAction object says 75% — one of the two values is wrong.
  - **Recommended fix:** Pick the intended sizing and make everything consistent. Two options:
    - **Option A (preserve 75% sizing):** Update the `why` section to read "Pot odds: 25.5 to call, 59.5 in the pot → we need ~30% equity. Against a polar range in 3BP…"
    - **Option B (preserve 25% equity teaching):** Change `villainAction.size` from 0.75 to 0.50, and re-update the `why` section's numbers: "Pot odds: 17 to call, 51 in the pot → we need ~25% equity."
  - **Recommendation:** Option A. The authored `why` section also speaks about "75%" in the node prompt implicitly via the villainAction object. Keeping 75% and fixing the math preserves the instructional content.
  - **Effort:** S — single `why` section rewrite.
  - **Risk:** Downstream: `terminal_callcatch_win` pot value (85) must be re-verified. 34 pre-villain + 25.5 villain bet + 25.5 hero call = 85 ✓ already correct, confirms Option A is lossless.
  - **Proposed backlog item:** `LSW-F1-A5 — river_checkback pot-odds math fix`.

---

### `river_brick_v_checkraises` — **turn** · hero overbet · BB check-raised

- **1. Setup:** **✗ Pot accounting problem.** Authored `pot: 108`. Hero's overbet of 110% of the 34bb turn pot is 37.4bb. Pre-villain-action pot after hero's overbet = 34 + 37.4 = 71.4bb. BB's check-raise is sized at `{size: 3.0}` per the schema, but the prompt says "raises to 90bb total." None of {108, 71.4, 90} reconcile with each other cleanly.
- **2. Villain action:** ✓ BB check-raises a capped-IP-overbetter on a brick turn in 3BP — highly realistic and solver-consistent (GTO Wizard: "solver overbets occur with a lot of overpairs on the turn", "overbets on disadvantaged flops are polarized, with bluffs needing blockers").
- **3. `correct` flag:** Fold correct ✓. Call correct=false ✓. Jam correct=false ✓.
- **4. Frameworks:** `range_morphology`, `nut_advantage` ✓ both apt.
- **5. Copy:**
  - Prompt: ✓ *directionally* clean, but the "raises to 90bb total" number doesn't reconcile with the schema sizing. See S2.
  - **`why` section contains a second unverified math claim** — see L-river_brick_v_checkraises-F1 below.
  - Rationales per branch: ✓ solid in framing (sunk-cost trap, polar range with no polar value).
  - `adjust` section: ✓ clean.
- **6. Bucket-teaching readiness:** PARTIAL. Fold is correct across all archetypes with only a rare exception (maniac fish who CR-bluffs turn). Not high-leverage for archetype-split teaching — flag as lower priority.
- **7. External validation:** 2 queries issued. 1 A, 1 B.

#### 7a. External-validation log for `river_brick_v_checkraises`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "BB's check-raise range vs IP overbet in 3BP is value-heavy" | "check-raise 3bet pot BB facing overbet turn wet board value" | Upswing + GTO Wizard (general overbet-defense principles) | Against overbet sizing, the check-raising range on a non-nut-heavy board is dominated by sets, overpairs, and a few blocker-semi-bluffs. "Value-heavy" is correct but the exact composition varies. | **A** |
| 2 | "Price ~47bb to win ~155bb → ~30% equity" | pot odds formula cross-check | Standard formula per Upswing / Wikipedia | Cannot verify because the input numbers (47 to call, 155 pot) don't reconcile with the authored sizings. If BB raised to 90 and hero's overbet was 37.4, hero's call cost = 90 - 37.4 = 52.6 (not 47). If BB raised 3× hero's bet = 3 × 37.4 = 112.2 total (not 90). Neither path gives 47. | **B** (internal inconsistency — the math claim is based on sizings that don't derive from prior nodes) |

#### Findings on `river_brick_v_checkraises`

- **L-river_brick_v_checkraises-F1 — Node id is mislabeled `river_` but street is `turn`** (Dimension 5, structural)
  - **Severity:** 2 (P2). Confuses maintainers and breaks schema navigation intuition.
  - **Observation:** `lines.js:1037 id: 'river_brick_v_checkraises'` but `street: 'turn'`. The node is about check-raised turn overbets, not river.
  - **Recommended fix:** Rename to `turn_brick_v_checkraises`. Update all `nextId` references in the source line.
  - **Effort:** S — one grep-and-replace.
  - **Risk:** Medium-low — must catch every `nextId` reference to avoid breaking DAG validation. `lineSchema.validateLine` will catch any miss.
  - **Proposed backlog item:** `LSW-F1-A6 — turn_brick_v_checkraises rename`.

- **L-river_brick_v_checkraises-F2 — Pot accounting inconsistent across node + prompt + why + terminals** (Dimension 1, 5)
  - **Severity:** 3 (P1). Pot sizes are the backbone of every math claim in the node; incoherent pot values undermine trust in everything else.
  - **Observation:** Multiple inconsistencies:
    - Node `pot: 108`. Pre-action expected pot = 34 (turn start) + 37.4 (hero's 110% overbet) = 71.4. The 108 doesn't derive.
    - Prompt claims "BB check-raises the overbet to 90bb total." If BB's schema `size: 3.0` means "3× hero's bet," that's 3 × 37.4 = 112.2, not 90.
    - `why` section: "price ~47bb to win ~155bb." Neither number derives from the authored sizings.
    - Child terminal `terminal_called_cr_light` has `pot: 200`; if hero calls after BB raised to 112.2, post-call pot ≈ 71.4 + 112.2 + 74.8 (hero's call delta) = 218.4. Neither 200 nor 214 is exact.
  - **Recommended fix:** Audit the line's full bb flow and pick a consistent sizing. Suggested: hero's overbet at 150% (simpler math: 34 × 1.5 = 51bb; pot = 85; BB CR to 150bb effective or something round). Or: recompute every downstream pot from the authored sizing and replace the narrative numbers.
  - **Effort:** M — touches `river_brick_v_checkraises`, `terminal_correct_fold_cr`, `terminal_called_cr_light`, and both text rationales + `why` section numbers.
  - **Risk:** Medium. Requires careful numeric consistency across four nodes. `engineAuthoredDrift.test.js` (RT-108) will re-baseline once fixed.
  - **Proposed backlog item:** `LSW-F1-A7 — river_brick_v_checkraises pot-flow reconciliation`.

---

### Terminals — light walk

#### `terminal_correct_checkback` — ✓ clean
Pot 78 ✓ reconciles with `river_brick_v_calls` parent. Copy precise.

#### `terminal_callcatch_win` — ✓ clean
Pot 85 ✓ reconciles with `river_checkback` parent (34 + 25.5 + 25.5 = 85).

#### `terminal_correct_fold_cr` — [flagged in L-river_brick_v_checkraises-F2]
Pot 108 matches parent node but both are inconsistent with sizings.

#### `terminal_flop_overfold` — ✗ terminal-reuse ambiguity
- **L-terminals-F3 — `terminal_flop_overfold` reached from two different mistakes** (Dimension 5, structural)
  - **Severity:** 2 (P2). Copy teaches only about flop-fold of TP+BDFD, but is reached by anyone who folds the river bluff-catcher at `river_checkback`. Students who make the river-fold mistake get irrelevant flop-fold copy.
  - **Observation:** `lines.js:790 flop_root → Fold → terminal_flop_overfold` AND `lines.js:1013 river_checkback → Fold → terminal_flop_overfold`. Same terminal, different mistake.
  - **Recommended fix:** Split into two terminals: `terminal_flop_overfold` (keep existing) + new `terminal_river_overfold_bluffcatch` for the river-fold path. Copy for the new terminal should address "bluff-catcher fold in a polar-range spot" specifically.
  - **Effort:** S — new terminal authoring + one `nextId` update.
  - **Proposed backlog item:** `LSW-F1-A8 — split terminal_flop_overfold`.

#### `terminal_flop_raise_folds_weak` — ✗ pot value inconsistent
- **L-terminals-F4 — Pot 50 at `terminal_flop_raise_folds_weak` doesn't reconcile with raise math** (Dimension 1)
  - **Severity:** 1 (P3). Small pot discrepancy.
  - **Observation:** `lines.js:1221 pot: 50`. Hero raises to 9bb over BB's 6.8bb donk → if BB folds, hero wins pot = 20.5 + 6.8 + 9 = 36.3bb (not 50).
  - **Recommended fix:** Update pot value. If the terminal represents "hero raise got called and hero won showdown" (implicit), pot = 20.5 + 9 + 9 = 38.5. Either way, 50 is wrong.
  - **Effort:** S.
  - **Proposed backlog item:** `LSW-F1-A9 — terminal_flop_raise_folds_weak pot`.

#### `terminal_called_cr_light` — [flagged in L-river_brick_v_checkraises-F2]

#### `terminal_river_overbet_spew` — ✗ shared across two paths with different pots
- **L-terminals-F5 — `terminal_river_overbet_spew` reached from two paths with different real pots** (Dimension 1, structural)
  - **Severity:** 1 (P3). Terminal pot (78) matches `river_brick_v_calls → 50% thin value` but not `river_brick_v_calls → 125% overbet` (would be ~172) or `river_checkback → jam` (would be ~115).
  - **Recommended fix:** Either split into 3 terminals, or (simpler) remove the displayed pot since it's ambiguous and render the copy as "pot preserved" / "pot lost."
  - **Effort:** S — copy change.
  - **Proposed backlog item:** `LSW-F1-A10 — terminal_river_overbet_spew ambiguity` (LOW priority).

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-flop_root-F2 — "BB has nut advantage" is reversed | 3 | S | P1 | B |
| 2 | L-river_checkback-F1 — pot odds math error (25% vs 30%) | 3 | S | P1 | B |
| 3 | L-river_brick_v_checkraises-F2 — pot accounting cascade | 3 | M | P1 | B |
| 4 | L-river_brick_v_checkraises-F1 — node id mislabel | 2 | S | P2 | structural |
| 5 | L-terminals-F3 — `terminal_flop_overfold` reused across two mistakes | 2 | S | P2 | structural |
| 6 | L-flop_root-F3 — raise-vs-fish binary flip too aggressive | 2 | S | P2 | B |
| 7 | L-flop_root-F4 — "TPTK-ish" imprecision | 1 | S | P3 | B |
| 8 | L-terminals-F4 — `terminal_flop_raise_folds_weak` pot value | 1 | S | P3 | structural |
| 9 | L-terminals-F5 — `terminal_river_overbet_spew` shared ambiguity | 1 | S | P3 | structural |
| 10 | L-river_brick_v_calls-F1 — thin framework citation | 1 | S | P3 | structural |

---

## Bucket-teaching queue (flows into Stream B / C)

For the 5 decision nodes in this line, dimension-6 bucket-teaching readiness:

| Node | Hero combo (v1) | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale |
|------|-----------------|------------------------------|--------------------------------------|-----------|
| `flop_root` | J♥T♠ (**done** — currently authored) | `topPair, flushDraw, openEnder, overpair, air` (**done**) | call:{fish:F,reg:T,pro:T}; raise:{fish:T,reg:F,pro:F} (**done** — but see F3 caveat) | Vertical-slice host. Already live. |
| `turn_after_call` | J♥T♠ | `topPair, overpair, flushDraw, nutFlushDraw, comboDraw, air` | bet66%:{all:T}; sizing preference shifts subtly (smaller vs fish, larger vs reg for protection) | Low archetype leverage on bet/check decision; potentially useful for **sizing** teaching in a later upgrade. |
| `river_brick_v_calls` | J♥T♠ | `topPair, overpair, twoPair, set, air` | check-back:{fish:F,reg:T,pro:T}; bet33%-thin:{fish:T,reg:F,pro:F} | **HIGH LEVERAGE** — canonical thin-value-vs-fish lesson. Ship in LSW-B2. |
| `river_checkback` | J♥T♠ | `topPair, middlePair, overpair, nutFlushDraw, air` | call:{fish:F,reg:T,pro:T}; fold:{fish:T,reg:F,pro:F} | **HIGH LEVERAGE** — canonical bluff-catch archetype flip. Ship in LSW-B2. Depends on F1 being fixed first. |
| `river_brick_v_checkraises` | J♥T♠ | — | Fold is correct across all archetypes; partial exception for maniac-fish CR-bluffer is too narrow to warrant a split | Low bucket-teaching leverage. **Skip** for now. |

---

## Category-C engine findings (deferred pending solver access)

Two Category-C candidates surfaced during audit that require solver verification before opening Stream G tickets. Parking them here:

- **C1 (potential):** `HERO_BUCKET_TYPICAL_EQUITY.topPair = 0.68` (drillModeEngine.js:96) may overstate top-pair equity on wet boards. My rough combinatorial vs BB 3bet range on T96ss suggests JT's equity is 37–44% — substantially below 0.68. If solver confirms, the table needs board-texture conditioning, not just bucket-level constants. **Blocked on: GTO Wizard solver subscription or direct solver run.**

- **C2 (potential):** Archetype multipliers for `fish` in `archetypeRangeBuilder.js` may not shift bucket composition enough to reflect live-pool fish donk ranges (wider TP/middle-pair/random-draws). If solver-anchored fish range on T96ss has materially more `middlePair` + `gutshot` combos than our current multipliers produce, the resulting fold/call rates skew. **Blocked on: population-anchored archetype range data.**

Both deferred. Will re-audit these nodes with solver access once obtained.

---

## Documented divergence (for POKER_THEORY.md §9)

- **D1 — Line premise is live-pool, not solver.** `btn-vs-bb-3bp-ip-wet-t96` teaches the spot where BB donks 33% on T96ss in 3BP — a spot solver largely avoids (BB checks most of this texture in 3BP OOP without range/nut advantage). The line is intentionally live-pool-oriented: the donk is a common population tendency and mastering the response is high-EV in live games. Once L-flop_root-F2 is fixed (rewording the `why` section to label the donk as exploitable over-aggression rather than principled nut-advantage play), this divergence is documented and acceptable. **Action: add to POKER_THEORY.md §9 "Documented Divergences" along with the rewritten line.**

---

## Accuracy verdict

**YELLOW.** One P1 content error (pot-odds math), one P1 premise error (nut-advantage reversal), one P1 pot-accounting cascade. No P0 blockers. Stream B widening on this line should wait for the 3 P1s to ship through Stream F. P2/P3 items can bundle or defer.

**Specifically:** `river_checkback` and `river_brick_v_calls` have the highest bucket-teaching leverage in the library. Shipping them in Stream B2 is the biggest student-visible-value move — but depends on L-river_checkback-F1 (pot odds) being fixed first, otherwise the bucket-EV panel computes against a wrong base and the student learns the wrong threshold.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** owner (approved plan inline 2026-04-22 before implementation)
- **Closed:** 2026-04-22 — linked to LSW-F1 (single commit, 8 of 10 findings shipped; A4 framework-citation P3 deferred per audit's own guidance; A9/A10 shipped with pot-value updates rather than pot-removal after schema review showed pot is required) + POKER_THEORY.md §9 D1 (live-pool donk divergence documented)

---

## Change log

- 2026-04-22 — Draft (external-validation methodology first-applied).
- 2026-04-22 — Closed. LSW-F1 shipped in a single commit: A1 (flop_root `why` rewrite), A2 (raise-vs-fish nuance), A3 (TPTK-ish → top-pair-strong-kicker), A5 (river_checkback pot-odds 25% → 30%), A6 (node rename → `turn_brick_v_checkraises`), A7 (pot-accounting reconciliation: 108→184, 108→184, 200→258; prompt "90bb" → "112bb"; math: "47bb to win 155bb" → "75bb to call into 184bb pot, ~29% equity"), A8 (new terminal `terminal_river_overfold_bluffcatch`), A9 + A10 (pot values corrected rather than removed — schema requires pot). D1 documented as POKER_THEORY.md §9.1. A4 deferred. `engineAuthoredDrift` baseline regenerated for the node-key rename. 311/311 postflop tests green; full suite 6257/6258 (1 pre-existing precisionAudit flake unrelated).
- 2026-04-22 — Companion surface audit opened: [`btn-vs-bb-3bp-ip-wet-t96-surface.md`](btn-vs-bb-3bp-ip-wet-t96-surface.md) covers UI rendering (explicitly scoped out of this content audit). Adds 7 findings (3 P0, 3 P1, 1 P2) against `BucketEVPanel` / `PotOddsCalculator` / `BUCKET_TAXONOMY`. Routes: LSW-H1, LSW-H2, LSW-H3 (new Stream H — surface quality); LSW-G3, LSW-G4, LSW-G5. `LSW-B1` now BLOCKED by `LSW-H1 + LSW-H3` in addition to `LSW-A1..A8`.

---

## Sources (web research citations)

- [GTO Wizard — "Navigating Range Disadvantage as the 3-Bettor"](https://blog.gtowizard.com/navigating-range-disadvantage-as-the-3-bettor/)
- [GTO Wizard — "Crush 3-Bet Pots OOP in Cash Games"](https://blog.gtowizard.com/crush-3-bet-pots-oop-in-cash-games/)
- [GTO Wizard — "Turn Barreling in 3-Bet Pots"](https://blog.gtowizard.com/turn-barreling-in-3-bet-pots/)
- [GTO Wizard — "Exploiting BBs Who Never Donk-Bet"](https://blog.gtowizard.com/exploiting-bbs-who-never-donk-bet/)
- [GTO Wizard — "Mastering Turn Play in 3-Bet Pots OOP"](https://blog.gtowizard.com/mastering-turn-play-in-3-bet-pots-oop/)
- [GTO Wizard — "C-Betting IP in 3-Bet Pots"](https://blog.gtowizard.com/c-betting-ip-in-3-bet-pots/)
- [Upswing — "Pot Odds Step by Step"](https://upswingpoker.com/pot-odds-step-by-step/)
- [Upswing — "Stop Bleeding Money in 3-Bet Pots"](https://upswingpoker.com/3-bet-pots-stop-bleeding/)
- [Upswing — "Bet Sizing Strategy: 8 Rules"](https://upswingpoker.com/bet-size-strategy-tips-rules/)
- [Upswing — "Should You Check Behind With Top Pair?"](https://www.splitsuit.com/checking-behind-with-top-pair)
- [Cardquant — "Folding Thresholds in 3-bet Pots"](https://cardquant.com/folding-thresholds-in-3-bet-pots/)
- [Wikipedia — "Pot odds"](https://en.wikipedia.org/wiki/Pot_odds)
- [Run It Once — "C-betting in 3-bet pots: Behavior on low boards"](https://www.runitonce.com/nlhe/solver-summaries-question-c-betting-in-3-bet-pots-behavior-on-low-boards/) (fetched with 403; cited from search-result summary only)
