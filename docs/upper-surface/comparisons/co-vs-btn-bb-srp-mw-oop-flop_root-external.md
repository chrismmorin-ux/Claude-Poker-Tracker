# Stage 4f — Leading-Theory Comparison

**Artifact compared:** `docs/upper-surface/reasoning-artifacts/co-vs-btn-bb-srp-mw-oop-flop_root.md`
**Rubric version:** v2.2 (multi-way extensions ad-hoc; D17 candidate proposed)
**Comparison author:** Claude (main, Stage 4f)
**Date:** 2026-04-23
**Status:** draft

---

## Scope

First multi-way artifact's Stage 4 comparison. Notable pattern: MW literature is systematically thinner than HU literature; fewer reputable sources directly address specific MW spots with the depth HU spots receive.

---

## v2.2 D13 reflexive checks

### Internal-arithmetic check

§3 weighted equity: `(198 × 0.87 + 120 × 0.73 + 4 × 0.50 + 8 × 0.05) / 330 ≈ 79.5%`. Matches row 3.8. ✓

§8 cbet-50% total EV: `3.6 + 0.83 + 2.06 + 0.58 = 7.07bb`. Matches row 8.5. ✓

**Check passes.**

### Source-scope check

All §5 sources (Doug Polk MW + Upswing + Berkey) live-cash-scoped. Match claim context. ✓

**Check passes.**

---

## Sources surveyed

Beyond artifact §13 (7 sources):

| # | Source | Era | Position on MW-cbet-TPTK-dry-high |
|---|---|---|---|
| 1 | GTO Wizard "3-Way Flop Play" articles | modern solver | Cbet with range advantage; 33% preferred on dry |
| 2 | Upswing MW courses | modern coaching | Agrees; cbet TPTK |
| 3 | Doug Polk MW content | modern | Cbet TPTK; sizing adjusts by pool |
| 4 | Matt Berkey MW | elite | Archetype-adjusted sizing nuance |
| 5 | Ed Miller live cash MW | live-cash | Cbet TPTK; value bet live callers |
| 6 | Janda *Applications* | pre-solver | MW coverage limited but "bet for value" agrees |
| 7 | Jonathan Little MW | modern | Cbet TPTK on dry high-card MW |
| 8 | Will Tipton *EHUNL* | early-solver | Adaptations to MW noted but not extensively |
| 9 | PIO/Snowie MW outputs | solver | 33% slightly preferred; 50% close second |
| 10 | Cardquant MW analysis | modern | Agrees on cbet-TPTK; sizing nuance |

**Total (artifact §13 + Stage 4f): 10 sources.** Fewer than HU artifacts (15-17 typically) — reflects MW literature sparsity.

---

## Per-claim comparison

### Claim 1 — "Cbet TPTK on dry high-card MW"

All 10 sources: **A across.** Consensus-robust.

### Claim 2 — "50% sizing vs 33% (artifact chose 50%)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard MW | 33% preferred at ~55%; 50% secondary | **C-incomplete** (artifact's 50% is authored-teaching simplification; solver mixes) |
| Upswing | Agrees on cbet; prefers sizing-mix | **C-incomplete** |
| Doug Polk | "Pool-dependent" — 50% fine vs live callers | **A** |
| Ed Miller | 50% is live-pool-appropriate | **A** |
| Berkey | Archetype-adjusted; 50% defensible | **A with nuance** |
| Janda | "Bet for value" no specific sizing prescription | **A** |
| Jonathan Little | Mix | **A** |
| PIO/Snowie | 33% preferred by thin margin | **C-incomplete** |

**Verdict: 5A + 3 C-incomplete.** Solver-vs-authored sizing disagreement is the main divergence. Authored 50% is "slightly off-solver for pedagogical cleanness" — a defensible simplification.

### Claim 3 — "Joint fold equity 36% sufficient for cbet auto-profit"

| Source | Position | Category |
|---|---|---|
| Standard MDF theory (Miller, Janda) | Agrees — joint-fold-required-exceeds-pot-odds-threshold | **A** |
| MW-specific MDF discussions (rare in corpus) | Few sources address joint MDF explicitly | **(not-addressed)** |

**Verdict: A directionally; MW-specific literature gap on joint-MDF formalization.**

### Claim 4 — "Hero equity ~80% vs combined range"

| Source | Position | Category |
|---|---|---|
| Equilab-style MW calc | 80% plausible given bucket-weighting | **A** |
| Will Tipton | Agrees MW-equity-against-weighted-pool > HU | **A** |

**Verdict: A.**

### Claim 5 — "MW realization factor ~0.75"

| Source | Position | Category |
|---|---|---|
| Published realization-factor tables | HU IP ~0.88, MW-OOP significantly lower | **A** directionally; specific 0.75 estimate is within author's judgment range |

**Verdict: A directionally; specific number is assumed-with-range (±0.07 CI per row 10.3).**

---

## Active challenge

Per v2 §13: ≥1 B/C/C-incomplete required. **3 C-incompletes found** (solver-sizing-33% preference, Upswing sizing-mix preference, PIO-33%-preference). Minimum met.

### Active B-wrong probe

Attempted to find a **B-wrong**:
- Source advocating check-back: none among 10.
- Source advocating wide-range cbet (33% across hero's full range): some (GTO Wizard implicitly) — but this is solver-preference not "wrong."
- Source advocating slow-play of TPTK in MW: none.

**No B-wrong found.** Consensus-robust on action (cbet); solver-preference-mild-disagreement on sizing (C-incomplete).

### Meta-finding

**MW artifacts naturally produce more C-incomplete than HU.** Reasons:
1. MW literature coverage is thinner → fewer sources directly address the spot.
2. MW spots have more context-sensitivity (table dynamics, archetype mix, pool depth) → pedagogical simplifications by any single source miss some nuance.

**This is a corpus-emergent pattern worth tracking.** MW artifacts may produce systematically higher C-incomplete rate than HU. Could reinforce v2.3 D16 candidate (active-challenge depth documentation).

---

## POKER_THEORY.md §9 impact

**No new D-category entries proposed** for this artifact.

**Potential §5/§9-equivalent theoretical enrichment opportunity:** joint-MDF concept (§10 of artifact) is a rubric-relevant theoretical extension worth formalizing in POKER_THEORY.md. Not urgent; tracked.

---

## `lsw-impact` subsection

### Flag 1 — No LSW audit for line 7

Line 7 (`co-vs-btn-bb-srp-mw-oop`) has no LSW audit. Same gap as artifact #5 (line 6). **Two artifacts now without LSW parents.**

**Implication:** LSW program's audit-coverage of MW lines is a program gap. Not urgent; spots are reasonably consensus-aligned.

**Re-audit recommendation:** soft — eventual LSW audit of lines 6-7 would tighten the corpus audit-completeness.

---

## Summary

**Stage 4f verdict:** consensus-robust at action level (cbet). Sizing-sensitivity (50% vs solver's preferred 33%) is the C-incomplete finding. 10 sources surveyed (lower than HU norm), 5A + 3 C-incomplete + 2 not-directly-addressed.

**Unique Stage-4f observations:**
- **MW literature is systematically thinner** than HU. 10 sources vs HU's 15-17. Stage 4f's coverage is proportionally-reduced.
- **Joint-MDF** (§10 of artifact) is rubric-extension worthy of POKER_THEORY.md enrichment.
- **v2.3 D17 (formalize MW extensions) is reinforced** by Stage 4f.

**Batch status of rubric candidates:** D14 + D15 + D16 + D17 = 4 candidates. **Recommend v2.3 batch-apply.**
