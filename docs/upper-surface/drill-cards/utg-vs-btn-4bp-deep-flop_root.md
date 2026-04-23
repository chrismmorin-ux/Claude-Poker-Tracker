---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/utg-vs-btn-4bp-deep-flop_root.md
Source-Rubric: v2.2 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/utg-vs-btn-4bp-deep-flop_root-external.md
Audit: docs/upper-surface/audits/utg-vs-btn-4bp-deep-flop_root-audit.md
Authored: 2026-04-23
Word-count: ~230 (target ≤250)
---

# Drill Card — `utg-vs-btn-4bp-deep-flop_root`

## Front (predict before flipping)

**Spot.** UTG (**OOP**) vs BTN (IP), **4-bet pot**, 100bb → 72bb at flop. Preflop: UTG open 3 → BTN 3bet 12 → UTG 4bet 28 → BTN call. Flop **A♠K♦2♠**. BTN **checks**. Hero **A♦K♣** (top two pair). Pot 55bb. **SPR 1.31 (MICRO zone — stack-committed).**

**Question.** Action with hero's hand?

---

## Back

### Action

**Jam (~72bb all-in).** Single recommendation; action-robust per §12 Assumption C (no archetype flip); sizing-sensitive to villain call-rate (see §14b).

### Why (3 beats)

1. **Hero has ~56% equity range-wide and ~40-45% vs continuing range** [§3, row 3.7]. At SPR 1.3, any bet effectively commits — jam simplifies by forcing the commitment decision immediately. [§8, §10 low-SPR commitment-collapse.]
2. **Blockers are highly favorable** [§9]. Hero's A♦K♣ blocks 3 of 6 AA, 3 of 6 KK, and ~6-7 of 16 AK combos — **13 value combos removed** while only ~1 bluff combo blocked. **Post-blocker fold equity rises from 33% to 44%** — +11pp shift. Most blocker-favorable artifact in corpus.
3. **Jam EV ~+34bb (post-blocker) vs bet-50% ~+17bb (solver-reg) vs check-back ~+7bb** [§8]. Delta over bet-50% (+6bb at solver level); widens further vs check-back.

### Pivot (sensitivity)

**§12 Assumption A (sizing-sensitivity).** If villain is confirmed loose-call-station (QQ/JJ call flop-27 at ≥60% rate), bet-50% EV rises to ~+30bb, matching or beating jam. **Sizing could override from jam to bet-50%; action (value-bet) stays.**

### Falsification

**§14b single sizing-sensitivity falsifier.** Villain ≥100-hand history of calling flop-small-bets with QQ-JJ at ≥50% rate in 4BPs → consider bet-50% override.

**No action-level falsifiers.** Jam is robust across all credible §11 intervals; this is among corpus's most decision-robust spots.

### Where to dig deeper

§3 (56% equity vs range) · §6 (single-action consensus) · §8 (EV: jam +34, bet-50% +17, check-back +7) · §9 (+11pp blocker shift) · §10 (low-SPR commitment-collapses realization) · §14b (sizing-sensitivity single falsifier)

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "SPR 1.31 MICRO" | §1, §11 row 1.3 |
| "~56% equity range-wide" | §3, §11 row 3.7 |
| "~40-45% vs continuing range" | §11 row 3.8 |
| "Blockers: 13 value removed / 1 bluff" | §9, §11 rows 9.4, 9.5 |
| "Post-blocker fold equity 44%" | §11 row 9.6 |
| "Jam EV +34bb (post-blocker)" | §11 row 8.5 |
| "Bet-50% EV +17bb (solver-reg)" | §11 row 8.6 |
| "Check-back EV ~+7bb" | §11 row 8.8 |
| "Delta jam over bet-50% ~+6bb" | §11 row 8.9 |
| "Sizing-sensitivity falsifier" | §14b headline falsifier 1 |

All claims grep-traceable to source artifact section anchors.
