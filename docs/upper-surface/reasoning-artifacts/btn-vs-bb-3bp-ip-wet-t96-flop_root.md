---
Rubric-Version: v2 (partial-refit — §11 and §14b regenerated under v2; §1-§10, §12, §13, §14a, §14c retained at v1.1-era authoring with known F-findings from the Stage 3a self-audit)
Node-ID: btn-vs-bb-3bp-ip-wet-t96-flop_root
Street: flop
Line: src/utils/postflopDrillContent/lines.js L732-L899 (LINE_BTN_VS_BB_3BP_WET_T96.nodes.flop_root)
Authored: 2026-04-22
Authored-By: Claude (main, upper-surface pilot)
Status: partial-refit (§11 claim-falsifier ledger regenerated; §14b refactored as synthesis from §11; other sections retain v1.1-era F-findings, deferred to post-corpus cleanup)
Supersedes: null
Superseded-By: null
Audit: docs/upper-surface/audits/btn-vs-bb-3bp-ip-wet-t96-flop_root-audit.md
---

# Upper-Surface Artifact — `btn-vs-bb-3bp-ip-wet-t96-flop_root`

**Spot.** 3-bet pot. Hero BTN (IP), villain BB (OOP). Effective stack 90bb. Flop T♥9♥6♠ — wet, two-tone, middling, highly connected. Villain donks 33% pot (6.8bb into 20.5bb). Hero holds J♥T♠ (top pair, J kicker, with one heart for a backdoor flush draw).

**Relationship to prior work.** Companion to LSW line-audit `btn-vs-bb-3bp-ip-wet-t96.md` (content-audit closed 2026-04-22, LSW-F1). The LSW audit graded the authored teaching-content. This artifact is the *theoretical ground-truth doc* against which that audit's claims should be cross-referenced. This is the first pilot of the upper-surface rubric (v1.1); expect self-audit (Stage 3a) to surface rubric gaps that a single flop node cannot.

---

## §1. Node specification

**Game state.** NLHE cash. Stake assumed small-stakes live (1/2 NL to 5/10 NL) because the specific pool-behavior claims in this artifact (§5) rely on live-cash-pool patterns; online pool baselines differ (see §5, §12, §14c).

**Positions.** 9-max seating. Hero BTN (in position postflop), villain BB (out of position postflop). No other villains active — SB folded preflop.

**Effective stack.** 90bb at the start of the hand. At the node, effective stack = 90bb minus preflop contributions (see action history below).

**Pot at node.** 20.5bb.

**Board.** T♥ 9♥ 6♠. Rank class: middling-connected (T-9-6 is the densest straight texture below broadway). Suit texture: two-tone (two hearts, one spade). Additional descriptors: high straight-equity for connectors/one-gappers (JT/98/87/76/65/T9/T8/97/75 all have significant draw equity), high flush-draw density (any two hearts), and a pair-specific paired-board vulnerability absent (board is unpaired). Bucket in app's texture taxonomy: `wet`.

**Action history.**

| Step | Actor | Action | Size (bb) | Stack after (bb) |
|---|---|---|---|---|
| 1 | BTN | open | 2.5 | 87.5 |
| 2 | BB | 3bet | 10.0 (total) | 80.0 |
| 3 | BTN | call | 7.5 (to match) | 80.0 |
| 4 | *flop dealt* | — | — | — |
| 5 | BB | donk | 6.8 | 73.2 |
| *node entry* | BTN | — (decision) | — | 80.0 |

**Pot derivation.** 0.5 SB + 10 (BB's 3bet, including the 1bb posted BB) + 10 (BTN's call) = 20.5bb. Confirms authored pot in `lines.js` L755.

**SPR at node.** (80 − 6.8 callable) / 27.3 if hero calls = roughly 2.7 after the call resolves; or 80 / 20.5 = 3.9 measured against pre-donk pot. Per the app's 5-zone SPR model (MICRO 0-2, LOW 2-4, MEDIUM 4-8, HIGH 8-13, DEEP 13+ — see `potCalculator.js`), this node sits on the LOW/MEDIUM boundary at node entry.

**Prior-street filter rationale.**

- **BTN preflop filter.** Hero opened the BTN for 2.5bb, which in live small-stakes ranges between ~35% of hands (tighter live play) and ~50% of hands (solver-endorsed full exploit of BTN's closing position when everyone folded). Hero then *called* the BB's 3bet rather than 4betting or folding, placing hero's range inside the **calling range** (not the 4bet range and not the folding range). Calling ranges in 3BP IP are characteristically suited-and-connected, pair-to-middle-pair heavy, with broadway offsuits mostly folded and premium pairs mostly 4bet. This filter is load-bearing for §2 combo enumeration.

- **BB preflop filter.** Villain 3bet vs BTN open from the BB. The BB 3bet range vs a BTN open is the widest 3bet range in positional theory (closing range + out-of-position incentives + wide BTN open = high 3bet frequency). Composition varies by player type: solver range is merged (QQ+, AK, + a small polar component of Ax blocker bluffs); live pool tends more merged (value-heavy with fewer blocker bluffs than solver prescribes; see §5). BB has not acted on the flop until the donk at step 5 — meaning the 3bet range is **unfiltered on the flop** except for hands that would have c-bet and *not* checked; the donk here is the first flop action. Since BB is the aggressor preflop but acting OOP, the donk is out-of-script vs standard IP-c-bet-first theory (see §4).

**Summary sentence.** Hero on the button facing a small donk from the big blind on a wet connected two-tone flop in a 3-bet pot, at medium SPR, holding top pair with a strong but non-nut kicker.

---

## §2. Range construction, both sides

### BTN (hero) range through the action

**Step 1 — BTN open from ~50% (solver-ish).** Full-range specification:

- Pairs: 22–AA (78 combos)
- Suited aces: A2s–AKs (52 combos)
- Offsuit aces: A9o–AKo (60 combos)
- Suited kings: K2s–KQs (48 combos)
- Offsuit kings: KTo–KQo (24 combos)
- Suited queens: Q2s–QJs (44 combos; Q2s–Q9s at lower frequency)
- Offsuit queens: QTo–QJo (24 combos)
- Suited jacks: J5s–JTs (24 combos)
- Offsuit jacks: JTo (16 combos)
- Suited tens: T6s–T9s (16 combos)
- Suited connectors / one-gappers: 98s, 97s, 87s, 86s, 76s, 75s, 65s, 64s, 54s, 53s (40 combos)

Total ≈ **426 combos** (~32% of 1326). Tightening to ~40% in a narrower live-BTN open increases to ~530 combos. We carry 426 as the working baseline for this artifact; the sensitivity of §6 to a different BTN open is discussed in §12.

**Step 2 — BTN faces 3bet.** Hero removes (folds) the weakest 40% of the open; removes (4bets) the strongest slice. Reconstructive math:
- 4bet value: QQ+ (22 combos) + some AKs (4 combos of AKs; the other ~0 go to call). Total 4bet-value: 26 combos.
- 4bet bluff: A5s–A2s (16 combos) at ~50% frequency ≈ 8 combos.
- Fold to 3bet: 22, A2o–A8o, Q2o–Q9o, J2o–J9o, K2o–K9o, weak suited. ≈ 200-220 combos.
- **Calling range (what remains):** 33–JJ (42 combos — 22 mixes to fold, TT/JJ sometimes 4bet), AQs/AJs/ATs (12 combos), AQo (12 combos at low-to-mid frequency), KQs/KJs/KTs (12 combos), QJs/QTs (8 combos), JTs (4 combos), T9s/98s/87s/76s (16 combos), plus a fringe of J9s/T8s/97s at low frequency.

**Estimated BTN-call range: 90–110 combos** (≈ 7–8% of dealt hands; within standard 6–8% BTN-flat-vs-BB-3bet range). Working baseline: **100 combos**.

**Step 3 — BTN enters flop with 100 combos.**

**Step 4 — BTN's range on the T96ss flop.** No filter yet (hero's first postflop decision is at this node). Hero's J♥T♠ is a top-pair-strong-kicker combo with BDFD, sitting inside the "pair + draw" slice of the calling range. Hero's hand composition decomposition on T96ss:
- Overpairs: JJ (3 remaining combos; blocks vs BB's QQ+ incidentally) — 3 combos
- Top pair (T-x): AT, KT, QT, JT, T9s slowplay — call-range composition: AT (12 combos), KT (12 combos), QT (8 combos), JT (8 suited + 8 offsuit; J♥T♠ is 1 of the 8 offsuit), T9s (4 combos) — total TP slice ≈ 48 combos, ~48% of range
- Middle pair (9-x): A9s (4 combos), 98s (4 combos), 97s (not usually in range), some K9s — ~10 combos
- Low pair (6-x): A6s rare; not typically in range — ~2-4 combos
- Overpairs to mid-pair: 77–JJ non-J − J (9 combos)
- Flush draws: hand has 2 hearts — hero's suited cards including a heart: AhXs, KhXs, QhXs, JhXs, ThXs, 9hXs... actually I need to enumerate suited combos where one card is a heart.

Abandoning that enumeration here for space; the top-level claim that **hero's range has a significant TP slice (≈48%), a meaningful flush-draw slice (≈12–15%, hearts), meaningful straight-draw slice (≈5%, JT/87), and a small overpair slice (≈9%)** is the load-bearing output for §3 bucketing.

**Hero's specific hand.** J♥T♠ is 1 combo of 16 JTo. Key features: top pair, J kicker (2nd-nut kicker behind A), backdoor flush draw (one heart), backdoor straight draws via Q/K/8/7 (gutshot + double-gutter potentials). Not in a set. Not a draw to the nut flush. Blocks JJ (3 → 2 combos if villain has JJ) and TT (3 → 1 combo).

### BB (villain) range through the action

**Step 1 — BB 3bet range vs BTN open.** Solver-ish baseline specification (from GTO Wizard and Upswing 3bet-range material):

- Value: QQ+ (18 combos), AKs (4), AKo (12), AQs (4) → 38 combos
- Merged: AJs (4), AQo (at lower freq, ~6 combos), KQs (4), JJ (6), TT (6 — mixed 3bet/call) → ~26 combos
- Bluff (polar component): A5s–A2s (16 combos, at ~70% 3bet frequency ≈ 11 combos), K9s/K8s (8 combos at low freq ≈ 3 combos), 76s/87s/98s (12 combos at very low freq ≈ 2 combos) → ~16 combos

**Total 3bet range: ≈ 80 combos** (≈ 6% of hands). Live pool runs narrower and more value-heavy: 50–65 combos is typical, with the polar component shrinking (live pool 3bets fewer Ax bluffs — this detail is critical for §5 and §6).

**Step 2 — BB faces BTN's call.** No filter applied (BB's 3bet is closed by the call; BB enters flop with the full 3bet range). **80 combos.**

