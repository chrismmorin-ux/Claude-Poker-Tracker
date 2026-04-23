# Self-Audit — `co-vs-btn-bb-srp-mw-oop-flop_root`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/co-vs-btn-bb-srp-mw-oop-flop_root.md`
**Rubric version:** v2.2 (artifact v2.2-native, with multi-way extensions)
**Auditor:** Claude (main)
**Date:** 2026-04-23
**Status:** Stage 3f — verdict GREEN-light with one new rubric candidate (D17 MW-extensions)

---

## Executive summary

**Verdict: GREEN (light).** First multi-way artifact. v2.2 rubric was designed for HU; artifact authored pragmatic MW extensions to §2, §7, §8, §10 without rubric revision. **10 findings: 0 P1, 3 P2, 7 P3.** All artifact-level polish + one new rubric candidate (**D17 — formalize multi-way extensions**).

**Corpus-level implication.** Multi-way stretched the rubric in structurally-demanding ways. §2 tripled in length (three ranges). §7 required two villain sub-sections + joint-fold-equity synthesis. §8 combinatoric-branched to 4 grouped scenarios from 9 raw combinations. §10 introduced joint-MDF concept. **Rubric survived without fundamental revision**, but codification (D17) is warranted.

**Key novel findings.**
1. **MW consensus in literature is looser than HU.** Fewer sources cover specific MW spots directly. C-incomplete rate is higher in MW artifacts than HU — "pedagogical simplification vs solver-nuance" is more common when literature coverage is thin.
2. **Joint-fold-equity as a decision metric** (§10 joint MDF) generalizes better than per-villain MDF for MW exploit analysis.
3. **Artifact's §6 authored choice (cbet 50%) differs slightly from solver's mixed 33:50.** Pedagogical simplification vs solver-exact. Flagged as C-incomplete in §13.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Pot derivation gap (2bb discrepancy with authored 10bb)** (severity 2, P2)
  - Authored pot is 10bb; derivation gives 7.5-10.5bb range. Carry-over from artifact #5 (4BP pot derivation gap).
  - Fix: acknowledge as authoring convention or correct lines.js.
  - Severity P2, effort S. Backlog: `US-A6-F1a`.

### §2. Range construction (tripled)

- **F-2a — Three-range authoring 3× the prose of HU artifacts** (severity 1, P3)
  - Observation: §2 is longer than any prior artifact due to CO + BTN + BB ranges each needing enumeration. Prose-dense.
  - Fix: none for this artifact; candidate D17 formalizes multi-way format (combined-range-table + per-player appendix) for future MW artifacts.
  - Severity P3, effort rubric-minor.

- **F-2b — Combined villain range enumeration is pragmatic estimate, not strictly first-pass-per-class D10** (severity 2, P2)
  - Observation: §2 "Combined villain range ~635 combos pre-blocker" is a sum of BTN flat (170) + BB flat (465) = 635. But these two ranges overlap on some hand-classes (e.g., both contain JJ). The sum ignores the card-removal-between-villains — villain A having JJ removes those combos from villain B's possible range.
  - At 3-way, card-removal-between-villains is a second-order effect; for precision, each combo in one range precludes the same combo in the other range. The precise combined range is <635 combos.
  - Fix: adopt inclusion-exclusion accounting: combined range ≈ 635 − (cards removed by mutual exclusivity) ≈ 600-620 combos. Minor effect on aggregate equity (1-2pp).
  - Severity P2, effort S-M. Backlog: `US-A6-F2b`.

### §3. Equity distribution

- **F-3a — Bucket-counts are estimates, not combo-enumerated** (severity 1, P3)
  - Observation: §3 table shows "Qx TP mid/weak kicker: ~28 combos" etc. These are round-number estimates, not exact combo-counts.
  - Fix: tighten to exact combo-counts from §2 with full hand-class enumeration. Effort M.
  - Severity P3, effort S-M. Backlog: `US-A6-F3a`.

### §4. Solver baseline

- **F-4a — Solver claims for MW are inferential (carry-over weakness)** (severity 1, P3)
  - MW solver content is less widely published than HU. Claims are "directional inference from MW articles + PIO extrapolation" — weaker than HU solver claims.
  - Fix: tighten to ranges; acknowledge inference limit.
  - Severity P3. Backlog: `US-A6-F4a`.

### §5. Population baseline

- **F-5a — Consensus-source framing (D14 candidate, carry-over)** (severity 2, P2)
  - Doug Polk MW + Upswing + Berkey as consensus. Same D14 pattern.
  - Fix: pending D14 adoption.
  - Severity P2. Batch with D14.

### §6. Exploit recommendation

- **F-6a — Cbet-50% is authored-teaching simplification vs solver's 33:50 mix** (severity 1, P3)
  - Per §13: artifact chose 50% for pedagogical clarity; solver prefers 33% at ~55% frequency. Our 100% at 50% is slightly off-solver.
  - Fix: this is a deliberate authoring choice; keep as-is but acknowledge explicitly.
  - Severity P3. Not a fix; already acknowledged in §6 + §13.

### §7. Villain's perspective — two villains

- **F-7a — Two villain sub-sections is new format not in rubric** (severity 2, P2; rubric-candidate D17)
  - Observation: §7 has BB's perspective + BTN's perspective + joint-fold-equity synthesis. v2.2 rubric §7 is single-villain-oriented.
  - Fix: D17 candidate formalizes multi-villain §7 structure.
  - Severity P2, effort rubric-minor.

### §8. EV tree — 9 branches → 4 scenarios

