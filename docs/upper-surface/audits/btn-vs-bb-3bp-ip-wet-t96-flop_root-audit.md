# Self-Audit — Upper-Surface Artifact `btn-vs-bb-3bp-ip-wet-t96-flop_root`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md`
**Rubric version:** v1.1 (pilot-ready)
**Auditor:** Claude (main, same session as artifact author — this is self-audit, not independent audit)
**Audit date:** 2026-04-22
**Status:** Gate B proposed — rubric v2 deltas attached

---

## Executive summary

**Verdict: YELLOW.** The artifact satisfies the rubric's minimum forcing constraints in all 14 sections and produces substantive content (not platitudes) in 12 of 14. However, two categories of weakness appear systemically across sections, and they represent **rubric gaps rather than artifact gaps** — the author satisfied the rubric as written but the rubric did not force the depth that would catch the weakness:

1. **Computation elision** (§3, §7, §8, §10 flagged): the rubric forces numeric claims but does not force the derivation of those numbers. Authors can cite a weighted average without showing the weighting, compute EV adjustments without showing the branches, and claim a realization factor without deriving the adjustments. Result: the §11 ledger is complete in scope but thin in traceability — the ledger tells you the number, not the math.

2. **Source-dependency asymmetry** (§5, §7 flagged): §4 (solver) forces citation. §5 (population) accepts "labeled-unsourced" as a passing disclosure, which in practice lets entire population baselines be built from auditor intuition. §7's villain-EV comparison has no source requirement at all. The rubric protects the author's epistemic honesty (we know which claims are shaky) but does not force the author to reduce shakiness.

These gaps are **not load-bearing for this specific artifact's recommendation** — §12 sensitivity correctly identifies the decision-flipping assumption, and the recommendation holds across the credible range of inputs. But the gaps would be decision-critical on a node where the load-bearing assumption is more tightly contested.

**Net.** 4 P1 findings, 5 P2, 3 P3. 8 rubric-v2 deltas proposed. No fundamental rubric redesign required; v2 is incremental per the plan's Gate B "incremental vs fundamental" test.

---

## Scope

- **Sections audited:** all 14, plus appendix-adjacent ledger
- **Methodology:** walk each section against its rubric forcing constraints; classify findings by (a) rubric gap vs artifact gap and (b) severity 0-4
- **Out of scope:** correctness of the poker theory itself (leave that to Stage 4 leading-theory comparison); drill-card extractability (leave to Stage 5)
- **Self-audit caveat.** Same author wrote both artifact and audit; the audit inherits the author's blind spots. This is a known limitation of Stage 3a; Stage 4 (external comparison) partially mitigates.

---

## Cross-section observations (read first)

Themes spanning multiple sections:

### CSO-1 — The rubric lets the author stop at the right level of abstraction *on each number* but not *across numbers collectively*

Individual numeric claims satisfy their section's constraint: §3 gives bucket-weighted equity, §8 gives branch EVs, §10 gives realization. But the numbers don't chain cleanly — you cannot reconstruct the raise-branch EV from the donk-composition breakdown + realization factor + pot math, because the intermediate weights (how much of each bluff combo continues, what equity hero has vs each continuing bucket) are implicit. The §11 ledger captures the *answers* but not the *computation*. This is the single largest rubric v1.1 gap: completeness of numbers is enforced; traceability between them is not.

### CSO-2 — "Labeled-unsourced" is being used too liberally

§5 population-baseline has three claims, all `population-observed, n≈0, unsourced-beyond-coaching-anecdote`. §7 villain-EV comparison has two numbers (3bb check-EV, 4.5bb donk-EV) with no source at all. The rubric v1.1 forces labeling but doesn't cap the fraction of any section that can be labeled-unsourced. A §5 that is 100% labeled-unsourced is formally compliant but epistemically empty.

### CSO-3 — Section-to-section drift

§6 recommendation was built against §4 and §5 as required. But the §6 "the exploit is downstream in the turn plan" line, and §8's raise-called EV computation, both reference assumptions (turn-check frequencies, realization on raise-called lines) that don't appear in §4 or §5 baselines. This is not a violation — §8 and later sections are allowed to introduce new claims — but it means §11 ledger grew downstream claims that §4/§5 never covered. Structural suggestion: §11 should explicitly categorize claims as "baseline-referenced" vs "newly-introduced-downstream."

### CSO-4 — The mirror-node test produces the rubric's richest output

