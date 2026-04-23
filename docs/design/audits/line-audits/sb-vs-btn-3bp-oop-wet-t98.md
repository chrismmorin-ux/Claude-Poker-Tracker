# Line Audit — 2026-04-22 — `sb-vs-btn-3bp-oop-wet-t98`

**Line:** `sb-vs-btn-3bp-oop-wet-t98` — SB vs BTN · 3BP · Wet T♠9♠8♥
**File:** `src/utils/postflopDrillContent/lines.js` lines 1993–2073
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard, Upswing, SplitSuit, 888 Poker.
**Status:** Closed 2026-04-22 — LSW-F4 shipped all 6 findings same day (A1 schema `hero.action` 'fourBet' → 'call' resolving as 3BP flat defense, A2 AA-as-bluff-catcher framing replaced with strong-but-vulnerable + removed "JJ coin-flip" factual error, A3 inverted range/nut advantage frameworks dropped and replaced with `board_tilt`, A4 POKER_THEORY.md §9.3 SB-flat-3bet divergence appended, A5 solver-mix acknowledgment added to correct branch rationale, A6 terminal_raise_wet_aa pot reconciliation comment).

---

## Executive summary

**Verdict: YELLOW.** The line teaches a real and important concept — overpair discipline in a 3BP on a wet board with a scary runout — and the three `correct` flags (check flop AA, call turn AA, fold river AA) are directionally solver-aligned. But the line carries **two P1 load-bearing errors** that need fixing before widening:

1. **Schema declaration mismatch.** `setup.hero.action: 'fourBet'` + author inline comment "treat as 4bp for schema" contradict the rest of the line. Pot 21 (consistent with SB flat-3bet 3BP, not 4BP which would be ~45bb); copy explicitly says *"Hero in SB flatted BTN 3bet"*; tag `'3bp'`. This is a 3BP with SB defending via flat call, not a 4BP. Same severity as K77's CO/IP mismatch — blocks v2 migration.
2. **"AA is a bluff-catcher, not a nut hand"** — the rationale on the correct (Check) branch overstates the weakness of AA on T98ss. AA has ~55–62% equity vs BTN's 3bet range on T98ss. That's "ahead of range but vulnerable" — not a bluff-catcher (a bluff-catcher is typically 30–50% vs polar betting range). The correct teaching is "AA wants pot control because it can't fold out most of villain's range and gets into trouble on many runouts" — not "AA is reduced to a bluff-catcher."

