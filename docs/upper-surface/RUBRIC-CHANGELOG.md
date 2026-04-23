# Rubric Changelog

## v1 → v1.1 (2026-04-22)

**Trigger.** Gate A dry-run sketch on `btn-vs-bb-3bp-ip-wet-t96-flop_root` (see `sketches/btn-vs-bb-3bp-ip-wet-t96-flop_root-sketch.md`) exposed structural bugs in four sections. No fundamental revisions; v1.1 is incremental polish.

### Delta 1 — §6 ordering constraint added

Gate A finding: when the sketch author drafted §6 (Exploit recommendation) before fully writing §4 (Solver baseline) and §5 (Population baseline), the "explicit delta vs §4 and §5" forcing constraint degraded to restating the author's prior beliefs rather than confronting the baselines as written.

**Change.** §6 forcing constraints now include: "§4 and §5 must be authored in full before §6 is drafted. §6 references §4 and §5 by section content; drafting §6 against unwritten baselines is a rubric violation."

### Delta 2 — §13 strengthened B/C requirement

Gate A finding: sketch produced 2A + 2D comparisons and zero B/C. The v1 rubric permitted any B/C/D, letting D-only artifacts pass. D (intentional divergence) is the easiest category to claim because it sidesteps the question of who is right. Absence of B/C flagged that the author didn't pressure-test their own reasoning.

**Change.** §13 now requires at least one B or C across the artifact. When no B or C emerges, the artifact must add an **Active challenge** sub-section specifying (a) which external source was examined for disagreement, (b) what claim in the artifact's own reasoning was challenged, (c) why the attempt produced no B/C. Pass/fail line updated: "no B or C AND no Active-challenge sub-section" now fails grading.

### Delta 3 — §2 preflop-node exception

Gate A finding: the "at each step" forcing constraint in §2 assumes prior-street filters exist. For preflop-only nodes, no prior street exists and the constraint is undefined.

**Change.** §2 now includes a **Preflop-node exception**: "For preflop-only nodes (e.g., `utg-vs-bb-srp-preflop-open-facing-3bet`), the 'at each step' requirement applies to the node-entry decision space — the full set of feasible actions at this node (open / fold / 3bet / cold-call) with their respective ranges — rather than to prior-street filters."

### Delta 4 — §8 depth-3 collapse examples

Gate A finding: v1's "Depth 3 N/A — pot closed" language was anticipated to degrade on non-river nodes with varied collapse mechanisms (short-stack effectively-terminal, all-in jam lines, etc.). Gate A did not itself exercise this failure, but the sketch flagged it as an expected Stage 2b (river artifact) issue.

**Change.** §8 now lists **Concrete collapse forms** with three acceptable examples (river showdown, all-in pot-closed, effectively-terminal short-stack) and one unacceptable form ("depth 3 not applicable" without stating mechanism).

### Delta 5 (optional heuristic) — §7 perspective-collapse detector

Gate A observation: villain's-perspective sections are structurally vulnerable to pronoun-swap degradation. The v1 rubric's AI-failure-mode callout required the apparent-hero-range to differ from actual, but didn't provide a quick self-check heuristic.

**Change.** §7 now includes a **Perspective-collapse detector** heuristic: if villain's apparent-hero-range is stated in fewer than ~15 words, re-read — pronoun swap is the likely failure. A genuine apparent-range names what villain over-weights and under-weights in hero's range, which rarely fits under 15 words without losing the asymmetry.

---

## Not changed in v1.1

The following Gate A observations did **not** drive rubric changes; they are pilot-artifact-authoring observations rather than rubric bugs:

- **§3 exposed equity-distribution bimodality** (hero ~40% vs full 3bet range but ~28% vs donk subset). This is a *feature* of the rubric, not a bug — §3 is forcing the author to see what casual analysis misses.
- **§11 + §12 chain worked as designed.** Ledger surfaced low-confidence load-bearing inputs; sensitivity flipped on the flagged assumption. No change needed.
- **§14a mirror-node test passed** with six-claim classification and non-trivial "stays" justifications. No change needed.

---

## v1.1 → v2 (2026-04-22)