§14a forced the cleanest reasoning of any section in the artifact. "MDF stays because pot-odds arithmetic is state-invariant" is the kind of derived-from-principle claim the upper-surface rubric is designed to extract. §14a is working. Other sections could benefit from the same "classify-and-justify" structure rather than free-form prose.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Stake level assumed, not stated** (severity 1, P3)
  - Observation: artifact assumes "small-stakes live (1/2 NL to 5/10 NL)" in the opening of §1. This is the author's working assumption about which pool the artifact addresses, but it is not derived from source or flagged in §11 ledger as an assumption.
  - Fix: add stake assumption to ledger as `Stake: small-stakes live cash`, source-type `assumed`, justification "live-pool exploit framing targets live cash; online pool requires stake-conditioned v2 (see §14c)."
  - Effort: S. Proposed backlog: `US-A1-F1a — stake assumption to ledger`.

- Otherwise §1 is clean. Pot derivation traces. SPR math correct.

### §2. Range construction

- **F-2a — Combo counts are estimates, not enumerations** (severity 3, P1)
  - Observation: BTN open "≈ 426 combos", BB 3bet "≈ 80 combos", BTN call-range "90–110 combos", donk range "~25–30 combos" — all estimates. The rubric §2 requires "combo-count enumeration through EACH action" but does not specify whether estimates satisfy or whether full enumeration is required. The author interpreted permissively.
  - Downstream effect: §3 bucketing uses these combo counts. If an estimate is off by 20%, the bucket distribution and weighted equity shift. §6 recommendation is robust to this (§12 sensitivity verified), but the ledger entry `BB donk range: ~25-30 combos` has an implicit ±20% confidence that isn't surfaced.
  - Fix options:
    - **Option A:** accept estimates as compliant, require explicit ± confidence on combo-count claims.
    - **Option B:** require full combo enumeration (hand-class tables with exact combo counts).
    - **Option C:** hybrid — full enumeration for the node-of-interest range (§2 step 4), estimates acceptable for upstream filters with ± flag.
  - Recommendation: Option C. Full enumeration at the node entry is where the analysis depends on precision; upstream filters are sensitivity-bounded.
  - Effort: M. Will add ~300 words to §2 for a full post-filter hand-class table.
  - Proposed backlog: `US-A1-F2a — combo enumeration policy decision`.

- **F-2b — "Abandoning enumeration for space" is explicit hand-waving** (severity 2, P2)
  - Observation: §2 contains the literal text "Abandoning that enumeration here for space" for hero's flush-draw slice. This is a rubric violation disguised as a space-management note.
  - Fix: enumerate the flush-draw slice in full (~ 14 suited combos where at least one card is a heart, filtered by the call range). Alternatively, move the enumeration to an appendix and reference it from §2.
  - Effort: S. ~150 words.
  - Proposed backlog: `US-A1-F2b — remove enumeration hand-wave`.

### §3. Equity distribution shape

- **F-3a — Equity values cited without derivation** (severity 2, P2)
  - Observation: "vs QQ–AA overpairs (~22%)", "A5s–A4s bluffs (~70%)", "sets (~5%)" etc. Numbers are plausible but not derived. The rubric §3 says "bucketed combo-count table" but does not require per-class equity computation. The author pulled reasonable-ballpark numbers from memory.
  - Downstream effect: weighted-average equity ~30% vs donk range depends on these per-class numbers. A competing ballpark (JJ-AA 18% not 22%, A5s 65% not 70%) shifts the average by 1-2%, within §12's already-flagged uncertainty window.
  - Fix: per-class equity derivation should cite either an equity-computation source (PokerStove / equilab-equivalent) or a combinatorial justification ("vs QQ: overpair 9J7 outs at turn+river = ~24%"). Currently the computation chain is reader-trust.
  - Effort: M. Will add ~400 words across the two bucket tables.
  - Proposed backlog: `US-A1-F3a — equity derivations per bucket`.

- **F-3b — Bimodality distinction is asserted but not quantified** (severity 1, P3)
  - Observation: "bimodal with a meaningful strong bucket and a large weak bucket; the medium bucket is thin" is qualitative. Could be quantified: "medium bucket contains 4/28 = 14% of donk range; compare a flat-medium-distributed counterfactual where medium holds 50%+, which would shift the hero's optimal response toward mixed call/raise more aggressively."
  - Fix: add quantified counterfactual for bimodal vs flat comparison.
  - Effort: S.
  - Proposed backlog: `US-A1-F3b — quantify bimodality`.

