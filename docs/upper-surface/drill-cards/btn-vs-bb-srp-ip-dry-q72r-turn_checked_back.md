---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-turn_checked_back.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-srp-ip-dry-q72r-turn_checked_back-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-srp-ip-dry-q72r-turn_checked_back-audit.md
LSW-Audit: docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md (LSW-A2 closed)
Related-Downstream: docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md (#4)
Authored: 2026-04-23
Word-count: ~248 (target ≤250)
---

# Drill Card — `btn-vs-bb-srp-ip-dry-q72r-turn_checked_back`

## Front (predict before flipping)

**Spot.** **HU SRP, hero BTN IP.** 100bb eff. BTN 3 → BB call → flop Q♠7♥2♣ (hero CHECKS BACK) → turn **3♦**, BB **leads 60% pot (3.3 into 5.5)**. Pot-to-call: 8.8bb. Hero **9♥9♦** (mid-pair — representative checked-back mid-pair).

**Question.** Action?

---

## Back

### Action

**Call.** Single recommendation; robust across all archetypes; **cleanest never-fold in corpus**.

### Why (3 beats)

1. **Pot-odds 27.3%** [§10.2: `3.3/12.1`]. Hero equity ~60% vs BB's probe range [§3 row 3.9]. **Equity:odds ratio 2.2x** — massive margin for a call.
2. **MDF 62.5% defense required** [§10.1: `5.5/8.8`]. Hero's checked-back range (~350 combos) must defend 62.5% = ~220 combos; any pair + strong-Ax + some Qx clears MDF. **Overfold leak is THE canonical live-probe-defense error** [§5.2 Doug Polk content direct-corroboration].
3. **BB probe range polar-ish** [§2 row 2.5-2.9]: ~70 combos = 43% value (sets + Qx TP + strong pairs) + 29% marginal (pair-protection probes) + 29% bluff/air (missed broadway + blocker bluffs). Hero 99 dominates the 50% of range that's air/bluff/marginal.

### Pivot (sensitivity)

**§12 all assumptions robust.** Even if BB's value-fraction jumps to 70%, hero equity drops only to ~35% — still above pot-odds 27.3%. No flip within any CI. Archetype-robust (fish/reg/pro/nit all call).

### Falsification

**§14b: Decision-level-robust.** No headline falsifier; call is clean. **Tenth consensus-robust corpus artifact** (Doug Polk, Miller, Little all strong-direct corroborate the anti-overfold doctrine).

### Where to dig deeper

§7 (BB probe rationale: value + bluff + protection) · §10 (**MDF-as-primary-driver** — first artifact to lead with MDF) · §5.2 (**pool overfold leak: 35-50% fold rate vs probe**, live-cash documented) · §3 (bimodal distribution: 34 dominant + 25 dominated) · §14a (mirror-node test: 4 stay + 1 partial + 1 invert)

### Corpus note

**FIRST TURN-DEFENDER-FACING-PROBE** artifact. Direct upstream of **#4 river_after_turn_checkback** (same hero 99 hand, same line): checked-flop → call-probe-turn → bluff-catch-river. **Three-node teaching arc.** Also parallel-path-contrast with **#12** (Q72r barrel-turn-thin-value-river — same line, different flop decision).

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Call correct" | §6 + lines.js turn_checked_back.decision |
| "Hero ~60% equity" | §3 row 3.9 |
| "Pot-odds 27.3%" | §10.2 |
| "MDF 62.5%" | §10.1 |
| "Equity:odds 2.2x" | §10.6 |
| "BB probe 43/29/29 composition" | §2 rows 2.7-2.9 |
| "Pool overfold 35-50%" | §5 row 5.2 |
| "Pool 99 fold-rate 25-40%" | §5 row 5.5 |
| "Doug Polk corroboration" | §5 source + §13 |
| "10A consensus" | §13 |
| "D15 N/A" | §11 row 10.7 |
| "D14 applied" | §2 + §5 |
| "Three-node teaching arc" | Closing notes + #4 reference |

All claims grep-traceable.
