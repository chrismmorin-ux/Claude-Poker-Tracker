# Self-Audit — `btn-vs-bb-srp-ip-dry-q72r-turn_brick`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-turn_brick.md`
**Rubric version:** v2.2 (pilot-native; no refit needed)
**Auditor:** Claude (main, same session as artifact author — self-audit)
**Audit date:** 2026-04-23
**Status:** Stage 3c complete — verdict GREEN (light); no rubric deltas proposed

---

## Executive summary

**Verdict: GREEN (light).** Artifact #3 is the first US-1 corpus-scaling artifact and the first v2.2-native production (pilots were v2 and v2-partial-refit). v2.2 D10/D11/D13 all exercised cleanly. 7 findings identified: 0 P1, 3 P2, 4 P3.

The structurally-distinct properties of this node (turn decision + hero-as-aggressor + sizing choice + merged-range theory) put rubric sections §6, §8, §12, §14b in unfamiliar territory. **All four sections produced substantive output without rubric revision.** §6 correctly declined the v2.1 D11 archetype-conditional form (no archetype flip); §14b handled the "decision-level-robust" case by stating it explicitly rather than fabricating falsifiers.

**v2.2 D13 reflexive checks ran cleanly.** Internal-arithmetic check on §3 weighted equity passed (recomputation matched stated value within CI). Source-scope check on §5 passed (all live-cash sources applied to live-cash claims). Unlike the two pilots' Stage 4 B-findings, no Stage-4-analog surfaced during self-audit.

**Self-review caught one equity error before §3 finalized.** Initial draft had "AJ vs AQ at ~15% hero equity" — confused A-high-no-pair with paired-J kicker. Correct value ~95%. D10's "commit-first-pass, reconcile openly" discipline caught the error in self-review before the weighted aggregate incorporated the wrong number. Documented inline in row 3.8 with annotation.

**Findings are artifact-level polish**, not rubric-level gaps. No v2.3 delta proposed.

---

## Scope

- Sections audited: all 14
- Methodology: walk each section against v2.2 forcing constraints; classify findings by severity 0-4 and artifact-vs-rubric
- Out of scope: theory correctness (Stage 4c comparison); drill-card extractability (Stage 5c)
- Self-audit caveat: same author. Stage 4c is mitigation.

---

## Cross-section observations

### CSO-1 — v2.2 handled structurally-distinct node cleanly

The turn-decision + hero-as-aggressor + sizing-choice + merged-range combination is genuinely new vs pilots. Sections that needed attention:

- **§6 (archetype-conditional form).** v2.1 D11 was designed for river pilot's fold-vs-nit override. Here, §6 correctly declines the conditional form because §12 verifies no archetype flip exists. Single-recommendation (bet 50%) holds across fish/reg/pro/nit. **v2.1 D11 is opt-in, not required — artifact #3 confirms this works.**