### §4. Solver baseline

- **F-4a — "Directional inference from X" is weak sourcing** (severity 2, P2)
  - Observation: §4 claim 3 ("Hero's solver response: call ~85%, raise ~15%") is sourced as "directional solver output inference from Upswing 'C-Betting IP in 3-Bet Pots' and GTO Wizard turn-barrel theory; no direct solver citation for this exact flop + donk sizing + hero hand combination." The rubric §4 forcing constraint permits this (type-vs-exact distinction made) but the "call 85% / raise 15%" claim has an implicit precision that the source doesn't provide.
  - Fix: loosen the numeric claim to a range — "call 80-90% / raise 0-20% in the solver-simplified region" — OR tighten by running an actual solver for this node (infeasible this session — defer).
  - Effort: S (loosen claim) or L (solver run, blocked on solver access).
  - Proposed backlog: `US-A1-F4a — loosen solver frequencies to ranges`.

### §5. Population baseline

- **F-5a — All three §5 claims are labeled-unsourced (n≈0)** (severity 3, P1)
  - Observation: §5 claim 1 "pool donk frequency 20-40%", §5 claim 2 "donk composition 50:5-10:20-30:15-20", §5 claim 3 "population raise-vs-donk 10-15%" — all three tagged `population-observed, n≈0, unsourced-beyond-coaching-anecdote`. Rubric v1.1 §5 pass/fail says "Fails if: population claim made without source AND without explicit unsourced label." The author labeled them, so compliance. But the effect is: §5 is entirely the author's assertion, with no external anchor.
  - Downstream effect: §12 sensitivity correctly identifies donk composition as decision-flipping, but the *baseline* value it flips from is itself the author's guess. This is the kind of second-order uncertainty that an audit should catch.
  - Fix: rubric v2 should require at least ONE population claim per artifact to be sourced beyond coaching anecdote. Acceptable sources: published HUD aggregates, stake-labeled datasets, cited coaching articles with methodology (not just "pool donks more").
  - Alternatively: rubric v2 §5 could require a "confidence-floor" explicit declaration: "This §5 consists of N labeled-unsourced claims; load-bearing analyses in §6 and §12 that depend on §5 carry aggregate uncertainty Q."
  - Effort: depends on chosen fix. S-to-M.
  - Proposed rubric v2 delta: see RUBRIC-V2-DELTAS below.
  - Proposed backlog: `US-A1-F5a — population sourcing requirement`.

### §6. Exploit recommendation

- **F-6a — "The exploit is downstream in the turn plan" drifts out of node scope** (severity 1, P3)
  - Observation: §6 correctly states the action (call) and the delta-vs-§4 and delta-vs-§5. Then it extends: "For J♥T♠ specifically, recommendation matches population action. The deviation is downstream (turn plan is brick-turn bet vs population's check-behind default; see §8)." This is not wrong, but it conflates §6 (exploit at THIS node) with §8 (EV tree including downstream plans). A strict §6 would say "call" with the delta analysis and stop; downstream plans belong in §8.
  - Fix: trim §6 to node-scope; move turn-plan exploit to §8.
  - Effort: S.
  - Proposed backlog: `US-A1-F6a — §6 node-scope discipline`.

### §7. Villain's perspective

- **F-7a — Villain's EV comparison numbers (3bb check-EV, 4.5bb donk-EV) have no source** (severity 3, P1)
  - Observation: §7 includes "check-EV ≈ 3bb ... donk-EV ≈ 4.5bb ... *if* BTN calls with ~85% of range *and* folds the air." No ledger entry for these two EV numbers. The rubric §7 requires "villain's decision logic ... as expected-value comparison from villain's perspective" but does not require those EVs to be in §11 or derived in §8.
  - Downstream effect: if a reader challenges the donk-EV claim, there is nothing to challenge against. The artifact could have said "check-EV ≈ 5bb, donk-EV ≈ 6bb" and reached the same conclusion.
  - Fix: either (a) derive the villain-EV numbers with a small explicit computation (villain equity × post-action pot × realization, for each branch), or (b) remove the specific numbers and state comparison qualitatively.
  - Recommendation: (a) — derivation strengthens the section.
  - Effort: M. ~200 words of explicit derivation.
  - Proposed backlog: `US-A1-F7a — villain EV derivation`.