- **F-8a — 4-scenario grouping is pragmatic; not explicitly sanctioned by v2 §8** (severity 2, P2; rubric-candidate D17)
  - Observation: §8 collapsed 9-raw-combination branching to 4 probability-grouped scenarios. v2 §8 anticipates single-villain branching.
  - Fix: D17 formalizes MW §8 branch-grouping approach.
  - Severity P2, effort rubric-minor.

### §9. Blocker accounting

- **F-9a — Blocker effects across 2 villains is analyzed at aggregate level only** (severity 1, P3)
  - Observation: §9 treats hero's blockers against "combined villain range" rather than per-villain. More rigorous would be: hero blocks X in BB's range + Y in BTN's range separately, then aggregate.
  - Fix: per-villain blocker table.
  - Severity P3, effort S. Backlog: `US-A6-F9a`.

### §10. Joint MDF

- **F-10a — Joint MDF is novel rubric-relevant concept** (severity 0, positive)
  - Observation: §10 introduced joint MDF as the decision-relevant metric for MW. Per-villain MDF + joint-MDF framing is a genuine theoretical insight.
  - Fix: none for artifact. Worth surfacing in POKER_THEORY.md §5-equivalent for MW MDF theory.

### §11. Ledger

- **Clean.** 46 rows, falsifiers present. No findings.

### §12. Sensitivity

- **Clean.** Three assumptions, numeric thresholds. No findings.

### §13. Contrast

- **F-13a — MW literature looser consensus → more C-incomplete** (severity 0, corpus-observation)
  - Observation: MW contrast found more C-incomplete than HU artifacts. The C-incomplete (solver-sizing-preference-33%-vs-authored-50%) is real. Meta-observation: MW spots may systematically produce more C-incomplete findings.
  - Fix: no action. Worth tracking as corpus pattern.

### §14a. Mirror

- **F-14a-a — Mirror to turn_after_cbet captures MW-to-HU transition** (severity 1, P3)
  - Observation: mirror node tests the transition back to HU dynamics. "Changes materially" classification for 3 claims is high; could stretch D8 cap if analysis were more granular.
  - Fix: confirm under cap; consider per-claim magnitude where "partial" could be "changes" with direction/size.
  - Severity P3. Backlog: `US-A6-F14a-a`.

### §14b. Falsifier synthesis

- **Clean.** Single sizing-sensitivity falsifier; action-robust. No findings.

### §14c. Counter-artifact

- **Clean.** Archetype-stratified MW counter named. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-1a — pot derivation gap (carry) | 2 | P2 | S | Artifact |
| 2 | F-2b — inclusion-exclusion on combined range | 2 | P2 | S-M | Artifact |
| 3 | F-5a — consensus sourcing (D14 batch) | 2 | P2 | rubric | Rubric |
| 4 | F-7a — two-villain §7 format not in rubric (D17) | 2 | P2 | rubric | Rubric |
| 5 | F-8a — 4-scenario §8 branch-grouping not in rubric (D17) | 2 | P2 | rubric | Rubric |
| 6 | F-2a — three-range authoring prose-dense (D17) | 1 | P3 | rubric | Rubric |
| 7 | F-3a — bucket-counts estimated | 1 | P3 | S-M | Artifact |
| 8 | F-4a — solver-inferential (carry) | 1 | P3 | S | Artifact |
| 9 | F-6a — cbet-50% vs solver-33% acknowledged | 1 | P3 | - | Artifact (no fix) |
| 10 | F-9a — per-villain blocker table | 1 | P3 | S | Artifact |
| 11 | F-14a-a — mirror "changes" granularity | 1 | P3 | S | Artifact |

**Breakdown:** 0 P1, 5 P2, 6 P3. **One new rubric candidate (D17) triggered by multi-way.**

---

## Proposed rubric v2.3 delta candidate — D17

### D17 — Formalize multi-way extensions to §2, §7, §8, §10

**Trigger.** Artifact #6 is first multi-way artifact. v2.2 rubric §2 / §7 / §8 / §10 were designed for HU; artifact authored pragmatic extensions. D17 formalizes these.

**Proposed changes:**

- **§2 (multi-way):** "For multi-way artifacts (>2 players postflop), §2 includes per-villain preflop range, per-villain flop filter, plus a **combined villain range table** with inclusion-exclusion accounting for card-removal-between-villains."
- **§7 (multi-way):** "For multi-way artifacts, §7 includes **one sub-section per villain** + a **joint-villain synthesis** (joint fold equity, correlated vs independent folding dynamics, order-of-action dependencies)."
- **§8 (multi-way):** "For multi-way artifacts, §8 EV tree may use **scenario-grouping** (e.g., 'both fold / one folds / all call') rather than raw per-villain-action branching. Grouped probabilities must sum to 1.0; groupings must be exhaustive."
- **§10 (multi-way):** "For multi-way artifacts, §10 reports **per-villain MDF** AND **joint MDF** (aggregate fold rate needed for cbet auto-profitability). Joint MDF is the decision-relevant metric; per-villain MDFs are informational."

**Cost.** Modest (rubric §2/§7/§8/§10 language expansion). **Benefit.** MW artifacts get formal structure; rubric generalizes cleanly from HU to MW.

**Batch trigger.** Now 4 rubric candidates (D14, D15, D16, D17). **Batch-apply v2.3 recommended soon** — any further finding would push to 5.

---

## Audit sign-off

- **Verdict:** GREEN (light). 11 findings; 0 P1, 5 P2, 6 P3.
- **v2.2 assessment:** MW stress-test survived without fundamental rubric break. Four rubric-extensions authored ad-hoc; D17 codifies.
- **Batch status:** D14 + D15 + D16 + D17 = 4 candidates. Recommend v2.3 batch-apply before artifact #7.
