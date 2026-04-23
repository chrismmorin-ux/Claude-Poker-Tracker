# Upper-Surface Reasoning Rubric — v1

**Status:** v1 (provisional). Rubric will be revised to v2 after Stage 3a self-audit on the flop pilot; to v3 if the river pilot exposes street-generality bugs. See Appendix B for versioning policy.

**Purpose.** This rubric governs the production and grading of **upper-surface reasoning artifacts** — exhaustive multi-perspective theoretical analyses of individual poker decision nodes. Artifacts are intentionally long-form, structurally exhaustive, and written to expose weak claims on the page where they can be audited rather than leaving them latent in the model's in-session reasoning.

**What this rubric enforces.** Depth, perspective-multiplication, epistemic honesty, and verification architecture. Every claim must be traceable to a source or labeled as an assumption. Every perspective must differ visibly from the others before reconciliation. Every artifact must specify what would falsify it.

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
Rubric-Version: v1
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
- For the current node, state hand-class composition as a table.

**Drill-card surface.** "Hero range ≈ X combos (composition: Y). Villain range ≈ Z combos (composition: W)."

**Pass/fail.** Fails if: combo counts are qualitative ("narrow", "wide"); any preflop action filter is elided; ranges jump from preflop to current street without showing intermediate action filters.

**AI failure mode:** quoting industry range charts by name ("opens 20%") without doing the combo arithmetic. Combo counts must appear as numbers, not as percentages only.

---

### §3. Equity distribution shape

**Forcing constraints.**
- Bucketed combo-count table for: (a) hero's hand vs. villain's range, (b) villain's range vs. hero's range. Buckets: nuts (>80% eq), strong (60-80%), medium (40-60%), weak (20-40%), air (<20%).
- For villain's range, NAME the combos in each bucket with combo counts. E.g., "Strong: 99/TT/66 sets (9 combos), JJ-AA overpairs (24 combos), JTs two-pair (3 combos) = 36 strong combos."
- State the average equity AND the shape. A 45% average with a bimodal distribution (half nuts, half air) plays very differently from a 45% average with flat medium distribution.

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

**Drill-card surface.** "Population: <tendency>, <frequency>, <stake qualifier>."

**Pass/fail.** Fails if: population claim made without source AND without explicit unsourced label; stake level not distinguished when source is stake-specific.

---

### §6. Exploit recommendation

**Forcing constraints.**
- Hero action at this node.
- Explicit delta vs §4 (solver baseline): "This recommendation differs from solver by X because Y." Y must be a causal claim (e.g., "because population-deviation D creates exploitable fold% F"), not a restatement ("because population plays differently").
- Explicit delta vs §5 (population baseline): "This recommendation differs from population by X because Y."
- If recommendation matches both §4 and §5, state that explicitly. Do not omit the deltas.

**Drill-card surface.** "Recommended: <action>. Exploit source: <vs solver | vs population | both | neither>."

**Pass/fail.** Fails if: recommendation doesn't explicitly compare to both §4 and §5; any "because" is a restatement rather than a causal claim.

---

### §7. Villain's perspective

**Forcing constraints.**
- Re-describe the same node from villain's seat. Must include:
  - Villain's range as villain sees it (same range as §2, different framing).
  - Villain's model of hero's range. **This must differ from hero's actual range** — villain has imperfect information.
  - Villain's decision logic: why did villain make the action that brought us to this node? Express as expected-value comparison from villain's perspective.
- State what villain thinks hero is doing, not what hero is actually doing.

**Drill-card surface.** "Villain sees: <their range>; villain thinks hero holds <apparent hero range>."

**Pass/fail.** Fails if: villain's apparent-hero-range is identical to hero's actual range (common AI failure mode — perspective collapse); villain's decision logic is stated without EV comparison.

**AI failure mode:** villain's perspective becomes a rewrite of hero's with pronouns swapped. Test: does villain's apparent-hero-range differ from actual hero range? If no, the section has failed.

---

### §8. EV tree: depth 1, 2, 3