- **F-7b — Villain's model of hero's range is asserted but not enumerated** (severity 1, P3)
  - Observation: "Villain over-weights draws and under-weights two-pair/sets" passes the 15-word detector and is correct in direction, but doesn't specify *by how much*. Quantifying: "villain's model represents hero with ~18% flush-draw fraction (actual: ~12%); villain's model represents hero with ~2% set fraction (actual: ~6%)."
  - Fix: add quantified mis-weighting.
  - Effort: S.
  - Proposed backlog: `US-A1-F7b — quantify villain mis-weighting`.

### §8. EV tree: depth 1, 2, 3

- **F-8a — Depth-2 and depth-3 EV adjustments given as summaries, not branch-by-branch derivations** (severity 3, P1)
  - Observation: "Weighted depth-2 EV adjustment: +0.5bb relative to immediate depth-1 call-EV (the brick turns + BTN's position provide slight upside)." This is a single number for a weighted outcome across 5 runout classes (brick, heart, straight, pair, overcard). The rubric §8 requires "compute EV at depth 1, depth 2, depth 3 for each branch" which the author interpreted as "depth 2/3 summary adjustment is sufficient."
  - Downstream effect: the raise-branch EV of -6.0bb is similarly summary-level. Challenge: the raise-called EV was approximated as `(0.22 × 60.5) − 20 = -6.7bb gross; realization 0.80 → -8.4bb adjusted`. But the 0.80 realization on raise-called lines is asserted not derived, and the weight between raise-folded (+5.73bb) and raise-called (-8.4bb) averaging to -6.0bb depends on the 21% fold-equity claim, which itself derives from §2's donk composition estimate.
  - Fix: depth-2/3 EV requires a table with per-runout-class branches, not a single summary adjustment. Raise-called branch requires explicit computation showing continuing-range composition × per-class equity × pot × realization.
  - Effort: L. ~600 words and a table.
  - Proposed backlog: `US-A1-F8a — EV tree derivation detail`.

- **F-8b — Realization factor varies between branches (call-branch 0.88, raise-called 0.80) without derivation** (severity 2, P2)
  - Observation: §10 establishes range realization 0.88 and hand-specific 0.92 for J♥T♠. §8 raise-called branch uses 0.80. The 0.80 is asserted as "less realization due to OOP aggression risk" but the drop from 0.88 to 0.80 is 8 percentage points and has no derivation.
  - Fix: either derive the raise-called realization drop (e.g., "raise-called lines face 35% OOP-check-raise probability × 50% realization-depression if check-raised = baseline 0.88 − 0.08 depression") or tighten to 0.85 if derivation doesn't support 0.80.
  - Effort: S-M.
  - Proposed backlog: `US-A1-F8b — raise-called realization derivation`.

### §9. Blocker/unblocker accounting

- **F-9a — Card-block arithmetic is clean; no findings.** (severity 0)
- **F-9b — JJ combo reduction math stated twice in §9 with a minor internal inconsistency** (severity 1, P3)
  - Observation: §9 first says "JJ combos reduced from 6 → 2" and then mid-paragraph corrects to "3 combos remain" and finally settles on "3 combos blocked" (since 6 total, 3 remain, 3 blocked). The prose-level number (6-3=3) is correct, but the "6 → 2" typo earlier in the paragraph was not cleaned up.
  - Fix: clean the typo.
  - Effort: S.
  - Proposed backlog: `US-A1-F9b — §9 JJ-reduction typo`.

### §10. MDF, auto-profit, realization

- **F-10a — Realization factor 0.88 derivation thin** (severity 2, P2)
  - Observation: "IP baseline 0.90 − wet-texture adjustment 0.02 − SPR adjustment 0 − range-composition adjustment 0 = 0.88." The 0.90 IP baseline is cited to "POKER_THEORY.md §3" but the specific §3 content that establishes 0.90 is not quoted. The wet-texture adjustment of 0.02 is asserted without source.
  - Fix: quote or paraphrase the specific POKER_THEORY.md §3 content; cite the wet-texture adjustment to either a source or explicit computation.
  - Effort: S-M. Requires reading POKER_THEORY.md §3 for the exact text (deferred in this audit pass).
  - Proposed backlog: `US-A1-F10a — realization derivation`.

### §11. Confidence ledger