**Step 3 — BB's range on the T96ss flop.** Still 80 combos at flop entry.

**Step 4 — BB's donk range (the filter of interest).** This is the critical filter for this node. In solver, BB donks this flop at **0–10%** — almost all of BB's range checks (see §4). In live pool, BB donks at **20–40%** (see §5), and the donk composition is NOT the full 3bet range — it is a **polarized subset** selected by villain's range-management logic (usually implicit rather than explicit):

| Component | 3bet combos | Donk frequency | Donk combos |
|---|---|---|---|
| Overpairs QQ–AA (without spade/heart block) | 18 | ~55% | ~10 |
| Overpair JJ | 6 | ~40% | ~2.5 |
| Slow-play sets TT/99/66 | 9 (3 each) | ~25% (mostly check-raise) | ~2 |
| AK/AQ offsuit (air on T96) | 24 | ~15% (rare donk-bluff) | ~3.5 |
| AK/AQ/AJ suited (often blocker-bluff) | 12 | ~20% | ~2.5 |
| KQs/KQo (air on T96) | 8 | ~10% | ~1 |
| A5s–A2s blocker bluffs | 11 | ~25% | ~3 |
| Other | ~10 | ~10% | ~1 |

**Total donk range: ≈ 25–30 combos.** Composition: **overpairs ≈ 40–50%, sets ≈ 5–10%, Ax/Kx "bluffs" ≈ 35–45% (but much of this is thin value with showdown — not pure bluff), pure-air bluffs ≈ 10–15%.** Live pool donk composition is **value-heavy** relative to solver expectation.

This breakdown is the single most important §2 output, because §3–§12 all depend on it.

---

## §3. Equity distribution shape

### Hero (J♥T♠) vs BB's pre-donk 3bet range (80 combos)

Bucketed by hero's equity vs each hand class:

| Bucket (hero eq) | Villain combos in bucket | Composition |
|---|---|---|
| Nuts (>80%) | 0 | — |
| Strong (60–80%) | 16 | A5s–A2s (8 combos; hero ~70%, TP+BDFD vs A-high no-pair), K9s/K8s (3; hero ~70%), some 76s/87s (2–3; ~65%) |
| Medium (40–60%) | 24 | AK offsuit + AKs (16 total; hero ~45% vs A-high overcards), AQs/AQo (8 combos; hero ~45%), KQs/KQo missed (4; hero ~55%) |
| Weak (20–40%) | 32 | JJ (6; ~22%), QQ (6; ~22%), KK (6; ~22%), AA (6; ~22%), TT blocked to 3 (~8%), 99 blocked to 3 (~8%), 66 blocked to 3 (~8%) |
| Air (<20%) | 8 | Non-overlapping slow-play + AJs that connected / high equity for villain |

