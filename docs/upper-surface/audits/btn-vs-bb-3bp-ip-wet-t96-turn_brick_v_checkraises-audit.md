# Self-Audit — `btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises.md`
**Rubric version:** v2.3 (artifact v2.3-native)
**Auditor:** Claude (main)
**Date:** 2026-04-23
**Status:** Stage 3h complete — verdict GREEN (light) with one substantive §1 F-finding

---

## Executive summary

**Verdict: GREEN (light).** v2.3 rubric exercised cleanly. **8 findings: 0 P1, 3 P2, 5 P3.** All artifact-level or carry-overs.

**Headline finding: §1 effective-stack inconsistency.** Line 1's authored `effStack: 90` is incompatible with this node's turn-action geometry (which requires ≥130bb effective for the 112bb check-raise to be feasible). LSW-F1 addressed pot-accounting at this node but didn't resolve the stack-depth conflict. Flagged as an authored-content issue for LSW re-audit consideration. **Second corpus instance of authored-content conflict detected by upper-surface analysis** (first was flop pilot §3 equity arithmetic per Stage 4 B-finding).

**v2.3 rubric validation.** D14 (consensus-observed source-type), D15 (range-vs-hand divergence), D16 (zero-B/C search-depth documentation) all applied correctly in authoring. D11 archetype-conditional fold-default + call-override matches artifact #4's AA-fold structure — **first corpus instance of D11-structural-reuse across two fold-correct artifacts.**

---

## Cross-section observations

### CSO-1 — §1 F-finding on stack depth = authored-content conflict

Line 1 authored `effStack: 90`. This node's authored turn-action (BB check-raise to 112bb total, hero call cost 74.8bb) requires ≥130bb effective at preflop. Stacks implied by the turn-action geometry exceed the line's declared 90bb.

**Three interpretations:**
1. **Line's effStack is under-stated** — real spot assumes ~130bb+. LSW should update effStack.
2. **Turn action is exaggerated for pedagogy** — real 90bb spot wouldn't reach this pot; authored for teaching only. LSW should clarify.
3. **Turn pot is over-stated** — the 184bb authored pot may be too high for 90bb effective. LSW-F1-A7 pot-accounting fix may not have caught this.

Per artifact §1: adopted interpretation #1 for analysis (assume 135bb preflop); flagged as F-finding for LSW re-audit.

**Rubric implication:** upper-surface artifact analysis surfaced an authored-content conflict that LSW audit hadn't detected. Pattern continues: **upper-surface rubric catches deeper authored-content issues than LSW 7-dimension walkthrough.**

### CSO-2 — D11 structural-reuse validated