- **F-11a — Ledger missing ≥3 numeric claims from §4 and §8** (severity 3, P1)
  - Observation: the rubric says "every numeric claim in §1-§10 appears as a row." The following numeric claims from the artifact do NOT appear in §11:
    - §4 "BB checks ~90% of this flop"
    - §4 "BB c-bet on delay at ~40-50% with smaller sizing"
    - §4 "solver's occasional 33% donk range: ~50% overpairs / ~15% sets / ~35% Ax/Kx"
    - §7 "villain's check-EV ≈ 3bb"
    - §7 "villain's donk-EV ≈ 4.5bb"
    - §7 "villain's model: hero's flush-draw fraction ~18%" (per F-7b proposed addition)
    - §8 "~50% of turns are bricks", "~25% heart", "~15% straight", "~10% pair"
    - §8 "weighted depth-2 EV adjustment: +0.5bb"
    - §8 "weighted depth-3 EV adjustment: +0.3bb"
    - §8 "continuing range 14 combos, fold-equity 21%"
  - Downstream effect: the rubric's "epistemic backbone" role for §11 is compromised. A reader can't audit the artifact's numeric integrity because the ledger is incomplete.
  - Fix: regenerate §11 systematically — go section by section, list every number, add to ledger. This is mechanical but requires a full pass.
  - Effort: M. ~400 additional ledger rows and source-type tags.
  - Proposed backlog: `US-A1-F11a — ledger completeness sweep`.

### §12. Sensitivity analysis

- **F-12a — Assumption A flip threshold is specified but the "flip" claim is asserted not derived** (severity 2, P2)
  - Observation: "At ~40:60 value:bluff, raise becomes +EV over call" — but the raise-EV-at-40:60 computation is not shown. The author intuited that the donk-composition shift changes the raise branch's fold-equity substantially enough to flip. The math should be derivable from §8 (if §8 were complete per F-8a), but currently §12's flip claim depends on §8's summary-level numbers.
  - Fix: after F-8a is resolved, re-derive §12 Assumption A flip with explicit raise-EV computation at the 40:60 composition.
  - Effort: S (depends on F-8a).
  - Proposed backlog: `US-A1-F12a — Assumption A flip derivation`.

- Otherwise §12 is clean. Three assumptions, each with numeric threshold, identified load-bearing assumption correctly.

### §13. Contrast with leading theories

- **F-13a — Category C (Upswing) is borderline — "simplification" vs "wrong"** (severity 1, P3)
  - Observation: Upswing's binary "donk on range-advantage boards, don't donk on disadvantaged boards" is labeled Category C ("source is wrong"). The author's defense in §13 ("source isn't wrong — it's simplifying for pedagogy in a way that misses material nuance at the upper-surface level") undercuts the C classification. In fact the source isn't wrong — it's *accurate at its pedagogical level* but *incomplete at ours*.
  - Fix: rubric v2 should distinguish:
    - **C-wrong:** source makes a claim the author believes is factually incorrect
    - **C-incomplete:** source simplifies for pedagogy; the simplification misses nuance but isn't wrong
  - Current artifact's Upswing classification would be C-incomplete under v2.
  - Effort: rubric change. See RUBRIC-V2-DELTAS.
  - Proposed backlog: `US-A1-F13a — C-wrong vs C-incomplete split`.

- **F-13b — Only 4 sources consulted; deeper corpus available** (severity 1, P3)
  - Observation: rubric v1.1 requires ≥3 sources; author used 4. Passes. But Janda only; no Sweeney, Miller, Angelo, Brokos. No PokerCoaching or CardQuant citations. Stage 4 (leading-theory comparison) will expand.
  - Fix: defer. Stage 4 is the designated corpus-breadth stage.
  - Effort: deferred.
  - Proposed backlog: none (handled by Stage 4).

### §14a. Symmetric-node test

- **F-14a-a — "Partially changes" classification not in rubric v1.1, introduced ad-hoc** (severity 2, P2)
  - Observation: rubric v1.1 §14a lists classifications as `inverts / stays / partially changes`. Wait — it does include "partially changes." Re-read... yes, v1.1 does include it. So not a rubric gap. **Finding withdrawn.**
  - But: the author used "partially changes" for claims 2, 4, 5, 6 — four of six. Is this a signal that the mirror-node test is too coarse for middling cases? Or that the author is ducking clean invert/stay classifications?
  - Recommendation: rubric v2 should tighten "partially changes" — require that partial changes specify direction and approximate magnitude, and that ≤3 of classified claims can be "partially changes" (else the mirror is poorly chosen).
  - Effort: rubric change.
  - Proposed rubric v2 delta: see below.