**Forcing constraints.**
- For the CHOSEN action: EV at depth 1 (immediate), depth 2 (next street or next villain action), depth 3 (showdown or terminal node).
- For EACH REJECTED action: the same depth-1/2/3 EV computation, or explicit collapse.
- When depth 3 is trivially a showdown (e.g., for a river decision), state: "Depth 3 collapses to showdown at X% equity."
- When a depth is infeasible (e.g., all-in before depth 3), state: "Depth 3 N/A — pot closed."
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

**Drill-card surface.** "MDF: X%. Auto-profit: Y%. Realization: Z (adjusted for <texture/pos/SPR>)."

**Pass/fail.** Fails if: any of the three numbers given without derivation; realization stated without texture/position/SPR adjustment rationale.

---

### §11. Confidence ledger

**Forcing constraints.**
- Every numeric claim made in §1-§10 appears as a row in a ledger table.
- Columns: `Claim | Value | Source-type | Source-citation | Sample | Credible-interval | Notes`
- `Source-type` ∈ {`solver`, `population-cited`, `population-observed`, `read`, `computed`, `assumed`}.
- For `population-cited` and `population-observed`: sample size required if available; "unknown" acceptable if disclosed.
- For `read`: sample size required, credible interval required (e.g., Beta posterior 5-95% CI).
- For `computed`: list the inputs used.
- For `assumed`: state the assumption and why it was necessary.

**Drill-card surface.** "Highest-confidence claim: X (solver). Lowest-confidence: Y (assumed — reason: Z)."

**Pass/fail.** Fails if: any numeric claim from §1-§10 is absent from the ledger; any `read` or `population-observed` row lacks sample size; any `assumed` row lacks justification.

**AI failure mode:** elision between solver-derived and read-derived. A claim like "villain folds 60% to turn bets" is solver, population, or read — the ledger forces disambiguation.

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
  - **C** = their reasoning wrong (artifact must justify the disagreement with reasoning)
  - **D** = intentional divergence (e.g., we teach a live-pool exploit while source teaches solver equilibrium). D-items MUST feed `POKER_THEORY.md §9`.
- The full artifact must contain **at least one B, C, or D** across all comparison entries. If every entry is A, the comparison is either dishonest or the artifact has contributed nothing novel — auditor re-grades.

**Drill-card surface.** "Contested claim: X (source Y disagrees — category C/D)." Null if all A (but see AI failure mode).

**Pass/fail.** Fails if: fewer than 3 sources consulted; no B/C/D entries across the artifact; any D-entry not also mirrored in `POKER_THEORY.md §9`.

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

**Drill-card surface.** "Mirror: <node>. Inverts: X. Stays: Y."

**Pass/fail.** Fails if: mirror node not named; any "stays" claim lacks justification; fewer than 6 claims classified.

#### §14b. Falsifier specificity

**Forcing constraint.**
- State 2-3 concrete observations that would falsify the artifact.
- Each falsifier must reference a **measurable quantity with a threshold**.
- Acceptable: "If pool CBet frequency on T96ss in 3BP is < 55% across n>500 sampled hands, §5 population baseline is wrong."
- Not acceptable: "If villain plays differently." "If this villain is unusual." "If new information emerges."

**Drill-card surface.** "Falsified by: <measurable observation + threshold>."

**Pass/fail.** Fails if: any falsifier is qualitative; fewer than 2 falsifiers.

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

## Disagreement taxonomy (reused from LSW audits)

| Cat | Meaning | Action |
|---|---|---|
| A | Our reasoning agrees with source | No action |
| B | Our reasoning is wrong | Revise artifact in-place; log in audit |
| C | Source is wrong (or outdated) | Justify disagreement in artifact; add source-tie-break note |
| D | Intentional divergence | Document in `POKER_THEORY.md §9`; justify in artifact |

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

- **2026-04-22 — v1 drafted.** Pre-pilot. Forcing constraints and drill-card surfaces are provisional. Gate A (Stage 1.5 dry-run sketch) and Gate B (Stage 3a self-audit) will stress-test this version. Expect v2 revisions focused on: (a) sections that produce platitudes under forcing constraints, (b) drill-card surfaces that don't compress cleanly, (c) AI failure modes not yet anticipated.
