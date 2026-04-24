---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/sb-vs-btn-3bp-oop-wet-t98-flop_root.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/sb-vs-btn-3bp-oop-wet-t98-flop_root-external.md
Audit: docs/upper-surface/audits/sb-vs-btn-3bp-oop-wet-t98-flop_root-audit.md
LSW-Audit: docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md (LSW-A4 closed)
POKER_THEORY-Ref: §9.3 SB flat-3bet live-pool pathway
Authored: 2026-04-23
Word-count: ~248 (target ≤250)
---

# Drill Card — `sb-vs-btn-3bp-oop-wet-t98-flop_root`

## Front (predict before flipping)

**Spot.** **HU 3BP, hero SB (OOP).** 100bb eff → 90bb. SB open 3 → BTN 3bet to 10 → SB call (live-pool pathway — solver 3bet-or-fold). Flop **T♠9♠8♥** max-wet (straight on board, flush-draw, open-enders). Pot 21bb. Hero **A♦A♣** (AA overpair). Hero acts first.

**Question.** Action?

---

## Back

### Action

**Check (pot control).** Single recommendation; action-robust across archetypes.

### Why (3 beats)

1. **Hero ~58% equity** vs BTN 3bet range [§3 row 3.9] — ahead of range but **strong-but-vulnerable, not nut-class**. ~20 combos (sets TT/99/88 + straights 76s/QJs + top-two T9s) crush AA; ~85 combos where hero is ~72% ahead but fragile.
2. **D15 divergence triggers** [§10.3]. AA is range-top by preflop strength; ~58% equity is NOT nut-class (>80%). Range-level "top-of-range bets" reasoning would be wrong — this is the first corpus artifact where D15 BEHAVIOR-CHANGES the recommendation.
3. **Realization factor 0.75** [§10.5] — wet-board-OOP penalty depresses equity-realization. Building a large pot with strong-but-vulnerable hand on hostile runout-distribution is −EV. **Pot-control lets hero reach showdown across brick runouts and fold-cheap on scare runouts.**

### Pivot (sensitivity)

**§12 action-robust.** Equity would need to drop below ~35% to flip call-turn-to-fold-turn (huge margin). Realization would need to drop below 0.65 to consider alternative. No flip within realistic CI.

### Falsification

**§14b: No action-level headline falsifiers.** Decision-level-robust. Check is solver-dominant (~85-90%), population-corrective (population over-bets ~70-80%). **Seventh consensus-robust corpus artifact.**

### Where to dig deeper

§2 (**hero flat-3bet range ~35 combos**, live-pool pathway; §9.3 inheritance) · §3 (**split equity distribution** — 20 crushed + 85 ahead; contrasts K77 #10 heavy-nuts) · §4 (solver check ~85-90% with AA-analog) · §5 (**70pp population over-bet delta** — largest in corpus; AA-on-wet is the canonical live leak) · §10 (**D15 FIRST APPLIED** — range-top ≠ individual-hand-correct)

### Corpus note

**FIRST OVERPAIR + FIRST "CHECK CORRECT" + FIRST D15 APPLIED.** Inherits POKER_THEORY §9.3 Category-D. Chains with artifact #7 (same line, river): flop check → turn call → river fold on scare-runout. **Full AA-on-wet teaching arc.**

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Check correct" | §6 + lines.js flop_root.decision |
| "Hero ~58% equity" | §3 row 3.9, §11 |
| "20 combos crush AA" | §2 BTN range segmentation |
| "Solver ~85-90% check" | §4 row 4.2 |
| "Population 70-80% bet" | §5 row 5.2 |
| "Realization 0.75" | §11 row 10.5 |
| "D15 applicable" | §10.3-10.4, §11 row 10.3 |
| "§9.3 inheritance" | §1 + §2.3 + closing note |
| "SPR 4.3 MEDIUM zone" | §1, §11 row 1.3 |
| "Pot 21bb clean" | §1, §11 row 1.2 |
| "Strong-but-vulnerable framing" | §2 and §6 throughout |
| "Check total EV +4.5bb" | §11 row 8.7 |
| "Bet-75% EV +3.3bb (leak)" | §11 row 8.10 |

All claims grep-traceable.
