# Gate A Dry-Run Sketch — `btn-vs-bb-3bp-ip-wet-t96-flop_root`

**Rubric-Version:** v1
**Status:** sketch (Stage 1.5 Gate A)
**Purpose:** 1-paragraph-per-section stress test of the v1 rubric. Catch hand-waving before committing to a full artifact. Each section below is ~100 words. The final section — "Rubric stress-test findings" — reports which forcing constraints produced concrete content and which degraded to platitudes.

---

## §1. Node specification

Small-stakes NL cash, 9-max. Effective stack 90bb. Hero BTN (IP), Villain BB (OOP). Pot at node: 20.5bb. Board: T♥9♥6♠, two-tone (hearts), middling-connected. Action history: `(BTN, open, 2.5bb) → (BB, 3bet, 10bb) → (BTN, call, 10bb) → flop dealt → (BB, donk, 6.8bb)`. Pot derivation: 0.5 SB + 10 + 10 = 20.5. **Prior-street filter:** BTN's preflop call sits inside a flatting range — pairs 22-TT-ish, suited broadways ATs-AQs, some suited connectors, minus the 4bet region — because hero called, not 4bet. BB's range is "3bet and continued to flop," i.e., the 3bet range un-narrowed (the flop was just dealt; no filter yet on that side).

## §2. Range construction, both sides

**Hero preflop filter chain:** BTN open ≈ 40% ≈ 530 combos → face 3bet → BTN 4bet (value+bluff) removes QQ+ most AK and some bluffs, leaving the call range ≈ 5-7% ≈ 60-85 combos (22-TT, AJs-ATs-A9s-A5s, KQs-KTs, QJs-QTs, JTs-T9s-98s, some suited one-gappers). **Villain preflop filter chain:** BB 3bet vs BTN open ≈ 5-6% ≈ 70-80 combos; composition in live pool: merged-leaning — QQ+ (18) + AK (16) + AQs (4) + KQs (4) + bluffs A5s-A2s (16) + occasional T9s/J9s suited offers. Total ~60-80 combos depending on pool. Hero combos reaching flop = 60-85; villain combos reaching flop = 70-80. Post-donk villain range is NOT the full 3bet range — it's the donk subset (§2 is the pre-donk range; donk filter lives in §3 and §4).

## §3. Equity distribution shape

Hero holds J♥T♠: top-pair-J, backdoor flush draw (one heart), backdoor straight draws.

**Bucketing hero-vs-villain's (pre-donk) 3bet range:** vs QQ+ (~24 combos): hero ~22% (overpair dominates, 4 outs to two-pair/trips + runners) → weak. vs JJ (3 combos, blocks one J): ~20% → weak. vs AK/AQ/KQ offsuit/suited (~30 combos): hero ~48% (top pair beats A-high, loses to overcards that pair) → medium. vs A5s-A2s bluffs (16 combos): ~72% → strong. vs slow-play candidates TT/99/66 (~9 combos): ~5% → air.

Distribution **vs full 3bet range:** ≈ 15% strong, 35% medium, 38% weak, 12% air. Average ≈ 40%.

**Critical:** the distribution shifts dramatically vs the donk subset (next sections). Donk range is polarized overpairs + A-high bluffs; most of the "medium" AK/AQ combos check-continue rather than donk. vs donk range specifically, hero's distribution bimodalizes: ~20% strong (bluff region), ~60% weak (overpair region), ~20% air (slow-play sets) — average equity drops to ~25-30%.

## §4. Solver baseline

Solver BB in this exact spot (3BP OOP on non-broadway middling two-tone T96ss, 90bb, vs BTN flatting range): **checks the flop at high frequency** (GTO Wizard, "Navigating Range Disadvantage as the 3-Bettor" — BTN flatting range on T96-type boards has more sets, two-pair, straight combos than BB's 3bet range; BB's overpair advantage does not compensate for the nut deficit, so BB checks). Donk frequency in solver ≈ 0-10% depending on sizing family. Solver recommendation for hero facing the rare solver-donk: **call ~85%, raise ~15%** at 33% sizing — top-pair-decent-kicker is well above the continue threshold vs the polar solver-donk (which is tight value + a few blocker bluffs).