**Trigger.** Stage 3a self-audit on the flop pilot artifact identified two systemic weaknesses (computation elision, source-dependency asymmetry) that the v1.1 rubric permitted despite being epistemically costly. Owner reframed during Gate B: the upper-surface work is unbounded in principle; "is v2 incremental or fundamental?" is the wrong axis. The invariant we can measure is **disprovable-claim surface area per artifact volume**. v2 elevates the claim-falsifier discipline from a single §14b forcing constraint to the rubric's organizing backbone.

### Primary delta — D9: Claim-falsifier ledger as the organizing backbone

The v1/v1.1 "Confidence ledger" in §11 captured (claim, source, credible-interval). It was the rubric's epistemic spine but didn't force the author to name what would *disprove* each claim. v2 renames §11 to "Claim-falsifier ledger" and adds a **Falsifier column** to every row.

**Three falsifier types:**
- **Internal:** re-derivation from §X inputs would yield value outside [L, H]. Acceptable for transparent `computed` claims.
- **External-operational:** a sample of N observations would show the measured quantity outside [L, H]. Required for `read`, `population-observed`, `population-cited` wherever operationally possible.
- **Theoretical:** solver output at this exact node disagrees by more than ε. Acceptable for `solver` and some `assumed`.

**Trivial falsifiers** ("formula miscomputed") are acceptable for trivial derived claims (MDF, pot math). **Non-trivial falsifiers** are required for `assumed`, `read`, `population-observed`, `population-cited` — the load-bearing uncertain claims.

**§14b refactored as synthesis.** v1.1's §14b required authors to invent 2-3 free-standing falsifiers. v2's §14b distills the 2-3 *headline* falsifiers from §11 — the subset whose firing would flip §6's recommendation. Headline falsifiers cite their §11 row and explain the propagation path to §6.

**AI failure mode introduced:** trivial falsifiers for non-trivial claims ("if the value is different, it's wrong" — tautological, non-disprovable). v2 rejects these in grading.

**Surface-area claim.** D9 adds roughly 30 new disprovable-claim slots per artifact (one per §11 row). v2 is measured against v1.1 by whether the flop artifact's refit §11 ledger exposes more falsifiable territory.

### Supporting deltas — D1 through D8 (from Stage 3a audit)

All eight address specific v1.1 gaps exposed by the flop-pilot audit. Each is subordinate to D9 in that they generate more ledger rows (more surface area) for the claim-falsifier discipline to operate on.

- **D1 — §2 full enumeration at node-of-interest.** Final (node-entry) range requires a hand-class table with exact combo counts; upstream filters may estimate with ± confidence.
- **D2 — §3 per-class equity derivation.** Each bucket's equity must cite a computation source or show combinatorial outs math. Unsupported "~22%" values fail grading.
- **D3 — §5 sourcing floor.** At least one population claim per artifact must be cited from a source with stated methodology. When unmet, explicit confidence-floor note required.
- **D4 — §7 villain-EV traceability.** Villain's EV comparison numbers must appear in §11 or derive inline from §11 numbers.
- **D5 — §8 branch-level derivation.** Depth-2 EV requires per-runout-class breakdown table. Realization-factor variation across branches must be derived, not asserted.
- **D6 — §11 completeness gate.** Mechanical sweep of §1-§10 required before marking `draft-complete`; completeness log appended to §11.
- **D7 — §13 C-category split.** C split into C-wrong (factually incorrect source) vs C-incomplete (pedagogical simplification missing material nuance). Both still satisfy the ≥1-B-or-C requirement.
- **D8 — §14a partially-changes cap.** No more than 3 of classified claims may be "partially changes"; if more, the mirror is poorly chosen.

### Scope notes

- Flop pilot artifact requires refit under v2: §11 regenerated with Falsifier column (includes rows previously missing per F-11a audit finding); §14b refactored as synthesis; frontmatter bumped to `Rubric-Version: v2`. Other sections (§1-§10, §12, §13, §14a, §14c) may contain v1.1-era claims that fail the v2 enumeration/derivation/sourcing forcing constraints — these are tracked as F-findings in the audit and deferred to post-corpus cleanup.
- River pilot (Stage 2b) authored on v2 natively — no refit.

## v2 → v2.1 (2026-04-23)

**Trigger.** Stage 3b self-audit on the river pilot (`btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`) verdict GREEN-light. v2 survived the river-decision stress test — primary move (claim-falsifier ledger), supporting deltas D1-D8, §8 depth-3 collapse, §10 realization=N/A, §14b synthesis-from-§11 all worked first-time on river without rubric revision. Three artifact-level findings traced to rubric gaps that warrant incremental polish — not fundamental restructuring.

