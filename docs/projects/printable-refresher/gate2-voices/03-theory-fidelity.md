# Gate 2 Voice 3 — Poker Theory Fidelity — Printable Refresher

**Date:** 2026-04-24
**Voice:** Poker theory + anti-pattern audit
**Stages owned:** Pre-check + Stage E (heuristic compliance with POKER_THEORY.md)

## Summary

The feature is **survivable but only under an aggressively narrowed scope**. Roughly half the user's proposed content types either carry embedded anti-patterns (labels-as-inputs, sizing-as-range-shape, calling-station-as-weak-range) or cannot be reduced to a lamin­ate-sized card without losing the conditioning that makes them non-harmful. **Three of the user's own named cards are RED as written** and either need fundamental reformulation or refusal. The "pure plays + exceptions" frame is sound *only* if provenance is unambiguous on every card — pure comes from `pokerCore/preflopCharts.js` / solver data; exceptions are population-baseline deviations (never per-villain-labelled). The refusal of per-villain calibration onto paper is the single load-bearing constraint of this voice: if calibration leaks onto laminate, the whole surface fails I-AE-7 (signal-separation) and we ship a permanent wrong-answer vector.

## Card-type audit

| # | Content | Verdict | Anti-pattern ID / theory cite | Reformulation |
|---|---------|---------|-------------------------------|---------------|
| 1 | Per-seat × per-hand preflop charts | GREEN (conditional) | — (POKER_THEORY §2.1) | Must declare stakes, rake, effective stacks, field-default opens. Lineage footer to `pokerCore/preflopCharts.js`. One-chart-per-card granularity. |
| 2 | Auto-profit bluff thresholds | GREEN | POKER_THEORY §6.3, §3-formula | Show formula `breakeven = bet/(pot+bet)`, table of sizings → threshold. NEVER pair with villain labels. |
| 3 | Geometric bet-sizing table | GREEN | POKER_THEORY §1.5, §6.2 | Show SPR → three-street geometric sizing to target river commitment. Pure math, no archetype. |
| 4 | Pot-odds → equity-required | GREEN | POKER_THEORY §1.5 | Standard table. Trivially correct. |
| 5 | Implied / reverse-implied odds | GREEN (conditional) | POKER_THEORY §1.5 | OK as formula card (`IO = future_win * hit% / call`). Disallow hand-named examples like "call 65s for set-mine" — that creeps into labels. |
| 6 | Binomial all-in survival chart | GREEN | Standard stats | Pure math. Table of `P(survive k of n at p%)`. No poker labels. |
| 7 | Equity-bucket chart per flop texture | YELLOW | POKER_THEORY §3.1, §7.3 | Acceptable only as *range-level* aggregation (e.g., "vs UTG 12% open: on KQ7r, 18% nuts / 22% strong / 30% marginal / 20% draw / 10% air"). MUST cite which range was segmented. Per-combo lookup is forbidden on laminate — use equity-required table instead. |
| 8 | Hand-type × texture EV matrix | YELLOW | POKER_THEORY §1.4, §3, §7.3 | Reformulate as an *equity-reference* table (hand vs texture → raw + realized equity), NOT a strategy-prescription table. No "bet" / "check" column. Strategy emerges from combining this card with card #2/#3/#4. |
| 9 | Bluff-catching checklist | YELLOW | POKER_THEORY §4.2, §5.6; anti-pattern "calling-station-as-weak-range" | Must be conditioned on pot-odds + bluff-to-value ratio, not villain label. Replacement: "Facing bet B into pot P → you need villain bluff% > B/(P+B). Call if your read of bluff-to-value ratio in this line exceeds that threshold." |
| 10 | "Pure plays" chart | GREEN (conditional) | — | Acceptable if defined as "solver near-100% on one action at this node" and cited to preflop / solver source. Separate card from exceptions (F2). |
| 11 | "Exceptions" chart | YELLOW | POKER_THEORY §9 (Documented Divergences) | Acceptable only if every exception is a *population-baseline* deviation (live-pool level) with cited audit id (e.g., §9.4 donk composition skew). Never a per-villain exception. |
| 12 | **Per-villain-archetype deviation chart** | **RED** | labels-as-inputs (§7); calling-station-as-weak-range (exploitEngine anti-pattern); double-count (§7.4) | **Refuse.** Archetypes collapse multiple independent axes (frequency, sizing, calling-range shape) into one label. Reference F3 — the replacement is a *population-baseline vs observed* calibration dashboard that stays on-screen. |
| 13 | **"56s in CO vs deep-stack fish 3-bet" decision card** | **RED** | labels-as-inputs; double-count; sizing/stack as label-not-input | **Refuse** as worded. Reformulate only as a *decomposed* card: "3-bet IP with suited-connector when SPR(post-3bet) ≥ Y AND opener's fold-to-3bet > threshold AND implied-odds realization gap ≥ Z bb/100." Even that is closer to a drill than a laminate entry. Recommend: refuse, send to drill surface. |
| 14 | **"Don't bluff calling stations" card** | **RED** | calling-station-as-weak-range; fold-equity ≠ fold-frequency | **Refuse.** Calling station has uncapped call-range (POKER_THEORY §5.5, exploitEngine anti-pattern §"calling station"). The card is *wrong* as written — the correct exploit is "value bet wider AND bigger." Replacement card: "When observed `foldToBet(size)` < breakeven for a sizing, bluffs at that sizing are -EV; value bets gain from the same observation." Phrased purely in observed frequencies, no label. |
| 15 | "Fold to turn check-raise — underbluffed line" | YELLOW | POKER_THEORY §4.2, §9.5 | Survivable if and only if: (a) explicitly scoped to a specific line/texture (SRP IP checked-back turn → OOP river XR is NOT the same as 3BP OOP XR), (b) cites population bluff-to-value baseline from LSW §9.5, (c) says "default baseline — override when observed villain bluff% in this line ≥ threshold." Without those three, becomes "blanket always-fold" = anti-pattern. |
| 16 | ICM bubble push-fold laminate | GREEN | Standard Nash ICM | Nash push-fold is solver-derivable; ship as-is with structure / blinds / ante / stack-depth parameters declared. |
| 17 | SPR zone strategy quick-reference | GREEN (conditional) | POKER_THEORY §3; MH-09 | Acceptable as "SPR zones → commitment consequence" (MICRO/LOW/MED/HIGH/DEEP → what it implies about turn/river geometry). NOT as "SPR X → do Y" — frame as structural consequence, not prescription. |