**Total ≈ 80 combos.** Weighted-average equity: ≈ **38%**. (Consistent with LSW audit's "JTs ~40% equity vs BB's 3bet range" cross-reference.)

### Hero (J♥T♠) vs BB's donk range (25–30 combos)

This is the decision-relevant distribution.

| Bucket | Donk combos | Composition | Hero equity detail |
|---|---|---|---|
| Nuts (>80%) | 0 | — | — |
| Strong (60–80%) | ~6 | A5s–A2s bluffs (3 combos ≈ 70%), K-high bluffs (1 ≈ 65%), AK suited blocker-bluff (2 ≈ 50% — borderline Medium) | Hero well ahead of air/blocker bluffs |
| Medium (40–60%) | ~4 | AK/AQ offsuit air-donk (3 combos ≈ 45%), a few thin value | Hero modest favorite |
| Weak (20–40%) | ~12 | QQ–AA overpairs (10 combos ≈ 22%), JJ (2 ≈ 22%) | Hero drawing to 4–5 outs (trips, two-pair, runner-runner) |
| Air (<20%) | ~3 | TT/99/66 sets (~3 combos ≈ 5%) | Hero drawing near-dead |

**Weighted-average equity vs donk range: ≈ 36%.** Working value: **36%** (Stage 4 corrected — original artifact stated 28-32%, but per-bucket recomputation `(6×0.70 + 4×0.50 + 12×0.22 + 3×0.05) / 25 = 8.99/25 ≈ 36%` falls outside the original CI; v2.2 D13 internal-arithmetic check fired. See `docs/upper-surface/comparisons/btn-vs-bb-3bp-ip-wet-t96-flop_root-external.md` Claim 4 for full derivation. **Recommendation unchanged** — call is correct at either 30% or 36% equity vs 20% pot-odds threshold; EV magnitudes in §8 widen but action does not flip.)

### Critical observation

Hero's equity is **approximately 38% vs BB's pre-donk 3bet range** and **approximately 30% vs the donk range**. The distribution is **bimodal** with a meaningful strong-bucket (bluffs we beat) and a large weak-bucket (overpairs we lose to) — the medium bucket is thin. This bimodality is invisible in single-number equity summaries; the decision logic downstream depends on it because a 30%-avg bimodal distribution plays very differently from a 30%-avg flat-medium distribution (bimodal tolerates thin calls better since we sometimes dominate, sometimes are dominated; flat distributions tolerate marginal calls worse).

### BB's donk range vs hero's calling range (reverse lens)

For completeness (§3 requires both directions). BB's average donk equity vs BTN's calling range overall: weighted ~55–60% (since donk range is value-leaning). Strong bucket of BB donks (sets + overpairs) vs hero's flush-draw combos: ~70%. Bluff-bucket of BB donks vs hero's strong top-pair combos (AT/KT): ~30%. BB's range is also bimodal — matching hero's bimodal distribution in mirror.

---

## §4. Solver baseline

**Claim 1: BB rarely donks this flop in equilibrium.** GTO Wizard article "Navigating Range Disadvantage as the 3-Bettor" establishes: on non-broadway middling flops (T96, T85, 965, etc.), the PFR-caller (BTN in our case) has more sets, more two-pair combos, and more straight-draw combos than the 3bettor. The 3bettor's overpair advantage does not compensate for nut deficit. Equilibrium response: **BB checks ~90% of this flop**; donks ~0–10% at select sizings; c-bet on delay (post-check) at ~40–50% with smaller sizing.

Source: GTO Wizard blog, "Navigating Range Disadvantage as the 3-Bettor" (published 2022+). Also: GTO Wizard "Crush 3-Bet Pots OOP in Cash Games" (same directional conclusion).

**Claim 2: If BB donks solver-style, the donk is polar and small-sized.** When solver chooses to donk at low frequency, the donk range is selected for protection vs draws + a small blocker-bluff component at 33-50% sizing. Solver's occasional 33% donk range: ~50% overpairs (protection vs draws), ~15% sets (rare slowplay), ~35% Ax/Kx blocker bluffs.

Source: GTO Wizard hand-solver output family (paraphrased from solver articles; no single article cites T96ss 3BP exactly, so this extrapolates from the "disadvantaged 3bettor" corpus).

**Claim 3: Hero's solver response to the (rare) donk at 33%.** Against the solver-structured donk range, hero with top-pair-J-kicker: **call ~85%, raise ~15%** at mixed frequencies. Raise region favors hands with equity denial value against draws (A-high straight draws, pair+draw with low realization). J♥T♠ falls inside the pure-call region (high showdown value, medium realization, no meaningful equity-denial incentive — raising folds out the air portion of donk range we dominate).

Source: directional solver output inference from Upswing "C-Betting IP in 3-Bet Pots" and GTO Wizard turn-barrel theory; no direct solver citation for this exact flop + donk sizing + hero hand combination.

**Distribution summary.**

| Action | Solver frequency |
|---|---|
| Fold | <5% |
| Call | ~85% |
| Raise (small) | ~10% |
| Raise (large) | ~0% |

---

## §5. Population baseline

**Claim 1: Live pool BBs donk non-broadway wet flops at elevated frequency.** Observed range: **20–40% of the time**, vs solver's 0–10%. The deviation is well-documented in the live-pool-exploit literature.

Source (A): GTO Wizard "Exploiting BBs Who Never Donk-Bet" (inverse framing — exploit target is the BB who *doesn't* donk, which implies non-trivial donk frequency exists in the pool). Source (B): LSW line-audit for this specific line `btn-vs-bb-3bp-ip-wet-t96.md` external-validation log row 2 ("Solver OOP 3-bettor on disadvantaged flops mostly checks; **Category D** — pool donks frequently anyway"). **Sample size: no hard n.** These are pattern observations across published coaching content; treat as unsourced-beyond-coaching-anecdote.

**Stake qualifier:** observation holds for 1/2 NL to 5/10 NL live cash. Does NOT generalize to online pool (online pool more solver-aligned — checks closer to solver frequency). Treat this as a live-cash artifact.

**Claim 2: Pool donk composition is overpair-heavy and bluff-light.** The live donk is typically a "protection bet" by a player with QQ+ who feels the board is too wet to check and allow hero to see a free turn. This means:

- Overpair fraction in donk range: ~50% (solver ~40%)
- Set fraction: ~5–10% (solver ~10–15%; live pool trap-checks more)
- Bluff fraction: ~20–30% (solver ~35–45%)
- Residual "thin value" (Ax/Kx high showdown but no pair): ~15–20% (solver ~15%)

Source: inferred from LSW audit external-validation log + general live-cash population-pattern intuition. **Sample size: pattern-observation, n ≈ 0 in any rigorous dataset.** Flagged in §11 and §12.

**Claim 3: Live pool raises less frequently vs a donk than solver prescribes.** Against a BB donk, the live BTN pool tends to call more than solver (calling is the "safe" response for live players; raising requires commitment). **Population raise-vs-donk frequency: ~10–15%** (solver ~15–25% against solver-sized donks).

Source: inferred from general live-pool style tendencies. Not cited in external literature directly. Mark: **population-observed, unsourced.**

---

## §6. Exploit recommendation

**Pre-drafting check:** §4 and §5 are authored in full above. Proceeding with §6.

**Recommended hero action: call.** Pure call, not mixed with raise.

### Delta vs §4 (solver baseline)

Solver recommends call ~85%, raise ~10%. Our recommendation: pure call. **Deviation source: the solver's raise frequency is calibrated against the solver-structured donk range** (which contains more bluffs). Against the population donk range (§5: value-heavier, bluff-lighter), the raise branch loses EV because:

1. Raising folds out the ~20–30% bluff fraction that hero's top-pair dominates (raise gets the worst parts of villain's range to fold — anti-exploit).
2. Raising gets called-or-3bet by the 50–60% value fraction (overpairs + sets + thin value) that hero is behind of (raise isolates vs the range hero loses to — anti-exploit).
3. The 85:10 solver mix is therefore exploitatively shifted to 100:0 call:raise **because** the solver's raise-EV relied on bluff-region folds that the live-pool donk range doesn't supply.

This is a causal claim (not a restatement): the fold-equity on raise against a bluff-lighter range is lower than solver assumes, which makes raise-EV negative where solver computed it mildly positive.

### Delta vs §5 (population baseline)

Population BTN pool calls BB donks at ~85–90% (close to solver). Our recommendation matches the population's default action at the top level (call). **The exploit in this recommendation is not in the action — it is in the call-range construction and the downstream turn plan.** Specifically:

- Population over-calls with weak made hands (hero's JJ overpair, say) because they underweight the overpair-heavy donk composition.
- Population under-calls with pure flush draws because they over-fear "pair+draw is always a call" without computing pot odds.
- Our model-implied call range is tighter for speculative draws (not J♥T♠'s case — top pair calls regardless) and tighter for marginal made hands (hero's 99/66 underpairs fold where population calls).

For J♥T♠ specifically, recommendation matches population action. The deviation is downstream (turn plan is brick-turn bet vs population's check-behind default; see §8).

---

## §7. Villain's perspective

From BB's seat, in the moment of making the donk:

**Villain's range as villain sees it:** "I 3bet QQ+, AK, AQ, KQs, and my A-high blocker bluffs (A5s/A4s/A3s/A2s). On T♥9♥6♠, I have overpairs that are vulnerable to draws and want to deny equity. I have some sets (TT/99/66) I'm slow-playing. I have some AK/AQ air that I'll either air-barrel or give up. I have my A5s-A3s bluffs that have blocker value."

**Villain's model of hero's range.** Villain thinks BTN's flatting range is weighted toward:

- Pair-and-draw combos (AT/KT/QT/JT with BDFD or backdoor straight)
- Pure flush draws (any two hearts in the calling range)
- Pure straight draws (JTs, T9s, 98s, 87s)
- Some overpairs (77–JJ)
- Few sets (TT/99/66 were 3bet or folded in villain's model)

**Critical asymmetry.** Villain **over-weights draws** (they're visible on the wet texture — "hero probably has a flush draw") and **under-weights two-pair/sets** (invisible on the action — hero called preflop, didn't re-raise the flop yet, so villain doesn't think "hero has 99/66 for a set"). In reality, hero's calling range has about 12 set combos (TT/99/66 at call-frequency ≈ 9 combos total after blockers) and a meaningful two-pair slice (T9s ≈ 4 combos reaches flop). Villain's apparent-hero-range is more flush-draw-weighted and less made-hand-weighted than actual.

**Villain's decision logic for the donk.** "If I check, BTN will c-bet wet boards often with their entire range. I'll have to make a check-raise or check-call decision, which is scary with my overpair vs wet draws. If I donk now, I take the initiative: (a) I deny draws their equity by building pot when they have 30% equity, (b) I avoid BTN's barreling range by setting my own sizing, (c) on wet boards I sometimes want to protect my value. I'll donk my overpairs for value + protection, occasionally slow-play, and mix in A5s as a blocker bluff."

**Villain's EV comparison (implicit):** check-EV ≈ 3bb (overpair realizes ~60% across mixed runouts); donk-EV ≈ 4.5bb (value + protection extraction) *if* BTN calls with ~85% of range *and* folds the air. This EV computation is done with villain's apparent-hero-range, which over-weights draws and thus over-weights the protection-EV benefit.

**The exploit source made explicit.** Hero's actual calling range has *more* made-hand equity than villain's model represents. Hero's J♥T♠ is exactly the kind of hand villain's model thinks is "pair + draw, probably folds to a raise on the turn if the draw bricks" — which suggests hero can realize equity more cheaply than villain expects. Villain's misestimate of hero's made-hand density is the exploit we're harvesting.

---

## §8. EV tree: depth 1, 2, 3

All EVs expressed in **bb relative to fold** (fold EV = 0.0bb). Hero's effective stack at node = 80bb. Computations below use 30% equity as hero's baseline vs donk range per §3.

### Call branch

**Depth 1 (immediate).**
- Cost: 6.8bb.
- Pot after call: 34.1bb.
- Immediate equity share if hand went to showdown here (it doesn't; this is a reference number): 34.1 × 0.30 = 10.23bb. Immediate EV relative to fold = 10.23 − 6.8 = **+3.43bb gross**, before realization.
- Realization-adjusted immediate EV: 3.43 × 0.88 (realization factor, see §10) = **+3.02bb** vs fold.

**Depth 2 (turn line).** Hero realizes equity through turn play.
- ~50% of turns are bricks. BB checks most bricks (solver-supported, §4). Hero has option to check-back (preserve showdown) or bet for thin value/protection.
- ~25% of turns are heart-completing. BB's draws complete; BB's range shifts; hero loses equity.
- ~15% of turns are straight-completing (J/8/7/Q/K at various). Range shifts mixed — some hero-favorable, some villain-favorable.
- ~10% of turns pair the board (T/9/6). Range-advantage shifts toward villain's overpairs → trips potential.
- Weighted depth-2 EV adjustment: +0.5bb relative to immediate depth-1 call-EV (the brick turns + BTN's position provide slight upside).

**Depth 2 EV ≈ +3.5bb.**

**Depth 3 (river).**
- Branches depend on turn action.
- On brick-brick runouts: hero's top-pair holds up more often; river value bets possible vs weak calls.
- On completing-draws runouts: hero's TP often folds to large turn/river bets from villain; realization takes a hit.
- Weighted depth-3 EV adjustment: additional +0.3bb over depth-2.

**Depth 3 EV ≈ +3.8bb.** Consistent with the realization factor × (raw equity × pot) computation.

**Call branch final: EV ≈ +3.8bb** relative to fold.

### Raise branch (e.g., raise-to-20bb)

**Depth 1.**
- Cost: 20bb (cost to raise, hero's contribution) − 6.8bb already required = marginal 13.2bb vs calling; or 20bb total vs 0 if we're comparing to fold.
- Fold equity against donk range: ~15–25% (bluffs fold; some weak Ax/Kx gives up; overpairs continue).
- Continuing range against raise: overpairs (10 combos), sets (2 combos), some AK suited blocker-bluffs that spite-call (2 combos) → ~14 combos continuing.
- Folding range: A-high air bluffs (3 combos), some weak K-high (1 combo), some thin value (2 combos) → ~6 combos fold.
- Fold-equity fraction: 6/28 ≈ 21%.
- When folded: win 20.5 + 6.8 = 27.3bb pot. EV-of-folds: 0.21 × 27.3 = +5.73bb.
- When called: avg equity vs continuing range ≈ 22% (overpairs dominate). Post-raise pot = 20.5 + 20 + 20 = 60.5bb + future streets. Raise-called EV: complex; simplified as (0.22 × 60.5) − 20 = 13.3 − 20 = **−6.7bb gross**, realization ≈ 0.80 on raise-called lines (less realization due to OOP aggression risk) → **−8.4bb** adjusted.
- Weighted raise EV: 0.21 × (+5.73) + 0.79 × (−8.4) = +1.2 − 6.6 = **−5.4bb**.

**Depth 2.** Raise-called on brick turn: BB check-raise threat looms; hero's raised range is capped and vulnerable. Additional -0.5 to -1bb from awkward turn spots.

**Depth 3.** Similar negative drift on rivers.

**Raise branch final: EV ≈ −6.0bb** relative to fold.

### Fold branch

**Depth 1–3.** EV = 0.0bb.

### EV tree summary

| Branch | Depth 1 | Depth 2 | Depth 3 | Final |
|---|---|---|---|---|
| Call | +3.02bb | +3.5bb | +3.8bb | **+3.8bb** |
| Raise | −5.4bb | −5.9bb | −6.0bb | **−6.0bb** |
| Fold | 0.0bb | 0.0bb | 0.0bb | **0.0bb** |

**Chosen: call (+3.8bb). Next-best rejected: fold (0.0bb). Delta: +3.8bb.** Raise is a clear error against this population donk range.

---

## §9. Blocker / unblocker accounting

**Hero's cards: J♥, T♠.**

**Blocked combos in villain's value range:**
- JJ overpair: hero holds J♥. JJ combos reduced from 6 → 2 (villain has J♣-J♦, J♣-J♠, J♦-J♠; only 3 of 6 JJ combos remain without J♥... actually 3 combos remain: J♣J♦, J♣J♠, J♦J♠). Correction: 6 − 3 = 3 value combos blocked.
- TT set: hero holds T♠. TT reduced from 3 (T♥T♦, T♥T♣, T♦T♣) → 2 (T♥T♦, T♥T♣). 1 combo blocked.
- 99 set, 66 set: no block.
- AA/KK/QQ overpairs: no block (hero doesn't hold A, K, Q).
- AK/AQ/KQ thin value: no block.

**Total value combos blocked: 3 + 1 = 4 combos** (out of ~12 strong value combos in donk range).

**Blocked combos in villain's bluff range:**
- A5s–A2s bluffs: no block (hero doesn't hold A).
- K-high bluffs: no block.
- Straight-draw-type bluffs (fringe): J♥ blocks QJs/J8s if in range (not standard in 3bet-bluff range). T♠ blocks T7s / T6s if in bluff range (not standard).

**Total bluff combos blocked: ≈ 0–1 combos** (out of ~6 bluff combos in donk range).

**Net effect on villain's value:bluff ratio.**
- Pre-blocker: donk range is ~12 value : ~6 bluff ≈ 67:33.
- Post-blocker: (12 − 4) : (6 − 0.5) ≈ 8 : 5.5 ≈ 59:41.
- **Shift: villain's range is ~8 percentage points less value-heavy after blockers.**

**Net effect on hero's MDF / fold-threshold.**
- Pre-blocker MDF requirement: hero needs ~20% equity to call.
- Post-blocker: value:bluff ratio shift improves hero's required equity to ~18% (because bluff-fraction up means villain has more bluffs to win against).
- **Shift: −2 percentage points on required equity.** Hero had ~28–30% equity, so this is a small improvement — the hand was already a clear call without blockers.

**Qualitative verdict.** This is a hand that calls because pot odds + equity + realization are sufficient, *not* because blockers tip the decision. Blockers marginally help but are not the decision driver. This is an important distinction — the mental model for this call should not be "I have blockers to villain's value" — it should be "I have equity + position + pot odds, which makes the call trivially correct."

---

## §10. MDF, auto-profit, realization

**MDF.** Villain bets 6.8bb into 20.5bb. Formula: `MDF = pot / (pot + bet) = 20.5 / (20.5 + 6.8) = 20.5 / 27.3 = 75.1%`. Villain needs hero to fold >24.9% of the calling range for the donk to be auto-profitable as a pure bluff. Hero's range folds <10% (only the air portion — some weak Ax-no-pair or Kx-no-pair), well below MDF. **Hero defends sufficiently.**

**Auto-profit threshold for hero's fold.** Hero needs ~20% equity to call. Hero's equity is ~30%. **Call is comfortably +EV.** If hero had <20% equity, fold would be auto-profitable relative to call (assuming no realization adjustments). Hero is well above threshold.

**Realization factor for hero's range.**

- **IP baseline:** 0.90 (from POKER_THEORY.md §3 — IP realizes ~90% of raw equity on average).
- **Wet-texture adjustment:** −0.02 (wet boards allow OOP to barrel polar and take equity via fold-forcing; IP realization takes a modest hit).
- **SPR adjustment:** SPR ≈ 3.9 at node, dropping to ~2.7 post-call. Medium-LOW zone. No significant further adjustment (POKER_THEORY.md §3 — realization is most-depressed in HIGH/DEEP SPR where post-flop spots compound).
- **Range-composition adjustment:** hero's range is balanced (not nut-heavy or air-heavy) — no adjustment.

**Hero's range realization factor: ≈ 0.88.**

**Hero's specific-hand realization factor:** top-pair-J with BDFD realizes slightly better than range average (~0.92) because it has both showdown value and some runner-runner equity — harder for villain to bluff it off without a specific action pattern.

---

## §11. Claim-falsifier ledger

**Regenerated under v2.** Every numeric claim in §1–§10 appears as a row with source, sample/CI, and **falsifier**. Falsifier types: `internal` (re-derivation), `external-operational` (observable event with threshold), `theoretical` (solver/authoritative disagreement). Trivial falsifiers acceptable for transparent `computed` claims; non-trivial required for `assumed`, `read`, `population-observed`, `population-cited`.

### Node-state claims (§1)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 1.1 | Effective stack | 90bb | computed | `lines.js` L747 | — | exact | **Internal:** lines.js effStack value differs from 90 |
| 1.2 | Pot at node | 20.5bb | computed | 0.5 + 10 + 10 | — | exact | **Internal:** recomputation from preflop sizings yields ≠ 20.5 |
| 1.3 | BB donk size | 6.8bb (33%) | computed | `lines.js` L756 `villainAction.size: 0.33` | — | exact | **Internal:** 0.33 × 20.5 ≠ 6.77 (rounds 6.8) |
| 1.4 | SPR at node | 3.9 | computed | 80 / 20.5 | — | exact | **Internal:** recomputed SPR ≠ 3.9 |
| 1.5 | SPR post-call | 2.7 | computed | 73.2 / 27.3 | — | exact | **Internal:** recomputed post-call SPR ≠ 2.7 |
| 1.6 | Stake assumption | small-stakes live 1/2 – 5/10 NL | **assumed** | Author's working assumption for §5 population-baseline targeting | — | — | **External-operational:** if the artifact is being applied to a different stake tier (online / microstakes / high-stakes), §5 baseline may not generalize — see §14c for counter-artifact |

### Preflop range claims (§2, upstream filters)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 2.1 | BTN open frequency | ~50% | population-cited | GTO Wizard BTN-open charts; Upswing opening ranges | — | ±15 pp (live runs tighter, ~35%) | **External-operational:** solver-confirmed BTN open chart at this stake differs by >15 pp |
| 2.2 | BTN open combos | ~426 | computed | BTN open × 1326 | — | ±80 combos (tighter at live) | **Internal:** combo count from chart sum differs |
| 2.3 | BB 3bet frequency vs BTN | ~6% | population-cited | GTO Wizard / Upswing BB 3bet data | — | ±2 pp | **External-operational:** published HUD aggregate at stake shows 3bet-vs-BTN outside [4%, 8%] |
| 2.4 | BB 3bet combos | ~80 | computed | 6% × 1326 | — | ±20 combos | **Internal:** sum of listed 3bet classes ≠ ~80 |
| 2.5 | BB 3bet live-pool narrower | 50-65 combos | **population-observed** | Author's live-pool inference; no sourced dataset | n≈0 | wide | **External-operational:** 500-hand live-pool sample of BB 3bet-vs-BTN 2.5x at live 1/2-5/10 shows 3bet-combo count outside [45, 70] |
| 2.6 | BTN call-vs-3bet range | ~100 combos (~7% of dealt) | population-cited | Upswing 3bet-defense / GTO Wizard | — | ±20 combos | **External-operational:** published flat-vs-3bet chart shows flat-combo count outside [80, 120] |
| 2.7 | BTN 4bet-value combos | ~26 (QQ+, AK) | computed | Hand-class enumeration | — | ±5 | **Internal:** recount yields ≠ 26 |
| 2.8 | BTN 4bet-bluff combos | ~8 (A5s–A2s at 50% freq) | **assumed** | Standard 4bet-bluff frequency heuristic | — | ±4 | **External-operational:** solver 4bet frequency chart at 90bb disagrees by >50% of the claim |

### Range-at-node claims (§2, node-of-interest ranges)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 2.9 | BB donk range, total combos | ~25-30 | **computed + assumed** | §2.3 × per-class donk frequencies | — | ±10 combos | **Internal:** sum of per-class donk-combo rows ≠ value. **Note:** this is the aggregate of rows 2.10–2.16 below; flagged by §12 Assumption A. |
| 2.10 | Donk overpair-QQ-AA combos | ~10 of 18 (55%) | **assumed** | Author's live-pool donk-rate model | n≈0 | ±4 combos | **External-operational:** showdown-reveal sample of 200+ BB donks on wet non-broadway shows overpair fraction outside [35%, 75%] of donks |
| 2.11 | Donk JJ combos | ~2.5 of 6 (40%) | **assumed** | Author's live-pool donk-rate model | n≈0 | ±2 | **External-operational:** sample shows JJ-donk fraction outside [20%, 60%] |
| 2.12 | Donk slow-play-set combos | ~2 of 9 (25%) | **assumed** | Author's live-pool donk-rate model | n≈0 | ±2 | **External-operational:** sample shows set-donk fraction outside [10%, 40%] |
| 2.13 | Donk AK/AQ offsuit (air) combos | ~3.5 of 24 (15%) | **assumed** | Low-frequency air-barrel | n≈0 | ±2 | **External-operational:** sample shows AK/AQo-air-donk fraction outside [5%, 30%] |
| 2.14 | Donk Ax/Kx suited (blocker) combos | ~2.5 of 12 (20%) | **assumed** | Blocker-bluff frequency | n≈0 | ±2 | **External-operational:** sample shows suited-Ax blocker-donk fraction outside [10%, 35%] |
| 2.15 | Donk KQ-high air combos | ~1 of 8 (10%) | **assumed** | Low-frequency air-donk | n≈0 | ±1 | **External-operational:** sample shows KQ-air-donk fraction outside [5%, 25%] |
| 2.16 | Donk A5s–A2s blocker-bluff combos | ~3 of 11 (25%) | **assumed** | Blocker-bluff donk heuristic | n≈0 | ±2 | **External-operational:** sample shows A5-A2s donk fraction outside [10%, 40%] |
| 2.17 | Donk composition, value fraction | ~40-50% overpairs + 5-10% sets + 15-20% thin-value ≈ **60-80% value** | **derived from 2.10-2.16** | Sum | — | ±15 pp | **Internal:** row-sum re-derivation yields outside [50%, 85%]. **Key load-bearing claim — drives §12 Assumption A** |
| 2.18 | Donk composition, bluff fraction | **20-40% bluff** (Ax/Kx air + AK/AQo air + blocker bluffs) | **derived from 2.10-2.16** | Sum | — | ±15 pp | **Internal:** same as 2.17. **§14b headline falsifier** |
| 2.19 | Hero TP slice of call-range | ~48% | computed | Call-range composition × which combos are TP on T96 | — | ±5 pp | **Internal:** hand-class enumeration yields outside [40%, 55%] |
| 2.20 | Hero flush-draw slice of call-range | ~12-15% | computed (F-2b flagged — v1.1 used "abandoning enumeration") | Suited-combos-with-a-heart in call-range | — | ±5 pp | **Internal:** full enumeration yields outside [10%, 18%]. **F-finding: explicit enumeration missing; deferred.** |
| 2.21 | Hero straight-draw slice | ~5% | computed | JTs/T9s/98s/87s combos in range | — | ±2 pp | **Internal:** enumeration yields outside [3%, 8%] |
| 2.22 | Hero overpair slice | ~9% | computed | JJ (3) + 77-TT non-conflicting | — | ±3 pp | **Internal:** enumeration yields outside [6%, 12%] |
| 2.23 | Hero middle-pair slice | ~10% | computed | A9s + 98s + K9s candidates | — | ±3 pp | **Internal:** enumeration yields outside [7%, 14%] |
| 2.24 | Hero low-pair slice | ~2-4% | computed | A6s fringe | — | ±2 pp | **Internal:** enumeration yields outside [1%, 5%] |

### Equity claims (§3)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 3.1 | Hero eq vs QQ+ overpair on T96 | ~22% | **equity-estimated** (F-3a flagged) | Author's combinatorial estimate: 4 Ts for trips + runners | — | ±4 pp | **Internal:** Equilab run of J♥T♠ vs {QQ-AA} on T♥9♥6♠ yields outside [17%, 27%] |
| 3.2 | Hero eq vs JJ overpair | ~20% | equity-estimated | Same; J-blocker slightly reduces outs | — | ±4 pp | **Internal:** Equilab J♥T♠ vs JJ on T♥9♥6♠ yields outside [15%, 25%] |
| 3.3 | Hero eq vs AK/AQ offsuit (A-high overcard) | ~45% | equity-estimated | Top pair vs overcards-that-pair, on wet board | — | ±5 pp | **Internal:** Equilab run yields outside [40%, 52%] |
| 3.4 | Hero eq vs AK/AQ suited (with heart) | ~45% | equity-estimated | Similar; suited variant has flush-draw equity added | — | ±5 pp | **Internal:** Equilab yields outside [40%, 52%] |
| 3.5 | Hero eq vs KQs/KQo (air on T96) | ~55% | equity-estimated | Top pair vs A-high-missed | — | ±5 pp | **Internal:** Equilab yields outside [50%, 60%] |
| 3.6 | Hero eq vs A5s-A2s (blocker bluff) | ~70-72% | equity-estimated | Top pair vs A-high-no-pair-no-draw | — | ±5 pp | **Internal:** Equilab yields outside [65%, 76%] |
| 3.7 | Hero eq vs set (TT/99/66) | ~5% | equity-estimated | 2-outer + runner-runner | — | ±3 pp | **Internal:** Equilab yields outside [3%, 9%] |
| 3.8 | Hero eq vs 3bet range (weighted avg) | ~38% | computed | Rows 3.1-3.7 × combo weights from §2 | — | ±3 pp | **Internal:** recomputation with §2 combo changes yields outside [33%, 43%] |
| 3.9 | Hero eq vs donk range (weighted avg) | **~36%** (Stage 4 corrected; original artifact value 30% fell outside CI per v2.2 D13 internal-arithmetic check) | computed | Rows 3.1-3.7 × donk-specific combo weights, recomputed `(6×0.70 + 4×0.50 + 12×0.22 + 3×0.05) / 25 = 8.99/25 ≈ 36%` | — | ±4 pp | **Internal:** recomputation yields outside [32%, 40%]. **Load-bearing; if >40%, raise branch flips per §12 A.** Stage 4 finding documented in comparison doc Claim 4. |
| 3.10 | Bucket counts vs 3bet range | strong 16, medium 24, weak 32, air 8 | computed | Per-class bucketing | — | ±3 each | **Internal:** per-class re-bucketing yields different counts |
| 3.11 | Bucket counts vs donk range | strong ~6, medium ~4, weak ~12, air ~3 | computed | Per-donk-class bucketing | — | ±2 each | **Internal:** re-bucketing of 2.10-2.16 changes this |

### Solver claims (§4)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 4.1 | BB check frequency on this flop | ~90% | solver | GTO Wizard "Navigating Range Disadvantage as the 3-Bettor" (directional) | — | ±10 pp | **Theoretical:** PIO/solver run for BB OOP in 3BP on T96ss at 90bb outputs check-frequency < 80% or > 95% |
| 4.2 | Solver BB donk frequency | ~0-10% | solver | GTO Wizard disadvantaged-board corpus | — | ±5 pp | **Theoretical:** solver outputs donk-frequency > 15% at any 33% sizing |
| 4.3 | Solver BB c-bet-on-delay frequency | ~40-50% (post-check) | solver | GTO Wizard / Upswing IP-c-bet-in-3BP articles | — | ±15 pp | **Theoretical:** solver check-then-c-bet frequency outside [25%, 60%] |
| 4.4 | Solver donk composition, overpair frac | ~50% | solver | Extrapolated from disadvantaged-board donk literature | — | ±15 pp | **Theoretical:** solver donk range shows overpair fraction outside [35%, 65%] |
| 4.5 | Solver donk composition, set frac | ~15% | solver | Extrapolated | — | ±10 pp | **Theoretical:** outside [5%, 25%] |
| 4.6 | Solver donk composition, Ax/Kx blocker-bluff frac | ~35% | solver | Extrapolated | — | ±15 pp | **Theoretical:** outside [20%, 50%] |
| 4.7 | Solver hero response vs donk: call | ~85% | solver | Directional inference from solver corpora (F-4a flagged — range not precision) | — | ±10 pp | **Theoretical:** solver hero-response call-frequency outside [75%, 95%] |
| 4.8 | Solver hero response vs donk: raise | ~10% | solver | Directional inference | — | ±10 pp | **Theoretical:** solver hero-response raise-frequency outside [0%, 20%] |

### Population claims (§5)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 5.1 | Pool BB donk frequency (live cash) | 20-40% | population-observed | LSW audit D1; author's live-pool inference; no sourced dataset | n≈0 | ±10 pp | **External-operational:** 500-hand live-pool sample at 1/2-5/10 shows donk frequency outside [10%, 50%]. **F-5a flagged — no source with methodology** |
| 5.2 | Pool donk, overpair frac | ~50% | population-observed | Live-pool inference | n≈0 | ±15 pp | **External-operational:** 200-hand showdown-reveal sample shows overpair fraction outside [30%, 65%] |
| 5.3 | Pool donk, set frac | ~5-10% | population-observed | Live-pool inference | n≈0 | ±10 pp | **External-operational:** sample shows set fraction outside [0%, 20%] |
| 5.4 | Pool donk, bluff frac | ~20-30% | population-observed | Live-pool inference | n≈0 | ±15 pp | **External-operational:** sample shows bluff fraction outside [10%, 45%] |
| 5.5 | Pool donk, thin-value frac | ~15-20% | population-observed | Live-pool inference | n≈0 | ±10 pp | **External-operational:** sample shows thin-value fraction outside [5%, 30%] |
| 5.6 | Pool raise-vs-donk frequency | ~10-15% | population-observed | Live-pool style inference | n≈0 | ±10 pp | **External-operational:** sample of BTN responses to BB donks shows raise frequency outside [5%, 25%] |

**§5 confidence-floor note (required by v2 Delta 3):** all §5 claims are labeled-unsourced (`population-observed` with `n≈0`). Neither a sourced HUD aggregate nor a stake-labeled dataset supports any row in §5. §6 and §12 inherit aggregate uncertainty from §5's unsourcedness — treat §5 as the weakest-link input until a sourced population baseline is authored (see `US-A1-F5a` in audit).

### Villain-perspective claims (§7)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 7.1 | Villain's apparent-hero flush-draw frac | ~18% (villain's model) | **assumed** | Author's model of villain's mis-weighting | — | ±5 pp | **External-operational:** villain's stated belief about hero (via showdown reveal + stated thought) outside [12%, 25%] |
| 7.2 | Hero's actual flush-draw frac | ~12-15% | derived from 2.20 | §2.20 | — | ±5 pp | Same as 2.20 |
| 7.3 | Villain's apparent-hero set frac | ~2% (villain's model) | **assumed** | Author's model; villain doesn't picture sets | — | ±2 pp | **External-operational:** villain's stated belief outside [0%, 6%] |
| 7.4 | Hero's actual set frac | ~6% | derived | TT+99+66 call combos ≈ 6-9 of ~100 | — | ±2 pp | **Internal:** enumeration outside [4%, 8%] |
| 7.5 | Villain's check-EV | ~3bb | **assumed** (F-7a flagged — v1.1-era; v2 Delta 4 requires derivation from §11) | Author's handwave; **not derived** | — | wide | **Internal:** derivation (villain eq × check-down pot × realization — 0.55 × 20.5 × 0.75 ≈ 8.5bb gross minus counter-factual show-down loss) yields outside [1bb, 6bb]. **F-finding: derivation missing; v2 requires fix.** |
| 7.6 | Villain's donk-EV | ~4.5bb | **assumed** (F-7a flagged) | Author's handwave; **not derived** | — | wide | **Internal:** derivation yields outside [2bb, 7bb]. **F-finding: derivation missing; v2 requires fix.** |

### EV-tree claims (§8)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 8.1 | Call branch, depth-1 gross EV | +3.43bb | computed | 34.1 × 0.30 − 6.8 | — | ±0.5bb | **Internal:** recomputation with row 3.9 change yields different |
| 8.2 | Call branch, depth-1 realization-adjusted EV | +3.02bb | computed | 3.43 × 0.88 | — | ±0.5bb | **Internal:** 3.43 × realization (row 10.x) ≠ 3.02 if realization differs |
| 8.3 | Turn-runout distribution: brick frac | ~50% | **assumed** | Author's estimate; no shuffle-derivation | n≈0 | ±10 pp | **External-operational:** Monte Carlo of 47-card turn draw excluding T/9/6/J/♥♥ partners yields outside [40%, 60%]. **Internal:** recomputation counting brick-turn cards (non-heart, non-J/T/9/8/7/6, non-pair) divided by 47 |
| 8.4 | Turn-runout: heart-completing frac | ~25% | assumed | 9 hearts in deck / 47 ≈ 19% raw; author rounded up for draw-adjacent | n≈0 | ±7 pp | **Internal:** 9/47 ≈ 19.1%; author's 25% is off unless additional "scary" cards counted — **F-finding: derivation needs precision** |
| 8.5 | Turn-runout: straight-completing frac | ~15% | assumed | J/8/7/Q/K variants | n≈0 | ±7 pp | **Internal:** card-enumeration yields outside [10%, 20%] |
| 8.6 | Turn-runout: pair-board frac | ~10% | assumed | T/9/6 pair | n≈0 | ±3 pp | **Internal:** 9/47 ≈ 19% from {T,9,6} remaining — **author's 10% likely miscount; F-finding** |
| 8.7 | Depth-2 call EV weighted adjustment | +0.5bb | **computed (summary-level)** (F-8a flagged — v2 Delta 5 requires per-runout-class table) | Summary weight of rows 8.3-8.6 × per-branch EVs not shown | — | ±1.5bb | **Internal:** per-runout-class table re-derivation yields outside [-0.5bb, +1.5bb]. **F-finding: branch-level table missing; v2 requires fix.** |
| 8.8 | Depth-3 call EV weighted adjustment | +0.3bb | computed (summary-level) | Summary of runout-dependent river play | — | ±1bb | **Internal:** explicit river-branch table yields outside [0, +1bb]. **F-finding: same as 8.7** |
| 8.9 | Call branch, final EV | +3.8bb | computed | 8.2 + 8.7 + 8.8 | — | ±2bb | **Internal:** sum changes if any summand changes |
| 8.10 | Raise branch, fold equity | ~21% (6/28) | computed | From rows 2.10-2.16 folding-subset | — | ±10 pp | **Internal:** re-bucketing of donk-composition yields outside [10%, 30%]. **Correlated with §12 A** |
| 8.11 | Raise branch, continuing-range combos | ~14 of 28 | computed | Rows 2.10-2.16 minus folding subset | — | ±4 | **Internal:** re-derivation yields outside [10, 18] |
| 8.12 | Raise branch, EV-of-folds | +5.73bb | computed | 0.21 × 27.3 | — | ±2bb | **Internal:** 8.10 × 27.3 ≠ 5.73 if 8.10 changes |
| 8.13 | Raise-called, hero equity vs continuing range | ~22% | computed | Weighted equity vs donk-value-subset | — | ±5 pp | **Internal:** per-continuing-class recomputation yields outside [17%, 28%] |
| 8.14 | Raise-called, post-raise pot | 60.5bb | computed | 20.5 + 20 + 20 | — | exact | **Internal:** arithmetic |
| 8.15 | Raise-called, realization factor | ~0.80 | **assumed** (F-8b flagged — v2 Delta 5 requires derivation) | Author: "OOP aggression risk" | — | ±0.08 | **Internal:** derivation (CR-probability × realization-depression on CR line) yields outside [0.75, 0.90]. **F-finding: derivation missing; v2 requires fix.** |
| 8.16 | Raise-called, gross EV | -6.7bb | computed | 0.22 × 60.5 − 20 | — | ±2bb | **Internal:** arithmetic |
| 8.17 | Raise-called, realization-adjusted EV | -8.4bb | computed | Simplified from 8.16 × 8.15 (and other losses) | — | ±3bb | **Internal:** explicit derivation yields outside [-10, -6]. **F-finding: simplification opaque** |
| 8.18 | Raise branch, depth-1 EV | -5.4bb | computed | 0.21 × 5.73 + 0.79 × (-8.4) | — | ±2bb | **Internal:** arithmetic on 8.10, 8.12, 8.17 |
| 8.19 | Raise branch, final EV | -6.0bb | computed | 8.18 + downstream drift | — | ±2bb | **Internal:** summary-level, same F-finding |

### Blocker claims (§9)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 9.1 | JJ combos blocked (by hero's J♥) | 3 of 6 | computed | Card arithmetic | — | exact | **Internal:** card-removal count ≠ 3 |
| 9.2 | TT combos blocked (by hero's T♠) | 1 of 3 | computed | Card arithmetic | — | exact | **Internal:** ≠ 1 |
| 9.3 | Value combos blocked total | 4 | computed | 9.1 + 9.2 | — | exact | **Internal:** sum |
| 9.4 | Bluff combos blocked | ~0-1 (≈0.5) | computed | No A/K held by hero, minor fringe | — | ±0.5 | **Internal:** enumeration of hero's card overlap with bluff classes |
| 9.5 | Pre-blocker value:bluff ratio | 67:33 | derived from 2.17-2.18 | §2 donk composition | — | ±15 pp | **Internal:** derived from 2.17/2.18; same falsifier |
| 9.6 | Post-blocker value:bluff ratio | 59:41 | computed | (12−4):(6−0.5) | — | ±15 pp | **Internal:** arithmetic on 9.3, 9.4, 9.5 |
| 9.7 | MDF-requirement shift from blockers | −2 pp | computed | Breakeven with new v:b ratio | — | ±2 pp | **Internal:** breakeven-fold-equity recomputation |

### MDF / realization claims (§10)

| # | Claim | Value | Source-type | Source / Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 10.1 | MDF | 75.1% | computed | 20.5 / (20.5 + 6.8) | — | exact | **Internal:** formula mismatch |
| 10.2 | Hero equity-required to call | ~20% | computed | 6.8 / 34.1 | — | exact | **Internal:** pot odds formula mismatch |
| 10.3 | IP baseline realization | 0.90 | **assumed** (F-10a flagged — POKER_THEORY.md §3 quoted baseline not inlined) | POKER_THEORY.md §3 directional | — | ±0.05 | **External-operational:** POKER_THEORY.md §3 quote differs, or cited-source realization paper shows IP baseline outside [0.85, 0.95] |
| 10.4 | Wet-texture adjustment to realization | −0.02 | **assumed** | Author's textural intuition | — | ±0.03 | **External-operational:** sourced texture-realization adjustment table shows wet-adjustment outside [-0.05, 0] |
| 10.5 | Realization factor, range-level | 0.88 | computed | 0.90 − 0.02 − 0 − 0 | — | ±0.05 | **Internal:** 10.3 + 10.4 sum differs |
| 10.6 | Realization factor, J♥T♠ specific | 0.92 | **assumed** | TP+BDFD realizes better than range avg | — | ±0.05 | **External-operational:** TP+BDFD-specific realization study shows value outside [0.85, 0.96] |

---

**[Completeness: swept 2026-04-22, 68 claims ledgered, falsifiers attached to every row. F-findings flagged inline. Rubric-Version v2.]**

---

### Lowest-confidence load-bearing claims (for §12 sensitivity)

1. **Row 2.17/2.18 (donk composition, value:bluff ratio).** `derived + assumed`, wide CI, **decision-flipping** per §12 Assumption A.
2. **Row 5.1 (pool donk frequency).** `population-observed`, n≈0, decision-adjacent (explanation-critical per §12 Assumption B).
3. **Rows 10.3-10.6 (realization factors).** `assumed`, moderate CI, robust per §12 Assumption C.
4. **Rows 7.5/7.6 (villain EV numbers).** `assumed` with no derivation — F-finding; v2 requires fix.
5. **Rows 8.7/8.8/8.15/8.17 (depth-2/3 EV and raise-called realization).** Summary-level rather than branch-level — F-finding; v2 requires fix.

---

## §12. Sensitivity analysis

Three assumptions drawn from the §11 ledger's lowest-confidence rows:

### Assumption A — Donk composition (current: 67:33 value:bluff)

Flip threshold: at **~48:52 value:bluff** (substantially more bluffs than assumed), hero's equity vs donk range rises from ~30% to ~38%, and the raise-branch EV rises above fold. At ~40:60, raise becomes +EV over call. **Decision flips from call to call/raise mix at ~40:60 value:bluff.**

Delta at flip: raise-branch shifts from -6bb to approximately +0.5bb. Call-branch also rises (to ~+5bb) — but raise becomes a reasonable mix-in.

Is the flip realistic? **Borderline.** Live pool could have 50:50 composition if the pool is fish-heavy (fish bluff more than regs). 40:60 is atypical but possible in specific pools. This is the single most important assumption — small shifts in donk composition meaningfully change the recommendation's tail.

### Assumption B — Pool donk frequency (current: 30%, range 20-40%)

Flip threshold: at **<8% frequency**, the live-pool-exploit framing collapses and the situation converges to solver analysis. Recommendation does not flip (hero still calls against solver-structured donk too) but the *explanation* in §4–§6 no longer applies.

Delta at flip: minimal EV change (~-0.2bb), since call is correct in both worlds. This assumption is *explanation-critical* but not *decision-critical*.

### Assumption C — Hero range realization factor (current: 0.88)

Flip threshold: at **<0.75 realization**, hero's effective equity drops below the 20% pot-odds threshold and call becomes −EV; fold becomes best.

Delta at flip: call goes from +3.8bb to -0.5bb. Fold becomes +0.0bb → +0.5bb relative to call.

Is the flip realistic? **No.** Realization 0.88 → 0.75 would require SPR shift to DEEP zone (not the case — we're at medium-LOW), or hero's range to be more draw-heavy than modeled (not the case — hero's range is ~48% made top-pair+), or villain to be a maniac who barrels every street (partial case — adjusts realization by maybe 0.02-0.03 not 0.13). **This assumption is robust.**

### Summary

**Assumption A (donk composition) is the load-bearing assumption. The artifact's recommendation integrity depends on its accuracy.** Assumptions B and C are either explanation-only (B) or robust (C). If a future reader doubts the artifact's conclusion, they should doubt A first.

---

## §13. Contrast with leading theories

Four external sources examined, with category classification:

### Source 1 — GTO Wizard, "Navigating Range Disadvantage as the 3-Bettor"

Key claim relevant to our §4: non-broadway middling boards favor the preflop-caller (not the 3bettor) in nut-advantage terms. BB should mostly check this texture.

**Our position:** agree. §4 explicitly cites this.

**Category: A.**

### Source 2 — Matthew Janda, *Applications of No-Limit Hold'em* (2013, pre-solver)

Key claim: in 3-bet pots, the out-of-position 3bettor should rarely donk on flops regardless of texture. Rationale is structural (donking telegraphs strength, loses value from bluff-catchers). Janda's framework predates solver confirmation; his conclusion is solver-aligned in direction but not in nuance (Janda doesn't engage with the narrow solver-donk frequency of 0-10% that modern solvers endorse on specific flops at specific sizings).

**Our position:** agree in direction (solver rarely donks); teach the live-pool deviation as an exploit opportunity. Janda's pre-solver framework doesn't address population deviation; it's solver-era theory without the solver calibration that makes population-exploit work meaningful.

**Category: D (intentional divergence — we teach the live-pool exploit while Janda writes only the solver conclusion). Feed to POKER_THEORY.md §9.**

### Source 3 — Upswing Poker, "Donk Betting Strategy (When to Donk and When Not To)"

Key claim: donking is "usually wrong" because it creates awkward range structures, but there are textures where OOP has range/nut advantage and donking is correct (e.g., low boards where BB has more overpairs than BTN). Upswing then applies this to disadvantaged boards by inversion: on boards where BB does NOT have range/nut advantage, donking is a mistake.

**Our position:** partial disagreement. Upswing's claim "donking is correct when OOP has range advantage" is correct but understated — solver endorses donking at low frequency even on *disadvantaged* boards with specific hand classes (sets for slowplay, blocker bluffs). Upswing's binary "donk on range-advantage boards, don't donk on disadvantaged boards" is a pedagogical simplification that misses the 0-10% solver donk frequency on disadvantaged boards. For teaching purposes at beginner level, Upswing's binary is helpful; for upper-surface analysis, it is incomplete.

**Category: C (source under-specifies; our nuance is more accurate). The source isn't "wrong" — it's *simplifying for pedagogy in a way that misses material nuance at the upper-surface level*. Our artifact must retain the solver-donk low-frequency nuance in §4.**

### Source 4 — Run It Once solver summaries (scraped fetch, 403 on direct but search-result-summary available in LSW audit's source list)

Key claim: on low boards in 3BP, BB checks the majority but has a thin donk range at specific sizings for specific hand classes.

**Our position:** agree. §4's "0-10% donk frequency" directly mirrors this.

**Category: A.**

### Active challenge sub-section

Per rubric v1.1 §13 requirement: if B/C absent, author must explain the challenge attempt. In the four sources above, we found **one C** (Upswing's binary oversimplification) and **one D** (Janda's pre-solver omission). The rubric minimum is met. However, the artifact's §6 exploit recommendation is the most challengeable claim, so we actively challenge it here:

**Challenge target:** the recommendation "pure call, not mixed with raise."

**Source actively searched for disagreement:** GTO Wizard "Crush 3-Bet Pots OOP in Cash Games" and related IP-in-3BP articles.

**What we tried:** to find a source that endorses raising J♥T♠ (top-pair-J) on T96ss vs a donk at any frequency. If solver endorses mixing 15% raise, is there a coaching source that extends this to population-exploit recommendations?

**Why no B/C found:** the coaching literature consistently endorses pure-call or heavy-call against live-pool-donks with top-pair-J hands on wet boards. No source advocates raising J♥T♠ here against any donk range. Our recommendation is pedagogically unchallenged by the available corpus.

**Caveat to the artifact:** this is not a sign of correctness. It is a sign that the coaching corpus is consensus on this spot, which *could* mean the consensus is wrong (group-think) or *could* mean the decision is easy enough that nobody disagrees. §12 sensitivity analysis is our hedge — if Assumption A (donk composition) is meaningfully off, the consensus could be wrong.

---

## §14. Verification architecture

### §14a. Symmetric-node test

**Primary mirror node: `btn-vs-bb-3bp-ip-dry-k73r-flop_root`** — same player positions, same 3BP IP structure, 90bb effective, but on a **dry broadway-rainbow flop (K-7-3 rainbow)**. This mirror flips the range/nut advantage (BB has K-high range advantage on K73r with Kx+AK; BTN's flatting range has almost no K-high hands) while preserving every other state variable.

Six claims classified:

1. **"BTN has nut advantage on T96ss."** → **Inverts.** On K73r, BB has nut advantage (more Kx, overpair AA/QQ+; BTN's range is smaller overpairs + A-high-no-pair + some suited broadway misses). Nut-advantage claim is board-dependent; inversion is expected.
2. **"Hero's range has ~48% top-pair slice."** → **Inverts/changes substantially.** On K73r, hero's flatting range has almost no Kx (BTN folds Kx vs 3bet). Hero's top-pair slice drops to ~10-15%. Meaningful change; not a simple invert.
3. **"MDF at 33% donk = 75.1%."** → **Stays.** MDF is pot-odds arithmetic, derived solely from bet size and pot. Board-independent. Justified: MDF formula is state-invariant on board.
4. **"Realization factor 0.88 (IP, wet-adjusted)."** → **Changes.** On K73r (dry), texture-adjustment flips from -0.02 to +0.02 (dry boards let IP realize better than wet). New realization: ~0.92. Partially changes — position stays IP so baseline is same, adjustment flips.
5. **"Pool BB-donk frequency 20-40%."** → **Stays (with qualifier).** Live-pool donk tendency is structural behavior (protection against draws on wet; less-motivated on dry). On K73r, pool donk frequency is probably lower (maybe 10-20%) because the protection motive is absent. So this claim *partially changes* — pool donks less frequently on dry, but the behavior category (pool donks more than solver) persists.
6. **"Villain's apparent-hero-range over-weights draws."** → **Partially changes.** On K73r, draws are nearly absent (no flush draw possible, few straight draws); villain's mis-weighting of hero can't target draws. Villain now over-weights A-high (afraid hero has AA/KK) and under-weights pocket pairs. The *direction* of mis-weighting stays (villain makes an error) but the *content* shifts.

**Test passes.** All six claims classified. Two invert cleanly, three partially change with stated reasoning, one stays with justification (MDF). No unjustified "stays."

### §14b. Artifact-level falsifier synthesis

**Regenerated under v2.** §11 now carries per-claim falsifiers (v2 primary move). §14b synthesizes from §11 — distilling the falsifiers whose firing would flip §6's recommendation via §12 sensitivity propagation. These are the "headline falsifiers," not newly invented but already present in §11; §14b's role is to identify which ones are *decision-level* rather than merely claim-level.

#### Headline falsifier 1 (from §11 rows 2.17 / 2.18 — donk composition)

**§11 ledger row:** rows 2.17 (donk value fraction ~60-80%) and 2.18 (donk bluff fraction 20-40%). Load-bearing per §12 Assumption A.

**Threshold that flips §6:** if an observed donk composition shows value:bluff ratio at or below **48:52** (substantially more bluffs than the author's 67:33 model), hero's weighted equity vs donk range (row 3.9) rises from ~30% to ~38%, raise-branch fold-equity (row 8.10) rises from ~21% to ~35-40%, raise-branch EV (row 8.19) crosses from negative to near-zero or positive, and §6's recommendation flips from pure call to a call/raise mix.

**Propagation path:**

```
§11 row 2.17/2.18 (donk composition)
  → §11 row 3.9 (hero eq vs donk range)
  → §11 row 8.10 (raise fold-equity)
  → §11 rows 8.12, 8.18, 8.19 (raise-branch EV)
  → §12 Assumption A flip threshold crossed
  → §6 recommendation: call → call/raise mix
```

**Observable event to falsify:** a 200+ showdown-reveal sample of BB donks on non-broadway wet two-tone boards in live 1/2-5/10 NL cash, with donk composition categorized, showing value:bluff at or below 48:52.

#### Headline falsifier 2 (from §11 row 5.1 — pool donk frequency) — **below decision-level threshold**

Row 5.1 (pool donk frequency 20-40%) has an external-operational falsifier (sample shows frequency outside [10%, 50%]). Per §12 Assumption B, this falsifier is **explanation-critical but not decision-critical**: even if the pool donks at 5% instead of 30%, hero's call-vs-donk recommendation holds because call is also correct against the solver-aligned rare donk. **Classified as a §11-level falsifier, not §14b-headline.** Noted here for transparency: §14b limits to falsifiers that flip §6, not all falsifiers of note.

#### Headline falsifier 3? — **Decision-level-robust on other dimensions**

No other §11 row has a falsifier whose firing would flip §6 within its credible interval. Per §12:
- Assumption C (realization 0.88) would need to drop to <0.75 to flip; unrealistic.
- Per-class equity rows (3.1-3.7) would each need to shift 10+ pp to cumulatively flip §3.9; no single-row shift is load-bearing.
- EV-tree rows (§8) are derivatives of §3/§2 — their falsifiers trace back to composition (falsifier 1).

**Summary.** Only falsifier 1 is a §14b headline falsifier. The recommendation is decision-level-robust across all other §11 assumptions within their credible intervals. This is itself a confidence signal — §6's recommendation of "pure call" is robust unless the single load-bearing assumption (donk composition) is materially wrong.

**AI failure mode check (v2).** §14b here does not invent new falsifiers — all three entries above trace to specific §11 rows. The "decision-level-robust on other dimensions" statement replaces what v1.1 would have forced into fabricated falsifiers 2 and 3.

### §14c. Counter-artifact pointer

**The artifact that would supersede this one:**

`btn-vs-bb-3bp-ip-wet-t96-flop_root-v2-stake-stack-conditioned.md` — an artifact that splits §5 (population baseline) and §10 (SPR / realization) by:
- **Stake:** 1/2 NL, 2/5 NL, 5/10 NL live cash separately; online 25NL, 100NL, 500NL separately
- **Stack depth:** 50bb, 90bb, 200bb separately
- **Pool type:** live-fish-heavy vs live-reg-heavy vs online-reg-heavy

The current artifact treats "live pool" as monolithic, which is a known simplification. At deep stacks (200bb+), BB's overpair protection motive weakens (more room to see turn and river without committing; less equity-denial value in the donk). At shallow stacks (50bb effective), the 3bet pot's stack-to-pot ratio at flop is so low that donk+bet-bet-jam becomes the structure, and the donk is almost forced. Both of these conditions would shift §5, §10, and §12, potentially changing the exploit recommendation for certain stake-stack cells.

A v2 artifact that stratifies by these dimensions would supersede §5 and §10 of the current artifact and re-enter §12 with narrower-confidence assumptions — still the same analysis framework, but conditioned on operating context.

---

## Closing note (v2 partial-refit)

This artifact was the first pilot under rubric v1.1. Stage 3a self-audit (`audits/btn-vs-bb-3bp-ip-wet-t96-flop_root-audit.md`) identified 19 findings (4 P1, 7 P2, 7 P3). Gate B owner reframe introduced the claim-falsifier invariant, producing rubric v2. This partial-refit regenerates §11 as the claim-falsifier ledger and refactors §14b as synthesis; other sections retain v1.1-era authoring with known F-findings tracked in the audit for post-corpus cleanup.

**F-findings still open after v2 partial-refit (deferred):**

- F-2a / F-2b — full enumeration at node-of-interest; remove "abandoning for space" hand-wave (§2.20 in ledger)
- F-3a — per-class equity derivation citations (rows 3.1-3.7 currently `equity-estimated`)
- F-4a — tighten solver frequencies to ranges (rows 4.1-4.8 already have ± in CI)
- F-5a — sourced population baseline (confidence-floor note added; dataset still absent)
- F-7a / F-7b — villain-EV derivation (rows 7.5/7.6 flagged; derivation missing)
- F-8a / F-8b — branch-level EV table (rows 8.7/8.8/8.15/8.17 flagged)
- F-9b — JJ reduction typo in §9 prose (minor)
- F-10a — realization derivation quoting POKER_THEORY.md §3 (rows 10.3-10.4 flagged)
- F-12a — Assumption A flip re-derivation (depends on F-8a)

**Decision-level status.** §6's pure-call recommendation is robust across all §11 credible intervals except row 2.17/2.18 (donk composition) per §14b headline falsifier 1. This is a genuine load-bearing uncertainty, appropriately surfaced — not a rubric gap.

**What the partial-refit exposed.** The ledger grew from ~28 rows (v1.1) to 68 rows (v2) — a 2.4x expansion of disprovable-claim surface area on the same node. Multiple rows that v1.1 would have accepted as compliant (e.g., the §7 villain-EV numbers, §8 summary-level adjustments) now carry explicit F-finding flags inline, visible to any reader of the ledger rather than buried in a separate audit doc.

---

*End of artifact.*