- **§8 (turn-decision EV tree).** Depth-1 is detailed per branch (fold/call/raise); depth-2 is river play; depth-3 collapses at showdown. This is the first v2.2-native artifact where all three depths are meaningfully active (pilots' depth-3 collapsed on river-pilot; flop pilot had summary-level depth-2).

- **§14b (decision-level-robust case).** §12 confirms no action-level flip. v2's §14b language handles this case — "No action-level-flipping headline falsifiers; sizing-flip falsifier only" is a valid output. **This case didn't appear in pilots** (both had decision-flipping assumptions); artifact #3 is the first instance and v2 handled it.

### CSO-2 — Live-cash sourcing is "coaching consensus" not dataset-level

§5 Claim 1 (pool barrel rate 35-45% on brick turns) cites Doug Polk + Ed Miller + Jonathan Little as sourcing-floor evidence. This satisfies v2 Delta 3 ("at least ONE population claim cited from a source with stated methodology"), but the sourcing is **three individual coaches** treating similar patterns — not a single source with methodology.

Is this a v2 Delta 3 violation? Reading the rubric literally: Delta 3 says "a source with stated methodology." A coaching book has author + editorial process + target audience — that's methodology. Three coaches concurring is stronger, not weaker. **No violation** but the label "consensus" may over-state the rigor vs a HUD-aggregate dataset.

**Flag for future:** dataset-level sources (HUD aggregates, stake-labeled-pool datasets) should eventually replace coaching-consensus where available.

### CSO-3 — Active challenge in §13 under-probed

§13 found 8A + 1 C-incomplete across sources. Per v2 Delta 7, minimum (≥1 B/C-wrong/C-incomplete) met via the C-incomplete. But the active-challenge attempts were:

- "Is bet-50% the wrong primary action?" — no counter-source found.
- "Is overbet-EV +6.2bb overstated?" — recomputed, no finding.
- "Is check-back +4.1bb accurate?" — recomputed, no finding.

All three probes were recomputation-based (internal), not external-source-based (looking for disagreement in the corpus). A more aggressive active-challenge would:

- Check older coaching content (Sklansky, Miller's pre-solver work, Hold'em Excellence) for positions contradicting modern solver.
- Check tournament-poker sources (Snyder, Roberts) — many tournament lines have different sizing heuristics.
- Check high-stakes content (Galfond, Berkey's Solve For Why, elite-coaching) — elite play can diverge from live low-stakes.

**This is a pattern-level observation:** §13's active-challenge depth correlates with how consensus-oriented the spot is. Deeply-consensus spots (like this node) produce thin challenges; contested spots (flop pilot's "equity vs donk range") produce rich challenges. **No rubric violation** but the effective depth varies by spot.

---

## Section-by-section findings

### §1. Node specification

- **Clean.** Pot derivation + action history + SPR math + prior-street filter all correct. Stake assumption labeled.
- No findings.

### §2. Range construction

- **F-2a — §2.8 barrel-rate reconciliation is hand-wavy** (severity 2, P2)
  - Observation: §2.8 notes hero's barrel-rate 32.5% is below solver's 50-60% and offers two explanations: "(a) hero's first-street cbet was looser than solver's... (b) our per-class barrel frequencies are conservative." Neither is committed to.
  - The v2.1 D10 discipline says "preserve first-pass values without back-solving." But the reconciliation SHOULD state which hypothesis is operative.
  - Fix: commit to hypothesis (b) — our per-class frequencies are conservative — with specific corrections that would raise specific classes. E.g., "KJ/KT/JT/T9/98 medium connectors no pair" at 30% barrel could reasonably be 40%, adding ~4 combos.
  - Severity P2, effort S. Backlog: `US-A3-F2a`.

- **F-2b — Per-class barrel frequencies are computed+assumed without individual source references** (severity 1, P3)
  - Observation: §2.7 table has 11 rows of barrel frequencies (AA/KK at 85%, AQ TPTK at 100%, etc.). All are author's judgment. None cite a specific coaching source or solver output for the specific frequency.
  - Fix: acknowledge as "assumed per live-cash play heuristics + author's pool-observation"; reference POKER_THEORY.md §3 for merged-range-barrel logic.
  - Severity P3, effort S. Backlog: `US-A3-F2b`.

### §3. Equity distribution

- **F-3a — Row 3.8 note about AJ-vs-AQ first-pass error is good self-documentation but not ledger-strict** (severity 1, P3)
  - Observation: row 3.8 includes "Stage 4 D13 check — first-pass had this as ~15%, self-audit caught error; corrected." This is valuable provenance but isn't strictly a falsifier; it's authoring-history.
  - Fix: move the note to a separate "Audit history" section at the bottom of §11, or keep inline but tag as `first-pass-error-corrected-in-self-review`.
  - Severity P3, effort S. Backlog: `US-A3-F3a`.

### §4. Solver baseline

- **F-4a — "Directional inference" carry-over weakness** (severity 2, P2)
  - Observation: claim 3 (solver AQ bet frequency ~95%) and claim 4 (solver sizing mix 65:25:5) are "directional inference" without specific PIO/GTO-Wizard numbers for this exact node. Same F-4a-equivalent from pilots.
  - Fix: either (a) loosen numeric claims to ranges (already done at ±10 pp); (b) commission specific solver run; (c) acknowledge the inference explicitly in §11 with `theoretical` falsifier already in place.
  - Severity P2, effort S. Backlog: `US-A3-F4a`.

### §5. Population baseline

- **F-5a — "Coaching consensus" is 3 individual sources, not a single methodology-source** (severity 2, P2)
  - Observation: see CSO-2. The framing "live-cash coaching consensus" is stronger than "labeled-unsourced" but weaker than a sourced dataset. Sourcing-floor (v2 Delta 3) is met but label over-states rigor.
  - Fix: change label from "population-cited" to "population-consensus-observed" — new sub-type between `population-cited` (dataset) and `population-observed` (unsourced).
  - Proposed rubric v2.3 delta D14: add `population-consensus-observed` source-type for multi-coach-agreement without dataset. Not urgent.
  - Severity P2, effort rubric-minor or artifact-label-change.
  - Backlog: `US-A3-F5a` (artifact-level) or candidate D14 (rubric-level).

### §6. Exploit recommendation

- **Clean.** Archetype-conditional correctly declined. Deltas vs §4 and §5 derived with causal claims. No findings.

### §7. Villain's perspective

- **F-7a — Villain's model of hero accurately matches reality; no asymmetry to exploit at perspective-level** (severity 1, P3)
  - Observation: §7 states "BB's model of hero's range is approximately accurate" — unlike flop pilot (villain over-weights draws) and river pilot (villain correctly identifies capped IP signal). For this node, §7's asymmetry is at the *execution* level (barrel-frequency inflation of hero's barrel range), not the *range-model* level.
  - This isn't a violation, but it means §7's forcing constraint ("villain's apparent-hero-range differs from actual") is technically met only in aggregate (BB expects 50% barrel-freq, hero actually ~32.5% first-pass or higher under reconcile), not in hand-class composition.
  - Fix: acknowledge in §7 that asymmetry is at barrel-frequency level, not hand-class level. Already somewhat done — make more explicit.
  - Severity P3, effort S. Backlog: `US-A3-F7a`.