### Delta D10 — §2 first-pass enumeration discipline

**Stage 3b finding F-2a (P1):** the river pilot's value:bluff composition derivation visibly back-solved to the LSW audit's reference number. Initial per-class enumeration produced 88:12; author re-tightened per-class frequencies until aggregate matched 73:27 reference. Per-class frequencies are individually defensible, but the *adjustment process* was target-driven, not constraint-driven. The published prose explicitly acknowledges the calibration ("Let me retry... Adopted working numbers..."), but the rubric didn't force a separate first-pass table.

**Change.** §2 forcing constraints now include: "Per-class bet/call/fold frequencies in the node-of-interest table must be committed to *before* computing aggregate ratios. If the aggregate ratio is then calibrated against an external reference, the first-pass derivation must be preserved in the artifact as a separate table or column, with reconciliation notes showing what was adjusted and why. Silent back-solving to a target ratio is a rubric violation."

**Cost:** small (one extra table per artifact). **Benefit:** prevents derivation-integrity failure observed in river pilot.

### Delta D11 — §6 archetype-conditional recommendation

**Stage 3b finding F-6a (P1):** the river pilot's §12 Assumption C produced "call vs reg/pro/fish, fold vs nit." This archetype-flip is decision-relevant but the artifact had to surface it in §12 because v2 §6 assumed a single hero action. A reader hitting §6 sees only "pure call" without the override.

**Change.** §6 forcing constraints now include: "If §12 identifies villain archetype as the decision-flipping dimension, §6 may be structured as an archetype-conditional recommendation. Form: `Default: <action> (for <archetype-mix>). Override: if villain is <archetype>, <different action> because <§12 reference>.` Default's deltas vs §4/§5 still required; override cases reference §12 directly."

