# Self-Audit — `sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call.md`
**Rubric version:** v2.2 (artifact v2.2-native)
**Auditor:** Claude (main, self-audit)
**Audit date:** 2026-04-23
**Status:** Stage 3d complete — verdict GREEN (light-to-moderate); one rubric-candidate batched

---

## Executive summary

**Verdict: GREEN (light-to-moderate).** Artifact #4 successfully stress-tests v2.2 on structurally-new properties (hero-OOP + fold-correct + bluff-catcher-with-value-hand + pot-size sizing + archetype-conditional-fold). **8 findings identified: 0 P1, 4 P2, 4 P3.** All findings are artifact-level polish or rubric-candidate batches.

**Unique-to-this-artifact finding:** v2.2 D13 internal-arithmetic check **fired three times during authoring** (§3 equity: 43% → 58% → 33%). This is the **first artifact where D13 discipline operated inline during composition rather than as post-hoc audit.** The iteration is visible in the published §3 prose as meta-observation.

**Blocker analysis revealed a counter-intuitive finding:** AA's blockers are **decision-unfavorable** on this runout (hero blocks more bluff than value). This is poker-theoretically interesting — challenges the naive "top preflop hand = best bluff-catcher" framing. Could inform a POKER_THEORY.md §5-equivalent update if the pattern generalizes beyond this node.

**v2.1 D11 archetype-conditional form was applied asymmetrically for the first time** (default fold / override call vs pro) — distinct from river pilot's default call / override fold vs nit. The form works for fold-default cases.

---

## Scope

- Sections audited: all 14
- Methodology: walk each section against v2.2 forcing constraints
- Out of scope: theory correctness (Stage 4d); drill-card extractability (Stage 5d)

---

## Cross-section observations

### CSO-1 — v2.2 D13 discipline firing inline during authoring

§3 contains an unusual meta-observation: three iterations on the equity calculation before convergence. This is D13 working **inline** — the author recomputed and noticed the first-pass answer was above the credible interval, triggering a re-examination, which found the error (included QQ/KK/JJ as hero-beats without checking whether they bet river). The §3 prose documents the iteration transparently.

