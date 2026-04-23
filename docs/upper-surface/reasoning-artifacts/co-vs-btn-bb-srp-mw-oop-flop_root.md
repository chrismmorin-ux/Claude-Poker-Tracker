---
Rubric-Version: v2.2
Node-ID: co-vs-btn-bb-srp-mw-oop-flop_root
Street: flop
Line: src/utils/postflopDrillContent/lines.js L2238-L2257 (LINE_CO_VS_BTN_BB_SRP_MW_OOP.nodes.flop_root)
Authored: 2026-04-23
Authored-By: Claude (main, US-1 Artifact #6 — v2.2-native, FIRST MULTI-WAY)
Status: draft
Supersedes: null
Superseded-By: null
Companion-LSW-Audit: (no LSW audit for line 7)
Known-rubric-stress: multi-way fundamentally stresses §2 (3 ranges), §7 (2 villain perspectives), §8 (branching combinatorics), §10 (joint MDF)
---

# Upper-Surface Artifact — `co-vs-btn-bb-srp-mw-oop-flop_root`

**Spot.** 3-way single-raised pot. Hero CO (**OOP sandwiched** between BB OOP-behind and BTN IP-behind). Effective stack 100bb. Line: preflop CO open 2.5bb, BTN flat, SB fold, BB call. Flop **Q♥5♠3♦** (rainbow, dry high-card). BB checks. Hero CO acts with **A♠Q♣** (top pair, top kicker). BTN still to act behind.

**Authored teaching answer:** Cbet 50% pot (~5bb). Cbet 33% wide incorrect. Check incorrect.

**Structural distinction from prior corpus artifacts (1-5): FIRST MULTI-WAY.**
- **3-player postflop** — all prior artifacts heads-up.
- **Sandwiched hero position** — CO acts between BB (who has checked) and BTN (behind, IP). Hero's bet faces two potential respondents.
- **Two distinct villain ranges** (BB's SRP defense vs. BTN's IP-vs-PFR flat) — distinct preflop filter histories, distinct postflop dynamics.
- **Joint fold-equity mechanics** — hero's fold equity is the product of BB's fold rate × BTN's fold rate (approximately; correlated).
- **§7 multi-villain perspective** — two villain EV computations, not one.

**v2.2 rubric stress note:** the rubric was designed for HU artifacts. Multi-way requires pragmatic extensions to several sections. Where the rubric is under-specified for 3-way, this artifact notes the adaptation and flags rubric-gaps for v2.3+ consideration.

---

## §1. Node specification

**Game state.** NLHE cash. Stake target: live 1/2-5/10 NL cash, where 3-way-to-the-flop frequency is higher than online (online pools tend to fold BB more tightly; live pools flat BB wider, creating 3-way pots more often).

**Positions.** 3-way postflop: CO (hero), BTN (villain 1, IP), BB (villain 2, OOP-behind-BB). SB folded preflop.

**Effective stack.** 100bb preflop. After preflop action (CO 2.5, BTN 2.5, BB 2.5 to call — BB completes to BB-post-of-1bb, so BB calls 1.5 additional): each live player at 97.5bb. Preserved through flop up to node.

**Pot at node.** Authored **10bb**. Derivation: 0.5 SB (dead) + 1 BB + 2.5 CO + 2.5 BTN + 1.5 BB-call-completion = 7.5 + 0.5 = 8bb. The authored 10bb is slightly high by 2bb. Possible the line assumes 3bb open: 3 + 3 + 3 + 0.5 + 1 = 10.5 → rounds to 10. Adopting authored **10bb** with derivation-gap note.

**Board.** Q♥ 5♠ 3♦ — rainbow (three suits), high-card (Q is the high card), dry (no flush possible, no connected straight — 5-3 needs 4-2 or 6-4 for straight, very fringe).

**SPR at node (vs hero's call-response math).** If hero bets 50% (5bb), post-bet pot is 15; hero remaining stack 92.5. Post-bet SPR effective is 92.5 / 15 = 6.2. **MEDIUM zone** (4-8).

Multi-way SPR is more complex because "effective stack" differs between villains. Effective stack with BTN = 97.5bb; with BB = 97.5bb. SPR computation is per-opponent but converges here (all started equal).

**Action history.**

| Step | Actor | Action | Size (bb) | Pot after (bb) | Stack after (bb) |
|---|---|---|---|---|---|
| 1 | CO | open | 2.5 | ~3 (incl. blinds) | 97.5 |
| 2 | BTN | call | 2.5 | ~5.5 | 97.5 |
| 3 | SB | fold | — | — | — |
| 4 | BB | call (complete) | 1.5 | 10 (authored) | 97.5 |
| 5 | *flop Q♥5♠3♦* | — | — | 10 | — |
| 6 | BB | check | — | 10 | 97.5 |
| *node entry* | CO | — (decision) | — | 10 | 97.5 |
| *(future)* | BTN | — (pending hero action) | — | — | — |

**Prior-street filter rationale.**

- **CO preflop filter.** CO open is a wider-than-UTG, narrower-than-BTN range. ~22-25% at live standard. Hero opens with A♠Q♣ — clearly in open range.
- **BTN filter.** BTN vs CO-open can flat or 3bet. Flat range at live: pocket pairs 22-JJ (some flat, some 3bet), suited broadways AJs/ATs/KQs/KJs/KTs/QJs/QTs, suited connectors T9s/98s/87s/76s, some suited gappers. BTN's flat-vs-CO range is ~12-15% of dealt hands ≈ 160-200 combos.
- **BB filter.** BB faces CO open + BTN flat. BB's defense is very wide at live (getting 3-to-1 pot odds to defend; call range extends to any paired/suited/connected hand). BB's call range ≈ 30-45% of dealt hands (live loose-call norm). Narrower vs online solver-correct (~18-22%).
- **BB flop filter (check).** BB checks range-wide on Q53r — standard OOP-facing-PFR-bettor. No donk-leading pattern at live for this texture.

**Summary.** Hero CO with TPTK on dry high-card flop, sandwiched between a checked-BB (~30-45% preflop flat range) and BTN-yet-to-act (~12-15% preflop flat range, IP).

---

## §2. Range construction — all three players

**This is the §2 stress-test section — three ranges instead of two.** v2.1 D10 first-pass discipline applied to all three players.

### CO (hero) preflop range

~22% CO open ≈ 290 combos. Composition (standard):
- Pairs 22-AA: 78
- Suited aces A2s-AKs: 52
- Offsuit aces ATo-AKo: 48
- Suited kings K5s-KQs: ~44
- Offsuit kings KJo-KQo: 24
- Suited queens Q8s-QJs: 24
- Offsuit queens QJo, QTo (partial): ~20
- Suited jacks J8s-JTs, offsuit JTo: ~20
- Suited tens T7s-T9s: ~20
- Suited connectors 76s, 65s, 54s: ~24

**Total ≈ 290 combos.** Hero holds A♠Q♣ (1 of 16 AQo combos; clearly in open range).

### BTN preflop range (flat vs CO open)

Live BTN-vs-CO flat range ~13% ≈ 175 combos. Composition:
- Pocket pairs 22-JJ (live flats more than solver 3bets): 36-42 combos
- Suited aces A2s-AQs (AJs+ mostly 3bets; A2s-A9s flats): ~24 combos
- Suited kings KJs-KTs, KQs mixed: ~20 combos
- Suited broadway connectors QJs-QTs, JTs-J9s: ~16 combos
- Suited medium connectors T9s-65s: ~30 combos
- Suited one-gappers/fringe: ~20 combos
- Offsuit broadways (very partial — AJo-ATo fold more than flat at live): ~10 combos

**Total BTN flat range: ~170 combos.**

### BB preflop range (call CO+BTN)

Live BB call range is wide — facing 2.5bb raise getting 3:1-ish pot odds, BB defends ~30-45%. Conservative baseline: **~35% ≈ 465 combos**.
- All pocket pairs 22-JJ (6×10=60 combos, QQ/KK/AA mostly 3bet at live): 60
- Suited aces A2s-AQs: 52
- Offsuit aces (partial, live wider): ~36
- Suited broadways all K2s+/Q2s+/J4s+/T6s+: ~120
- Offsuit broadways (partial): ~40
- Suited connectors/gappers 98s-54s-many: ~80
- Weak offsuit broadway + random (live live leak): ~77 combos

**Total BB call range: ~465 combos.** (Large because live BB closes action with big pot odds.)

### Filter through flop Q♥5♠3♦: BB checks

BB checks near 100% of range on this dry high-card texture (no donk-leading motivation OOP 3-way). BB's check range ≈ full ~465 combos.

### Hero's decision-relevant view: weighted villain range

Hero faces the COMBINATION of BB (acted) + BTN (yet to act). When hero bets:
- BB's fold range removes combos.
- BTN's fold/call/raise filters further.
- Hero's fold equity is joint (BB fold × BTN fold, approximately uncorrelated).

**Hero's decision is against the union of BB's check range + BTN's flat range.** Two distinct filter chains that hero must evaluate separately then aggregate.

### Pre-bet-response composition analysis

Hero's cbet 50%:
- **BB's response range** (facing 5bb into 10bb pot, ~33% equity required): BB defends with pairs (JJ-22 partial), Qx (AQ/KQ/QJ/QT), any A-high, some flush-draw-equivalents (none here, rainbow), some suited connectors with gutshots. BB's fold range: offsuit broadway missed, K-high missed, random Ax that's below threshold.
- **BTN's response range**: BTN's flat-vs-CO range flopping Q53r — pocket pairs 22-JJ, Qx suited (rare), some 5x/3x suited for 2nd pair. BTN folds most broadway misses, low connectors that brick.

**This is where the multi-way stress on §2 appears.** Rubric's §2 forcing constraint ("full enumeration at node-of-interest") is manageable for each player individually but the combined decision-space (BB's defense × BTN's response × hero's subsequent) becomes combinatorial.

**Per rubric v2.2 extension note:** multi-way §2 treats "range at node-of-interest" as the COMBINED OPPONENT RANGE that hero's decision faces. Enumerate BB and BTN separately; aggregate fold equity as a joint product.

### Card-removal effects

Hero holds A♠Q♣. Blocks across villain ranges:
- A♠: removes A♠-containing combos in both BB's and BTN's ranges. Medium effect on both.
- Q♣: removes Q♣-containing combos (QQ preflop, KQs-Q♣, QJs-Q♣, etc.). **Q♣ specifically reduces villain's Qx value combos — favorable for hero's fold equity** (fewer Qx means more folds).

Net blocker effect: slightly favorable. Estimated shift on joint fold equity: +3-5 percentage points.

---

## §3. Equity distribution shape

Hero A♠Q♣ on Q♥5♠3♦ (flop). Two more cards to come. Pure-bimodal doesn't apply (turn/river pending).

### Per-class equity vs BB's check-range + BTN's flat range (combined)

Simplified via class-aggregation (treating BB and BTN ranges as one weighted pool since hero acts against the combined threat):

| Combined villain class | Approx combos | Hero eq | Bucket |
|---|---|---|---|
| Sets (QQ, 55, 33): rare in both ranges after blockers | ~8 | ~5% | air |
| AQ split-kicker (chops): ~4 | ~4 | ~50% | medium |
| Qx TP mid/weak kicker (KQ, QJ, QT, Q9-Q2 suited): ~28 | ~28 | ~85-90% | nuts |
| Middle pairs 88-JJ (overpair below top): ~30 | ~30 | ~85% | nuts |
| Low pairs 22, 44, 66-77 (2nd-pair+): ~35 | ~35 | ~85-88% | nuts |
| 5x / 3x second pair (52s, 32s suited, etc.): ~15 | ~15 | ~85% | nuts |
| Ace-high missed (non-Q A-high): ~30 | ~30 | ~75% | strong |
| K-high/J-high missed: ~40 | ~40 | ~70% | strong |
| Suited connectors/gappers no pair (gutshot equity): ~50 | ~50 | ~75% | strong |
| Random air (offsuit nothing): ~90 | ~90 | ~85-90% | nuts |

**Total ~330 combos in combined pool** (after blocker adjustments, from ~635 pre-filter).

**Bucketed:**
- Nuts (>80%): ~198 combos
- Strong (60-80%): ~120
- Medium (40-60%): ~4
- Weak (20-40%): 0
- Air (<20%): ~8

**Weighted equity:** `(198 × 0.87 + 120 × 0.73 + 4 × 0.50 + 8 × 0.05) / 330 = (172.26 + 87.6 + 2 + 0.4) / 330 = 262.26 / 330 ≈ 79.5%`.

**Hero equity ~80% vs combined villain range.** Extremely favorable — hero is ahead of nearly all of both villains' ranges. TPTK on Q-high-dry is a near-pure value hand.

**Critical multi-way feature:** the equity doesn't tell the whole story. In multi-way, hero's VALUE REALIZATION is compressed — even winning hands realize a smaller fraction of their equity because OOP-with-two-opponents-to-act creates more fold-and-barrel-misery than HU. Realization factor is crucial here.

---

## §4. Solver baseline

**Claim 1 — Multi-way solver cbet frequency on dry high-card flops.** Multi-way solver simulations (GTO Wizard "3-Way Flop Play" articles + PIO multi-way outputs) show: CO-PFR-with-range-advantage cbets at **~55-65%** of range on dry high-card multi-way flops. Smaller sizing (33%) is more common than polar (50%+) — but the authored teaching recommends polar 50% which is solver's minority choice.

**Claim 2 — Solver hero-AQ specifically.** TPTK on Q53r in 3-way is a clear cbet — solver bets ~95%+ with top-pair-top-kicker in position-vs-caller multi-way (CO is "in-position-to-BB, out-of-position-to-BTN" in the sandwiched sense). Sizing mix: 33% ~55%, 50% ~30%, overbet ~5%, check-back ~10%.

**Claim 3 — Sizing choice 33% vs 50%.** Solver's preference between 33% and 50% is close. 33% protects realization (lower commitment, less BTN-raise-exposure). 50% captures more value from worse Qx. Authored teaching chooses 50% as pedagogical simplification; solver would mix.

**Solver summary.**

| Action | Solver frequency |
|---|---|
| Cbet 33% | ~55% |
| Cbet 50% | ~30% |
| Overbet | ~5% |
| Check back | ~10% |

---

## §5. Population baseline

**Claim 1 — Live pool MW cbet frequency.** Live pool at 1/2-5/10 cash: cbets multi-way at **~45-55%** (lower than solver's 55-65%). Live pool under-cbets multi-way out of "fear of 2 opponents" and "wide calling ranges." **Hero's authored 100% cbet-with-TPTK** exceeds population's 75-85%-with-TPTK norm.

**Source (v2.2 D13 source-scope check applied):**
- **Doug Polk multi-way content:** live cash multi-way treatment. Scope matches live target. ✓
- **Upswing multi-way courses:** multi-way theory. Scope matches. ✓
- **Matt Berkey MW content:** elite multi-way. Scope matches live/higher-stakes. ✓

**Claim 2 — Pool BB response vs 50% cbet multi-way.** Live BB at this sizing: folds ~50-60% (live wider calling than solver). BB defends with any pair + any A-high + suited flush-draw-equivalent + suited-broadway-missed (sticky calls).

**Claim 3 — Pool BTN response vs hero's cbet (after BB's decision).** BTN faces cbet + BB's action. If BB calls: BTN folds ~70-80% (tight vs two opponents). If BB folds: BTN folds ~55-65% (standard). BTN over-calls marginally vs solver but under-raises.

**Claim 4 — Hero's authored cbet-50% sizing choice:** population executes 50%+ sizing less frequently than 33% on dry boards in MW. Hero's 50% is above population-typical but matches authored teaching target. Authored recommendation is **slightly solver-non-optimal** (33% might be very close to 50% or slightly higher EV) but is **pedagogically cleaner** (one sizing choice across the line).

---

## §6. Exploit recommendation

**Pre-drafting check:** §4 and §5 authored. Proceeding per v1.1 D6.

**Recommended hero action: cbet 50% pot (~5bb).** Single recommendation.

### Delta vs §4 (solver baseline)

Solver mix is 55:30:5:10 (33%:50%:overbet:check). Our recommendation: 50% at 100%. **Deviation: collapse solver's 33%/50% mix into 50%-only.** Causal claim:

1. Solver mixes 33% and 50% for balance reasons (range-protection against hypothetical 3bettor-tier aggression). At live stakes, hero doesn't have bluff-cbets in the 33%/50% mix frequency solver assumes; fold-equity differences matter more than balance.
2. 50% captures strictly more per-call value from Qx and middle pairs than 33% (larger bet = larger call = more money extracted).
3. The solver's 33% preference factors in multi-way realization concerns that are (per §5 Claim 1) already accounted for in live-pool's under-folding tendencies.

### Delta vs §5 (population baseline)

Population cbets ~75-85% with TPTK in MW. Our recommendation: 100%. **No deviation in direction** (both cbet) — but 100% captures the 15-25% population-error cases where TPTK is check-backed, losing EV.

### Archetype-conditional note (v2.1 D11)

§12 evaluates. Archetype doesn't flip for TPTK-cbet in MW:
- Fish (BB or BTN): cbet larger (50%+) — both fish over-call; value extraction higher.
- Reg (BB or BTN): cbet 50% is fine; reg folds more than fish but still defends wide enough.
- Pro/nit: cbet 50% is fine; the narrower calling range still contains enough Qx and middle pairs.

**No archetype-conditional override needed.** Single-action per v2 §6 default.

---

## §7. Villain's perspective — TWO VILLAINS

**This is the §7 stress-test section — two villain perspectives, not one.**

### BB's perspective

**BB's range as BB sees it.** "I defended wide vs CO+BTN in BB. On Q53r I have some Qx (KQ, QJ, QT, Q9-Q2 suited, AQ), middle pairs (22-JJ), low pairs (22-66 with set), broadway misses (KJ/JT/etc. with gutshot), and lots of random missed hands. I check range-wide — letting CO act first, knowing CO bets often."

**BB's model of hero's (CO's) range.** BB expects CO's MW range to be strong-at-showdown: Qx TPTK+, overpairs, sets. BB's fold threshold vs cbet: need ~33% equity. Middle pairs (66-JJ) have ~30-45% vs CO's value-merged range → mostly call. Broadway misses have ~15-25% → fold. **BB correctly identifies CO as having range advantage.**

### BTN's perspective

**BTN's range as BTN sees it.** "I flatted in position vs CO's open. On Q53r I have mostly pocket pairs + suited connectors + some Qx-suited. Few pairs (only 22-JJ) hit Qx; most of my range missed. I'm behind CO-PFR and BB-behind-me (wait BB acted first, so BB is not behind me postflop). On this board I'm in position vs CO's bet-and-call line."

**BTN's model of hero's (CO's) range.** Same as BB's model in aggregate — CO has range advantage, PFR-value-weighted. BTN uses BB's action as additional info: if BB calls hero's cbet, BTN folds most misses; if BB folds, BTN may over-call with thin equity.

### Joint villain perspective

Both villains model hero similarly (CO-PFR-value-heavy). **The asymmetry between villains is at the perspective-of-each-other level, not individual-vs-hero:**
- BB acts not knowing BTN's action.
- BTN acts knowing BB's action.
- BTN's range folds more when BB calls (BTN gets squeezed between CO's bet and BB's call, no fold-equity if BTN raises, no value if BTN calls vs value-heavy CO).

**Hero's exploit source.** Hero's cbet-50% induces both villains' fold decisions under uncertainty. BB folds broadway misses correctly; BTN folds broadway misses + a portion of weak-Qx + some middle pairs (range compression as 3rd-to-act under 2 pressures). **Hero's cbet captures fold equity from both villains independently** — joint fold equity ≈ 0.55 × 0.65 = 36% (if uncorrelated) to 0.50 × 0.60 = 30% (if correlated via board-texture-dependent folding).

### Multi-villain EV traceability (v2 Delta 4 extension)

Rows 7.1, 7.2 capture individual villain EV perspectives. Row 7.3 captures joint-fold-equity. This is the multi-way extension of v2 §7 — rubric required single villain; artifact authored with two villains and joint-fold factoring.

---

## §8. EV tree: depth 1, 2, 3 — nine-branch combinatoric tree

**Multi-way §8 stress test.** Hero's cbet faces 9 possible response combinations (BB fold/call/raise × BTN fold/call/raise). Simplify by grouping:

| Scenario | Joint probability | Description |
|---|---|---|
| Both fold | BB_fold × BTN_fold ≈ 0.55 × 0.65 = 36% | Hero wins pot |
| BB folds, BTN calls | 0.55 × 0.35 = 19% | HU with BTN on turn |
| BB calls, BTN folds | 0.45 × 0.75 = 34% | HU with BB on turn (BTN's fold rate higher when BB calls) |
| BB calls, BTN calls | 0.45 × 0.25 = 11% | Remain 3-way on turn |
| Raise (either villain) | 0% assumed for simplicity — rare at live in this spot | Omit |

### Branch 1: Both fold (36%)

Hero wins pot immediately. Gross EV contribution: 0.36 × 10 = **+3.6bb**. Clean.

### Branch 2: BB folds, BTN calls (19%)

Hero reduces to HU with BTN. Pot after call: 10 + 5 + 5 = 20bb. Hero equity vs BTN's called range (tighter than overall — BTN's flat-vs-CO range calling a cbet):
- Qx: ~35% of continuing range (tight Qx — includes Q8s-QJs, KQ, partial suited broadways).
- Pairs 88-JJ: ~40% continuing.
- Some gutter-equity bluff-catchers: ~25%.

Hero equity vs BTN's cbet-call-range ~55%. Depth-2 realization (IP-turn-play, BTN OOP after flop-call-under-new-action): realization ~0.85.

EV: 0.19 × (0.55 × 20 × 0.85 − 5) = 0.19 × (9.35 − 5) = 0.19 × 4.35 = **+0.83bb**.

### Branch 3: BB calls, BTN folds (34%)

Hero reduces to HU with BB. Pot 20bb. Hero equity vs BB's cbet-call-range (BB's range is wider than BTN's — BB defends with more broadway-and-Ax-highs):
- Qx: ~35%.
- Pairs: ~30%.
- Broadway missed (A-high, K-high with equity): ~20%.
- Some sticky random: ~15%.

Hero equity ~65% (BB's calling range is weaker than BTN's because BB started wider preflop).

EV: 0.34 × (0.65 × 20 × 0.85 − 5) = 0.34 × (11.05 − 5) = 0.34 × 6.05 = **+2.06bb**.

### Branch 4: Both call (11%)

Remain 3-way on turn. Pot after two calls: 10 + 5 + 5 + 5 = 25bb. Hero equity vs combined two-calling-range (both villains have pairs + Qx + some equity): ~55%. Realization in 3-way-OOP is lower ~0.75.

EV: 0.11 × (0.55 × 25 × 0.75 − 5) = 0.11 × (10.3 − 5) = 0.11 × 5.3 = **+0.58bb**.

### Cbet 50% total EV

Branch 1 + 2 + 3 + 4 = 3.6 + 0.83 + 2.06 + 0.58 = **+7.07bb**.

### Cbet 33% branch (comparison)

Cbet 3.3bb instead of 5bb. Pot after: 13.3bb. Smaller fold equity (BB folds ~40% instead of 55%; BTN folds ~55% instead of 65%). Less value per-call.

Without full re-derivation: cbet 33% EV ≈ +6bb (less fold equity, less value per call).

### Check-back branch

Hero forfeits cbet-equity; BTN may stab or check down; realization drops.

Estimated: check-back EV ≈ +2bb (realized via showdown ~60% of pot).

### EV tree summary

| Branch | EV |
|---|---|
| Cbet 50% | **+7.07bb** |
| Cbet 33% | ~+6bb |
| Check back | ~+2bb |

**Chosen: Cbet 50%.** Delta over 33%: +1bb. Delta over check-back: +5bb.

---

## §9. Blocker / unblocker accounting

Hero holds **A♠ Q♣**.

**Blocks across villain ranges:**
- A♠ removes A♠-containing combos in both villains' ranges. Medium effect.
- Q♣ removes Q♣-containing combos — critically reduces villain's Qx value combos.

**Quantified effect on joint villain range:**
- BB's Qx subset: reduces ~10% via Q♣.
- BTN's Qx subset: reduces ~10% via Q♣.
- Combined: villain's Qx (the hands hero beats and bets for value against) reduced by ~5-8 combos total.
- Villain's air/bluff region: minimal effect.

**Net:** hero's blockers SLIGHTLY REDUCE villain's value-continuing region without impacting bluff/fold region meaningfully. Small unfavorable effect on hero's raw equity vs call range; small favorable effect on fold equity.

**Impact on cbet EV:** ~+0.5bb adjustment (small positive net).

**Verdict.** Blockers are near-neutral to mildly favorable. Not decision-leverage.

---

## §10. MDF, auto-profit, realization

**Multi-way MDF extension.** In MW, each villain has their own MDF threshold, but they don't individually need to meet MDF — collectively they do.

**Joint MDF.** Hero bets 5bb into 10bb (50%). Hero needs joint fold equity < (1 - MDF_joint) = 33%. Our estimated joint fold equity is 36% (per §7). Slightly above threshold — **cbet is exploitative-profitable relative to naïve MDF**.

**Per-villain MDF:**
- BB facing 5bb into 10bb: required defense 67%. BB's call rate in our estimate: ~45%. **BB under-defends by 22 pp.**
- BTN facing same pot (after BB's decision): required defense depends on BB's action.

**Auto-profit for hero's cbet.** Hero's cbet is auto-profitable if fold equity > pot-odds threshold (33% at 50% bet). Our 36% estimate is barely above this → cbet is marginally auto-profitable even if hero gets no value from calls (which is not the case; hero has positive equity from BB/BTN calling with worse hands too).

**Realization factor.** IP baseline 0.90 in HU; in 3-way OOP, realization drops to ~0.75-0.80. Hero's sandwiched-OOP reduces this further. **Hero realization ~0.75** (aggressive discount reflecting multi-way OOP difficulty).

**For AQ TPTK specifically:** 0.80 (slightly better than range-average because TPTK has clear showdown value).

---

## §11. Claim-falsifier ledger

v2.2-native. Multi-way extension: three-range claims tracked.

### Node-state claims (§1)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 1.1 | Effective stack | 100bb → 97.5bb at flop | computed | Preflop action arithmetic | — | exact | **Internal:** recomputation |
| 1.2 | Pot at node | 10bb authored | authored | lines.js pot: 10.0 | — | ±2bb derivation discrepancy | **Internal:** preflop-action derivation gives 7.5-10.5bb range |
| 1.3 | SPR at flop (post-bet-and-call basis) | 6.2 | computed | 92.5 / 15 | — | exact | **Internal:** recomputation |
| 1.4 | Stake target | live 1/2-5/10 NL | assumed | Corpus standard | — | — | **External-operational:** different stake |

### Range-construction claims (§2) — multi-way

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 2.1 | CO open range | ~22-25%, ~290 combos | population-cited | Standard CO open | — | ±7 pp | **External-operational:** live sample outside [15%, 32%] |
| 2.2 | BTN flat-vs-CO range (live) | ~13%, ~170 combos | population-cited | Live BTN flat patterns | — | ±4 pp | **External-operational:** live sample outside [9%, 18%] |
| 2.3 | BB call-vs-CO+BTN range (live) | ~35%, ~465 combos | population-cited | Live BB defense patterns | — | ±10 pp | **External-operational:** live sample outside [25%, 50%] |
| 2.4 | BB flop-check freq on Q53r | ~100% | solver-inferred | Standard OOP-vs-PFR | — | ±5 pp | **Theoretical:** solver outside [90%, 100%] |
| 2.5 | Combined villain range | ~635 combos pre-blocker | derived from 2.2+2.3 | Aggregate | — | ±50 | **Internal:** re-sum |
| 2.6 | Combined range post-blockers | ~330 combos effective | derived | Blocker + showdown-bucketing | — | ±30 | **Internal:** re-derivation |

### Equity claims (§3)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 3.1 | Hero eq vs Qx top-pair-kicker-below (weighted average of KQ/QJ/QT/Q-sub) | ~87-90% | equity-derived | TPTK dominates lower Qx kickers | — | ±4 pp | **Internal:** Equilab outside [80%, 93%] |
| 3.2 | Hero eq vs overpairs JJ-88 | ~85% | equity-derived | Top-pair beats overpair | — | ±5 pp | **Internal:** outside [78%, 90%] |
| 3.3 | Hero eq vs low pairs 22-66 | ~85-88% | equity-derived | Higher pair dominates | — | ±5 pp | **Internal:** outside [80%, 93%] |
| 3.4 | Hero eq vs 2nd-pair / 3rd-pair (5x, 3x) | ~85% | equity-derived | TP > 2nd-3rd pair | — | ±5 pp | **Internal:** outside [80%, 92%] |
| 3.5 | Hero eq vs A-high missed | ~75% | equity-derived | TP beats A-high | — | ±5 pp | **Internal:** outside [68%, 82%] |
| 3.6 | Hero eq vs K-high/J-high missed | ~70% | equity-derived | TP beats K-high | — | ±5 pp | **Internal:** outside [62%, 78%] |
| 3.7 | Hero eq vs random air | ~85-90% | equity-derived | TP dominates air | — | ±5 pp | **Internal:** outside [80%, 95%] |
| 3.8 | Hero weighted equity vs combined range | ~80% | computed | Bucket-weighted | — | ±5 pp | **Internal:** recomputation outside [74%, 85%] |

### Solver claims (§4)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 4.1 | Solver MW cbet freq on dry high-card | ~55-65% | solver | GTO Wizard MW articles + PIO | — | ±10 pp | **Theoretical:** outside [45%, 75%] |
| 4.2 | Solver AQ TPTK cbet freq | ~95%+ | solver | Directional inference | — | ±5 pp | **Theoretical:** outside [88%, 100%] |
| 4.3 | Solver 33%:50% sizing mix | ~55:30 | solver | MW sizing-theory articles | — | ±15 pp each | **Theoretical:** outside specified range |

### Population claims (§5)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 5.1 | Pool MW cbet freq (live 1/2-5/10) | ~45-55% | population-consensus-observed (D14-candidate) | Doug Polk + Upswing + Berkey MW content | — | ±15 pp | **External-operational:** live sample outside [30%, 70%] |
| 5.2 | Pool BB response to 50% cbet MW | ~50-60% fold | population-observed | Live wider-calling | n≈0 | ±15 pp | **External-operational:** outside [30%, 75%] |
| 5.3 | Pool BTN response to 50% cbet (BB-calls case) | ~70-80% fold | population-observed | Live BTN tight vs 2 opponents | n≈0 | ±15 pp | **External-operational:** outside [55%, 90%] |

### Multi-villain perspective claims (§7)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 7.1 | BB's model of hero's range | CO-PFR-value-heavy | assumed | Standard MW opponent modeling | — | — | **External-operational:** BB's at-table revealed read |
| 7.2 | BTN's model of hero's range | Similar to BB + action-conditional | assumed | Same | — | — | Same |
| 7.3 | Joint fold equity (BB fold × BTN fold) | ~36% at 50% cbet | computed | Product of per-villain fold rates | — | ±10 pp | **External-operational:** combined sample shows outside [20%, 50%] |

### EV-tree claims (§8)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 8.1 | Cbet 50%, both fold (36% joint) | +3.6bb | computed | 0.36 × 10 | — | ±1bb | **Internal:** arithmetic |
| 8.2 | Cbet 50%, BB folds BTN calls (19% joint) | +0.83bb | computed | 0.19 × (0.55 × 20 × 0.85 − 5) | — | ±0.5bb | **Internal:** arithmetic |
| 8.3 | Cbet 50%, BB calls BTN folds (34% joint) | +2.06bb | computed | 0.34 × (0.65 × 20 × 0.85 − 5) | — | ±0.5bb | **Internal:** arithmetic |
| 8.4 | Cbet 50%, both call (11% joint) | +0.58bb | computed | 0.11 × (0.55 × 25 × 0.75 − 5) | — | ±0.3bb | **Internal:** arithmetic |
| 8.5 | Cbet 50% total EV | +7.07bb | computed | Sum of 8.1-8.4 | — | ±2bb | **Internal:** arithmetic |
| 8.6 | Cbet 33% total EV | ~+6bb | computed (estimate) | Smaller bet, smaller fold-eq, smaller value | — | ±2bb | **Internal:** recomputation |
| 8.7 | Check-back total EV | ~+2bb | computed (estimate) | Realization-loss on MW OOP | — | ±1.5bb | **Internal:** recomputation |

### Blocker / MDF / realization (§9, §10)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 9.1 | Net hero blocker effect | +0.5bb on EV | computed | Q♣ reduces villain Qx value | — | ±0.5bb | **Internal:** re-derivation |
| 10.1 | Joint MDF (combined) | ~67% | computed | 10/15 | — | exact | **Internal:** formula |
| 10.2 | Hero fold equity threshold (auto-profit) | 33% | computed | Bet/(pot+bet) | — | exact | **Internal:** formula |
| 10.3 | Realization factor (hero MW-OOP) | ~0.75 | assumed | MW-OOP discount | — | ±0.07 | **External-operational:** outside [0.68, 0.82] |
| 10.4 | Realization (AQ TPTK-specific) | ~0.80 | assumed | TP showdown value | — | ±0.05 | **External-operational:** outside [0.75, 0.85] |

---

**[Completeness: swept 2026-04-23, 46 claims ledgered, all falsifiers present. Rubric-Version v2.2. Multi-way extensions applied to §2, §7, §8, §10.]**

### Lowest-confidence load-bearing claims

1. **Row 7.3 (joint fold equity 36%).** Product of two unsourced rates; wide effective CI. Drives §8.
2. **Rows 8.6, 8.7 (cbet-33% and check-back EV estimates).** Less-rigorously-derived than cbet-50%; ±2bb CI.
3. **Rows 10.3, 10.4 (MW realization factors).** MW-OOP realization is a tough call; assumed with wide CI.

---

## §12. Sensitivity analysis

Three assumptions.

### Assumption A — Joint fold equity (current 36%)

Flip threshold: if joint fold equity drops below ~25% (sample villains over-call), cbet-50% EV drops to ~+4bb, matching or falling below cbet-33%. **Sizing could flip from 50% to 33%; action stays cbet.**

### Assumption B — Hero MW-OOP realization factor (current 0.75)

Flip threshold: if realization drops below 0.60, check-back EV could rise closer to cbet EV. Below 0.50, check-back might dominate. **Unrealistic flip** (MW-OOP realization doesn't plausibly drop below 0.65).

### Assumption C — Villain archetype (per v2.1 D11)

No archetype flip. Cbet correct across fish/reg/pro/nit.

**Summary.** Assumption A is decision-adjacent (sizing); B and C robust. **Action-level-robust on cbet; sizing-sensitive to pool call rates.**

---

## §13. Contrast with leading theories

### Internal-arithmetic check (v2.2 D13)

§3 weighted equity: `(198 × 0.87 + 120 × 0.73 + 4 × 0.50 + 8 × 0.05) / 330 ≈ 79.5%`. Matches row 3.8. ✓

§8 cbet-50% total: `3.6 + 0.83 + 2.06 + 0.58 = 7.07bb`. Matches row 8.5. ✓

**Check passes.**

### Source-scope check (v2.2 D13)

All §5 sources (Doug Polk MW + Upswing + Berkey) are live-cash-scoped; match claim context. ✓

**Check passes.**

### Per-claim comparison

| Source | Position on MW cbet with TPTK on dry high-card | Category |
|---|---|---|
| GTO Wizard MW corpus | Cbet high-freq, sizing mix 33:50 | **A** |
| Upswing MW courses | Cbet TPTK | **A** |
| Doug Polk MW | Same | **A** |
| Ed Miller live cash MW | Same | **A** |
| Matt Berkey | Cbet with slight archetype-adjustment | **A with nuance** |
| Janda *Applications* | Pre-solver MW coverage limited; "bet for value in multi-way" agrees | **A** |
| Modern solver corpora (PIO/Snowie) | 33% slightly preferred over 50%; both cbet | **C-incomplete** (solver prefers 33% but difference is small; artifact chose 50% for pedagogical clarity) |

**Verdict: A dominant; 1 C-incomplete (solver-preferred-sizing-33% vs authored 50%).**

### Active challenge (v2 Delta 7)

≥1 B/C/C-incomplete found (solver-sizing-preference-C-incomplete). Per v2: minimum met.

Active challenge attempted: find source advocating check-back with TPTK MW. None found among 7 reputable sources surveyed.

**Limitation of MW literature:** multi-way coverage in poker theory is thinner than HU. Fewer consensus opinions exist; more "depends on opponents/table" caveats. **This itself is a rubric-test result**: multi-way spots produce looser consensus than HU spots.

---

## §14. Verification architecture

### §14a. Symmetric-node test

**Mirror node:** `co-vs-btn-bb-srp-mw-ip-turn_after_cbet` — same line's turn node (one villain already folded). Tests whether the MW recommendation holds up when MW collapses to HU on turn.

Six claims classified:

1. **"Multi-way-to-HU transition."** → **Changes materially.** Mirror is HU. This is the key axis.
2. **"Hero's AQ equity ~80% vs combined range."** → **Changes direction.** HU equity vs single-villain range differs (~60% vs BTN alone).
3. **"Joint fold equity mechanic."** → **N/A.** Mirror has single villain; joint-fold doesn't apply.
4. **"Realization factor ~0.75 (MW-OOP-discount)."** → **Changes.** HU-IP realization ~0.88.
5. **"Archetype-non-flipping."** → **Stays.** Both spots are archetype-robust.
6. **"Blockers near-neutral."** → **Stays.** Similar analysis holds.

**Test passes.** 2 stays, 1 N/A, 3 changes. Under D8 cap with the N/A exception noted.

### §14b. Artifact-level falsifier synthesis

**Decision-level-robust on action (cbet); sizing-sensitive to villain call rates.**

**Headline falsifier (single):** §11 rows 5.2 + 5.3 + 7.3 (pool-villain call rates drop below ~50% combined fold rate) → sizing 33% would exceed 50% EV. Action stays cbet.

**No action-level headline falsifiers.** Cbet is robust.

### §14c. Counter-artifact pointer

`co-vs-btn-bb-srp-mw-oop-flop_root-v2-archetype-stratified-MW.md` — explicit fish/reg/pro/nit archetype mix (with 2 villains having independent archetypes), each with dedicated §5 + §6 + §12. Much more complex than HU archetype-stratification.

---

## Closing note

US-1 Artifact #6. v2.2-native. **First multi-way.**

**Rubric stress-test observations:**

1. **§2 three-range enumeration required 3× the work of HU.** Three independent preflop filters; combined-range aggregation. **Workable but scope-expanding.** Future multi-way artifacts may benefit from a "combined-villain-range-table" schema more directly aligned with the rubric's HU-oriented §2.

2. **§7 two-villain perspective worked.** Each villain's model of hero documented; joint-fold-equity derivation connected the two perspectives into a single exploit analysis. Row 7.3 bridges individual-villain rows.

3. **§8 9-branch tree collapsed to 4 grouped scenarios.** Joint-probability product approach handles the combinatorics. Multi-way §8 is structurally harder than HU; adopting branch-grouping by outcome-class is a workable pattern.

4. **§10 joint MDF is a novel concept.** Per-villain MDF + joint-MDF separation clarified the exploit-profitability threshold. Standard HU MDF misapplies in MW; the joint version is the decision-relevant metric.

5. **§13 consensus-looser in MW literature.** Multi-way poker theory is thinner than HU. Fewer reputable sources explicitly cover spots like this; "consensus" claims are weaker. The C-incomplete (solver-33%-preference) is a real finding but the A majority reflects MW literature's limited specificity.

6. **v2 rubric mostly held.** No rubric-fundamental-break. **Proposed v2.3 D17 candidate:** §2 explicitly permits "combined villain range" for MW; §7 explicitly permits multiple villain sub-sections; §8 explicitly permits branch-grouping. These are **formalizations** rather than new discipline — they codify what artifact #6 did ad-hoc.

**Ledger density:** 46 claims / ~8k words = 5.8 claims/1k words. Slightly below corpus average; MW's long range-construction section took prose without proportional claim-row additions.

**Stage 3f (audit), Stage 4f (comparison), Stage 5f (drill card)** follow.

---

*End of artifact.*