### §14b. Falsifier specificity

- **F-14b — Falsifier 2 is theoretical, not operational** (severity 1, P3)
  - Observation: Falsifier 2 reads "If GTO solver at 100bb and 50bb depth on T96ss 3BP OOP ... outputs BB donk frequency > 25% at any sizing." This is technically falsifiable (run the solver) but operationally blocked on solver access. Falsifier 1 and 3 are operationally checkable with population data.
  - Fix: acknowledge operational gap. Either add a falsifier that hero can operationally test (e.g., "if my next 50 hands of T96-type boards facing donks show villain showing down value 85%+ of the time, §5 donk composition is wrong"), or accept that some falsifiers are theoretical.
  - Effort: S.
  - Proposed backlog: `US-A1-F14b — add operational falsifier`.

### §14c. Counter-artifact pointer

- Clean. Stake-and-stack-conditioned v2 is a concrete named counter-artifact. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-11a — ledger missing ≥3 claims | 3 | P1 | M | Artifact |
| 2 | F-5a — all §5 claims labeled-unsourced (rubric gap) | 3 | P1 | S-M | Rubric + artifact |
| 3 | F-8a — EV tree depth-2/3 summary, not branch | 3 | P1 | L | Artifact |
| 4 | F-7a — villain EV numbers unsourced | 3 | P1 | M | Artifact |
| 5 | F-2a — combo enumeration policy | 3 | P1 | M | Rubric + artifact |
| 6 | F-2b — "abandoning enumeration for space" | 2 | P2 | S | Artifact |
| 7 | F-3a — equity values without derivation | 2 | P2 | M | Rubric + artifact |
| 8 | F-4a — solver frequencies over-precise | 2 | P2 | S | Artifact |
| 9 | F-8b — raise-called realization drop undiv | 2 | P2 | S-M | Artifact |
| 10 | F-10a — realization baseline thin | 2 | P2 | S-M | Artifact |
| 11 | F-12a — Assumption A flip not derived | 2 | P2 | S | Artifact |
| 12 | F-14a-a — "partially changes" overused | 2 | P2 | rubric | Rubric |
| 13 | F-1a — stake to ledger | 1 | P3 | S | Artifact |
| 14 | F-3b — bimodality unquantified | 1 | P3 | S | Artifact |
| 15 | F-6a — §6 drift into turn plan | 1 | P3 | S | Artifact |
| 16 | F-7b — villain mis-weighting unquantified | 1 | P3 | S | Artifact |
| 17 | F-9b — JJ reduction typo | 1 | P3 | S | Artifact |
| 18 | F-13a — C-wrong vs C-incomplete | 1 | P3 | rubric | Rubric |
| 19 | F-14b — falsifier 2 theoretical | 1 | P3 | S | Artifact |

**Breakdown:** 4 P1, 7 P2, 7 P3 (+ 1 withdrawn). 7 findings route primarily to the rubric; 12 primarily to the artifact; some overlap.

---

## Proposed rubric v2 deltas

The Gate B question: incremental or fundamental? **Incremental.** Eight deltas, each targeted at a specific v1.1 gap observed in this pilot.

### Delta 1 — §2 combo-enumeration policy

**Current (v1.1):** "Combo-count enumeration for BOTH players through EACH action in the history."

**v2 proposed:** "Combo-count enumeration for BOTH players through EACH action. At the node-of-interest range (final range entering the decision), **full hand-class enumeration is required** (table listing every hand class with combo count). Upstream filter ranges may use estimates if labeled with ± confidence. Estimates that hide precision ('≈ 80 combos') must be tagged with a confidence interval or replaced by ranges ('75-85 combos')."

### Delta 2 — §3 per-class equity derivation

**Current (v1.1):** bucketed combo-count table required.

**v2 proposed:** "Per-bucket equity values must cite either an equity-computation source (equilab, Pokerstove, solver output) OR show a combinatorial outs-based derivation. Unsupported equity values ('~22%') fail grading. Ledger tag: `equity-computed` or `equity-estimated`."

### Delta 3 — §5 sourcing floor

**Current (v1.1):** population claim must be cited OR explicitly labeled unsourced.