### §8. EV tree

- **F-8a — Depth-2 adjustments given as summary (+0.34bb, "small positive", "small") without per-runout-class breakdown table** (severity 2, P2)
  - Observation: v2 Delta 5 requires "depth-2 EV requires per-runout-class breakdown table." §8's Bet 50% depth-2 has "80% brick rivers +0.5bb / 20% card-changing -0.3bb → weighted +0.34bb" — close to a table but doesn't enumerate which cards are "brick" vs "card-changing" or exactly how many turn cards in each class.
  - Fix: explicit table with turn-card classification (brick: 2s, 4s, 5s, 6-8 non-pairing → count; card-changing: A/K/J/T/9 → count; pair: Q/7/2/3 → count).
  - Severity P2, effort S-M. Backlog: `US-A3-F8a`.

### §9. Blocker / unblocker

- **Clean.** Card enumeration correct; combo arithmetic traces. No findings.

### §10. MDF / realization

- **F-10a — Realization factors (0.93 range, 0.96 AQ-specific) labeled `assumed` without POKER_THEORY.md §3 quoted baseline** (severity 1, P3)
  - Observation: same F-10a-equivalent as pilots. Realization factors default-adjusted from IP baseline without quoting the source baseline.
  - Fix: inline-quote POKER_THEORY.md §3 realization-factor baselines once.
  - Severity P3, effort S. Backlog: `US-A3-F10a`.

### §11. Claim-falsifier ledger

- **Clean.** 55 rows, all with falsifiers. Completeness log at `[swept 2026-04-23, 55 claims ledgered, all falsifiers present]`. Load-bearing rows 2.7, 5.1, 5.2-5.4 flagged in summary. No findings.

### §12. Sensitivity analysis

- **Clean.** Three assumptions with numeric thresholds. Correctly identified archetype-non-flip. No findings.

### §13. Contrast with leading theories

- **F-13a — Active challenge is recomputation-based, not external-corpus-probing** (severity 1, P3)
  - Observation: see CSO-3. Active challenge attempted three probes, all internal recomputations. No probe into contested literature.
  - Fix: add one attempt to find a source advocating a non-majority action (check-back as primary, or overbet as primary). Even if no such source exists, documenting the search is Stage 4's mitigation path.
  - Severity P3, effort S. Backlog: `US-A3-F13a`.