## Load-bearing findings

### F1 — Minimum information content bar

Every card must clear **five** required fields to print:

1. **Stakes + rake** declared (or `rake-agnostic` stamped).
2. **Effective stacks** declared (e.g., 100bb, 60bb, 40bb).
3. **Scenario conditioning** declared (e.g., "CO vs UTG open, 3-handed, SRP").
4. **Source util** cited in footer (e.g., `src/utils/pokerCore/preflopCharts.js@v1.0`).
5. **Math shown, not asserted.** Threshold cards must carry the formula, not just the answer. A "33% breakeven fold for half-pot bluff" is useless without `breakeven = bet/(pot+bet)` alongside — otherwise the user memorizes a number without the derivation, which fails the moment pot geometry changes.

Additionally, **no card may contain a villain-archetype label as decision input**. Labels may appear only as (a) historical population-prior annotations ("typical 1/2 field has ~40% VPIP fish proportion") or (b) glossary entries.

### F2 — "Pure plays + exceptions" frame soundness

**Sound if structurally separated, unsound if mixed.**

- **Pure plays card** ≈ solver-baseline for a node where solver is ~100% on one action. Source: `preflopCharts.js` for preflop; documented solver outputs for specific spots. Attribution: "solver baseline / GTO."
- **Exceptions card** ≈ population-level deviation from solver, always with cited reason (POKER_THEORY §9 entries are the template — each exception has divergence, justification, source). Attribution: "live-pool deviation — see §9.X."

A single card mixing both is **refused** because it obscures provenance. The anti-pattern the refresher must not encode: "solver says X but vs Fish do Y" — that is labels-as-inputs glued to solver output with no math, exactly the phrasing the user's own examples carry.

### F3 — Per-villain-archetype content

**NO** general archetype-based decision cards. This is the hardest line in the audit.

Justification chain:
- "Fish" is defined by VPIP>40 + PFR<10 (POKER_THEORY §5.5 table). "Fish exploit" from refresher + observed VPIP from app = style adjustment stacked on the stats that define style = double-count (§7.4, exploitEngine anti-pattern).
- "Calling station" = uncapped call-range (§5.5 + exploitEngine anti-pattern). A card saying "vs calling station, [do X]" under-specifies the actual exploit (value bet *wider AND bigger*, never bluff) and risks the reader remembering only the label.
- Archetypes collapse at least three independent axes (fold%, call-range shape, sizing-tell correlation) into one dimension. The paper-card format cannot carry the decomposition.

