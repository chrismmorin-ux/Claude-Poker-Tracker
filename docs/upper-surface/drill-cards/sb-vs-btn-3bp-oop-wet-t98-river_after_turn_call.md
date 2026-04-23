---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call.md
Source-Rubric: v2.2 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call-external.md
Audit: docs/upper-surface/audits/sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call-audit.md
Authored: 2026-04-23
Word-count: ~240 (target ≤250)
---

# Drill Card — `sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call`

## Front (predict before flipping)

**Spot.** SB (**OOP**) vs BTN (IP), 3BP, 90bb. Preflop: SB open 3bb, BTN 3bet to 9bb, SB call. Flop **T♠9♠8♥** check-check. Turn **2♣** check → BTN bets 66% → SB calls. River **7♠** (completes flush + straights). SB checks. BTN bets pot (49bb into 49bb). Hero **A♦A♣**.

**Question.** Action with hero's AA?

---

## Back (per v2.1 D11 archetype-conditional form)

### Action

**Default: Fold.** **Override: Call if villain is confirmed pro** (aware-exploiter who polar-bluffs scare cards against known over-folders).

### Why (3 beats)

1. River 7♠ completes **every draw** — nut flush, multiple straights, sets. Hero AA is now a **bluff-catcher**, not a nut hand. Equity vs BTN's pot-size river-bet range is **~33% — exactly at pot-odds threshold** [§3, row 3.8; v2.2 D13 inline-iteration converged to this value].
2. **Hero's AA blockers are actively unfavorable** [§9]. Hero blocks 3-4 combos of BTN's A-high *bluff* region (AKo, AQo) without blocking the A♠-containing nut flushes (A♠K♠, A♠Q♠, A♠J♠ — hero doesn't hold A♠). Post-blocker equity drops to ~29%, below threshold. **AA's "best starting hand" intuition misleads on this runout.**
3. Live pool is **value-heavy on scare cards** [§5 Claim 1 — Doug Polk + Ed Miller consensus]. Pool bluffs pot-size on scare cards at <25% of polar range; value is 70-80%. Fold-default exploits the over-call trap.

### Pivot (sensitivity)

**§12 Assumption A.** If BTN's river-bet composition tilts toward **55:45 value:bluff** (more bluffs), hero equity rises to ~45%, call becomes +EV. **§12 Assumption C (archetype):** confirmed pro triggers the call-override per v2.1 D11.

### Falsification

**§14b headline falsifier 1.** 200+ live-cash sample of BTN polar pot-bets on scare-card rivers in 3BP shows bluff fraction above 40% — default fold flips to call.

**§14b headline falsifier 2.** Villain profile (≥100 hands) shows tight-aggressive + scare-card-bluff-revealed-at-showdown pattern — override activates: call.

### Where to dig deeper

§3 (v2.2 D13 iteration: 43%→58%→33%) · §6 (archetype-conditional fold-default) · §9 (**blocker-unfavorable finding — corpus-novel**) · §12 Assumption C (pro-override) · §14b (two headline falsifiers) · POKER_THEORY.md §9.3 (SB-flat-3bet pathway — premise)

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "33% equity at pot-odds threshold" | §3, §11 row 3.8 + 3.9 |
| "v2.2 D13 inline iteration 43%→58%→33%" | §3 meta-observation + closing note item 1 |
| "Post-blocker equity ~29%" | §11 row 9.5 |
| "AA blocks 3-4 AKo/AQo bluffs without blocking A♠-flush value" | §9, §11 rows 9.1-9.3 |
| "Live pool scare-card value-heavy 70-80%" | §11 row 5.1 |
| "Assumption A flip at 55:45 composition" | §12 Assumption A |
| "Assumption C pro-override per D11" | §12 Assumption C + §6 |
| "Headline falsifier 1: 200+ sample bluff ≥ 40%" | §14b headline falsifier 1 |
| "Headline falsifier 2: pro-profile ≥100 hands" | §14b headline falsifier 2 |
| "SB-flat-3bet live-pool pathway premise" | §1 + POKER_THEORY.md §9.3 |

All claims grep-traceable to source artifact section anchors.
