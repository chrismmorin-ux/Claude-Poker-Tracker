# Upper-Surface Reasoning Rubric — v2.3

**Status:** v2.3 (US-1 corpus-scaling batch). v1 drafted 2026-04-22; v1.1 applied four deltas after Gate A; v2 applied one primary reframe + eight supporting deltas after Stage 3a; v2.1 applied three polish deltas after Stage 3b; v2.2 applied one cross-pilot meta-delta (D13) after Stage 4; v2.3 applied four batched deltas (D14-D17) after US-1 artifacts #3-#6 accumulated patterns requiring formalization — `population-consensus-observed` source-type (D14), range-vs-hand MDF divergence (D15), §13 consensus-check search-depth documentation (D16), and multi-way extensions to §2/§7/§8/§10 (D17). See Appendix B for versioning policy and `RUBRIC-CHANGELOG.md` for full version diffs.

**Invariant (introduced in v2).** This rubric has no fixed version. The upper-surface work is unbounded: language can always be more precise, claims always sharper. The invariant we measure is the **claim-falsifier discipline** — every numeric claim is paired with a falsifier (an observable event with a threshold that would disprove it). Iterations of the rubric (v1 → v1.1 → v2 → …) are graded by whether they expose more disprovable-claim surface area per artifact volume, not by whether they converge to a final form. **v2's primary move is to elevate this discipline from a single §14b forcing constraint to the organizing backbone of the whole rubric:** §11 becomes a claim-falsifier ledger, every numeric claim across §1–§10 carries a falsifier tag, and §14b is refactored from "invent 2-3 headline falsifiers" into "synthesize from the §11 ledger."

**Purpose.** This rubric governs the production and grading of **upper-surface reasoning artifacts** — exhaustive multi-perspective theoretical analyses of individual poker decision nodes. Artifacts are intentionally long-form, structurally exhaustive, and written to expose weak claims on the page where they can be audited rather than leaving them latent in the model's in-session reasoning.

**What this rubric enforces.** Depth, perspective-multiplication, epistemic honesty, and verification architecture. Every claim must be traceable to a source or labeled as an assumption. Every claim must carry a falsifier. Every perspective must differ visibly from the others before reconciliation. Every artifact distills a small set of headline falsifiers whose firing would flip the core recommendation.

**What this rubric does not enforce.** Word count. Prose quality. Length is a post-hoc observation of forcing-constraint satisfaction, not a target. An artifact that satisfies every forcing constraint with terse precision is better than a verbose one that hand-waves.

**Relationship to existing work.**
- **LSW line audits** (`docs/design/audits/line-audits/`) grade authored teaching-content against external theory. Upper-surface artifacts serve as the pinned theoretical reference those audits can cite instead of re-deriving theory each time.
- **`POKER_THEORY.md`** is the theoretical scaffold. §9 (Documented Divergences) receives Category-D entries produced during Stage 4 comparisons.
- **Design framework** (`docs/design/`) governs UX quality. Upper-surface is poker-theory quality; the two are parallel, not nested.

---

## File conventions

Every artifact begins with the following frontmatter:

```
---
Rubric-Version: v2.3
Node-ID: <id per Appendix A>
Street: flop | turn | river | preflop
Line: <line file reference in src/utils/postflopDrillContent/lines.js>
Authored: <YYYY-MM-DD>
Authored-By: <session>
Status: draft | self-audited | externally-compared | superseded
Supersedes: <artifact id> | null
Superseded-By: <artifact id> | null
---
```

**`Rubric-Version`** is load-bearing. Auditors validate against the declared version. A v1 artifact is not graded against v2 rubric without explicit grandfathering (see Appendix B).

---

## The 14 required sections

Each section below specifies: **Forcing constraint(s)** (what must be present), **Drill-card surface** (the one-line compression that survives into the drill card — provisional in v1, finalized in v2), and **Pass/fail criteria** (what makes this section fail grading).

---

### §1. Node specification

**Forcing constraints.**
- Exact game state: stake, effective stack in bb, hero position, villain position(s), pot size at node, board cards if applicable.
- Action history as a sequence of `(actor, action, size)` tuples from first preflop action to current node.
- Pot-size derivation: pot at node must be algebraically reproducible from the action history and stakes. Show the math.
- **Prior-street filter rationale** (postflop only): a sentence per preceding street explaining the range-narrowing logic — not "BB 3bet range" but "BB 3bet range filtered by calling the flop donk, which removes X combo class and retains Y."

**Drill-card surface.** "Node ID + one-line situation description."

**Pass/fail.** Fails if: pot size not derivable from sizings; action history missing any player decision; filter rationale qualitative-only for any postflop street.

---

### §2. Range construction, both sides