**Cost:** small (allows but doesn't require the conditional form). **Benefit:** archetype-flips surface at the recommendation site, not buried in sensitivity analysis.

### Delta D12 — §3 river-decision pure-bimodal framing

**Stage 3b finding F-3c (P1, rubric-only):** v2 §3 bimodality language assumed continuous equity distributions (flop/turn nodes where hero has draw equity to realize). On river decisions, equity is strictly 0% or 100% per villain combo (showdown, no drawing). The "compare to counterfactual flat distribution" requirement doesn't apply on river — bimodality is structural, not distributional.

**Change.** §3 forcing constraints now include: "For river-decision nodes (depth-3 collapses to showdown — see §8), equity is strictly bimodal: each villain combo produces 0% or 100% equity for hero. §3 for river decisions must explicitly state 'pure-bimodal river equity distribution' and express hero's total equity as `P(ahead) = count(combos hero beats) / count(total combos)`. Bucket scheme collapses to two: nuts (hero wins) and air (hero loses). Counterfactual-flat-distribution comparison does not apply on river."

**Cost:** none (clarification of existing language). **Benefit:** clean rubric handling of river-decision structural property.

### What v2.1 does NOT change

The following Stage 3b observations did **not** drive rubric changes:

- **F-2b (hero barrel-selection under-derived).** Artifact-level fix; rubric forcing constraint is sound.
- **F-4a (solver frequencies over-precise — carry-over from flop pilot).** Already known F-finding; not v2.1-driven.
- **F-7a (villain-EV derivation opaque in-prose).** Artifact prose-quality issue; v2 Delta 4's "trace to §11 or derive inline" is sufficient.
- **F-7b / F-8a (missing ledger rows).** Artifact-level; v2 Delta 6 (completeness gate) catches these on next sweep.
- **F-13a/b (§13 thin-but-meets-minimum).** Stage 4 (leading-theory comparison) is the designated stage to expand corpus depth.

### Surface-area metric across versions

| Version | Flop pilot ledger rows | River pilot ledger rows | Density (rows/1k words) |
|---|---|---|---|
| v1.1 | 28 (original) | n/a | ~3.5 |
| v2 | 68 (refit) | 61 (native) | 6.8 / 7.6 |
| v2.1 | (no refit) | (no refit) | unchanged |

v2 → v2.1 is structural polish without surface-area expansion. Surface-area growth resumes when v2.1 is applied to fresh artifacts (Stage 5+ if scaling proceeds).

## Grandfathering policy

No v1 artifacts existed at the v1 → v1.1 transition (the Gate A sketch is a diagnostic, not a graded artifact).

At the v1.1 → v2 transition, **one v1.1 artifact exists** (the flop pilot). Per Appendix B policy, it is being **refit** to v2 rather than grandfathered — specifically the §11 ledger (primary delta) and §14b synthesis. Other sections retain v1.1-era authoring with known F-finding gaps, tracked for post-corpus cleanup. Frontmatter after refit: `Rubric-Version: v2 (partial-refit — §11 and §14b regenerated under v2; §1-§10, §12, §13, §14a, §14c are v1.1-era with known F-findings)`.

At the v2 → v2.1 transition, **two artifacts exist** (flop pilot at v2-partial-refit, river pilot at v2-native). Neither is being refit to v2.1. v2.1 deltas are narrow polish; the cost of refitting both pilots exceeds the surface-area benefit. Frontmatter retained as v2 / v2-partial-refit; Stage 4 (leading-theory comparison) and Stage 5 (drill-card extraction) proceed on the current artifacts. If Stage 4 surfaces additional rubric pressure, refit decision will be revisited.

## v2.1 → v2.2 (2026-04-23)

**Trigger.** Stage 4 leading-theory comparison (both pilots) surfaced a shared §13 failure mode: the artifact's first-pass §13 evaluated sources looking outward but didn't apply v2 falsifier discipline to its own outputs. Each pilot's Stage 4 doc found a B-finding that the artifact's self-§13 missed via the same mechanism — and the meta-finding (cross-pilot pattern) was only detectable via Stage 4's higher viewpoint, not from single-artifact audit.

### Delta D13 — §13 reflexive checks (internal-arithmetic + source-scope)

**Stage 4 finding (flop pilot):** §3 weighted-average equity stated "28-32%, working value 30%." Recomputation from artifact's own per-bucket values gives `(6×0.70 + 4×0.50 + 12×0.22 + 3×0.05) / 25 = 8.99/25 = ~36%`. Row 3.9's internal falsifier ("recomputation yields outside [25%, 35%]") fires at 36%. **B-finding internal to artifact, missed by self-§13 because §13 didn't run the recomputation.**

**Stage 4 finding (river pilot):** §5 Claim 1 cited GTO Wizard "Calling Down the Over-Bluffed Lines in **Lower Limits**" as the v2 Delta 3 sourcing-floor citation for "live 1/2-5/10 NL cash bluff fraction 40-50%." The source's stated context is online microstakes (NL10-NL50), not live cash. The over-bluff pattern likely generalizes (Doug Polk content independently confirms for live cash), but the source attribution as written conflates two distinct stake tiers. **B-finding for source-scope, missed by self-§13 because §13 didn't verify the source's own scope claim.**

**Cross-pilot pattern.** Both Bs were discoverable from §11 alone (in the flop case, by recomputing row 3.9 against its CI; in the river case, by reading row 5.1's source citation more carefully). Both were missed by self-§13. The pattern: §13 surveys sources looking outward but doesn't reflexively check the artifact's own internal arithmetic or its own source-attribution scope.

**Change.** §13 forcing constraints now include two **reflexive checks**:

1. **Internal-arithmetic check.** For every weighted-average claim in the artifact (typically §3 weighted equities, §8 EV summaries, §9 blocker-shifted ratios), recompute from the §11 ledger inputs and confirm the result lies inside the row's stated CI. If recomputation falls outside CI, this is a B-finding the artifact must reconcile before §13 finalizes.

2. **Source-scope check.** For every cited external source in §13, verify the source's own stated context (stake tier, stack depth, pool — online vs live, etc.) covers the artifact's claim context. If the source's scope doesn't include the artifact's claim context, the source attribution is over-broad and the artifact must either tighten the citation language or cite an additional source whose scope does cover the claim. Source-scope-mismatch with no reconciliation is a B-finding.

**Cost.** Small (one extra check pass before §13 finalizes). **Benefit.** Catches a class of B-findings that single-artifact audit can't surface — Stage 4 evidence shows the pattern is systematic across both pilots, not a one-off.

**Surface-area implication.** D13 doesn't add new ledger rows directly. It adds **B-finding-detection capacity** — the rubric's grading function gets stricter without enlarging the artifact. This is the first delta that increases rubric strictness rather than rubric scope.

### What v2.2 does NOT change

- D9 (claim-falsifier ledger) and D1-D8 (v2 supporting deltas) unchanged.
- D10-D12 (v2.1 polish) unchanged.
- §14b synthesis remains the artifact-level falsifier-distillation site; D13's reflexive checks happen in §13, not §14b.

### Refits applied at this transition

Both pilot artifacts are being refit to address the Stage 4 B-findings:

- **Flop pilot:** §3 weighted-average corrected (~30% → ~36%) and §11 row 3.9 updated. §8 EV propagation noted as still-open F-finding (decision-level recommendation unchanged; EV magnitudes shift).
- **River pilot:** §5 Claim 1 source attribution tightened (Doug Polk cited for live-cash; GTO Wizard "Lower Limits" demoted to corroborating evidence with explicit scope acknowledgment) and §11 row 5.1 updated.

These are minimal refits (one ledger row + one prose section per pilot), not full v2.2 refits. Frontmatter remains v2 / v2-partial-refit; refit notes added to closing notes for traceability.

## Grandfathering policy

No v1 artifacts existed at the v1 → v1.1 transition (the Gate A sketch is a diagnostic, not a graded artifact).

At the v1.1 → v2 transition, **one v1.1 artifact exists** (the flop pilot). Per Appendix B policy, it is being **refit** to v2 rather than grandfathered — specifically the §11 ledger (primary delta) and §14b synthesis. Other sections retain v1.1-era authoring with known F-finding gaps, tracked for post-corpus cleanup. Frontmatter after refit: `Rubric-Version: v2 (partial-refit — §11 and §14b regenerated under v2; §1-§10, §12, §13, §14a, §14c are v1.1-era with known F-findings)`.

At the v2 → v2.1 transition, **two artifacts exist** (flop pilot at v2-partial-refit, river pilot at v2-native). Neither is being refit to v2.1. v2.1 deltas are narrow polish; the cost of refitting both pilots exceeds the surface-area benefit.

At the v2 → v2.2 transition (concurrent with Stage 4 closure), the **two pilots receive minimal refits** for the Stage 4 B-findings (described above). Frontmatter NOT bumped to v2.2 — D13 is a §13-process delta, not a structural change to artifact format. Future artifacts authored under v2.2 will have full D13 reflexive checks; existing pilots have their §13 sections retained at v2 / v2.1-era authoring with the Stage 4 reflexive checks documented separately in their comparison docs.

## v2.2 → v2.3 (2026-04-23)

**Trigger.** US-1 corpus-scaling artifacts #3-#6 accumulated four rubric-candidate deltas:
- Artifact #3 (turn_brick) raised D14 (population-consensus-observed source-type).
- Artifact #4 (river_after_turn_call OOP-fold) reinforced D14 and raised D15 (range-vs-hand MDF divergence) + D16 (§13 search-depth documentation).
- Artifact #5 (4BP jam) reinforced D14 + D16.
- Artifact #6 (multi-way) reinforced D14, raised D17 (formalize multi-way extensions).

At 4 candidates, the established cadence (apply deltas before next-authoring) mandated v2.3 batch. Applying each individually would have caused rubric-thrash; batching preserves cadence while minimizing churn.

### Delta D14 — `population-consensus-observed` source-type

**Problem.** v2 §11 source-type list was binary for pool-claims: `population-cited` (dataset-with-methodology) OR `population-observed` (auditor-unsourced). Artifacts #3, #4, #5, #6 all cited "Doug Polk + Ed Miller + Jonathan Little" as a consensus-of-coaches pattern, which is stronger than auditor-unsourced but weaker than a dataset-with-methodology. The label "population-cited" over-stated rigor; "population-observed" understated it.

**Change.** Added `population-consensus-observed` to the source-type list in §11. Criteria: ≥2 independent coaching sources agree on direction (not exact value); numeric values carry wider CI than `population-cited`. Sourcing-floor requirement (v2 Delta 3) met when ≥1 of the consensus-sources has stated methodology.

**Benefit.** Multi-coach agreement gets honest labeling.

### Delta D15 — Range-vs-hand MDF divergence in §10

**Problem.** Artifact #4 surfaced a pattern: hero's AA on scare-card-river-runout has equity below pot-odds-threshold despite being "top of range." Range-level MDF (hero must defend ≥X%) said calling was required; individual-hand-correctness said folding was right because the specific runout-conditional composition made AA a sub-threshold bluff-catcher. v2 §10 didn't formalize this gap.

**Change.** Added §10 forcing constraint: when range-level MDF diverges from individual-hand correctness (top-of-range by preflop strength doesn't meet MDF at runout-conditional composition), artifact must state why explicitly. Prevents "it's AA so I must call" reasoning that skips runout-conditional equity check.

**Benefit.** Protects against the most common "value-hand trap" in live cash: calling too wide with preflop-premium hands on runouts where the range-equity has collapsed.

### Delta D16 — §13 zero-B/C search-depth documentation

**Problem.** Artifacts #3, #5 Stage 4 comparisons produced zero B-wrong / C-wrong / C-incomplete findings — genuinely consensus-robust spots. v2 permitted this via "Active challenge" sub-section but didn't specify search-depth. Authors could claim "no disagreement found" after cursory search and pass grading.

**Change.** §13 now requires, when zero B/C found: (a) count of distinct sources probed (minimum 3 beyond headline agreeing-sources), (b) specific angles attempted (contrarian camps, pre-solver era, elite high-stakes, tournament-specific, live-vs-online-tier, population-data-contrary, unconventional-school — at least 3 angles required unless explicitly N/A), (c) closest-to-disagreeing source named with category-assignment-reasoning.

**Benefit.** "Consensus-robust" becomes a defensible claim rather than a lazy escape hatch.

### Delta D17 — Multi-way extensions to §2, §7, §8, §10

**Problem.** v2.2 rubric was HU-oriented. Artifact #6 (first multi-way) authored pragmatic extensions to four sections ad-hoc:
- §2: three-range enumeration + combined-villain-range synthesis
- §7: two villain subsections + joint synthesis
- §8: 4-scenario grouping from 9 raw combinations
- §10: joint MDF as decision-relevant metric

Without formalization, future MW artifacts would re-invent these extensions, diverging from each other.

**Change.** Each of §2/§7/§8/§10 now includes a "Multi-way extension" forcing constraint:
- §2: combined-villain-range table with inclusion-exclusion accounting
- §7: per-villain subsection + joint synthesis (joint fold equity, correlation, order-of-action)
- §8: scenario-grouping permitted (exhaustive, non-overlapping, decision-relevant)
- §10: per-villain MDF + joint MDF (joint is decision-relevant)

**Benefit.** MW artifacts get formal structure; rubric generalizes cleanly from HU to MW.

### Refit policy for v2.3

**No refits applied to existing artifacts.** Deltas are formalization of observed patterns rather than structural changes. Artifacts #3-#6 already exercised these patterns ad-hoc; formal compliance with v2.3 language would require only labeling-updates (e.g., source-type labels changing from `population-cited` to `population-consensus-observed`). Cost of refits exceeds surface-area benefit at this point in corpus growth.

**Future artifacts (artifact #7+) author fully under v2.3.** Earlier artifacts retain their v2-era labels with known F-finding trails.

### Surface-area metric at v2.3 transition

| Version | Artifacts authored | Cumulative ledger rows | Avg density |
|---|---|---|---|
| v1.1 flop pilot | 1 (refit later) | 28 (refit to 68) | 3.5 → 6.8 |
| v2 / v2-native | 2 (pilots) | 68 + 61 = 129 | 7.2 avg |
| v2.1 / v2.2-native | 2 (artifacts #3-#4) | 55 + 52 = 107 | 7.1 avg |
| v2.2-native | 2 (artifacts #5-#6) | 44 + 46 = 90 | 6.4 avg |
| **Total** | **7 artifact slots (6 unique + 1 pilot refit)** | **~326 claim-rows** | **~7.0 avg** |

v2.3 expected to produce similar density on artifact #7 + subsequent (MW-extension-heavy artifacts may exceed).

## Grandfathering policy (cumulative)

- v1 → v1.1: no artifacts existed.
- v1.1 → v2: flop pilot refit (primary move) + partial-v2 label.
- v2 → v2.1: no refits (polish only).
- v2 → v2.2: pilots received minimal refits for Stage 4 B-findings.
- **v2.2 → v2.3: no refits** (formalization-only; existing artifacts labeled with v2-era source-types and known F-finding trails).
