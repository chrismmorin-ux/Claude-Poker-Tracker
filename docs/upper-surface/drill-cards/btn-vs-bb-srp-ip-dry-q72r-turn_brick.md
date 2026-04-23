---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-turn_brick.md
Source-Rubric: v2.2 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-srp-ip-dry-q72r-turn_brick-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-srp-ip-dry-q72r-turn_brick-audit.md
Authored: 2026-04-23
Word-count: ~230 (target ≤250)
---

# Drill Card — `btn-vs-bb-srp-ip-dry-q72r-turn_brick`

## Front (predict before flipping)

**Spot.** BTN (IP) vs BB (OOP), SRP, 100bb. Cbet flop **Q♠7♥2♣** at 33% (1.8bb), called → turn **3♦** (brick). BB **checks**. Hero **A♠Q♣** (TPTK). Pot 9.1bb.

**Question.** Action with hero's hand?

---

## Back

### Action

**Bet 50% pot (~4.5bb).** Single action; no archetype override (verified consensus-robust per §12, §13).

### Why (3 beats)

1. Hero has **~75% equity** vs BB's turn-check range [§3, row 3.9, verified by v2.2 D13 internal-arithmetic check]. Value-heavy distribution — 70% nuts bucket, 9% air (sets), thin medium. **Value-betting is the frame; sizing is the decision.**
2. **50% sizing matches merged range.** Overbet (150%) is polar-shape mismatch — folds out 88-JJ + weak Qx (the calls we beat) and gets through only from sets (which crush us). Check-back forfeits live-pool's wider-calling tendency [§5 Claim 3].
3. Hero is **action-level-robust** across fish/reg/pro/nit archetypes [§12 Assumption C]. No archetype fold/check-back override. Sizing-preference may tighten to 33% vs nits (§14b headline falsifier 1).

### Pivot (sensitivity)

**§12 Assumption A.** If pool-BB call rate vs 50% drops below ~50% for middle pairs (88-JJ), sizing shifts from 50% to 33% (extract calls from thinner opponents). **Action stays bet; sizing flips.**

### Falsification

**§14b single headline falsifier.** A 300+ hand live-cash sample of BTN-cbet-called-to-brick-turn lines showing BB call rate vs 50% for 88-JJ outside [60%, 95%] triggers sizing reassessment. **Action remains bet — this spot is action-level-robust per §14b.**

### Where to dig deeper

§3 (75% equity, value-heavy bimodal) · §6 (single-action consensus — no D11 override needed) · §8 (bet-50% +8.4bb vs overbet +6.2bb vs check-back +4.1bb) · §14b (decision-level-robust — first artifact exercising this v2 case)

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "~75% equity" | §3, §11 row 3.9 |
| "Value-heavy distribution 70:14:7:9" | §11 row 3.10 |
| "50% sizing merged range" | §6, §11 rows 4.1-4.4 |
| "Overbet shape mismatch" | §8, §11 rows 8.5-8.6 |
| "Live pool wider calling" | §11 rows 5.2-5.4 |
| "Action-level-robust" | §12 (all 3 assumptions), §14b |
| "Bet 50% EV +8.4 / overbet +6.2 / check-back +4.1" | §11 rows 8.4, 8.6, 8.7 |
| "§14b sizing-flip falsifier (300+ hand sample)" | §14b headline falsifier 1 |

All claims grep-traceable to source artifact section anchors.