**Forcing constraints.**
- Combo-count enumeration for BOTH players through EACH action in the history — not just the endpoint.
- Show the filter at each step: "Opening range: 280 combos. Called: 180 retained. 3bet: 62 retained. Called 3bet: 48 retained."
- For each retained range, break down by hand class (pairs, suited connectors, Ax suited, broadway offsuit, etc.) with combo counts per class.
- For the current node (the node-of-interest range), **full hand-class enumeration is required** — a table listing every hand class present with exact combo counts, not approximations. This is the range §3–§12 depend on precisely; it cannot be summarized as "~25-30 combos."
- Upstream filter ranges (preflop opens, preflop 3bets before reaching this flop) may use estimates, but any estimate must be labeled with a ± confidence interval (e.g., "75–85 combos" or "80 combos ±15%"). Estimates that hide precision via "≈" notation without a range are a rubric violation.
- **First-pass enumeration discipline (v2.1, Delta D10).** Per-class bet/call/fold frequencies in the node-of-interest table must be committed to *before* computing aggregate ratios (value:bluff composition, total combo counts). If the aggregate ratio is then calibrated against an external reference (LSW audit number, solver output, coaching article), the first-pass derivation must be preserved in the artifact as a separate table or column, with reconciliation notes showing what was adjusted and why. Silent back-solving to a target ratio — adjusting per-class frequencies until the aggregate matches a known number, without disclosing the adjustment — is a rubric violation. Surface-area cost: forces a second small table; benefit: prevents the derivation-integrity failure observed in the river pilot.
- **Multi-way extension (v2.3, Delta D17).** For multi-way artifacts (>2 players postflop), §2 includes: (a) **per-villain preflop range** with independent filter history, (b) **per-villain flop/turn/river filter** where applicable, (c) a **combined villain range table** with inclusion-exclusion accounting for card-removal-between-villains (each combo held by one villain precludes it in another villain's range; the naive sum overcounts). The combined range is the decision-relevant aggregate hero's action faces; per-villain tables remain required for §7 + §8 analysis. Hero's card-removal effects must be applied to each villain's range separately and then to the combined range.

**Drill-card surface.** "Hero range ≈ X combos (composition: Y). Villain range ≈ Z combos (composition: W)."

**Pass/fail.** Fails if: combo counts are qualitative ("narrow", "wide"); any preflop action filter is elided; ranges jump from preflop to current street without showing intermediate action filters.

**Preflop-node exception.** For preflop-only nodes (e.g., `utg-vs-bb-srp-preflop-open-facing-3bet`), the "at each step" requirement applies to the node-entry decision space — the full set of feasible actions at this node (open / fold / 3bet / cold-call) with their respective ranges — rather than to prior-street filters, since no prior street exists.

**AI failure mode:** quoting industry range charts by name ("opens 20%") without doing the combo arithmetic. Combo counts must appear as numbers, not as percentages only.

---

### §3. Equity distribution shape

**Forcing constraints.**
- Bucketed combo-count table for: (a) hero's hand vs. villain's range, (b) villain's range vs. hero's range. Buckets: nuts (>80% eq), strong (60-80%), medium (40-60%), weak (20-40%), air (<20%).
- For villain's range, NAME the combos in each bucket with combo counts. E.g., "Strong: 99/TT/66 sets (9 combos), JJ-AA overpairs (24 combos), JTs two-pair (3 combos) = 36 strong combos."
- **Per-class equity must be derived, not asserted.** Each bucket's equity value (or per-hand-class equity within a bucket) must either (a) cite an equity-computation source (Equilab, PokerStove, solver output, or an explicitly-referenced equity article), or (b) show a combinatorial outs-based derivation ("vs QQ overpair on T96 flop, hero has 2 Ts for trips + 3 Ts on turn + runner-runner ≈ 22%"). Unsupported equity values like "~22%" without derivation are a rubric violation. Ledger tag for each value: `equity-computed` (with source), `equity-derived` (with outs-math inline), or `equity-estimated` (explicit ± range required).
- State the average equity AND the shape. A 45% average with a bimodal distribution (half nuts, half air) plays very differently from a 45% average with flat medium distribution. Bimodality must be quantified: compare against a counterfactual flat-distribution case to show the recommendation-relevant difference.
- **River-decision pure-bimodal framing (v2.1, Delta D12).** For river-decision nodes (depth-3 collapses to showdown — see §8), equity is strictly bimodal: each villain combo produces 0% or 100% equity for hero (no drawing remains). §3 for river decisions must explicitly state "pure-bimodal river equity distribution" and express hero's total equity as `P(ahead) = count(combos hero beats at showdown) / count(total combos in villain's range)`. Bucket-counts still required, but the standard 5-bucket scheme collapses to two: "nuts (hero wins at showdown, 100%)" and "air (hero loses at showdown, 0%)." The "compare to counterfactual flat distribution" requirement does not apply on river — bimodality is a structural property of post-showdown equity, not a distributional choice.

**Drill-card surface.** "Equity: X% nuts / Y% strong / Z% medium / W% weak / V% air."

**Pass/fail.** Fails if: equity presented only as a single average; buckets are named without combos; the bimodal vs flat distinction is not addressed.

---

### §4. Solver baseline

**Forcing constraints.**
- State what GTO solver says for hero's action distribution at this node: frequencies per action (not a single action).
- At least one cited source per claim. Acceptable sources: GTO Wizard articles, PIO/Monker/GTO+ output, solver-based article corpora (Upswing solver series, Run It Once solver summaries).
- If the exact node isn't in the cited source, explicitly distinguish: "Cited source addresses this type of spot (non-broadway middling board in 3BP) but not this exact runout. Extrapolating with caveat: ..."

**Drill-card surface.** "Solver: <action> at <frequency>%."

**Pass/fail.** Fails if: source is not cited; action given as a single action rather than frequencies; type-vs-exact distinction not acknowledged when applicable.

---

### §5. Population baseline

**Forcing constraints.**
- State what the live pool does at this node, with at least one cited source OR explicit labeling as "auditor's observation, no source" (explicitly — not silently).
- Distinguish stake levels where data is stake-specific.
- State sample size or data vintage if the source supplies it.
- **Sourcing floor (v2).** At least ONE population claim per artifact must be cited from a source with stated methodology — a published HUD-aggregate article, a stake-labeled dataset, or a coaching article that states its population-data basis. "Live-pool pattern inference" alone does not satisfy the floor.
- **Confidence-floor note (v2, when sourcing floor not met).** If all §5 claims are labeled-unsourced (e.g., this session lacks access to a sourced population dataset), the artifact must include an explicit note: "§5 population-baseline confidence floor: all claims are labeled-unsourced (pattern observations, n≈0). §6 and §12 inherit aggregate uncertainty from §5's unsourcedness. Treat §5 as the weakest-link input until a sourced population baseline is authored." This note is required even if the artifact's recommendation appears robust to the uncertainty.

**Drill-card surface.** "Population: <tendency>, <frequency>, <stake qualifier>."

**Pass/fail.** Fails if: population claim made without source AND without explicit unsourced label; stake level not distinguished when source is stake-specific; sourcing floor not met AND confidence-floor note absent.

---

### §6. Exploit recommendation

**Forcing constraints.**
- **Ordering:** §4 and §5 must be authored in full before §6 is drafted. §6 references §4 and §5 by section content; drafting §6 against unwritten baselines is a rubric violation. Gate A observed: when the author drafts §6 from memory rather than from the written §4/§5, the delta-vs-baselines constraint degrades to restating what the author already believes rather than confronting the written baseline.
- Hero action at this node.
- Explicit delta vs §4 (solver baseline): "This recommendation differs from solver by X because Y." Y must be a causal claim (e.g., "because population-deviation D creates exploitable fold% F"), not a restatement ("because population plays differently").
- Explicit delta vs §5 (population baseline): "This recommendation differs from population by X because Y."
- If recommendation matches both §4 and §5, state that explicitly. Do not omit the deltas.
- **Archetype-conditional recommendation (v2.1, Delta D11).** If §12 sensitivity analysis identifies villain archetype as the decision-flipping dimension (i.e., the recommendation changes between fish / reg / pro / nit), §6 may be structured as an archetype-conditional recommendation. Form: `Default: <action> (for <archetype-mix or most-common-archetype>). Override: if villain is <archetype>, <different action> because <§12 reference>.` The default action's deltas vs §4 and §5 must still be computed; override cases reference §12 directly without re-deriving deltas. This structure is preferred over hiding the archetype-flip in §12 alone because the reader of §6 sees the conditionality at the recommendation site, not buried in sensitivity analysis.

**Drill-card surface.** "Recommended: <action>. Exploit source: <vs solver | vs population | both | neither>."

**Pass/fail.** Fails if: recommendation doesn't explicitly compare to both §4 and §5; any "because" is a restatement rather than a causal claim.

---

### §7. Villain's perspective

**Forcing constraints.**
- Re-describe the same node from villain's seat. Must include:
  - Villain's range as villain sees it (same range as §2, different framing).
  - Villain's model of hero's range. **This must differ from hero's actual range** — villain has imperfect information. Quantify the mis-weighting: "villain's model represents hero with X% flush-draw fraction (actual: Y%); villain's model represents hero with A% set fraction (actual: B%)."
  - Villain's decision logic: why did villain make the action that brought us to this node? Express as expected-value comparison from villain's perspective.
- State what villain thinks hero is doing, not what hero is actually doing.
- **Villain-EV traceability (v2).** Every numeric EV claim in §7 (e.g., "check-EV ≈ 3bb, donk-EV ≈ 4.5bb") must either appear as a row in §11 with source + falsifier, or derive inline from numbers already in §11 (with the derivation shown). Unsourced villain-EV numbers pulled to justify villain's decision logic are a §7 rubric violation — villain's perspective cannot be built on numbers the author has not disciplined.
- **Multi-way extension (v2.3, Delta D17).** For multi-way artifacts, §7 includes: (a) **one subsection per villain** — each villain's range-as-they-see-it + model-of-hero + decision-logic-EV; (b) a **joint-villain synthesis** subsection that addresses: joint-fold-equity computation (product of per-villain fold rates, noting correlation vs independence), order-of-action dependencies (a villain acting later uses earlier villains' actions as signal), and cross-villain exploit implications (e.g., "villain A folds more when villain B calls"). A single aggregate villain-perspective is insufficient; the individual perspectives AND the joint synthesis are both required.

**Drill-card surface.** "Villain sees: <their range>; villain thinks hero holds <apparent hero range>."

**Pass/fail.** Fails if: villain's apparent-hero-range is identical to hero's actual range (common AI failure mode — perspective collapse); villain's decision logic is stated without EV comparison.

**AI failure mode:** villain's perspective becomes a rewrite of hero's with pronouns swapped. Test: does villain's apparent-hero-range differ from actual hero range? If no, the section has failed.

**Heuristic — perspective-collapse detector.** If villain's apparent-hero-range is stated in fewer than ~15 words, re-read: pronoun swap is the likely failure mode. A genuine apparent-range specification names what villain **over-weights** and what villain **under-weights** in hero's range, which rarely compresses below 15 words without losing the asymmetry.

---

### §8. EV tree: depth 1, 2, 3

**Forcing constraints.**
- For the CHOSEN action: EV at depth 1 (immediate), depth 2 (next street or next villain action), depth 3 (showdown or terminal node).
- For EACH REJECTED action: the same depth-1/2/3 EV computation, or explicit collapse.
- When depth 3 is trivially a showdown (e.g., for a river decision), state: "Depth 3 collapses to showdown at X% equity."
- When a depth is infeasible (e.g., all-in before depth 3), state: "Depth 3 N/A — pot closed."
- **Concrete collapse forms.** Acceptable examples: "depth 3 = showdown at X% equity" (river decisions); "depth 3 = pot closed at depth 2 — both players all-in" (jam lines); "depth 3 = effectively-terminal, EV = pot × equity_vs_remaining_range" (short-stack auto-decisions). Unacceptable: "depth 3 not applicable" without stating the collapse mechanism.
- **Branch-level derivation (v2).** Depth-2 EV computations must show **per-runout-class (or per-villain-action) breakdown** before summing to a weighted total. Acceptable form: a table with rows `brick turn | heart turn | straight-completing turn | pair turn | overcard turn` (or the analogous branch decomposition for the node's decision tree), each row containing probability of arriving + EV-in-that-branch + weighted contribution. "Depth-2 weighted adjustment: +0.5bb" without a table showing the component branches is a rubric violation. Depth-3 may summarize if depth-2 breakdown is complete and depth-3 follows mechanically; otherwise same rule applies.
- **Realization factor consistency (v2).** If different branches use different realization factors (e.g., call-branch 0.88, raise-called 0.80), the delta must be derived — "raise-called lines face X% check-raise probability × Y% realization depression if check-raised = baseline minus Z" — not asserted.
- **Multi-way extension (v2.3, Delta D17).** For multi-way artifacts, §8 EV tree may use **scenario-grouping** (e.g., "both fold / one folds / all call / raise") rather than raw per-villain-action branching to manage combinatorial explosion. Grouped probabilities must be: **exhaustive** (sum to 1.0), **non-overlapping** (no scenario counted twice), and **decision-relevant** (the grouping distinguishes EV-materially-different outcomes). Joint-probability derivation (product of independent fold rates, or documented correlation adjustment) must be shown for each scenario. For 3-way, ~4-6 scenarios typically suffice; 4+-way may require more.
- EV numbers must be in bb or pot fractions, consistent across the section.

**Drill-card surface.** "Chosen: EV ≈ X bb. Next-best rejected: Y bb. Delta: Z bb."

**Pass/fail.** Fails if: only the chosen action's EV is given; any depth is elided without explicit collapse/N-A justification; units inconsistent.

**AI failure mode:** computing depth-1 for the chosen action and hand-waving "deeper EV trees support this." Rejected actions must be quantified to justify rejection.

---

### §9. Blocker/unblocker accounting

**Forcing constraints.**
- For hero's specific cards in the node (or hero's hand class if abstract): enumerate the combos blocked in villain's value range, and combos blocked in villain's bluff range.
- Quantify the net effect on fold% or value-concentration: "Blocking 2 combos of value, 1 combo of bluff, net shift in villain's value:bluff ratio from 55:45 to 48:52, which shifts breakeven fold frequency by X%."
- If hero's hand blocks nothing material, state that explicitly with reasoning.

**Drill-card surface.** "Blockers: hero blocks <X value / Y bluff>; net effect: <quantified fold% shift>."

**Pass/fail.** Fails if: blockers named qualitatively ("good blockers") without combo-level enumeration; "nothing material" claim made without reasoning.

---

### §10. MDF, auto-profit, realization

**Forcing constraints.**
- **MDF:** Compute minimum defense frequency for the pot-odds being offered at this node. Show the formula: `MDF = pot / (pot + bet)`. State actual numbers.
- **Auto-profit threshold:** Compute villain's required bluff frequency for hero's fold to be auto-profitable. Show the formula.
- **Realization factor:** State hero's range's expected realization factor (equity realized vs equity entitled). Adjust for texture, position, SPR. Justify each adjustment with a sentence.
- **Range-vs-hand MDF divergence (v2.3, D15).** If range-level MDF (hero's range must defend X% of combos) diverges from individual-hand correctness (hero's specific hand in top-of-range by preflop strength does not meet MDF at the runout-conditional range composition), the artifact must explicitly state why. The classic case: hero holds a premium preflop hand whose runout-specific equity drops below pot-odds despite being "top of range." This exposes that **MDF is a range-aggregate constraint, not an individual-hand prescription** — the rubric formalizes this to prevent "I have AA/AK/TPTK so I must call" reasoning that skips the runout-conditional equity check.
- **Multi-way extension (v2.3, Delta D17).** For multi-way artifacts, §10 reports: (a) **per-villain MDF** (informational — what each villain would need to defend if alone), AND (b) **joint MDF** (the aggregate fold rate across all villains combined that makes hero's cbet auto-profitable, accounting for joint-fold-equity being the product of per-villain fold rates). Joint MDF is the **decision-relevant metric** for multi-way cbet or bet decisions; per-villain MDFs are contextual. For call decisions facing multi-way bet, the joint-calling-range composition replaces single-villain range analysis. "Per-villain MDF only" is a §10 rubric violation for multi-way artifacts.

**Drill-card surface.** "MDF: X%. Auto-profit: Y%. Realization: Z (adjusted for <texture/pos/SPR>)."

**Pass/fail.** Fails if: any of the three numbers given without derivation; realization stated without texture/position/SPR adjustment rationale.

---

### §11. Claim-falsifier ledger

**Primary reframe (v2).** This section was called "Confidence ledger" in v1/v1.1. In v2 it is renamed and restructured around the claim-falsifier discipline. The ledger is now the rubric's organizing backbone — every numeric claim in §1–§10 appears as a row with both source *and* falsifier. The invariant the rubric measures is how densely the ledger packs disprovable-claim surface area into the artifact's finite volume.

**Forcing constraints.**
- Every numeric claim made in §1-§10 appears as a row in the claim-falsifier ledger.
- **Columns:** `Claim | Value | Source-type | Source-citation | Sample | Credible-interval | Falsifier | Notes`
- `Source-type` ∈ {`solver`, `population-cited`, `population-consensus-observed`, `population-observed`, `read`, `computed`, `assumed`}.
  - `population-consensus-observed` (new in v2.3, D14): ≥2 independent coaching sources agree on the claim direction (not necessarily exact numeric value); no single dataset-with-methodology underpins the claim. Examples: "Doug Polk + Ed Miller + Jonathan Little all note live pool under-bluffs scare-cards" is `population-consensus-observed`. A claim sourced to one coaching source alone is `population-observed` (consensus-of-one is not consensus). **Sourcing-floor note:** a single `population-consensus-observed` row satisfies the v2 Delta 3 "≥1 sourced population claim" requirement IF at least one of the consensus-sources has stated methodology in their content (audience + stake context + data basis). Numeric values carry wider CI than `population-cited` (dataset-level) by convention.
- For `population-cited` and `population-observed`: sample size required if available; "unknown" acceptable if disclosed.
- For `read`: sample size required, credible interval required (e.g., Beta posterior 5-95% CI).
- For `computed`: list the inputs used.
- For `assumed`: state the assumption and why it was necessary.
- **Falsifier column (v2 — the primary move).** Every row must specify a falsifier: an observable event or re-derivation with a threshold that would disprove the claim. Three acceptable falsifier types:
  - **Internal:** the claim is a derived computation whose falsifier is a re-derivation. Form: "Recomputing from §X inputs yields value outside [L, H]." Acceptable for `computed` claims where the math is transparent.
  - **External-operational:** the claim is checkable against an observable event in the real world. Form: "A sample of N observations shows the measured quantity outside [L, H]." Required for `read`, `population-observed`, `population-cited` claims wherever operationally possible.
  - **Theoretical:** the claim defers to a solver or authoritative theoretical source. Form: "Solver output at this exact node, at depth D and stack depth S, disagrees with the value by more than ε." Acceptable for `solver` and some `assumed` claims.
  - Falsifiers may be trivial for trivial claims (MDF re-derivation, pot-math verification). They must be **non-trivial** for `assumed`, `read`, `population-observed`, `population-cited` — those are the load-bearing uncertain claims, and their falsifiers are what make the ledger a meaningful surface-area measure.
- **Completeness gate (v2).** Before marking the artifact status `draft-complete`, the author performs a mechanical sweep of §1–§10, confirms every numeric claim appears in the ledger with a falsifier, and logs at the end of §11: `[Completeness: swept YYYY-MM-DD, N claims ledgered, all falsifiers present]`. Grading fails if ≥3 numeric claims are missing from the ledger or lack falsifiers.

**Drill-card surface.** "Highest-confidence claim: X (solver). Lowest-confidence: Y (assumed — reason: Z). Closest operational falsifier: W."

**Pass/fail.** Fails if: any numeric claim from §1-§10 is absent from the ledger; any row lacks a falsifier; any `read` or `population-observed` row lacks sample size; any `assumed` row lacks justification; completeness-gate log is missing.

**AI failure mode:** elision between solver-derived and read-derived. A claim like "villain folds 60% to turn bets" is solver, population, or read — the ledger forces disambiguation. **New failure mode (v2):** trivial falsifiers for non-trivial claims. A falsifier of "if the value is different, it's wrong" is tautological and non-disprovable — the rubric requires a specific threshold and an observation path.

---

### §12. Sensitivity analysis

**Forcing constraints.**
- Name 2-3 specific assumptions drawn from the §11 ledger (prefer `assumed`, `read`, `population-observed` rows — the lowest-confidence inputs).
- For each: state the current value, state the flip threshold (the value at which the recommendation in §6 changes), and by how much EV changes at the flip.
- Flip thresholds must be numeric. "If villain tightens" is not a flip threshold; "if villain's fold% drops below 48%" is.

**Drill-card surface.** "Flip if: <assumption> crosses <numeric threshold>."

**Pass/fail.** Fails if: any named assumption lacks a numeric flip threshold; sensitivity is qualitative.

**AI failure mode:** "The recommendation is robust to moderate changes in the assumptions." Vacuous. Must specify which assumptions and what numeric changes.

---

### §13. Contrast with leading theories

**Forcing constraints.**
- Compare claims made in §4, §5, §6, §10 to at least **three distinct external sources**. Acceptable sources:
  - Solver corpora: GTO Wizard blog, PIO-based Upswing articles, Run It Once solver summaries
  - Published theory: Matthew Janda (*Applications of No-Limit Hold'em*), Ed Miller, Owen Gaines, Tommy Angelo, Andrew Brokos
  - Modern pedagogy: Upswing course material, PokerCoaching.com, CardQuant, Run It Once, 888poker theory articles
  - Population data: any stake-labeled population dataset (e.g., HUD-derived aggregate stats published in theory articles)
- Each comparison categorized:
  - **A** = agreement (our claim matches source)
  - **B** = our reasoning wrong (artifact must be revised in-place)
  - **C-wrong** = source makes a claim the author believes is factually incorrect (artifact must justify the disagreement with reasoning and cite the counter-evidence)
  - **C-incomplete** = source simplifies for its pedagogical level in a way that misses material nuance at the upper-surface level (not wrong at its own level; incomplete at ours). Artifact must state what the simplification omits and why that omission is material.
  - **D** = intentional divergence (e.g., we teach a live-pool exploit while source teaches solver equilibrium). D-items MUST feed `POKER_THEORY.md §9`.
- The full artifact must contain **at least one B, C-wrong, or C-incomplete** across all comparison entries. **D alone is insufficient.** Intentional divergence is easier to claim than disagreement with a source's content. Gate A observed: D-only categorizations skip the hardest honest-contrast work because D lets the author sidestep the question of who is right. If no B / C-wrong / C-incomplete emerges naturally during comparison, the artifact must add an **"Active challenge"** sub-section in §13 stating (a) which specific external source the author examined for disagreement, (b) what claim in the artifact's own reasoning the author attempted to challenge, and (c) why the attempt produced no B or C finding.
- **Search-depth documentation when zero B/C found (v2.3, D16).** When Active-challenge produces zero B-wrong, C-wrong, and C-incomplete findings (the consensus-robust case), the artifact must document search depth explicitly:
  - **Count of distinct sources probed for disagreement** (minimum 3 beyond the headline sources agreed-with).
  - **Specific angles attempted** — list at least 3 of: contrarian camps, pre-solver era, elite high-stakes coaching, tournament-specific, live-vs-online-tier, population-data-contrary, unconventional-school (e.g., Zeebo/Jaffe-style pure-exploit). If fewer angles apply, state why.
  - **Closest-to-disagreeing source found** — name the source that came closest to a B/C and explain why it categorized A rather than C/B.
  - "No disagreement found" without this three-part documentation fails grading. This formalization prevents hidden-consensus-avoidance (claiming consensus after only cursory search).
- **Two reflexive checks before finalizing §13 (v2.2, Delta D13).** §13 must include both checks below. Each check produced a Stage 4 B-finding that the artifact's first-pass §13 missed; v2.2 makes them mandatory.
  - **Internal-arithmetic check.** For every weighted-average claim in the artifact (typically §3 weighted equities, §8 EV summaries, §9 blocker-shifted ratios), recompute from the §11 ledger inputs and confirm the result lies inside the row's stated credible-interval. If the recomputation falls outside the CI, this is a B-finding the artifact must reconcile before §13 finalizes.
  - **Source-scope check.** For every cited external source in §13, verify the source's own stated context (stake tier, stack depth, opponent profile, pool — online vs live, etc.) covers the artifact's claim context. If the source's scope does not include the artifact's claim context, the source attribution is over-broad and the artifact must either (a) tighten the citation language to acknowledge the scope mismatch, or (b) cite an additional source whose scope does cover the claim. Source-scope-mismatch with no reconciliation is a B-finding.

**Drill-card surface.** "Contested claim: X (source Y disagrees — category C/D)." Null if all A (but see AI failure mode).

**Pass/fail.** Fails if: fewer than 3 sources consulted; no B, C-wrong, or C-incomplete entries AND no Active-challenge sub-section; any D-entry not also mirrored in `POKER_THEORY.md §9`; internal-arithmetic check or source-scope check (v2.2 D13) not performed.

**AI failure mode:** all-A categorization as avoidance. If an artifact claims agreement with every source, the auditor must ask: "Did the author cherry-pick sources that agree?" A single honest B/C/D tells us the comparison exercise was real.

---

### §14. Verification architecture

Three sub-sections, each with its own forcing constraint.

#### §14a. Symmetric-node test

**Forcing constraint.**
- Name the **mirror node** — the closest symmetric counterpart. Examples:
  - For `BTN-vs-BB 3BP flop`, the mirror is `BB-vs-BTN 3BP flop` (role inverted) OR `SB-vs-BTN 3BP flop` (position inverted). State which and why.
- For each claim in §1-§10 (or a representative subset for very large claim sets), state:
  - `inverts` (expected; e.g., position-dependent realization factors)
  - `stays` (must include a one-sentence justification; "stays without justification" is a rubric violation)
  - `partially changes` (specify direction and approximate magnitude)
- Minimum: 6 claims must be classified. Cannot aggregate ("most claims invert").
- **Partially-changes cap (v2).** No more than 3 of the classified claims may be `partially changes`. If more than 3 are partial, the chosen mirror is too entangled (the claims do not cleanly decompose along the mirror's axis of symmetry) — select a cleaner mirror or classify more precisely. A mirror where everything partially changes measures nothing.

**Drill-card surface.** "Mirror: <node>. Inverts: X. Stays: Y."

**Pass/fail.** Fails if: mirror node not named; any "stays" claim lacks justification; fewer than 6 claims classified; more than 3 partially-changes classifications (indicating poorly-chosen mirror).

#### §14b. Artifact-level falsifier synthesis

**Reframe (v2).** §11 now carries per-claim falsifiers (v2 primary move). §14b is no longer a place to **invent** 2-3 free-standing falsifiers; it is the **synthesis** that distills from §11 the subset of falsifiers whose firing would flip §6's recommendation. These are the "headline falsifiers" — the operationally-important subset that matters at decision-level, not just at claim-level.

**Forcing constraint.**
- Select 2-3 falsifiers from §11 rows whose threshold, if crossed, would flip §6's recommendation from its current action to a different action (via §12 sensitivity propagation).
- Each headline falsifier must:
  - Cite its §11 ledger row by claim name.
  - State the threshold value that would flip §6.
  - Explain the propagation path: §11 claim shifts → §X downstream claim shifts → §12 sensitivity triggers → §6 recommendation changes.
- If no §11 claim has a falsifier that would flip §6, the recommendation is robust at decision-level — state this explicitly. "No headline falsifiers; recommendation is decision-level-robust across all §11 assumption ranges" is acceptable and itself a meaningful confidence signal.

**Drill-card surface.** "Recommendation falsified by: <headline falsifier + §11 row + propagation to §6>."

**Pass/fail.** Fails if: any headline falsifier is not traceable to a §11 row; any headline falsifier is qualitative; fewer than 2 headline falsifiers without the "decision-level-robust" statement.

**AI failure mode (v2):** inventing new falsifiers in §14b that weren't in §11. §14b discipline is synthesis, not creation. If a falsifier belongs in §14b, it belongs in §11 first.

#### §14c. Counter-artifact pointer

**Forcing constraint.**
- Name the hypothetical artifact that would **supersede** this one, and state what it would contain.
- Example: "A stake-conditioned artifact that splits population baselines for 1/2 NL vs 5/10 NL would supersede §5 and §10 of this artifact."
- Purpose: force the author to name the limits of this artifact's own scope.

**Drill-card surface.** Optional (not typically compressed).

**Pass/fail.** Fails if: no counter-artifact named; counter-artifact is vague ("a better artifact").

---

## Grading scale (reused from LSW audits)

| Severity | Label | Meaning |
|---|---|---|
| 0 | resolved-under-audit | Identified, analyzed, found non-issue or fixed during audit |
| 1 | P3 | Minor — imprecision, taxonomy, or low-leverage content issue |
| 2 | P2 | Moderate — structural issue or content issue that shapes student understanding |
| 3 | P1 | Load-bearing — the artifact's reasoning or teaching depends on the claim being right |
| 4 | P0 | Blocker — downstream work (further artifacts, drill UX, LSW citation) cannot proceed until fixed |

---

## Disagreement taxonomy (extended in v2 — split C)

| Cat | Meaning | Action |
|---|---|---|
| A | Our reasoning agrees with source | No action |
| B | Our reasoning is wrong | Revise artifact in-place; log in audit |
| C-wrong | Source makes a factually incorrect claim | Justify disagreement in artifact; cite counter-evidence; add source-tie-break note |
| C-incomplete | Source simplifies pedagogically; omission is material at upper-surface level | State what is omitted; state why omission matters; cite the simpler source and our nuance |
| D | Intentional divergence (solver vs live-pool, theory vs exploit, etc.) | Document in `POKER_THEORY.md §9`; justify in artifact |

---

## Appendix

### A. Node-ID schema

Format: `<hero-position>-vs-<villain-position>-<pot-type>-<position-modifier>-<texture>-<runout>-<node-type>`

Examples:
- `btn-vs-bb-3bp-ip-wet-t96-flop_root` — BTN in position vs BB, 3-bet pot, wet T96 two-tone flop, root decision node (villain donks)
- `btn-vs-bb-srp-ip-dry-q72r-river_brick` — BTN IP vs BB, single-raised pot, dry Q72r flop, brick river (specific runout filled in inline)

Components:
- **hero-position**: `btn` | `co` | `hj` | `mp` | `utg` | `sb` | `bb`
- **villain-position**: same set
- **pot-type**: `srp` (single-raised) | `3bp` | `4bp` | `limpedpot`
- **position-modifier**: `ip` | `oop` (hero's position relative to villain at this node)
- **texture**: `dry` | `wet` | `very-wet` | `paired` | `monotone` | `broadway` + specific ranks (e.g., `t96`, `q72r`, `ahkhqh`)
- **runout**: for turn/river nodes, append runout card(s) or texture shift (e.g., `t962b` = T96 turn brick 2; `t96_brick_3d` = full specificity)
- **node-type**: `flop_root` | `turn_after_X` | `river_after_X` | `river_vs_checkraise` etc. — matches `lines.js` node IDs where possible for traceability

**Filenames derive from node IDs directly.** File: `<node-id>.md`.

### B. Rubric versioning policy

- Each artifact declares `Rubric-Version: vN` in frontmatter.
- An artifact is only graded against the declared version. v1 artifacts are not silently held to v2 standards.
- When rubric changes (new forcing constraint, removed constraint, altered categorization), **bump the rubric version and log the diff in a `RUBRIC-CHANGELOG.md` entry**.
- Existing artifacts either (a) get re-validated against the new version in a re-audit, or (b) get explicitly grandfathered with a note in their frontmatter: `Rubric-Version: v1 (grandfathered under v2, not re-audited)`.
- Do not silently update old artifacts to satisfy new constraints. That hides the rubric's evolution.

### C. Source-disagreement tie-break

When sources cited in §13 disagree with each other (e.g., Janda vs GTO Wizard), apply the following:

1. **Modern solver-based sources > pre-solver published theory** for pure GTO questions (since ~2015). Pre-solver sources (early Janda, older Sklansky) may be legitimate D-category divergence where they address population-behavioral claims, not GTO.
2. **Cited source with population data > cited source without data** for population claims.
3. **Cited source with explicit methodology > cited source without** for any claim.
4. **When all else equal, recency wins**, but age alone is not a tie-break — new can be wrong.
5. If no resolution: document as open disagreement (treat as Category-C with "unresolved" flag). Not a rubric failure; must be disclosed.

### D. Length policy

**No word-count target.** Length is a post-hoc observation of forcing-constraint satisfaction.

Diagnostic heuristics (not rules):
- If total length <3k words: most likely §11 (ledger) or §13 (contrast) is under-populated. Audit those first.
- If total length >15k words: most likely §2 (range construction) has become a range bible, or §4/§5 has become a literature review. Prune to the claims that feed §6-§12.
- The target is density, not brevity: every paragraph should participate in a forcing constraint or its reasoning.

### E. Audit format reference

Self-audits (Stage 3a, 3b) use the LSW line-audit format. Reference templates:
- `docs/design/audits/line-audits/_TEMPLATE.md`
- `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md` (closed example)
- `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md` (draft example)

Audit produces:
- Per-section severity-graded findings (using §B scale, §C taxonomy)
- Prioritized fix list
- Rubric-change proposals (if audit reveals rubric gaps rather than artifact gaps — the expected v1 → v2 path)

### F. File organization

```
docs/upper-surface/
├── RUBRIC.md                              (this file)
├── RUBRIC-CHANGELOG.md                    (created at v1 → v2 transition)
├── reasoning-artifacts/
│   └── <node-id>.md
├── audits/
│   └── <node-id>-audit.md
├── comparisons/
│   └── <node-id>-external.md
└── drill-cards/
    └── <node-id>.md
