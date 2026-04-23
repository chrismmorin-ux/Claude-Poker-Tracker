---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md
Source-Rubric: v2 (partial-refit)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-3bp-ip-wet-t96-flop_root-external.md
Authored: 2026-04-23
Word-count: ~230 (target ≤250)
---

# Drill Card — `btn-vs-bb-3bp-ip-wet-t96-flop_root`

## Front (predict before flipping)

**Spot.** BTN (IP) vs BB (OOP), 3-bet pot, 90bb effective. Flop **T♥9♥6♠** (wet two-tone middling). Hero **J♥T♠** (top pair J-kicker, BDFD). BB donks **33% pot (6.8bb into 20.5bb)**.

**Question.** Action with hero's hand?

---

## Back

### Action

**Call.** Pure call, no raise mix.

### Why (3 beats)

1. Hero has **~36% equity** vs villain's polar donk range [§3, post-Stage-4 recomputation; original artifact stated 30% — see Stage 4 Claim 4 finding]. Required equity at 33% bet ≈ **20%** [§10 pot-odds]. Comfortable margin.
2. Live pool **over-donks** wet non-broadway boards in 3BP with **value-heavy composition (~70:30 value:bluff)** [§5]. Solver checks ~90% of this texture — population deviates [§4].
3. **Raise is anti-exploit.** Folds out the bluff region we beat (A5s-A2s); gets called/3bet by overpairs we lose to. Raise EV ≈ -6bb vs call EV ≈ +5bb [§8].

### Pivot (sensitivity)

**§12 Assumption A.** If villain's actual donk composition crosses to **40:60 value:bluff** (much more bluffs), raise becomes a positive mix-in. **Below 22% bluff fraction** (very value-heavy nit), fold becomes correct.

### Falsification

**§14b headline falsifier 1.** A 200+ showdown-reveal sample of BB donks on wet non-broadway in live cash showing value:bluff at or below 48:52 — recommendation flips from pure call to call/raise mix.

### Where to dig deeper

§1 (setup) · §2 (range construction) · §3 (equity bucketing — *flagged Stage 4 B-finding for arithmetic recomputation*) · §6 (exploit recommendation) · §12 (sensitivity) · §14b (falsifier synthesis)

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "~36% equity" | §3 (Stage 4 B; artifact original 30%) |
| "Required equity ~20%" | §10.2 |
| "Solver checks ~90%" | §11 row 4.1 |
| "Pool over-donks 20-40%" | §11 row 5.1 |
| "Value:bluff ~70:30" | §11 rows 2.17/2.18 |
| "Raise EV -6bb / call EV +5bb" | §11 rows 8.9, 8.19 (call w/ Stage-4 corrected eq) |
| "Assumption A flip 40:60 / 22%" | §12 Assumption A |
| "Falsifier: 200+ sample value:bluff ≤ 48:52" | §14b headline falsifier 1 |

All claims grep-traceable to source artifact section anchors.