- **F-13b — D13 reflexive checks passed but documentation could be stronger** (severity 1, P3)
  - Observation: §13 includes "Internal-arithmetic check" and "Source-scope check" subsections with brief pass statements. Compared to river pilot's Stage 4 comparison doc (which found a B by scope check), this artifact's §13 could more explicitly show what the checks looked for and why they passed.
  - Fix: elaborate the check subsections — for internal-arithmetic, show the numeric work; for source-scope, explicitly list what context each source covers.
  - Severity P3, effort S. Backlog: `US-A3-F13b`.

### §14a. Symmetric-node test

- **F-14a-a — Claim 4 ("Hero has ~75% equity vs villain's check range") classified as "changes materially" without specifying what it changes to on river mirror** (severity 1, P3)
  - Observation: §14a notes equity "shifts to what survives double-barrel call" but doesn't give the river-mirror estimate. Per the rubric "partial-change must specify direction and approximate magnitude" — magnitude is missing.
  - Fix: estimate river-mirror equity (~60% against river-check range after double-barrel).
  - Severity P3, effort S. Backlog: `US-A3-F14a-a`.

- Otherwise clean. 6 classifications, under D8 cap. Test passes.

### §14b. Artifact-level falsifier synthesis

- **Clean.** Decision-level-robust handling matches v2 language. Single sizing-flip falsifier with numeric threshold. No findings.

### §14c. Counter-artifact pointer

- **Clean.** Two counter-artifacts named (stake-stratified + per-archetype). Concrete. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-2a — barrel-rate reconciliation hand-wavy | 2 | P2 | S | Artifact |
| 2 | F-4a — solver directional inference (carry-over) | 2 | P2 | S | Artifact |
| 3 | F-5a — coaching-consensus vs dataset framing | 2 | P2 | S or rubric-minor | Artifact or rubric |
| 4 | F-8a — depth-2 breakdown table missing | 2 | P2 | S-M | Artifact |
| 5 | F-2b — per-class barrel frequencies unsourced | 1 | P3 | S | Artifact |
| 6 | F-3a — §3 authoring-history note label | 1 | P3 | S | Artifact |
| 7 | F-7a — asymmetry at frequency not range level | 1 | P3 | S | Artifact |
| 8 | F-10a — realization factors un-quoted (carry) | 1 | P3 | S | Artifact |
| 9 | F-13a — active challenge internal-only | 1 | P3 | S | Artifact |
| 10 | F-13b — D13 check documentation light | 1 | P3 | S | Artifact |
| 11 | F-14a-a — claim-4 magnitude missing | 1 | P3 | S | Artifact |

**Breakdown:** 0 P1, 4 P2, 7 P3. All findings are artifact-level polish. **One rubric-candidate (F-5a → D14) but not urgent.**

---

## Proposed rubric v2.3 delta (OPTIONAL — batch or defer)

### Candidate D14 — §11 add `population-consensus-observed` source-type

**Trigger.** F-5a in this artifact: "coaching consensus" is neither dataset-level-sourced nor auditor-unsourced. The v2 ledger source-type list (`solver / population-cited / population-observed / read / computed / assumed`) has a gap for "multiple-coach-agreement-without-single-dataset."

**Proposed change.** Add `population-consensus-observed` between `population-cited` (dataset with methodology) and `population-observed` (auditor-unsourced). Criteria: ≥3 independent coaching sources agree on the claim direction; numeric value still carries wide CI.

**Cost.** Small (one ledger source-type added). **Benefit.** More honest labeling of multi-coach agreement; allows artifacts to meet sourcing floor with consensus without over-claiming dataset-level rigor.

**Recommendation:** BATCH — not urgent. Apply when next batch of rubric deltas accumulates (e.g., 3-5 findings across US-1 corpus scaling).

---

## Audit sign-off

- **Drafted by:** Claude (main, self-audit)
- **Verdict:** GREEN (light). 11 findings; 0 P1, 4 P2, 7 P3. All artifact-level polish. One rubric-candidate (D14) batched.
- **v2.2 assessment:** handled structurally-distinct node (turn + aggressor + sizing + merged-range) without revision. v2.1 D10, v2.1 D11, v2.2 D13 all exercised successfully. First artifact where §14b "decision-level-robust" case applies — handled cleanly per v2 language.
- **Next step:** Stage 4c (leading-theory comparison) then Stage 5c (drill card) complete the chain for artifact #3.