**Permitted substitute:** a *structural* card showing **HOW** population-baseline-vs-observed calibration shifts recommendations — e.g., "When `observed_foldToBet[half-pot] - population_baseline > 15pp`, the auto-profit threshold relocates from sizing S1 to sizing S2." That is reference material about calibration mechanics, not a per-villain decision rule. Per-villain calibration itself stays on-screen (Calibration Dashboard, LiveAdviceBar) — never laminated (see F6).

### F4 — Postflop hand-type × texture survival

**NO** at card size for "56s plays like X on T98ss" framing. **YES** for decomposed equity reference.

The user's postflop example ("56s on suited / connected / ABB / medium / low-low-low / A92r") survives only as:
- An **equity reference table**: hand × texture → raw equity + realization factor + nut/draw categorization. This is category-D POKER_THEORY §7.3 "range-level aggregation" — acceptable because it's reference data, not strategy.
- Combined with cards #2, #3, #4, #17, the user derives strategy at the table.

What does **NOT** survive:
- "56s on A92r = bluff-cbet" — prescription card, labels-as-inputs (hand + texture → action with no math).
- "56s on T98ss = check-call" — same failure mode.

The card becomes a **decomposition primitive**, not a strategy rule. This is a significant scope reduction from the user's stated ask; Voice 5 should flag for owner interview.

### F5 — "Rules of thumb" policy

**Draw the line thus:**

- **Computable shortcuts from first principles are OK.** MDF, auto-profit threshold, pot-odds, SPR bucketing, geometric-sizing, breakeven-bluff-frequency, Nash ICM push-fold — these are mathematical derivations from game state. They are "rules" only in the sense of "formulas with tabulated values." Print them.
- **Rules of thumb based on opponent labels or hand names are NOT OK.** "Don't bluff stations," "iso fish OOP always," "3-bet 56s vs deep fish" — all refused. They conflate observation with prescription and skip the decomposition that makes the math correct.
- **Gray zone: population-baseline reads (POKER_THEORY §9 entries).** Acceptable only with cited audit id, divergence justification, and "override when" condition printed alongside.

### F6 — Calibration segregation

Per-villain calibration output (from `assumptionEngine/`, `exploitEngine/villainDecisionModel.js`, `villainObservations.js`) **MUST NOT** appear on any laminated card. Enforcement mechanisms:

1. **Source-util whitelist for print:** Cards may only source from `pokerCore/` (preflopCharts, rangeMatrix, boardTexture), `gameTreeConstants.js` (population baselines only), POKER_THEORY.md derivations, and POKER_THEORY §9 documented-divergence entries. Any card whose source includes `villainDecisionModel`, `villainObservations`, `villainProfileBuilder`, `assumptionEngine`, or `calibrationDashboard` → **refuse at build time**.
2. **Content-drift CI test** (Voice 5 spec): lint every card's source-trail footer against the whitelist. Fail CI if any card pulls from per-villain-calibrated modules.
3. **Reference-mode contract** (per Shape Language Gate 3): refresher is write-silent. No observed-session data ever mutates printed-card state, because there is no printed-card state — only templates with population-baseline instantiation.

Per-villain calibration lives exclusively on screen (Calibration Dashboard, LiveAdviceBar, per-seat assumption cited-decision card) where the one-villain-one-sample scope is preserved and where the assumption can be retracted when invalidated.

## Proposed card-fidelity-bar (doctrine for Gate 4)

Any card proposing to print MUST clear all six:

1. **No archetype-as-input.** Villain labels (Fish/Nit/LAG/TAG/Station/Maniac) may appear only as glossary or historical population annotations, never as decision inputs.
2. **Math visible.** Thresholds show the formula; tables show the derivation parameters; no "trust-me" numbers.
3. **Scenario-declared.** Stakes, rake, effective stacks, position-vs-position context, SRP/3BP framing — every card carries its conditioning.
4. **Source-trail footer.** Every card cites the `pokerCore/` or `gameTreeConstants` util, or the POKER_THEORY.md section / §9 audit id it derives from. Blacklist any per-villain-calibrated source (F6).
5. **Pure/Exception provenance unambiguous.** Solver baseline and live-pool deviation never mixed on one card; always separately cited.
6. **Prescriptions are computed, not labelled.** A card that says "do X in situation Y" must decompose Y into game-state inputs (equity, pot-odds, SPR, players-remaining) and derive X from them.