## §5. Exploit recommendation (temporarily §6 per rubric order — noting to fix ordering in self-audit)

Hero action: **call**. Deltas: **vs §4 (solver):** identical action (solver also calls 85% of the time in the rare solver-donk case). Slight delta in intensity — we recommend pure call where solver has a small raise frequency; because §5 (population) shows the donk comes disproportionately from overpair-heavy range (live BBs donk overpairs for protection but don't balance with bluffs), a pure call realizes equity better than a raise that folds out the exact bluffs we're ahead of and gets called/3bet by the overpairs we're behind of. **vs §5 (population):** matches the exploit-adjusted line. Not a deviation — the exploit is in the size and composition of the call-range (wider than solver because population donk is more polarized toward overpair-value which we beat less), not in the action itself.

## §5 (correctly ordered). Population baseline

Live pool BB in this spot: **donks this flop 20-40% of the time** — much higher than solver. Composition: overpairs QQ+ donk for "protection" against wet board; occasional slow-played sets (TT/99/66); A-high blocker bluffs less frequent than solver (live pool bluffs less with made-hand frames). Citation: GTO Wizard "Exploiting BBs Who Never Donk-Bet" (inversion — articles on BBs who donk observe population over-donks on wet boards); LSW line-audit external-validation log for this node (category-D finding, D1). Stake qualifier: observation is cross-stake for 1/2 to 5/10 NL live cash; online rates are lower. **Sample-size flag:** no hard n — this is pattern-observation, not dataset.

## §6 (correct). Exploit recommendation — restating

Same recommendation as above. The forcing constraint of comparing to both §4 and §5 exposed a **rubric ordering bug** (§5 labeled population but §4 Exploit recommendation needs to come after both baselines). Rubric fix noted.

## §7. Villain's perspective

From BB's seat: "I 3bet a merged range; BTN called. Flop T96ss is coordinated — I have overpairs that want to charge draws, a few sets, and my A5s-A2s blocker bluffs. I model BTN's flatting range as flush-draw-heavy + pair+draw + some sets + broadway misses. **BTN's apparent range in my model is weighted toward drawing hands and medium pairs; BTN's actual range has more two-pair and set equity than I'm representing, because I'm over-weighting 'draws' (visible on wet texture) and under-weighting 'already-made hands' (less visible)**. My decision logic: donk overpairs because I want dead money vs draws; donk occasional A5s for balance; check the rest. I think hero facing my 33% donk is 'pair + draw or just draw' — I expect a lot of calls, some raises with stronger draws, some folds with total air." Key: villain's apparent-hero-range is draw-weighted; hero's actual range contains a material TP+ nut-advantage region villain underweights.

## §8. EV tree: depth 1, 2, 3

**Call branch.** Depth 1: pay 6.8bb to continue; equity realization ~90% IP; expected share = 34.1 × 0.28 (equity vs donk range) × 0.9 = 8.6bb gross → net ≈ +1.8bb relative to fold (fold = 0). Depth 2: turn decision tree — BB checks most brick turns per solver; hero bets/checks depending on runout. Heart/straight cards shift ranges; brick turn is +EV check-down or thin value. Depth 2 weighted EV ≈ +1.2 to +2.5bb over call. Depth 3: river realization depends on runout and line; estimated terminal EV ≈ +3-4bb over call-fold baseline on good runouts. **Raise branch.** Depth 1: raise to ~20bb; folds out A5s/A4s bluffs (we were beating), gets called/3bet by QQ+ (we lose to). Immediate EV: ~-0.5 to 0bb. Depth 2: raise-get-called-brick-turn plays badly OOP-of-villain-perception (we look capped after raise-call). Depth 3: bad. **Fold branch.** Depth 1-3: 0bb. Chosen action = call. Next-best = raise. Delta ≈ +2bb.

## §9. Blocker/unblocker accounting

Hero holds J♥ and T♠. **Blocks in villain value:** J♥ blocks JJ overpair (reduces from 6 combos to 3). T♠ blocks TT slow-play sets (reduces from 3 to 1 combo if TT would slow-play). Total value-combos blocked: 3 + 2 = 5. **Blocks in villain bluffs:** J♥ blocks nothing in the A5s-A4s bluff region (Ax not affected). T♠ blocks nothing. J♥ also weakly blocks a hypothetical KJs/QJs bluff donk if pool uses those, but that's fringe in BB 3bet range. Total bluff combos blocked: ~0-1. **Net effect:** hero's hand is *slightly value-unblocking-favorable* (removes more value than bluff) — shifts villain's donk-range value:bluff ratio from ~70:30 to ~68:32, a marginal improvement in hero's breakeven-fold-equity requirement (shifts threshold from ~20% to ~19.5%). **Net fold%: shift of ~0.5%**. Not meaningful. This is a hand that doesn't lean on blockers — it calls because the pot odds + equity + realization are fine, not because blockers tip the scale.

## §10. MDF, auto-profit, realization

**MDF:** pot / (pot + bet) = 20.5 / (20.5 + 6.8) = **75.1%** (villain needs hero to fold more than 24.9% for the donk to auto-profit; our call-wide range keeps hero above MDF easily). **Auto-profit threshold (hero fold-then-auto-profit):** hero folds are never auto-profitable at these pot odds — the threshold to call is low (~20% required equity) and hero has ~28%. **Realization factor:** IP on wet two-tone board, hero's flatting range realizes ~0.85-0.90 of its raw equity (position helps, wet texture + OOP-villain-can-barrel-polarized mildly reduces; the balance is ~0.88). Texture adjustment: wet two-tone IP with continuing-aggression risk = mild downward adjustment from the IP baseline of 0.90. SPR at flop: (90-10)/20.5 ≈ 3.9 — medium SPR zone per the app's SPR-zones (LOW 2-4), which disfavors speculative stack-committing plays and favors pot-controlled realization. SPR justifies the realization-factor conservatism.

## §11. Confidence ledger

Sketch-level ledger (abbreviated; full artifact requires every numeric claim above). Examples:

| Claim | Value | Source-type | Source | Sample | CI | Notes |
|---|---|---|---|---|---|---|
| BTN open frequency | 40% | population-cited | GTO Wizard opening ranges | — | — | Baseline; lowered-to-observation if live-NL specific |
| BB 3bet frequency | 5-6% | population-cited | Same | — | — | |
| Hero equity vs pre-donk range | ~40% | computed | Combinatorial weighted | — | — | Verified against LSW audit's 37-44% |
| Hero equity vs donk range | ~28% | computed + read | Inferred from donk-range composition; requires population read on donk composition | n≈0 | ±10% | **Low confidence — flag for §12** |
| Solver BB donk frequency on T96ss | ~0-10% | solver | GTO Wizard "Navigating Range Disadvantage" | — | — | |
| Pool BB donk frequency | 20-40% | population-observed | LSW audit D1 | n=0 (pattern obs) | very wide | **Lowest confidence — flag for §12** |
| MDF | 75.1% | computed | Formula | — | — | |
| Realization factor | 0.88 | assumed | Texture+SPR adjustment from POKER_THEORY.md §3 | — | — | |

The ledger exposes: two lowest-confidence inputs (donk composition + pool donk frequency) drive §3 and §5 — the sensitivity analysis will target these.

## §12. Sensitivity analysis

1. **Pool donk frequency (current: 30%, range 20-40%).** Flip threshold: if frequency is below ~8%, the "population exploit" story collapses (we're now facing a solver-sized donk, solver analysis dominates, hero still calls but recommendation converges to solver-line). Delta EV at flip: ~-0.3bb (small, because hero calls either way). Not decision-flipping.
2. **Donk range composition — ratio of overpair value to A-high bluff (current: 70:30).** Flip threshold: if ratio shifts to 50:50 (villain bluffs more), hero's equity vs donk range rises from ~28% to ~38%, and raise-branch EV rises above call — recommendation flips from call to mixed call/raise. Delta EV at flip: +1.5bb to raise. **Decision-flipping.**
3. **Realization factor (current: 0.88).** Flip threshold: if realization drops below 0.75, pot-odds break-even rises above hero's equity and call becomes -EV. Delta EV at flip: -0.8bb (fold becomes best). **Decision-flipping — but unrealistic shift** (0.88 → 0.75 would require SPR-shift or texture-shift we don't have).

Net: recommendation is robust to assumption 1, flips on realistic changes in assumption 2, flips only on unrealistic changes in assumption 3. **Assumption 2 is the load-bearing assumption — the artifact's integrity depends on its accuracy.**

## §13. Contrast with leading theories

**Source 1 — GTO Wizard "Navigating Range Disadvantage":** Claim that BTN has nut advantage on non-broadway middling boards in 3BP → **Category A** (agreement). **Source 2 — Matthew Janda, *Applications of NLHE*:** Janda's framework for donk betting (pre-solver) argues BB rarely donks any flop in 3BP → **Category D** (intentional divergence; we teach the live-pool exploit where pool donks frequently despite Janda's solver-era recommendation). Feed to `POKER_THEORY.md §9`. **Source 3 — Upswing "Should You Donk-Bet?"** claims donking is rarely right but sometimes correct on boards that favor OOP range → **Category A for the solver claim; Category D for application** (we're teaching the exploit). **Source 4 — Run It Once solver summaries:** affirms BB check-frequency on similar textures → **Category A**. **No Category B found** (our §4-§5 reasoning matches external sources). **No Category C found.** Total: 2A + 2D. **Honest-contrast check:** all-A was avoided (D entries exist), but absence of B/C suggests the sketch didn't pressure-test our own reasoning hard enough. Flag for full artifact: actively search for sources that disagree with the live-pool-exploit framing.

## §14a. Symmetric-node test

**Mirror:** `bb-vs-btn-3bp-oop-wet-t96-flop_root` — the same texture but with hero on the OOP 3-bettor side. Six claims and their expected behavior in the mirror:
1. "BTN has nut advantage on T96ss" → **inverts**: in the mirror, hero (BB) has range disadvantage, so the claim still favors the same-position player (BTN-side).
2. "Realization factor 0.88" → **changes**: IP → OOP realization drops to ~0.70-0.75.
3. "MDF ≈ 75%" → **stays** — MDF is pot-odds arithmetic, position-invariant. Justification: MDF is a function of bet sizing relative to pot, not position.
4. "Pool donk frequency 20-40%" → **stays** — population pattern is pool-behavioral, not position-symmetric. Justification: this is a reads-on-the-pool claim; pool behaves how it behaves regardless of whose perspective the artifact is written from.
5. "Hero equity vs donk range ~28%" → **inverts fully** — mirror hero (BB 3-bettor) has different hand class, different equity against mirror-villain (BTN caller).
6. "SPR ≈ 3.9" → **stays** — same stack depth, same pot; SPR is state, not perspective.
All "stays" claims have justifications. Test passes.

## §14b. Falsifier specificity

1. **If pool BB-donk frequency on non-broadway wet boards is below 10% across a cross-stake sample of n>500 observed hands, §5 population baseline is wrong** — the "live-pool exploit" framing collapses.
2. **If the donk composition (overpair:bluff ratio) in a sampled-and-categorized dataset is closer to 50:50 than 70:30, §12 assumption 2 is wrong** — the recommendation may flip to call/raise mix.
3. **If solver re-analysis at a deep-stack (200bb) condition shows BB donks T96ss at >30% frequency, §4 claim that solver checks is stake/depth-generalizable is wrong** — the artifact's solver baseline needs depth conditioning.

## §14c. Counter-artifact pointer

A stake-and-stack-depth-conditioned artifact that splits population baselines for 1/2 NL vs 2/5 NL vs 5/10 NL live cash, at 50bb / 100bb / 200bb effective stacks, would supersede §5, §10 (SPR dependency), and parts of §12 (the recommendation may flip at 200bb where BB's overpair-protection motive weakens).

---

## Rubric stress-test findings

**Sections that produced concrete, forcing-constraint-satisfying content:**
- §1 (setup derived pot algebraically; filter rationale nontrivial)
- §2 (combo arithmetic genuine; hand-class tables feasible at full scale)
- §3 (bimodality emerged naturally — the bucket-shape forcing constraint exposed that "hero equity ≈ 40% vs 3bet range" hides the critical distinction vs donk range specifically)
- §6 (delta-vs-§4-and-§5 forcing constraint made me explicitly state the exploit source)
- §7 (villain's apparent-hero-range forcing exposed real divergence — villain overweights draws, underweights nut-advantage)
- §8 (rejected-branch EV forcing made me quantify raise as -0.5 to 0bb, not just "raise is worse")
- §11 (ledger exposed two low-confidence load-bearing inputs before §12 — a clean forcing-constraint win)
- §12 (numeric flip thresholds worked; §12 correctly identified assumption 2 as load-bearing)
- §14a (mirror-node test forced position-invariance reasoning — the "stays" justifications are non-trivial)
- §14b (all three falsifiers passed specificity test — numeric thresholds present)
- §14c (counter-artifact pointer forced me to name the scope limits — stake and stack depth conditioning)

**Sections where the forcing constraint worked but exposed a rubric structure issue:**
- **§4 / §5 / §6 ordering bug:** rubric lists Solver baseline (§4) → Population baseline (§5) → Exploit recommendation (§6). In the sketch I accidentally authored §6 before §5 because the "delta vs §4 and §5" forcing constraint required both baselines to be pre-stated. Rubric text is correctly ordered but my mental model slipped — flag: **rubric could add an explicit "sections 4, 5, 6 must be authored in order; §6 cannot be drafted before §4 and §5 are complete"** statement.
- **§13 sketch found 2A + 2D and zero B/C.** The rubric's "must have ≥1 B/C/D" passed (D present), but the absence of B/C suggests I wasn't pressure-testing our own reasoning. Flag: **rubric should require ≥1 B or C specifically** (intentional divergence is easier to claim than "our reasoning was wrong" or "source was wrong").

**Sections with no hand-waving, no platitudes:**
- §9 (blocker accounting: forced combo-level enumeration; conclusion "not blocker-leveraged" is itself informative)
- §10 (MDF, auto-profit, realization: derived, not asserted)

**Sections that nearly degraded but were rescued by forcing constraints:**
- §7 (villain's perspective) — easy to write as a pronoun-swap; the "apparent-hero-range must differ from actual" constraint genuinely prevented that. Keep.

**Sections I suspect will degrade differently on river/preflop artifacts:**
- §8 (depth-3 collapses trivially for river decisions; rubric's "explicit collapse" language should survive — verify in Stage 2b).
- §9 (blockers are typically more load-bearing on river than flop; may produce denser content rather than "not leveraged" verdict).
- §2 (preflop-only range construction has no prior-street filter; may trip the "at each step" forcing constraint — consider rubric language: "at each step OR at node-entry if preflop").

## Proposed rubric v1.1 deltas (before Stage 2a full pilot)

1. **Add ordering constraint to §4-§6.** "Sections 4, 5, 6 must be authored in that order. §6 cannot reference unauthored §4 or §5."
2. **Strengthen §13 B/C requirement.** Current: "at least one B, C, or D across the artifact." Proposed: "at least one B **or** C required; D alone is insufficient — D is easier to claim than disagreement." If no B/C emerges naturally, the artifact must add an "Active challenge" sub-section in §13 explaining why the author could not find disagreement.
3. **Clarify §2 for preflop nodes.** Add: "For preflop nodes, the 'at each step' requirement applies to the node-entry decision (e.g., open-vs-fold-vs-3bet-vs-cold-call — all feasible decisions at this node) rather than prior-street filters."
4. **Expand §8's 'explicit collapse' language for depth-3.** Add examples: "For a river decision, depth 3 = showdown; for an all-in decision at any depth beyond, state 'pot closed at depth N.'"
5. **Optional: add a "perspective-collapse detector" to §7.** If the author writes villain's apparent-hero-range in fewer than 15 words, re-read — pronoun swap is the likely failure. (Heuristic, not hard rule.)

No fundamental issues. Rubric v1 is pilot-ready with these four incremental fixes.