**Meta-implication for rubric:** D13 is most valuable when it catches errors during authoring (artifact #4) rather than after-the-fact (pilots). The rubric could encourage inline D13 invocation as the author writes §3, §8, §11.

### CSO-2 — Row 2.5 per-class/aggregate mismatch is a first-pass-discipline finding

§2's BTN check-back range table has per-class frequencies that sum to ~36 combos, but the aggregate-level estimate (35% of 58 = 20.3) is lower. Per v2.1 D10, per-class values were preserved without back-solving; the mismatch is flagged explicitly in row 2.5.

**This is D10 working correctly.** The mismatch could be resolved by:
- (a) Adjusting per-class frequencies downward to match 20.3-combo aggregate.
- (b) Raising the aggregate estimate (maybe 55-60% of 3bet range actually checks back flop on this wet disadvantaged texture — solver numbers would support higher).
- (c) Acknowledging the tension and moving on.

Artifact chose (c) + transparent flag. This is v2.1 D10 discipline literally working as intended.

### CSO-3 — Blockers as decision-unfavorable is corpus-novel

All prior artifacts had blockers that were value-favorable (flop pilot) or blocker-neutral (river pilot, artifact #3). Artifact #4's finding that hero's AA blockers are **actively harmful** (block more bluff than value) is a new pattern.

**Why it matters theoretically:** the naive intuition "AA is the best starting hand, therefore best bluff-catcher on any runout" is wrong on specific runouts. On scare cards where villain's bluff region is A-high hands, AA blocks exactly those A-high bluffs without blocking the spade-nut-flush value. **This is a POKER_THEORY.md-worthy observation** — could contribute to a future §5-equivalent entry on "blocker value is runout-conditional, not preflop-strength-conditional."

**Audit recommendation:** flag this as a Stage-4-or-later candidate for POKER_THEORY.md enrichment. Not urgent; tracked.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Preflop pot derivation footnote is verbose** (severity 1, P3)
  - §1 has two paragraphs explaining the pot = 21bb derivation. Could be one line.
  - Fix: compress to single sentence: "Preflop: SB open 3bb, BTN 3bet to 9bb, SB call 6 → pot 21bb."
  - Severity P3, effort S. Backlog: `US-A4-F1a`.

### §2. Range construction

- **F-2a — Row 2.5 per-class/aggregate mismatch (BTN flop check-back range)** (severity 2, P2)
  - See CSO-2. First-pass sum 36 combos; aggregate 35% × 58 = 20.3. Preserved per D10; flagged inline.
  - Fix options: (a) per-class downward adjustment; (b) aggregate upward (argue solver check-back is higher on disadvantaged wet); (c) acknowledge + move on (chosen).
  - Recommend: flag but don't refit — the §3 equity calculation doesn't propagate from BTN's check-back range aggregate; it only uses the river-bet range (row 2.10), which was internally consistent after D13 iteration.
  - Severity P2, effort S. Backlog: `US-A4-F2a`.

- **F-2b — SB preflop flat range size (~40 combos) is pool-inferential** (severity 2, P2)
  - Hero's assumed range is heavily pool-dependent (live-pool SB-flat-3bet is rare per §9.3). The ~40-combo estimate for SB's flat-3bet range in live cash is the author's synthesis from §9.3 + live-pool flat-QQ/JJ/TT patterns.
  - Fix: explicit citation to §9.3 ledger; acknowledge the ~40-combo estimate as `population-consensus-observed` (candidate v2.3 D14 source-type).
  - Severity P2, effort S (or rubric-minor). Backlog: `US-A4-F2b` + D14 candidate already in v2.3 queue.

### §3. Equity distribution

- **F-3a — §3 contains visible iteration prose ("Let me re-examine... Stage-4-equivalent internal check...")** (severity 1, P3)
  - Observation: the three-iteration D13-during-authoring is documented transparently but creates visible "drafting in public" prose that some readers may find distracting.
  - Fix options: (a) clean to final answer only with a ledger-row-note about the iteration (hides provenance); (b) keep as-is (educational value for future authors seeing D13 work inline); (c) consolidate into a single "D13 audit trail" subsection at end of §3.
  - Recommend: (c) — preserves provenance without cluttering main prose. Low priority.
  - Severity P3, effort S. Backlog: `US-A4-F3a`.

- **F-3b — Final equity value ~33% is at exact pot-odds threshold, decision-marginal** (severity 2, P2)
  - Observation: hero's computed equity 33% matches required equity 33% exactly. Raw EV(call) ≈ -0.5bb. Decision is marginal at the top-level; §9 blocker adjustment tilts to clear fold (-6.4bb).
  - This isn't a rubric violation but is a spot-characterization concern: does §6 recommendation robustness depend on the blocker adjustment? If so, §6 should explicitly cite §9 as a load-bearing reinforcement.
  - Fix: strengthen §6 prose to reference §9's blocker-adjustment as part of the fold-default justification.
  - Severity P2, effort S. Backlog: `US-A4-F3b`.

### §4. Solver baseline

- **F-4a — Solver claim 4 (against live-pool-estimated 67:33) assumes MDF-indifferent solver rather than solver-against-exploit** (severity 1, P3)
  - Observation: claim 4 says "solver at live-pool composition = 50% call / 50% fold mix." But solver doesn't see live-pool composition — solver plays against solver's own range. The correct framing is "solver-against-balanced = 95% call; solver's *play against live-pool-estimated range* = what we as exploiter would do = 50% call mix or fold-default-with-override."
  - This is a semantic refinement. The artifact's broader conclusion (fold in live cash) is correct.
  - Fix: clarify "solver-against-balanced-range" vs "solver-equivalent-exploiter-against-live-pool-range."
  - Severity P3, effort S. Backlog: `US-A4-F4a`.

### §5. Population baseline

- **F-5a — Population source-consensus framing again (carry-over from artifact #3 F-5a)** (severity 2, P2)
  - Observation: §5 Claim 1 (live pool value-heavy scare-river-bets 70-80% value) cites consensus of 3 coaches. Same framing as artifact #3's F-5a. Candidate v2.3 delta D14 (`population-consensus-observed` source-type).
  - Severity P2, effort rubric-minor. Backlog: merged with existing D14 candidate.

### §6. Exploit recommendation

- **F-6a — Archetype-conditional form is cleanly applied** (severity 0, no fix)
  - Observation: §6 correctly structures Default: Fold / Override: Call vs Pro per v2.1 D11. First fold-default application of D11. **This is a positive finding** (rubric working as designed), not a weakness.

### §7. Villain's perspective

- **F-7a — Villain's model correctly identifies hero's range AND villain's execution exploits it** (severity 0, no fix)
  - Observation: unlike flop pilot (villain over-weights draws — model error) and river pilot (villain's model correct, execution over-bluffs), this artifact's §7 has BOTH sides accurately modeling each other. The asymmetry is purely at the **exploitative-composition** level (villain expects SB to over-call; exploit is to under-call).
  - This is a meta-new type of asymmetry — "game-theoretic expectation" rather than "imperfect information."
  - Fix: none required. Worth flagging as a corpus-level pattern for future artifacts.
  - Severity 0.

### §8. EV tree

- **F-8a — Call branch EV (-0.5bb at 33% equity) is essentially break-even** (severity 2, P2)
  - Observation: raw call-EV before blocker adjustment is nearly zero. The decision only flips to clear-fold after §9 blocker adjustment (-6.4bb). §8 could acknowledge this more directly.
  - Fix: reorder §8 to present EV both with and without blocker adjustment; make the blocker's role in the fold decision more prominent.
  - Severity P2, effort S. Backlog: `US-A4-F8a`.

### §9. Blocker / unblocker

- **F-9a — Blocker-unfavorable finding is corpus-novel and poker-theoretically interesting** (severity 0 but flagged for POKER_THEORY.md enrichment)
  - Observation: see CSO-3. Hero's AA blocks more bluff than value on this runout; first artifact where blockers are actively harmful.
  - Fix: none for artifact; flag for future POKER_THEORY.md §5-equivalent enrichment.
  - Severity 0 (positive finding, not violation). Backlog: `US-A4-F9a-theory-enrichment` (low priority, tracked for future theory-doc work).

### §10. MDF / realization

- **F-10a — MDF discussion on how range-aggregate MDF doesn't map to individual-hand decision is valuable but could be rubric-formalized** (severity 1, P3)
  - Observation: §10 contains a sentence "This is the canonical 'MDF doesn't map cleanly to individual hand decisions on exploit-against-skewed-ranges' lesson." This is a real teaching point; could warrant formal rubric recognition (e.g., §10 forcing constraint: if MDF-at-range-level diverges from individual-hand-correctness, explicitly note why).
  - Severity P3, effort rubric-minor. Backlog candidate D15 (minor).

### §11. Claim-falsifier ledger

- **Clean.** 52 rows, falsifiers present on all. Completeness log at `[swept 2026-04-23]`. Meta-observation about D13-during-§3 is in load-bearing claims summary. No findings.

### §12. Sensitivity analysis

- **Clean.** Three assumptions, numeric thresholds. Archetype-conditional flip correctly identified. No findings.

### §13. Contrast with leading theories

- **F-13a — "No B-wrong found" is consistent with artifact #3 Stage 4 pattern** (severity 1, P3)
  - Observation: §13 attempted B-wrong probes, found only C-incomplete. Same consensus-robust pattern as artifact #3's Stage 4c.
  - This is corpus-emergent: consensus-oriented spots produce thin external challenges. Not a rubric violation, but may warrant a v2.3 delta requiring **explicit documentation of the consensus-check search depth** (how many sources tried, which angles attempted) so that "no B found" is verifiable vs hand-waved.
  - Severity P3, effort rubric-minor. Backlog: v2.3 D16 candidate (minor).

### §14a. Symmetric-node test

- **Clean.** 6 classifications, under D8 cap. Mirror node choice is structurally apt (same polar-bet-on-river but role-flipped IP↔OOP). No findings.

### §14b. Artifact-level falsifier synthesis

- **Clean.** Two headline falsifiers, both traceable to §11, both with numeric thresholds. First falsifier-pair where both are decision-flipping (unlike artifact #3's single sizing-flip falsifier). No findings.

### §14c. Counter-artifact pointer

- **Clean.** Two counter-artifacts named. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-2a — row 2.5 per-class/aggregate mismatch | 2 | P2 | S (flag only) | Artifact |
| 2 | F-2b — SB preflop range pool-inferential | 2 | P2 | S or rubric-minor | Artifact / D14 candidate |
| 3 | F-3b — equity 33% decision-marginal, §6 could cite §9 | 2 | P2 | S | Artifact |
| 4 | F-5a — consensus source-framing (carry) | 2 | P2 | rubric (D14) | Rubric |
| 5 | F-8a — §8 could present EV with + without blocker | 2 | P2 | S | Artifact |
| 6 | F-1a — §1 pot-derivation verbose | 1 | P3 | S | Artifact |
| 7 | F-3a — §3 iteration prose visible | 1 | P3 | S | Artifact |
| 8 | F-4a — solver-against-balanced vs exploit framing | 1 | P3 | S | Artifact |
| 9 | F-10a — range-vs-hand MDF divergence rubric-formalization | 1 | P3 | rubric (D15 candidate) | Rubric |
| 10 | F-13a — consensus-check search depth rubric-formalization | 1 | P3 | rubric (D16 candidate) | Rubric |

**Breakdown:** 0 P1, 5 P2, 5 P3. Same shape as artifact #3 (0 P1, 4 P2, 7 P3). Neither P1 findings nor fundamental rubric gaps.

**Three rubric-candidates batched:** D14 (`population-consensus-observed`), D15 (range-vs-hand MDF note), D16 (consensus-check depth). None urgent.

---

## Proposed rubric v2.3 deltas (candidates for batching)

### D14 (carry-over) — `population-consensus-observed` source-type

See artifact #3 audit. Trigger: F-5a recurs in artifact #4.

### D15 (new) — §10 range-vs-individual-hand MDF divergence flag

**Trigger.** Artifact #4 §10 discusses that range-level MDF (50% defend) doesn't map to individual-hand decisions when range is skewed against specific runout. This is a real teaching insight but isn't currently a rubric-forced output.

**Proposed change.** §10 forcing constraint adds: "If range-level MDF diverges from individual-hand-correctness (individual hand in top-of-range by preflop strength doesn't meet MDF requirement due to runout-conditional range composition), artifact must explicitly state why."

**Cost.** Small (one forcing-constraint sentence). **Benefit.** Surfaces the range-vs-hand-correctness insight explicitly where applicable.

### D16 (new) — §13 consensus-check search depth documentation

**Trigger.** Both artifact #3 and artifact #4 §13 found "no B-wrong" via brief internal probes. This is fine when the spot is genuinely consensus-robust but could be avoidance in other cases. Rubric could require explicit documentation of what was tried.

**Proposed change.** §13 forcing constraint adds: "When claiming no B-wrong surfaces after active-challenge attempt, list (a) number of distinct sources probed for disagreement, (b) specific angles attempted (contrarian camps, pre-solver era, elite coaching, tournament-specific, etc.), (c) closest-to-disagreeing source found and why it categorized A rather than C/B."

**Cost.** Small (one §13 subsection when invoked). **Benefit.** Makes consensus-check honesty auditable.

**All three deltas are P3 polish. Batch when 4-5 accumulate.** Current batched: D14 (from artifact #3) + D15 + D16 from artifact #4 = 3 candidates.

---

## Audit sign-off

- **Drafted by:** Claude (main, self-audit)
- **Verdict:** GREEN (light-to-moderate). 10 findings; 0 P1, 5 P2, 5 P3. All artifact-level polish or rubric-batch candidates.
- **v2.2 assessment:** survived hero-OOP + fold-correct + AA-bluff-catcher + archetype-conditional-fold + pot-size-bet stress tests. D13 fired **inline during authoring** for the first time; discipline working as intended pre-audit. D11 archetype-conditional form applied asymmetrically (fold default, call override) — form works for both directions.
- **Novel finding (CSO-3):** blocker analysis revealed AA-blockers are decision-unfavorable on this runout. Corpus-new observation; may inform future POKER_THEORY.md §5-equivalent work.
- **Next step:** Stage 4d (leading-theory comparison) + Stage 5d (drill card) complete the chain.