## Content types to refuse (RED verdicts)

1. **#12 — Per-villain-archetype deviation charts.** No general-archetype decision cards. Replacement: population-baseline-vs-observed calibration *mechanics* card (structural, not prescriptive), with per-villain calibration itself kept on-screen.
2. **#13 — "56s in CO vs deep-stack fish 3-bet" decision card.** Labels-as-inputs + stack-depth-as-label. Can only be decomposed into: implied-odds realization table + SPR zone card + fold-to-3bet auto-profit card. At that point it's not one card, it's three — and the three already exist in the GREEN list.
3. **#14 — "Don't bluff calling stations."** Worse than refused — it's *wrong*. Calling station has uncapped call-range; correct exploit is value-bet-wider-AND-bigger. Replacement card: "When observed `foldToBet(size)` < breakeven, bluffs at that sizing are -EV and value bets at that sizing gain from the same read."

## Stage verdict signal

- **Overall: ⚠️ YELLOW (leaning RED) — survivable with aggressive scope reduction.**
- **Rationale:** Of 17 proposed content types, 7 GREEN (potentially 9 with conditional GREEN), 5 YELLOW (reformulation mandatory), 3 RED (refuse or fundamentally rebuild). The RED items are the three the user named explicitly in the request, which strongly suggests the user's mental model of the feature currently carries the anti-patterns — Gate 3 owner interview is load-bearing.
- **Scope-narrowing recommendation if RED persists:** Split into three narrower surfaces:
  1. **Preflop Refresher** (cards 1, 10 pure-preflop, 16 ICM push-fold) — highest-leverage, lowest anti-pattern risk, ship first.
  2. **Math Tables** (cards 2, 3, 4, 5, 6, 17 — auto-profit, geometric, pot-odds, implied, binomial, SPR zones) — pure derivations, trivially correct, ship second.
  3. **Texture-Equity Reference** (cards 7, 8 reformulated as equity-only, 11 exceptions codex with §9 backing, 15 with three-way conditioning) — ship last, with per-card fidelity review.
  
  Cards #9 (bluff-catch), #12, #13, #14 → refuse entirely, redirect to drill surface or on-screen calibration dashboard where the decomposition can be carried.

## Recommended follow-ups for Gate 3 / Gate 4 / Gate 5

- [ ] **Gate 3 owner interview (mandatory).** Surface the three RED cards (#12, #13, #14) to owner explicitly. Confirm: does owner accept the refusal + decomposed replacements, or does owner insist on the labelled phrasing? If the latter, the project's fidelity doctrine and the owner's mental model are in conflict — that is a program-level issue bigger than one feature, and should escalate.
- [ ] **Gate 3 research.** Survey competitor refreshers (Upswing, Crush Live, Bart Hanson, Amazon laminates) — how do *they* handle the archetype-label problem? Hypothesis: they ship the labels and the anti-patterns come with them. Our differentiation is precisely *not* shipping those.
- [ ] **Gate 4 surface spec.** Printable-refresher surface spec MUST include the six-point fidelity bar (F1+F5 doctrine) as a binding checklist per card, not a guideline.
- [ ] **Gate 4 content-drift CI spec.** Lint every card's source-trail against the F6 whitelist; fail CI on per-villain-calibrated source.
- [ ] **Gate 5 per-card fidelity review.** Every card authored runs through a theory-fidelity checklist before printing. Postflop cards (highest anti-pattern risk) go through a second review by Voice 3 equivalent.
- [ ] **Gate 5 scope-narrowing decision.** Phase preflop + math tables first; postflop cards last; explicit go/no-go on refused cards after Gate 3 interview.
- [ ] **Gate 5 versioning.** Every card carries `v1.0 / 2026-MM-DD / source-util@hash`. A change in source util re-versions affected cards. In-app staleness banner warns owner. This addresses PRF-NEW-3.
- [ ] **Cross-voice synthesis.** If Voice 1 (UX) and Voice 5 (engineering) disagree on refusal of #12-#14, load-bearing tiebreaker is Voice 3 (this voice) because the cards are poker-wrong, not merely poker-unstyled. Doctrine > preference.