```

Artifact, audit, comparison, and drill-card for the same node share the node-ID stem.

---

## Change log

- **2026-04-22 — v1 drafted.** Pre-pilot. Forcing constraints and drill-card surfaces are provisional.
- **2026-04-22 — v1.1 applied after Gate A dry-run.** Four deltas from the sketch on `btn-vs-bb-3bp-ip-wet-t96-flop_root`: (1) §6 ordering constraint — §4 and §5 must be authored before §6; (2) §13 strengthened B/C requirement — D alone insufficient, Active-challenge sub-section required when no B or C emerges; (3) §2 preflop-node exception — "at each step" applies to node-entry decision space for preflop-only nodes; (4) §8 concrete depth-3 collapse forms with examples. Plus one heuristic: §7 perspective-collapse detector (~15-word minimum for apparent-range).
- **2026-04-22 — v2 applied after Stage 3a self-audit + owner reframe.** Owner introduced the invariant: the upper-surface process is unbounded; what we measure is disprovable-claim surface area per artifact volume. v2 elevates the claim-falsifier discipline from §14b to the rubric's organizing backbone. **Primary delta (D9):** §11 becomes the claim-falsifier ledger — every numeric claim in §1-§10 carries a falsifier column with threshold-specified observation (internal / external-operational / theoretical). §14b refactored as synthesis from §11, not free-standing falsifier invention. **Supporting deltas (D1-D8):** §2 full enumeration at node-of-interest + ± confidence on upstream estimates; §3 per-class equity derivation required (no "~22%" without source); §5 sourcing floor + confidence-floor note when unmet; §7 villain-EV must trace to §11 or derive inline; §8 per-runout-class breakdown table required for depth-2 + realization-factor consistency across branches; §11 completeness gate (mechanical sweep log); §13 split C into C-wrong vs C-incomplete; §14a partially-changes cap (max 3). Full diff in `RUBRIC-CHANGELOG.md`.
- **2026-04-23 — v2.1 applied after Stage 3b self-audit on river pilot.** Three incremental polish deltas — no fundamental redesign. v2 survived the river-decision stress test (depth-3 collapse, realization=N/A, §14b synthesis) without rubric revision; v2.1 only adds polish for issues exposed by the river pilot. **D10:** §2 first-pass enumeration discipline — per-class frequencies must be committed before computing aggregate ratios; if calibrated to external reference, show reconciliation. Prevents silent back-solving observed in river pilot's value:bluff derivation. **D11:** §6 archetype-conditional recommendation form — when §12 identifies archetype as decision-flipping, §6 may state "Default action / Override if villain is X" rather than hiding the flip in §12 alone. Surfaces archetype-conditionality at recommendation site. **D12:** §3 river-decision pure-bimodal framing — explicit "P(ahead) = combos hero beats / total combos" form for showdown-collapse decisions. Bucket scheme collapses to nuts/air on river. Full diff in `RUBRIC-CHANGELOG.md`.
- **2026-04-23 — v2.2 applied after Stage 4 leading-theory comparisons.** One cross-pilot meta-delta (D13). Stage 4 surfaced the same §13 failure mode in both pilots: the artifact's first-pass §13 evaluated sources looking outward but didn't apply v2 falsifier discipline to its own outputs. Flop pilot missed an internal arithmetic inconsistency (hero equity 30% claimed, recomputation gives ~36%); river pilot missed a source-scope mismatch (GTO Wizard "Lower Limits" cited for live-cash claim, but source's stated context is online microstakes). **D13:** §13 must include two reflexive checks before finalizing — internal-arithmetic recomputation against §11 ledger, and source-scope verification for every cited source. Without these, B-findings discoverable from §11 alone go unsurfaced. Full diff in `RUBRIC-CHANGELOG.md`.
- **2026-04-23 — v2.3 applied as US-1 corpus-scaling batch.** Four deltas (D14-D17) accumulated across artifacts #3-#6 (turn-decision, river-OOP-fold, 4BP-jam, multi-way). Rather than apply one-at-a-time, batched as v2.3 to preserve established cadence of rubric-improving-between-artifacts. **D14:** `population-consensus-observed` source-type added to §11 — for multi-coach agreement without single-dataset-methodology. Sourcing floor (v2 D3) met when ≥1 consensus-source has stated methodology. **D15:** §10 range-vs-hand MDF divergence — when hero's top-of-range hand doesn't meet MDF at runout-conditional composition, explicit rationale required. Prevents "it's AA so I call" reasoning that skips runout-conditional equity check (observed in artifact #4's AA-as-bluff-catcher on scare-runout). **D16:** §13 search-depth documentation when zero-B/C found — required explicit source-count, angles-attempted, closest-to-disagreeing-source. Prevents hidden-consensus-avoidance. **D17:** multi-way extensions to §2 (combined-villain-range + inclusion-exclusion), §7 (per-villain subsections + joint synthesis), §8 (scenario-grouping permitted), §10 (joint MDF is decision-relevant metric). Formalizes ad-hoc extensions authored in artifact #6 (first multi-way). Full diff in `RUBRIC-CHANGELOG.md`.
