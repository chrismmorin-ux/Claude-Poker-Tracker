---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-turn_after_call.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-3bp-ip-wet-t96-turn_after_call-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-3bp-ip-wet-t96-turn_after_call-audit.md
LSW-Audit: docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md (LSW-A1 closed)
Authored: 2026-04-23
Word-count: ~250 (target ≤250)
---

# Drill Card — `btn-vs-bb-3bp-ip-wet-t96-turn_after_call`

## Front (predict before flipping)

**Spot.** **HU 3BP, hero BTN IP.** 90bb → 83bb. BTN open → BB 3bet 10 → BTN call → flop T♥9♥6♠ (BB DONKS 33%, BTN CALLS) → turn **2♣** brick, **BB checks**. Pot 34bb. Hero **J♥T♠** (TP J-kicker + BDFD).

**Question.** Action + sizing?

---

## Back

### Action

**Bet 66% pot (~22bb).** Range-level solver-canonical; individual-hand close-call (see C-incomplete).

### Why (3 beats)

1. **BB's donk-then-check is CAPPED** [§7]. BB's flop donk was merged value; turn-check signals "I didn't have enough to bet-bet." Range concentrates overpairs (JJ-QQ), missed-A-high, some pair+draw slow-downs. ~27 combos post-filter.
2. **Hero's range has value + semi-bluff balance** [§2 row 2.5: ~15-20 draw-combos]. TPJ + BDFD is a RANGE-LEVEL bet (protecting semi-bluffs). Individual-hand JT has ~45% equity vs BB's check-range — value-bet threshold is marginal.
3. **LOW SPR 2.4** [§1] commits stacks on turn-river-action. 66% sizing sets up pot-sized river shove on most runouts; 50% too small; overbet wrong shape.

### Pivot (sensitivity)

**§12 modeling-sensitive.** Bet vs check is close-call at INDIVIDUAL-hand level (±2bb). **C-INCOMPLETE**: authored teaching's "bet 66% > check" is range-level-right; individual-JT-level-close-call. Realization-factor-sensitive: if hero OOP realization < 0.62, bet-66% strictly better; if > 0.65, check-back is individual-better.

### Falsification

**§14b range-level-robust; individual-hand close-call.** Headline falsifier: if pool BB raise-frequency exceeds ~25% (aggressive pool), bet-66% becomes worse than check-back. Second corpus C-incomplete (first: #13).

### Where to dig deeper

§2 (hero range has ~15-20 semi-bluff combos — **first range-level semi-bluff framework artifact**) · §4 (solver bets 66% at ~40% freq; check 20%) · §5 (pool under-sizes at 50% ~55% of time; semi-bluffs with draws only ~40-60%) · §8 (**EV close-call: bet-66% ~+10-12bb vs check ~+11-13bb**) · §13 (C-incomplete on individual-hand-closeness)

### Corpus note

**PROGRAM CLOSURE — 15 artifacts complete.** First range-level semi-bluff framework (even though pinned hand is made-TP). Second C-incomplete. T96 line now complete: #1 flop-facing-donk, #2 turn-facing-CR, #15 turn-after-donk-call. **Pre-Session Drill UX Gate 2 now unblocked.**

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Bet 66% correct" | §6 + lines.js turn_after_call.decision |
| "Hero equity ~45%" | §3 row 3.7 |
| "BB turn-check ~27 combos" | §2 row 2.6 |
| "SPR 2.4 LOW zone" | §1, §11 row 1.3 |
| "Range has 15-20 semi-bluff combos" | §2 row 2.5 |
| "Bet-66% EV ~+10-12bb" | §11 row 8.4 |
| "Check-back EV ~+11-13bb" | §11 row 8.5 |
| "MDF 60.7%" | §10.1 |
| "AP 39.3%" | §10.2 |
| "C-incomplete close-call" | §13 F-13a + §8 row 8.7 |
| "Range-level robust, individual close-call" | §14b |
| "Realization flip threshold 0.62" | §12 Assumption A |
| "15 artifacts complete" | Closing notes |

All claims grep-traceable.
