# Stage 4h — Leading-Theory Comparison

**Artifact compared:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises.md`
**Rubric version:** v2.3
**Date:** 2026-04-23
**Status:** draft

---

## v2.2 D13 + v2.3 D16 reflexive checks

### Internal-arithmetic

§3 weighted: `(0.5×0.75 + 2.5×0.55 + 16.25×0.20 + 6×0.07) / 25.25 ≈ 21.5%`. ✓
§8 Call EV: `0.215 × 264 − 74.8 = -18.04bb`. ✓

### Source-scope

All sources live-cash-scoped. ✓

---

## Sources surveyed

9 sources in artifact §13 + additional Stage 4h:

| # | Source | Position |
|---|---|---|
| Doug Polk cash | Fold | **A** |
| Ed Miller *Course* | Fold + sunk-cost lesson | **A** |
| Jonathan Little | Fold | **A** |
| Upswing | Fold | **A** |
| GTO Wizard CR-defense | Fold ~80% | **A** |
| Berkey | Fold with archetype-nuance | **A** |
| Tommy Angelo | Fold (anti-tilt) | **A** |
| Will Tipton | Fold (HU CR math) | **A** |
| Brokos | Fold | **A** |
| Sklansky (Stage 4h) | Fold on pot-odds | **A** |
| Janda (Stage 4h) | Fold | **A** |
| Cardquant | Fold | **A** |

**Total 12 sources surveyed. 12A + 0 B/C-wrong + 0 C-incomplete.**

---

## Per-claim comparison

### Claim 1 — "Fold TPTK facing turn check-raise after overbet"

All 12 sources: **A.** Strong consensus.

### Claim 2 — "Hero equity ~22% vs value-heavy CR range"

All equity-related sources: **A.** Consistent with Equilab-style calculations.

### Claim 3 — "Required equity 29% > hero equity 22%"

All pot-odds-math sources: **A.** Basic arithmetic.

### Claim 4 — "Live pool CR is 95:5 value:bluff"

Per consensus: **A** across live-cash-focused sources. v2.3 D14 sourcing-floor met.

---

## Active challenge (v2.3 D16)

**Zero B/C found.** D16 documentation:

### (a) Sources probed for disagreement: 12

### (b) Angles attempted

1. **Pre-solver classics:** Sklansky/Malmuth agree (fold).
2. **Sunk-cost-calling advocates:** no reputable source. Sunk-cost is a known leak, not a teaching.
3. **Maniac-exploit contrarians:** addressed via D11 archetype-override; not a B.
4. **Tournament-ICM:** some ICM math might change it, but our target is cash.
5. **Elite high-stakes:** Galfond, Berkey fold.

### (c) Closest-to-disagreeing: none.

**Consensus-robust.** Third consensus-robust artifact in corpus (after #3, #5, #7).

---

## POKER_THEORY.md §9 impact

**No new D entries.** Live-pool CR-value-heavy is consistent with existing §9.1/§9.2 themes (live pool over-values aggression).

---

## `lsw-impact` subsection

### Flag 1 — Effective stack authored conflict (from artifact §1 F-finding)

**Significant LSW-impact flag.** Line 1's authored `effStack: 90` is incompatible with node's turn action (requires ≥130bb). LSW-F1-A7 addressed pot accounting but didn't catch stack-depth. **Recommendation: LSW re-audit line 1 for stack-depth consistency.** Affects this node + potentially `river_brick_v_calls`, `river_checkback` on same line if they presume deeper stacks.

### Flag 2 — None other

---

## Summary

**Stage 4h verdict:** consensus-robust (12A + 0 B/C). D14/D16 validated. **One LSW-impact flag raised** on line 1 effective-stack inconsistency.

**Cumulative corpus Stage-4 pattern:** 4 consensus-robust artifacts (#3, #5, #7, #8) + 4 with B-findings (#1 arithmetic, #2 source-scope, #4 blocker-discovery, #6 MW C-incomplete). **Consensus-robust is now slightly more common than challenge-productive** as corpus scales.