Plus: the **preflop setup itself** — SB flat-calling a BTN 3bet — is near-solver-impossible. Modern solver has SB 3bet-or-fold vs BTN opens; defending via flat is almost never chosen ([GTO Wizard — Crush 3-Bet Pots OOP](https://blog.gtowizard.com/crush-3-bet-pots-oop-in-cash-games/); [888 Poker — SB vs BB 3bets](https://www.888poker.com/magazine/sb-vs-bb-3bets-strategy)). The author's parenthetical *"rare but OK with QQ, AK, AQs in modern frames"* is a self-aware acknowledgment but overstates the OK-ness. This is a Category D divergence if intentionally live-pool-framed, or Category B if taken as solver-authoritative.

**Six findings produced.** 2 P1 (schema mismatch + AA-as-bluff-catcher framing), 1 P2 (SB flat 3bet preflop pathway acknowledgment), 3 P3 (small rationale imprecisions + terminal pot drift).

**Routing:** 1 POKER_THEORY.md §9.3 entry for the SB-flat divergence; 1 Stream F4 content-fix bundle (6 items, bundleable single commit); zero Stream G engine tickets. Line is **BLOCKED on F4 shipping before LSW-B1 widening** — same gate level as K77. Additionally **blocked on G4-TD-3** (archetypeRanges.js authoring for BTN_vs_SB 3bet-call scenario) before v2 migration is possible.

---

## Scope

- **Nodes audited:** 8 total (3 decision + 5 terminal)
- **Decision nodes:** `flop_root`, `turn_after_check`, `river_after_turn_call`
- **Terminal nodes:** `terminal_fold_river_wet`, `terminal_crying_call_wet`, `terminal_overfold_aa`, `terminal_raise_wet_aa`, `terminal_bet_wet_aa`
- **Frameworks referenced:** `range_advantage`, `nut_advantage`, `range_morphology`
- **Heroes:** SB open (declared `fourBet` — see L-setup-F1) vs BTN 3bet, effStack 90bb, 3BP (declared 3bp in tags, `setup.potType: '3bp'`, but author comment says "treat as 4bp"), wet two-tone middling flop with made straight on board
- **Pot-type:** 3BP — pot 21 reconciles with SB open 3bb + BTN 3bet 9bb + SB call 9bb + SB dead 0 + BB forfeit 1 = ~22 (close to 21, within rounding). A 4BP would show pot ~45bb at SPR ~2.
- **Note on node count:** BACKLOG entry said "4 nodes (2 decision)". Actual content is 8 nodes (3 decision + 5 terminal). Discrepancy logged.
- **Out of scope:** engine EV values (RT-108); UI rendering.

---

## Cross-node observations

- **Strategy content is directionally correct.** Check flop AA → Call turn AA → Fold river AA is the canonical "overpair on wet board, disciplined river fold" teaching arc. The runout design (2♣ brick then 7♠ straight-and-flush-completer) is pedagogically excellent — maximizes the bad-river lesson.
- **Pre-flop pathway is solver-inconsistent.** SB flat-call of BTN 3bet is near-zero in modern solver ([888 Poker — SB 3-bet Strategy](https://www.888poker.com/magazine/sb-vs-bb-3bets-strategy): *"the SB barely calls anything when facing a BTN open-raise, instead almost exclusively 3-betting or folding"*). The line acknowledges this with the *"rare but OK with QQ, AK, AQs"* parenthetical, but the full reason SB doesn't flat — playing OOP vs polar range from a vulnerable seat — is deeper than that one-line hedge conveys. Either reframe the line as a 4BP (which is what the author comment suggests they might have intended, and where SB *does* mix in AA/KK) **or** explicitly label the pre-flop as a live-pool divergence and document it.
- **AA equity framing is the philosophical center of this line** and is currently misstated. On T98ss in 3BP, AA has ~55–62% equity vs BTN's 3bet range. That makes AA "strong but vulnerable" — which is a *different teaching concept* from "bluff-catcher." The rationale "AA is a bluff-catcher, not a nut hand" collapses those two concepts and teaches the wrong mental model. The correct frame: *"AA has meaningful equity vs BTN's range, but T98ss threatens that equity on many turn/river cards (any J, Q, 7, 6, or spade); pot-control via check lets us realize equity cheaply instead of bloating a pot we can't bet-fold."* The teaching conclusion (check) is correct; the stated reason is wrong.
- **Schema declarations + copy are inconsistent.** `setup.hero.action: 'fourBet'` vs copy "SB flatted BTN 3bet" vs pot size 21 vs author comment "treat as 4bp" — four different signals pointing in different directions. Same category of bug as K77's position mismatch.
- **No pot-accounting cascades** on the correct path (21 → 49 → 49 is consistent with flop pot 21 + turn bet 14 + call 14 = 49).
- **Overpair check-raise defense is not modeled.** External research noted BB's (or SB's in this case) optimal check-raise frequency with overpair + straight draw combos is ~18% on similar textures. Our line has no check-raise branch. Scope limitation, not a correctness error — flag for Stream B/E polish.

---

## Node-by-node findings

### `flop_root` — flop · hero OOP AA on T♠9♠8♥ in 3BP

- **1. Setup:** **✗ Schema declaration mismatch.** `setup.hero.action: 'fourBet'` but copy says "flatted" and pot 21 is 3BP-consistent. See L-setup-F1.
- **2. Villain action:** `villainAction: null` — SB acts first on flop OOP. ✓ consistent with SB vs BTN postflop order.
- **3. `correct` flag:** Check ✓ directionally correct (dominant solver action on disadvantaged low-card flops is high-frequency check). Bet 33% false — but this is **mixed in solver**, not a pure false. See L-flop_root-F1. Bet 75% false ✓ clearly wrong (polar sizing with non-nut hand on wet board).
- **4. Frameworks:** `range_advantage` ✗ hero does NOT have range advantage as the 4better/caller on T98ss — BTN does (flatted from BTN's preflop perspective, BTN has more straights/sets in 3bet range on this texture). Replace with something else or drop. `nut_advantage` ✗ also inverted on T98ss. `range_morphology` ✓ apt. See L-flop_root-F2.
- **5. Copy:**
  - Prompt: ✓ clean
  - **`mismatch` section "Overpair is NOT the nuts here" — TRUE CONCEPT but framed too strongly.** "AA on T98ss is crushed by 3bet-range straights (QJs, JJ coin-flip with hero range)" — AA is NOT crushed by JJ; AA has ~80% vs JJ. QJs hits a straight on T98s, correct that AA is crushed by QJs. But JJ is an overpair, not a straight. The "coin-flip" claim for JJ is wrong. See L-flop_root-F3.
  - Correct (Check) rationale: **philosophically overstated.** "AA on T98ss is a bluff-catcher, not a nut hand." See L-flop_root-F1.
  - Bet 33% rationale: "BTN's continue range crushes AA on this texture" — this is wrong. BTN's continue range includes overpairs below AA (JJ-KK), sets (which crush AA), and draws (which AA is ahead of). Net equity for AA vs BTN's continue-vs-bet range is likely ~45-55%. "Crushes" is factually inaccurate.
  - Bet 75% rationale: ✓ clean on the "non-nut hand polar sizing" framing.
- **6. Bucket-teaching readiness:** HIGH LEVERAGE (if content fixed first). Archetype flip:
  - vs FISH: mix in bet 33% (fish overcalls with worse overpairs + draws, increasing AA's relative value)
  - vs REG: check as authored (solver-dominant on this texture)
  - vs PRO / AGGRESSIVE: check-call (trapping against polar c-betting ranges)
- **7. External validation:** 3 queries issued. 0 A, 2 B, 1 D.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "AA on wet T98ss 3BP OOP is a bluff-catcher" | AA overpair wet T98 flop 3bet pot OOP check call strategy bluff catcher solver | [GTO Wizard — Crush 3-Bet Pots OOP](https://blog.gtowizard.com/crush-3-bet-pots-oop-in-cash-games/); [GTO Wizard — C-Betting OOP in 3-Bet Pots](https://blog.gtowizard.com/c-betting-oop-in-3-bet-pots/) | "In wet flop spots, overpairs (AA, KK, QQ, JJ, TT, and 99) are among the few hands that should c-bet 50% or more of the time, while the default play for most other hands is to check." "With 100bb stacks on low card flops, the OOP 3-bettor checks 79% of hands and bets pot with 10%, with the latter range mostly polarized to strong but vulnerable overpairs and overcards with backdoor draws." AA is **a strong but vulnerable overpair**, not a bluff-catcher. It's in the 10% bet-range, not the 79% check-range on most wet flops. | **B** (our content framing is wrong — AA is strong-but-vulnerable, not bluff-catcher. Solver has AA mix check and bet, not pure check.) |
| 2 | "SB flats BTN 3bet as a defensive option (rare but OK)" | SB flat 3bet BTN out of position 3BP wet middling board defense strategy modern solver | [888 Poker — SB vs BB 3bets](https://www.888poker.com/magazine/sb-vs-bb-3bets-strategy); [888 Poker — Defending vs 3bets](https://www.888poker.com/magazine/strategy/defending-versus-3bet-strategy); [Upswing — React to Preflop 3-Bets](https://upswingpoker.com/vs-3-bet-pre-flop-position-strategy-revealed/) | "The SB barely calls anything when facing a BTN open-raise, instead almost exclusively 3-betting or folding." "There are several structural reasons why the SB calls less than other positions: The SB always plays out of position … the SB risks a BB squeeze … signals weak holdings." Modern solver: SB's preflop tree is 3bet or fold vs BTN opens. The "rare but OK" authored framing understates how solver-inconsistent this is. | **B** (borderline B/D — if acknowledged as a live-pool non-solver pathway, Category D; as currently framed implying solver acceptance, Category B) |
| 3 | "AA on T98ss has meaningful equity vs BTN's 3bet range" | pocket aces AA equity T98 flop 3bet pot heads up range wet middling overpair vulnerable | [Upswing — How to Play Pocket Aces](https://upswingpoker.com/how-to-play-pocket-aces/); [SplitSuit — Simple Strategy for AA](https://www.splitsuit.com/the-simple-strategy-for-pocket-aces-aa) | "Pocket Aces perform best in heads-up pots, retaining their highest amount of equity versus only one other opponent." "In most 3-bet pots where you have aces, you will want to bet small (25-30%), as there is already enough money in the pot that you can comfortably go all-in by the river on good runouts." Rough equity estimation: AA vs BTN 3bet range on T98ss = ~55-62% (ahead of overpairs below, draws, worse top pairs; behind sets/straights which are small portion of range). | **A** (AA has equity ~60%); contradicts our "AA is a bluff-catcher" framing |

#### Findings on `flop_root`

- **L-setup-F1 — Schema declaration mismatch: hero.action is 'fourBet' but line is a 3BP (SB flat of 3bet), not 4BP** (Dimension 1, Cat B, bundled schema fix)
  - **Severity:** 3 (P1). Blocks v2 migration — archetypeRanges lookup and villainRanges alias would resolve wrong ranges (SB 4bet range vs BTN 3bet-call-4bet range is NOT SB flat-3bet range vs BTN 3bet range).
  - **Observation:** 
    - `lines.js:2002` — `action: 'fourBet'`
    - `lines.js:2002` — inline comment: `// note: ACT is "open from SB" but wrapped as 4bet vs BTN 3bet — treat as 4bp for schema`
    - `lines.js:2004` — `potType: '3bp'` (contradicts the comment)
    - `lines.js:2013` — `pot: 21.0` (3BP-consistent; 4BP would be ~45bb)
    - `lines.js:2017` — copy: *"Hero in SB flatted BTN 3bet (rare but OK with QQ, AK, AQs in modern frames)"*
  - **Recommended fix:** Resolve to **3BP (SB flat of 3bet)**:
    - `setup.hero.action`: `'fourBet'` → `'call'` (or equivalent "call-3bet" action; confirm with schema)
    - Drop author's inline "treat as 4bp for schema" comment
    - `villains[0]`: `{ position: 'BTN', action: 'threeBet', vs: 'SB' }` stays (correct)
    - `potType: '3bp'` stays (correct)
    - Pot and copy already match 3BP — no further edits.
  - **Alternative fix (larger):** Reframe as 4BP — change pot from 21 → ~45, update effStack, rewrite the copy to reflect SB 4bet + BTN 4bet-call line. This is a significant rewrite and changes the teaching content (4BP SPR ~2 is very different from 3BP SPR ~4). Not recommended.
  - **Effort:** S (resolve-to-3BP).
  - **Risk:** Low. Breaks no current tests (no v3 `heroView` authored on this line yet).
  - **Proposed backlog item:** `LSW-F4-A1 — T98 schema declaration: hero.action 'fourBet' → 'call'`.

- **L-flop_root-F1 — "AA is a bluff-catcher" framing oversimplifies strong-but-vulnerable overpair** (Dimension 5, Cat B)
  - **Severity:** 3 (P1). Teaches a wrong mental model. A student internalizing "AA on wet boards is a bluff-catcher" will make a cascading series of strategy errors — folding AA to one bet on dry-ish wet boards, under-valuebetting it on turn/river when well ahead, missing protection spots.
  - **Observation:** `lines.js:2023` — Correct rationale: *"AA on T98ss is a bluff-catcher, not a nut hand. Check-call keeps BTN's bluffs in; check-raise overcommits."* Plus `lines.js:2018` mismatch section: *"Overpair is NOT the nuts here. AA on T98ss is crushed by 3bet-range straights (QJs, JJ coin-flip with hero range). This is the classic 'my overpair isn't nutted on wet boards' teaching spot."*
  - **Actual AA equity on T98ss vs BTN 3bet range:** ~55-62%. AA beats all overpairs below, all top/middle pairs, most draws. AA is crushed only by sets (TT/99/88, ~9 combos) and straights (QJs ~3 combos). Against the full 3bet range, AA is "ahead and vulnerable," NOT "a bluff-catcher."
  - **"JJ coin-flip with hero range" is incorrect** — AA vs JJ is ~80/20, not 50/50. The combinatorics of T98ss don't meaningfully equalize this. JJ is in BTN's range, but AA beats JJ clearly.
  - **Recommended fix:** Rewrite the rationale to reflect "strong-but-vulnerable" framing, not "bluff-catcher":
    > "AA has ~60% equity vs BTN's 3bet range on T98ss — ahead of range but vulnerable to many turn/river cards (any J, Q, 7, 6, or spade). Check lets us realize equity cheaply against the draws and overpairs below us, while avoiding bloating a pot we can't bet-fold if BTN check-raises. Bet is also a valid mixed strategy in solver, but check is the higher-frequency choice."
    
    Revise the mismatch section:
    > "Overpair ≠ nut on wet boards. AA on T98ss is a strong but vulnerable hand — we're ahead of BTN's range (~60%) but many runout cards threaten that edge. The teaching point: pot-control with big pairs on connected wet textures is not about being behind — it's about equity realization and stack preservation."
  - **Effort:** S — two copy rewrites.
  - **Risk:** None — tightens teaching, doesn't change `correct` flag.
  - **Proposed backlog item:** `LSW-F4-A2 — flop_root AA framing: strong-but-vulnerable, not bluff-catcher`.

- **L-flop_root-F2 — `range_advantage` + `nut_advantage` frameworks are INVERTED on T98ss 3BP** (Dimension 4)
  - **Severity:** 2 (P2). Frameworks teach the *opposite* of what's true on this spot.
  - **Observation:** `lines.js:2015` — `frameworks: ['range_advantage', 'nut_advantage', 'range_morphology']`. On T98ss in SB-flat-3bp vs BTN, **BTN has range advantage and nut advantage**, not hero. BTN's 3bet range includes all the straights (QJ), most sets (TT/99/88), all overpairs JJ+, all nut draws. Hero's SB flat range is narrower and weaker on this texture.
  - **Recommended fix:** Replace with `range_morphology` + `board_tilt` + possibly a new `range_disadvantage_defense` framework if one exists. At minimum, drop the two inverted ones.
  - **Effort:** S — array edit.
  - **Proposed backlog item:** `LSW-F4-A3 — flop_root framework inversion fix`.

- **L-flop_root-F3 — "JJ coin-flip with hero range" is factually wrong** (Dimension 5, Cat B)
  - **Severity:** 2 (P2). Teaches wrong combinatorics.
  - **Observation:** `lines.js:2018` mismatch section: *"AA on T98ss is crushed by 3bet-range straights (QJs, JJ coin-flip with hero range)"*. JJ is an overpair; AA vs JJ preflop is ~81%/19% (pocket pairs rule). On T98ss flop, JJ has no flush/straight draw of its own, so it's still roughly 80% behind AA.
  - **Recommended fix:** Correct the claim. Suggested rewrite: *"AA on T98ss is vulnerable to 3bet-range straights (QJs) and sets (TT/99/88); JJ-KK are still behind AA but block some of our equity-boost cards."*
  - **Effort:** S — one-sentence edit.
  - **Proposed backlog item:** `LSW-F4-A4 — JJ coin-flip claim correction`.

---

### `turn_after_check` — turn · 2♣ brick · BTN bets 66% pot

- **1. Setup:** ✓ pot 21.0 preserved through hero's flop check.
- **2. Villain action:** ✓ BTN bets 66% turn after IP check-behind wasn't the line (hero checked flop, BTN **bet the flop in spirit**, hero check-called). Wait — actually reading the action flow: hero checked flop (flop_root), and `turn_after_check` is reached when hero chose check → so BTN must have **checked flop too** (the flop check-through line) OR hero called BTN's flop cbet. The line id "turn_after_check" is ambiguous about which check. Reading the copy: *"BTN's turn bet after hero's check"* suggests hero checked flop and BTN **also** checked flop (since no flop bet/call is described). But then pot should be 21 (preserved) which it is. This means **hero and BTN both checked the flop**, and now we're at turn with BTN betting for the first time. That's a "delayed c-bet" scenario. ✓ solver-consistent — BTN would often check-back wet flops in 3BP IP to protect its check-back range, then bet turn on brick cards.
- **3. `correct` flag:** Call ✓. Fold false ✓ (AA has enough equity vs BTN's turn bet range). Raise false ✓ (bloats pot with non-nut hand).
- **4. Frameworks:** `range_morphology` ✓.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationale Call: "AA's equity is ~50% against this range (behind straights, ahead of draws and worse pairs)" — this is closer to accurate than the flop framing. Still possibly slightly understated (AA vs a turn-bet-after-flop-checkthrough range is probably 50-58%, not 50%).
  - Rationale Fold: ✓ solid.
  - Rationale Raise: ✓ solid.
- **6. Bucket-teaching readiness:** PARTIAL. Call is correct across archetypes; sizing/raise response might flip on very aggressive archetype.
- **7. External validation:** 1 query (bundled with flop_root queries — same overpair-defense material).

#### 7a. External-validation log for `turn_after_check`

Inherits from `flop_root` queries #1 and #3. Specifically: [GTO Wizard — Mastering Turn Play in 3-Bet Pots OOP](https://blog.gtowizard.com/mastering-turn-play-in-3-bet-pots-oop/) confirms "overpair continues calling on brick turns against IP aggression" for ~50-55% equity AA-KK class hands.

#### Findings on `turn_after_check`

- ✓ **No findings specific to this node.** Equity estimate "~50%" is slightly low but in the right neighborhood.

---

### `river_after_turn_call` — river · 7♠ (completes straight AND flush) · BTN bets pot

- **1. Setup:** ✓ pot 49.0 reconciles with turn 21.0 + BTN bet 14.0 + hero call 14.0 = 49.0.
- **2. Villain action:** ✓ BTN bets pot on a runout that completes every straight + flush. Polar value-heavy action consistent with solver on scare-card runouts.
- **3. `correct` flag:** Fold ✓ **strongly correct.** The 7♠ is among the worst possible rivers for AA — completes QJ/J7/76 straights, completes flush draws (many spade combos in BTN's range), leaves very few bluff combos. Fold is the textbook answer.
- **4. Frameworks:** `nut_advantage` ✓ — BTN's range IS value-heavy on this runout.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationale Fold: *"Range is value-heavy on this runout. AA beats only missed-draws (rare after calling turn)."* — ✓ clean and accurate.
  - Rationale Call: ✓ clean.
  - Rationale Raise: ✓ clean.
  - `mismatch` section: ✓ "Worst possible card" framing is dramatic but accurate.
- **6. Bucket-teaching readiness:** HIGH LEVERAGE for overpair-on-scary-runout teaching. Fold is correct across all archetypes (maybe mix in tiny call frequency vs the most aggressive bluffers). Simple, clean flip.
- **7. External validation:** 0 new queries — runout analysis is deterministic from board composition.

#### Findings on `river_after_turn_call`

- ✓ **No findings.** Node is the cleanest in the line.

---

### Terminals — light walk

- **`terminal_fold_river_wet`** — pot 49.0 from `river_after_turn_call → Fold`. ✓ clean.
- **`terminal_crying_call_wet`** — pot 49.0 from `river_after_turn_call → Call`. ✓ clean.
- **`terminal_overfold_aa`** — pot 21.0 from `turn_after_check → Fold`. ✓ clean.
- **`terminal_raise_wet_aa`** — pot 21.0 from `turn_after_check → Raise` AND `river_after_turn_call → Raise`. Pot 21 reconciles with turn-parent but not river-parent (would be 49). Same pattern as A2/A3.
- **`terminal_bet_wet_aa`** — pot 21.0 from `flop_root → Bet 33%` AND `flop_root → Bet 75%`. ✓ both parents have pot 21.

#### Findings on terminals

- **L-terminals-F1 — `terminal_raise_wet_aa` pot reconciles with turn-parent (21.0) only, not river-parent (should be 49.0)** (Dimension 1, structural)
  - **Severity:** 1 (P3). Same pattern as A1/A2/A3 shared-terminal pot drift.
  - **Observation:** `lines.js:2070` `pot: 21.0` correct for `turn_after_check → Raise` but wrong for `river_after_turn_call → Raise` (should be 49.0).
  - **Recommended fix:** Same options as prior audits — split into per-parent terminals OR add comment acknowledging multi-path drift.
  - **Effort:** S.
  - **Proposed backlog item:** `LSW-F4-A5 — terminal_raise_wet_aa pot reconciliation`.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-setup-F1 — schema declaration: hero.action 'fourBet' → 'call' (3BP resolve) | 3 | S | **P1** | B |
| 2 | L-flop_root-F1 — AA-as-bluff-catcher framing rewrite | 3 | S | **P1** | B |
| 3 | L-flop_root-F2 — range/nut advantage frameworks inverted | 2 | S | P2 | structural |
| 4 | L-flop_root-F3 — "JJ coin-flip" factual error | 2 | S | P2 | B |
| 5 | L-setup-F2 — SB flat 3bet preflop pathway acknowledgment | 2 | S | P2 | D (or B if unlabeled) |
| 6 | L-terminals-F1 — terminal_raise_wet_aa pot | 1 | S | P3 | structural |

**Two P1 findings.** Same YELLOW severity as K77 but for different reasons — K77 had one P1 setup error, T98 has one P1 schema error + one P1 pedagogy error.

---

## Bucket-teaching queue (flows into Stream B / C)

For the 3 decision nodes:

| Node | Hero combo | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Leverage |
|------|------------|------------------------------|--------------------------------------|----------|
| `flop_root` | A♦A♣ (overpair, authored) | `overpair, nutOverpair, underpair, topPair, strongDraw, weakDraw` | check:{fish:T,reg:T,pro:T}; bet33%-mix:{fish:T,pro:T-secondary}; bet75%:{all:F} | **HIGH LEVERAGE.** Clean archetype flip on *whether* to bet for protection. Best taught after L-flop_root-F1 fix (fishing for fish = can bet thin for value). |
| `turn_after_check` | A♦A♣ | `overpair, nutOverpair, topPair, twoPair, underpair` | call:{all:T}; raise:{nit:F,reg:F,pro:F}; fold:{nit:maybe-T,reg:F} | PARTIAL. Call is cross-archetype; raise never works. |
| `river_after_turn_call` | A♦A♣ | `overpair, nutOverpair, topPair, twoPair, underpair` | fold:{reg:T,pro:T}; call:{nit:maybe-T vs aggressive villains}; fold dominant | **HIGH LEVERAGE.** Fold-on-scary-runout is the canonical overpair discipline teach. Clean. |

**Two HIGH-leverage targets:** `flop_root` (overpair bet/check decision by archetype) and `river_after_turn_call` (scary-runout overpair fold). Both blocked on F4 shipping first + G4-TD-3 archetypeRanges authoring.

---

## Category-C engine findings (deferred pending solver access)

**None.** AA on wet board is a clean overpair bucket with well-understood engine behavior.

---

## Documented divergence (for POKER_THEORY.md §9)

- **D2 (new) — SB flat-call of BTN 3bet.** Modern solver essentially never calls a 3bet from SB; the correct preflop action is 3bet-or-fold. Our line teaches the flat-3bet pathway with the acknowledgment *"rare but OK with QQ, AK, AQs in modern frames."* If the line's target is live-pool play (where SB flats 3bets more than solver), this is Category D. Needs explicit labeling.
- **Action:** append to POKER_THEORY.md §9 — proposed entry §9.3: *"`sb-vs-btn-3bp-oop-wet-t98` teaches the SB-flat-3bet pathway. Modern solver: SB plays 3bet-or-fold vs BTN 3bets (barely any flat frequency). Live pool: SB players flat 3bets with medium pairs + Axs + broadways more often than solver recommends, especially at 2/5 and below. The line is intentionally live-pool-targeted. Ships with LSW-F4-A1 acknowledgment copy."*

---

## Accuracy verdict

**YELLOW.** Two P1 findings (schema declaration + AA-as-bluff-catcher framing). Strategy content on all 3 decisions is directionally correct; the errors are in setup declaration and rationale framing, not in the `correct` flag tree. Line is **BLOCKED on LSW-F4** shipping before Stream B widening.

**Also blocked on G4-TD-3** (`archetypeRanges.js` extension for BTN_vs_SB 3bet-caller scenario) before v2 panel can render on this line. G4-TD-3 is a separate prereq for ANY migration of this line to v3, regardless of F4 status.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** [owner pending]
- **Closed:** [pending — tied to LSW-F4 ship decision]

---

## Change log

- 2026-04-22 — Draft (external-validation methodology applied per 2026-04-22 project charter standard).

---

## Sources (web research citations)

- [GTO Wizard — Crush 3-Bet Pots OOP in Cash Games](https://blog.gtowizard.com/crush-3-bet-pots-oop-in-cash-games/)
- [GTO Wizard — C-Betting OOP in 3-Bet Pots](https://blog.gtowizard.com/c-betting-oop-in-3-bet-pots/)
- [GTO Wizard — Mastering Turn Play in 3-Bet Pots OOP](https://blog.gtowizard.com/mastering-turn-play-in-3-bet-pots-oop/)
- [888 Poker — SB vs BB 3bets Strategy](https://www.888poker.com/magazine/sb-vs-bb-3bets-strategy)
- [888 Poker — Defending vs 3bets](https://www.888poker.com/magazine/strategy/defending-versus-3bet-strategy)
- [Upswing — React to Preflop 3-Bets](https://upswingpoker.com/vs-3-bet-pre-flop-position-strategy-revealed/)
- [Upswing — How to Play Pocket Aces](https://upswingpoker.com/how-to-play-pocket-aces/)
- [SplitSuit — Simple Strategy for AA](https://www.splitsuit.com/the-simple-strategy-for-pocket-aces-aa)