**v2 proposed:** "At least ONE population claim per artifact must be cited from a source with stated methodology (e.g., HUD-aggregate article, stake-labeled sample, coaching article with dataset). Artifacts where all §5 claims are labeled-unsourced must include an explicit 'Population-baseline confidence floor' note stating that §6 and §12 inherit aggregate uncertainty from §5's unsourcedness."

### Delta 4 — §7 villain EV must trace to ledger

**Current (v1.1):** villain's decision logic must include EV comparison.

**v2 proposed:** "Villain-EV comparison numbers must appear in §11 ledger with source-type, OR derive from numbers already in §11 (in which case the derivation is shown inline). Unsourced villain-EV numbers are a §7 rubric violation."

### Delta 5 — §8 branch-level derivation

**Current (v1.1):** compute EV at depth 1, 2, 3 for each branch.

**v2 proposed:** "Depth-2 EV computations must show per-runout-class (or per-branch-type) breakdown before summing to a weighted total. 'Depth-2 weighted adjustment: +0.5bb' without a table showing the component branches is a §8 rubric violation. Depth-3 may summarize if depth-2 breakdown is complete and depth-3 follows mechanically; otherwise same rule applies."

### Delta 6 — §11 ledger completeness gate

**Current (v1.1):** every numeric claim in §1-§10 appears as a row.

**v2 proposed:** "Every numeric claim in §1-§10 appears as a row. **Completeness gate:** before marking artifact status `draft-complete`, the author must perform a mechanical sweep of §1-§10 and confirm every numeric claim is in the ledger. A checklist at the bottom of §11 reports the sweep result: `[Completeness: swept YYYY-MM-DD, N claims ledgered]`. Self-audit may grade incomplete if ≥3 numeric claims are missing."

### Delta 7 — §13 sub-categories

**Current (v1.1):** A / B / C / D.

**v2 proposed:**
- **A:** agreement
- **B:** our reasoning is wrong
- **C-wrong:** source makes a factually-incorrect claim
- **C-incomplete:** source simplifies in a way that misses material nuance (not wrong at its pedagogical level but incomplete at ours)
- **D:** intentional divergence

The ≥1 B or C requirement extends to include C-incomplete. Both C-wrong and C-incomplete still require the artifact to justify the disagreement.

### Delta 8 — §14a tighten "partially changes"

**Current (v1.1):** inverts / stays / partially changes.

**v2 proposed:** "Partially-changes classifications must specify direction and approximate magnitude. No more than 3 of the classified claims (typically 6) may be 'partially changes'; if more, the mirror is poorly chosen (claims are too entangled) and the author must select a cleaner mirror."

---

## Audit sign-off

- **Drafted by:** Claude (main, self-audit — same author as artifact)
- **Limitations of self-audit:** inherits author's blind spots. Stage 4 leading-theory comparison is the designated external mitigation.
- **Verdict:** YELLOW, 4 P1 findings. Rubric v2 incremental (8 deltas, no fundamental redesign).
- **Owner checkpoint (Gate B):** confirm v2 is incremental — OK to proceed to Stage 2b (river pilot) on rubric v2? Or pause to re-fit the flop pilot against v2 before committing to the second pilot?

### Proposed sequencing after Gate B

**Option 1 (author's preference): apply v2 deltas + refit flop artifact first, then Stage 2b.**
- Rationale: entering Stage 2b (river pilot) with v2 untested on any artifact risks discovering v2 rubric bugs on the second artifact. Refit-then-pilot catches v2 bugs on familiar territory.
- Cost: ~1 additional pass on the flop artifact. ~2-3k additional words.

**Option 2: apply v2 deltas lightly (rubric-only changes, no refit), move directly to Stage 2b.**
- Rationale: v2 was informed by the flop pilot's failures; the river pilot is a fresh test. Refitting would homogenize the two pilots' authorship context.
- Cost: flop artifact stays at v1.1, river artifact at v2. Cross-comparison easier (flop-v1.1 vs river-v2 shows rubric-delta effect).

**Option 3: apply v2 deltas, proceed to Stage 2b on v2, leave flop refit as a Stage 5+ cleanup.**
- Rationale: the river artifact is the more important test (street-generality). Flop refit can happen post-corpus.
- Cost: flop artifact stays imperfect during Stage 4.

Recommendation: **Option 2.** The river pilot is the higher-information test; don't spend a pass refitting the flop when v2's bug-surface is still undetermined.