Artifact #4 (AA-scare-river-fold) and Artifact #8 (TPTK-faces-CR-fold) both use v2.1 D11 fold-default + call-override. Both have SAME structural form:
- Default: fold (pot odds + equity analysis supports).
- Override: call if specific villain archetype is confirmed (maniac in #8; pro in #4).

**D11 is structurally reusable across fold-correct spots with specific archetype-flip conditions.** Not a rubric revision; a validation of D11's design.

### CSO-3 — D15 applied explicitly in §9 + §10

Hero's JT has "top-of-range" preflop strength but ~22% equity vs CR range (below 29% pot-odds threshold). Range-level MDF (71%) diverges from individual-hand correctness (fold). **D15 surfaces this explicitly** — prevents "I have TP, I must call" fallacy.

**First corpus artifact where D15 is load-bearing at the recommendation-level** (not just a footnote).

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Effective stack inconsistency (substantive)** (severity 2, P2; LSW-flag candidate)
  - Observation: authored 90bb conflicts with 112bb turn action. Artifact adopts 135bb as implied; flagged for LSW re-audit consideration.
  - Fix: (a) LSW should correct effStack or clarify stack depth on line 1; (b) upper-surface artifact could also recompute under authored 90bb for rigorous alternative analysis.
  - Severity P2, effort S (artifact) or M (LSW coordination). Backlog: `US-A8-F1a` + flag for LSW.

### §2. Range construction

- **F-2a — Cross-reference to artifact #1 for BTN range rather than full re-derivation** (severity 1, P3)
  - §2 references "per artifact #1 §2" for BTN preflop + flop-call range. Efficient but creates coupling; if artifact #1 is ever revised, artifact #8 ranges could go stale.
  - Fix: either freeze the cross-reference with a fingerprint ("per artifact #1 §2 v2-partial-refit"), or duplicate the enumeration (current: just "per artifact #1").
  - Severity P3, effort S. Backlog: `US-A8-F2a`.

- **F-2b — BB CR range first-pass naturally arrives at authored 94:6 without back-solving** (severity 0, positive)
  - §2 first-pass D10 discipline confirmed no back-solving: per-class frequencies yielded value-heavy composition matching authored teaching. Good.

### §3. Equity distribution

- **F-3a — Per-class equity values cited with outs-math rather than Equilab citations** (severity 1, P3, carry-over pattern)
  - Same pattern as prior artifacts.
  - Fix: tighten with specific Equilab output or citation.
  - Severity P3. Backlog: `US-A8-F3a`.

### §4. Solver baseline

- **F-4a — "Directional inference" carry-over** (severity 1, P3)
  - §4 claims inferred from GTO Wizard/Snowie corpora rather than specific-node PIO outputs.
  - Fix: ranges, accept inference scope.
  - Severity P3.

### §5. Population baseline

- **F-5a — `population-consensus-observed` (v2.3 D14) applied correctly** (severity 0, positive)
  - Row 5.1 correctly labeled. D14 validated in this artifact.

### §6. Exploit recommendation

- **Clean.** Archetype-conditional fold-default + call-override per v2.1 D11. Matches structural pattern from artifact #4. No findings.

### §7. Villain's perspective

- **F-7a — BB's EV comparison (check vs CR) not quantified in row-form** (severity 1, P3)
  - §7 describes BB's decision logic but rows 7.1/7.2 aren't explicitly in §11. v2 Delta 4 requires traceability.
  - Fix: add ledger rows for BB check-EV and CR-EV.
  - Severity P3, effort S. Backlog: `US-A8-F7a`.

### §8. EV tree

- **F-8a — Jam branch EV analysis is tight but could benefit from fold-equity split** (severity 1, P3)
  - §8 jam: "fold equity ~5%, call ~95%, weighted -23.55bb." Could show per-scenario rows.
  - Fix: expand minor.
  - Severity P3.

### §9. Blocker / unblocker + D15 application

- **F-9a — D15 range-vs-hand divergence flagged explicitly** (severity 0, positive)
  - §9/§10 surfaces the divergence: hero's JT is "top of overbet range" but fails MDF-by-equity. First load-bearing D15 application in corpus.
  - Fix: none. Positive validation.

### §10. MDF

- **F-10a — D15 divergence articulated** (severity 0, positive)
  - MDF 71% vs range-continuing-frequency 35-40% → range under-defends. But hero's specific hand is individual-hand-fold-correct. D15 clarifies.

### §11. Ledger

- **F-11a — Only 38 rows; below corpus average** (severity 1, P3)
  - Lower than prior artifacts (typical 44-68). Attributable to narrow range (27 combos of villain) + repeat-line (cross-reference to artifact #1).
  - Fix: consider enriching with rows for §7 villain-EV traceability (F-7a) to reach corpus-typical density.
  - Severity P3.

### §12-§14

- **Clean.** D11 archetype-flip, v2 falsifier-synthesis, mirror-test all applied correctly. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-1a — stack depth inconsistency | 2 | P2 | S (artifact) / M (LSW) | Artifact + LSW flag |
| 2 | F-2a — cross-reference fragility | 1 | P3 | S | Artifact |
| 3 | F-3a — equity citation carry | 1 | P3 | S | Artifact |
| 4 | F-4a — solver inferential carry | 1 | P3 | S | Artifact |
| 5 | F-7a — BB EV traceability | 1 | P3 | S | Artifact |
| 6 | F-8a — jam EV split | 1 | P3 | S | Artifact |
| 7 | F-11a — ledger density below average | 1 | P3 | S (enrich) | Artifact |
| 8 | LSW cross-flag | — | — | — | LSW coordination |

**Breakdown:** 0 P1, 1 P2, 6 P3, 1 LSW flag.

---

## Rubric-candidate tally

**v2.3 has absorbed all pending candidates.** No new candidates from artifact #8. D18 (order-of-action) still light at 1 data point.

---

## Audit sign-off

- **Verdict:** GREEN (light).
- **Headline:** §1 stack-depth conflict is a real authored-content issue; cross-reference pattern with artifact #1 works but creates coupling.
- **Rubric observations:** D11 structural-reuse validated (second fold-default artifact). D15 load-bearing (first corpus instance). D14, D16 applied correctly.
- **Next step:** Stage 4h + Stage 5h complete chain.
